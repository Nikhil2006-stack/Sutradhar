"""Celery asynchronous background worker configuration for OCR, RAG indexing, and workflow automation."""

from __future__ import annotations

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "sutradhar_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
)


@celery_app.task(name="sutradhar.process_document_task")
def process_document_task(document_id: str) -> dict[str, str]:
    """Asynchronous background worker task to run OCR and structured extraction."""
    from app.ai.document_intelligence import process_document_pipeline
    from app.core.database import SessionLocal
    from app.models.entities import Document

    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return {"status": "not_found", "document_id": document_id}
        extraction = process_document_pipeline(db, doc)
        db.commit()
        return {"status": "completed", "document_id": document_id, "extraction_id": extraction.id}
    finally:
        db.close()

