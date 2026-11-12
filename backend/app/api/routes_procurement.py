"""Suppliers, Procurement, Approvals, RFQs, Quotations & Goods Receiving API routes."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.ai.supplier_risk import (
    compute_supplier_reliability,
    get_supplier_performance_detail,
)
from app.api.deps import TenantContext, record_audit_log, require_permissions
from app.core.database import get_db
from app.models.entities import (
    RFQ,
    Approval,
    GoodsReceipt,
    GoodsReceiptItem,
    InventoryBalance,
    InventoryBatch,
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseRequest,
    PurchaseRequestItem,
    Quotation,
    QuotationItem,
    StockMovement,
    Supplier,
    SupplierContact,
    SupplierDocument,
    Warehouse,
)
from app.schemas.api_schemas import (
    ApprovalDecisionRequest,
    GoodsReceiptCreateRequest,
    PurchaseOrderCreate,
    PurchaseRequestCreate,
    QuotationCreateRequest,
    RFQCreateRequest,
    SupplierCreateRequest,
)

router = APIRouter()


# =============================================================================
# SUPPLIERS & SUPPLIER PERFORMANCE
# =============================================================================


@router.get("/suppliers", tags=["Suppliers"])
def list_suppliers(
    search: Optional[str] = Query(default=None),
    risk_category: Optional[str] = Query(default=None),
    ctx: TenantContext = Depends(require_permissions("suppliers:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """List organisation suppliers with live reliability scores and risk categories."""
    q = db.query(Supplier).filter(
        Supplier.organization_id == ctx.organization.id,
        Supplier.is_active.is_(True),
    )
    if search:
        s = f"%{search.strip()}%"
        q = q.filter((Supplier.name.ilike(s)) | (Supplier.code.ilike(s)) | (Supplier.gstin.ilike(s)))
    if risk_category:
        q = q.filter(Supplier.risk_category == risk_category)

    suppliers = q.order_by(Supplier.reliability_score.desc()).all()
    items = []
    for sup in suppliers:
        scorecard = compute_supplier_reliability(sup)
        contacts = (
            db.query(SupplierContact)
            .filter(SupplierContact.supplier_id == sup.id)
            .all()
        )
        items.append(
            {
                "id": sup.id,
                "code": sup.code,
                "name": sup.name,
                "category": sup.category,
                "gstin": sup.gstin,
                "pan": sup.pan,
                "email": sup.email,
                "phone": sup.phone,
                "city": sup.city,
                "state": sup.state,
                "address": sup.address,
                "payment_terms_days": sup.payment_terms_days,
                "lead_time_days": sup.lead_time_days,
                "on_time_delivery_rate": scorecard["on_time_delivery_rate"],
                "avg_delay_days": scorecard["avg_delay_days"],
                "defect_rate": scorecard["defect_rate"],
                "price_volatility_score": scorecard["price_volatility_score"],
                "reliability_score": scorecard["reliability_score"],
                "risk_category": scorecard["risk_category"],
                "explainable_factors": scorecard["explainable_factors"],
                "primary_contact": contacts[0].name if contacts else None,
            }
        )
    return {"items": items, "total": len(items)}


@router.post("/suppliers", status_code=status.HTTP_201_CREATED, tags=["Suppliers"])
def create_supplier(
    payload: SupplierCreateRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("suppliers:write")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Onboard a new supplier into the organisation directory."""
    count = db.query(Supplier).filter(Supplier.organization_id == ctx.organization.id).count()
    code = (payload.code or f"SUP-{count + 1:03d}").strip().upper()
    if (
        db.query(Supplier)
        .filter(Supplier.organization_id == ctx.organization.id, Supplier.code == code)
        .first()
    ):
        code = f"SUP-{count + 101:03d}"

    supplier = Supplier(
        organization_id=ctx.organization.id,
        code=code,
        name=payload.name.strip(),
        category=payload.category,
        gstin=payload.gstin,
        pan=payload.pan,
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        city=payload.city,
        state=payload.state,
        payment_terms_days=payload.payment_terms_days,
        lead_time_days=payload.lead_time_days,
        reliability_score=Decimal("88.00"),
        risk_category="LOW",
        notes=payload.notes,
    )
    db.add(supplier)
    db.flush()

    if payload.contact_name:
        db.add(
            SupplierContact(
                organization_id=ctx.organization.id,
                supplier_id=supplier.id,
                name=payload.contact_name,
                designation=payload.contact_designation or "Account Manager",
                email=payload.email,
                phone=payload.phone,
                is_primary=True,
            )
        )

    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="SUPPLIER_ONBOARDED",
        entity_type="SUPPLIER",
        entity_id=supplier.id,
        summary=f"Onboarded supplier {supplier.code} ({supplier.name}).",
        request=request,
    )
    db.commit()

    return {
        "id": supplier.id,
        "code": supplier.code,
        "name": supplier.name,
        "gstin": supplier.gstin,
        "reliability_score": float(supplier.reliability_score),
        "risk_category": supplier.risk_category,
    }


