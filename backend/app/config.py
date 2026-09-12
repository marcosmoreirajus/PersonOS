from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://personos_user:personos_pass@localhost:5432/personos_db"

    # API
    api_title: str = "PersonOS API"
    api_version: str = "0.1.0"
    api_description: str = "Sistema integrado de gestão pessoal"

    # JWT
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Environment
    environment: str = "development"
    debug: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
