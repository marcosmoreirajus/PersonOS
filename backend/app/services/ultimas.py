"""
Últimas transações da Visão Geral (issues #5 e #16).

Os 8 lançamentos EFETIVADOS mais recentes do usuário, do mais novo ao mais
antigo. Cada item já traz o dia (`day`, AAAA-MM-DD de `settled_at`), o nome da
conta e as marcas de transferência interna e de importado; "Hoje" e "Ontem"
são do cliente, que tem o relógio local.

A transferência interna continua na lista (é lista, não soma). Fora: previsto
e ingestão pendente (a leitura padrão de `get_transactions_by_user` já
descarta esta última). Nada é gravado.
"""

from typing import Any, Dict, List

from app.services.data_service import DataService

LIMITE = 8


def _item(t: Dict[str, Any], contas: Dict[int, str]) -> Dict[str, Any]:
    return {
        "id": t["id"],
        "description": t.get("description"),
        "amount": t["amount"],
        "type": t["type"],
        "day": t["settled_at"][:10],
        "category_id": t.get("category_id"),
        "account_name": contas.get(t.get("account_id")),
        "is_internal_transfer": bool(t.get("is_internal_transfer")),
        # Veio de arquivo do banco: tem identificador de importação.
        "imported": bool(t.get("import_hash") or t.get("external_id")),
    }


def recentes(user_id: int) -> List[Dict[str, Any]]:
    """Até 8 itens {id, description, amount, type, day, category_id,
    account_name, is_internal_transfer, imported}. Sem efetivados, lista vazia."""
    efetivados = DataService.get_settled_by_user(user_id)
    # Instante de efetivação; o id desempata para a ordem ser estável.
    efetivados.sort(key=lambda t: (t["settled_at"], t["id"]), reverse=True)
    contas = {a["id"]: a["name"] for a in DataService.get_accounts(user_id)}
    return [_item(t, contas) for t in efetivados[:LIMITE]]
