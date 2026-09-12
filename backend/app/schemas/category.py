from pydantic import BaseModel
from datetime import datetime


class CategoryCreate(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None
    color: str = "#000000"


class CategoryResponse(BaseModel):
    id: int
    name: str
    description: str | None
    icon: str | None
    color: str
    created_at: datetime

    class Config:
        from_attributes = True
