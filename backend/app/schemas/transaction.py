from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.transaction import (
    IngestState,
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
    is_internal_transfer: bool
    needs_transfer_review: bool
    series_id: int | None
    series_index: int | None
    ingest_state: IngestState
    source: TransactionSource
    external_id: str | None
    import_hash: str | None
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
