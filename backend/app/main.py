from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import Base, engine

# Create tables
Base.metadata.create_all(bind=engine)

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
    }


@app.get("/health")
async def health_check():
    return {"status": "ok"}


# TODO: Import and include routers
# from app.api import users, transactions, categories
# app.include_router(users.router)
# app.include_router(transactions.router)
# app.include_router(categories.router)
