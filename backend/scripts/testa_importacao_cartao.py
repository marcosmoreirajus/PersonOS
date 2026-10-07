# -*- coding: utf-8 -*-
"""
Critérios de aceite da importação de extrato do cartão (issue #27, Fatia 5).
Tudo pela API (preview e commit), com dados isolados num `MemoriaStore`; os
valores esperados são escritos à mão.
Fora do escopo: pagamento da fatura (#29), parcelas (#30), estorno (#31) —
a linha positiva sem marcador de pagamento virou estorno no #31 (testa_estorno.py).
"""

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services.data_service import DataService  # noqa: E402
from app.services.store import MemoriaStore, usar_store  # noqa: E402

falhas = []
UID = 1

CSV = (
    "data;descricao;valor\n"
    "05/09/2026;Mercado Extra;-100,00\n"
    "05/09/2026;Cafe Central;-8,00\n"
    "05/09/2026;Cafe Central;-8,00\n"
    "10/09/2026;Estorno Loja;30,00\n"
    "28/09/2026;Posto Shell;-50,00\n"
)


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def ofx(acctid, fitid, valor="-25.00"):
    return (
        "OFXHEADER:100\n<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>"
        "<CCACCTFROM><ACCTID>%s</ACCTID></CCACCTFROM><BANKTRANLIST>"
        "<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260903<TRNAMT>%s<FITID>%s<NAME>Livraria Cultura</STMTTRN>"
        "</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>" % (acctid, valor, fitid)
    ).encode("utf-8")


def envia(cli, rota, conteudo, nome="fatura.csv", **campos):
    return cli.post("/api/import/" + rota, files={"file": (nome, conteudo)}, data={"user_id": UID, **campos})


