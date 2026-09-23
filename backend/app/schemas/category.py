from pydantic import BaseModel

from app.models.transaction import CategoryType


class CategoryCreate(BaseModel):
    name: str
    type: CategoryType
    # Nome do ícone lucide (ex.: "utensils"), não emoji — decisão de 22/09.
    icon: str
    color: str = "#000000"


class CategoryResponse(BaseModel):
    id: int
    name: str
    type: CategoryType
    icon: str
    color: str

    class Config:
        from_attributes = True
