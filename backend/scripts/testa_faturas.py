# -*- coding: utf-8 -*-
"""
Critérios de aceite da Fatura e da compra manual no cartão (issue #26, Fatia 5).
Dados isolados num `MemoriaStore`; os valores esperados são escritos à mão.
Fora do escopo: pagamento (#29), importação (#27), parcelas (#30), estorno (#31).
"""

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import cartoes, faturas  # noqa: E402
from app.services.data_service import DataService  # noqa: E402
from app.services.store import MemoriaStore, usar_store  # noqa: E402

falhas = []
UID = 1


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def compra(card_id, dia, valor, desc="Compra", cat=1, user=UID):
    return DataService.create_transaction(
        user_id=user, category_id=cat, type="expense", amount=valor, description=desc,
        due_date=dia, settled_at=dia, card_id=card_id,
    )


def ciclos():
    print("ciclo da compra pelo dia de fechamento")
    checa("até o fechamento, inclusive, cai no ciclo do mês", faturas.ciclo_da_compra("2026-09-25", 25) == "2026-09")
    checa("depois do fechamento cai no mês seguinte", faturas.ciclo_da_compra("2026-09-26", 25) == "2026-10")
    checa("28/09 com fechamento 25 vai para outubro", faturas.ciclo_da_compra("2026-09-28", 25) == "2026-10")
    checa("início do mês cai no ciclo do próprio mês", faturas.ciclo_da_compra("2026-09-01", 25) == "2026-09")
    checa("virada de ano: 28/12 fecha em janeiro", faturas.ciclo_da_compra("2026-12-28", 25) == "2027-01")
    checa("fechamento 31 em fevereiro vale o último dia (28)", faturas.ciclo_da_compra("2026-02-28", 31) == "2026-02")
    checa("fechamento 31 em fevereiro de ano bissexto vale 29", faturas.ciclo_da_compra("2028-02-29", 31) == "2028-02"
          and faturas.data_de_fechamento("2028-02", 31) == "2028-02-29")
    checa("fechamento 30 em março fecha dia 30; 31/03 já é abril", faturas.ciclo_da_compra("2026-03-30", 30) == "2026-03"
          and faturas.ciclo_da_compra("2026-03-31", 30) == "2026-04")
    checa("vencimento depois do fechamento fica no mesmo mês", faturas.data_de_vencimento("2026-09", 25, 28) == "2026-09-28")
    checa("vencimento antes do fechamento vai para o mês seguinte", faturas.data_de_vencimento("2026-09", 25, 5) == "2026-10-05")
    checa("vencimento na virada de ano", faturas.data_de_vencimento("2026-12", 25, 5) == "2027-01-05")
    checa("vencimento 31 em mês curto encolhe para o último dia", faturas.data_de_vencimento("2026-01", 25, 31) == "2026-01-31"
          and faturas.data_de_vencimento("2026-02", 20, 30) == "2026-02-28")


