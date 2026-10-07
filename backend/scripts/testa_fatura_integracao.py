# -*- coding: utf-8 -*-
"""
Cruzamento dos tickets da onda 4 na fatura do cartão: estorno (#31), parcelas (#30)
e total do extrato (#28). Cada ticket tem o seu script; este confere que as contas
não divergem quando os três aparecem na mesma fatura. Pela API, sobre `MemoriaStore`.
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


def main_testes():
    cli = TestClient(app)
    cartao = cli.post("/api/cards", json={"user_id": UID, "name": "Nubank", "limit": 5000, "closing_day": 25, "due_day": 5}).json()["data"]["id"]

    def lanca(tipo, dia, valor, desc):
        r = cli.post("/api/transactions", json={"user_id": UID, "category_id": 1, "type": tipo, "amount": valor, "description": desc,
                                               "due_date": dia, "settled_at": dia, "source": "manual", "card_id": cartao})
        assert r.status_code == 200, r.text

    def fatura(ciclo):
        return next(f for f in cli.get(f"/api/cards/{cartao}/invoices", params={"hoje": HOJE}).json()["data"] if f["cycle"] == ciclo)

    def declara(ciclo, total):
        r = cli.patch(f"/api/cards/{cartao}/invoices/{ciclo}", params={"hoje": HOJE}, json={"declared_total": total})
        assert r.status_code == 200, r.text

    def fila():
        return cli.get(f"/api/review/user/{UID}").json()["data"]["diferencas_fatura"]

    print("total do extrato compara com compras MENOS estornos")
    lanca("expense", "2026-08-10", 100, "Loja")
    lanca("refund", "2026-08-12", 30, "Devolução Loja")
    checa("o total da fatura é 70 (100 menos o estorno de 30)", fatura("2026-08")["total"] == 70.0, str(fatura("2026-08")))
    declara("2026-08", 70)
    checa("o extrato declara 70: bate com a conta líquida, sem item em A revisar", fila() == [], str(fila()))
    declara("2026-08", 100)
    item = fila()[0] if fila() else {}
    checa("o extrato declara 100: a diferença é 30 sobre a soma LÍQUIDA (70)",
          item.get("purchases_total") == 70.0 and item.get("difference") == 30.0, str(item))
    checa("a fatura mostra a mesma diferença", fatura("2026-08")["difference"] == 30.0, str(fatura("2026-08")))

    print("ciclo que ficou sem compras não deixa item preso em A revisar")
    ids = [t["id"] for t in cli.get(f"/api/transactions/user/{UID}").json()["data"] if t.get("card_id") == cartao]
    for i in ids:
        cli.delete(f"/api/transactions/{i}")
    checa("sem nenhuma compra no ciclo, a diferença some da fila", fila() == [], str(fila()))

    print("parcela PREVISTA não infla a diferença do extrato (#30 x #28)")
    lanca("expense", "2026-09-10", 100, "Posto")
    r = cli.post("/api/transactions", json={"user_id": UID, "category_id": 1, "type": "expense", "amount": 200, "description": "Geladeira",
                                           "due_date": "2026-09-15", "source": "manual", "card_id": cartao,
                                           "series": {"kind": "installment", "frequency": "monthly", "total_count": 2}})
    assert r.status_code == 200, r.text
    declara("2026-09", 100)
    checa("a parcela prevista entra no total da fatura (200), mas o extrato (100) bate com o realizado",
          fatura("2026-09")["total"] == 200.0 and fatura("2026-09")["difference"] == 0.0 and fila() == [], str(fatura("2026-09")))

    print("decisão 'manter a soma' reabre quando as compras mudam depois")
    declara("2026-09", 150)
    d = cli.post(f"/api/cards/{cartao}/invoices/2026-09/total-decision", params={"hoje": HOJE}, json={"decision": "purchases"})
    checa("decidir 'manter a soma' tira o item da fila", d.status_code == 200 and fila() == [], d.text[:100])
    lanca("expense", "2026-09-12", 20, "Padaria")
    itens = fila()
    checa("uma compra nova depois da decisão reabre a pergunta (soma 120 x extrato 150)",
          len(itens) == 1 and itens[0]["purchases_total"] == 120.0 and itens[0]["difference"] == 30.0, str(itens))


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