@router.get("/suppliers/{supplier_id}", tags=["Suppliers"])
def get_supplier_detail(
    supplier_id: str,
    ctx: TenantContext = Depends(require_permissions("suppliers:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve complete supplier profile, contacts, compliance documents, and scorecard."""
    supplier = (
        db.query(Supplier)
        .filter(
            Supplier.organization_id == ctx.organization.id,
            Supplier.id == supplier_id,
        )
        .first()
    )
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found.")

    perf = get_supplier_performance_detail(db, ctx.organization.id, supplier)
    docs = (
        db.query(SupplierDocument)
        .filter(
            SupplierDocument.organization_id == ctx.organization.id,
            SupplierDocument.supplier_id == supplier.id,
        )
        .all()
    )
    return {
        "id": supplier.id,
        "code": supplier.code,
        "name": supplier.name,
        "category": supplier.category,
        "gstin": supplier.gstin,
        "pan": supplier.pan,
        "email": supplier.email,
        "phone": supplier.phone,
        "address": supplier.address,
        "city": supplier.city,
        "state": supplier.state,
        "payment_terms_days": supplier.payment_terms_days,
        "lead_time_days": supplier.lead_time_days,
        "contacts": [
            {
                "id": c.id,
                "name": c.name,
                "designation": c.designation,
                "email": c.email,
                "phone": c.phone,
                "is_primary": c.is_primary,
            }
            for c in supplier.contacts
        ],
        "documents": [
            {
                "id": d.id,
                "doc_type": d.doc_type,
                "title": d.title,
                "expiry_date": d.expiry_date.isoformat() if d.expiry_date else None,
                "status": d.status,
            }
            for d in docs
        ],
        "performance": perf,
    }


@router.get("/suppliers/{supplier_id}/performance", tags=["Suppliers"])
def get_supplier_performance(
    supplier_id: str,
    ctx: TenantContext = Depends(require_permissions("suppliers:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return measurable, explainable supplier reliability analytics."""
    supplier = (
        db.query(Supplier)
        .filter(
            Supplier.organization_id == ctx.organization.id,
            Supplier.id == supplier_id,
        )
        .first()
    )
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found.")
    return get_supplier_performance_detail(db, ctx.organization.id, supplier)


# =============================================================================
# PURCHASE REQUESTS & PURCHASE ORDERS
# =============================================================================


@router.get("/purchase-requests", tags=["Procurement"])
def list_purchase_requests(
    ctx: TenantContext = Depends(require_permissions("procurement:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """List organisation purchase requests and line items."""
    prs = (
        db.query(PurchaseRequest)
        .filter(PurchaseRequest.organization_id == ctx.organization.id)
        .order_by(PurchaseRequest.created_at.desc())
        .all()
    )
    products = {
        p.id: p
        for p in db.query(Product).filter(Product.organization_id == ctx.organization.id).all()
    }
    items = []
    for pr in prs:
        items.append(
            {
                "id": pr.id,
                "pr_number": pr.pr_number,
                "title": pr.title,
                "priority": pr.priority,
                "status": pr.status,
                "required_by_date": pr.required_by_date.isoformat() if pr.required_by_date else None,
                "total_estimated_amount": float(pr.total_estimated_amount or 0),
                "notes": pr.notes,
                "created_at": pr.created_at.isoformat() if pr.created_at else None,
                "items": [
                    {
                        "id": it.id,
                        "product_id": it.product_id,
                        "product_name": products[it.product_id].name if it.product_id in products else "SKU",
                        "sku": products[it.product_id].sku if it.product_id in products else "SKU",
                        "quantity": float(it.quantity),
                        "estimated_unit_price": float(it.estimated_unit_price or 0),
                    }
                    for it in pr.items
                ],
            }
        )
    return {"items": items, "total": len(items)}


@router.post("/purchase-requests", status_code=status.HTTP_201_CREATED, tags=["Procurement"])
def create_purchase_request(
    payload: PurchaseRequestCreate,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("procurement:write")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Create a Purchase Request and automatically trigger a multi-level approval workflow item."""
    count = (
        db.query(PurchaseRequest)
        .filter(PurchaseRequest.organization_id == ctx.organization.id)
        .count()
    )
    now = datetime.now(timezone.utc)
    pr_number = f"PR-{now.strftime('%Y%m')}-{count + 101}"

    products = {
        p.id: p
        for p in db.query(Product).filter(Product.organization_id == ctx.organization.id).all()
    }
    total_est = Decimal("0.00")
    pr = PurchaseRequest(
        organization_id=ctx.organization.id,
        pr_number=pr_number,
        title=payload.title.strip(),
        warehouse_id=payload.warehouse_id,
        requested_by_id=ctx.user.id,
        priority=payload.priority,
        status="PENDING_APPROVAL",
        required_by_date=payload.required_by_date or (now + timedelta(days=7)).date(),
        notes=payload.notes,
    )
    db.add(pr)
    db.flush()

    for item_in in payload.items:
        prod = products.get(item_in.product_id)
        unit_price = (
            item_in.estimated_unit_price
            if item_in.estimated_unit_price is not None
            else (prod.unit_cost if prod else Decimal("0.00"))
        )
        line_val = (item_in.quantity * Decimal(str(unit_price))).quantize(Decimal("0.01"))
        total_est += line_val
        db.add(
            PurchaseRequestItem(
                purchase_request_id=pr.id,
                product_id=item_in.product_id,
                quantity=item_in.quantity,
                estimated_unit_price=unit_price,
                notes=item_in.notes,
            )
        )

    pr.total_estimated_amount = total_est
    db.add(
        Approval(
            organization_id=ctx.organization.id,
            entity_type="PURCHASE_REQUEST",
            entity_id=pr.id,
            reference_number=pr.pr_number,
            title=pr.title,
            amount=total_est,
            level=1,
            status="PENDING",
            requested_by_id=ctx.user.id,
        )
    )
    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="PURCHASE_REQUEST_CREATED",
        entity_type="PURCHASE_REQUEST",
        entity_id=pr.id,
        summary=f"Created Purchase Request {pr.pr_number} (Estimated ₹{total_est:,.2f}).",
        request=request,
    )
    db.commit()

    return {
        "id": pr.id,
        "pr_number": pr.pr_number,
        "title": pr.title,
        "status": pr.status,
        "total_estimated_amount": float(pr.total_estimated_amount),
    }


@router.get("/purchase-orders", tags=["Procurement"])
def list_purchase_orders(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    ctx: TenantContext = Depends(require_permissions("procurement:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """List purchase orders with supplier info and delivery status."""
    q = db.query(PurchaseOrder).filter(PurchaseOrder.organization_id == ctx.organization.id)
    if status_filter:
        q = q.filter(PurchaseOrder.status == status_filter)
    pos = q.order_by(PurchaseOrder.created_at.desc()).all()

    suppliers = {
        s.id: s
        for s in db.query(Supplier).filter(Supplier.organization_id == ctx.organization.id).all()
    }
    products = {
        p.id: p
        for p in db.query(Product).filter(Product.organization_id == ctx.organization.id).all()
    }
    today = datetime.now(timezone.utc).date()

    items = []
    for po in pos:
        sup = suppliers.get(po.supplier_id)
        is_overdue = bool(
            po.expected_delivery_date
            and po.expected_delivery_date < today
            and po.status not in ("RECEIVED", "CANCELLED")
        )
        items.append(
            {
                "id": po.id,
                "po_number": po.po_number,
                "supplier_id": po.supplier_id,
                "supplier_name": sup.name if sup else "Vendor",
                "supplier_gstin": sup.gstin if sup else None,
                "status": po.status,
                "is_overdue": is_overdue,
                "order_date": po.order_date.isoformat() if po.order_date else None,
                "expected_delivery_date": po.expected_delivery_date.isoformat() if po.expected_delivery_date else None,
                "actual_delivery_date": po.actual_delivery_date.isoformat() if po.actual_delivery_date else None,
                "subtotal": float(po.subtotal or 0),
                "tax_amount": float(po.tax_amount or 0),
                "total_amount": float(po.total_amount or 0),
                "payment_terms_days": po.payment_terms_days,
                "notes": po.notes,
                "items": [
                    {
                        "id": it.id,
                        "product_id": it.product_id,
                        "product_name": products[it.product_id].name if it.product_id in products else "SKU",
                        "sku": products[it.product_id].sku if it.product_id in products else "SKU",
                        "ordered_qty": float(it.ordered_qty),
                        "received_qty": float(it.received_qty or 0),
                        "unit_price": float(it.unit_price),
                        "tax_rate": float(it.tax_rate),
                        "line_total": float(it.line_total),
                    }
                    for it in po.items
                ],
            }
        )
    return {"items": items, "total": len(items)}


@router.post("/purchase-orders", status_code=status.HTTP_201_CREATED, tags=["Procurement"])
def create_purchase_order(
    payload: PurchaseOrderCreate,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("procurement:write")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Generate a new Purchase Order and create approval workflow entry if above threshold."""
    supplier = (
        db.query(Supplier)
        .filter(
            Supplier.organization_id == ctx.organization.id,
            Supplier.id == payload.supplier_id,
        )
        .first()
    )
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found.")

    count = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.organization_id == ctx.organization.id)
        .count()
    )
    now = datetime.now(timezone.utc)
    po_number = f"PO-{now.strftime('%Y%m')}-{count + 501}"

    subtotal = Decimal("0.00")
    tax_total = Decimal("0.00")

    po = PurchaseOrder(
        organization_id=ctx.organization.id,
        po_number=po_number,
        supplier_id=supplier.id,
        warehouse_id=payload.warehouse_id,
        purchase_request_id=payload.purchase_request_id,
        quotation_id=payload.quotation_id,
        status="ISSUED",
        order_date=now.date(),
        expected_delivery_date=payload.expected_delivery_date
        or (now + timedelta(days=int(supplier.lead_time_days or 7))).date(),
        payment_terms_days=payload.payment_terms_days,
        notes=payload.notes,
        created_by_id=ctx.user.id,
    )
    db.add(po)
    db.flush()

    for item in payload.items:
        base = (item.ordered_qty * item.unit_price).quantize(Decimal("0.01"))
        tax = (base * (item.tax_rate / Decimal("100.0"))).quantize(Decimal("0.01"))
        line_total = base + tax
        subtotal += base
        tax_total += tax
        db.add(
            PurchaseOrderItem(
                purchase_order_id=po.id,
                product_id=item.product_id,
                ordered_qty=item.ordered_qty,
                received_qty=Decimal("0.00"),
                unit_price=item.unit_price,
                tax_rate=item.tax_rate,
                line_total=line_total,
            )
        )

    po.subtotal = subtotal
    po.tax_amount = tax_total
    po.total_amount = subtotal + tax_total

    if po.total_amount >= Decimal("50000.00"):
        po.status = "PENDING_APPROVAL"
        db.add(
            Approval(
                organization_id=ctx.organization.id,
                entity_type="PURCHASE_ORDER",
                entity_id=po.id,
                reference_number=po.po_number,
                title=f"Approve Purchase Order {po.po_number} ({supplier.name})",
                amount=po.total_amount,
                level=1,
                status="PENDING",
                requested_by_id=ctx.user.id,
            )
        )

    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="PURCHASE_ORDER_CREATED",
        entity_type="PURCHASE_ORDER",
        entity_id=po.id,
        summary=f"Created Purchase Order {po.po_number} to {supplier.name} for ₹{po.total_amount:,.2f}.",
        request=request,
    )
    db.commit()

    return {
        "id": po.id,
        "po_number": po.po_number,
        "supplier_name": supplier.name,
        "status": po.status,
        "total_amount": float(po.total_amount),
    }


@router.get("/purchase-orders/{po_id}", tags=["Procurement"])
def get_purchase_order_detail(
    po_id: str,
    ctx: TenantContext = Depends(require_permissions("procurement:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Get detailed Purchase Order with items, GRNs, and supplier details."""
    po = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.organization_id == ctx.organization.id,
            PurchaseOrder.id == po_id,
        )
        .first()
    )
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase Order not found.")

    sup = db.query(Supplier).filter(Supplier.id == po.supplier_id).first()
    products = {
        p.id: p
        for p in db.query(Product).filter(Product.organization_id == ctx.organization.id).all()
    }
    return {
        "id": po.id,
        "po_number": po.po_number,
        "supplier_id": po.supplier_id,
        "supplier_name": sup.name if sup else "Vendor",
        "supplier_gstin": sup.gstin if sup else None,
        "status": po.status,
        "order_date": po.order_date.isoformat() if po.order_date else None,
        "expected_delivery_date": po.expected_delivery_date.isoformat() if po.expected_delivery_date else None,
        "subtotal": float(po.subtotal or 0),
        "tax_amount": float(po.tax_amount or 0),
        "total_amount": float(po.total_amount or 0),
        "notes": po.notes,
        "items": [
            {
                "id": it.id,
                "product_id": it.product_id,
                "product_name": products[it.product_id].name if it.product_id in products else "SKU",
                "ordered_qty": float(it.ordered_qty),
                "received_qty": float(it.received_qty or 0),
                "unit_price": float(it.unit_price),
                "tax_rate": float(it.tax_rate),
                "line_total": float(it.line_total),
            }
            for it in po.items
        ],
    }


# =============================================================================
# APPROVALS
# =============================================================================


@router.get("/approvals", tags=["Approvals"])
def list_approvals(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    ctx: TenantContext = Depends(require_permissions("procurement:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """List multi-level approval workflow requests."""
    q = db.query(Approval).filter(Approval.organization_id == ctx.organization.id)
    if status_filter:
        q = q.filter(Approval.status == status_filter)
    approvals = q.order_by(Approval.created_at.desc()).all()
    items = [
        {
            "id": a.id,
            "entity_type": a.entity_type,
            "entity_id": a.entity_id,
            "reference_number": a.reference_number,
            "title": a.title,
            "amount": float(a.amount or 0),
            "level": a.level,
            "status": a.status,
            "comments": a.comments,
            "decided_at": a.decided_at.isoformat() if a.decided_at else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in approvals
    ]
    return {"items": items, "total": len(items)}


@router.post("/approvals/{approval_id}/approve", tags=["Approvals"])
def approve_workflow_item(
    approval_id: str,
    payload: ApprovalDecisionRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("procurement:approve")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Approve a pending Purchase Request, Purchase Order, or Stock Adjustment."""
    approval = (
        db.query(Approval)
        .filter(
            Approval.organization_id == ctx.organization.id,
            Approval.id == approval_id,
        )
        .first()
    )
    if not approval:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval record not found.")

    approval.status = "APPROVED"
    approval.approver_id = ctx.user.id
    approval.comments = payload.comments or "Approved via Sutradhar Approval Centre"
    approval.decided_at = datetime.now(timezone.utc)

    if approval.entity_type == "PURCHASE_REQUEST":
        pr = db.query(PurchaseRequest).filter(PurchaseRequest.id == approval.entity_id).first()
        if pr:
            pr.status = "APPROVED"
    elif approval.entity_type == "PURCHASE_ORDER":
        po = db.query(PurchaseOrder).filter(PurchaseOrder.id == approval.entity_id).first()
        if po:
            po.status = "ISSUED"
            po.approved_by_id = ctx.user.id

    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="APPROVAL_GRANTED",
        entity_type=approval.entity_type,
        entity_id=approval.entity_id,
        summary=f"Approved {approval.reference_number} (₹{approval.amount:,.2f}).",
        request=request,
    )
    db.commit()
    return {"id": approval.id, "status": approval.status, "reference_number": approval.reference_number}


@router.post("/approvals/{approval_id}/reject", tags=["Approvals"])
def reject_workflow_item(
    approval_id: str,
    payload: ApprovalDecisionRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("procurement:approve")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Reject a pending approval workflow request."""
    approval = (
        db.query(Approval)
        .filter(
            Approval.organization_id == ctx.organization.id,
            Approval.id == approval_id,
        )
        .first()
    )
    if not approval:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval record not found.")

    approval.status = "REJECTED"
    approval.approver_id = ctx.user.id
    approval.comments = payload.comments or "Rejected"
    approval.decided_at = datetime.now(timezone.utc)

    if approval.entity_type == "PURCHASE_REQUEST":
        pr = db.query(PurchaseRequest).filter(PurchaseRequest.id == approval.entity_id).first()
        if pr:
            pr.status = "REJECTED"
    elif approval.entity_type == "PURCHASE_ORDER":
        po = db.query(PurchaseOrder).filter(PurchaseOrder.id == approval.entity_id).first()
        if po:
            po.status = "CANCELLED"

    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="APPROVAL_REJECTED",
        entity_type=approval.entity_type,
        entity_id=approval.entity_id,
        summary=f"Rejected {approval.reference_number}.",
        request=request,
    )
    db.commit()
    return {"id": approval.id, "status": approval.status, "reference_number": approval.reference_number}


# =============================================================================
# RFQS, QUOTATIONS & COMPARISON
# =============================================================================


@router.get("/rfqs", tags=["Quotations & RFQs"])
def list_rfqs(
    ctx: TenantContext = Depends(require_permissions("procurement:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """List Requests for Quotation (RFQs)."""
    rfqs = (
        db.query(RFQ)
        .filter(RFQ.organization_id == ctx.organization.id)
        .order_by(RFQ.created_at.desc())
        .all()
    )
    products = {
        p.id: p
        for p in db.query(Product).filter(Product.organization_id == ctx.organization.id).all()
    }
    items = []
    for r in rfqs:
        prod = products.get(r.product_id or "")
        quote_count = db.query(Quotation).filter(Quotation.rfq_id == r.id).count()
        items.append(
            {
                "id": r.id,
                "rfq_number": r.rfq_number,
                "title": r.title,
                "product_id": r.product_id,
                "product_name": prod.name if prod else "Multiple Items",
                "required_qty": float(r.required_qty or 0),
                "status": r.status,
                "deadline_date": r.deadline_date.isoformat() if r.deadline_date else None,
                "quotations_count": quote_count,
                "notes": r.notes,
            }
        )
    return {"items": items, "total": len(items)}


@router.post("/rfqs", status_code=status.HTTP_201_CREATED, tags=["Quotations & RFQs"])
def create_rfq(
    payload: RFQCreateRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("procurement:write")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Create a new Request for Quotation (RFQ)."""
    count = db.query(RFQ).filter(RFQ.organization_id == ctx.organization.id).count()
    now = datetime.now(timezone.utc)
    rfq = RFQ(
        organization_id=ctx.organization.id,
        rfq_number=f"RFQ-{now.strftime('%Y%m')}-{count + 1:02d}",
        title=payload.title.strip(),
        product_id=payload.product_id,
        required_qty=payload.required_qty,
        purchase_request_id=payload.purchase_request_id,
        deadline_date=payload.deadline_date or (now + timedelta(days=5)).date(),
        status="OPEN",
        notes=payload.notes,
    )
    db.add(rfq)
    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="RFQ_CREATED",
        entity_type="RFQ",
        entity_id=rfq.id,
        summary=f"Created RFQ {rfq.rfq_number} ({rfq.title}).",
        request=request,
    )
    db.commit()
    return {"id": rfq.id, "rfq_number": rfq.rfq_number, "title": rfq.title, "status": rfq.status}


@router.post("/quotations", status_code=status.HTTP_201_CREATED, tags=["Quotations & RFQs"])
def create_quotation(
    payload: QuotationCreateRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("procurement:write")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Record a supplier quotation against an RFQ or product."""
    count = db.query(Quotation).filter(Quotation.organization_id == ctx.organization.id).count()
    subtotal = (payload.quantity * payload.unit_price).quantize(Decimal("0.01"))
    tax = (subtotal * (payload.tax_rate / Decimal("100.0"))).quantize(Decimal("0.01"))
    total = subtotal + tax

    quote = Quotation(
        organization_id=ctx.organization.id,
        rfq_id=payload.rfq_id,
        supplier_id=payload.supplier_id,
        quote_number=f"QT-{count + 801}",
        status="SUBMITTED",
        delivery_days=payload.delivery_days,
        payment_terms_days=payload.payment_terms_days,
        subtotal=subtotal,
        tax_amount=tax,
        total_amount=total,
        validity_date=payload.validity_date or (datetime.now(timezone.utc) + timedelta(days=15)).date(),
        notes=payload.notes,
    )
    db.add(quote)
    db.flush()

    db.add(
        QuotationItem(
            quotation_id=quote.id,
            product_id=payload.product_id,
            quantity=payload.quantity,
            unit_price=payload.unit_price,
            tax_rate=payload.tax_rate,
            promised_lead_time_days=payload.delivery_days,
        )
    )
    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="QUOTATION_RECORDED",
        entity_type="QUOTATION",
        entity_id=quote.id,
        summary=f"Recorded supplier quotation {quote.quote_number} (₹{total:,.2f}).",
        request=request,
    )
    db.commit()
    return {"id": quote.id, "quote_number": quote.quote_number, "total_amount": float(total)}


@router.get("/quotations/compare", tags=["Quotations & RFQs"])
def compare_quotations(
    rfq_id: Optional[str] = Query(default=None),
    ctx: TenantContext = Depends(require_permissions("procurement:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Side-by-side supplier quotation comparison scoring price, delivery lead time,
    payment terms, and supplier reliability score.
    """
    q = db.query(Quotation).filter(Quotation.organization_id == ctx.organization.id)
    if rfq_id:
        q = q.filter(Quotation.rfq_id == rfq_id)
    quotes = q.order_by(Quotation.total_amount.asc()).all()

    suppliers = {
        s.id: s
        for s in db.query(Supplier).filter(Supplier.organization_id == ctx.organization.id).all()
    }
    products = {
        p.id: p
        for p in db.query(Product).filter(Product.organization_id == ctx.organization.id).all()
    }

    min_total = min((float(qt.total_amount or 1) for qt in quotes), default=1.0)
    comparisons = []
    for qt in quotes:
        sup = suppliers.get(qt.supplier_id)
        item = qt.items[0] if qt.items else None
        prod = products.get(item.product_id) if item else None
        total = float(qt.total_amount or 0)
        rel_score = float(sup.reliability_score) if sup else 80.0
        price_competitiveness = round((min_total / max(total, 1.0)) * 100.0, 1)
        delivery_score = max(0.0, 100.0 - (qt.delivery_days * 4.0))
        composite_value_score = round(
            (0.45 * price_competitiveness) + (0.35 * rel_score) + (0.20 * delivery_score), 1
        )

        comparisons.append(
            {
                "quotation_id": qt.id,
                "quote_number": qt.quote_number,
                "rfq_id": qt.rfq_id,
                "supplier_id": qt.supplier_id,
                "supplier_name": sup.name if sup else "Vendor",
                "supplier_reliability_score": rel_score,
                "supplier_risk_category": sup.risk_category if sup else "LOW",
                "product_id": prod.id if prod else None,
                "product_name": prod.name if prod else "Quoted Item",
                "sku": prod.sku if prod else "SKU",
                "quantity": float(item.quantity) if item else 100.0,
                "unit_price": float(item.unit_price) if item else 0.0,
                "benchmark_unit_cost": float(prod.unit_cost) if prod else 0.0,
                "subtotal": float(qt.subtotal or 0),
                "tax_amount": float(qt.tax_amount or 0),
                "total_amount": total,
                "delivery_days": qt.delivery_days,
                "payment_terms_days": qt.payment_terms_days,
                "composite_value_score": composite_value_score,
                "is_recommended": False,
                "notes": qt.notes,
            }
        )

    if comparisons:
        best = max(comparisons, key=lambda c: c["composite_value_score"])
        best["is_recommended"] = True

    return {"items": comparisons, "total": len(comparisons)}


# =============================================================================
# GOODS RECEIVING NOTES (GRN)
# =============================================================================


@router.get("/goods-receipts", tags=["Goods Receiving"])
def list_goods_receipts(
    ctx: TenantContext = Depends(require_permissions("procurement:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """List Goods Receipt Notes (GRNs)."""
    grns = (
        db.query(GoodsReceipt)
        .filter(GoodsReceipt.organization_id == ctx.organization.id)
        .order_by(GoodsReceipt.created_at.desc())
        .all()
    )
    pos = {
        p.id: p.po_number
        for p in db.query(PurchaseOrder).filter(PurchaseOrder.organization_id == ctx.organization.id).all()
    }
    suppliers = {
        s.id: s.name
        for s in db.query(Supplier).filter(Supplier.organization_id == ctx.organization.id).all()
    }
    warehouses = {
        w.id: w.name
        for w in db.query(Warehouse).filter(Warehouse.organization_id == ctx.organization.id).all()
    }
    products = {
        p.id: p.name
        for p in db.query(Product).filter(Product.organization_id == ctx.organization.id).all()
    }

    items = [
        {
            "id": g.id,
            "grn_number": g.grn_number,
            "purchase_order_id": g.purchase_order_id,
            "po_number": pos.get(g.purchase_order_id, "PO"),
            "supplier_name": suppliers.get(g.supplier_id, "Supplier"),
            "warehouse_name": warehouses.get(g.warehouse_id, "Warehouse"),
            "received_date": g.received_date.isoformat() if g.received_date else None,
            "supplier_challan_no": g.supplier_challan_no,
            "status": g.status,
            "notes": g.notes,
            "items": [
                {
                    "id": it.id,
                    "product_id": it.product_id,
                    "product_name": products.get(it.product_id, "Product"),
                    "received_qty": float(it.received_qty),
                    "accepted_qty": float(it.accepted_qty),
                    "rejected_qty": float(it.rejected_qty),
                    "batch_number": it.batch_number,
                }
                for it in g.items
            ],
        }
        for g in grns
    ]
    return {"items": items, "total": len(items)}


@router.post("/goods-receipts", status_code=status.HTTP_201_CREATED, tags=["Goods Receiving"])
def create_goods_receipt(
    payload: GoodsReceiptCreateRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("procurement:write")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Create a Goods Receipt Note (GRN) against a Purchase Order, update PO received quantities,
    and automatically post verified stock-in movements to the warehouse inventory ledger.
    """
    po = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.organization_id == ctx.organization.id,
            PurchaseOrder.id == payload.purchase_order_id,
        )
        .first()
    )
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase Order not found.")

    wh_id = payload.warehouse_id or po.warehouse_id
    if not wh_id:
        primary_wh = (
            db.query(Warehouse)
            .filter(Warehouse.organization_id == ctx.organization.id)
            .order_by(Warehouse.is_primary.desc())
            .first()
        )
        wh_id = primary_wh.id if primary_wh else ""

    count = db.query(GoodsReceipt).filter(GoodsReceipt.organization_id == ctx.organization.id).count()
    now = datetime.now(timezone.utc)
    grn_number = f"GRN-{now.strftime('%Y%m')}-{count + 101}"

    has_discrepancy = any(it.rejected_qty > 0 for it in payload.items)
    grn = GoodsReceipt(
        organization_id=ctx.organization.id,
        grn_number=grn_number,
        purchase_order_id=po.id,
        supplier_id=po.supplier_id,
        warehouse_id=wh_id,
        received_by_id=ctx.user.id,
        received_date=now.date(),
        supplier_challan_no=payload.supplier_challan_no or f"DC-{count + 500}",
        status="DISCREPANCY" if has_discrepancy else "VERIFIED",
        notes=payload.notes,
    )
    db.add(grn)
    db.flush()

    for item in payload.items:
        db.add(
            GoodsReceiptItem(
                goods_receipt_id=grn.id,
                product_id=item.product_id,
                ordered_qty=item.ordered_qty,
                received_qty=item.received_qty,
                accepted_qty=item.accepted_qty,
                rejected_qty=item.rejected_qty,
                batch_number=item.batch_number,
                expiry_date=item.expiry_date,
                remarks=item.remarks,
            )
        )
        # Update PO line item received_qty
        for po_it in po.items:
            if po_it.product_id == item.product_id:
                po_it.received_qty = Decimal(str(po_it.received_qty or 0)) + item.accepted_qty

        # Post atomic stock-in ledger movement for accepted_qty
        if item.accepted_qty > 0:
            bal = (
                db.query(InventoryBalance)
                .filter(
                    InventoryBalance.organization_id == ctx.organization.id,
                    InventoryBalance.product_id == item.product_id,
                    InventoryBalance.warehouse_id == wh_id,
                )
                .first()
            )
            if not bal:
                bal = InventoryBalance(
                    organization_id=ctx.organization.id,
                    product_id=item.product_id,
                    warehouse_id=wh_id,
                    on_hand_qty=Decimal("0.00"),
                    reserved_qty=Decimal("0.00"),
                    available_qty=Decimal("0.00"),
                )
                db.add(bal)
                db.flush()

            new_qty = Decimal(str(bal.on_hand_qty or 0)) + item.accepted_qty
            bal.on_hand_qty = new_qty
            bal.available_qty = new_qty - Decimal(str(bal.reserved_qty or 0))
            bal.last_movement_at = now

            prod = db.query(Product).filter(Product.id == item.product_id).first()
            db.add(
                StockMovement(
                    organization_id=ctx.organization.id,
                    product_id=item.product_id,
                    warehouse_id=wh_id,
                    movement_type="GRN_RECEIPT",
                    quantity=item.accepted_qty,
                    unit_cost=prod.unit_cost if prod else Decimal("0.00"),
                    balance_after=new_qty,
                    reference_type="GRN",
                    reference_id=grn.grn_number,
                    batch_number=item.batch_number,
                    expiry_date=item.expiry_date,
                    notes=f"Goods Receipt {grn.grn_number} against {po.po_number}",
                    status="APPROVED",
                    created_by_id=ctx.user.id,
                    approved_by_id=ctx.user.id,
                )
            )
            if item.batch_number:
                db.add(
                    InventoryBatch(
                        organization_id=ctx.organization.id,
                        product_id=item.product_id,
                        warehouse_id=wh_id,
                        batch_number=item.batch_number,
                        manufacturing_date=now.date(),
                        expiry_date=item.expiry_date,
                        quantity=item.accepted_qty,
                        unit_cost=prod.unit_cost if prod else Decimal("0.00"),
                    )
                )

    po.status = "RECEIVED"
    po.actual_delivery_date = now.date()

    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="GOODS_RECEIPT_RECORDED",
        entity_type="GOODS_RECEIPT",
        entity_id=grn.id,
        summary=f"Recorded Goods Receipt {grn.grn_number} for {po.po_number} and updated stock balances.",
        request=request,
    )
    db.commit()

    return {
        "id": grn.id,
        "grn_number": grn.grn_number,
        "po_number": po.po_number,
        "status": grn.status,
    }