def fatura_e_estado():
    print("fatura derivada")
    cartao = cartoes.criar(UID, "Nubank", 5000, 25, 5)
    cid = cartao["id"]
    checa("sem compras não há fatura", faturas.listar(cartao, "2026-10-05") == [])
    compra(cid, "2026-09-28", 300, "Mercado")
    compra(cid, "2026-09-25", 100.10, "Farmácia")
    compra(cid, "2026-09-10", 0.20, "Café")
    compra(cid, "2026-10-26", 50, "Posto")
    lista = faturas.listar(cartao, "2026-10-05")
    checa("uma fatura por ciclo com compra (set, out, nov), a mais nova primeiro",
          [f["cycle"] for f in lista] == ["2026-11", "2026-10", "2026-09"], str([f["cycle"] for f in lista]))
    por = {f["cycle"]: f for f in lista}
    checa("setembro soma até o dia 25 inclusive, em centavos exatos", por["2026-09"]["total"] == 100.30, str(por["2026-09"]["total"]))
    checa("a de 28/09 está em outubro", por["2026-10"]["total"] == 300.0 and por["2026-10"]["purchases_count"] == 1)
    checa("26/10 está em novembro", por["2026-11"]["total"] == 50.0)
    checa("datas de fechamento e vencimento", por["2026-10"]["closing_date"] == "2026-10-25" and por["2026-10"]["due_date"] == "2026-11-05")
    checa("estado fechada depois do fechamento", por["2026-09"]["state"] == "closed")
    checa("estado aberta no ciclo corrente", por["2026-10"]["state"] == "open")
    ate = {f["cycle"]: f["state"] for f in faturas.listar(cartao, "2026-10-25")}
    depois = {f["cycle"]: f["state"] for f in faturas.listar(cartao, "2026-10-26")}
    checa("aberta até o dia do fechamento, inclusive; fechada no dia seguinte", ate["2026-10"] == "open" and depois["2026-10"] == "closed")
    checa("nada foi gravado como fatura", DataService.load_json("invoices") == [])
    d = faturas.detalhe(cartao, "2026-10", "2026-10-05")
    checa("detalhe traz a compra de outubro com data e categoria", d["total"] == 300.0 and
          [(p["description"], p["amount"], p["date"], p["category_id"]) for p in d["purchases"]] == [("Mercado", 300.0, "2026-09-28", 1)])
    checa("ciclo sem compras não tem detalhe", faturas.detalhe(cartao, "2026-08", "2026-10-05") is None)
    t = compra(cid, "2026-09-29", 10)
    DataService.update_transaction(t["id"], {"amount": 20.0})
    checa("total acompanha a edição (derivado)", faturas.detalhe(cartao, "2026-10", "2026-10-05")["total"] == 320.0)
    DataService.delete_transaction(t["id"])
    checa("e a exclusão", faturas.detalhe(cartao, "2026-10", "2026-10-05")["total"] == 300.0)
    outro = cartoes.criar(UID, "Itaú", 1000, 10, 20)
    compra(outro["id"], "2026-09-28", 77)
    checa("compra de outro cartão não entra", faturas.detalhe(cartao, "2026-10", "2026-10-05")["total"] == 300.0)
    compra(cid, "2026-09-28", 5, user=2)
    checa("nem a de outro usuário", faturas.detalhe(cartao, "2026-10", "2026-10-05")["total"] == 300.0)
    pendente = compra(cid, "2026-09-28", 999)
    trs = DataService.load_json("transactions")
    for x in trs:
        if x["id"] == pendente["id"]:
            x["ingest_state"] = "awaiting_reconciliation"
    DataService.save_json("transactions", trs)
    checa("ingestão pendente fica fora da fatura", faturas.detalhe(cartao, "2026-10", "2026-10-05")["total"] == 300.0)


