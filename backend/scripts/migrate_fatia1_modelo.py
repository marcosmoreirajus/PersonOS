# -*- coding: utf-8 -*-
"""
Migração da Fatia 1 — modelo da entrada de dados (ver docs/finance/spec.md).

O que faz:
  1. Reescreve transactions.json no formato novo (due_date + settled_at,
     ingest_state, vínculo de série, histórico de eventos).
  2. Cria series.json a partir das obrigações de scheduled.json, agrupando
     parcelas da mesma dívida numa série só.
  3. Move scheduled.json para o backup — Agendadas passa a ler transações.

Decisões aplicadas (sabatina de 21-22/09):
  - `previsto/atrasado/realizado` NÃO é campo: deriva de settled_at + due_date.
  - Total da dívida nunca é gravado: é a soma das parcelas.
  - Só o que tem settled_at preenchido conta em saldo/relatórios.

Nesta fatia a migração é 1:1 — cada obrigação vira exatamente uma transação.
A GERAÇÃO de ocorrências que faltam (parcelas 1, 2 e 5 do IPVA, meses futuros
das recorrências) é da Fatia 2, e fazê-la aqui mudaria números de outros meses
antes de existir a regra de janela/horizonte.

Idempotente: se transactions.json já estiver no formato novo, não faz nada.
"""

import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
BACKUP = DATA / "_backup-2026-09-22"

# Opção (b), confirmada pelo Marco em 22/09: o mock tinha dois aluguéis de
# setembro (1500 em transactions + 1800 em scheduled, este com vencimento e
# status). Fica o de scheduled; são dados fictícios de teste.
DROP_TRANSACTION_IDS = {3}

FREQUENCY = {"mensal": "monthly", "quinzenal": "biweekly", "semanal": "weekly"}
PARCELA_RE = re.compile(r"\s*parcela\s+\d+\s*/\s*\d+\s*$", re.IGNORECASE)


def load(name):
    return json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))