def main_testes():
    cli = TestClient(app)
    cartao = cli.post("/api/cards", json={"user_id": UID, "name": "Nubank", "limit": 5000, "closing_day": 25, "due_day": 5}).json()["data"]["id"]
    conta = cli.post("/api/accounts", json={"user_id": UID, "name": "Itaú CC", "initial_balance": 0}).json()["data"]["id"]
    alheio = cli.post("/api/cards", json={"user_id": 2, "name": "Visa", "limit": 1000, "closing_day": 10, "due_day": 20}).json()["data"]["id"]

    print("destino: exatamente um entre Conta e Cartão")
    checa("sem destino é 422", envia(cli, "preview", CSV.encode()).status_code == 422)
    r = envia(cli, "preview", CSV.encode(), account_id=conta, card_id=cartao)
    checa("Conta e Cartão juntos é 422", r.status_code == 422, r.text[:100])
    checa("cartão inexistente é 404", envia(cli, "preview", CSV.encode(), card_id=9999).status_code == 404)
    checa("cartão de outro usuário é 404", envia(cli, "preview", CSV.encode(), card_id=alheio).status_code == 404)

    print("prévia do cartão")
    r = envia(cli, "preview", CSV.encode(), card_id=cartao)
    p = r.json().get("data", {}) if r.status_code == 200 else {}
    checa("prévia responde 200 com o cartão como destino", r.status_code == 200 and p.get("cartao", {}).get("id") == cartao, r.text[:160])
    c = p.get("contagem", {})
    checa("4 compras novas e 1 estorno (#31: antes era tratada depois)", c.get("nova") == 4 and c.get("estorno") == 1 and c.get("tratada_depois") == 0, str(c))
    positivas = [l for l in p.get("linhas", []) if l["valor"] > 0]
    checa("a linha positiva aparece, marcada 'estorno' (não engolida)",
          len(positivas) == 1 and positivas[0]["situacao"] == "estorno" and positivas[0]["descricao"] == "Estorno Loja", str(positivas))
    checa("totais da prévia: compras 166,00 e positivas 30,00", p.get("totais") == {"entradas": 30.0, "saidas": 166.0}, str(p.get("totais")))
    checa("a prévia não grava nada", DataService.load_json("transactions") == [])

    print("importação do cartão")
    r = envia(cli, "commit", CSV.encode(), card_id=cartao)
    d = r.json().get("data", {}) if r.status_code == 200 else {}
    checa("commit importa 4 compras e 1 estorno", r.status_code == 200 and d.get("importadas") == 4 and d.get("estornos") == 1 and d.get("tratadas_depois") == 0, r.text[:200])
    gravadas = [t for t in DataService.load_json("transactions") if t.get("card_id") == cartao and t["type"] == "expense"]
    checa("gravou 4 despesas no Cartão, sem Conta, efetivadas na data do banco",
          len(gravadas) == 4 and all(t["type"] == "expense" and t["account_id"] is None and t["settled_at"] == t["due_date"] and t["source"] == "import" for t in gravadas),
          str(gravadas)[:200])
    checa("a linha positiva foi gravada como estorno (refund)", [t["type"] for t in DataService.load_json("transactions") if t["description"] == "Estorno Loja"] == ["refund"])
    cartao_faturas = lambda: {f["cycle"]: f for f in cli.get(f"/api/cards/{cartao}/invoices", params={"hoje": "2026-10-05"}).json()["data"]}
    f = cartao_faturas()
    checa("setembro soma 116,00 - 30,00 de estorno = 86,00, com os dois cafés iguais contados separados", f.get("2026-09", {}).get("total") == 86.0 and f["2026-09"]["purchases_count"] == 3, str(f))
    checa("28/09 cai na fatura de outubro (fechamento dia 25)", f.get("2026-10", {}).get("total") == 50.0, str(f))

    print("reimportar não duplica")
    r = envia(cli, "preview", CSV.encode(), card_id=cartao)
    c = r.json()["data"]["contagem"]
    checa("prévia reconhece as 4 compras e o estorno como já importados", c.get("ja_importada") == 5 and c.get("nova") == 0 and c.get("estorno") == 0, str(c))
    r = envia(cli, "commit", CSV.encode(), card_id=cartao)
    d = r.json().get("data", {})
    checa("commit não grava nada de novo", d.get("importadas") == 0 and d.get("estornos") == 0 and d.get("ja_existiam") == 5, str(d))
    checa("fatura continua igual", cartao_faturas()["2026-09"]["total"] == 86.0)
    mais = CSV + "06/09/2026;Padaria Pao;-12,00\n"
    d = envia(cli, "commit", mais.encode(), card_id=cartao).json()["data"]
    checa("extrato com uma linha a mais traz só a nova", d.get("importadas") == 1 and d.get("ja_existiam") == 5 and cartao_faturas()["2026-09"]["total"] == 98.0, str(d))

    print("compra manual do mesmo cartão é candidata a duplicata")
    inter = cli.post("/api/cards", json={"user_id": UID, "name": "Inter", "limit": 1000, "closing_day": 25, "due_day": 5}).json()["data"]["id"]
    cli.post("/api/transactions", json={"user_id": UID, "category_id": 1, "type": "expense", "amount": 40.0, "description": "Livraria Cultura",
                                        "due_date": "2026-09-15", "settled_at": "2026-09-15", "source": "manual", "card_id": inter})
    extrato = "data;descricao;valor\n16/09/2026;Livraria Cultura;-40,00\n"
    p = envia(cli, "preview", extrato.encode(), card_id=inter).json()["data"]
    checa("a linha do banco vira suspeita da compra manual", p["contagem"]["suspeita"] == 1 and p["contagem"]["nova"] == 0, str(p["contagem"]))
    chave = p["linhas"][0]["import_hash"]
    d = envia(cli, "commit", extrato.encode(), card_id=inter, decisoes='{"%s": "merge"}' % chave).json()["data"]
    fatura = cli.get(f"/api/cards/{inter}/invoices", params={"hoje": "2026-10-05"}).json()["data"]
    checa("fundir não duplica: a fatura segue com R$ 40,00 numa compra", d.get("conciliadas") == 1 and fatura[0]["total"] == 40.0 and fatura[0]["purchases_count"] == 1, str(fatura))
    checa("compra de cartão não é candidata para importação na Conta",
          envia(cli, "preview", extrato.encode(), account_id=conta).json()["data"]["contagem"]["suspeita"] == 0)

    print("aviso de outro cartão")
    envia(cli, "commit", ofx("1111", "A1"), nome="a.ofx", card_id=cartao)
    r = envia(cli, "preview", ofx("2222", "B1"), nome="b.ofx", card_id=cartao)
    aviso = r.json()["data"].get("aviso_conta") if r.status_code == 200 else None
    checa("arquivo com outro identificador avisa 'parece ser de outro cartão'", bool(aviso) and "outro cartão" in aviso, str(aviso))
    r = envia(cli, "preview", ofx("1111", "A2"), nome="a2.ofx", card_id=cartao)
    checa("mesmo identificador não avisa", r.status_code == 200 and not r.json()["data"].get("aviso_conta"), r.text[:120])

    print("importar na Conta segue como antes")
    r = envia(cli, "commit", CSV.encode(), account_id=conta)
    d = r.json().get("data", {}) if r.status_code == 200 else {}
    checa("na Conta, a linha positiva continua entrando como entrada", r.status_code == 200 and d.get("importadas") == 5, r.text[:160])
    # 98,00 do CSV (já com o estorno) + 25,00 do OFX A1: a importação na Conta não mexeu na fatura.
    checa("e a fatura do cartão não mudou com a importação na Conta", cartao_faturas()["2026-09"]["total"] == 123.0)


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
