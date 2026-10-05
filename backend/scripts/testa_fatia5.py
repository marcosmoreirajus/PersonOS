# -*- coding: utf-8 -*-
"""
Critérios de aceite da Fatia 5 (spec #4): Cartões e faturas. Este script nasce
no ticket #21 (cadastro de Cartão) e é estendido pelos tickets seguintes.
Dados isolados num `MemoriaStore`; os valores esperados são escritos à mão.
"""

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app.schemas import TransactionResponse  # noqa: E402
from app.services import cartoes  # noqa: E402
from app.services.store import MemoriaStore, usar_store  # noqa: E402

falhas = []

UID = 1
OUTRO = 2


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def recusa(nome, funcao, trecho=""):
    """Confere que a operação é recusada com ValueError (e a frase, se pedida)."""
    try:
        funcao()
    except ValueError as e:
        checa(nome, trecho.lower() in str(e).lower(), str(e))
        return
    checa(nome, False, "não recusou")


def conta(id, nome, user=UID):
    return {"id": id, "user_id": user, "name": nome, "kind": "checking", "initial_balance": 0}


def cadastro():
    print("cadastro e listagem")
    c = cartoes.criar(UID, "  Nubank   Roxo ", 5000, 25, 5)
    checa("cria com os campos pedidos", c["name"] == "Nubank Roxo" and c["limit"] == 5000.0
          and c["closing_day"] == 25 and c["due_day"] == 5 and c["user_id"] == UID, str(c))
    checa("conta pagadora nasce vazia e há data de criação", c["default_payer_account_id"] is None and c["created_at"])
    c2 = cartoes.criar(UID, "Amex", 12000.5, 1, 31, default_payer_account_id=10)
    checa("conta pagadora do próprio usuário é aceita", c2["default_payer_account_id"] == 10)
    checa("ids distintos", c["id"] != c2["id"])
    checa("lista em ordem alfabética sem diferenciar caixa",
          [x["name"] for x in cartoes.listar(UID)] == ["Amex", "Nubank Roxo"])

    print("edição")
    e = cartoes.atualizar(c["id"], limit=7000, closing_day=28, due_day=10)
    checa("edita limite e dias", e["limit"] == 7000.0 and e["closing_day"] == 28 and e["due_day"] == 10)
    e = cartoes.atualizar(c["id"], name="Nubank")
    checa("renomeia sem tocar nos outros campos", e["name"] == "Nubank" and e["limit"] == 7000.0)
    e = cartoes.atualizar(c["id"], default_payer_account_id=10)
    checa("define a conta pagadora", e["default_payer_account_id"] == 10)
    e = cartoes.atualizar(c["id"], default_payer_account_id=0)
    checa("0 remove a conta pagadora", e["default_payer_account_id"] is None)
    checa("cartão inexistente devolve None", cartoes.atualizar(999, limit=1) is None)
    checa("a edição foi gravada", next(x for x in cartoes.listar(UID) if x["id"] == c["id"])["closing_day"] == 28)

    print("nome único (sem diferenciar caixa e espaços)")
    recusa("criar com nome repetido em outra caixa", lambda: cartoes.criar(UID, "AMEX", 100, 1, 2), "já existe")
    recusa("criar com espaços sobrando", lambda: cartoes.criar(UID, " nubank  ", 100, 1, 2), "já existe")
    recusa("renomear para nome já usado", lambda: cartoes.atualizar(c["id"], name="amex"), "já existe")
    e = cartoes.atualizar(c["id"], name="NUBANK")
    checa("mudar só a caixa do próprio nome é permitido", e["name"] == "NUBANK")
    recusa("nome vazio", lambda: cartoes.criar(UID, "   ", 100, 1, 2), "nome")
    o = cartoes.criar(OUTRO, "Amex", 1, 1, 1)
    checa("outro usuário pode usar o mesmo nome", o["user_id"] == OUTRO)

    print("validação")
    for dia in (0, 32, -1):
        recusa(f"fechamento {dia} recusado", lambda d=dia: cartoes.criar(UID, f"X{dia}", 1, d, 5), "fechamento")
        recusa(f"vencimento {dia} recusado", lambda d=dia: cartoes.criar(UID, f"Y{dia}", 1, 5, d), "vencimento")
    ok = cartoes.criar(UID, "Limites", 0, 1, 31)
    checa("dias 1 e 31 e limite zero valem", ok["closing_day"] == 1 and ok["due_day"] == 31 and ok["limit"] == 0)
    recusa("limite negativo", lambda: cartoes.criar(UID, "Neg", -1, 1, 5), "limite")
    recusa("edição com dia inválido", lambda: cartoes.atualizar(c["id"], closing_day=32), "fechamento")
    recusa("edição com limite negativo", lambda: cartoes.atualizar(c["id"], limit=-0.01), "limite")
    checa("edição recusada não gravou nada", next(x for x in cartoes.listar(UID) if x["id"] == c["id"])["closing_day"] == 28)

    print("conta pagadora")
    recusa("conta de outro usuário recusada ao criar", lambda: cartoes.criar(UID, "P1", 1, 1, 5, default_payer_account_id=20), "conta")
    recusa("conta de outro usuário recusada ao editar", lambda: cartoes.atualizar(c["id"], default_payer_account_id=20), "conta")
    recusa("conta inexistente recusada", lambda: cartoes.criar(UID, "P2", 1, 1, 5, default_payer_account_id=999), "conta")

    print("isolamento por usuário")
    checa("cada usuário vê só os seus", [x["name"] for x in cartoes.listar(OUTRO)] == ["Amex"]
          and all(x["user_id"] == UID for x in cartoes.listar(UID)))


