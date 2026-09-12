from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.services import DataService

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "message": "PersonOS API",
        "version": settings.api_version,
        "environment": settings.environment,
        "status": "mock data (MVP 1.0)",
    }


@app.get("/health")
async def health_check():
    return {"status": "ok"}


# Rotas de Usuários
@app.get("/api/users")
async def get_users():
    return {"data": DataService.get_users()}


@app.get("/api/users/{user_id}")
async def get_user(user_id: int):
    user = DataService.get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}, 404
    return {"data": user}


# Rotas de Categorias
@app.get("/api/categories")
async def get_categories():
    return {"data": DataService.get_categories()}


# Rotas de Transações
@app.get("/api/transactions")
async def get_transactions():
    return {"data": DataService.get_transactions()}


@app.get("/api/transactions/user/{user_id}")
async def get_user_transactions(user_id: int):
    return {"data": DataService.get_transactions_by_user(user_id)}


@app.post("/api/transactions")
async def create_transaction(
    user_id: int, category_id: int, type: str, amount: float, description: str = None
):
    """
    Cria uma transação (mock - apenas retorna confirmação).
    Dados reais serão salvos quando implementar DB.
    """
    return {
        "message": "Transaction created (mock)",
        "data": {
            "user_id": user_id,
            "category_id": category_id,
            "type": type,
            "amount": amount,
            "description": description,
        },
    }


# Dashboard
@app.get("/api/dashboard/{user_id}")
async def get_dashboard(user_id: int):
    summary = DataService.get_dashboard_summary(user_id)
    return {"data": summary}


# TODO: Adicionar rotas de:
# - POST /api/transactions (criar transação real quando tiver DB)
# - PUT /api/transactions/{id} (editar)
# - DELETE /api/transactions/{id} (deletar)
# - Relatórios por período
# - Autenticação JWT
