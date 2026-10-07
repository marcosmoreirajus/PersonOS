"""
Fatura corrigida pelo extrato (issue #28, Fatia 5).

A fatura continua derivada das compras (faturas.py). Este módulo guarda só o
que o cálculo não sabe: o que o banco disse (no arquivo importado) ou o que o
usuário informou à mão. Coleção `invoices`, uma linha por (card_id, cycle),
criada quando há a primeira correção e apagada quando a última some:

    {id, user_id, card_id, cycle,
     closing_date, due_date, declared_total,      # null = sem correção
     sources: {closing_date, due_date, declared_total},   # "file" | "manual"
     total_decision,                              # null | "extract" | "purchases"
     created_at, updated_at}

O ciclo de uma compra NÃO muda com a data corrigida: quem decide em que fatura
a compra cai é `faturas.ciclo_da_compra` (dia de fechamento do cartão). A data
corrigida só vale para exibir o fechamento/vencimento e para o estado
aberta/fechada. Se o banco fechou mais tarde e uma compra caiu na fatura
errada, o total do extrato denuncia (item em "A revisar").

Total do extrato diferente da soma das compras nunca corrige em silêncio: vira
item em "A revisar" até o usuário decidir (`total_decision`).
"""

import re
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.services import despesa_liquida, faturas
from app.services.data_service import DataService, em_transacao

COLECAO = "invoices"
# O banco desloca o fechamento por feriado e fim de semana, não por semanas.
TOLERANCIA_DIAS = 10
# DTASOF só vale como vencimento se vier logo depois do fechamento.
PRAZO_VENCIMENTO_DIAS = 40
CAMPOS = ("closing_date", "due_date", "declared_total")


def _agora() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _registro(linhas: List[Dict[str, Any]], card_id: int, ciclo: str) -> Optional[Dict[str, Any]]:
    return next((r for r in linhas if r["card_id"] == card_id and r["cycle"] == ciclo), None)


def _exigir_fatura(cartao: Dict[str, Any], ciclo: str) -> None:
    """Ciclo malformado é ValueError; ciclo sem compras é LookupError (a fatura nasce com a compra)."""
    faturas._ciclo(ciclo)
    if not faturas._por_ciclo(cartao).get(ciclo):
        raise LookupError("Esse cartão não tem fatura nesse ciclo.")


def correcao(cartao: Dict[str, Any], ciclo: str) -> Optional[Dict[str, Any]]:
    return _registro(DataService.load_json(COLECAO), cartao["id"], ciclo)


# --------------------------------------------------------------------------- #
# Pontos de extensão chamados por faturas._resumo
# --------------------------------------------------------------------------- #


def datas(cartao: Dict[str, Any], ciclo: str, fechamento: str, vencimento: str) -> Tuple[str, str]:
    """Fechamento e vencimento: o corrigido quando existe, senão o calculado."""
    r = correcao(cartao, ciclo)
    if not r:
        return fechamento, vencimento
    return r.get("closing_date") or fechamento, r.get("due_date") or vencimento


# --------------------------------------------------------------------------- #
# Edição à mão
# --------------------------------------------------------------------------- #


def _data(texto: str, campo: str) -> date:
    try:
        return date.fromisoformat(texto)
    except ValueError:
        raise ValueError("Data inválida em %s: use AAAA-MM-DD." % ("fechamento" if campo == "closing_date" else "vencimento")) from None


def validar(cartao: Dict[str, Any], ciclo: str, fechamento: Optional[str], vencimento: Optional[str]) -> None:
    """Datas corrigidas precisam ser plausíveis perto das calculadas, e o vencimento vem depois do fechamento."""
    calc_f = date.fromisoformat(faturas.data_de_fechamento(ciclo, cartao["closing_day"]))
    calc_v = date.fromisoformat(faturas.data_de_vencimento(ciclo, cartao["closing_day"], cartao["due_day"]))
    f = _data(fechamento, "closing_date") if fechamento else None
    v = _data(vencimento, "due_date") if vencimento else None
    if f and abs((f - calc_f).days) > TOLERANCIA_DIAS:
        raise ValueError("O fechamento está longe demais do ciclo %s." % ciclo)
    if v and abs((v - calc_v).days) > TOLERANCIA_DIAS:
        raise ValueError("O vencimento está longe demais do ciclo %s." % ciclo)
    if (f or calc_f) >= (v or calc_v):
        raise ValueError("O vencimento precisa ser depois do fechamento.")


@em_transacao
def editar(cartao: Dict[str, Any], ciclo: str, campos: Dict[str, Any]) -> None:
    """
    `campos` traz só o que o usuário mexeu; valor None apaga a correção do campo.
    Cartão já foi conferido por quem chama.
    """
    _exigir_fatura(cartao, ciclo)
    _gravar(cartao, ciclo, campos, "manual")


