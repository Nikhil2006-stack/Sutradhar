"""Application configuration powered by Pydantic Settings."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_SQLITE_PATH = BACKEND_DIR / "sutradhar.db"


class Settings(BaseSettings):
    """Environment-driven settings for Sutradhar backend."""

    APP_NAME: str = "Sutradhar"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    SECRET_KEY: str = "sutradhar-dev-secret-key-change-in-production-9f8e7d6c5b4a3210"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14
    ALGORITHM: str = "HS256"

    # Supports PostgreSQL (postgresql+psycopg://...) and SQLite fallback
    DATABASE_URL: str = f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"

    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    STORAGE_BACKEND: str = "local"
    LOCAL_STORAGE_PATH: str = str(BACKEND_DIR / "storage" / "uploads")
    MAX_UPLOAD_SIZE_MB: int = 15

    S3_ENDPOINT_URL: str = ""
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""
    S3_BUCKET_NAME: str = "sutradhar-documents"
    S3_REGION: str = "ap-south-1"

    LLM_PROVIDER: str = "auto"
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    LLM_MODEL: str = "gemini-2.5-flash"
    OCR_ENABLED: bool = True
    TESSERACT_CMD: str = "tesseract"

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR.parent / ".env"), str(BACKEND_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def active_llm_provider(self) -> str:
        if self.LLM_PROVIDER in ("gemini", "openai", "deterministic"):
            if self.LLM_PROVIDER == "gemini" and not self.GEMINI_API_KEY:
                return "deterministic"
            if self.LLM_PROVIDER == "openai" and not self.OPENAI_API_KEY:
                return "deterministic"
            return self.LLM_PROVIDER
        if self.GEMINI_API_KEY:
            return "gemini"
        if self.OPENAI_API_KEY:
            return "openai"
        return "deterministic"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    os.makedirs(settings.LOCAL_STORAGE_PATH, exist_ok=True)
    return settings

