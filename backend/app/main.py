"""FastAPI Application Entrypoint for Sutradhar."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    routes_ai_ops,
    routes_auth_org,
    routes_documents_finance,
    routes_inventory,
    routes_procurement,
)
from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine
import app.models  # noqa: F401
from app.services.seed_service import ensure_default_demo_environment

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Create schema if needed and bootstrap default Indian MSME demo environment on startup."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_default_demo_environment(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Sutradhar — AI-Powered Business Operations & Decision Intelligence API",
    description=(
        "Multi-tenant enterprise SaaS platform for Indian MSMEs, manufacturers, and wholesale distributors. "
        "Connects inventory, suppliers, procurement, purchase orders, documents, finance, analytics, "
        "workflows, and the Signature Business Intelligence & Action Engine."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_prefix = settings.API_V1_PREFIX
app.include_router(routes_auth_org.router, prefix=api_prefix)
app.include_router(routes_inventory.router, prefix=api_prefix)
app.include_router(routes_procurement.router, prefix=api_prefix)
app.include_router(routes_documents_finance.router, prefix=api_prefix)
app.include_router(routes_ai_ops.router, prefix=api_prefix)


@app.get("/", tags=["Root"])
def root() -> dict[str, str]:
    return {
        "application": "Sutradhar AI Business Operations & Decision Intelligence Platform",
        "docs": "/docs",
        "health": "/api/v1/health",
    }