def api():
    print("cartão não é mais tipo de Conta")
    from fastapi.testclient import TestClient
    from app.main import app

    cli = TestClient(app)
    r = cli.post("/api/accounts", json={"user_id": UID, "name": "Conta Cartao", "kind": "card"})
    checa("POST /api/accounts com kind card é recusado (422)", r.status_code == 422, str(r.status_code))
    r = cli.post("/api/accounts", json={"user_id": UID, "name": "Carteira", "kind": "wallet"})
    checa("os outros tipos seguem valendo", r.status_code == 200, r.text[:80])
    conta_id = r.json()["data"]["id"]
    r = cli.patch(f"/api/accounts/{conta_id}", json={"kind": "card"})
    checa("PATCH para kind card é recusado (422)", r.status_code == 422, str(r.status_code))

    print("rotas de cartão")
    r = cli.post("/api/cards", json={"user_id": UID, "name": "Rota", "limit": 3000, "closing_day": 10, "due_day": 20})
    novo = r.json().get("data", {}) if r.status_code == 200 else {}
    checa("POST /api/cards cria", r.status_code == 200 and novo.get("name") == "Rota" and novo.get("limit") == 3000, r.text[:100])
    r = cli.post("/api/cards", json={"user_id": UID, "name": "rota ", "limit": 1, "closing_day": 1, "due_day": 1})
    checa("nome repetido devolve 400 com frase", r.status_code == 400 and "já existe" in r.json()["detail"].lower(), r.text[:100])
    r = cli.post("/api/cards", json={"user_id": UID, "name": "Dia", "limit": 1, "closing_day": 40, "due_day": 1})
    checa("dia fora de 1..31 devolve 400", r.status_code == 400, r.text[:100])
    r = cli.get(f"/api/cards/user/{UID}")
    checa("GET /api/cards/user lista", r.status_code == 200 and "Rota" in [x["name"] for x in r.json()["data"]])
    r = cli.patch(f"/api/cards/{novo.get('id')}", json={"limit": 4000, "due_day": 22})
    checa("PATCH /api/cards/{id} edita", r.status_code == 200 and r.json()["data"]["limit"] == 4000 and r.json()["data"]["due_day"] == 22, r.text[:100])
    r = cli.patch("/api/cards/999", json={"limit": 1})
    checa("PATCH de cartão inexistente devolve 404", r.status_code == 404, str(r.status_code))


def lancamento_com_vinculo():
    print("lançamento: campos novos")
    existente = {
        "id": 1, "user_id": UID, "type": "expense", "amount": 10.0, "description": "Padaria",
        "category_id": 1, "due_date": "2026-10-01", "settled_at": None, "account_id": 1,
        "is_internal_transfer": False, "needs_transfer_review": False, "series_id": None,
        "series_index": None, "ingest_state": "confirmed", "source": "manual",
        "external_id": None, "import_hash": None, "history": [], "created_at": "2026-10-01T12:00:00Z",
    }
    r = TransactionResponse.model_validate(existente).model_dump()
    checa("lançamento existente (sem os campos) devolve card_id e invoice_id nulos",
          "card_id" in r and "invoice_id" in r and r["card_id"] is None and r["invoice_id"] is None)
    r = TransactionResponse.model_validate({**existente, "card_id": 3, "invoice_id": 7}).model_dump()
    checa("lançamento pode apontar para cartão e fatura", r["card_id"] == 3 and r["invoice_id"] == 7)


def main():
    anterior = usar_store(MemoriaStore())
    try:
        store = MemoriaStore()
        store.save("accounts", [conta(10, "Itaú"), conta(20, "Alheia", OUTRO)])
        usar_store(store)
        cadastro()
        usar_store(MemoriaStore())
        api()
        lancamento_com_vinculo()
    finally:
        usar_store(anterior)

    print()
    if falhas:
        print(f"{len(falhas)} falha(s):")
        for f in falhas:
            print("  -", f)
        sys.exit(1)
    print("Todos os critérios da Fatia 5 passaram.")


main()
