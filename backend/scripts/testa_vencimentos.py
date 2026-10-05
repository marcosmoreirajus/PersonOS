# -*- coding: utf-8 -*-
"""
Critérios de aceite de Próximos vencimentos (issues #5 e #13). Roda sobre o
MemoriaStore: nenhum arquivo é tocado. Valores esperados são datas e números
literais, escritos à mão.

    as 5 obrigações a pagar e as 5 a receber mais próximas, atrasadas
    primeiro, sem janela; efetivado, transferência interna e ingestão
    pendente ficam fora; vazio devolve listas vazias, não erro.
"""

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app.services import vencimentos  # noqa: E402
from app.services.store import MemoriaStore, usar_store  # noqa: E402

falhas = []
UID = 1
HOJE = "2026-10-07"


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def prev(id, tipo, valor, vence, efetivado=False, transferencia=False, ingestao="confirmed", user=UID):
    return {
        "id": id,
        "user_id": user,
        "category_id": 1,
        "type": tipo,
        "amount": valor,
        "description": f"item {id}",
        "due_date": vence,
        "settled_at": "2026-10-01T12:00:00Z" if efetivado else None,
        "is_internal_transfer": transferencia,
        "ingest_state": ingestao,
    }


def cenario(lancamentos):
    store = MemoriaStore()
    store.save("transactions", lancamentos)
    usar_store(store)
    return vencimentos.proximos(UID, HOJE)


def ids(lista):
    return [i["id"] for i in lista]


def main():
    anterior = usar_store(MemoriaStore())
    try:
        print("5 e 5, ordem e atrasados primeiro")
        pagar = [
            prev(i, "expense", 10.0, d)
            for i, d in [
                (1, "2026-12-01"), (2, "2026-10-20"), (3, "2026-10-01"), (4, "2026-10-07"),
                (5, "2026-09-15"), (6, "2026-11-05"), (7, "2026-10-08"),
            ]
        ]
        receber = [
            prev(i, "income", 20.0, d)
            for i, d in [
                (11, "2026-10-09"), (12, "2026-10-03"), (13, "2026-10-30"),
                (14, "2026-11-30"), (15, "2027-01-10"), (16, "2026-10-12"),
            ]
        ]
        r = cenario(pagar + receber)
        # Por vencimento: 15/09 e 01/10 (atrasados), 07/10 (hoje), 08/10, 20/10;
        # ficam de fora 05/11 e 01/12.
        checa("a pagar: 5 itens, só os mais próximos, por vencimento", ids(r["a_pagar"]) == [5, 3, 4, 7, 2], str(ids(r["a_pagar"])))
        # 03/10 (atrasado), 09/10, 12/10, 30/10, 30/11; fica de fora 10/01/2027.
        checa("a receber: 5 itens, só os mais próximos", ids(r["a_receber"]) == [12, 11, 16, 13, 14], str(ids(r["a_receber"])))
        checa("atrasado = vencimento antes de hoje", [i["overdue"] for i in r["a_pagar"]] == [True, True, False, False, False])
        checa("vence hoje não é atrasado", r["a_pagar"][2]["due_date"] == "2026-10-07" and r["a_pagar"][2]["overdue"] is False)
        checa("a receber: atrasado marcado", [i["overdue"] for i in r["a_receber"]] == [True, False, False, False, False])
        checa(
            "item traz descrição, valor e vencimento",
            r["a_pagar"][0]
            == {"id": 5, "description": "item 5", "amount": 10.0, "due_date": "2026-09-15", "overdue": True},
        )

        print("atrasado muito antigo abre a lista")
        r = cenario([prev(1, "expense", 1.0, "2025-01-01")] + [prev(i, "expense", 1.0, f"2026-10-{10 + i}") for i in range(2, 8)])
        checa("o mais velho entra e abre a lista de 5", ids(r["a_pagar"])[0] == 1 and len(r["a_pagar"]) == 5)

        print("sem janela")
        r = cenario([prev(1, "expense", 5.0, "2028-03-01")])
        checa("vence daqui a anos e aparece", ids(r["a_pagar"]) == [1])

        print("o que fica de fora")
        r = cenario(
            [
                prev(1, "expense", 5.0, "2026-10-10", efetivado=True),
                prev(2, "expense", 5.0, "2026-10-10", transferencia=True),
                prev(3, "income", 5.0, "2026-10-10", ingestao="awaiting_reconciliation"),
                prev(4, "income", 5.0, "2026-10-10", user=2),
                prev(5, "income", 5.0, "2026-10-10"),
            ]
        )
        checa(
            "efetivado, transferência, ingestão pendente e outro usuário ficam fora",
            r["a_pagar"] == [] and ids(r["a_receber"]) == [5],
        )

        print("vazio")
        r = cenario([])
        checa("sem lançamentos: listas vazias, não erro", r == {"a_pagar": [], "a_receber": []}, str(r))

        print("data de hoje inválida")
        try:
            vencimentos.proximos(UID, "07/10/2026")
            checa("hoje inválido é recusado", False)
        except ValueError:
            checa("hoje inválido é recusado", True)
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
