"""
Relatórios: tendência do período (issue #18, spec #7). Só o PASSADO; a Projeção
(futuro) vem em outro ticket e estende a mesma lista de pontos.

Reusa de `relatorios` o intervalo (`resolver_periodo`). O recorte é o de
`_somas`: efetivado, pela data do lançamento (`settled_at`), sem transferência
interna nem ingestão pendente. O estorno (#31) abate a despesa do ponto, pela
despesa líquida (`despesa_liquida.py`); ver "Tendência (issue #18)" no spec.

Granularidade: por dia até 31 dias de período, por mês acima disso. Todo
balde do intervalo aparece, mesmo sem lançamentos (zero), para o gráfico não
pular dias nem meses. Soma em centavos inteiros para não acumular erro de float.
"""

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from app.services import despesa_liquida, relatorios
from app.services.data_service import DataService

LIMITE_DIAS_POR_DIA = 31
MESES = ("jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez")


def _centavos(valor: float) -> int:
    return round(valor * 100)


def _reais(centavos: int) -> float:
    return round(centavos / 100, 2)


def _baldes(inicio: date, fim: date, granularidade: str) -> List[Dict[str, Any]]:
    """Os baldes do intervalo, em ordem. O mês das pontas é parcial (do `de` ao `ate`)."""
    baldes = []
    d = inicio
    while d <= fim:
        if granularidade == "dia":
            baldes.append({"chave": d.isoformat(), "rotulo": f"{d.day:02d}/{d.month:02d}", "de": d, "ate": d})
            d += timedelta(days=1)
        else:
            ultimo = min(relatorios._fim_do_mes(d), fim)
            baldes.append({
                "chave": d.isoformat()[:7], "rotulo": f"{MESES[d.month - 1]}/{d.year % 100:02d}", "de": d, "ate": ultimo,
            })
            d = ultimo + timedelta(days=1)
    return baldes


def tendencia(
    user_id: int, periodo: str, hoje: str, de: Optional[str] = None, ate: Optional[str] = None
) -> Dict[str, Any]:
    """Receita, despesa e resultado por dia (até 31 dias) ou por mês, no período.

    `pontos`: lista de `{chave, rotulo, de, ate, receita, despesa, resultado}`
    (datas `AAAA-MM-DD`; `chave` é o dia ou o mês `AAAA-MM`). A Projeção
    acrescentará pontos futuros a esta mesma lista.
    """
    p = relatorios.resolver_periodo(periodo, hoje, de, ate)
    inicio, fim = date.fromisoformat(p["de"]), date.fromisoformat(p["ate"])
    granularidade = "dia" if (fim - inicio).days + 1 <= LIMITE_DIAS_POR_DIA else "mes"
    baldes = _baldes(inicio, fim, granularidade)
    somas = {b["chave"]: [0, 0] for b in baldes}
    tamanho_chave = 10 if granularidade == "dia" else 7

    for t in DataService.get_settled_by_user(user_id):
        if t.get("is_internal_transfer"):
            continue
        dia = t["settled_at"][:10]
        if not p["de"] <= dia <= p["ate"]:
            continue
        if t["type"] == "income":
            somas[dia[:tamanho_chave]][0] += _centavos(t["amount"])
        else:
            somas[dia[:tamanho_chave]][1] += despesa_liquida.centavos(t)

    pontos = []
    for b in baldes:
        receita, despesa = somas[b["chave"]]
        pontos.append({
            "chave": b["chave"], "rotulo": b["rotulo"], "de": b["de"].isoformat(), "ate": b["ate"].isoformat(),
            "receita": _reais(receita), "despesa": _reais(despesa), "resultado": _reais(receita - despesa),
        })
    return {
        "periodo": {"atalho": p["atalho"], "de": p["de"], "ate": p["ate"], "aberto": p["aberto"]},
        "granularidade": granularidade,
        "pontos": pontos,
    }
