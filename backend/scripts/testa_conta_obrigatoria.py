# -*- coding: utf-8 -*-
"""
Critérios de aceite da conta obrigatória no lançamento manual (issue #22):
POST /api/transactions recusa lançamento manual sem conta (ou com conta alheia),
a edição só valida a conta quando ela é trocada, os criadores internos seguem
sem conta e a importação continua exigindo a conta de destino. Dados isolados
num `MemoriaStore`.
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


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def corpo(**extra):
    base = {"user_id": UID, "category_id": 1, "type": "expense", "amount": 10.0,
            "description": "Café", "due_date": "2026-10-01", "settled_at": "2026-10-01", "source": "manual"}
    base.update(extra)
    return base


def main():
    anterior = usar_store(MemoriaStore())
    try:
        cli = TestClient(app)
        conta = cli.post("/api/accounts", json={"user_id": UID, "name": "Itaú"}).json()["data"]["id"]
        alheia = cli.post("/api/accounts", json={"user_id": 2, "name": "Itaú"}).json()["data"]["id"]

        print("criação manual")
        r = cli.post("/api/transactions", json=corpo())
        checa("sem conta devolve 400 com frase em `detail`", r.status_code == 400 and "conta" in r.json().get("detail", "").lower(), r.text[:120])
        checa("e nada foi gravado", DataService.load_json("transactions") == [])
        r = cli.post("/api/transactions", json=corpo(account_id=None))
        checa("account_id nulo também é recusado", r.status_code == 400, r.text[:100])
        r = cli.post("/api/transactions", json=corpo(account_id=alheia))
        checa("conta de outro usuário é recusada (400, frase)", r.status_code == 400 and r.json().get("detail"), r.text[:100])
        r = cli.post("/api/transactions", json=corpo(account_id=9999))
        checa("conta inexistente é recusada", r.status_code == 400, r.text[:100])
        checa("nada gravado nas recusas", DataService.load_json("transactions") == [])
        r = cli.post("/api/transactions", json=corpo(account_id=conta))
        d = r.json().get("data", {}) if r.status_code == 200 else {}
        checa("com conta própria grava e guarda o account_id", r.status_code == 200 and d.get("account_id") == conta, r.text[:100])
        r = cli.post("/api/transactions", json=corpo(account_id=conta, settled_at=None, amount=30,
                     series={"kind": "installment", "frequency": "monthly", "total_count": 3}))
        checa("parcelado manual também exige e leva a conta", r.status_code == 200 and r.json()["data"]["account_id"] == conta, r.text[:100])
        r = cli.post("/api/transactions", json=corpo(settled_at=None, series={"kind": "recurring", "frequency": "monthly"}))
        checa("série manual sem conta é recusada", r.status_code == 400, r.text[:100])

        print("criadores internos e não manuais")
        interno = DataService.create_transaction(user_id=UID, category_id=1, type="expense", amount=5, due_date="2026-10-02")
        checa("DataService.create_transaction sem conta segue valendo (séries, transferência, importação)", interno["account_id"] is None)
        r = cli.post("/api/transactions", json=corpo(source="ai"))
        checa("origem não manual não é barrada pela rota", r.status_code == 200, r.text[:100])

        print("lançamento antigo sem conta")
        listados = cli.get(f"/api/transactions/user/{UID}").json()["data"]
        checa("continua listado", any(t["id"] == interno["id"] for t in listados))
        antigo = DataService.create_transaction(user_id=UID, category_id=1, type="expense", amount=7,
                                                due_date="2026-10-03", settled_at="2026-10-03")
        q = cli.get(f"/api/dashboard/{UID}").json()["data"]["accounts_balance"]
        checa("efetivado sem conta aparece em Sem conta (-7 a mais, além da origem ai)", q["no_account"] == {"balance": -17.0}, str(q))

        print("edição")
        r = cli.patch(f"/api/transactions/{antigo['id']}", json={"description": "Renomeado", "amount": 8})
        checa("editar lançamento antigo sem tocar na conta não exige conta", r.status_code == 200 and r.json()["data"]["account_id"] is None, r.text[:100])
        r = cli.patch(f"/api/transactions/{antigo['id']}", json={"account_id": alheia})
        checa("trocar para conta alheia é recusado (400, frase)", r.status_code == 400 and r.json().get("detail"), r.text[:100])
        r = cli.patch(f"/api/transactions/{antigo['id']}", json={"account_id": conta})
        checa("trocar para conta própria funciona", r.status_code == 200 and r.json()["data"]["account_id"] == conta, r.text[:100])
        q = cli.get(f"/api/dashboard/{UID}").json()["data"]["accounts_balance"]
        checa("e sai de Sem conta (sobra só o da origem ai)", q["no_account"] == {"balance": -10.0}, str(q))

        print("importação")
        arq = {"file": ("e.csv", "data;descricao;valor\n2026-10-01;Cafe;-8,00\n".encode("utf-8"))}
        r = cli.post("/api/import/preview", files=arq, data={"user_id": UID})
        checa("prévia sem conta de destino é recusada (422)", r.status_code == 422, r.text[:100])
        r = cli.post("/api/import/commit", files=arq, data={"user_id": UID})
        checa("importação sem conta de destino é recusada (422)", r.status_code == 422, r.text[:100])
        r = cli.post("/api/import/commit", files=arq, data={"user_id": UID, "account_id": conta})
        checa("com conta importa", r.status_code == 200 and r.json()["data"]["importadas"] == 1, r.text[:100])
    finally:
        usar_store(anterior)

    print()
    if falhas:
        print("FALHARAM %d: %s" % (len(falhas), "; ".join(falhas)))
        sys.exit(1)
    print("todos os critérios passaram")


if __name__ == "__main__":
    main()
