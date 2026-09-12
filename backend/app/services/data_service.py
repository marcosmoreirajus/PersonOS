import json
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any

# Caminho dos dados
DATA_DIR = Path(__file__).parent.parent.parent / "data"


class DataService:
    """Serviço de dados mock usando JSON files."""

    @staticmethod
    def load_json(filename: str) -> List[Dict[str, Any]]:
        """Carrega dados de um arquivo JSON."""
        filepath = DATA_DIR / f"{filename}.json"
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return []

    @staticmethod
    def save_json(filename: str, data: List[Dict[str, Any]]) -> None:
        """Salva dados num arquivo JSON (gera a string antes de truncar o
        arquivo, para não perder o conteúdo original se a serialização
        falhar — ver nota do Módulo Negócio sobre esse mesmo cuidado)."""
        content = json.dumps(data, ensure_ascii=False, indent=2)
        filepath = DATA_DIR / f"{filename}.json"
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)

    @staticmethod
    def get_users() -> List[Dict[str, Any]]:
        """Retorna lista de usuários."""
        return DataService.load_json("users")

    @staticmethod
    def get_user_by_id(user_id: int) -> Dict[str, Any] | None:
        """Retorna um usuário pelo ID."""
        users = DataService.get_users()
        return next((u for u in users if u["id"] == user_id), None)

    @staticmethod
    def get_categories() -> List[Dict[str, Any]]:
        """Retorna lista de categorias."""
        return DataService.load_json("categories")

    @staticmethod
    def get_category_by_id(category_id: int) -> Dict[str, Any] | None:
        """Retorna uma categoria pelo ID."""
        categories = DataService.get_categories()
        return next((c for c in categories if c["id"] == category_id), None)

    @staticmethod
    def get_transactions() -> List[Dict[str, Any]]:
        """Retorna lista de transações."""
        return DataService.load_json("transactions")

    @staticmethod
    def get_transactions_by_user(user_id: int) -> List[Dict[str, Any]]:
        """Retorna transações de um usuário específico."""
        transactions = DataService.get_transactions()
        return [t for t in transactions if t["user_id"] == user_id]

    @staticmethod
    def create_transaction(
        user_id: int,
        category_id: int,
        type: str,
        amount: float,
        description: str | None = None,
        transaction_date: str | None = None,
    ) -> Dict[str, Any]:
        """Cria uma transação nova e persiste em transactions.json."""
        transactions = DataService.get_transactions()
        next_id = max((t["id"] for t in transactions), default=0) + 1
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        new_transaction = {
            "id": next_id,
            "user_id": user_id,
            "category_id": category_id,
            "type": type,
            "amount": amount,
            "description": description,
            "transaction_date": transaction_date or now,
            "created_at": now,
        }

        transactions.append(new_transaction)
        DataService.save_json("transactions", transactions)
        return new_transaction

    @staticmethod
    def get_dashboard_summary(user_id: int) -> Dict[str, Any]:
        """Retorna resumo para dashboard."""
        transactions = DataService.get_transactions_by_user(user_id)

        income = sum(t["amount"] for t in transactions if t["type"] == "income")
        expense = sum(t["amount"] for t in transactions if t["type"] == "expense")
        balance = income - expense

        # Despesas por categoria
        expenses_by_category = {}
        for t in transactions:
            if t["type"] == "expense":
                cat_id = t["category_id"]
                category = DataService.get_category_by_id(cat_id)
                cat_name = category["name"] if category else "Outro"
                expenses_by_category[cat_name] = expenses_by_category.get(cat_name, 0) + t["amount"]

        return {
            "balance": balance,
            "income": income,
            "expense": expense,
            "expenses_by_category": expenses_by_category,
            "recent_transactions": sorted(transactions, key=lambda x: x["transaction_date"], reverse=True)[:5],
        }
