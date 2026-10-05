# -*- coding: utf-8 -*-
"""
Critérios de aceite da aba Parcelados de Relatórios (issue #20, spec #7).
Roda sobre o MemoriaStore: nenhum arquivo é tocado.

    total é a soma real das parcelas (a sobra da divisão vai na primeira);
    realizadas e restantes contam parcela efetivada, não fatura paga; falta,
    próxima e término saem das parcelas abertas; o quitado só aparece com o
    interruptor; o total comprometido soma só os ativos.

Os valores esperados são números e datas literais, escritos à mão.
"""

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import relatorios_parcelados  # noqa: E402
from app.services.data_service import DataService  # noqa: E402
from app.services.store import MemoriaStore, usar_store  # noqa: E402

falhas = []
H = "2026-10-05"


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def compra(user_id, descricao, total, parcelas, inicio, realizadas=0, tipo_serie="installment"):
    """Uma compra parcelada pelo caminho real (total informado, sobra na primeira)."""
    t = DataService.create_transaction(
        user_id=user_id, category_id=11, type="expense", amount=total, due_date=inicio,
        description=descricao, series={"kind": tipo_serie, "frequency": "monthly", "total_count": parcelas},
    )
    efetiva(t["series_id"], realizadas)
    return t["series_id"]


def efetiva(series_id, quantas):
    """Efetiva as `quantas` primeiras parcelas (pela data de vencimento)."""
    todas = DataService.load_json("transactions")
    da_serie = sorted((t for t in todas if t.get("series_id") == series_id), key=lambda t: t["due_date"])
    for t in da_serie[:quantas]:
        t["settled_at"] = t["due_date"]
    DataService.save_json("transactions", todas)


def por_descricao(r):
    return {i["description"]: i for i in r["parcelados"]}


def principal():
    print("parcelados: ativos, quitados e total comprometido (hoje = 05/10/2026)")
    anterior_store = usar_store(MemoriaStore())
    try:
        # 1000 em 3x: 333,34 + 333,33 + 333,33 (a sobra na primeira); 1 realizada.
        compra(1, "Geladeira", 1000.0, 3, "2026-09-10", realizadas=1)
        # 100 em 7x: parcela 14,28 e primeira 14,32 (a MAIOR); 2 realizadas.
        compra(1, "Notebook", 100.0, 7, "2026-08-20", realizadas=2)
        # Nenhuma realizada e a primeira já venceu.
        compra(1, "Celular", 90.0, 3, "2026-08-01")
        # Tudo realizado: quitado.
        compra(1, "Sofá", 300.0, 2, "2026-06-05", realizadas=2)
        # Não são parcelados do usuário 1:
        compra(1, "Assinatura", 39.9, 12, "2026-10-01", tipo_serie="recurring")
        compra(2, "De outro usuário", 500.0, 5, "2026-10-01")

        r = relatorios_parcelados.parcelados(1, H)
        linhas = por_descricao(r)
        checa("por padrão só os ativos (Sofá quitado fica fora)", set(linhas) == {"Geladeira", "Notebook", "Celular"}, str(sorted(linhas)))
        checa("a recorrência e o parcelado de outro usuário não aparecem", "Assinatura" not in linhas and "De outro usuário" not in linhas)

        g = linhas["Geladeira"]
        checa("Geladeira: total 1000 (a soma real das parcelas)", g["total"] == 1000.0, str(g["total"]))
        checa("Geladeira: parcela 333,33 (a sobra de 0,01 está na primeira)", g["parcela"] == 333.33, str(g["parcela"]))
        checa("Geladeira: 1 realizada e 2 restantes", (g["realizadas"], g["restantes"]) == (1, 2), str((g["realizadas"], g["restantes"])))
        checa("Geladeira: falta 666,66", g["falta"] == 666.66, str(g["falta"]))
        checa("Geladeira: próxima 10/10 e término 10/11", (g["proxima"], g["termino"]) == ("2026-10-10", "2026-11-10"), str((g["proxima"], g["termino"])))
        checa("Geladeira: ativa e sem atraso", g["quitado"] is False and g["proxima_atrasada"] is False)

        n = linhas["Notebook"]
        checa("Notebook: total 100 com sobra na primeira (14,32 + 6 x 14,28)", n["total"] == 100.0 and n["parcela"] == 14.28, str((n["total"], n["parcela"])))
        checa("Notebook: 2 realizadas, 5 restantes", (n["realizadas"], n["restantes"]) == (2, 5), str((n["realizadas"], n["restantes"])))
        checa("Notebook: falta 71,40 (5 x 14,28; a primeira, maior, já foi paga)", n["falta"] == 71.4, str(n["falta"]))
        checa("Notebook: próxima 20/10 e término 20/02/2027", (n["proxima"], n["termino"]) == ("2026-10-20", "2027-02-20"), str((n["proxima"], n["termino"])))

        c = linhas["Celular"]
        checa("Celular: 0 realizadas, 3 restantes, falta 90", (c["realizadas"], c["restantes"], c["falta"]) == (0, 3, 90.0), str(c))
        checa("Celular: a próxima (01/08) já passou e vem marcada atrasada", c["proxima"] == "2026-08-01" and c["proxima_atrasada"] is True, str(c["proxima"]))

        checa("ordem: pela próxima parcela (atrasada primeiro)", [i["description"] for i in r["parcelados"]] == ["Celular", "Geladeira", "Notebook"],
              str([i["description"] for i in r["parcelados"]]))
        checa("total comprometido: 90 + 666,66 + 71,40 = 828,06 (só ativos)", r["total_comprometido"] == 828.06, str(r["total_comprometido"]))

        # Interruptor: o quitado entra, no fim, e o total comprometido não muda.
        r2 = relatorios_parcelados.parcelados(1, H, incluir_quitados=True)
        checa("com o interruptor o Sofá aparece, depois dos ativos", [i["description"] for i in r2["parcelados"]] == ["Celular", "Geladeira", "Notebook", "Sofá"],
              str([i["description"] for i in r2["parcelados"]]))
        s = por_descricao(r2)["Sofá"]
        checa("Sofá quitado: total 300, 2 realizadas, 0 restantes, falta 0, sem próxima, término 05/07",
              (s["total"], s["realizadas"], s["restantes"], s["falta"], s["proxima"], s["proxima_atrasada"], s["termino"], s["quitado"])
              == (300.0, 2, 0, 0.0, None, False, "2026-07-05", True), str(s))
        checa("o total comprometido não depende do interruptor", r2["total_comprometido"] == 828.06, str(r2["total_comprometido"]))

        # Parcela de ingestão pendente não conta (nem na quantidade nem no valor).
        todas = DataService.load_json("transactions")
        extra = next(t for t in todas if t["description"] == "Celular")
        todas.append({**extra, "id": max(t["id"] for t in todas) + 1, "ingest_state": "pending_reconciliation", "amount": 5000.0})
        DataService.save_json("transactions", todas)
        c = por_descricao(relatorios_parcelados.parcelados(1, H))["Celular"]
        checa("ingestão pendente fica fora das contas", (c["total"], c["restantes"]) == (90.0, 3), str(c))

        # Só quitados: sem o interruptor a lista é vazia e o total, 0.
        r3 = relatorios_parcelados.parcelados(2, H)
        checa("outro usuário vê só o dele", [i["description"] for i in r3["parcelados"]] == ["De outro usuário"], str(r3))
        checa("outro usuário: total comprometido 500", r3["total_comprometido"] == 500.0, str(r3["total_comprometido"]))
    finally:
        usar_store(anterior_store)


