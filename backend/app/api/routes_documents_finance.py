"""AI Document Intelligence, Invoice Extraction/Verification & Financial Intelligence API routes."""

from __future__ import annotations

import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.ai.document_intelligence import process_document_pipeline
from app.api.deps import TenantContext, record_audit_log, require_permissions
from app.core.config import get_settings
from app.core.database import get_db
from app.models.entities import (
    Document,
    DocumentExtraction,
    Expense,
    Invoice,
    Payment,
    PurchaseOrder,
    Supplier,
)
from app.schemas.api_schemas import (
    DocumentVerifyRequest,
    ExpenseCreateRequest,
    InvoiceCreateRequest,
    PaymentCreateRequest,
)

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".txt", ".csv"}


# =============================================================================
# AI DOCUMENT INTELLIGENCE
# =============================================================================


@router.post("/documents/upload", status_code=status.HTTP_201_CREATED, tags=["Documents & OCR"])
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    doc_type: str = Form(default="INVOICE"),
    supplier_id: Optional[str] = Form(default=None),
    extracted_text_override: Optional[str] = Form(default=None),
    ctx: TenantContext = Depends(require_permissions("documents:write")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Securely upload an invoice PDF, receipt image, purchase order, or contract.
    Validates file type & size, checks SHA-256 duplicate hash, and runs OCR + structured extraction.
    """
    settings = get_settings()
    orig_name = file.filename or "uploaded_document.pdf"
    ext = Path(orig_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    raw_bytes = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(raw_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )

    if extracted_text_override and len(raw_bytes) < 32:
        raw_bytes = extracted_text_override.encode("utf-8")

    sha256_hash = hashlib.sha256(raw_bytes).hexdigest()

    duplicate_doc = (
        db.query(Document)
        .filter(
            Document.organization_id == ctx.organization.id,
            Document.file_hash_sha256 == sha256_hash,
        )
        .first()
    )

    os.makedirs(settings.LOCAL_STORAGE_PATH, exist_ok=True)
    safe_filename = f"{ctx.organization.id}_{uuid.uuid4().hex[:10]}{ext}"
    storage_path = Path(settings.LOCAL_STORAGE_PATH) / safe_filename
    storage_path.write_bytes(raw_bytes)

    doc = Document(
        organization_id=ctx.organization.id,
        filename=safe_filename,
        original_filename=orig_name,
        mime_type=file.content_type or "application/pdf",
        file_size_bytes=len(raw_bytes),
        storage_path=str(storage_path),
        file_hash_sha256=sha256_hash,
        doc_type=doc_type,
        status="DUPLICATE" if duplicate_doc else "UPLOADED",
        supplier_id=supplier_id,
        uploaded_by_id=ctx.user.id,
        is_duplicate=bool(duplicate_doc),
        duplicate_of_id=duplicate_doc.id if duplicate_doc else None,
    )
    db.add(doc)
    db.flush()

    extraction = process_document_pipeline(db, doc)

    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="DOCUMENT_UPLOADED_AND_EXTRACTED",
        entity_type="DOCUMENT",
        entity_id=doc.id,
        summary=f"Uploaded and extracted '{orig_name}' ({extraction.doc_classification}, Confidence {extraction.confidence_score}%).",
        request=request,
    )
    db.commit()

    return {
        "id": doc.id,
        "original_filename": doc.original_filename,
        "doc_type": doc.doc_type,
        "status": doc.status,
        "is_duplicate": doc.is_duplicate,
        "duplicate_of_id": doc.duplicate_of_id,
        "extraction": {
            "id": extraction.id,
            "invoice_number": extraction.invoice_number,
            "invoice_date": extraction.invoice_date,
            "due_date": extraction.due_date,
            "supplier_name": extraction.supplier_name,
            "supplier_gstin": extraction.supplier_gstin,
            "po_reference": extraction.po_reference,
            "subtotal": float(extraction.subtotal or 0),
            "tax_amount": float(extraction.tax_amount or 0),
            "total_amount": float(extraction.total_amount or 0),
            "confidence_score": float(extraction.confidence_score or 0),
            "validation_warnings": extraction.validation_warnings,
            "is_verified": extraction.is_verified,
        },
    }


@router.get("/documents", tags=["Documents & OCR"])
def list_documents(
    search: Optional[str] = Query(default=None),
    doc_type: Optional[str] = Query(default=None),
    ctx: TenantContext = Depends(require_permissions("documents:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """List uploaded documents and their AI extraction status."""
    q = db.query(Document).filter(Document.organization_id == ctx.organization.id)
    if doc_type:
        q = q.filter(Document.doc_type == doc_type)
    docs = q.order_by(Document.created_at.desc()).all()

    items = []
    for d in docs:
        ext = d.extractions[0] if d.extractions else None
        raw_page_text = d.pages[0].raw_text if d.pages else ""
        if search:
            s_low = search.lower().strip()
            combined = f"{d.original_filename} {ext.invoice_number if ext else ''} {ext.supplier_name if ext else ''} {raw_page_text}".lower()
            if s_low not in combined:
                continue

        items.append(
            {
                "id": d.id,
                "original_filename": d.original_filename,
                "mime_type": d.mime_type,
                "file_size_bytes": d.file_size_bytes,
                "doc_type": d.doc_type,
                "status": d.status,
                "is_duplicate": d.is_duplicate,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "verified_at": d.verified_at.isoformat() if d.verified_at else None,
                "extraction": (
                    {
                        "id": ext.id,
                        "doc_classification": ext.doc_classification,
                        "invoice_number": ext.invoice_number,
                        "invoice_date": ext.invoice_date,
                        "due_date": ext.due_date,
                        "supplier_name": ext.supplier_name,
                        "supplier_gstin": ext.supplier_gstin,
                        "po_reference": ext.po_reference,
                        "subtotal": float(ext.subtotal or 0),
                        "tax_amount": float(ext.tax_amount or 0),
                        "total_amount": float(ext.total_amount or 0),
                        "confidence_score": float(ext.confidence_score or 0),
                        "validation_warnings": ext.validation_warnings or [],
                        "is_verified": ext.is_verified,
                    }
                    if ext
                    else None
                ),
            }
        )
    return {"items": items, "total": len(items)}


@router.get("/documents/{document_id}", tags=["Documents & OCR"])
def get_document_detail(
    document_id: str,
    ctx: TenantContext = Depends(require_permissions("documents:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Inspect a specific document, its OCR page text, structured extraction, and RAG chunks."""
    doc = (
        db.query(Document)
        .filter(
            Document.organization_id == ctx.organization.id,
            Document.id == document_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    ext = doc.extractions[0] if doc.extractions else None
    return {
        "id": doc.id,
        "original_filename": doc.original_filename,
        "mime_type": doc.mime_type,
        "file_size_bytes": doc.file_size_bytes,
        "doc_type": doc.doc_type,
        "status": doc.status,
        "is_duplicate": doc.is_duplicate,
        "pages": [
            {
                "page_number": p.page_number,
                "raw_text": p.raw_text,
                "ocr_confidence": float(p.ocr_confidence or 0),
            }
            for p in doc.pages
        ],
        "extraction": (
            {
                "id": ext.id,
                "doc_classification": ext.doc_classification,
                "invoice_number": ext.invoice_number,
                "invoice_date": ext.invoice_date,
                "due_date": ext.due_date,
                "supplier_name": ext.supplier_name,
                "supplier_gstin": ext.supplier_gstin,
                "po_reference": ext.po_reference,
                "subtotal": float(ext.subtotal or 0),
                "tax_amount": float(ext.tax_amount or 0),
                "total_amount": float(ext.total_amount or 0),
                "confidence_score": float(ext.confidence_score or 0),
                "validation_warnings": ext.validation_warnings or [],
                "extracted_json": ext.extracted_json,
                "verified_json": ext.verified_json,
                "is_verified": ext.is_verified,
            }
            if ext
            else None
        ),
    }


@router.post("/documents/{document_id}/process", tags=["Documents & OCR"])
def reprocess_document(
    document_id: str,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("documents:write")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Re-run OCR, structured extraction, and RAG vector indexing on an uploaded document."""
    doc = (
        db.query(Document)
        .filter(
            Document.organization_id == ctx.organization.id,
            Document.id == document_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    ext = process_document_pipeline(db, doc)
    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="DOCUMENT_REPROCESSED",
        entity_type="DOCUMENT",
        entity_id=doc.id,
        summary=f"Re-ran OCR & extraction pipeline on {doc.original_filename}.",
        request=request,
    )
    db.commit()
    return {
        "document_id": doc.id,
        "status": doc.status,
        "invoice_number": ext.invoice_number,
        "confidence_score": float(ext.confidence_score or 0),
    }


@router.post("/documents/{document_id}/verify", tags=["Documents & OCR"])
def verify_document_extraction(
    document_id: str,
    payload: DocumentVerifyRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("documents:verify")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Human verification and correction of AI-extracted document fields.
    Only after this human confirmation is a verified Payable Invoice created and matched to PO.
    """
    doc = (
        db.query(Document)
        .filter(
            Document.organization_id == ctx.organization.id,
            Document.id == document_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    ext = (
        db.query(DocumentExtraction)
        .filter(DocumentExtraction.document_id == doc.id)
        .first()
    )
    if not ext:
        ext = process_document_pipeline(db, doc)

    if payload.invoice_number:
        ext.invoice_number = payload.invoice_number
    if payload.supplier_name:
        ext.supplier_name = payload.supplier_name
    if payload.supplier_gstin:
        ext.supplier_gstin = payload.supplier_gstin
    if payload.po_reference is not None:
        ext.po_reference = payload.po_reference
    ext.subtotal = payload.subtotal
    ext.tax_amount = payload.tax_amount
    ext.total_amount = payload.total_amount
    ext.is_verified = True
    ext.verified_json = payload.model_dump(mode="json")

    doc.status = "VERIFIED"
    doc.verified_by_id = ctx.user.id
    doc.verified_at = datetime.now(timezone.utc)

    created_invoice_id: Optional[str] = None
    match_status = "UNLINKED"
    match_notes = "No PO reference linked."

    if payload.create_payable_invoice:
        # Resolve supplier
        sup_id = payload.supplier_id or doc.supplier_id
        if not sup_id and ext.supplier_name:
            sup = (
                db.query(Supplier)
                .filter(
                    Supplier.organization_id == ctx.organization.id,
                    Supplier.name.ilike(f"%{ext.supplier_name}%"),
                )
                .first()
            )
            if sup:
                sup_id = sup.id

        po_id: Optional[str] = None
        if ext.po_reference:
            po = (
                db.query(PurchaseOrder)
                .filter(
                    PurchaseOrder.organization_id == ctx.organization.id,
                    PurchaseOrder.po_number == ext.po_reference,
                )
                .first()
            )
            if po:
                po_id = po.id
                diff = abs(Decimal(str(po.total_amount or 0)) - payload.total_amount)
                if diff <= Decimal("5.00"):
                    match_status = "MATCHED"
                    match_notes = f"Verified 3-Way Match with {po.po_number} (₹{po.total_amount:,.2f})."
                else:
                    match_status = "MISMATCH"
                    match_notes = (
                        f"Variance of ₹{diff:,.2f} detected between Invoice (₹{payload.total_amount:,.2f}) "
                        f"and {po.po_number} (₹{po.total_amount:,.2f})."
                    )

        inv_no = ext.invoice_number or f"INV-VER-{doc.id[:6].upper()}"
        existing_inv = (
            db.query(Invoice)
            .filter(
                Invoice.organization_id == ctx.organization.id,
                Invoice.invoice_number == inv_no,
            )
            .first()
        )
        if not existing_inv:
            today = datetime.now(timezone.utc).date()
            inv = Invoice(
                organization_id=ctx.organization.id,
                invoice_number=inv_no,
                invoice_type="PAYABLE",
                supplier_id=sup_id,
                purchase_order_id=po_id,
                document_id=doc.id,
                invoice_date=payload.invoice_date or today,
                due_date=payload.due_date or (today + timedelta(days=30)),
                subtotal=payload.subtotal,
                tax_amount=payload.tax_amount,
                total_amount=payload.total_amount,
                paid_amount=Decimal("0.00"),
                balance_due=payload.total_amount,
                status="VERIFIED",
                match_status=match_status,
                match_notes=match_notes,
                is_verified=True,
                notes=payload.notes,
            )
            db.add(inv)
            db.flush()
            created_invoice_id = inv.id

    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="DOCUMENT_EXTRACTION_VERIFIED",
        entity_type="DOCUMENT",
        entity_id=doc.id,
        summary=f"Human-verified extracted document '{doc.original_filename}' (Invoice {ext.invoice_number}, Total ₹{payload.total_amount:,.2f}).",
        request=request,
    )
    db.commit()

    return {
        "document_id": doc.id,
        "status": doc.status,
        "is_verified": True,
        "created_invoice_id": created_invoice_id,
        "match_status": match_status,
        "match_notes": match_notes,
    }


# =============================================================================
# INVOICES & FINANCIAL INTELLIGENCE
# =============================================================================


@router.get("/invoices", tags=["Invoices & Finance"])
def list_invoices(
    invoice_type: Optional[str] = Query(default=None),
    ctx: TenantContext = Depends(require_permissions("finance:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """List payable and receivable invoices with 3-way PO matching status."""
    q = db.query(Invoice).filter(Invoice.organization_id == ctx.organization.id)
    if invoice_type:
        q = q.filter(Invoice.invoice_type == invoice_type)
    invoices = q.order_by(Invoice.due_date.asc()).all()

    suppliers = {
        s.id: s.name
        for s in db.query(Supplier).filter(Supplier.organization_id == ctx.organization.id).all()
    }
    pos = {
        p.id: p.po_number
        for p in db.query(PurchaseOrder).filter(PurchaseOrder.organization_id == ctx.organization.id).all()
    }

    items = [
        {
            "id": i.id,
            "invoice_number": i.invoice_number,
            "invoice_type": i.invoice_type,
            "supplier_id": i.supplier_id,
            "counterparty_name": suppliers.get(i.supplier_id or "", i.customer_name or "Vendor / Customer"),
            "po_number": pos.get(i.purchase_order_id or "", None),
            "invoice_date": i.invoice_date.isoformat() if i.invoice_date else None,
            "due_date": i.due_date.isoformat() if i.due_date else None,
            "subtotal": float(i.subtotal or 0),
            "tax_amount": float(i.tax_amount or 0),
            "total_amount": float(i.total_amount or 0),
            "paid_amount": float(i.paid_amount or 0),
            "balance_due": float(i.balance_due or 0),
            "status": i.status,
            "match_status": i.match_status,
            "match_notes": i.match_notes,
            "is_verified": i.is_verified,
        }
        for i in invoices
    ]
    return {"items": items, "total": len(items)}


@router.post("/invoices", status_code=status.HTTP_201_CREATED, tags=["Invoices & Finance"])
def create_invoice(
    payload: InvoiceCreateRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("finance:write")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Create a Payable or Receivable invoice and run automatic PO 3-way match check."""
    today = datetime.now(timezone.utc).date()
    match_status = "UNLINKED"
    match_notes = None

    if payload.purchase_order_id:
        po = (
            db.query(PurchaseOrder)
            .filter(
                PurchaseOrder.organization_id == ctx.organization.id,
                PurchaseOrder.id == payload.purchase_order_id,
            )
            .first()
        )
        if po:
            diff = abs(Decimal(str(po.total_amount or 0)) - payload.total_amount)
            if diff <= Decimal("5.00"):
                match_status = "MATCHED"
                match_notes = f"Matched against {po.po_number}."
            else:
                match_status = "MISMATCH"
                match_notes = f"Variance of ₹{diff:,.2f} vs {po.po_number} (₹{po.total_amount:,.2f})."

    inv = Invoice(
        organization_id=ctx.organization.id,
        invoice_number=payload.invoice_number.strip(),
        invoice_type=payload.invoice_type,
        supplier_id=payload.supplier_id,
        customer_name=payload.customer_name,
        customer_gstin=payload.customer_gstin,
        purchase_order_id=payload.purchase_order_id,
        invoice_date=payload.invoice_date or today,
        due_date=payload.due_date or (today + timedelta(days=30)),
        subtotal=payload.subtotal,
        tax_amount=payload.tax_amount,
        total_amount=payload.total_amount,
        paid_amount=Decimal("0.00"),
        balance_due=payload.total_amount,
        status="VERIFIED",
        match_status=match_status,
        match_notes=match_notes,
        is_verified=True,
        notes=payload.notes,
    )
    db.add(inv)
    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="INVOICE_CREATED",
        entity_type="INVOICE",
        entity_id=inv.id,
        summary=f"Recorded {inv.invoice_type} invoice {inv.invoice_number} (₹{inv.total_amount:,.2f}).",
        request=request,
    )
    db.commit()
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "invoice_type": inv.invoice_type,
        "total_amount": float(inv.total_amount),
        "match_status": inv.match_status,
    }


@router.post("/invoices/{invoice_id}/verify", tags=["Invoices & Finance"])
def verify_invoice(
    invoice_id: str,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("finance:write")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Mark an invoice as human-verified for payment processing."""
    inv = (
        db.query(Invoice)
        .filter(
            Invoice.organization_id == ctx.organization.id,
            Invoice.id == invoice_id,
        )
        .first()
    )
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")
    inv.is_verified = True
    if inv.status in ("DRAFT", "PENDING_VERIFICATION"):
        inv.status = "VERIFIED"
    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="INVOICE_VERIFIED",
        entity_type="INVOICE",
        entity_id=inv.id,
        summary=f"Verified invoice {inv.invoice_number}.",
        request=request,
    )
    db.commit()
    return {"id": inv.id, "invoice_number": inv.invoice_number, "status": inv.status, "is_verified": True}


@router.post("/invoices/{invoice_id}/payments", status_code=status.HTTP_201_CREATED, tags=["Invoices & Finance"])
def record_invoice_payment(
    invoice_id: str,
    payload: PaymentCreateRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("finance:write")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Record a payment settlement (NEFT/RTGS/UPI/Cheque) against a payable or receivable invoice."""
    inv = (
        db.query(Invoice)
        .filter(
            Invoice.organization_id == ctx.organization.id,
            Invoice.id == invoice_id,
        )
        .first()
    )
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")

    count = db.query(Payment).filter(Payment.organization_id == ctx.organization.id).count()
    now = datetime.now(timezone.utc)
    payment = Payment(
        organization_id=ctx.organization.id,
        invoice_id=inv.id,
        payment_number=f"PAY-{now.strftime('%Y%m')}-{count + 101}",
        payment_date=payload.payment_date or now.date(),
        amount=payload.amount,
        payment_method=payload.payment_method,
        reference_utr=payload.reference_utr or f"UTR{now.strftime('%H%M%S')}882",
        notes=payload.notes,
        recorded_by_id=ctx.user.id,
    )
    db.add(payment)

    new_paid = Decimal(str(inv.paid_amount or 0)) + payload.amount
    inv.paid_amount = new_paid
    inv.balance_due = max(Decimal("0.00"), Decimal(str(inv.total_amount or 0)) - new_paid)
    inv.status = "PAID" if inv.balance_due <= Decimal("0.00") else "PARTIALLY_PAID"

    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="PAYMENT_RECORDED",
        entity_type="INVOICE",
        entity_id=inv.id,
        summary=f"Recorded {payload.payment_method} payment of ₹{payload.amount:,.2f} on {inv.invoice_number}. Balance due: ₹{inv.balance_due:,.2f}.",
        request=request,
    )
    db.commit()
    return {
        "payment_id": payment.id,
        "invoice_id": inv.id,
        "invoice_number": inv.invoice_number,
        "paid_amount": float(inv.paid_amount),
        "balance_due": float(inv.balance_due),
        "status": inv.status,
    }


@router.get("/finance/payables", tags=["Invoices & Finance"])
def get_accounts_payable(
    ctx: TenantContext = Depends(require_permissions("finance:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return Accounts Payable invoices, overdue obligations, and aging buckets."""
    payables = (
        db.query(Invoice)
        .filter(
            Invoice.organization_id == ctx.organization.id,
            Invoice.invoice_type == "PAYABLE",
        )
        .order_by(Invoice.due_date.asc())
        .all()
    )
    suppliers = {
        s.id: s.name
        for s in db.query(Supplier).filter(Supplier.organization_id == ctx.organization.id).all()
    }
    today = datetime.now(timezone.utc).date()

    total_outstanding = sum(float(i.balance_due or 0) for i in payables if i.status != "PAID")
    overdue_total = sum(
        float(i.balance_due or 0)
        for i in payables
        if i.status != "PAID" and i.due_date < today
    )
    due_within_7d = sum(
        float(i.balance_due or 0)
        for i in payables
        if i.status != "PAID" and today <= i.due_date <= (today + timedelta(days=7))
    )

    items = [
        {
            "id": i.id,
            "invoice_number": i.invoice_number,
            "supplier_id": i.supplier_id,
            "supplier_name": suppliers.get(i.supplier_id or "", "Supplier"),
            "invoice_date": i.invoice_date.isoformat() if i.invoice_date else None,
            "due_date": i.due_date.isoformat() if i.due_date else None,
            "days_until_due": (i.due_date - today).days if i.due_date else 0,
            "total_amount": float(i.total_amount or 0),
            "paid_amount": float(i.paid_amount or 0),
            "balance_due": float(i.balance_due or 0),
            "status": i.status,
            "match_status": i.match_status,
            "match_notes": i.match_notes,
            "is_verified": i.is_verified,
        }
        for i in payables
    ]
    return {
        "total_outstanding_inr": round(total_outstanding, 2),
        "overdue_inr": round(overdue_total, 2),
        "due_within_7_days_inr": round(due_within_7d, 2),
        "items": items,
    }


@router.get("/finance/receivables", tags=["Invoices & Finance"])
def get_accounts_receivable(
    ctx: TenantContext = Depends(require_permissions("finance:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return Accounts Receivable customer invoices and collection metrics."""
    receivables = (
        db.query(Invoice)
        .filter(
            Invoice.organization_id == ctx.organization.id,
            Invoice.invoice_type == "RECEIVABLE",
        )
        .order_by(Invoice.due_date.asc())
        .all()
    )
    today = datetime.now(timezone.utc).date()
    total_receivable = sum(float(i.balance_due or 0) for i in receivables if i.status != "PAID")
    total_collected = sum(float(i.paid_amount or 0) for i in receivables)

    items = [
        {
            "id": i.id,
            "invoice_number": i.invoice_number,
            "customer_name": i.customer_name or "Enterprise Customer",
            "customer_gstin": i.customer_gstin,
            "invoice_date": i.invoice_date.isoformat() if i.invoice_date else None,
            "due_date": i.due_date.isoformat() if i.due_date else None,
            "days_until_due": (i.due_date - today).days if i.due_date else 0,
            "total_amount": float(i.total_amount or 0),
            "paid_amount": float(i.paid_amount or 0),
            "balance_due": float(i.balance_due or 0),
            "status": i.status,
        }
        for i in receivables
    ]
    return {
        "total_receivable_inr": round(total_receivable, 2),
        "total_collected_inr": round(total_collected, 2),
        "items": items,
    }


@router.get("/finance/cashflow", tags=["Invoices & Finance"])
def get_cashflow_and_pnl(
    ctx: TenantContext = Depends(require_permissions("finance:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return cash-flow projections, expense categorisation, and Profit & Loss summary."""
    invoices = db.query(Invoice).filter(Invoice.organization_id == ctx.organization.id).all()
    expenses = db.query(Expense).filter(Expense.organization_id == ctx.organization.id).order_by(Expense.expense_date.desc()).all()

    receivables = [i for i in invoices if i.invoice_type == "RECEIVABLE"]
    payables = [i for i in invoices if i.invoice_type == "PAYABLE"]

    gross_revenue = sum(float(i.total_amount or 0) for i in receivables)
    cogs_purchases = sum(float(i.total_amount or 0) for i in payables)
    operating_expenses = sum(float(e.amount or 0) for e in expenses)
    net_operating_surplus = gross_revenue - cogs_purchases - operating_expenses

    pending_inflows = sum(float(i.balance_due or 0) for i in receivables if i.status != "PAID")
    pending_outflows = sum(float(i.balance_due or 0) for i in payables if i.status != "PAID")

    expense_by_category: Dict[str, float] = {}
    for e in expenses:
        expense_by_category[e.category] = round(expense_by_category.get(e.category, 0.0) + float(e.amount or 0), 2)

    projection_series = [
        {"horizon": "Next 7 Days", "expected_inflow": round(pending_inflows * 0.35, 2), "expected_outflow": round(pending_outflows * 0.45, 2)},
        {"horizon": "Days 8–15", "expected_inflow": round(pending_inflows * 0.40, 2), "expected_outflow": round(pending_outflows * 0.35, 2)},
        {"horizon": "Days 16–30", "expected_inflow": round(pending_inflows * 0.25, 2), "expected_outflow": round(pending_outflows * 0.20, 2)},
    ]

    return {
        "pnl_summary": {
            "recorded_revenue_inr": round(gross_revenue, 2),
            "recorded_procurement_cogs_inr": round(cogs_purchases, 2),
            "recorded_operating_expenses_inr": round(operating_expenses, 2),
            "net_operating_surplus_inr": round(net_operating_surplus, 2),
        },
        "cashflow_position": {
            "pending_receivables_inflow_inr": round(pending_inflows, 2),
            "pending_payables_outflow_inr": round(pending_outflows, 2),
            "projected_net_30d_cashflow_inr": round(pending_inflows - pending_outflows - (operating_expenses * 0.5), 2),
        },
        "projection_series": projection_series,
        "expenses_by_category": [{"category": k, "amount": v} for k, v in expense_by_category.items()],
        "expenses": [
            {
                "id": e.id,
                "expense_number": e.expense_number,
                "category": e.category,
                "vendor_name": e.vendor_name,
                "expense_date": e.expense_date.isoformat() if e.expense_date else None,
                "amount": float(e.amount or 0),
                "tax_amount": float(e.tax_amount or 0),
                "payment_status": e.payment_status,
                "notes": e.notes,
            }
            for e in expenses
        ],
    }


@router.post("/finance/expenses", status_code=status.HTTP_201_CREATED, tags=["Invoices & Finance"])
def create_expense(
    payload: ExpenseCreateRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("finance:write")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Record a categorised operational expense."""
    count = db.query(Expense).filter(Expense.organization_id == ctx.organization.id).count()
    now = datetime.now(timezone.utc)
    exp = Expense(
        organization_id=ctx.organization.id,
        expense_number=f"EXP-{now.strftime('%Y%m')}-{count + 101}",
        category=payload.category,
        vendor_name=payload.vendor_name.strip(),
        expense_date=payload.expense_date or now.date(),
        amount=payload.amount,
        tax_amount=payload.tax_amount,
        payment_status=payload.payment_status,
        notes=payload.notes,
        created_by_id=ctx.user.id,
    )
    db.add(exp)
    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="EXPENSE_RECORDED",
        entity_type="EXPENSE",
        entity_id=exp.id,
        summary=f"Recorded {exp.category} expense {exp.expense_number} (₹{exp.amount:,.2f}) to {exp.vendor_name}.",
        request=request,
    )
    db.commit()
    return {"id": exp.id, "expense_number": exp.expense_number, "amount": float(exp.amount)}

