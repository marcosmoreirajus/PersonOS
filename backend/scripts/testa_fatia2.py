# -*- coding: utf-8 -*-
"""
Critérios de aceite da Fatia 2 (docs/finance/PRD.md), verificados sobre uma
cópia dos dados — o arquivo real não é tocado.

    criar um parcelado 24x gera 24 registros;
    criar uma recorrência sem fim gera 12;
    cancelar "esta e as futuras" e forçar uma extensão NÃO faz a série voltar;
    navegar para o 13º mês mostra a projeção sem criar registro.
"""

import json
import shutil
import sys
import tempfile
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app.services import data_service  # noqa: E402
from app.services.data_service import DataService  # noqa: E402

falhas = []


def checa(nome, condicao, detalhe=""):
    print(("  OK   " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def main():
    # Sandbox: aponta o serviço para uma cópia dos dados.
    tmp = Path(tempfile.mkdtemp(prefix="clari-fatia2-"))
    for f in (RAIZ / "data").glob("*.json"):
        shutil.copy(f, tmp / f.name)
    data_service.DATA_DIR = tmp
    print("dados de teste em", tmp)
    print()

    hoje = date.today()

    # ---------------------------------------------------- parcelado 24x
    t = DataService.create_transaction(
        user_id=1,
        category_id=11,
        type="expense",
        # No parcelado o valor informado é o TOTAL; a série guarda a parcela.
        amount=6000.0,
        due_date=hoje.isoformat(),
        description="Geladeira",
        series={"kind": "installment", "frequency": "monthly", "total_count": 24},
    )
    todas = DataService.load_json("transactions")
    parcelas = [x for x in todas if x.get("series_id") == t["series_id"]]
    checa("parcelado 24x gera 24 registros", len(parcelas) == 24, "gerou %d" % len(parcelas))
    checa(
        "parcelas numeradas de 1 a 24",
        sorted(p["series_index"] for p in parcelas) == list(range(1, 25)),
    )
    checa("nenhuma parcela nasce efetivada", all(p["settled_at"] is None for p in parcelas))
    soma = round(sum(p["amount"] for p in parcelas), 2)
    checa("soma das parcelas bate com o total informado", soma == 6000.0, "soma %.2f" % soma)

    # Divisão inexata: a sobra vai para a PRIMEIRA parcela (convenção do
    # crédito parcelado no Brasil), senão o total exibido — que é a soma —
    # deixaria de bater com o que foi digitado.
    q = DataService.create_transaction(
        user_id=1, category_id=11, type="expense", amount=1000.0,
        due_date=hoje.isoformat(), description="Divisao inexata",
        series={"kind": "installment", "frequency": "monthly", "total_count": 3},
    )
    tres = [x for x in DataService.load_json("transactions") if x.get("series_id") == q["series_id"]]
    checa("1.000 em 3x soma exatamente 1.000", round(sum(x["amount"] for x in tres), 2) == 1000.0,
          str(sorted(x["amount"] for x in tres)))
    tres_ord = sorted(tres, key=lambda x: x["due_date"])
    checa("a primeira parcela é a maior", tres_ord[0]["amount"] > tres_ord[1]["amount"],
          "1a=%.2f demais=%.2f" % (tres_ord[0]["amount"], tres_ord[1]["amount"]))

    # Arredondar para cima faria a primeira ficar MENOR que as demais; truncar
    # para baixo mantém a sobra positiva.
    sete = DataService.create_transaction(
        user_id=1, category_id=11, type="expense", amount=100.0,
        due_date=hoje.isoformat(), description="Cem em sete",
        series={"kind": "installment", "frequency": "monthly", "total_count": 7},
    )
    s7 = sorted([x for x in DataService.load_json("transactions") if x.get("series_id") == sete["series_id"]],
                key=lambda x: x["due_date"])
    checa("100 em 7x: soma exata e primeira maior",
          round(sum(x["amount"] for x in s7), 2) == 100.0 and s7[0]["amount"] > s7[1]["amount"],
          "1a=%.2f demais=%.2f" % (s7[0]["amount"], s7[1]["amount"]))

    # ------------------------------------------- recorrência sem fim = 12
    r = DataService.create_transaction(
        user_id=1,
        category_id=9,
        type="expense",
        amount=39.9,
        due_date=hoje.isoformat(),
        description="Streaming",
        series={"kind": "recurring", "frequency": "monthly"},
    )
    todas = DataService.load_json("transactions")
    ocorrencias = [x for x in todas if x.get("series_id") == r["series_id"]]
    checa("recorrência sem fim gera 12", len(ocorrencias) == 12, "gerou %d" % len(ocorrencias))
    # Regressão: o ajuste de sobra do parcelamento chegou a rodar em recorrência
    # e gerou a primeira ocorrência em -399,00. Contar registros não pegava.
    checa("recorrência: todas as ocorrências têm o mesmo valor (39,90)",
          {x["amount"] for x in ocorrencias} == {39.9}, str(sorted({x["amount"] for x in ocorrencias})))

    # ------------------------------------------------ extensão idempotente
    # O teste monta a própria situação em vez de depender do estado do dado
    # real (que já foi estendido): uma série "migrada" é uma série gravada sem
    # nenhuma ocorrência, começando no passado.
    series = DataService.load_json("series")
    migrada = {
        "id": max(x["id"] for x in series) + 1, "user_id": 1, "kind": "recurring",
        "description": "Serie migrada", "type": "expense", "category_id": 8, "account_id": None,
        "amount": 100.0, "frequency": "monthly", "anchor_day": 5,
        "start_date": (date(hoje.year, hoje.month, 5).replace(year=hoje.year - 1)).isoformat(),
        "total_count": None, "end_date": None, "ended_at": None,
    }
    series.append(migrada)
    DataService.save_json("series", series)

    primeira = DataService.estender_series(1)
    checa("primeira extensão materializa a série migrada", primeira["geradas"] > 0,
          "%d geradas, %d atrasadas" % (primeira["geradas"], primeira["atrasadas"]))
    checa("ausência maior que a janela preenche o passado como atrasadas",
          primeira["atrasadas"] >= 12, "%d atrasadas" % primeira["atrasadas"])

    antes = len(DataService.load_json("transactions"))
    segunda = DataService.estender_series(1)
    depois = len(DataService.load_json("transactions"))
    checa("estender de novo não duplica", antes == depois and segunda["geradas"] == 0,
          "%d -> %d" % (antes, depois))

    # ----------------------------- cancelar "esta e futuras" não ressuscita
    alvo = sorted(ocorrencias, key=lambda x: x["due_date"])[6]
    DataService.delete_transaction(alvo["id"], "this_and_future")
    restantes = [
        x for x in DataService.load_json("transactions") if x.get("series_id") == r["series_id"]
    ]
    DataService.estender_series(1)
    depois_extensao = [
        x for x in DataService.load_json("transactions") if x.get("series_id") == r["series_id"]
    ]
    checa(
        "cancelar 'esta e futuras' + estender não faz a série voltar",
        len(depois_extensao) == len(restantes),
        "%d -> %d" % (len(restantes), len(depois_extensao)),
    )
    serie = next(s for s in DataService.load_json("series") if s["id"] == r["series_id"])
    checa("série ficou marcada como encerrada", serie.get("ended_at") is not None)

    # ------------------------------------ projeção além do horizonte não grava
    longe_de = date(hoje.year + 2, hoje.month, 1).isoformat()
    longe_ate = date(hoje.year + 2, 12, 28).isoformat()
    antes = len(DataService.load_json("transactions"))
    proj = DataService.projetar_series(1, longe_de, longe_ate)
    depois = len(DataService.load_json("transactions"))
    checa("projeção não cria registro", antes == depois)
    checa("projeção devolve ocorrências", len(proj) > 0, "%d projetadas" % len(proj))
    checa("tudo que volta está marcado como projetado", all(p.get("projected") for p in proj))

    # ------------------------------------------------- mês curto não estoura
    f = DataService.create_transaction(
        user_id=1,
        category_id=8,
        type="expense",
        amount=100.0,
        due_date="2026-01-31",
        description="Dia 31",
        series={"kind": "recurring", "frequency": "monthly"},
    )
    datas = sorted(
        x["due_date"]
        for x in DataService.load_json("transactions")
        if x.get("series_id") == f["series_id"]
    )
    checa("dia 31 em fevereiro trunca para o último dia", "2026-02-28" in datas, str(datas[:3]))

    # -------------------------------------------------------- settle/postpone
    DataService.settle_transaction(parcelas[0]["id"])
    p0 = next(x for x in DataService.load_json("transactions") if x["id"] == parcelas[0]["id"])
    checa("settle grava efetivação", p0["settled_at"] == hoje.isoformat())

    alvo2 = parcelas[1]
    DataService.postpone_transaction(alvo2["id"], "only_this")
    p1 = next(x for x in DataService.load_json("transactions") if x["id"] == alvo2["id"])
    checa("postpone move o vencimento", p1["due_date"] > alvo2["due_date"])
    checa(
        "postpone registra o evento no histórico",
        any(e["event"] == "due_date_moved" for e in p1["history"]),
    )
    serie_p = next(s for s in DataService.load_json("series") if s["id"] == t["series_id"])
    checa("postpone NÃO encerra nem altera o molde", serie_p.get("ended_at") is None)

    print()
    if falhas:
        print("FALHARAM: %d" % len(falhas))
        for f_ in falhas:
            print("  -", f_)
        return 1
    print("todos os critérios passaram")
    shutil.rmtree(tmp, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