def api():
    print("API: lançamento de cartão e faturas")
    cli = TestClient(app)
    conta = cli.post("/api/accounts", json={"user_id": UID, "name": "Itaú CC", "initial_balance": 1000}).json()["data"]["id"]
    cartao = cli.post("/api/cards", json={"user_id": UID, "name": "Visa", "limit": 3000, "closing_day": 25, "due_day": 5}).json()["data"]["id"]
    alheio = cli.post("/api/cards", json={"user_id": 2, "name": "Visa", "limit": 3000, "closing_day": 25, "due_day": 5}).json()["data"]["id"]
    base = {"user_id": UID, "category_id": 1, "type": "expense", "amount": 300.0, "description": "Mercado",
            "due_date": "2026-09-28", "settled_at": "2026-09-28", "source": "manual"}

    r = cli.post("/api/transactions", json={**base, "card_id": cartao})
    d = r.json().get("data", {}) if r.status_code == 200 else {}
    checa("compra com Cartão e sem Conta é aceita", r.status_code == 200 and d.get("card_id") == cartao and d.get("account_id") is None, r.text[:120])
    r = cli.post("/api/transactions", json={**base, "card_id": cartao, "account_id": conta})
    checa("Conta e Cartão juntos são recusados (400, frase)", r.status_code == 400 and r.json().get("detail"), r.text[:100])
    r = cli.post("/api/transactions", json=base)
    checa("sem Conta nem Cartão segue recusado", r.status_code == 400, r.text[:100])
    r = cli.post("/api/transactions", json={**base, "card_id": alheio})
    checa("cartão de outro usuário é recusado", r.status_code == 400 and r.json().get("detail"), r.text[:100])
    r = cli.post("/api/transactions", json={**base, "card_id": 9999})
    checa("cartão inexistente é recusado", r.status_code == 400, r.text[:100])
    r = cli.post("/api/transactions", json={**base, "card_id": cartao, "type": "income"})
    checa("compra no cartão só como despesa", r.status_code == 400, r.text[:100])
    r = cli.post("/api/transactions", json={**base, "card_id": cartao, "settled_at": None,
                 "series": {"kind": "recurring", "frequency": "monthly"}})
    checa("recorrência no cartão fica de fora (400); o parcelado é do #30", r.status_code == 400, r.text[:100])
    r = cli.post("/api/transactions", json={**base, "card_id": cartao, "settled_at": None, "due_date": "2026-09-20", "amount": 40.0})
    checa("compra sem settled_at vale na data dela (efetivada)", r.status_code == 200 and r.json()["data"]["settled_at"] == "2026-09-20", r.text[:100])
    r = cli.post("/api/transactions", json={**base, "account_id": conta})
    checa("lançamento de conta continua igual", r.status_code == 200 and r.json()["data"]["card_id"] is None, r.text[:100])

    print("compra de cartão fica fora do saldo da conta")
    q = cli.get(f"/api/dashboard/{UID}").json()["data"]
    contas = {c["account_id"]: c["balance"] for c in q["accounts_balance"]["accounts"]}
    checa("saldo da conta só desconta o lançamento de conta", contas[conta] == 700.0, str(contas))
    checa("e a compra não vira 'Sem conta'", q["accounts_balance"]["no_account"] is None and q["accounts_balance"]["total"] == 700.0, str(q["accounts_balance"]))

    print("competência: a compra é despesa na data dela")

    def despesa(de, ate):
        r = cli.get(f"/api/reports/summary/{UID}", params={"hoje": ate, "periodo": "personalizado", "de": de, "ate": ate})
        return r.json()["data"]["despesa"]["valor"] if r.status_code == 200 else None

    # Despesas de cartão: 300 + 40 (setembro); a de conta, 300, também é de setembro.
    checa("setembro: 300 + 40 do cartão + 300 da conta", despesa("2026-09-01", "2026-09-30") == 640.0, str(despesa("2026-09-01", "2026-09-30")))
    checa("outubro e novembro: nada (sem dupla contagem futura)", despesa("2026-10-01", "2026-11-30") == 0.0, str(despesa("2026-10-01", "2026-11-30")))

    print("rotas de fatura")
    r = cli.get(f"/api/cards/{cartao}/invoices", params={"hoje": "2026-10-05"})
    lista = r.json().get("data", []) if r.status_code == 200 else []
    checa("lista as faturas do cartão", r.status_code == 200 and [f["cycle"] for f in lista] == ["2026-10", "2026-09"], r.text[:200])
    checa("a de 28/09 está na fatura de outubro (aberta) com R$ 300", bool(lista) and lista[0]["total"] == 300.0 and lista[0]["state"] == "open")
    checa("a de 20/09 está na de setembro (fechada)", len(lista) > 1 and lista[1]["total"] == 40.0 and lista[1]["state"] == "closed")
    r = cli.get(f"/api/cards/{cartao}/invoices/2026-10", params={"hoje": "2026-10-05"})
    checa("detalhe devolve as compras", r.status_code == 200 and len(r.json()["data"]["purchases"]) == 1, r.text[:200])
    checa("ciclo sem compras é 404", cli.get(f"/api/cards/{cartao}/invoices/2026-01", params={"hoje": "2026-10-05"}).status_code == 404)
    checa("ciclo malformado é 400", cli.get(f"/api/cards/{cartao}/invoices/xx", params={"hoje": "2026-10-05"}).status_code == 400)
    checa("cartão inexistente é 404", cli.get("/api/cards/9999/invoices", params={"hoje": "2026-10-05"}).status_code == 404)
    checa("hoje inválido é 400", cli.get(f"/api/cards/{cartao}/invoices", params={"hoje": "ontem"}).status_code == 400)


def main():
    anterior = usar_store(MemoriaStore())
    try:
        ciclos()
        fatura_e_estado()
    finally:
        usar_store(anterior)
    anterior = usar_store(MemoriaStore())
    try:
        api()
    finally:
        usar_store(anterior)

    print()
    if falhas:
        print("FALHARAM %d: %s" % (len(falhas), "; ".join(falhas)))
        sys.exit(1)
    print("todos os critérios passaram")


if __name__ == "__main__":
    main()
