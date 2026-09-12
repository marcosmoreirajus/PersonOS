from pydantic import BaseModel
from datetime import datetime
from app.models.transaction import TransactionType


class TransactionCreate(BaseModel):
    category_id: int
    type: TransactionType
    amount: float
    description: str | None = None
    transaction_date: datetime


class TransactionResponse(BaseModel):
    id: int
    user_id: int
    category_id: int
    type: TransactionType
    amount: float
    description: str | None
    transaction_date: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
