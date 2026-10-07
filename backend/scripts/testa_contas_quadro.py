# -*- coding: utf-8 -*-
"""
Critérios de aceite do quadro de contas da Visão Geral (issue #15): cadastro e
edição de conta pela API, com o saldo do quadro (`accounts_balance`) refletindo
cada mudança. Dados isolados num `MemoriaStore`.
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


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def quadro(cli, user=UID):
    r = cli.get(f"/api/dashboard/{user}")
    return r.json()["data"]["accounts_balance"]


def main():
    anterior = usar_store(MemoriaStore())
    try:
        cli = TestClient(app)

        print("sem contas")
        q = quadro(cli)
        checa("sem contas o quadro vem vazio e o total é 0", q["accounts"] == [] and q["total"] == 0, str(q))

        print("cadastro")
        r = cli.post("/api/accounts", json={"user_id": UID, "name": "  Itaú  ", "kind": "checking", "initial_balance": 1250.5})
        itau = r.json().get("data", {}) if r.status_code == 200 else {}
        checa("POST cria a conta com nome aparado", r.status_code == 200 and itau.get("name") == "Itaú", r.text[:100])
        q = quadro(cli)
        checa(
            "a conta aparece no quadro com o saldo inicial",
            [(c["name"], c["balance"]) for c in q["accounts"]] == [("Itaú", 1250.5)] and q["total"] == 1250.5,
            str(q),
        )
        r = cli.post("/api/accounts", json={"user_id": UID, "name": "ITAÚ", "kind": "wallet"})
        checa("nome repetido sem diferenciar caixa devolve 400 com frase", r.status_code == 400 and "já existe" in r.json()["detail"].lower(), r.text[:100])
        r = cli.post("/api/accounts", json={"user_id": UID, "name": " itaú   ", "kind": "wallet"})
        checa("espaço sobrando não burla a unicidade", r.status_code == 400, r.text[:100])
        r = cli.post("/api/accounts", json={"user_id": UID, "name": "   ", "kind": "wallet"})
        checa("nome em branco devolve 400 com frase", r.status_code == 400 and r.json()["detail"], r.text[:100])
        r = cli.post("/api/accounts", json={"user_id": 2, "name": "Itaú"})
        checa("outro usuário pode ter o mesmo nome", r.status_code == 200)

        print("edição")
        cid = itau["id"]
        r = cli.patch(f"/api/accounts/{cid}", json={"name": "Itaú PJ", "kind": "savings", "initial_balance": 2000})
        d = r.json().get("data", {}) if r.status_code == 200 else {}
        checa("PATCH muda nome, tipo e saldo inicial", d.get("name") == "Itaú PJ" and d.get("kind") == "savings" and d.get("initial_balance") == 2000, r.text[:120])
        q = quadro(cli)
        checa("o quadro reflete o novo saldo inicial", {c["name"]: c["balance"] for c in q["accounts"]}.get("Itaú PJ") == 2000, str(q))
        r = cli.patch(f"/api/accounts/{cid}", json={"name": "  itaú pj "})
        checa("manter o próprio nome (outra caixa) é permitido", r.status_code == 200 and r.json()["data"]["name"] == "itaú pj", r.text[:100])
        outra = cli.post("/api/accounts", json={"user_id": UID, "name": "Nubank"}).json()["data"]["id"]
        r = cli.patch(f"/api/accounts/{outra}", json={"name": " ITAÚ  pj"})
        checa("renomear para nome de outra conta devolve 400 com frase", r.status_code == 400 and "já existe" in r.json()["detail"].lower(), r.text[:100])
        r = cli.patch(f"/api/accounts/{outra}", json={"initial_balance": -50})
        checa("saldo inicial negativo é aceito", r.status_code == 200 and r.json()["data"]["initial_balance"] == -50, r.text[:100])
        r = cli.patch(f"/api/accounts/{outra}", json={"name": "   "})
        checa("PATCH com nome em branco devolve 400", r.status_code == 400)
        r = cli.patch(f"/api/accounts/{outra}", json={"kind": "card"})
        checa("tipo cartão segue recusado (422)", r.status_code == 422)
        r = cli.patch("/api/accounts/999", json={"name": "X"})
        checa("conta que não existe devolve 404", r.status_code == 404)
        r = cli.patch(f"/api/accounts/{cid}", json={"initial_balance": 10})
        checa("editar só o saldo mantém nome e tipo", r.json()["data"]["name"] == "itaú pj" and r.json()["data"]["kind"] == "savings")

        print("não somar no Saldo Geral")
        antes = quadro(cli)["total"]
        r = cli.post("/api/accounts", json={"user_id": UID, "name": "Cofre", "kind": "savings", "initial_balance": 500, "exclude_from_total": True})
        cofre = r.json().get("data", {}) if r.status_code == 200 else {}
        checa("conta criada já marcada para ficar fora do Saldo Geral", r.status_code == 200 and cofre.get("exclude_from_total") is True, r.text[:100])
        q = quadro(cli)
        linha = next((c for c in q["accounts"] if c["name"] == "Cofre"), {})
        checa("a conta segue na lista com o próprio saldo e a marca", linha.get("balance") == 500 and linha.get("exclude_from_total") is True, str(linha))
        checa("mas o total não a soma", q["total"] == antes, f"{antes} -> {q['total']}")
        r = cli.patch(f"/api/accounts/{cofre['id']}", json={"exclude_from_total": False})
        checa("desmarcar devolve a conta ao total", r.status_code == 200 and quadro(cli)["total"] == antes + 500, r.text[:100])
        r = cli.patch(f"/api/accounts/{cofre['id']}", json={"exclude_from_total": True})
        checa("marcar de novo tira do total", quadro(cli)["total"] == antes)
        r = cli.patch(f"/api/accounts/{cofre['id']}", json={"initial_balance": 800})
        checa("editar outro campo não mexe na marca", r.json()["data"]["exclude_from_total"] is True)
        r = cli.post("/api/accounts", json={"user_id": UID, "name": "Comum"})
        checa("sem informar, a conta entra no Saldo Geral", r.json()["data"]["exclude_from_total"] is False)

        print("logos da coleção")
        for logo, ok in [
            ("catalogo:nubank", True),
            ("icone:cofrinho:ffe600", True),
            ("icone:banco:333333", True),
            ("icone:aviao:ffe600", False),
            ("icone:banco:123456", False),
            ("icone:banco", False),
            ("catalogo:inexistente", False),
            ("data:image/png;base64,iVBORw0KGgo=", False),
        ]:
            r = cli.post("/api/accounts", json={"user_id": UID, "name": f"L {logo}", "logo": logo})
            checa(f"logo {logo!r} {'aceito' if ok else 'recusado'}", (r.status_code == 200) == ok, r.text[:80])
    finally:
        usar_store(anterior)

    print()
    if falhas:
        print(f"{len(falhas)} falha(s):")
        for f in falhas:
            print("  -", f)
        sys.exit(1)
    print("Todos os critérios do quadro de contas passaram.")


main()
