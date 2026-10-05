from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.transaction import (
    IngestState,
    Scope,
    SeriesFrequency,
    SeriesKind,
    TransactionSource,
    TransactionType,
)


class SeriesCreate(BaseModel):
    """
    Série opcional junto do lançamento: o usuário registra "parcelado em 12x"
    ou "todo mês" uma vez, e as ocorrências são geradas a partir daqui.

    `total_count` (parcelas) ou `end_date` (data-limite) definem fim conhecido —
    e é ter fim conhecido, não o `kind`, que manda materializar tudo.
    """

    kind: SeriesKind
    frequency: SeriesFrequency = SeriesFrequency.MONTHLY
    total_count: int | None = None
    end_date: date | None = None


class TransactionCreate(BaseModel):
    user_id: int
    # Obrigatória no lançamento manual: `null` só nasce de importação, pra
    # "sem categoria" significar sempre "o classificador não soube".
    category_id: int
    type: TransactionType
    amount: float
    description: str | None = None
    due_date: date
    # Nulo enquanto o dinheiro não se moveu. É daqui que saem as leituras
    # previsto / atrasado / realizado — elas não são gravadas.
    settled_at: date | None = None
    account_id: int | None = None
    is_internal_transfer: bool = False
    source: TransactionSource = TransactionSource.MANUAL
    series: SeriesCreate | None = None


class TransactionUpdate(BaseModel):
    """
    Edição de lançamento. Só o que vier preenchido é alterado.

    `scope` responde a mesma pergunta que editar, excluir e pular fazem:
    a mudança é pontual, vale daqui pra frente, ou vale pra série inteira.
    """

    scope: Scope = Scope.ONLY_THIS
    amount: float | None = None
    description: str | None = None
    category_id: int | None = None
    due_date: date | None = None
    settled_at: date | None = None
    # Trocar a conta é permitido; remover (voltar a "sem conta") não: nulo
    # significa "não mexa", como nos outros campos.
    account_id: int | None = None
    is_internal_transfer: bool | None = None


class BulkChanges(BaseModel):
    """Campos que a edição em lote aceita — de propósito, poucos."""

    category_id: int | None = None
    is_internal_transfer: bool | None = None


class BulkAction(BaseModel):
    """
    Ação sobre uma seleção da tela.

    `update` altera os campos informados; `delete` remove. Não há `scope`
    aqui: uma seleção é um conjunto escolhido a dedo, não uma série.
    """

    ids: list[int]
    action: Literal["update", "delete"] = "update"
    changes: BulkChanges | None = None


class SeriesExtend(BaseModel):
    """Roda a janela das séries de um usuário."""

    user_id: int


class SettlePayload(BaseModel):
    """Data em que o dinheiro se moveu. Sem ela, hoje."""

    on: date | None = None


class PostponePayload(BaseModel):
    """
    Adiar um vencimento. `scope` segue a mesma tríade das outras operações —
    mas adiar nunca toca o molde da série: é exceção pontual, não contrato novo.
    """

    scope: Scope = Scope.ONLY_THIS


class ReconcilePayload(BaseModel):
    """
    Resolve uma linha em espera.

    `merge` funde no registro existente (o candidato sugerido, ou `with_id` se o
    usuário identificou outro); `not_duplicate` a confirma como transação nova.
    """

    action: Literal["merge", "not_duplicate"]
    with_id: int | None = None


class HistoryEvent(BaseModel):
    at: datetime
    event: str

    class Config:
        extra = "allow"


class TransactionResponse(BaseModel):
    id: int
    user_id: int
    type: TransactionType
    amount: float
    description: str | None
    category_id: int | None
    due_date: date
    settled_at: date | None
    account_id: int | None
    # Vínculo com Cartão e Fatura (Fatia 5). Nulos até a compra no cartão existir;
    # lançamento antigo, sem o campo gravado, vale nulo.
    card_id: int | None = None
    invoice_id: int | None = None
    is_internal_transfer: bool
    needs_transfer_review: bool
    series_id: int | None
    series_index: int | None
    ingest_state: IngestState
    source: TransactionSource
    external_id: str | None
    import_hash: str | None
    bank_description: str | None = None
    reconcile_candidate_id: int | None = None
    history: list[HistoryEvent] = Field(default_factory=list)
    created_at: datetime

    class Config:
        from_attributes = True


class SeriesResponse(BaseModel):
    id: int
    user_id: int
    kind: SeriesKind
    description: str
    type: TransactionType
    category_id: int | None
    account_id: int | None
    amount: float
    frequency: SeriesFrequency
    anchor_day: int
    start_date: date
    total_count: int | None
    end_date: date | None
    ended_at: date | None

    class Config:
        from_attributes = True
