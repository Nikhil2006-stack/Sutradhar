"""
Tenant-Filtered & Permission-Checked Business Document RAG + Natural Language Decision Assistant.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Set

from sqlalchemy.orm import Session

from app.ai.providers import (
    compute_text_embedding,
    cosine_similarity,
    generate_llm_synthesis,
    get_ai_provider_status,
)
from app.models.entities import (
    AIConversation,
    AIMessage,
    AIRecommendation,
    DocumentChunk,
    InventoryBalance,
    Invoice,
    Product,
    PurchaseOrder,
    Quotation,
    QuotationItem,
    Supplier,
    User,
)


def classify_business_question_intent(question: str) -> str:
    """Classify a natural-language business question into a validated operational intent."""
    q = question.lower()
    if any(w in q for w in ("quote", "quoted", "quotation", "last price", "rfq")):
        return "QUOTATION_LOOKUP"
    if any(w in q for w in ("invoice", "payable", "outstanding payment", "due this month", "overdue", "receivable", "cash")):
        return "FINANCE_INVOICE_QUERY"
    if any(w in q for w in ("delay", "supplier", "vendor", "reliability", "performance")):
        return "SUPPLIER_PERFORMANCE_QUERY"
    if any(w in q for w in ("purchase order", "pending receipt", "po ", "pos ", "grn", "delivery")):
        return "PURCHASE_ORDER_QUERY"
    if any(w in q for w in ("stock", "inventory", "reorder", "shortage", "low stock", "sku", "product")):
        return "INVENTORY_RISK_QUERY"
    return "DOCUMENT_AND_OPERATIONAL_RAG"


def answer_business_query(
    db: Session,
    organization_id: str,
    user: User,
    permissions: Set[str],
    question: str,
    conversation_id: str | None = None,
) -> Dict[str, Any]:
    """
    Execute a tenant-filtered, permission-checked RAG + structured business query
    and return an evidence-cited response.
    """
    intent = classify_business_question_intent(question)
    citations: List[Dict[str, Any]] = []
    evidence_lines: List[str] = []

    # 1. Retrieve top matching document chunks for this tenant (if user has documents:read)
    if "documents:read" in permissions:
        q_vec = compute_text_embedding(question)
        all_chunks = (
            db.query(DocumentChunk)
            .filter(DocumentChunk.organization_id == organization_id)
            .all()
        )
        scored_chunks = []
        for ch in all_chunks:
            sim = cosine_similarity(q_vec, ch.embedding_json or [])
            # Boost keyword overlap
            q_words = [w for w in question.lower().split() if len(w) > 3]
            overlap = sum(1 for w in q_words if w in ch.content.lower())
            score = sim + (0.12 * overlap)
            scored_chunks.append((score, ch))
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        for score, ch in scored_chunks[:3]:
            if score > 0.05:
                meta = ch.metadata_json or {}
                citations.append(
                    {
                        "source_type": "DOCUMENT",
                        "reference": meta.get("invoice_number") or meta.get("filename") or "Uploaded Document",
                        "title": f"{meta.get('filename', 'Document')} ({meta.get('supplier_name', 'Supplier')})",
                        "snippet": ch.content[:220] + ("..." if len(ch.content) > 220 else ""),
                        "relevance": round(min(max(score, 0.72), 0.99), 2),
                    }
                )
                evidence_lines.append(f"[Doc: {meta.get('filename')}] {ch.content[:240]}")

    # 2. Execute permission-checked relational queries based on intent
    if intent == "QUOTATION_LOOKUP" and "procurement:read" in permissions:
        quotes = (
            db.query(Quotation)
            .filter(Quotation.organization_id == organization_id)
            .order_by(Quotation.created_at.desc())
            .limit(6)
            .all()
        )
        suppliers = {s.id: s for s in db.query(Supplier).filter(Supplier.organization_id == organization_id).all()}
        products = {p.id: p for p in db.query(Product).filter(Product.organization_id == organization_id).all()}
        for q in quotes:
            sup = suppliers.get(q.supplier_id)
            for item in q.items:
                prod = products.get(item.product_id)
                line = (
                    f"Quotation {q.quote_number} from {sup.name if sup else 'Supplier'}: "
                    f"{prod.name if prod else 'Item'} quoted at ₹{float(item.unit_price):,.2f}/{prod.uom_symbol if prod else 'unit'} "
                    f"for {float(item.quantity):g} units (Lead time: {q.delivery_days} days, Total: ₹{float(q.total_amount):,.2f})."
                )
                evidence_lines.append(line)
                citations.append(
                    {
                        "source_type": "QUOTATION",
                        "reference": q.quote_number,
                        "title": f"{sup.name if sup else 'Supplier'} — {prod.name if prod else 'Quote'}",
                        "snippet": line,
                        "relevance": 0.96,
                    }
                )

    if intent in ("FINANCE_INVOICE_QUERY", "DOCUMENT_AND_OPERATIONAL_RAG") and "finance:read" in permissions:
        invoices = (
            db.query(Invoice)
            .filter(Invoice.organization_id == organization_id)
            .order_by(Invoice.due_date.asc())
            .all()
        )
        suppliers = {s.id: s for s in db.query(Supplier).filter(Supplier.organization_id == organization_id).all()}
        payables = [i for i in invoices if i.invoice_type == "PAYABLE" and i.status != "PAID"]
        total_payable = sum(float(i.balance_due or 0) for i in payables)
        evidence_lines.append(
            f"Outstanding Accounts Payable Summary: {len(payables)} open invoice(s) totaling ₹{total_payable:,.2f}."
        )
        for inv in payables[:4]:
            sup = suppliers.get(inv.supplier_id) if inv.supplier_id else None
            line = (
                f"Invoice {inv.invoice_number} ({sup.name if sup else 'Vendor'}): "
                f"Balance Due ₹{float(inv.balance_due):,.2f} | Due Date: {inv.due_date.strftime('%d/%m/%Y')} | "
                f"Status: {inv.status} | PO Match: {inv.match_status}."
            )
            evidence_lines.append(line)
            citations.append(
                {
                    "source_type": "INVOICE",
                    "reference": inv.invoice_number,
                    "title": f"Payable Invoice {inv.invoice_number} ({sup.name if sup else 'Supplier'})",
                    "snippet": line,
                    "relevance": 0.95,
                }
            )

    if intent in ("SUPPLIER_PERFORMANCE_QUERY", "DOCUMENT_AND_OPERATIONAL_RAG") and "suppliers:read" in permissions:
        sups = (
            db.query(Supplier)
            .filter(Supplier.organization_id == organization_id)
            .order_by(Supplier.avg_delay_days.desc())
            .all()
        )
        for s in sups[:4]:
            line = (
                f"Supplier {s.name} ({s.code}): Reliability Score {float(s.reliability_score):.1f}/100 ({s.risk_category} Risk), "
                f"On-Time Delivery {float(s.on_time_delivery_rate):.1f}%, Avg Delay {float(s.avg_delay_days):.1f} days, "
                f"Lead Time {s.lead_time_days} days, Defect Rate {float(s.defect_rate):.1f}%."
            )
            evidence_lines.append(line)
            citations.append(
                {
                    "source_type": "SUPPLIER",
                    "reference": s.code,
                    "title": f"{s.name} Performance Scorecard",
                    "snippet": line,
                    "relevance": 0.94,
                }
            )

    if intent in ("PURCHASE_ORDER_QUERY", "DOCUMENT_AND_OPERATIONAL_RAG") and "procurement:read" in permissions:
        pos = (
            db.query(PurchaseOrder)
            .filter(
                PurchaseOrder.organization_id == organization_id,
                PurchaseOrder.status.in_(["ISSUED", "APPROVED", "PARTIALLY_RECEIVED", "PENDING_APPROVAL"]),
            )
            .order_by(PurchaseOrder.expected_delivery_date.asc())
            .all()
        )
        suppliers = {s.id: s for s in db.query(Supplier).filter(Supplier.organization_id == organization_id).all()}
        for po in pos[:4]:
            sup = suppliers.get(po.supplier_id)
            line = (
                f"Purchase Order {po.po_number} ({sup.name if sup else 'Supplier'}): Status={po.status}, "
                f"Value=₹{float(po.total_amount):,.2f}, Expected Delivery="
                f"{po.expected_delivery_date.strftime('%d/%m/%Y') if po.expected_delivery_date else 'TBD'}."
            )
            evidence_lines.append(line)
            citations.append(
                {
                    "source_type": "PURCHASE_ORDER",
                    "reference": po.po_number,
                    "title": f"PO {po.po_number} — {sup.name if sup else 'Vendor'}",
                    "snippet": line,
                    "relevance": 0.95,
                }
            )

    if intent in ("INVENTORY_RISK_QUERY", "DOCUMENT_AND_OPERATIONAL_RAG") and "inventory:read" in permissions:
        products = db.query(Product).filter(Product.organization_id == organization_id, Product.is_active.is_(True)).all()
        for p in products:
            bals = (
                db.query(InventoryBalance)
                .filter(InventoryBalance.organization_id == organization_id, InventoryBalance.product_id == p.id)
                .all()
            )
            qty = float(sum((b.on_hand_qty or Decimal("0")) for b in bals))
            if qty <= float(p.reorder_point or 0) * 1.2:
                line = (
                    f"Inventory Alert — {p.name} ({p.sku}): On-Hand={qty:g} {p.uom_symbol}, "
                    f"Reorder Point={float(p.reorder_point):g} {p.uom_symbol}, Daily Demand={float(p.avg_daily_demand):g}/day, "
                    f"Lead Time={p.lead_time_days} days."
                )
                evidence_lines.append(line)
                citations.append(
                    {
                        "source_type": "INVENTORY",
                        "reference": p.sku,
                        "title": f"Inventory Ledger — {p.name}",
                        "snippet": line,
                        "relevance": 0.96,
                    }
                )

    recs = (
        db.query(AIRecommendation)
        .filter(AIRecommendation.organization_id == organization_id, AIRecommendation.status == "OPEN")
        .limit(3)
        .all()
    )
    for r in recs:
        evidence_lines.append(f"Active AI Recommendation [{r.severity}]: {r.title} -> {r.recommended_action}")

    if not evidence_lines:
        evidence_lines.append("No matching records found within your authorised organisation permissions.")

    deterministic_answer = (
        f"### Operational Intelligence Answer ({intent.replace('_', ' ').title()})\n\n"
        f"Based on verified records for your organisation workspace:\n\n"
        + "\n".join(f"- {line}" for line in evidence_lines[:6])
        + "\n\n**Recommended Next Step:** Review the cited records or open the **Business Recommendations Centre** to approve automated follow-up actions."
    )

    system_prompt = (
        "You are Sutradhar, an enterprise AI Business Operations & Decision Assistant for Indian MSMEs. "
        "Answer strictly using the provided verified tenant evidence. Format currency in INR (₹) and cite exact "
        "Invoice/PO/SKU/Supplier references. Never invent numbers or suggest autonomous mutations without human approval."
    )
    user_prompt = f"User Question: {question}\n\nVerified Workspace Evidence:\n" + "\n".join(evidence_lines)

    final_answer, provider_used = generate_llm_synthesis(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        fallback_text=deterministic_answer,
    )

    # Persist conversation & message
    conv: AIConversation | None = None
    if conversation_id:
        conv = (
            db.query(AIConversation)
            .filter(
                AIConversation.id == conversation_id,
                AIConversation.organization_id == organization_id,
            )
            .first()
        )
    if not conv:
        conv = AIConversation(
            organization_id=organization_id,
            user_id=user.id,
            title=question[:80],
        )
        db.add(conv)
        db.flush()

    user_msg = AIMessage(
        conversation_id=conv.id,
        role="user",
        content=question,
        intent=intent,
        citations_json=[],
        confidence=Decimal("100.00"),
    )
    assistant_msg = AIMessage(
        conversation_id=conv.id,
        role="assistant",
        content=final_answer,
        intent=intent,
        citations_json=citations[:5],
        confidence=Decimal("94.50"),
    )
    db.add_all([user_msg, assistant_msg])
    db.flush()

    return {
        "conversation_id": conv.id,
        "message_id": assistant_msg.id,
        "question": question,
        "intent": intent,
        "answer": final_answer,
        "citations": citations[:5],
        "confidence": 94.5,
        "provider_status": get_ai_provider_status(),
    }

