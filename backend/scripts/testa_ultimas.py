# -*- coding: utf-8 -*-
"""
Critérios de aceite de Últimas transações (issues #5 e #16). Roda sobre o
MemoriaStore: nenhum arquivo é tocado.

    os 8 últimos efetivados, do mais recente ao mais antigo, com dia, conta e
    marcas de transferência interna e de importado; previsto e ingestão
    pendente ficam fora; a transferência continua na lista; vazio é lista vazia.
"""

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app.services import ultimas  # noqa: E402
from app.services.store import MemoriaStore, usar_store  # noqa: E402

falhas = []
UID = 1


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def lanc(id, quando, tipo="expense", valor=10.0, conta=1, categoria=1, **extra):
    t = {
        "id": id,
        "user_id": UID,
        "category_id": categoria,
        "account_id": conta,
        "type": tipo,
        "amount": valor,
        "description": f"item {id}",
        "due_date": quando[:10],
        "settled_at": quando,
        "is_internal_transfer": False,
        "ingest_state": "confirmed",
    }
    t.update(extra)
    return t


def cenario(lancamentos, contas=None):
    store = MemoriaStore()
    store.save("transactions", lancamentos)
    store.save(
        "accounts",
        contas if contas is not None else [{"id": 1, "user_id": UID, "name": "Nubank"}, {"id": 2, "user_id": UID, "name": "Caixa"}],
    )
    usar_store(store)
    return ultimas.recentes(UID)


def ids(lista):
    return [i["id"] for i in lista]


def main():
    anterior = usar_store(MemoriaStore())
    try:
        print("8 itens, do mais recente ao mais antigo")
        r = cenario([lanc(i, f"2026-10-{i:02d}T12:00:00Z") for i in range(1, 11)])
        checa("só 8, do dia 10 ao 3", ids(r) == [10, 9, 8, 7, 6, 5, 4, 3], str(ids(r)))

        print("mesmo dia: hora decide, id desempata")
        r = cenario(
            [
                lanc(1, "2026-10-05T08:00:00Z"),
                lanc(2, "2026-10-05T20:00:00Z"),
                lanc(3, "2026-10-05T20:00:00Z"),
            ]
        )
        checa("hora desc, depois id desc", ids(r) == [3, 2, 1], str(ids(r)))

        print("campos do item")
        r = cenario([lanc(1, "2026-10-05T12:00:00Z", tipo="income", valor=99.5, conta=2, categoria=None)])
        checa(
            "item completo",
            r[0]
            == {
                "id": 1,
                "description": "item 1",
                "amount": 99.5,
                "type": "income",
                "day": "2026-10-05",
                "category_id": None,
                "account_name": "Caixa",
                "is_internal_transfer": False,
                "imported": False,
            },
            str(r[0]),
        )

        print("marcas")
        r = cenario(
            [
                lanc(1, "2026-10-05T10:00:00Z", is_internal_transfer=True),
                lanc(2, "2026-10-05T11:00:00Z", import_hash="abc"),
                lanc(3, "2026-10-05T12:00:00Z", external_id="x:1"),
                lanc(4, "2026-10-05T13:00:00Z"),
            ]
        )
        por_id = {i["id"]: i for i in r}
        checa("transferência continua na lista e é marcada", 1 in por_id and por_id[1]["is_internal_transfer"] is True)
        checa("importado por hash ou por id externo", por_id[2]["imported"] and por_id[3]["imported"])
        checa("comum não tem marca", not por_id[4]["imported"] and not por_id[4]["is_internal_transfer"])

        print("conta")
        r = cenario([lanc(1, "2026-10-05T10:00:00Z", conta=None), lanc(2, "2026-10-05T11:00:00Z", conta=77)])
        checa("sem conta ou conta inexistente: nome nulo", [i["account_name"] for i in r] == [None, None])

        print("o que fica de fora")
        r = cenario(
            [
                lanc(1, "2026-10-05T10:00:00Z", settled_at=None),
                lanc(2, "2026-10-05T10:00:00Z", ingest_state="awaiting_reconciliation"),
                lanc(3, "2026-10-05T10:00:00Z", user_id=2),
                lanc(4, "2026-10-05T10:00:00Z"),
            ]
        )
        checa("previsto, ingestão pendente e outro usuário ficam fora", ids(r) == [4], str(ids(r)))

        print("vazio")
        checa("sem lançamentos: lista vazia, não erro", cenario([]) == [])
    finally:
        usar_store(anterior)

    if falhas:
        print("FALHARAM: %d" % len(falhas))
        for f_ in falhas:
            print("  -", f_)
        return 1
    print("todos os critérios passaram")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
