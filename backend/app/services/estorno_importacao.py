# -*- coding: utf-8 -*-
"""
Estorno na importação do cartão (issue #31).

No extrato do Cartão, linha positiva é uma de duas coisas: o pagamento da
fatura recebido (ponta do cartão, ticket #32, continua "tratada depois") ou um
estorno. Decide-se pela descrição: com marcador de pagamento, é pagamento; sem,
é estorno.

A categoria do estorno vem da compra original, mas só quando o casamento é
óbvio: compra do mesmo cartão, mesmo valor (em centavos), data até a do
estorno, descrição que casa, e todas as candidatas com a MESMA categoria. Se
não houver compra assim (devolução parcial, compra ainda não importada) ou
houver categorias diferentes, o estorno entra sem categoria e vai para "A
revisar", como qualquer linha importada.
"""

import re
from typing import Any, Callable, Dict, List, Optional

# Marcadores de pagamento da fatura nas descrições bancárias (já normalizadas).
_PAGAMENTO = re.compile(
    r"\b(pagamento|pgto|pagto|pag)\b.*\brecebid[oa]s?\b"
    r"|\bpagamento (on ?line|de fatura|fatura)\b"
)


def eh_pagamento_recebido(descricao_normalizada: str) -> bool:
    return bool(_PAGAMENTO.search(descricao_normalizada))


def categoria_da_compra_original(
    linha: Dict[str, Any],
    existentes: List[Dict[str, Any]],
    card_id: int,
    normalizar: Callable[[Optional[str]], str],
    descricoes_casam: Callable[[str, str], bool],
) -> Optional[int]:
    centavos = round(linha["amount"] * 100)
    desc = normalizar(linha["descricao"])
    categorias = set()
    for t in existentes:
        if (
            t.get("card_id") != card_id
            or t["type"] != "expense"
            or t.get("ingest_state", "confirmed") != "confirmed"
            or t.get("category_id") is None
            or round(t["amount"] * 100) != centavos
            or (t.get("settled_at") or t["due_date"])[:10] > linha["data"]
            or not descricoes_casam(desc, normalizar(t.get("description")))
        ):
            continue
        categorias.add(t["category_id"])
    return next(iter(categorias)) if len(categorias) == 1 else None