def _gravar(cartao: Dict[str, Any], ciclo: str, campos: Dict[str, Any], origem: str) -> None:
    """
    Grava a correção. A origem "file" (leitura do extrato) nunca sobrescreve o
    que o usuário informou à mão e, se o arquivo trouxer datas incoerentes,
    ignora o arquivo em vez de recusar a importação.
    """
    linhas = DataService.load_json(COLECAO)
    if origem == "file":
        atual = _registro(linhas, cartao["id"], ciclo)
        donos = atual["sources"] if atual else {}
        campos = {k: v for k, v in campos.items() if donos.get(k) != "manual"}
        if not campos:
            return
    r = _registro(linhas, cartao["id"], ciclo)
    novo = r is None
    if novo:
        r = {
            "id": max((x["id"] for x in linhas), default=0) + 1,
            "user_id": cartao["user_id"],
            "card_id": cartao["id"],
            "cycle": ciclo,
            "closing_date": None,
            "due_date": None,
            "declared_total": None,
            "sources": {},
            "total_decision": None,
            "created_at": _agora(),
        }
    f = campos["closing_date"] if "closing_date" in campos else r["closing_date"]
    v = campos["due_date"] if "due_date" in campos else r["due_date"]
    try:
        validar(cartao, ciclo, f, v)
    except ValueError:
        if origem == "file":
            return
        raise
    for campo in CAMPOS:
        if campo not in campos:
            continue
        if campo == "declared_total" and campos[campo] is not None and campos[campo] < 0:
            raise ValueError("O total da fatura não pode ser negativo.")
        if campos[campo] != r[campo] and campo == "declared_total":
            r["total_decision"] = None  # número novo, pergunta nova
        r[campo] = campos[campo]
        r["sources"][campo] = origem if campos[campo] is not None else None
    r["sources"] = {k: s for k, s in r["sources"].items() if s}
    r["updated_at"] = _agora()
    if novo:
        linhas.append(r)
    if all(r[c] is None for c in CAMPOS):
        linhas = [x for x in linhas if x is not r and x["id"] != r["id"]]
    else:
        linhas = [r if x["id"] == r["id"] else x for x in linhas]
    DataService.save_json(COLECAO, linhas)


# --------------------------------------------------------------------------- #
# Total declarado x soma das compras
# --------------------------------------------------------------------------- #


def _cent(valor: float) -> int:
    return int(round(valor * 100))


def ajustar(cartao: Dict[str, Any], ciclo: str, soma_centavos: int) -> Tuple[int, Dict[str, Any]]:
    """
    Ponto de extensão de faturas._resumo: recebe a soma das compras (em
    centavos) e devolve o total efetivo e os campos extras da fatura.
    O total só deixa de ser a soma se o usuário aceitou o do extrato.
    """
    r = correcao(cartao, ciclo)
    declarado = r.get("declared_total") if r else None
    decisao = r.get("total_decision") if r else None
    extras = {
        "declared_total": declarado,
        "difference": None if declarado is None else (_cent(declarado) - soma_centavos) / 100,
        "total_decision": decisao,
        "purchases_total": soma_centavos / 100,
        "corrected": sorted(r["sources"]) if r else [],
    }
    efetivo = _cent(declarado) if declarado is not None and decisao == "extract" else soma_centavos
    return efetivo, extras


def pendencias(user_id: int) -> List[Dict[str, Any]]:
    """
    Itens de "A revisar": faturas cujo total do extrato difere da soma das
    compras e que o usuário ainda não decidiu. Mais recente primeiro.
    """
    from app.services import cartoes

    itens: List[Dict[str, Any]] = []
    linhas = DataService.load_json(COLECAO)
    for cartao in cartoes.listar(user_id):
        grupos = faturas._por_ciclo(cartao)
        for r in linhas:
            if r["card_id"] != cartao["id"] or r.get("declared_total") is None or r.get("total_decision"):
                continue
            # Compras menos estornos (#31): a mesma conta do total da fatura.
            soma = despesa_liquida.total_em_centavos(grupos.get(r["cycle"], []))
            if soma == _cent(r["declared_total"]):
                continue
            _, vencimento = datas(
                cartao,
                r["cycle"],
                faturas.data_de_fechamento(r["cycle"], cartao["closing_day"]),
                faturas.data_de_vencimento(r["cycle"], cartao["closing_day"], cartao["due_day"]),
            )
            itens.append(
                {
                    "card_id": cartao["id"],
                    "card_name": cartao["name"],
                    "cycle": r["cycle"],
                    "due_date": vencimento,
                    "declared_total": r["declared_total"],
                    "purchases_total": soma / 100,
                    "difference": (_cent(r["declared_total"]) - soma) / 100,
                    "source": r["sources"].get("declared_total"),
                }
            )
    itens.sort(key=lambda i: (i["cycle"], i["card_name"].lower()), reverse=True)
    return itens


