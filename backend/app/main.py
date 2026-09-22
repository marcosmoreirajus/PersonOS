from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.schemas import TransactionCreate
from app.services import DataService, BusinessService

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
async def create_transaction(payload: TransactionCreate):
    """Cria uma transação e persiste em backend/data/transactions.json."""
    # mode="json" converte date/Enum em string: o JSON de dados guarda
    # datas de calendário como "YYYY-MM-DD", sem hora e sem fuso.
    new_transaction = DataService.create_transaction(**payload.model_dump(mode="json"))
    return {"data": new_transaction}


# Dashboard
@app.get("/api/dashboard/{user_id}")
async def get_dashboard(user_id: int):
    summary = DataService.get_dashboard_summary(user_id)
    return {"data": summary}


# Rotas de Patrimônio (investimentos)
@app.get("/api/investments/{user_id}")
async def get_investments(user_id: int):
    return {"data": DataService.get_investments(user_id)}


# Rotas de Séries (recorrência e parcelamento)
#
# `/api/scheduled` foi removida na Fatia 1: desde a decisão de fonte única, o
# registro nasce em transações e Agendadas é só uma visão dele. A tela monta a
# lista com /api/transactions + /api/series.
@app.get("/api/series/user/{user_id}")
async def get_series(user_id: int):
    return {"data": DataService.get_series(user_id)}


# Rotas do Módulo Negócio (dados em Markdown, desacoplado do Módulo Finanças)
@app.get("/api/business/{section}")
async def get_business_section(section: str):
    data = BusinessService.get_section(section)
    if not data:
        return {"error": "Section not found"}, 404
    return {"data": data}


@app.put("/api/business/{section}")
async def update_business_section(section: str, request: Request):
    body = await request.json()
    data = BusinessService.update_section(section, body)
    if not data:
        return {"error": "Section not found"}, 404
    return {"data": data}


# Próximas fatias (ver docs/finance/PRD.md):
# - Fatia 2: PATCH/DELETE /api/transactions/{id} com `scope`, POST /settle,
#   POST /postpone, POST /api/series/extend
# - Fatia 3: POST /api/import/preview e /commit, POST /api/reconcile/{id}
# - Fatia 4: GET /api/review/user/{user_id}
# - Autenticação JWT
