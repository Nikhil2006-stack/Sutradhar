"""
Comprehensive Backend Integration, RBAC, Multi-Tenant Isolation, Ledger & AI Test Suite for Sutradhar.
"""

from __future__ import annotations

import io
import os
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Use isolated test SQLite database
TEST_DB_PATH = Path(__file__).resolve().parent / "test_sutradhar.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"

from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except Exception:
            pass
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    engine.dispose()
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except Exception:
            pass


def test_health_and_bootstrapped_demo_login(client: TestClient) -> None:
    """Verify health endpoint and default Indian MSME demo workspace login."""
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "ai_engine" in data

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "arjun.mehta@sutradhar.ai", "password": "Sutradhar@123"},
    )
    assert login_resp.status_code == 200
    auth_data = login_resp.json()
    assert "access_token" in auth_data
    assert "refresh_token" in auth_data
    assert len(auth_data["organizations"]) >= 2

    # Refresh token rotation
    ref_resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": auth_data["refresh_token"]},
    )
    assert ref_resp.status_code == 200
    assert "access_token" in ref_resp.json()


def test_registration_and_multi_tenant_isolation(client: TestClient) -> None:
    """Verify that Tenant A cannot access Tenant B's organisation or data."""
    unique_email = f"founder.{uuid.uuid4().hex[:6]}@krishnaforge.in"
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Karan Kulkarni",
            "email": unique_email,
            "password": "StrongPassword@123",
            "organization_name": "Krishna Forge & Castings Pvt Ltd",
            "industry": "Forging & Machining",
            "city": "Kolhapur",
            "state": "Maharashtra",
            "seed_demo_data": False,
        },
    )
    assert reg_resp.status_code == 201
    tenant_b = reg_resp.json()
    token_b = tenant_b["access_token"]
    org_b_id = tenant_b["active_organization"]["organization_id"]

    # Login as Tenant A (Arjun Mehta)
    login_a = client.post(
        "/api/v1/auth/login",
        json={"email": "arjun.mehta@sutradhar.ai", "password": "Sutradhar@123"},
    ).json()
    token_a = login_a["access_token"]
    org_a_id = login_a["active_organization"]["organization_id"]

    # Tenant B tries to access Tenant A's workspace via X-Organization-Id header -> MUST 403
    cross_tenant_resp = client.get(
        "/api/v1/products",
        headers={
            "Authorization": f"Bearer {token_b}",
            "X-Organization-Id": org_a_id,
        },
    )
    assert cross_tenant_resp.status_code == 403

    # Tenant B's own clean workspace has 0 products initially
    own_products_resp = client.get(
        "/api/v1/products",
        headers={
            "Authorization": f"Bearer {token_b}",
            "X-Organization-Id": org_b_id,
        },
    )
    assert own_products_resp.status_code == 200
    assert own_products_resp.json()["total"] == 0

    # Tenant A's workspace has its 5 seeded products
    a_products_resp = client.get(
        "/api/v1/products",
        headers={"Authorization": f"Bearer {token_a}", "X-Organization-Id": org_a_id},
    )
    assert a_products_resp.status_code == 200
    assert a_products_resp.json()["total"] >= 5


def test_rbac_permission_enforcement(client: TestClient) -> None:
    """Verify that AUDITOR (read-only) role can read data but is blocked from mutating inventory or approving POs."""
    auditor_login = client.post(
        "/api/v1/auth/login",
        json={"email": "meera.iyer@sutradhar.demo", "password": "Sutradhar@123"},
    )
    assert auditor_login.status_code == 200
    auditor_token = auditor_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {auditor_token}"}

    # Read products -> 200 OK
    read_resp = client.get("/api/v1/products", headers=headers)
    assert read_resp.status_code == 200

    # Read audit logs -> 200 OK
    audit_resp = client.get("/api/v1/audit-logs", headers=headers)
    assert audit_resp.status_code == 200

    # Attempt to create product -> 403 Forbidden
    write_resp = client.post(
        "/api/v1/products",
        headers=headers,
        json={
            "sku": "UNAUTH-SKU-01",
            "name": "Unauthorized Item",
            "unit_cost": 100,
            "selling_price": 150,
        },
    )
    assert write_resp.status_code == 403


def test_inventory_ledger_and_negative_stock_prevention(client: TestClient) -> None:
    """Verify product creation, stock movement ledger updates, and negative stock protection."""
    login_a = client.post(
        "/api/v1/auth/login",
        json={"email": "arjun.mehta@sutradhar.ai", "password": "Sutradhar@123"},
    ).json()
    headers = {"Authorization": f"Bearer {login_a['access_token']}"}

    wh_resp = client.get("/api/v1/warehouses", headers=headers)
    assert wh_resp.status_code == 200
    wh_id = wh_resp.json()["items"][0]["id"]

    sku_code = f"SKU-TEST-{uuid.uuid4().hex[:4].upper()}"
    prod_resp = client.post(
        "/api/v1/products",
        headers=headers,
        json={
            "sku": sku_code,
            "name": "Hydraulic Solenoid Valve 24V DC",
            "category_name": "Industrial Valves & Actuators",
            "uom_symbol": "PCS",
            "unit_cost": 1850,
            "selling_price": 2600,
            "reorder_point": 30,
            "safety_stock": 10,
            "lead_time_days": 7,
            "avg_daily_demand": 4,
            "initial_stock": 25,
            "warehouse_id": wh_id,
        },
    )
    assert prod_resp.status_code == 201
    prod_id = prod_resp.json()["id"]

    # Attempt OUT movement larger than available stock (25) -> 400 Bad Request
    over_out = client.post(
        "/api/v1/inventory/movements",
        headers=headers,
        json={
            "product_id": prod_id,
            "warehouse_id": wh_id,
            "movement_type": "OUT",
            "quantity": 100,
            "notes": "Excess dispatch test",
        },
    )
    assert over_out.status_code == 400

    # Valid OUT movement of 5 units -> balance becomes 20
    valid_out = client.post(
        "/api/v1/inventory/movements",
        headers=headers,
        json={
            "product_id": prod_id,
            "warehouse_id": wh_id,
            "movement_type": "OUT",
            "quantity": 5,
            "notes": "Assembly line issue",
        },
    )
    assert valid_out.status_code == 201
    assert valid_out.json()["balance_after"] == 20.0


