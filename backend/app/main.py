"""FastAPI Application Entrypoint for Sutradhar."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

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
FRONTEND_DIST_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"


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
    docs_url="/api/docs",
    redoc_url="/api/redoc",
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


@app.get("/api/v1/info", tags=["Root"])
def api_info() -> dict[str, str]:
    return {
        "application": "Sutradhar AI Business Operations & Decision Intelligence Platform",
        "docs": "/api/docs",
        "health": "/api/v1/health",
    }


if (FRONTEND_DIST_DIR / "assets").is_dir():
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_DIST_DIR / "assets")),
        name="frontend-assets",
    )


@app.get("/", include_in_schema=False)
def serve_root():
    index_file = FRONTEND_DIST_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(str(index_file))
    return {
        "application": "Sutradhar AI Business Operations & Decision Intelligence Platform",
        "docs": "/api/docs",
        "health": "/api/v1/health",
    }


@app.get("/{full_path:path}", include_in_schema=False)
def serve_spa_fallback(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    candidate = FRONTEND_DIST_DIR / full_path
    if candidate.is_file():
        return FileResponse(str(candidate))
    index_file = FRONTEND_DIST_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(str(index_file))
    raise HTTPException(status_code=404, detail="Resource not found")