def so_quitado_e_vazio():
    print("estado vazio")
    anterior_store = usar_store(MemoriaStore())
    try:
        compra(1, "Sofá", 300.0, 2, "2026-06-05", realizadas=2)
        r = relatorios_parcelados.parcelados(1, H)
        checa("só quitados: sem o interruptor, lista vazia e total 0", r == {"parcelados": [], "total_comprometido": 0.0}, str(r))
        r = relatorios_parcelados.parcelados(1, H, incluir_quitados=True)
        checa("só quitados: com o interruptor, 1 linha e total 0", len(r["parcelados"]) == 1 and r["total_comprometido"] == 0.0, str(r))
        r = relatorios_parcelados.parcelados(3, H)
        checa("usuário sem lançamentos: vazio, sem erro", r == {"parcelados": [], "total_comprometido": 0.0}, str(r))
    finally:
        usar_store(anterior_store)


def api():
    print("API")
    anterior_store = usar_store(MemoriaStore())
    try:
        compra(1, "Geladeira", 1000.0, 3, "2026-09-10", realizadas=1)
        compra(1, "Sofá", 300.0, 2, "2026-06-05", realizadas=2)
        cli = TestClient(app)
        resp = cli.get("/api/reports/installments/1", params={"hoje": H})
        corpo = resp.json().get("data", {})
        checa("GET /api/reports/installments/{id} devolve os ativos", resp.status_code == 200 and [i["description"] for i in corpo.get("parcelados", [])] == ["Geladeira"] and corpo.get("total_comprometido") == 666.66, str(resp.text[:200]))
        resp = cli.get("/api/reports/installments/1", params={"hoje": H, "incluir_quitados": "true"})
        checa("incluir_quitados=true traz o quitado", resp.status_code == 200 and len(resp.json()["data"]["parcelados"]) == 2, str(resp.status_code))
        resp = cli.get("/api/reports/installments/1", params={"hoje": "05/10/2026"})
        checa("`hoje` inválido responde 422 com a frase", resp.status_code == 422 and isinstance(resp.json().get("detail"), str), str(resp.status_code))
        resp = cli.get("/api/reports/installments/1")
        checa("sem `hoje` responde 422 (quem sabe o dia é o cliente)", resp.status_code == 422, str(resp.status_code))
    finally:
        usar_store(anterior_store)


def main():
    principal()
    print()
    so_quitado_e_vazio()
    print()
    api()
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
