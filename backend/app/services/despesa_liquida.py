# -*- coding: utf-8 -*-
"""
Despesa líquida (issue #31): despesa menos estorno. É a ÚNICA definição de
"quanto se gastou" que os resumos usam (dashboard, Relatórios: despesa total,
por categoria, tendência).

O estorno (`type = "refund"`) devolve parte de uma compra no cartão: abate a
despesa da categoria dele e reduz a fatura, e NUNCA é receita. Quem soma
despesa pergunta aqui, em vez de comparar `type == "expense"` por conta própria
— assim um tipo novo (ou uma regra nova) muda num lugar só.

Tudo em centavos inteiros: float acumulado erra o último centavo.
"""

from typing import Any, Dict, Iterable

DESPESA = "expense"
ESTORNO = "refund"


def eh_despesa_liquida(t: Dict[str, Any]) -> bool:
    """O lançamento entra na conta de despesa (como compra ou como abatimento)?"""
    return t["type"] in (DESPESA, ESTORNO)


def centavos(t: Dict[str, Any]) -> int:
    """Efeito do lançamento na despesa, com sinal: compra soma, estorno subtrai, o resto é 0."""
    valor = round(t["amount"] * 100)
    if t["type"] == DESPESA:
        return valor
    if t["type"] == ESTORNO:
        return -valor
    return 0


def valor(t: Dict[str, Any]) -> float:
    return centavos(t) / 100


def total_em_centavos(lancamentos: Iterable[Dict[str, Any]]) -> int:
    return sum(centavos(t) for t in lancamentos)


def total(lancamentos: Iterable[Dict[str, Any]]) -> float:
    return total_em_centavos(lancamentos) / 100
