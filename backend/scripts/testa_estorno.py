# -*- coding: utf-8 -*-
"""
Critérios de aceite do estorno no cartão (issue #31, Fatia 5).
Tudo pela API HTTP, com dados isolados num `MemoriaStore`; os valores
esperados são escritos à mão.

O estorno abate a despesa da categoria original e reduz a fatura; não é receita.
Pagamento recebido no extrato do cartão continua "tratado depois" (#32).
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
HOJE = "2026-10-05"
SETEMBRO = {"periodo": "personalizado", "de": "2026-09-01", "ate": "2026-09-30", "hoje": HOJE}


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def lanca(cli, cartao, tipo, valor, dia, desc, cat=1):
    r = cli.post("/api/transactions", json={
        "user_id": UID, "category_id": cat, "type": tipo, "amount": valor, "description": desc,
        "due_date": dia, "source": "manual", "card_id": cartao,
    })
    return r


def envia(cli, rota, conteudo, **campos):
    return cli.post("/api/import/" + rota, files={"file": ("fatura.csv", conteudo)}, data={"user_id": UID, **campos})


def estorno_manual(cli):
    print("estorno lançado no cartão")
    cartao = cli.post("/api/cards", json={"user_id": UID, "name": "Nubank", "limit": 5000, "closing_day": 25, "due_day": 5}).json()["data"]["id"]
    lanca(cli, cartao, "expense", 200.00, "2026-09-10", "Loja Azul", cat=1)
    lanca(cli, cartao, "expense", 50.10, "2026-09-12", "Mercado", cat=2)
    r = lanca(cli, cartao, "refund", 30.05, "2026-09-15", "Estorno Loja Azul", cat=1)
    checa("POST com type refund e card_id é aceito", r.status_code == 200 and r.json()["data"]["type"] == "refund", r.text[:160])
    checa("o estorno nasce efetivado na data dele", r.json()["data"].get("settled_at") == "2026-09-15", r.text[:160])
    r = lanca(cli, None, "refund", 10.0, "2026-09-15", "Sem cartão")
    checa("estorno sem cartão é recusado (400)", r.status_code == 400, r.text[:160])
    r = lanca(cli, cartao, "income", 10.0, "2026-09-15", "Receita no cartão")
    checa("receita no cartão continua recusada (400)", r.status_code == 400, r.text[:160])

    print("fatura")
    f = cli.get(f"/api/cards/{cartao}/invoices/2026-09", params={"hoje": HOJE}).json()["data"]
    checa("total da fatura = 200,00 + 50,10 - 30,05 = 220,05", f["total"] == 220.05, str(f["total"]))
    checa("remaining acompanha o total", f["remaining"] == 220.05, str(f["remaining"]))
    checa("purchases_count conta só as compras (2)", f["purchases_count"] == 2, str(f["purchases_count"]))
    est = [p for p in f["purchases"] if p.get("type") == "refund"]
    checa("o detalhe traz o estorno como linha negativa", len(est) == 1 and est[0]["amount"] == -30.05 and est[0]["category_id"] == 1, str(est))
    checa("as compras seguem positivas e com type expense",
          sorted((p["amount"], p["type"]) for p in f["purchases"] if p["type"] == "expense") == [(50.10, "expense"), (200.0, "expense")], str(f["purchases"]))
    lista = cli.get(f"/api/cards/{cartao}/invoices", params={"hoje": HOJE}).json()["data"]
    checa("a lista de faturas também mostra 220,05", lista[0]["total"] == 220.05, str(lista))

    print("dashboard (Visão Geral)")
    d = cli.get(f"/api/dashboard/{UID}").json()["data"]
    checa("despesa líquida 220,05", d["expense"] == 220.05, str(d["expense"]))
    checa("receita não inflada (0)", d["income"] == 0, str(d["income"]))
    checa("resultado = -220,05", d["balance"] == -220.05, str(d["balance"]))

    print("relatórios")
    s = cli.get(f"/api/reports/summary/{UID}", params=SETEMBRO).json()["data"]
    checa("despesa do período 220,05", s["despesa"]["valor"] == 220.05, str(s["despesa"]))
    checa("receita do período 0", s["receita"]["valor"] == 0, str(s["receita"]))
    checa("resultado -220,05", s["resultado"]["valor"] == -220.05, str(s["resultado"]))
    c = cli.get(f"/api/reports/categories/{UID}", params=SETEMBRO).json()["data"]
    por_cat = {x["category_id"]: x["valor"] for x in c["categorias"]}
    checa("categoria 1 abatida: 200,00 - 30,05 = 169,95", por_cat.get(1) == 169.95, str(por_cat))
    checa("categoria 2 intacta: 50,10", por_cat.get(2) == 50.10, str(por_cat))
    checa("total do gráfico 220,05", c["total"] == 220.05, str(c["total"]))
    t = cli.get(f"/api/reports/trend/{UID}", params=SETEMBRO).json()["data"]
    checa("tendência: despesa do mês 220,05 e receita 0",
          round(sum(p["despesa"] for p in t["pontos"]), 2) == 220.05 and sum(p["receita"] for p in t["pontos"]) == 0, str(t["pontos"][:2]))
    g = cli.get(f"/api/reports/top-expenses/{UID}", params=SETEMBRO).json()["data"]
    checa("maiores gastos só lista compras (o estorno não é gasto)", [x["amount"] for x in g["gastos"]] == [200.0, 50.10], str(g["gastos"]))

    print("últimas transações")
    u = cli.get(f"/api/dashboard/{UID}/recent").json()["data"]
    est = [x for x in u if x["description"] == "Estorno Loja Azul"]
    checa("o estorno aparece com type refund (rótulo próprio, não receita)", len(est) == 1 and est[0]["type"] == "refund", str(est))

    print("conta não é tocada")
    checa("saldo das contas segue zerado (estorno é do cartão)", cli.get(f"/api/dashboard/{UID}").json()["data"]["accounts_balance"]["total"] == 0)


CSV = (
    "data;descricao;valor\n"
    "05/09/2026;Loja Azul;-200,00\n"
    "06/09/2026;Mercado Extra;-80,00\n"
    "10/09/2026;Loja Azul;200,00\n"
    "11/09/2026;Devolucao Parcial;15,00\n"
    "12/09/2026;Pagamento recebido;500,00\n"
    "13/09/2026;PGTO RECEBIDO obrigado;120,00\n"
)


def estorno_importado(cli):
    print("importação do cartão: linha positiva vira estorno")
    cartao = cli.post("/api/cards", json={"user_id": UID, "name": "Inter", "limit": 3000, "closing_day": 25, "due_day": 5}).json()["data"]["id"]
    # A compra original já existe, categorizada: o estorno de mesmo valor e descrição a herda.
    lanca(cli, cartao, "expense", 200.00, "2026-08-20", "Loja Azul", cat=7)
    r = envia(cli, "preview", CSV.encode(), card_id=cartao)
    p = r.json().get("data", {})
    c = p.get("contagem", {})
    checa("prévia: 2 compras novas, 2 estornos, 2 pagamentos recebidos tratados depois",
          c.get("nova") == 2 and c.get("estorno") == 2 and c.get("tratada_depois") == 2, str(c))
    por_desc = {l["descricao"]: l["situacao"] for l in p.get("linhas", []) if l["valor"] > 0}
    checa("positiva sem marcador é 'estorno'", por_desc.get("Devolucao Parcial") == "estorno", str(por_desc))
    checa("'Pagamento recebido' e 'PGTO RECEBIDO' seguem tratada_depois",
          por_desc.get("Pagamento recebido") == "tratada_depois" and por_desc.get("PGTO RECEBIDO obrigado") == "tratada_depois", str(por_desc))
    checa("a prévia não grava", len(DataService.load_json("transactions")) == 1)

    r = envia(cli, "commit", CSV.encode(), card_id=cartao)
    d = r.json().get("data", {})
    checa("commit: 2 compras + 2 estornos importados; 2 tratadas depois",
          d.get("importadas") == 2 and d.get("estornos") == 2 and d.get("tratadas_depois") == 2, str(d))
    gravadas = [t for t in DataService.load_json("transactions") if t.get("type") == "refund"]
    checa("estornos gravados com type refund, no cartão, sem conta", len(gravadas) == 2 and all(t["card_id"] == cartao and t["account_id"] is None for t in gravadas), str(gravadas)[:200])
    por = {t["description"]: t for t in gravadas}
    checa("estorno igual à compra original herda a categoria dela (7)", por["Loja Azul"]["category_id"] == 7, str(por["Loja Azul"]))
    checa("estorno sem compra correspondente fica sem categoria (A revisar)", por["Devolucao Parcial"]["category_id"] is None, str(por["Devolucao Parcial"]))
    checa("nada de pagamento recebido foi gravado", all("eceb" not in (t["description"] or "") for t in DataService.load_json("transactions")))
    f = cli.get(f"/api/cards/{cartao}/invoices/2026-09", params={"hoje": HOJE}).json()["data"]
    checa("fatura de setembro = 200,00 + 80,00 - 200,00 - 15,00 = 65,00", f["total"] == 65.0 and f["purchases_count"] == 2, str(f))
    s = cli.get(f"/api/reports/summary/{UID}", params=SETEMBRO).json()["data"]
    checa("receita segue sem estornos", s["receita"]["valor"] == 0, str(s["receita"]))

    print("reimportar não duplica o estorno")
    p = envia(cli, "preview", CSV.encode(), card_id=cartao).json()["data"]
    checa("prévia reconhece os 2 estornos como já importados", p["contagem"].get("ja_importada") == 4 and p["contagem"].get("estorno") == 0, str(p["contagem"]))
    d = envia(cli, "commit", CSV.encode(), card_id=cartao).json()["data"]
    checa("commit não grava de novo", d.get("importadas") == 0 and len([t for t in DataService.load_json("transactions") if t["type"] == "refund"]) == 2, str(d))

    print("na Conta, positiva segue entrada")
    conta = cli.post("/api/accounts", json={"user_id": UID, "name": "Itaú", "initial_balance": 0}).json()["data"]["id"]
    p = envia(cli, "preview", CSV.encode(), account_id=conta).json()["data"]
    checa("na Conta não há estorno", p["contagem"].get("estorno") == 0 and p["contagem"]["tratada_depois"] == 0, str(p["contagem"]))


def main():
    anterior = usar_store(MemoriaStore())
    try:
        estorno_manual(TestClient(app))
    finally:
        usar_store(anterior)
    anterior = usar_store(MemoriaStore())
    try:
        estorno_importado(TestClient(app))
    finally:
        usar_store(anterior)

    print()
    if falhas:
        print("FALHARAM %d: %s" % (len(falhas), "; ".join(falhas)))
        sys.exit(1)
    print("todos os critérios passaram")


if __name__ == "__main__":
    main()
