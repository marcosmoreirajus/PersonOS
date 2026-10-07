"""
Faturas (issue #26, Fatia 5): ciclo, total e estado de cada fatura de um Cartão.

Tudo aqui é derivado: a fatura NÃO é gravada. Ela "nasce" quando existe a
primeira compra do ciclo; total e estado saem das compras (lançamentos com
`card_id`) e da data de hoje. O pagamento (#29) é um lançamento da conta com
`invoice_payment = {card_id, cycle}`: não compõe o total, abate o restante.
Saldo anterior, encargos e estorno entram nos tickets #33 e #31.

Ciclo: identificado pelo mês de FECHAMENTO, "AAAA-MM". Compra com data até o
dia de fechamento, inclusive, entra no ciclo do próprio mês; depois dele, no
seguinte. Dia de fechamento maior que o mês (31 em fevereiro) vale o último
dia do mês, e o mesmo vale para o vencimento.
"""

import calendar
from datetime import date
from typing import Any, Dict, List, Optional

from app.services import despesa_liquida, parcelas_cartao
from app.services.data_service import DataService


def _dia_no_mes(ano: int, mes: int, dia: int) -> date:
    """O dia pedido, encolhido para o último do mês quando o mês é mais curto."""
    return date(ano, mes, min(dia, calendar.monthrange(ano, mes)[1]))


def _ciclo(texto: str) -> tuple[int, int]:
    """Lê 'AAAA-MM'; ValueError com frase se malformado."""
    try:
        ano, mes = texto.split("-")
        if len(ano) != 4 or len(mes) != 2 or not 1 <= int(mes) <= 12:
            raise ValueError
        return int(ano), int(mes)
    except ValueError:
        raise ValueError("Ciclo inválido: use AAAA-MM.") from None


def _proximo(ano: int, mes: int) -> tuple[int, int]:
    return (ano + 1, 1) if mes == 12 else (ano, mes + 1)


def _rotulo(ano: int, mes: int) -> str:
    return f"{ano:04d}-{mes:02d}"


def data_de_fechamento(ciclo: str, closing_day: int) -> str:
    ano, mes = _ciclo(ciclo)
    return _dia_no_mes(ano, mes, closing_day).isoformat()


def data_de_vencimento(ciclo: str, closing_day: int, due_day: int) -> str:
    """Vencimento até o dia de fechamento cai no mês seguinte ao do fechamento."""
    ano, mes = _ciclo(ciclo)
    fecha = _dia_no_mes(ano, mes, closing_day)
    if due_day > fecha.day:
        return _dia_no_mes(ano, mes, due_day).isoformat()
    ano, mes = _proximo(ano, mes)
    return _dia_no_mes(ano, mes, due_day).isoformat()


def ciclo_da_compra(data: str, closing_day: int) -> str:
    """Em qual fatura (mês de fechamento) cai uma compra feita em `data`."""
    d = date.fromisoformat(data[:10])
    if d <= _dia_no_mes(d.year, d.month, closing_day):
        return _rotulo(d.year, d.month)
    return _rotulo(*_proximo(d.year, d.month))


