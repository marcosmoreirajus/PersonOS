import json
from pathlib import Path
from datetime import datetime
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