@em_transacao
def decidir_total(cartao: Dict[str, Any], ciclo: str, decisao: str) -> None:
    """
    Resolve a diferença: `extract` adota o total do extrato como total da
    fatura; `purchases` mantém a soma das compras. Em ambos o item sai de
    "A revisar". Sem total declarado não há o que decidir.
    """
    _exigir_fatura(cartao, ciclo)
    linhas = DataService.load_json(COLECAO)
    r = _registro(linhas, cartao["id"], ciclo)
    if r is None or r.get("declared_total") is None:
        raise ValueError("Esta fatura não tem total declarado para decidir.")
    r["total_decision"] = decisao
    r["updated_at"] = _agora()
    DataService.save_json(COLECAO, linhas)


# --------------------------------------------------------------------------- #
# Leitura do cabeçalho do OFX do cartão
# --------------------------------------------------------------------------- #


def _tag(bloco: str, nome: str) -> Optional[str]:
    m = re.search(r"<%s>\s*([^<\r\n]*)" % nome, bloco, re.I)
    return m.group(1).strip() if m else None


def _data_ofx(texto: Optional[str]) -> Optional[date]:
    """'20260827' ou '20260827120000[-3:BRT]' -> date; qualquer outra coisa -> None."""
    if not texto or not re.match(r"\d{8}", texto):
        return None
    try:
        return date(int(texto[0:4]), int(texto[4:6]), int(texto[6:8]))
    except ValueError:
        return None


def ler_cabecalho_ofx(texto: str) -> Dict[str, Any]:
    """
    O que o OFX de cartão diz sobre a fatura, quando diz: `fim` (DTEND do
    extrato), `total` (valor absoluto de LEDGERBAL/BALAMT: saldo devedor vem
    negativo) e `saldo_em` (LEDGERBAL/DTASOF). Ausente = None, nunca zero.
    """
    razao = re.search(r"<LEDGERBAL>(.*?)(?=</LEDGERBAL>|</CCSTMTRS>|</STMTRS>|$)", texto, re.S | re.I)
    saldo = None
    if razao:
        bruto = _tag(razao.group(1), "BALAMT")
        if bruto:
            from app.services.import_service import _parse_valor

            try:
                saldo = abs(_parse_valor(bruto))
            except ValueError:
                saldo = None
    return {
        "fim": _data_ofx(_tag(texto, "DTEND")),
        "total": saldo,
        "saldo_em": _data_ofx(_tag(razao.group(1), "DTASOF")) if razao else None,
    }


def _ciclo_do_fechamento(cartao: Dict[str, Any], fim: date) -> Optional[str]:
    """O ciclo cujo fechamento calculado fica mais perto de `fim`, dentro da tolerância."""
    candidatos = [faturas._rotulo(fim.year, fim.month)]
    candidatos.append(faturas._rotulo(*faturas._proximo(fim.year, fim.month)))
    anterior = (fim.year - 1, 12) if fim.month == 1 else (fim.year, fim.month - 1)
    candidatos.append(faturas._rotulo(*anterior))
    melhor = min(
        candidatos,
        key=lambda c: abs((date.fromisoformat(faturas.data_de_fechamento(c, cartao["closing_day"])) - fim).days),
    )
    dist = abs((date.fromisoformat(faturas.data_de_fechamento(melhor, cartao["closing_day"])) - fim).days)
    return melhor if dist <= TOLERANCIA_DIAS else None


@em_transacao
def registrar_do_arquivo(cartao: Dict[str, Any], texto: str) -> None:
    """
    Chamado pela importação do extrato de um cartão (OFX). Corrige a fatura do
    ciclo do arquivo com o que ele traz: fechamento (DTEND), total (BALAMT) e,
    se a data do saldo vier depois do fechamento, vencimento (DTASOF). O que o
    arquivo não traz, ou traz incoerente, não toca em nada.
    """
    c = ler_cabecalho_ofx(texto)
    if c["fim"] is None:
        return  # sem fechamento no arquivo não sei de qual fatura é o total
    ciclo = _ciclo_do_fechamento(cartao, c["fim"])
    if ciclo is None:
        return
    try:
        _exigir_fatura(cartao, ciclo)
    except LookupError:
        return
    campos: Dict[str, Any] = {"closing_date": c["fim"].isoformat()}
    if c["total"] is not None:
        campos["declared_total"] = c["total"]
    saldo_em = c["saldo_em"]
    if saldo_em and 0 < (saldo_em - c["fim"]).days <= PRAZO_VENCIMENTO_DIAS:
        campos["due_date"] = saldo_em.isoformat()
    _gravar(cartao, ciclo, campos, "file")