def save(name, data):
    (DATA / f"{name}.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def day_of(iso_date):
    return int(iso_date[8:10])


def date_part(value):
    """'2026-09-10T14:30:00Z' -> '2026-09-10'; já-data volta igual."""
    return value[:10]


def months_back(iso_date, n):
    y, m, d = int(iso_date[:4]), int(iso_date[5:7]), int(iso_date[8:10])
    m -= n
    while m <= 0:
        m += 12
        y -= 1
    return f"{y:04d}-{m:02d}-{d:02d}"


def midnight(iso_date):
    return f"{iso_date}T00:00:00Z"


def main():
    transactions = load("transactions")
    if transactions and "settled_at" in transactions[0]:
        print("transactions.json já está no formato novo — nada a fazer.")
        return 0

    if not (BACKUP / "scheduled.json").exists():
        print("ERRO: backup não encontrado em", BACKUP, file=sys.stderr)
        return 1

    scheduled = load("scheduled")
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    antes = resumo(transactions, scheduled)

    # ---------------------------------------------------------------- séries
    series = []
    series_by_key = {}
    next_series_id = 1

    for item in scheduled:
        nature = item["nature"]
        if nature == "a_vista":
            continue

        if nature == "parcelado":
            inst = item["installment"]
            base = PARCELA_RE.sub("", item["name"]).strip()
            key = ("installment", item["user_id"], base, inst["total"])
        else:
            key = ("recurring", item["user_id"], item["name"], item["frequency"])

        if key in series_by_key:
            continue

        due = item["due_date"]
        if nature == "parcelado":
            inst = item["installment"]
            s = {
                "id": next_series_id,
                "user_id": item["user_id"],
                "kind": "installment",
                "description": PARCELA_RE.sub("", item["name"]).strip(),
                "type": item["type"],
                "category_id": item["category_id"],
                "account_id": None,
                "amount": item["value"],
                "frequency": "monthly",
                "anchor_day": day_of(due),
                "start_date": months_back(due, inst["current"] - 1),
                "total_count": inst["total"],
                "end_date": None,
                "ended_at": None,
            }
        else:
            s = {
                "id": next_series_id,
                "user_id": item["user_id"],
                "kind": "recurring",
                "description": item["name"],
                "type": item["type"],
                "category_id": item["category_id"],
                "account_id": None,
                "amount": item["value"],
                "frequency": FREQUENCY[item["frequency"]],
                "anchor_day": day_of(due),
                "start_date": due,
                "total_count": None,
                "end_date": None,
                "ended_at": None,
            }
        series.append(s)
        series_by_key[key] = s
        next_series_id += 1

    # Recorrência migrada: start_date é a ocorrência mais antiga que existe.
    for item in scheduled:
        if item["nature"] != "recurring" and item["nature"] != "recorrente":
            continue
        key = ("recurring", item["user_id"], item["name"], item["frequency"])
        s = series_by_key.get(key)
        if s and item["due_date"] < s["start_date"]:
            s["start_date"] = item["due_date"]

    # ----------------------------------------------------------- transações
    novas = []

    for t in transactions:
        if t["id"] in DROP_TRANSACTION_IDS:
            continue
        when = date_part(t["transaction_date"])
        novas.append(
            {
                "id": t["id"],
                "user_id": t["user_id"],
                "type": t["type"],
                "amount": t["amount"],
                "description": t.get("description"),
                "category_id": t["category_id"],
                "due_date": when,
                # Toda transação que já existia é fato consumado: nasceu do
                # lançamento de algo que aconteceu.
                "settled_at": when,
                "account_id": None,
                "is_internal_transfer": False,
                "needs_transfer_review": False,
                "series_id": None,
                "series_index": None,
                "ingest_state": "confirmed",
                "source": "manual",
                "external_id": None,
                "import_hash": None,
                "history": [
                    {"at": t["created_at"], "event": "created", "source": "manual"},
                    {"at": midnight(when), "event": "settled", "on": when},
                ],
                "created_at": t["created_at"],
            }
        )

    next_tx_id = max((t["id"] for t in novas), default=0) + 1

    for item in scheduled:
        due = item["due_date"]
        pago = item["status"] == "paid"
        nature = item["nature"]

        series_id = None
        series_index = None
        if nature == "parcelado":
            inst = item["installment"]
            base = PARCELA_RE.sub("", item["name"]).strip()
            s = series_by_key[("installment", item["user_id"], base, inst["total"])]
            series_id, series_index = s["id"], inst["current"]
            descricao = base
        elif nature == "recorrente":
            s = series_by_key[("recurring", item["user_id"], item["name"], item["frequency"])]
            series_id = s["id"]
            descricao = item["name"]
        else:
            descricao = item["name"]

        history = [{"at": midnight(due), "event": "created", "source": "manual"}]
        if pago:
            history.append({"at": midnight(due), "event": "settled", "on": due})

        registro = {
            "id": next_tx_id,
            "user_id": item["user_id"],
            "type": item["type"],
            "amount": item["value"],
            "description": descricao,
            "category_id": item["category_id"],
            "due_date": due,
            "settled_at": due if pago else None,
            "account_id": None,
            "is_internal_transfer": False,
            "needs_transfer_review": False,
            "series_id": series_id,
            "series_index": series_index,
            "ingest_state": "confirmed",
            "source": "manual",
            "external_id": None,
            "import_hash": None,
            "history": history,
            "created_at": now,
        }
        # Marcador visual de fatura de cartão: o módulo Cartões segue adiado,
        # mas a legenda do calendário depende disso desde 18/09.
        if item.get("card_invoice"):
            registro["card_invoice"] = True

        novas.append(registro)
        next_tx_id += 1

    save("transactions", novas)
    save("series", series)

    # scheduled.json sai de cena — movido, nunca apagado.
    shutil.move(str(DATA / "scheduled.json"), str(BACKUP / "scheduled.migrado.json"))

    relatorio(antes, novas, series)
    return 0


def resumo(transactions, scheduled):
    return {
        "tx": len(transactions),
        "sched": len(scheduled),
        "sched_pago": sum(1 for s in scheduled if s["status"] == "paid"),
    }


def relatorio(antes, novas, series):
    print("MIGRACAO FATIA 1 -- concluida")
    print("  transacoes antes ........ %d" % antes["tx"])
    print("  agendadas antes ......... %d (%d ja efetivadas)" % (antes["sched"], antes["sched_pago"]))
    print("  transacoes depois ....... %d" % len(novas))
    print("  series criadas .......... %d" % len(series))
    for s in series:
        fim = "%d parcelas" % s["total_count"] if s["total_count"] else "indefinida"
        print("    #%d %-24s %-12s %s" % (s["id"], s["description"], s["kind"], fim))
    efetivadas = [t for t in novas if t["settled_at"]]
    print("  efetivadas (contam em saldo) ... %d de %d" % (len(efetivadas), len(novas)))


if __name__ == "__main__":
    raise SystemExit(main())
