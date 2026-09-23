from pydantic import BaseModel

from app.models.transaction import AccountKind


class AccountCreate(BaseModel):
    user_id: int
    name: str
    kind: AccountKind = AccountKind.CHECKING


class AccountUpdate(BaseModel):
    """Só o que vier preenchido é alterado."""

    name: str | None = None
    kind: AccountKind | None = None


class AccountResponse(BaseModel):
    id: int
    user_id: int
    name: str
    kind: AccountKind

    class Config:
        from_attributes = True