def _compras(cartao: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Compras do cartão: só as confirmadas (ingestão pendente não conta em nada)."""
    return [
        t for t in DataService.get_transactions_by_user(cartao["user_id"])
        if t.get("card_id") == cartao["id"]
    ]


def _estado(fechamento: str, hoje: str, centavos_pagos: int, centavos_restantes: int) -> str:
    # Com pagamento, o estado é do pagamento; sem, é da data. O dia do
    # fechamento ainda aceita compra: a fatura só fecha no dia seguinte.
    if centavos_pagos > 0:
        return "paid" if centavos_restantes <= 0 else "partially_paid"
    return "closed" if hoje > fechamento else "open"


def _pagamentos(cartao: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    """Pagamentos do cartão por ciclo: saídas da conta marcadas com `invoice_payment`."""
    grupos: Dict[str, List[Dict[str, Any]]] = {}
    for t in DataService.get_transactions_by_user(cartao["user_id"]):
        marca = t.get("invoice_payment")
        if marca and marca.get("card_id") == cartao["id"]:
            grupos.setdefault(marca["cycle"], []).append(t)
    return grupos


def _resumo(
    cartao: Dict[str, Any], ciclo: str, compras: List[Dict[str, Any]], pagamentos: List[Dict[str, Any]], hoje: str
) -> Dict[str, Any]:
    from app.services import fatura_extrato  # tardio: ele importa este módulo

    # Datas calculadas, corrigidas pelo extrato ou à mão quando há correção (#28).
    fechamento, vencimento = fatura_extrato.datas(
        cartao,
        ciclo,
        data_de_fechamento(ciclo, cartao["closing_day"]),
        data_de_vencimento(ciclo, cartao["closing_day"], cartao["due_day"]),
    )
    # Soma em centavos inteiros: float acumulado erra o último centavo.
    # Compras menos estornos (#31): a despesa líquida do ciclo.
    centavos = despesa_liquida.total_em_centavos(compras)
    # Total do extrato aceito pelo usuário vale no lugar da soma; extras = diferença etc. (#28).
    centavos, extras_extrato = fatura_extrato.ajustar(cartao, ciclo, centavos)
    pagos = sum(round(t["amount"] * 100) for t in pagamentos)
    restante = max(centavos - pagos, 0)
    return {
        "card_id": cartao["id"],
        "cycle": ciclo,
        "closing_date": fechamento,
        "due_date": vencimento,
        "total": centavos / 100,
        "paid": pagos / 100,
        "remaining": restante / 100,
        "state": _estado(fechamento, hoje, pagos, centavos - pagos),
        "purchases_count": sum(1 for t in compras if t["type"] == "expense"),
        **extras_extrato,
    }


def _por_ciclo(cartao: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    grupos: Dict[str, List[Dict[str, Any]]] = {}
    for t in _compras(cartao):
        grupos.setdefault(ciclo_da_compra(t["due_date"], cartao["closing_day"]), []).append(t)
    return grupos


def listar(cartao: Dict[str, Any], hoje: str) -> List[Dict[str, Any]]:
    """Faturas do cartão, a mais recente primeiro. `hoje` é AAAA-MM-DD do cliente."""
    date.fromisoformat(hoje)  # ValueError se malformado
    grupos = _por_ciclo(cartao)
    pagos = _pagamentos(cartao)
    return [_resumo(cartao, c, grupos[c], pagos.get(c, []), hoje) for c in sorted(grupos, reverse=True)]


def detalhe(cartao: Dict[str, Any], ciclo: str, hoje: str) -> Optional[Dict[str, Any]]:
    """A fatura com as compras (mais recente primeiro), ou None se o ciclo não tem compras."""
    date.fromisoformat(hoje)
    _ciclo(ciclo)
    compras = _por_ciclo(cartao).get(ciclo)
    if not compras:
        return None
    ordenadas = sorted(compras, key=lambda t: (t["due_date"], t["id"]), reverse=True)
    pagamentos = _pagamentos(cartao).get(ciclo, [])
    parcelas = parcelas_cartao.rotulos(compras)  # "2/12" e prevista (issue #30)
    return {
        **_resumo(cartao, ciclo, compras, pagamentos, hoje),
        "payments": [
            {"id": t["id"], "description": t.get("description"), "amount": t["amount"], "date": (t.get("settled_at") or t["due_date"])[:10]}
            for t in sorted(pagamentos, key=lambda t: (t.get("settled_at") or "", t["id"]))
        ],
        "purchases": [
            {
                "id": t["id"],
                "description": t.get("description"),
                # Estorno é linha negativa (reduz o total); a compra segue positiva.
                "amount": despesa_liquida.valor(t) if t["type"] == "refund" else t["amount"],
                "type": t["type"],
                "date": t["due_date"][:10],
                "category_id": t.get("category_id"),
                **parcelas.get(t["id"], {}),
            }
            for t in ordenadas
        ],
    }
