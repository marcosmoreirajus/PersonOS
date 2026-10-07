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
