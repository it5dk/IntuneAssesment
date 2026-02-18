from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Microsoft Graph
    TENANT_ID: str = ""
    CLIENT_ID: str = ""
    CLIENT_SECRET: str = ""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://driftcontrol:driftcontrol@postgres:5432/driftcontrol"
    DATABASE_URL_SYNC: str = "postgresql://driftcontrol:driftcontrol@postgres:5432/driftcontrol"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/1"

    # App
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
