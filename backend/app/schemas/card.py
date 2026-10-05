from datetime import datetime

from pydantic import BaseModel


class CardCreate(BaseModel):
    """Os dias e o limite são validados no serviço (400 com frase), não aqui."""

    user_id: int
    name: str
    limit: float
    closing_day: int
    due_day: int
    default_payer_account_id: int | None = None


class CardUpdate(BaseModel):
    """Só o que vier preenchido é alterado. `default_payer_account_id` = 0 remove."""

    name: str | None = None
    limit: float | None = None
    closing_day: int | None = None
    due_day: int | None = None
    default_payer_account_id: int | None = None


class CardResponse(BaseModel):
    id: int
    user_id: int
    name: str
    limit: float
    closing_day: int
    due_day: int
    default_payer_account_id: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True
