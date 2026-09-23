# -*- coding: utf-8 -*-
"""
Geração de ocorrências de série.

Regras decididas na sabatina de 21-22/09 (ver docs/finance/spec.md):

- O que decide materializar tudo é **ter fim conhecido** (`total_count` ou
  `end_date`), não o tipo da série. Uma recorrência com contrato até 2028 é
  um compromisso tão fechado quanto um parcelamento.
- Série indefinida usa **janela rolante de 12 meses**.
- Ausência maior que a janela **preenche o passado**: as ocorrências perdidas
  nascem sem efetivação, isto é, atrasadas — que é o que elas são. Ignorá-las
  faria o histórico mentir pra menos e quebraria a conciliação do período.
- Geração é **idempotente**: a chave é (série, data de vencimento). Rodar de
  novo não duplica nada.
- Série encerrada (`ended_at`) não gera mais nada — é isso que impede a
  assinatura cancelada de voltar na próxima extensão.
"""

from calendar import monthrange
from datetime import date, timedelta
from typing import Any, Dict, Iterator, List

# Janela para séries sem fim conhecido.
HORIZONTE_MESES = 12


def _parse(d: str) -> date:
    return date(int(d[:4]), int(d[5:7]), int(d[8:10]))


def _iso(d: date) -> str:
    return d.isoformat()


def _soma_meses(base: date, meses: int, anchor_day: int) -> date:
    """
    Avança `meses` mantendo o dia âncora.

    Mês curto trunca para o último dia: uma assinatura no dia 31 vence em 28
    de fevereiro, não em 3 de março. Empurrar para o mês seguinte moveria a
    obrigação para outra competência.
    """
    total = base.month - 1 + meses
    ano = base.year + total // 12
    mes = total % 12 + 1
    dia = min(anchor_day, monthrange(ano, mes)[1])
    return date(ano, mes, dia)


def ocorrencias(serie: Dict[str, Any], ate: date) -> Iterator[tuple[int, date]]:
    """
    Datas de vencimento da série, do início até `ate` (ou até o fim dela).

    `ate` é **exclusivo** para série indefinida — ver o comentário no corte.

    Devolve (índice a partir de 1, data). O índice é o "3 de 12" do
    parcelamento; na recorrência ele existe só para ordenar.
    """
    inicio = _parse(serie["start_date"])
    anchor = serie.get("anchor_day") or inicio.day
    frequencia = serie.get("frequency", "monthly")
    fim_data = _parse(serie["end_date"]) if serie.get("end_date") else None
    encerrada = _parse(serie["ended_at"]) if serie.get("ended_at") else None
    total = serie.get("total_count")

    i = 0
    while True:
        i += 1
        if total is not None and i > total:
            return

        if frequencia == "monthly":
            due = _soma_meses(inicio, i - 1, anchor)
        elif frequencia == "biweekly":
            due = inicio + timedelta(days=14 * (i - 1))
        elif frequencia == "weekly":
            due = inicio + timedelta(days=7 * (i - 1))
        else:
            raise ValueError("frequência desconhecida: %s" % frequencia)

        if fim_data and due > fim_data:
            return
        # Encerrar a série corta a partir da data gravada; o que já existe
        # antes dela continua valendo.
        if encerrada and due > encerrada:
            return
        # Limite EXCLUSIVO: com `ate = hoje + 12 meses`, inclui-lo geraria o
        # mês atual mais doze, ou seja treze ocorrências. "Janela de 12
        # meses" é o mês corrente e mais onze.
        if total is None and due >= ate:
            return

        yield i, due


def limite_de_geracao(serie: Dict[str, Any], hoje: date) -> date:
    """
    Até quando materializar.

    Fim conhecido gera tudo; indefinida para no horizonte. O horizonte conta
    a partir de hoje, não da última geração — é isso que faz a janela rolar e
    que preenche o buraco de quem ficou meses sem abrir o app.
    """
    if serie.get("total_count") is not None:
        return date.max
    if serie.get("end_date"):
        return _parse(serie["end_date"])
    return _soma_meses(hoje, HORIZONTE_MESES, hoje.day)


def gerar(
    serie: Dict[str, Any],
    existentes: List[Dict[str, Any]],
    hoje: date,
    agora_iso: str,
    proximo_id: int,
) -> List[Dict[str, Any]]:
    """
    Ocorrências que faltam materializar para esta série.

    Não devolve nada para série encerrada além do corte, nem para data que já
    tem registro — a idempotência é por (série, vencimento), e não por
    contagem, porque o usuário pode ter excluído uma ocorrência do meio de
    propósito.
    """
    ja_existem = {t["due_date"] for t in existentes if t.get("series_id") == serie["id"]}
    novas: List[Dict[str, Any]] = []
    ate = limite_de_geracao(serie, hoje)

    for indice, due in ocorrencias(serie, ate):
        iso = _iso(due)
        if iso in ja_existem:
            continue
        novas.append(
            {
                "id": proximo_id + len(novas),
                "user_id": serie["user_id"],
                "type": serie["type"],
                "amount": serie["amount"],
                "description": serie["description"],
                "category_id": serie.get("category_id"),
                "due_date": iso,
                # Nasce sem efetivação. Se o vencimento já passou, a leitura
                # de "atrasado" acontece sozinha — nenhum campo precisa dizer.
                "settled_at": None,
                "account_id": serie.get("account_id"),
                "is_internal_transfer": False,
                "needs_transfer_review": False,
                "series_id": serie["id"],
                "series_index": indice if serie.get("total_count") is not None else None,
                "ingest_state": "confirmed",
                "source": "manual",
                "external_id": None,
                "import_hash": None,
                "history": [{"at": agora_iso, "event": "created", "source": "series"}],
                "created_at": agora_iso,
            }
        )

    return novas


def projetar(serie: Dict[str, Any], de: date, ate: date) -> List[Dict[str, Any]]:
    """
    Ocorrências **calculadas** de uma série, para exibir além do horizonte.

    Leitura projeta, escrita materializa: isto não grava nada. Serve para o
    calendário mostrar o 13º mês sem que navegar crie dado que ninguém pediu.
    """
    fora = []
    for indice, due in ocorrencias(serie, ate):
        if due < de or due > ate:
            continue
        fora.append(
            {
                "series_id": serie["id"],
                "series_index": indice if serie.get("total_count") is not None else None,
                "type": serie["type"],
                "amount": serie["amount"],
                "description": serie["description"],
                "category_id": serie.get("category_id"),
                "due_date": _iso(due),
                "settled_at": None,
                "projected": True,
            }
        )
    return fora
