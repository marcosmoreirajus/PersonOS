"""
Cartões (issue #21, Fatia 5): cadastro de Cartão.

Cartão é uma dívida com ciclo, não uma Conta: tem limite, dia de fechamento,
dia de vencimento e uma conta pagadora padrão. Fatura, compra e limite
disponível são dos tickets seguintes; aqui só mora o cadastro.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List

from app.conta_logos import logo_valido
from app.services.store import store_ativo

COLECAO = "cards"


def _normalizar(nome: str) -> str:
    return " ".join(nome.lower().split())


def _dia_valido(valor: Any, rotulo: str) -> int:
    if isinstance(valor, bool) or not isinstance(valor, int) or not 1 <= valor <= 31:
        raise ValueError(f"O dia de {rotulo} precisa estar entre 1 e 31.")
    return valor


def _limite_valido(valor: Any) -> float:
    if isinstance(valor, bool) or not isinstance(valor, (int, float)) or valor < 0:
        raise ValueError("O limite não pode ser negativo.")
    return round(float(valor), 2)


def _logo_valido(logo: str | None) -> str | None:
    """Mesma coleção fechada das contas (`app/conta_logos.py`): imagem enviada não é aceita. Vazio remove."""
    if not logo:
        return None
    if not logo_valido(logo):
        raise ValueError("Escolha um dos ícones da lista.")
    return logo


def _conta_pagadora_valida(user_id: int, account_id: int | None) -> int | None:
    """A conta pagadora precisa ser uma Conta do mesmo usuário. 0 ou nulo = sem conta."""
    if not account_id:
        return None
    contas = store_ativo().load("accounts")
    if not any(a["id"] == account_id and a["user_id"] == user_id for a in contas):
        raise ValueError("A conta pagadora não existe para este usuário.")
    return account_id


def _nome_em_uso(cartoes: List[Dict[str, Any]], user_id: int, nome: str, ignorar_id: int | None = None) -> bool:
    alvo = _normalizar(nome)
    return any(
        c["user_id"] == user_id and c["id"] != ignorar_id and _normalizar(c["name"]) == alvo
        for c in cartoes
    )


def listar(user_id: int) -> List[Dict[str, Any]]:
    """Cartões do usuário, em ordem alfabética."""
    cartoes = [c for c in store_ativo().load(COLECAO) if c["user_id"] == user_id]
    return sorted(cartoes, key=lambda c: c["name"].lower())


def criar(
    user_id: int,
    name: str,
    limit: float,
    closing_day: int,
    due_day: int,
    default_payer_account_id: int | None = None,
    logo: str | None = None,
) -> Dict[str, Any]:
    """
    Cria um Cartão. O nome é único por usuário (sem diferenciar caixa nem
    espaços repetidos): dois "Nubank" fariam o usuário escolher o errado na
    hora de lançar uma compra.
    """
    nome = " ".join(name.split())
    if not nome:
        raise ValueError("Dê um nome para o cartão.")
    cartoes = store_ativo().load(COLECAO)
    if _nome_em_uso(cartoes, user_id, nome):
        raise ValueError("Já existe um cartão com esse nome.")

    novo = {
        "id": max((c["id"] for c in cartoes), default=0) + 1,
        "user_id": user_id,
        "name": nome,
        "limit": _limite_valido(limit),
        "closing_day": _dia_valido(closing_day, "fechamento"),
        "due_day": _dia_valido(due_day, "vencimento"),
        "default_payer_account_id": _conta_pagadora_valida(user_id, default_payer_account_id),
        "logo": _logo_valido(logo),
        # Identificador que o banco põe no arquivo; usado pela importação do
        # extrato do cartão (ticket próprio) para avisar de arquivo trocado.
        "file_ref": None,
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    cartoes.append(novo)
    store_ativo().save(COLECAO, cartoes)
    return novo


def atualizar(
    card_id: int,
    name: str | None = None,
    limit: float | None = None,
    closing_day: int | None = None,
    due_day: int | None = None,
    default_payer_account_id: int | None = None,
    logo: str | None = None,
) -> Dict[str, Any] | None:
    """
    Só o que vier preenchido é alterado. `default_payer_account_id` = 0 remove
    a conta pagadora e `logo` = "" remove o ícone. Tudo é validado antes de mudar qualquer campo: uma edição
    recusada não grava nada. Devolve None se o cartão não existe.
    """
    cartoes = store_ativo().load(COLECAO)
    cartao = next((c for c in cartoes if c["id"] == card_id), None)
    if cartao is None:
        return None

    mudancas: Dict[str, Any] = {}
    if name is not None:
        nome = " ".join(name.split())
        if not nome:
            raise ValueError("Dê um nome para o cartão.")
        if _nome_em_uso(cartoes, cartao["user_id"], nome, ignorar_id=card_id):
            raise ValueError("Já existe um cartão com esse nome.")
        mudancas["name"] = nome
    if limit is not None:
        mudancas["limit"] = _limite_valido(limit)
    if closing_day is not None:
        mudancas["closing_day"] = _dia_valido(closing_day, "fechamento")
    if due_day is not None:
        mudancas["due_day"] = _dia_valido(due_day, "vencimento")
    if default_payer_account_id is not None:
        mudancas["default_payer_account_id"] = _conta_pagadora_valida(cartao["user_id"], default_payer_account_id)
    if logo is not None:
        # string vazia remove o ícone
        mudancas["logo"] = _logo_valido(logo)

    cartao.update(mudancas)
    store_ativo().save(COLECAO, cartoes)
    return cartao
