# -*- coding: utf-8 -*-
"""
Critérios de aceite da Fatia 4 (docs/finance/PRD.md), verificados sobre uma
cópia dos dados — o arquivo real não é tocado.

    um mês com metade do gasto sem categoria mostra o balde encabeçando a
    lista, com o aviso de percentual; clicar leva à fila filtrada.

O lado do backend: o resumo separa o gasto sem categoria das categorias reais
(antes ele caía em "Outro", misturado com uma escolha deliberada), e a fila
"A revisar" devolve as duas seções.
"""

import sys
from datetime import date, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app.services.data_service import DataService  # noqa: E402
from app.services.store import usar_store  # noqa: E402
from suporte_testes import store_com_dados_de_exemplo  # noqa: E402

falhas = []


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def main():
    # Dados de exemplo em memória: nada é copiado nem gravado em disco.
    usar_store(store_com_dados_de_exemplo())
    print("dados de teste em memória")
    print()

    # Usuário isolado: os dados reais do usuário 1 não interferem nas contas.
    uid = 999
    hoje = date.today()
    d = lambda n: (hoje - timedelta(days=n)).isoformat()  # noqa: E731
    proximo = [max((t["id"] for t in DataService.load_json("transactions")), default=0)]

    def grava(**campos):
        proximo[0] += 1
        t = {
            "id": proximo[0], "user_id": uid, "type": "expense", "amount": 0.0,
            "description": "x", "category_id": None, "due_date": d(1), "settled_at": d(1),
            "account_id": None, "is_internal_transfer": False, "needs_transfer_review": False,
            "series_id": None, "series_index": None, "ingest_state": "confirmed",
            "source": "import", "external_id": None, "import_hash": None, "history": [],
            "created_at": "2026-09-30T12:00:00Z",
        }
        t.update(campos)
        todas = DataService.load_json("transactions")
        todas.append(t)
        DataService.save_json("transactions", todas)
        return t

    # Metade do gasto sem categoria: 500 sem categoria contra 300 + 200.
    mercado = grava(amount=300.0, category_id=1, description="Mercado", source="manual")
    grava(amount=200.0, category_id=6, description="Outros gastos", source="manual")
    sem1 = grava(amount=350.0, description="COMPRA LOJA A", settled_at=d(3), due_date=d(3))
    sem2 = grava(amount=150.0, description="COMPRA LOJA B")
    receita_sem = grava(type="income", amount=1000.0, description="PIX RECEBIDO")
    # Previsto sem categoria não entra no relatório nem na fila: numa série,
    # seriam 12 ocorrências esperando a mesma decisão.
    previsto_sem = grava(amount=999.0, description="BOLETO FUTURO", settled_at=None, due_date=d(-5))
    # Transferência entre contas não tem categoria a dar.
    grava(amount=400.0, description="TED MESMA TITULARIDADE", is_internal_transfer=True)
    # Linha em espera, sem categoria: está em análise, não é gasto do mês.
    espera = grava(amount=300.0, description="MERCADO", ingest_state="awaiting_reconciliation",
                   reconcile_candidate_id=mercado["id"])

    # ------------------------------------------------------------ resumo
    print("Resumo (relatórios)")
    resumo = DataService.get_dashboard_summary(uid)
    por_cat = resumo["expenses_by_category"]
    checa("gasto sem categoria sai do balde de categorias reais",
          "Outro" not in por_cat and "Sem categoria" not in por_cat, str(por_cat))
    checa("categorias reais continuam lá", por_cat.get("Alimentação") == 300.0 and len(por_cat) == 2, str(por_cat))
    checa("resumo informa o gasto sem categoria", resumo.get("uncategorized_expense") == 500.0,
          str(resumo.get("uncategorized_expense")))
    # Spec: is_internal_transfer = "fora de receita/despesa/relatórios".
    # Despesa = 300 + 200 + 350 + 150; os 400 da TED não entram.
    checa("transferência interna não soma em despesa", resumo["expense"] == 1000.0, str(resumo["expense"]))
    checa("saldo sem a transferência interna", resumo["balance"] == 0.0, str(resumo["balance"]))
    # 500 de gasto real sem categoria; os 999 previstos, os 300 em espera e os
    # 400 de transferência interna (que não precisa de categoria) ficam fora.
    checa("previsto, em espera e transferência interna não entram no balde",
          resumo["uncategorized_expense"] + sum(por_cat.values()) == 1000.0,
          str(resumo["uncategorized_expense"] + sum(por_cat.values())))

    # ------------------------------------------------------------ fila
    print()
    print("Fila \"A revisar\"")
    fila = DataService.get_review(uid)
    ids_sem = [t["id"] for t in fila["sem_categoria"]]
    checa("sem categoria: despesas e receitas efetivadas",
          set(ids_sem) == {sem1["id"], sem2["id"], receita_sem["id"]}, str(ids_sem))
    checa("sem categoria: previsto fica de fora", previsto_sem["id"] not in ids_sem)
    checa("sem categoria: transferência interna fica de fora",
          all(not t["is_internal_transfer"] for t in fila["sem_categoria"]))
    checa("sem categoria: mais recente primeiro", ids_sem[-1] == sem1["id"], str(ids_sem))

    conc = fila["a_conciliar"]
    checa("a conciliar: só a linha em espera", [t["id"] for t in conc] == [espera["id"]], str([t["id"] for t in conc]))
    checa("a conciliar: traz o candidato para comparar",
          conc and conc[0].get("candidato", {}).get("id") == mercado["id"]
          and conc[0]["candidato"].get("description") == "Mercado", str(conc[0].get("candidato") if conc else None))
    checa("a conciliar não aparece em sem categoria", espera["id"] not in ids_sem)
    checa("contador soma as duas seções", fila["total"] == 4, str(fila["total"]))

    outro = DataService.get_review(1)
    checa("a fila é por usuário", all(t["user_id"] == 1 for t in outro["sem_categoria"] + outro["a_conciliar"]))

    # Candidato apagado depois: a linha continua na fila, sem o comparativo.
    todas = [t for t in DataService.load_json("transactions") if t["id"] != mercado["id"]]
    DataService.save_json("transactions", todas)
    conc = DataService.get_review(uid)["a_conciliar"]
    checa("candidato que sumiu não quebra a fila", len(conc) == 1 and conc[0].get("candidato") is None)

    # ------------------------------------------------------------ API
    print()
    print("API")
    from fastapi.testclient import TestClient  # noqa: E402
    from app.main import app  # noqa: E402

    cli = TestClient(app)
    r = cli.get("/api/review/user/%d" % uid)
    checa("GET /api/review/user/{id} devolve as duas seções", r.status_code == 200
          and set(r.json()["data"]) >= {"a_conciliar", "sem_categoria", "total"}, str(r.status_code))
    r = cli.patch("/api/transactions/%d" % sem1["id"], json={"category_id": 1})
    checa("categorizar tira o item da fila", r.status_code == 200
          and sem1["id"] not in [t["id"] for t in DataService.get_review(uid)["sem_categoria"]])
    r = cli.get("/api/dashboard/%d" % uid)
    checa("dashboard pela API traz o balde", r.json()["data"]["uncategorized_expense"] == 150.0,
          str(r.json()["data"].get("uncategorized_expense")))

    print()
    if falhas:
        print("FALHARAM: %d" % len(falhas))
        for f_ in falhas:
            print("  -", f_)
        return 1
    print("todos os critérios passaram")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
