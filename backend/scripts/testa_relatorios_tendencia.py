# -*- coding: utf-8 -*-
"""
Critérios de aceite da tendência de Relatórios (issue #18, spec #7). Roda sobre
o MemoriaStore: nenhum arquivo é tocado.

    por dia até 31 dias, por mês acima disso; todo dia/mês do período aparece,
    com zero quando não há lançamento; receita, despesa e resultado de cada
    ponto; transferência interna, ingestão pendente, previsto e outro usuário
    ficam fora; período inválido responde 422.

Os valores esperados são datas e números literais, escritos à mão.
"""

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import relatorios_tendencia  # noqa: E402
from app.services.store import MemoriaStore, usar_store  # noqa: E402

falhas = []


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


_proximo = [0]


def lanc(user_id=1, tipo="expense", valor=0.0, data="2026-10-01", **campos):
    """Um lançamento efetivado na `data` (a data do lançamento)."""
    _proximo[0] += 1
    t = {
        "id": _proximo[0], "user_id": user_id, "type": tipo, "amount": valor,
        "description": "x", "category_id": None, "due_date": data, "settled_at": data,
        "account_id": None, "is_internal_transfer": False, "needs_transfer_review": False,
        "series_id": None, "series_index": None, "ingest_state": "confirmed",
        "source": "manual", "external_id": None, "import_hash": None, "history": [],
        "created_at": "2026-09-30T12:00:00Z",
    }
    t.update(campos)
    return t


def linhas(r):
    """(chave, receita, despesa, resultado) de cada ponto."""
    return [(p["chave"], p["receita"], p["despesa"], p["resultado"]) for p in r["pontos"]]


