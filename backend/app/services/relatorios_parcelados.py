"""
Relatórios: aba Parcelados (issue #20, spec #7).

Cada compra parcelada (série `kind == "installment"`) vira uma linha: total,
valor da parcela, realizadas e restantes, quanto falta pagar, próxima parcela
e mês de término. Ativos por padrão; os quitados só com `incluir_quitados`.

Os números saem das parcelas que EXISTEM, não de `total_count`: o total da
dívida nunca é gravado, é a soma das parcelas (spec, "Séries"). "Paga" é parcela
REALIZADA (`settled_at`), não fatura paga. A aba é independente do seletor de
Período: parcelado é compromisso em aberto, não movimento de um intervalo.

Fora: parcela de ingestão pendente (a leitura padrão já a descarta) e série de
outro usuário. Nada é gravado. Dinheiro é somado em centavos inteiros.
O Cartão da linha chega com a Fatia 5 (ticket #35): é um campo a mais no item.
"""

from datetime import date
from typing import Any, Dict, List

from app.services.data_service import DataService


def _centavos(valor: float) -> int:
    return round(valor * 100)


def _reais(centavos: int) -> float:
    return centavos / 100


def _item(serie: Dict[str, Any], parcelas: List[Dict[str, Any]], hoje: str) -> Dict[str, Any]:
    parcelas = sorted(parcelas, key=lambda t: (t["due_date"][:10], t["id"]))
    abertas = [t for t in parcelas if not t.get("settled_at")]
    proxima = abertas[0]["due_date"][:10] if abertas else None
    return {
        "series_id": serie["id"],
        "description": serie["description"],
        "total": _reais(sum(_centavos(t["amount"]) for t in parcelas)),
        # A última parcela: a primeira pode levar a sobra da divisão.
        "parcela": parcelas[-1]["amount"],
        "realizadas": len(parcelas) - len(abertas),
        "restantes": len(abertas),
        "falta": _reais(sum(_centavos(t["amount"]) for t in abertas)),
        "proxima": proxima,
        "proxima_atrasada": proxima is not None and proxima < hoje,
        "termino": parcelas[-1]["due_date"][:10],
        "quitado": not abertas,
    }


def parcelados(user_id: int, hoje: str, incluir_quitados: bool = False) -> Dict[str, Any]:
    """
    `hoje` é AAAA-MM-DD, do relógio local do cliente. Devolve
    {"parcelados": [...], "total_comprometido": float}.

    Ordem: ativos pela próxima parcela (a atrasada vem primeiro), depois os
    quitados pelo término mais recente. `proxima` e `termino` são datas
    AAAA-MM-DD (a tela mostra o mês do término); `proxima_atrasada` marca a
    próxima que já venceu. `total_comprometido` soma o que falta nos ATIVOS e
    não depende do interruptor. Sem parcelados, lista vazia e total 0.
    """
    try:
        date.fromisoformat(hoje)
    except (ValueError, TypeError):
        raise ValueError("hoje inválido: use AAAA-MM-DD") from None

    por_serie: Dict[int, List[Dict[str, Any]]] = {}
    for t in DataService.get_transactions_by_user(user_id):
        if t.get("series_id") is not None:
            por_serie.setdefault(t["series_id"], []).append(t)

    itens = [
        _item(serie, por_serie[serie["id"]], hoje)
        for serie in DataService.get_series(user_id)
        if serie.get("kind") == "installment" and serie["id"] in por_serie
    ]
    ativos = [i for i in itens if not i["quitado"]]
    quitados = [i for i in itens if i["quitado"]]
    ativos.sort(key=lambda i: (i["proxima"], i["series_id"]))
    quitados.sort(key=lambda i: (i["termino"], i["series_id"]), reverse=True)

    return {
        "parcelados": ativos + (quitados if incluir_quitados else []),
        "total_comprometido": _reais(sum(_centavos(i["falta"]) for i in ativos)),
    }