def test_document_intelligence_and_human_verification(client: TestClient) -> None:
    """Verify invoice upload, OCR/field extraction, duplicate check, and human verification."""
    login_a = client.post(
        "/api/v1/auth/login",
        json={"email": "arjun.mehta@sutradhar.ai", "password": "Sutradhar@123"},
    ).json()
    headers = {"Authorization": f"Bearer {login_a['access_token']}"}

    invoice_content = (
        "TAX INVOICE\n"
        "Supplier: Shree Ganesh Steels & Alloys Pvt. Ltd.\n"
        "GSTIN: 27AABCS1429B1Z1\n"
        "Invoice No: INV-TEST-2026-555\n"
        "PO Number: PO-202611-501\n"
        "Subtotal: INR 122,500.00\n"
        "Total GST: INR 22,050.00\n"
        "Grand Total: INR 144,550.00\n"
    ).encode("utf-8")

    upload_resp = client.post(
        "/api/v1/documents/upload",
        headers=headers,
        files={"file": ("INV-TEST-2026-555.txt", io.BytesIO(invoice_content), "text/plain")},
        data={"doc_type": "INVOICE"},
    )
    assert upload_resp.status_code == 201
    up_data = upload_resp.json()
    doc_id = up_data["id"]
    assert up_data["extraction"]["invoice_number"] == "INV-TEST-2026-555"
    assert up_data["extraction"]["total_amount"] == 144550.0
    assert up_data["extraction"]["is_verified"] is False

    # Human verification creates verified Payable Invoice and matches PO
    verify_resp = client.post(
        f"/api/v1/documents/{doc_id}/verify",
        headers=headers,
        json={
            "invoice_number": "INV-TEST-2026-555",
            "supplier_name": "Shree Ganesh Steels & Alloys Pvt. Ltd.",
            "supplier_gstin": "27AABCS1429B1Z1",
            "po_reference": "PO-202611-501",
            "subtotal": 122500.0,
            "tax_amount": 22050.0,
            "total_amount": 144550.0,
            "create_payable_invoice": True,
        },
    )
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()
    assert v_data["is_verified"] is True
    assert v_data["match_status"] == "MATCHED"


def test_signature_action_engine_and_rag_assistant(client: TestClient) -> None:
    """Verify the Signature Business Intelligence & Action Engine and RAG assistant."""
    login_a = client.post(
        "/api/v1/auth/login",
        json={"email": "arjun.mehta@sutradhar.ai", "password": "Sutradhar@123"},
    ).json()
    headers = {"Authorization": f"Bearer {login_a['access_token']}"}

    recs_resp = client.get("/api/v1/ai/recommendations", headers=headers)
    assert recs_resp.status_code == 200
    recs = recs_resp.json()["items"]
    assert len(recs) >= 5

    # Verify Product A stockout scenario (12 units remaining, 10/day demand, 8-day lead time)
    stockout_recs = [r for r in recs if r["category"] == "STOCKOUT_RISK" and "Product A" in (r["product_name"] or "")]
    assert len(stockout_recs) >= 1
    prod_a_rec = stockout_recs[0]
    assert prod_a_rec["current_stock"] == 12.0
    assert prod_a_rec["avg_daily_demand"] == 10.0
    assert prod_a_rec["lead_time_days"] == 8

    # Approve and execute the Product A recommendation -> creates a real Purchase Request
    approve_resp = client.post(
        f"/api/v1/ai/recommendations/{prod_a_rec['id']}/approve",
        headers=headers,
        json={"helpful": True, "notes": "Approved emergency replenishment for Product A"},
    )
    assert approve_resp.status_code == 200
    exec_data = approve_resp.json()
    assert exec_data["status"] == "APPROVED_AND_EXECUTED"
    assert exec_data["executed_entity_type"] == "PURCHASE_REQUEST"

    # Query RAG Business Decision Assistant
    ask_resp = client.post(
        "/api/v1/ai/ask",
        headers=headers,
        json={"question": "What was the last price quoted by Shree Ganesh Steels and which supplier has the highest delivery delays?"},
    )
    assert ask_resp.status_code == 200
    ask_data = ask_resp.json()
    assert len(ask_data["answer"]) > 30
    assert len(ask_data["citations"]) >= 1