def main():
    H = "2026-10-07"
    store = MemoriaStore()
    store.save("transactions", [
        # Outubro, até hoje (07/10).
        lanc(tipo="income", valor=1000, data="2026-10-02"),
        lanc(valor=0.1, data="2026-10-02"),
        lanc(valor=0.2, data="2026-10-02"),  # 0,1 + 0,2 em float dá 0,30000000000000004
        lanc(valor=40.5, data="2026-10-05"),
        lanc(tipo="income", valor=10, data="2026-10-05"),
        # Setembro.
        lanc(tipo="income", valor=3000, data="2026-09-05"),
        lanc(valor=1200.75, data="2026-09-10"),
        lanc(valor=300, data="2026-09-30"),
        # Julho (agosto fica vazio).
        lanc(valor=80, data="2026-07-31"),
        lanc(tipo="income", valor=20, data="2026-07-01"),
        # Fora de qualquer número:
        lanc(valor=5000, data="2026-10-02", is_internal_transfer=True),
        lanc(tipo="income", valor=5000, data="2026-10-02", is_internal_transfer=True),
        lanc(valor=7000, data="2026-10-02", ingest_state="pending_reconciliation"),
        lanc(valor=3000, data="2026-10-03", settled_at=None),  # previsto
        lanc(user_id=2, valor=9999, data="2026-10-02"),
        lanc(valor=9999, data="2026-10-08"),  # depois de hoje
    ])
    anterior_store = usar_store(store)
    try:
        print("por dia (este mês: 01 a 07/10, 7 dias)")
        r = relatorios_tendencia.tendencia(1, "mes", H)
        checa("granularidade dia", r["granularidade"] == "dia", r["granularidade"])
        checa("um ponto por dia, de 01 a 07",
              [p["chave"] for p in r["pontos"]] == [f"2026-10-0{d}" for d in range(1, 8)], str(linhas(r)))
        checa("rótulo do dia é DD/MM", r["pontos"][0]["rotulo"] == "01/10" and r["pontos"][6]["rotulo"] == "07/10")
        por_dia = {c: (rec, des, res) for c, rec, des, res in linhas(r)}
        checa("dia 02: 1000 de receita, 0,30 exato de despesa (centavos, sem float)",
              por_dia["2026-10-02"] == (1000, 0.3, 999.7), str(por_dia["2026-10-02"]))
        checa("dia 05: receita 10, despesa 40,50, resultado negativo", por_dia["2026-10-05"] == (10, 40.5, -30.5))
        checa("dia sem lançamento vem com zero", por_dia["2026-10-01"] == (0, 0, 0) and por_dia["2026-10-07"] == (0, 0, 0))
        checa("transferência, pendente, previsto, outro usuário e futuro não entram",
              sum(p["despesa"] for p in r["pontos"]) == 40.8 and sum(p["receita"] for p in r["pontos"]) == 1010)
        checa("devolve o período usado", r["periodo"]["de"] == "2026-10-01" and r["periodo"]["ate"] == "2026-10-07")

        print("limite de 31 dias")
        r = relatorios_tendencia.tendencia(1, "personalizado", H, "2026-09-01", "2026-10-01")
        checa("31 dias (01/09 a 01/10) ainda é por dia", r["granularidade"] == "dia" and len(r["pontos"]) == 32 - 1, str(len(r["pontos"])))
        r = relatorios_tendencia.tendencia(1, "personalizado", H, "2026-09-01", "2026-10-02")
        checa("32 dias (01/09 a 02/10) já é por mês", r["granularidade"] == "mes" and [p["chave"] for p in r["pontos"]] == ["2026-09", "2026-10"])
        r = relatorios_tendencia.tendencia(1, "mes_anterior", H)
        checa("setembro inteiro (30 dias) é por dia", r["granularidade"] == "dia" and len(r["pontos"]) == 30)

        print("por mês (últimos 3 meses: 01/08 a 07/10)")
        r = relatorios_tendencia.tendencia(1, "ultimos_3_meses", H)
        checa("granularidade mês", r["granularidade"] == "mes")
        checa("agosto vazio entra com zero; set e out somados",
              linhas(r) == [("2026-08", 0, 0, 0), ("2026-09", 3000, 1500.75, 1499.25), ("2026-10", 1010, 40.8, 969.2)], str(linhas(r)))
        checa("rótulo do mês é mmm/aa", [p["rotulo"] for p in r["pontos"]] == ["ago/26", "set/26", "out/26"])
        checa("o mês aberto termina em hoje", r["pontos"][2]["de"] == "2026-10-01" and r["pontos"][2]["ate"] == "2026-10-07")

        r = relatorios_tendencia.tendencia(1, "personalizado", H, "2026-07-15", "2026-09-10")
        checa("personalizado: pontas parciais; julho só conta de 15 a 31 (80 de despesa, a receita do dia 1 fica fora)",
              linhas(r) == [("2026-07", 0, 80, -80), ("2026-08", 0, 0, 0), ("2026-09", 3000, 1200.75, 1799.25)], str(linhas(r)))
        checa("a ponta inicial começa no dia pedido", r["pontos"][0]["de"] == "2026-07-15" and r["pontos"][2]["ate"] == "2026-09-10")

        r = relatorios_tendencia.tendencia(1, "ano", "2026-12-31")
        checa("este ano: 12 meses, jan a dez", len(r["pontos"]) == 12 and r["pontos"][0]["chave"] == "2026-01" and r["pontos"][11]["chave"] == "2026-12")

        print("usuário sem lançamentos")
        r = relatorios_tendencia.tendencia(3, "mes", H)
        checa("pontos todos zerados, sem erro", len(r["pontos"]) == 7 and all((p["receita"], p["despesa"], p["resultado"]) == (0, 0, 0) for p in r["pontos"]))

        print("rota")
        cli = TestClient(app)
        resp = cli.get("/api/reports/trend/1", params={"periodo": "ultimos_3_meses", "hoje": H})
        corpo = resp.json().get("data", {})
        checa("GET /api/reports/trend/{id} devolve os pontos", resp.status_code == 200 and len(corpo.get("pontos", [])) == 3, str(resp.status_code))
        resp = cli.get("/api/reports/trend/1", params={"hoje": H})
        checa("sem período usa o padrão (este mês)", resp.status_code == 200 and resp.json()["data"]["periodo"]["atalho"] == "mes")
        resp = cli.get("/api/reports/trend/1", params={"periodo": "personalizado", "hoje": H, "de": "2026-09-10", "ate": "2026-09-01"})
        checa("período invertido responde 422 com a frase", resp.status_code == 422 and isinstance(resp.json().get("detail"), str))
        resp = cli.get("/api/reports/trend/1", params={"periodo": "nunca"})
        checa("sem `hoje` responde 422", resp.status_code == 422)
        resp = cli.get("/api/reports/trend/1", params={"periodo": "nunca", "hoje": H})
        checa("atalho desconhecido responde 422", resp.status_code == 422)
    finally:
        usar_store(anterior_store)

    print()
    if falhas:
        print("FALHARAM: %d" % len(falhas))
        for f_ in falhas:
            print("  -", f_)
        return 1
    print("todos os critérios passaram")
    return 0


if __name__ == "__main__":
    sys.exit(main())
