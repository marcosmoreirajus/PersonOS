"""
Parcelas no ciclo do cartão (issue #30, Fatia 5).

O parcelado no cartão é uma série (`kind == "installment"`) com `card_id`; a
série guarda o Cartão e cada parcela gerada o herda, sem conta. A divisão do
total e a geração são as de sempre (`DataService.create_transaction` e
`series_engine`); este módulo só guarda as regras que são DO CARTÃO.

Cada parcela nasce PREVISTA (sem `settled_at`) e cai na fatura do ciclo que
contém a data dela. Ver docs/finance/spec.md, "Parcelas no cartão (issue #30)".
"""

from typing import Any, Dict, Iterable, Optional

from app.services.store import store_ativo


def validar_serie(serie: Optional[Any]) -> None:
    """
    O que o cartão aceita de série. ValueError com frase se não couber.

    Só parcelado: recorrência no cartão (assinatura) tem janela indefinida e
    outras perguntas (qual fatura, quando efetiva), e fica para outro ticket.
    """
    if serie is None:
        return
    if getattr(serie, "kind", None) != "installment" or not getattr(serie, "total_count", None):
        raise ValueError("No cartão só cabe compra à vista ou parcelada; recorrência ainda não está disponível.")


def rotulos(compras: Iterable[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
    """
    Para cada compra que é parcela: `{installment: {index, count}, predicted}`.

    `count` vem da série (a parcela só guarda o índice). `predicted` é a
    parcela ainda sem efetivação: a fatura a mostra, mas o dinheiro não se
    moveu. Compra comum (à vista) não aparece no resultado.
    """
    compras = [t for t in compras if t.get("series_id") is not None]
    if not compras:
        return {}
    series = {s["id"]: s for s in store_ativo().load("series")}
    saida: Dict[int, Dict[str, Any]] = {}
    for t in compras:
        serie = series.get(t["series_id"])
        if serie is None or t.get("series_index") is None or not serie.get("total_count"):
            continue
        saida[t["id"]] = {
            "installment": {"index": t["series_index"], "count": serie["total_count"]},
            "predicted": not t.get("settled_at"),
        }
    return saida
