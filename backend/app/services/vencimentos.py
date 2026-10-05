"""
Próximos vencimentos da Visão Geral (issues #5 e #13).

As 5 obrigações a pagar (despesa) e as 5 a receber (receita) mais próximas,
entre os lançamentos PREVISTOS do usuário. Atrasados (vencimento antes de
hoje) vêm primeiro; como a ordenação é por vencimento, isso já os põe na
frente. Sem janela: a janela de dias é do sino e não vale aqui.

Fora: efetivado, transferência interna e ingestão pendente (a leitura padrão
de `get_transactions_by_user` já descarta esta última). Nada é gravado.
"""

from datetime import date
from typing import Any, Dict, List

from app.services.data_service import DataService

LIMITE = 5


def _item(t: Dict[str, Any], hoje: str) -> Dict[str, Any]:
    vence = t["due_date"][:10]
    return {
        "id": t["id"],
        "description": t.get("description"),
        "amount": t["amount"],
        "due_date": vence,
        "overdue": vence < hoje,
    }


def proximos(user_id: int, hoje: str) -> Dict[str, List[Dict[str, Any]]]:
    """
    `hoje` é AAAA-MM-DD, do relógio local do cliente. Devolve
    {"a_pagar": [...], "a_receber": [...]}, cada lista com até 5 itens
    {id, description, amount, due_date, overdue}. Sem previstos, listas vazias.
    """
    try:
        date.fromisoformat(hoje)
    except (ValueError, TypeError):
        raise ValueError("hoje inválido: use AAAA-MM-DD") from None

    previstos = [
        t
        for t in DataService.get_transactions_by_user(user_id)
        if not t.get("settled_at") and not t.get("is_internal_transfer")
    ]

    def lado(tipo: str) -> List[Dict[str, Any]]:
        do_lado = [t for t in previstos if t["type"] == tipo]
        # Vencimento, e o id desempata para a ordem ser estável.
        do_lado.sort(key=lambda t: (t["due_date"][:10], t["id"]))
        return [_item(t, hoje) for t in do_lado[:LIMITE]]

    return {"a_pagar": lado("expense"), "a_receber": lado("income")}
