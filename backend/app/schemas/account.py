from pydantic import BaseModel

from app.models.transaction import AccountKind


class AccountCreate(BaseModel):
    user_id: int
    name: str
    kind: AccountKind = AccountKind.CHECKING
    initial_balance: float = 0
    logo: str | None = None


class AccountUpdate(BaseModel):
    """Só o que vier preenchido é alterado."""

    name: str | None = None
    kind: AccountKind | None = None
    initial_balance: float | None = None
    logo: str | None = None


class AccountResponse(BaseModel):
    id: int
    user_id: int
    name: str
    kind: AccountKind
    initial_balance: float = 0
    logo: str | None = None

    class Config:
        from_attributes = True
