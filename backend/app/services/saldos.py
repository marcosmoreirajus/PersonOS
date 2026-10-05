"""
Saldo por conta e Saldo da página (Visão Geral, issues #5 e #12).

Tudo aqui é derivado: nada é gravado. Saldo de uma conta = saldo inicial mais
as entradas menos as saídas EFETIVADAS dela. Diferente de receita, despesa e
relatórios, as pontas de transferência interna contam: o saldo da conta tem que
bater com o extrato dela. O previsto e o que tem ingestão pendente ficam fora.
"""

from typing import Any, Dict, List

from app.services.data_service import DataService


def saldos_por_conta(user_id: int) -> Dict[str, Any]:
    """
    Devolve:
      accounts   — [{account_id, name, kind, balance}] em ordem alfabética
      no_account — {"balance": x} com os efetivados sem conta, ou None se não há
      total      — soma das contas mais "Sem conta": o Saldo da página
    """
    contas: List[Dict[str, Any]] = DataService.get_accounts(user_id)
    saldos = {c["id"]: float(c.get("initial_balance") or 0) for c in contas}
    sem_conta = 0.0
    tem_sem_conta = False

    # `get_settled_by_user` já deixa de fora o previsto e a ingestão pendente.
    for t in DataService.get_settled_by_user(user_id):
        delta = t["amount"] if t["type"] == "income" else -t["amount"]
        conta_id = t.get("account_id")
        # Conta apagada ou de outro usuário não some com o dinheiro: cai em
        # "Sem conta", e a soma continua fechando com o total.
        if conta_id in saldos:
            saldos[conta_id] += delta
        else:
            sem_conta += delta
            tem_sem_conta = True

    linhas = [
        {
            "account_id": c["id"],
            "name": c["name"],
            "kind": c.get("kind"),
            "balance": round(saldos[c["id"]], 2),
        }
        for c in contas
    ]
    total = round(sum(saldos.values()) + sem_conta, 2)
    return {
        "accounts": linhas,
        "no_account": {"balance": round(sem_conta, 2)} if tem_sem_conta else None,
        "total": total,
    }
