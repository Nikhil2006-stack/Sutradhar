"""Measurable, explainable Supplier Risk & Reliability Scoring Engine."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models.entities import GoodsReceipt, PurchaseOrder, Quotation, Supplier


def compute_supplier_reliability(supplier: Supplier) -> Dict[str, Any]:
    """
    Calculate measurable supplier performance score (0-100) and risk category
    without LLM hallucination.
    """
    on_time = float(supplier.on_time_delivery_rate or Decimal("90.0"))
    avg_delay = float(supplier.avg_delay_days or Decimal("1.0"))
    defect_rate = float(supplier.defect_rate or Decimal("1.0"))
    cancellation_rate = float(supplier.cancellation_rate or Decimal("0.5"))
    discrepancy_rate = float(supplier.discrepancy_rate or Decimal("1.0"))
    price_volatility = float(supplier.price_volatility_score or Decimal("5.0"))

    delay_score = max(0.0, 100.0 - (avg_delay * 12.0))
    quality_score = max(0.0, 100.0 - (defect_rate * 8.0) - (discrepancy_rate * 4.0))
    stability_score = max(0.0, 100.0 - (price_volatility * 4.0) - (cancellation_rate * 6.0))

    reliability_score = round(
        (0.35 * on_time) + (0.25 * delay_score) + (0.25 * quality_score) + (0.15 * stability_score),
        2,
    )
    reliability_score = max(0.0, min(100.0, reliability_score))

    if reliability_score >= 80.0 and avg_delay <= 2.0:
        risk_category = "LOW"
    elif reliability_score >= 62.0:
        risk_category = "MEDIUM"
    else:
        risk_category = "HIGH"

    risk_factors: List[str] = []
    if on_time < 80.0:
        risk_factors.append(f"Low on-time delivery rate ({on_time:.1f}%)")
    if avg_delay > 2.5:
        risk_factors.append(f"High average delivery delay ({avg_delay:.1f} days beyond promised lead time)")
    if defect_rate > 3.0:
        risk_factors.append(f"Elevated quality defect rate ({defect_rate:.1f}% in GRN inspections)")
    if price_volatility > 10.0:
        risk_factors.append(f"High quotation price fluctuation ({price_volatility:.1f}% variance)")
    if discrepancy_rate > 3.0:
        risk_factors.append(f"Recurring PO-to-Invoice billing discrepancies ({discrepancy_rate:.1f}%)")
    if not risk_factors:
        risk_factors.append("Consistent delivery adherence and stable pricing within contracted tolerances.")

    return {
        "supplier_id": supplier.id,
        "supplier_code": supplier.code,
        "supplier_name": supplier.name,
        "lead_time_days": supplier.lead_time_days,
        "on_time_delivery_rate": round(on_time, 2),
        "avg_delay_days": round(avg_delay, 2),
        "defect_rate": round(defect_rate, 2),
        "cancellation_rate": round(cancellation_rate, 2),
        "discrepancy_rate": round(discrepancy_rate, 2),
        "price_volatility_score": round(price_volatility, 2),
        "reliability_score": reliability_score,
        "risk_category": risk_category,
        "component_scores": {
            "on_time_score": round(on_time, 2),
            "delay_resilience_score": round(delay_score, 2),
            "quality_compliance_score": round(quality_score, 2),
            "price_stability_score": round(stability_score, 2),
        },
        "explainable_factors": risk_factors,
    }


def get_supplier_performance_detail(db: Session, organization_id: str, supplier: Supplier) -> Dict[str, Any]:
    """Return full supplier reliability scorecard + historical POs, GRNs, and quotations."""
    scorecard = compute_supplier_reliability(supplier)
    pos = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.organization_id == organization_id,
            PurchaseOrder.supplier_id == supplier.id,
        )
        .order_by(PurchaseOrder.order_date.desc())
        .limit(10)
        .all()
    )
    grns = (
        db.query(GoodsReceipt)
        .filter(
            GoodsReceipt.organization_id == organization_id,
            GoodsReceipt.supplier_id == supplier.id,
        )
        .order_by(GoodsReceipt.received_date.desc())
        .limit(10)
        .all()
    )
    quotes = (
        db.query(Quotation)
        .filter(
            Quotation.organization_id == organization_id,
            Quotation.supplier_id == supplier.id,
        )
        .order_by(Quotation.created_at.desc())
        .limit(10)
        .all()
    )

    scorecard["total_purchase_orders"] = len(pos)
    scorecard["total_spend_inr"] = float(sum((po.total_amount or Decimal("0")) for po in pos))
    scorecard["recent_purchase_orders"] = [
        {
            "id": po.id,
            "po_number": po.po_number,
            "status": po.status,
            "order_date": po.order_date.isoformat() if po.order_date else None,
            "expected_delivery_date": po.expected_delivery_date.isoformat() if po.expected_delivery_date else None,
            "total_amount": float(po.total_amount or 0),
        }
        for po in pos
    ]
    scorecard["recent_goods_receipts"] = [
        {
            "id": g.id,
            "grn_number": g.grn_number,
            "received_date": g.received_date.isoformat() if g.received_date else None,
            "status": g.status,
        }
        for g in grns
    ]
    scorecard["recent_quotations"] = [
        {
            "id": q.id,
            "quote_number": q.quote_number,
            "delivery_days": q.delivery_days,
            "total_amount": float(q.total_amount or 0),
            "status": q.status,
        }
        for q in quotes
    ]
    return scorecard

