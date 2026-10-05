# -*- coding: utf-8 -*-
"""
Critérios de aceite da Visão Geral (issues #5 e #12): saldo por conta e Saldo
da página. Dados isolados num `MemoriaStore`; os valores esperados são números
calculados à mão, não recalculados pelo código.

    saldo da conta = saldo inicial + entradas - saídas efetivadas dela
"""

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app.services.data_service import DataService  # noqa: E402
from app.services.store import MemoriaStore, usar_store  # noqa: E402

falhas = []

UID = 1
EFETIVADO = "2026-10-01T12:00:00Z"


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def conta(id, nome, saldo_inicial):
    return {"id": id, "user_id": UID, "name": nome, "kind": "checking", "initial_balance": saldo_inicial}


def lanc(id, tipo, valor, conta_id=None, efetivado=True, transferencia=False, ingestao="confirmed", user=UID):
    return {
        "id": id,
        "user_id": user,
        "category_id": 1,
        "type": tipo,
        "amount": valor,
        "due_date": "2026-10-01",
        "settled_at": EFETIVADO if efetivado else None,
        "account_id": conta_id,
        "is_internal_transfer": transferencia,
        "ingest_state": ingestao,
    }


def cenario(contas, lancamentos):
    """Troca o store por um novo, com estes dados, e devolve o resumo da Visão Geral."""
    store = MemoriaStore()
    store.save("accounts", contas)
    store.save("transactions", lancamentos)
    usar_store(store)
    return DataService.get_dashboard_summary(UID)


def por_conta(resumo):
    return {c["name"]: c["balance"] for c in resumo["accounts_balance"]["accounts"]}


