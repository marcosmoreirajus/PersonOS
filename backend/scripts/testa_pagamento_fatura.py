# -*- coding: utf-8 -*-
"""
Critérios de aceite do pagamento da fatura pela conta corrente (issue #29, Fatia 5).
Tudo pela API, com dados isolados num `MemoriaStore`; valores esperados escritos à mão.
Fora do escopo: as duas pontas do pagamento (#32), saldo anterior e juros (#33),
Saldo líquido (contas menos dívida dos cartões, #37).
"""

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services.store import MemoriaStore, usar_store  # noqa: E402

falhas = []
UID = 1
HOJE = "2026-10-20"


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def csv(*linhas):
    return ("data;descricao;valor\n" + "".join(l + "\n" for l in linhas)).encode()


def main_testes():
    cli = TestClient(app)

    def post(url, **kw):
        return cli.post(url, **kw)

    def importa(rota, conteudo, **campos):
        return cli.post("/api/import/" + rota, files={"file": ("extrato.csv", conteudo)}, data={"user_id": UID, **campos})

    def compra(card_id, dia, valor, desc="Compra"):
        r = post("/api/transactions", json={"user_id": UID, "category_id": 1, "type": "expense", "amount": valor, "description": desc,
                                           "due_date": dia, "settled_at": dia, "source": "manual", "card_id": card_id})
        assert r.status_code == 200, r.text

    def fatura(card_id, ciclo):
        r = cli.get(f"/api/cards/{card_id}/invoices", params={"hoje": HOJE})
        return next((f for f in r.json()["data"] if f["cycle"] == ciclo), None)

    def saldo(conta):
        q = cli.get(f"/api/dashboard/{UID}").json()["data"]["accounts_balance"]["accounts"]
        return next(c["balance"] for c in q if c["account_id"] == conta)

    def despesa(de, ate):
        r = cli.get(f"/api/reports/summary/{UID}", params={"hoje": ate, "periodo": "personalizado", "de": de, "ate": ate})
        return r.json()["data"]["despesa"]["valor"]

    def fila():
        return cli.get(f"/api/review/user/{UID}").json()["data"]

    conta = post("/api/accounts", json={"user_id": UID, "name": "Itaú CC", "initial_balance": 1000}).json()["data"]["id"]
    nubank = post("/api/cards", json={"user_id": UID, "name": "Nubank", "limit": 5000, "closing_day": 25, "due_day": 5}).json()["data"]["id"]
    # Faturas do Nubank: agosto (fecha 25/08) R$ 300; setembro (fecha 25/09) R$ 200.
    compra(nubank, "2026-08-10", 300, "Mercado")
    compra(nubank, "2026-09-10", 200, "Posto")

    print("sugestão: valor igual ao total de fatura fechada")
    extrato = csv("06/09/2026;Debito automatico;-300,00", "12/09/2026;Padaria;-200,00", "07/09/2026;Salario;1000,00")
    p = importa("preview", extrato, account_id=conta).json()["data"]
    c = p["contagem"]
    checa("a prévia separa 1 possível pagamento de fatura; as outras 2 são novas", c.get("pagamento_fatura") == 1 and c.get("nova") == 2, str(c))
    checa("200 em 12/09 não é sugerido: a fatura de setembro ainda não fechou", [l["situacao"] for l in p["linhas"] if l["descricao"] == "Padaria"] == ["nova"])
    d = importa("commit", extrato, account_id=conta).json()["data"]
    checa("commit grava as 2 novas e deixa 1 esperando decisão", d.get("importadas") == 2 and d.get("aguardando_pagamento") == 1, str(d))
    checa("a linha esperando fica fora do saldo da conta (1000 - 200 + 1000)", saldo(conta) == 1800.0, str(saldo(conta)))
    despesa_antes = despesa("2026-08-01", "2026-09-30")
    f = fila()
    pend = f.get("pagamentos_fatura", [])
    checa("aparece na seção 'Pagamentos de fatura' de A revisar, e não na de conciliação",
          len(pend) == 1 and pend[0]["description"] == "Debito automatico" and all(t["description"] != "Debito automatico" for t in f["a_conciliar"]), str(pend)[:200])
    checa("o contador da fila inclui o pagamento sugerido", f["total"] >= 1)
    item = pend[0] if pend else {}
    checa("fatura padrão: a de agosto do Nubank, com a opção marcada como sugerida",
          item.get("padrao", {}).get("card_id") == nubank and item.get("padrao", {}).get("cycle") == "2026-08"
          and any(o["cycle"] == "2026-08" and o["sugerida"] for o in item.get("opcoes", [])), str(item.get("padrao")))
    r = post(f"/api/reconcile/{item.get('id', 0)}", json={"action": "not_duplicate"})
    checa("a conciliação comum não decide pagamento de fatura (400)", r.status_code == 400, r.text[:100])

    print("confirmar: pagamento total")
    r = post(f"/api/invoice-payments/{item['id']}", json={"card_id": nubank, "cycle": "2026-08"})
    checa("confirmar responde 200", r.status_code == 200, r.text[:160])
    ag = fatura(nubank, "2026-08")
    checa("fatura de agosto fica paga, restante 0", ag["state"] == "paid" and ag["remaining"] == 0.0 and ag["paid"] == 300.0, str(ag))
    checa("o saldo da conta considera a ponta do pagamento (1800 - 300)", saldo(conta) == 1500.0, str(saldo(conta)))
    checa("pagamento não é despesa: o relatório não muda", despesa("2026-08-01", "2026-09-30") == despesa_antes)
    checa("a linha sai da fila", all(t["description"] != "Debito automatico" for t in fila()["pagamentos_fatura"]))
    r = post(f"/api/invoice-payments/{item['id']}", json={"card_id": nubank, "cycle": "2026-08"})
    checa("confirmar de novo é recusado (400)", r.status_code == 400, r.text[:100])

    print("pagamento parcial, por marcador na descrição")
    extrato = csv("10/10/2026;PGTO FATURA NUBANK;-50,00")
    p = importa("preview", extrato, account_id=conta).json()["data"]
    checa("descrição com 'fatura' vira sugestão mesmo sem bater o valor", p["contagem"].get("pagamento_fatura") == 1, str(p["contagem"]))
    importa("commit", extrato, account_id=conta)
    item = fila()["pagamentos_fatura"][0]
    checa("a única opção é a fatura de setembro (a de agosto já está paga)", [o["cycle"] for o in item["opcoes"]] == ["2026-09"], str(item["opcoes"]))
    post(f"/api/invoice-payments/{item['id']}", json={"card_id": nubank, "cycle": "2026-09"})
    st = fatura(nubank, "2026-09")
    checa("fatura de setembro fica parcialmente paga com restante 150", st["state"] == "partially_paid" and st["remaining"] == 150.0 and st["paid"] == 50.0, str(st))
    checa("o valor do pagamento é o da linha real (50)", saldo(conta) == 1450.0, str(saldo(conta)))

    print("marcar à mão qualquer saída")
    r = post("/api/transactions", json={"user_id": UID, "category_id": 1, "type": "expense", "amount": 150.0, "description": "Transferencia",
                                        "due_date": "2026-10-12", "settled_at": "2026-10-12", "source": "manual", "account_id": conta})
    manual = r.json()["data"]["id"]
    op = cli.get(f"/api/invoice-payments/{manual}/options").json()["data"]
    checa("as opções de uma saída comum trazem a fatura de setembro", [o["cycle"] for o in op["opcoes"]] == ["2026-09"], str(op))
    r = post(f"/api/invoice-payments/{manual}", json={"card_id": nubank, "cycle": "2026-09"})
    checa("marcar manualmente responde 200", r.status_code == 200, r.text[:160])
    checa("fatura de setembro fica paga", fatura(nubank, "2026-09")["state"] == "paid" and fatura(nubank, "2026-09")["remaining"] == 0.0)
    checa("o saldo desce uma vez só, 150 (a saída já valia na conta)", saldo(conta) == 1300.0, str(saldo(conta)))

    print("recusar devolve como despesa comum")
    itau = post("/api/cards", json={"user_id": UID, "name": "Itau Card", "limit": 1000, "closing_day": 25, "due_day": 5}).json()["data"]["id"]
    compra(itau, "2026-08-10", 80, "Loja")
    extrato = csv("11/10/2026;Farmacia Popular;-80,00")
    importa("commit", extrato, account_id=conta)
    item = fila()["pagamentos_fatura"][0]
    d0 = despesa("2026-10-01", "2026-10-31")
    r = post(f"/api/invoice-payments/{item['id']}/reject")
    checa("recusar responde 200", r.status_code == 200, r.text[:120])
    checa("a linha vira despesa comum (entra no relatório)", despesa("2026-10-01", "2026-10-31") == d0 + 80.0, str(despesa("2026-10-01", "2026-10-31")))
    checa("a fatura do Itau continua fechada, restante 80", fatura(itau, "2026-08")["state"] == "closed" and fatura(itau, "2026-08")["remaining"] == 80.0, str(fatura(itau, "2026-08")))
    checa("e o saldo da conta cai 80 como qualquer despesa", saldo(conta) == 1220.0, str(saldo(conta)))
    again = importa("preview", extrato, account_id=conta).json()["data"]
    checa("reimportar a mesma linha a reconhece como já importada (não volta a sugerir)", again["contagem"].get("ja_importada") == 1 and again["contagem"].get("pagamento_fatura") == 0, str(again["contagem"]))

    print("validações")
    r = post("/api/transactions", json={"user_id": UID, "category_id": 1, "type": "income", "amount": 10.0, "description": "Entrada",
                                        "due_date": "2026-10-13", "settled_at": "2026-10-13", "source": "manual", "account_id": conta})
    entrada = r.json()["data"]["id"]
    checa("só saída da conta pode ser pagamento (400)", post(f"/api/invoice-payments/{entrada}", json={"card_id": nubank, "cycle": "2026-09"}).status_code == 400)
    checa("ciclo sem compras é recusado (400)", post(f"/api/invoice-payments/{manual}", json={"card_id": nubank, "cycle": "2025-01"}).status_code == 400)
    checa("lançamento inexistente é 404", post("/api/invoice-payments/9999", json={"card_id": nubank, "cycle": "2026-09"}).status_code == 404)
    outro = post("/api/cards", json={"user_id": 2, "name": "Alheio", "limit": 1000, "closing_day": 25, "due_day": 5}).json()["data"]["id"]
    despesa_nova = post("/api/transactions", json={"user_id": UID, "category_id": 1, "type": "expense", "amount": 5.0, "description": "Cafe",
                                                   "due_date": "2026-10-14", "settled_at": "2026-10-14", "source": "manual", "account_id": conta}).json()["data"]["id"]
    checa("cartão de outro usuário é recusado (400)", post(f"/api/invoice-payments/{despesa_nova}", json={"card_id": outro, "cycle": "2026-09"}).status_code == 400)
    compra(nubank, "2026-10-05", 60, "Cinema")
    r = post(f"/api/invoice-payments/{despesa_nova}", json={"card_id": nubank, "cycle": "2026-10"})
    checa("fatura ainda aberta na data da saída é recusada (400)", r.status_code == 400, r.text[:100])
    r = post(f"/api/invoice-payments/{despesa_nova}", json={"card_id": nubank, "cycle": "2026-08"})
    checa("fatura já quitada é recusada (400): o pagamento não some sem abater nada", r.status_code == 400, r.text[:100])


def main():
    anterior = usar_store(MemoriaStore())
    try:
        main_testes()
    finally:
        usar_store(anterior)

    print()
    if falhas:
        print("FALHARAM %d: %s" % (len(falhas), "; ".join(falhas)))
        sys.exit(1)
    print("todos os critérios passaram")


if __name__ == "__main__":
    main()
