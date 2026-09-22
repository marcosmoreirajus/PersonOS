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

    # ------------------------------------------------------------------ #
    # Transações
    #
    # `previsto / atrasado / realizado` NÃO é campo: deriva de `settled_at`
    # (nulo até o dinheiro se mover) com `due_date`. E `ingest_state` é um
    # eixo separado — nenhuma leitura agregada enxerga o que não está
    # confirmado. Ver docs/finance/spec.md.
    # ------------------------------------------------------------------ #

    @staticmethod
    def get_transactions(include_unconfirmed: bool = False) -> List[Dict[str, Any]]:
        """Todas as transações. Por padrão só as confirmadas."""
        transactions = DataService.load_json("transactions")
        if include_unconfirmed:
            return transactions
        return [t for t in transactions if t.get("ingest_state", "confirmed") == "confirmed"]

    @staticmethod
    def get_transactions_by_user(
        user_id: int, include_unconfirmed: bool = False
    ) -> List[Dict[str, Any]]:
        """Transações de um usuário. Por padrão só as confirmadas."""
        transactions = DataService.get_transactions(include_unconfirmed)
        return [t for t in transactions if t["user_id"] == user_id]

    @staticmethod
    def get_settled_by_user(user_id: int) -> List[Dict[str, Any]]:
        """
        Só o que já aconteceu — a base de saldo, cards e relatórios.

        Lançamento previsto (e o atrasado, que também não foi pago) fica de
        fora: contá-lo faria o saldo afirmar um dinheiro que não se moveu.
        """
        return [t for t in DataService.get_transactions_by_user(user_id) if t.get("settled_at")]

    @staticmethod
    def create_transaction(
        user_id: int,
        category_id: int,
        type: str,
        amount: float,
        due_date: str,
        description: str | None = None,
        settled_at: str | None = None,
        account_id: int | None = None,
        is_internal_transfer: bool = False,
        source: str = "manual",
        series: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """
        Cria uma transação nova e persiste em transactions.json.

        A geração das demais ocorrências quando vem `series` é da Fatia 2;
        aqui a série é criada e o lançamento já nasce vinculado a ela.
        """
        transactions = DataService.load_json("transactions")
        next_id = max((t["id"] for t in transactions), default=0) + 1
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        series_id = None
        if series:
            series_id = DataService.create_series(
                user_id=user_id,
                kind=series["kind"],
                description=description or "",
                type=type,
                category_id=category_id,
                account_id=account_id,
                amount=amount,
                frequency=series.get("frequency", "monthly"),
                start_date=due_date,
                total_count=series.get("total_count"),
                end_date=series.get("end_date"),
            )["id"]

        history = [{"at": now, "event": "created", "source": source}]
        if settled_at:
            history.append({"at": now, "event": "settled", "on": settled_at})

        new_transaction = {
            "id": next_id,
            "user_id": user_id,
            "type": type,
            "amount": amount,
            "description": description,
            "category_id": category_id,
            "due_date": due_date,
            "settled_at": settled_at,
            "account_id": account_id,
            "is_internal_transfer": is_internal_transfer,
            "needs_transfer_review": False,
            "series_id": series_id,
            "series_index": 1 if series_id else None,
            "ingest_state": "confirmed",
            "source": source,
            "external_id": None,
            "import_hash": None,
            "history": history,
            "created_at": now,
        }

        transactions.append(new_transaction)
        DataService.save_json("transactions", transactions)
        return new_transaction

    # ------------------------------------------------------------------ #
    # Séries (recorrência e parcelamento)
    # ------------------------------------------------------------------ #

    @staticmethod
    def get_series(user_id: int) -> List[Dict[str, Any]]:
        """Séries de um usuário. `ended_at` preenchido = encerrada."""
        return [s for s in DataService.load_json("series") if s["user_id"] == user_id]

    @staticmethod
    def create_series(
        user_id: int,
        kind: str,
        description: str,
        type: str,
        category_id: int | None,
        amount: float,
        frequency: str,
        start_date: str,
        account_id: int | None = None,
        total_count: int | None = None,
        end_date: str | None = None,
    ) -> Dict[str, Any]:
        """
        Cria a série. O total da dívida nunca é gravado — é a soma das
        parcelas, pra não existirem dois números concorrentes quando uma
        parcela vier com juros.
        """
        series = DataService.load_json("series")
        next_id = max((s["id"] for s in series), default=0) + 1

        new_series = {
            "id": next_id,
            "user_id": user_id,
            "kind": kind,
            "description": description,
            "type": type,
            "category_id": category_id,
            "account_id": account_id,
            "amount": amount,
            "frequency": frequency,
            "anchor_day": int(start_date[8:10]),
            "start_date": start_date,
            "total_count": total_count,
            "end_date": end_date,
            "ended_at": None,
        }

        series.append(new_series)
        DataService.save_json("series", series)
        return new_series

    @staticmethod
    def get_investments(user_id: int) -> Dict[str, Any]:
        """Retorna a carteira de investimentos (holdings + config de Coast FI) de um usuário."""
        all_data = DataService.load_json("investments")
        return next((i for i in all_data if i["user_id"] == user_id), {})

    @staticmethod
    def get_dashboard_summary(user_id: int) -> Dict[str, Any]:
        """Retorna resumo para dashboard."""
        # Só o efetivado: o previsto existe em transactions desde a fonte
        # única, mas não pode somar em saldo/cards/relatórios.
        transactions = DataService.get_settled_by_user(user_id)

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
            "recent_transactions": sorted(transactions, key=lambda x: x["settled_at"], reverse=True)[:5],
        }