def main():
    anterior = usar_store(MemoriaStore())
    try:
        print("saldo inicial e efetivados")
        r = cenario(
            [conta(1, "Itaú", 1000.0)],
            [lanc(1, "income", 500.0, 1), lanc(2, "expense", 200.0, 1)],
        )
        checa("saldo da conta = inicial 1000 + 500 - 200 = 1300", por_conta(r) == {"Itaú": 1300.0}, str(por_conta(r)))
        checa("Saldo da página = 1300", r["accounts_balance"]["total"] == 1300.0)

        r = cenario([conta(1, "Itaú", 250.5)], [])
        checa("conta sem lançamento vale o saldo inicial", por_conta(r) == {"Itaú": 250.5})

        print("previsto não soma")
        r = cenario(
            [conta(1, "Itaú", 1000.0)],
            [lanc(1, "expense", 300.0, 1, efetivado=False), lanc(2, "income", 40.0, 1, efetivado=False)],
        )
        checa("previsto não muda o saldo da conta", por_conta(r) == {"Itaú": 1000.0})

        print("ingestão pendente fica fora")
        r = cenario(
            [conta(1, "Itaú", 1000.0)],
            [
                lanc(1, "income", 900.0, 1, ingestao="awaiting_reconciliation"),
                lanc(2, "expense", 70.0, None, ingestao="awaiting_reconciliation"),
            ],
        )
        checa("pendente com conta não entra", por_conta(r) == {"Itaú": 1000.0})
        checa("pendente sem conta não cria 'Sem conta'", r["accounts_balance"]["no_account"] is None)
        checa("nem no total", r["accounts_balance"]["total"] == 1000.0)

        print("transferência entre contas")
        contas = [conta(1, "Itaú", 1000.0), conta(2, "Nubank", 200.0)]
        r = cenario(contas, [lanc(1, "expense", 300.0, 1, transferencia=True)])
        checa("só a ponta de saída: a conta de origem cai", por_conta(r) == {"Itaú": 700.0, "Nubank": 200.0}, str(por_conta(r)))
        checa("e o total oscila para 900", r["accounts_balance"]["total"] == 900.0)

        r = cenario(
            contas,
            [lanc(1, "expense", 300.0, 1, transferencia=True), lanc(2, "income", 300.0, 2, transferencia=True)],
        )
        checa("com as duas pontas: 700 e 500", por_conta(r) == {"Itaú": 700.0, "Nubank": 500.0}, str(por_conta(r)))
        checa("o total se anula: 1200", r["accounts_balance"]["total"] == 1200.0)
        checa(
            "a transferência continua fora de receita, despesa e resultado",
            r["income"] == 0 and r["expense"] == 0,
        )

        print("Sem conta")
        r = cenario(
            [conta(1, "Itaú", 1000.0)],
            [lanc(1, "income", 500.0, 1), lanc(2, "income", 100.0, None), lanc(3, "expense", 30.0, None)],
        )
        checa("lançamento sem conta vira a linha Sem conta: 100 - 30 = 70", r["accounts_balance"]["no_account"] == {"balance": 70.0})
        checa("a conta não é afetada: 1500", por_conta(r) == {"Itaú": 1500.0})
        checa("o total fecha: 1500 + 70 = 1570", r["accounts_balance"]["total"] == 1570.0)

        r = cenario([conta(1, "Itaú", 1000.0)], [lanc(1, "income", 500.0, 1)])
        checa("sem lançamento sem conta, a linha não existe", r["accounts_balance"]["no_account"] is None)

        r = cenario([conta(1, "Itaú", 1000.0)], [lanc(1, "income", 100.0, 999)])
        checa(
            "conta que não existe mais cai em Sem conta e o total fecha",
            r["accounts_balance"]["no_account"] == {"balance": 100.0} and r["accounts_balance"]["total"] == 1100.0,
        )

        r = cenario([conta(1, "Itaú", 1000.0)], [lanc(1, "expense", 80.0, None, transferencia=True)])
        checa(
            "ponta de transferência sem conta também conta em Sem conta: -80",
            r["accounts_balance"]["no_account"] == {"balance": -80.0},
        )

        print("dados de hoje (nenhuma conta, nada com conta)")
        r = cenario(
            [],
            [
                lanc(1, "income", 1000.0),
                lanc(2, "expense", 400.0),
                lanc(3, "expense", 50.0, transferencia=True),
                lanc(4, "income", 999.0, efetivado=False),
            ],
        )
        checa("sem contas, a lista de contas é vazia", r["accounts_balance"]["accounts"] == [])
        checa("tudo cai em Sem conta: 1000 - 400 - 50 = 550", r["accounts_balance"]["no_account"] == {"balance": 550.0})
        checa("o Saldo da página é o total: 550", r["accounts_balance"]["total"] == 550.0)
        checa("Receitas e Saídas seguem como estão: 1000 e 400", r["income"] == 1000.0 and r["expense"] == 400.0)
        checa("o Resultado (balance) segue receita menos despesa: 600", r["balance"] == 600.0)

        r = cenario([conta(1, "Itaú", 1000.0)], [lanc(1, "income", 500.0, 1), lanc(2, "expense", 200.0, 1)])
        checa(
            "com saldo inicial, Saldo (1300) e Resultado (300) deixam de coincidir",
            r["accounts_balance"]["total"] == 1300.0 and r["balance"] == 300.0,
        )

        print("isolamento por usuário")
        r = cenario(
            [conta(1, "Itaú", 100.0), {**conta(2, "Alheia", 5000.0), "user_id": 2}],
            [lanc(1, "income", 10.0, 1), lanc(2, "income", 7000.0, 2, user=2)],
        )
        checa("só as contas e lançamentos do usuário", por_conta(r) == {"Itaú": 110.0} and r["accounts_balance"]["total"] == 110.0)

        print("ordem e centavos")
        r = cenario(
            [conta(1, "Zeta", 0.0), conta(2, "alfa", 0.1)],
            [lanc(1, "income", 0.2, 2)],
        )
        checa("contas em ordem alfabética sem diferenciar caixa", [c["name"] for c in r["accounts_balance"]["accounts"]] == ["alfa", "Zeta"])
        checa("0.1 + 0.2 não vaza ponto flutuante", por_conta(r)["alfa"] == 0.3)
    finally:
        usar_store(anterior)

    print()
    if falhas:
        print(f"{len(falhas)} falha(s):")
        for f in falhas:
            print("  -", f)
        sys.exit(1)
    print("Todos os critérios da Visão Geral passaram.")


main()
