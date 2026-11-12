"""
Realistic Indian MSME operational data seeding and multi-tenant bootstrap service.
Clearly labels demonstration data and supports both empty and seeded workspaces.
"""

from __future__ import annotations

import hashlib
import os
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Dict

from sqlalchemy.orm import Session

from app.ai.action_engine import generate_business_recommendations
from app.ai.document_intelligence import process_document_pipeline
from app.core.config import get_settings
from app.core.permissions import ALL_PERMISSIONS, ROLE_DEFINITIONS
from app.core.security import hash_password
from app.models.entities import (
    RFQ,
    Approval,
    AuditLog,
    Category,
    Document,
    Expense,
    GoodsReceipt,
    GoodsReceiptItem,
    InventoryBalance,
    InventoryBatch,
    Invoice,
    InvoiceItem,
    Membership,
    Notification,
    NotificationPreference,
    Organization,
    OrganizationSettings,
    Payment,
    Permission,
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseRequest,
    PurchaseRequestItem,
    Quotation,
    QuotationItem,
    Role,
    StockMovement,
    Supplier,
    SupplierContact,
    SupplierDocument,
    TaskItem,
    UnitOfMeasure,
    User,
    Warehouse,
    WorkflowRule,
    WorkflowRun,
)


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    return slug or "workspace"


def ensure_system_roles_and_permissions(db: Session) -> Dict[str, Role]:
    """Ensure all granular permissions and the 6 system RBAC roles exist."""
    perm_map: Dict[str, Permission] = {}
    for code, (module, desc) in ALL_PERMISSIONS.items():
        perm = db.query(Permission).filter(Permission.code == code).first()
        if not perm:
            perm = Permission(code=code, module=module, description=desc)
            db.add(perm)
            db.flush()
        perm_map[code] = perm

    role_map: Dict[str, Role] = {}
    for r_def in ROLE_DEFINITIONS:
        code = str(r_def["code"])
        role = db.query(Role).filter(Role.code == code, Role.organization_id.is_(None)).first()
        if not role:
            role = Role(
                organization_id=None,
                code=code,
                name=str(r_def["name"]),
                description=str(r_def["description"]),
                is_system=True,
            )
            role.permissions = [perm_map[p] for p in r_def["permissions"] if p in perm_map]  # type: ignore[index]
            db.add(role)
            db.flush()
        role_map[code] = role

    return role_map


def bootstrap_organization_defaults(db: Session, org: Organization) -> None:
    """Create default settings, units of measure, categories, and primary warehouse for an organisation."""
    existing_settings = (
        db.query(OrganizationSettings).filter(OrganizationSettings.organization_id == org.id).first()
    )
    if not existing_settings:
        db.add(
            OrganizationSettings(
                organization_id=org.id,
                default_tax_rate=Decimal("18.00"),
                date_format="DD/MM/YYYY",
                timezone="Asia/Kolkata",
                fiscal_year_start_month=4,
                po_approval_threshold=Decimal("50000.00"),
                low_stock_alerts_enabled=True,
                duplicate_invoice_check_enabled=True,
                document_retention_days=2555,
            )
        )

    uoms = [
        ("Pieces / Units", "PCS"),
        ("Kilograms", "KG"),
        ("Metres", "MTR"),
        ("Litres", "LTR"),
        ("Corrugated Boxes", "BOX"),
        ("Metric Tonnes", "TON"),
    ]
    for name, sym in uoms:
        exists = (
            db.query(UnitOfMeasure)
            .filter(UnitOfMeasure.organization_id == org.id, UnitOfMeasure.symbol == sym)
            .first()
        )
        if not exists:
            db.add(UnitOfMeasure(organization_id=org.id, name=name, symbol=sym))

    cats = [
        ("CAT-VALVES", "Industrial Valves & Actuators", "High-pressure ball, gate, and butterfly valves"),
        ("CAT-FAST", "Precision Fasteners & Bearings", "SS304/316 bolts, nuts, and industrial bearings"),
        ("CAT-ELEC", "Control Panels & Drives", "VFDs, PLC relays, and switchgear assemblies"),
        ("CAT-PACK", "Industrial Packaging", "Export pallets, stretch films, and VCI bags"),
    ]
    for code, name, desc in cats:
        exists = (
            db.query(Category)
            .filter(Category.organization_id == org.id, Category.code == code)
            .first()
        )
        if not exists:
            db.add(Category(organization_id=org.id, code=code, name=name, description=desc))

    wh_exists = db.query(Warehouse).filter(Warehouse.organization_id == org.id).first()
    if not wh_exists:
        db.add(
            Warehouse(
                organization_id=org.id,
                code="WH-PUN-01",
                name="Chakan MIDC Central Hub (Pune)",
                city=org.city or "Pune",
                state=org.state or "Maharashtra",
                address="Plot B-42, Phase II, Chakan Industrial Area, Pune 410501",
                manager_name="Rajesh Kulkarni",
                capacity_units=25000,
                is_primary=True,
            )
        )
    db.flush()


def seed_organization_operational_data(db: Session, org: Organization, owner_user: User) -> None:
    """
    Populate realistic, interconnected Indian MSME manufacturing & wholesale data
    for demonstration and end-to-end verification.
    """
    if db.query(Product).filter(Product.organization_id == org.id).count() > 0:
        return

    bootstrap_organization_defaults(db, org)
    role_map = ensure_system_roles_and_permissions(db)
    today = datetime.now(timezone.utc).date()

    # Additional warehouses
    wh_pune = db.query(Warehouse).filter(Warehouse.organization_id == org.id, Warehouse.is_primary.is_(True)).first()
    wh_bhiwandi = Warehouse(
        organization_id=org.id,
        code="WH-MUM-02",
        name="Bhiwandi Logistics Fulfillment Centre",
        city="Thane / Mumbai",
        state="Maharashtra",
        address="NH-3, Dapoda Road, Bhiwandi, Thane 421302",
        manager_name="Sandeep Deshmukh",
        capacity_units=18000,
        is_primary=False,
    )
    wh_ahmedabad = Warehouse(
        organization_id=org.id,
        code="WH-AMD-03",
        name="Sanand GIDC Regional Depot",
        city="Ahmedabad",
        state="Gujarat",
        address="Sector 4, Sanand GIDC Estate, Ahmedabad 382110",
        manager_name="Kiran Patel",
        capacity_units=12000,
        is_primary=False,
    )
    db.add_all([wh_bhiwandi, wh_ahmedabad])
    db.flush()

    # Additional team members across roles
    team_specs = [
        ("priya.sharma@sutradhar.demo", "Priya Sharma", "OPERATIONS_MANAGER", "Operations", "+91 98201 44120"),
        ("amit.verma@sutradhar.demo", "Amit Verma", "FINANCE_MANAGER", "Finance & Accounts", "+91 98202 55310"),
        ("vikram.joshi@sutradhar.demo", "Vikram Joshi", "PROCUREMENT_OFFICER", "Procurement", "+91 98203 66400"),
        ("ramesh.patil@sutradhar.demo", "Ramesh Patil", "WAREHOUSE_EMPLOYEE", "Warehouse & Stores", "+91 98204 77890"),
        ("meera.iyer@sutradhar.demo", "Meera Iyer (CA Auditor)", "AUDITOR", "Internal Audit", "+91 98205 88900"),
    ]
    for email, fname, r_code, dept, phone in team_specs:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                email=email,
                full_name=fname,
                phone=phone,
                job_title=dept,
                hashed_password=hash_password("Sutradhar@123"),
                is_active=True,
            )
            db.add(u)
            db.flush()
        existing_mem = (
            db.query(Membership)
            .filter(Membership.user_id == u.id, Membership.organization_id == org.id)
            .first()
        )
        if not existing_mem:
            db.add(
                Membership(
                    user_id=u.id,
                    organization_id=org.id,
                    role_id=role_map[r_code].id,
                    department=dept,
                    status="ACTIVE",
                    is_default=True,
                )
            )

    # Suppliers with realistic Indian GSTINs and reliability profiles
    sup1 = Supplier(
        organization_id=org.id,
        code="SUP-001",
        name="Shree Ganesh Steels & Alloys Pvt. Ltd.",
        category="Precision Forgings & Valves",
        gstin="27AABCS1429B1Z1",
        pan="AABCS1429B",
        email="orders@ganeshsteels.in",
        phone="+91 20 2712 8840",
        city="Pune",
        state="Maharashtra",
        address="Plot 19, Bhosari MIDC, Pune 411026",
        payment_terms_days=30,
        lead_time_days=8,
        on_time_delivery_rate=Decimal("94.50"),
        avg_delay_days=Decimal("0.50"),
        defect_rate=Decimal("0.80"),
        cancellation_rate=Decimal("0.20"),
        discrepancy_rate=Decimal("0.50"),
        price_volatility_score=Decimal("3.80"),
        reliability_score=Decimal("92.40"),
        risk_category="LOW",
    )
    sup2 = Supplier(
        organization_id=org.id,
        code="SUP-002",
        name="Western India Industrial Fasteners Co.",
        category="Fasteners & Bearings",
        gstin="24AAACW3921F1Z8",
        pan="AAACW3921F",
        email="sales@wifasteners.co.in",
        phone="+91 79 2583 4190",
        city="Rajkot",
        state="Gujarat",
        address="Gondal Road Industrial Zone, Rajkot 360004",
        payment_terms_days=45,
        lead_time_days=6,
        on_time_delivery_rate=Decimal("85.00"),
        avg_delay_days=Decimal("1.80"),
        defect_rate=Decimal("1.90"),
        cancellation_rate=Decimal("1.00"),
        discrepancy_rate=Decimal("1.50"),
        price_volatility_score=Decimal("7.50"),
        reliability_score=Decimal("79.20"),
        risk_category="MEDIUM",
    )
    sup3 = Supplier(
        organization_id=org.id,
        code="SUP-003",
        name="Apex Electro-Controls & Switchgear LLP",
        category="Control Panels & Drives",
        gstin="27AADFA8812K1Z4",
        pan="AADFA8812K",
        email="dispatch@apexelectro.in",
        phone="+91 22 4091 3321",
        city="Mumbai",
        state="Maharashtra",
        address="Andheri East Industrial Estate, Mumbai 400093",
        payment_terms_days=15,
        lead_time_days=10,
        on_time_delivery_rate=Decimal("64.00"),
        avg_delay_days=Decimal("4.60"),
        defect_rate=Decimal("4.80"),
        cancellation_rate=Decimal("3.50"),
        discrepancy_rate=Decimal("5.20"),
        price_volatility_score=Decimal("14.50"),
        reliability_score=Decimal("56.80"),
        risk_category="HIGH",
    )
    db.add_all([sup1, sup2, sup3])
    db.flush()

    db.add_all(
        [
            SupplierContact(
                organization_id=org.id,
                supplier_id=sup1.id,
                name="Mahesh Deshpande",
                designation="Key Account Director",
                email="mahesh@ganeshsteels.in",
                phone="+91 98220 11223",
                is_primary=True,
            ),
            SupplierContact(
                organization_id=org.id,
                supplier_id=sup2.id,
                name="Bhavesh Mehta",
                designation="Commercial Head",
                email="bhavesh@wifasteners.co.in",
                phone="+91 98250 33445",
                is_primary=True,
            ),
            SupplierContact(
                organization_id=org.id,
                supplier_id=sup3.id,
                name="Nikhil Arora",
                designation="Dispatch Manager",
                email="nikhil@apexelectro.in",
                phone="+91 98211 99887",
                is_primary=True,
            ),
        ]
    )

    # Products — Product 1 specifically implements the signature prompt scenario:
    # 12 units remaining, 10 units consumed daily, 8 days supplier lead time!
    p1 = Product(
        organization_id=org.id,
        preferred_supplier_id=sup1.id,
        sku="SKU-VLV-SS316-A",
        barcode="8901425001012",
        hsn_code="84818030",
        name="Product A — SS316 High-Pressure Ball Valve (50mm)",
        description="Forged SS316 Pn40 industrial ball valve used in main assembly line.",
        category_name="Industrial Valves & Actuators",
        uom_symbol="PCS",
        unit_cost=Decimal("2450.00"),
        selling_price=Decimal("3400.00"),
        tax_rate=Decimal("18.00"),
        reorder_point=Decimal("100.00"),
        safety_stock=Decimal("20.00"),
        lead_time_days=8,
        avg_daily_demand=Decimal("10.00"),
        is_batch_tracked=True,
    )
    p2 = Product(
        organization_id=org.id,
        preferred_supplier_id=sup2.id,
        sku="SKU-BRG-6205Z",
        barcode="8901425001029",
        hsn_code="84821011",
        name="Deep Groove Precision Ball Bearing 6205-2RS",
        description="High-RPM sealed industrial bearing for conveyor motor assemblies.",
        category_name="Precision Fasteners & Bearings",
        uom_symbol="PCS",
        unit_cost=Decimal("380.00"),
        selling_price=Decimal("560.00"),
        tax_rate=Decimal("18.00"),
        reorder_point=Decimal("120.00"),
        safety_stock=Decimal("35.00"),
        lead_time_days=6,
        avg_daily_demand=Decimal("14.00"),
        is_batch_tracked=True,
    )
    p3 = Product(
        organization_id=org.id,
        preferred_supplier_id=sup3.id,
        sku="SKU-VFD-7.5KW",
        barcode="8901425001036",
        hsn_code="85044090",
        name="3-Phase AC Variable Frequency Drive (7.5 kW)",
        description="Heavy-duty VFD inverter drive with Modbus RS485 interface.",
        category_name="Control Panels & Drives",
        uom_symbol="PCS",
        unit_cost=Decimal("14800.00"),
        selling_price=Decimal("21500.00"),
        tax_rate=Decimal("18.00"),
        reorder_point=Decimal("15.00"),
        safety_stock=Decimal("5.00"),
        lead_time_days=10,
        avg_daily_demand=Decimal("1.50"),
        is_batch_tracked=False,
    )
    p4 = Product(
        organization_id=org.id,
        preferred_supplier_id=sup1.id,
        sku="SKU-FLG-CS150",
        barcode="8901425001043",
        hsn_code="73079190",
        name="Carbon Steel Slip-On Flange ANSI B16.5 (150#)",
        description="Machined carbon steel pipe flange for chemical piping systems.",
        category_name="Industrial Valves & Actuators",
        uom_symbol="PCS",
        unit_cost=Decimal("890.00"),
        selling_price=Decimal("1290.00"),
        tax_rate=Decimal("18.00"),
        reorder_point=Decimal("80.00"),
        safety_stock=Decimal("25.00"),
        lead_time_days=8,
        avg_daily_demand=Decimal("6.50"),
        is_batch_tracked=False,
    )
    p5 = Product(
        organization_id=org.id,
        preferred_supplier_id=sup2.id,
        sku="SKU-LEGACY-GASKET",
        barcode="8901425001050",
        hsn_code="68129911",
        name="Spiral Wound Metallic Gasket DN200 (Slow Moving)",
        description="Legacy flange gasket specification with minimal recent consumption.",
        category_name="Industrial Packaging",
        uom_symbol="PCS",
        unit_cost=Decimal("620.00"),
        selling_price=Decimal("900.00"),
        tax_rate=Decimal("18.00"),
        reorder_point=Decimal("20.00"),
        safety_stock=Decimal("10.00"),
        lead_time_days=6,
        avg_daily_demand=Decimal("0.10"),
        is_batch_tracked=False,
    )
    db.add_all([p1, p2, p3, p4, p5])
    db.flush()

    assert wh_pune is not None
    # Inventory balances & ledger movements
    stock_setup = [
        (p1, wh_pune, Decimal("12.00"), "LOT-SS316-26A"),   # 12 units remaining!
        (p2, wh_pune, Decimal("95.00"), "LOT-BRG-26B"),     # Below reorder point (120)
        (p3, wh_pune, Decimal("24.00"), "LOT-VFD-26C"),     # Healthy stock
        (p4, wh_bhiwandi, Decimal("210.00"), "LOT-FLG-26D"),
        (p5, wh_ahmedabad, Decimal("240.00"), "LOT-GSK-25Z"),  # Dead stock (>240 units, 0.1/day demand)
    ]
    for prod, wh, qty, batch_no in stock_setup:
        bal = InventoryBalance(
            organization_id=org.id,
            product_id=prod.id,
            warehouse_id=wh.id,
            on_hand_qty=qty,
            reserved_qty=Decimal("0.00"),
            available_qty=qty,
            last_movement_at=datetime.now(timezone.utc),
        )
        batch = InventoryBatch(
            organization_id=org.id,
            product_id=prod.id,
            warehouse_id=wh.id,
            batch_number=batch_no,
            manufacturing_date=today - timedelta(days=45),
            expiry_date=today + timedelta(days=365),
            quantity=qty,
            unit_cost=prod.unit_cost,
        )
        db.add_all([bal, batch])
        db.flush()

        # Initial IN movement
        db.add(
            StockMovement(
                organization_id=org.id,
                product_id=prod.id,
                warehouse_id=wh.id,
                batch_id=batch.id,
                movement_type="IN",
                quantity=qty + Decimal("40.00"),
                unit_cost=prod.unit_cost,
                balance_after=qty + Decimal("40.00"),
                reference_type="GRN",
                reference_id="GRN-202610-101",
                batch_number=batch_no,
                notes="Initial verified Goods Receipt stock-in",
                status="APPROVED",
                created_by_id=owner_user.id,
                approved_by_id=owner_user.id,
                created_at=datetime.now(timezone.utc) - timedelta(days=5),
            )
        )
        # Outbound consumption movement
        db.add(
            StockMovement(
                organization_id=org.id,
                product_id=prod.id,
                warehouse_id=wh.id,
                batch_id=batch.id,
                movement_type="OUT",
                quantity=Decimal("40.00"),
                unit_cost=prod.unit_cost,
                balance_after=qty,
                reference_type="DISPATCH",
                reference_id="DISP-202611-204",
                batch_number=batch_no,
                notes="Production line & wholesale customer dispatch",
                status="APPROVED",
                created_by_id=owner_user.id,
                approved_by_id=owner_user.id,
                created_at=datetime.now(timezone.utc) - timedelta(days=1),
            )
        )

    # Record an unusual adjustment on Product 4 for Scenario 9
    db.add(
        StockMovement(
            organization_id=org.id,
            product_id=p4.id,
            warehouse_id=wh_bhiwandi.id,
            movement_type="ADJUSTMENT",
            quantity=Decimal("15.00"),
            unit_cost=p4.unit_cost,
            balance_after=Decimal("210.00"),
            reference_type="AUDIT",
            reference_id="ADJ-202611-09",
            notes="Cycle count variance discovered in Bhiwandi Rack C4",
            status="APPROVED",
            created_by_id=owner_user.id,
        )
    )

    # Purchase Requests & Approvals
    pr1 = PurchaseRequest(
        organization_id=org.id,
        pr_number="PR-202611-101",
        title="Urgent Bearing & Valve Replenishment for Chakan Assembly",
        warehouse_id=wh_pune.id,
        requested_by_id=owner_user.id,
        priority="URGENT",
        status="PENDING_APPROVAL",
        required_by_date=today + timedelta(days=5),
        total_estimated_amount=Decimal("295500.00"),
        notes="Required to fulfil Q3 OEM order schedule.",
    )
    db.add(pr1)
    db.flush()
    db.add_all(
        [
            PurchaseRequestItem(
                purchase_request_id=pr1.id,
                product_id=p1.id,
                quantity=Decimal("100.00"),
                estimated_unit_price=Decimal("2450.00"),
                notes="Replenish critical SS316 ball valves",
            ),
            PurchaseRequestItem(
                purchase_request_id=pr1.id,
                product_id=p2.id,
                quantity=Decimal("132.89"),
                estimated_unit_price=Decimal("380.00"),
                notes="Safety stock buffer for 6205Z bearings",
            ),
        ]
    )

    # RFQ & Supplier Quotations (including an expensive quotation for Scenario 3)
    rfq1 = RFQ(
        organization_id=org.id,
        rfq_number="RFQ-202611-01",
        title="Q3 Rate Contract — SS316 High-Pressure Ball Valves (100 PCS)",
        purchase_request_id=pr1.id,
        product_id=p1.id,
        required_qty=Decimal("100.00"),
        status="EVALUATING",
        deadline_date=today + timedelta(days=4),
        notes="Comparing lead time, landed GST price, and supplier reliability.",
    )
    db.add(rfq1)
    db.flush()

    q1 = Quotation(
        organization_id=org.id,
        rfq_id=rfq1.id,
        supplier_id=sup1.id,
        quote_number="QT-GANESH-881",
        status="SUBMITTED",
        delivery_days=8,
        payment_terms_days=30,
        subtotal=Decimal("242000.00"),
        tax_amount=Decimal("43560.00"),
        total_amount=Decimal("285560.00"),
        validity_date=today + timedelta(days=15),
        notes="Includes test certificate EN 10204 3.1 and free Chakan MIDC delivery.",
    )
    q2 = Quotation(
        organization_id=org.id,
        rfq_id=rfq1.id,
        supplier_id=sup2.id,
        quote_number="QT-WIF-409",
        status="SUBMITTED",
        delivery_days=6,
        payment_terms_days=45,
        subtotal=Decimal("252000.00"),
        tax_amount=Decimal("45360.00"),
        total_amount=Decimal("297360.00"),
        validity_date=today + timedelta(days=15),
        notes="Ex-works Rajkot; faster dispatch in 6 days.",
    )
    q3 = Quotation(
        organization_id=org.id,
        rfq_id=rfq1.id,
        supplier_id=sup3.id,
        quote_number="QT-APEX-992",
        status="SUBMITTED",
        delivery_days=11,
        payment_terms_days=15,
        subtotal=Decimal("298000.00"),
        tax_amount=Decimal("53640.00"),
        total_amount=Decimal("351640.00"),
        validity_date=today + timedelta(days=10),
        notes="21.6% above benchmark cost.",
    )
    db.add_all([q1, q2, q3])
    db.flush()

    db.add_all(
        [
            QuotationItem(
                quotation_id=q1.id,
                product_id=p1.id,
                quantity=Decimal("100.00"),
                unit_price=Decimal("2420.00"),
                tax_rate=Decimal("18.00"),
                promised_lead_time_days=8,
            ),
            QuotationItem(
                quotation_id=q2.id,
                product_id=p1.id,
                quantity=Decimal("100.00"),
                unit_price=Decimal("2520.00"),
                tax_rate=Decimal("18.00"),
                promised_lead_time_days=6,
            ),
            QuotationItem(
                quotation_id=q3.id,
                product_id=p1.id,
                quantity=Decimal("100.00"),
                unit_price=Decimal("2980.00"),
                tax_rate=Decimal("18.00"),
                promised_lead_time_days=11,
            ),
        ]
    )

    # Purchase Orders (one active, one overdue from SUP-003 for Scenario 2, one received)
    po1 = PurchaseOrder(
        organization_id=org.id,
        po_number="PO-202611-501",
        supplier_id=sup1.id,
        warehouse_id=wh_pune.id,
        status="RECEIVED",
        order_date=today - timedelta(days=14),
        expected_delivery_date=today - timedelta(days=6),
        actual_delivery_date=today - timedelta(days=6),
        subtotal=Decimal("122500.00"),
        tax_amount=Decimal("22050.00"),
        total_amount=Decimal("144550.00"),
        payment_terms_days=30,
        notes="Delivered on schedule with full QC clearance.",
        created_by_id=owner_user.id,
        approved_by_id=owner_user.id,
    )
    po2 = PurchaseOrder(
        organization_id=org.id,
        po_number="PO-202611-502",
        supplier_id=sup3.id,
        warehouse_id=wh_pune.id,
        status="ISSUED",
        order_date=today - timedelta(days=15),
        expected_delivery_date=today - timedelta(days=4),  # Overdue by 4 days!
        subtotal=Decimal("148000.00"),
        tax_amount=Decimal("26640.00"),
        total_amount=Decimal("174640.00"),
        payment_terms_days=15,
        notes="10 units of 7.5kW VFD drives — supplier dispatch delayed.",
        created_by_id=owner_user.id,
        approved_by_id=owner_user.id,
    )
    po3 = PurchaseOrder(
        organization_id=org.id,
        po_number="PO-202611-503",
        supplier_id=sup2.id,
        warehouse_id=wh_bhiwandi.id,
        status="PENDING_APPROVAL",
        order_date=today - timedelta(days=1),
        expected_delivery_date=today + timedelta(days=6),
        subtotal=Decimal("76000.00"),
        tax_amount=Decimal("13680.00"),
        total_amount=Decimal("89680.00"),
        payment_terms_days=45,
        notes="200 PCS 6205-2RS precision bearings for Bhiwandi hub.",
        created_by_id=owner_user.id,
    )
    db.add_all([po1, po2, po3])
    db.flush()

    db.add_all(
        [
            PurchaseOrderItem(
                purchase_order_id=po1.id,
                product_id=p1.id,
                ordered_qty=Decimal("50.00"),
                received_qty=Decimal("50.00"),
                unit_price=Decimal("2450.00"),
                tax_rate=Decimal("18.00"),
                line_total=Decimal("144550.00"),
            ),
            PurchaseOrderItem(
                purchase_order_id=po2.id,
                product_id=p3.id,
                ordered_qty=Decimal("10.00"),
                received_qty=Decimal("0.00"),
                unit_price=Decimal("14800.00"),
                tax_rate=Decimal("18.00"),
                line_total=Decimal("174640.00"),
            ),
            PurchaseOrderItem(
                purchase_order_id=po3.id,
                product_id=p2.id,
                ordered_qty=Decimal("200.00"),
                received_qty=Decimal("0.00"),
                unit_price=Decimal("380.00"),
                tax_rate=Decimal("18.00"),
                line_total=Decimal("89680.00"),
            ),
        ]
    )

    # Goods Receipt Note for PO1
    grn1 = GoodsReceipt(
        organization_id=org.id,
        grn_number="GRN-202611-101",
        purchase_order_id=po1.id,
        supplier_id=sup1.id,
        warehouse_id=wh_pune.id,
        received_by_id=owner_user.id,
        received_date=today - timedelta(days=6),
        supplier_challan_no="DC-GS-2026-884",
        status="VERIFIED",
        notes="All 50 SS316 valves pressure-tested and accepted.",
    )
    db.add(grn1)
    db.flush()
    db.add(
        GoodsReceiptItem(
            goods_receipt_id=grn1.id,
            product_id=p1.id,
            ordered_qty=Decimal("50.00"),
            received_qty=Decimal("50.00"),
            accepted_qty=Decimal("50.00"),
            rejected_qty=Decimal("0.00"),
            batch_number="LOT-SS316-26A",
            expiry_date=today + timedelta(days=365),
            remarks="100% QC passed",
        )
    )

    # Approvals
    db.add_all(
        [
            Approval(
                organization_id=org.id,
                entity_type="PURCHASE_REQUEST",
                entity_id=pr1.id,
                reference_number=pr1.pr_number,
                title=pr1.title,
                amount=pr1.total_estimated_amount,
                level=1,
                status="PENDING",
                requested_by_id=owner_user.id,
            ),
            Approval(
                organization_id=org.id,
                entity_type="PURCHASE_ORDER",
                entity_id=po3.id,
                reference_number=po3.po_number,
                title=f"Approve Purchase Order {po3.po_number} — Western India Fasteners",
                amount=po3.total_amount,
                level=1,
                status="PENDING",
                requested_by_id=owner_user.id,
            ),
        ]
    )

    # Create sample physical invoice text file in local storage & run Document Intelligence pipeline
    settings = get_settings()
    os.makedirs(settings.LOCAL_STORAGE_PATH, exist_ok=True)
    sample_doc_content = (
        "TAX INVOICE\n"
        "Supplier: Shree Ganesh Steels & Alloys Pvt. Ltd.\n"
        "GSTIN: 27AABCS1429B1Z1\n"
        "Invoice No: INV-GS-2026-901\n"
        "PO Number: PO-202611-501\n"
        f"Invoice Date: {(today - timedelta(days=5)).isoformat()}\n"
        f"Due Date: {(today + timedelta(days=4)).isoformat()}\n"
        "Item 1: SS316 High-Pressure Ball Valve (50mm) | HSN: 84818030 | Qty: 50 PCS | Rate: INR 2450.00\n"
        "Subtotal: INR 122,500.00\n"
        "Total GST (18%): INR 22,050.00\n"
        "Grand Total: INR 144,550.00\n"
        "Payment Terms: 30 Days MSME Priority\n"
    )
    sample_bytes = sample_doc_content.encode("utf-8")
    sample_hash = hashlib.sha256(sample_bytes).hexdigest()
    sample_path = Path(settings.LOCAL_STORAGE_PATH) / f"{org.id}_INV-GS-2026-901.txt"
    sample_path.write_bytes(sample_bytes)

    doc1 = Document(
        organization_id=org.id,
        filename=sample_path.name,
        original_filename="INV-GS-2026-901_Shree_Ganesh_Steels.pdf",
        mime_type="application/pdf",
        file_size_bytes=len(sample_bytes),
        storage_path=str(sample_path),
        file_hash_sha256=sample_hash,
        doc_type="INVOICE",
        status="VERIFIED",
        supplier_id=sup1.id,
        uploaded_by_id=owner_user.id,
        verified_by_id=owner_user.id,
        verified_at=datetime.now(timezone.utc),
    )
    db.add(doc1)
    db.flush()
    ext1 = process_document_pipeline(db, doc1)
    ext1.is_verified = True
    doc1.status = "VERIFIED"

    db.add(
        SupplierDocument(
            organization_id=org.id,
            supplier_id=sup1.id,
            document_id=doc1.id,
            doc_type="GST_INVOICE_AND_QC_CERT",
            title="GST Tax Invoice & EN 10204 3.1 Mill Test Certificate",
            expiry_date=today + timedelta(days=365),
            status="VALID",
        )
    )

    # Invoices (Payables & Receivables) — including a PO mismatch invoice (Scenario 5)
    inv_pay1 = Invoice(
        organization_id=org.id,
        invoice_number="INV-GS-2026-901",
        invoice_type="PAYABLE",
        supplier_id=sup1.id,
        purchase_order_id=po1.id,
        document_id=doc1.id,
        invoice_date=today - timedelta(days=5),
        due_date=today + timedelta(days=4),  # Due within 7 days!
        subtotal=Decimal("122500.00"),
        tax_amount=Decimal("22050.00"),
        total_amount=Decimal("144550.00"),
        paid_amount=Decimal("44550.00"),
        balance_due=Decimal("100000.00"),
        status="PARTIALLY_PAID",
        match_status="MATCHED",
        match_notes="3-Way Match Verified: Matches PO-202611-501 and GRN-202611-101.",
        is_verified=True,
    )
    inv_pay2 = Invoice(
        organization_id=org.id,
        invoice_number="INV-APEX-2026-774",
        invoice_type="PAYABLE",
        supplier_id=sup3.id,
        purchase_order_id=po2.id,
        invoice_date=today - timedelta(days=10),
        due_date=today - timedelta(days=1),  # Overdue!
        subtotal=Decimal("162000.00"),
        tax_amount=Decimal("29160.00"),
        total_amount=Decimal("191160.00"),
        paid_amount=Decimal("0.00"),
        balance_due=Decimal("191160.00"),
        status="OVERDUE",
        match_status="MISMATCH",
        match_notes="Billed total ₹1,91,160 exceeds PO-202611-502 contracted total ₹1,74,640 by ₹16,520 (+9.5%).",
        is_verified=False,
    )
    inv_rec1 = Invoice(
        organization_id=org.id,
        invoice_number="SI-BPE-2026-301",
        invoice_type="RECEIVABLE",
        customer_name="Tata AutoComp Systems Ltd.",
        customer_gstin="27AAACT2727Q1ZW",
        invoice_date=today - timedelta(days=12),
        due_date=today + timedelta(days=8),
        subtotal=Decimal("380000.00"),
        tax_amount=Decimal("68400.00"),
        total_amount=Decimal("448400.00"),
        paid_amount=Decimal("200000.00"),
        balance_due=Decimal("248400.00"),
        status="PARTIALLY_PAID",
        match_status="MATCHED",
        is_verified=True,
    )
    inv_rec2 = Invoice(
        organization_id=org.id,
        invoice_number="SI-BPE-2026-302",
        invoice_type="RECEIVABLE",
        customer_name="Kirloskar Pneumatic Co. Ltd.",
        customer_gstin="27AAACK1319P1Z5",
        invoice_date=today - timedelta(days=4),
        due_date=today + timedelta(days=16),
        subtotal=Decimal("215000.00"),
        tax_amount=Decimal("38700.00"),
        total_amount=Decimal("253700.00"),
        paid_amount=Decimal("0.00"),
        balance_due=Decimal("253700.00"),
        status="VERIFIED",
        match_status="MATCHED",
        is_verified=True,
    )
    db.add_all([inv_pay1, inv_pay2, inv_rec1, inv_rec2])
    db.flush()

    db.add(
        InvoiceItem(
            invoice_id=inv_pay1.id,
            product_id=p1.id,
            description="SS316 High-Pressure Ball Valve (50mm)",
            quantity=Decimal("50.00"),
            unit_price=Decimal("2450.00"),
            tax_rate=Decimal("18.00"),
            line_total=Decimal("144550.00"),
        )
    )
    db.add(
        Payment(
            organization_id=org.id,
            invoice_id=inv_pay1.id,
            payment_number="PAY-202611-01",
            payment_date=today - timedelta(days=2),
            amount=Decimal("44550.00"),
            payment_method="NEFT",
            reference_utr="HDFC26315992014",
            notes="Part advance settlement against INV-GS-2026-901",
            recorded_by_id=owner_user.id,
        )
    )

    # Expenses
    db.add_all(
        [
            Expense(
                organization_id=org.id,
                expense_number="EXP-202611-01",
                category="LOGISTICS",
                vendor_name="VRL Logistics Ltd.",
                expense_date=today - timedelta(days=7),
                amount=Decimal("38500.00"),
                tax_amount=Decimal("4620.00"),
                payment_status="PAID",
                notes="Pune to Ahmedabad & Mumbai inter-warehouse freight",
                created_by_id=owner_user.id,
            ),
            Expense(
                organization_id=org.id,
                expense_number="EXP-202611-02",
                category="UTILITIES",
                vendor_name="MSEDCL Industrial Power Chakan",
                expense_date=today - timedelta(days=3),
                amount=Decimal("84200.00"),
                tax_amount=Decimal("0.00"),
                payment_status="PAID",
                notes="Monthly HT industrial electricity bill",
                created_by_id=owner_user.id,
            ),
        ]
    )

    # Workflow Automation Rules & Runs
    rule1 = WorkflowRule(
        organization_id=org.id,
        name="Auto-Escalate Low Stock Below Reorder Point",
        description="When any active SKU falls below its Reorder Point, create an urgent Procurement Task and notify the Operations Manager.",
        trigger_event="LOW_STOCK",
        condition_json={"threshold": "below_reorder_point"},
        action_type="CREATE_TASK",
        action_config_json={"priority": "URGENT", "department": "Procurement"},
        is_active=True,
        trigger_count=2,
        last_triggered_at=datetime.now(timezone.utc) - timedelta(hours=3),
    )
    rule2 = WorkflowRule(
        organization_id=org.id,
        name="Overdue Payable MSME 43B(h) Alert & Escalation",
        description="Alert Finance Manager 5 days before supplier invoice due date to protect MSME credit standing.",
        trigger_event="INVOICE_OVERDUE",
        condition_json={"days_before_due": 5},
        action_type="SEND_NOTIFICATION",
        action_config_json={"channel": "in_app_and_email", "severity": "CRITICAL"},
        is_active=True,
        trigger_count=1,
        last_triggered_at=datetime.now(timezone.utc) - timedelta(hours=6),
    )
    rule3 = WorkflowRule(
        organization_id=org.id,
        name="PO Approval Reminder (>24h Pending)",
        description="Send escalation reminder when Purchase Orders > ₹50,000 remain unapproved for 24 hours.",
        trigger_event="PO_APPROVAL_PENDING",
        condition_json={"amount_gte": 50000},
        action_type="ESCALATE_APPROVAL",
        action_config_json={"escalate_to_role": "OWNER"},
        is_active=True,
        trigger_count=1,
        last_triggered_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db.add_all([rule1, rule2, rule3])
    db.flush()

    db.add_all(
        [
            WorkflowRun(
                organization_id=org.id,
                rule_id=rule1.id,
                rule_name=rule1.name,
                status="SUCCESS",
                trigger_ref="SKU-VLV-SS316-A (12 PCS < ROP 100 PCS)",
                summary="Triggered low-stock task & alert for Product A — SS316 Ball Valve.",
                actions_taken_json=[{"action": "CREATE_TASK", "target": "Replenish SKU-VLV-SS316-A"}],
            ),
            WorkflowRun(
                organization_id=org.id,
                rule_id=rule2.id,
                rule_name=rule2.name,
                status="SUCCESS",
                trigger_ref="INV-APEX-2026-774 (Overdue)",
                summary="Flagged overdue invoice INV-APEX-2026-774 and notified Finance Manager.",
                actions_taken_json=[{"action": "SEND_NOTIFICATION", "target": "Finance Team"}],
            ),
        ]
    )

    # Tasks
    db.add_all(
        [
            TaskItem(
                organization_id=org.id,
                title="Approve Emergency Replenishment for Product A (SS316 Ball Valve — 12 PCS left)",
                description="Current stock (12 PCS) will stock out in 1.2 days vs 8-day supplier lead time.",
                category="PROCUREMENT",
                priority="URGENT",
                status="TODO",
                assigned_to_id=owner_user.id,
                due_date=today + timedelta(days=1),
                source_type="AI_RECOMMENDATION",
            ),
            TaskItem(
                organization_id=org.id,
                title="Reconcile ₹16,520 PO-Invoice Mismatch on INV-APEX-2026-774",
                description="Apex Electro billed ₹1,91,160 against PO-202611-502 (₹1,74,640). Request credit note.",
                category="FINANCE",
                priority="HIGH",
                status="IN_PROGRESS",
                assigned_to_id=owner_user.id,
                due_date=today + timedelta(days=2),
                source_type="WORKFLOW",
            ),
            TaskItem(
                organization_id=org.id,
                title="Verify Cycle Count Adjustment (15 PCS) at Bhiwandi Warehouse",
                description="Sign off physical rack audit for Carbon Steel Flanges.",
                category="INVENTORY",
                priority="MEDIUM",
                status="TODO",
                assigned_to_id=owner_user.id,
                due_date=today + timedelta(days=4),
                source_type="WORKFLOW",
            ),
        ]
    )

    # Notifications & Preferences
    db.add(
        NotificationPreference(
            user_id=owner_user.id,
            organization_id=org.id,
            in_app_enabled=True,
            email_enabled=True,
            low_stock_alerts=True,
            approval_reminders=True,
            payment_due_alerts=True,
            ai_digest_enabled=True,
        )
    )
    db.add_all(
        [
            Notification(
                organization_id=org.id,
                user_id=owner_user.id,
                title="CRITICAL: Product A (SS316 Valve) has 12 PCS remaining",
                message="At 10 PCS/day consumption and 8-day supplier lead time, stockout is projected in 1.2 days.",
                category="INVENTORY",
                severity="CRITICAL",
                link_url="/app/recommendations",
                is_read=False,
            ),
            Notification(
                organization_id=org.id,
                user_id=owner_user.id,
                title="2 Procurement Approvals Awaiting Sign-Off",
                message="PR-202611-101 (₹2,95,500) and PO-202611-503 (₹89,680) require approval.",
                category="APPROVAL",
                severity="WARNING",
                link_url="/app/approvals",
                is_read=False,
            ),
            Notification(
                organization_id=org.id,
                user_id=owner_user.id,
                title="Document Extracted: INV-GS-2026-901 (₹1,44,550)",
                message="AI Document Intelligence extracted and matched INV-GS-2026-901 against PO-202611-501.",
                category="AI",
                severity="SUCCESS",
                link_url="/app/documents",
                is_read=False,
            ),
        ]
    )

    # Generate all 10-scenario AI Recommendations from the live seeded ledger
    generate_business_recommendations(db, org.id)

    db.add(
        AuditLog(
            organization_id=org.id,
            actor_id=owner_user.id,
            actor_email=owner_user.email,
            action="WORKSPACE_BOOTSTRAPPED",
            entity_type="ORGANIZATION",
            entity_id=org.id,
            summary=f"Initialised multi-tenant workspace '{org.name}' with Indian MSME operational dataset.",
            metadata_json={"currency": "INR", "gstin": org.gstin, "demo_labelled": True},
            ip_address="127.0.0.1",
        )
    )
    db.flush()


def ensure_default_demo_environment(db: Session) -> None:
    """
    Ensure that on initial startup a default demo user and two multi-tenant organisations
    exist so evaluators can immediately sign in with 1 click or register their own account.
    """
    role_map = ensure_system_roles_and_permissions(db)
    demo_email = "arjun.mehta@sutradhar.ai"
    user = db.query(User).filter(User.email == demo_email).first()
    if not user:
        user = User(
            email=demo_email,
            full_name="Arjun Mehta",
            phone="+91 98200 11223",
            job_title="Managing Director",
            hashed_password=hash_password("Sutradhar@123"),
            is_active=True,
        )
        db.add(user)
        db.flush()

    org1 = db.query(Organization).filter(Organization.slug == "bharat-precision-eng").first()
    if not org1:
        org1 = Organization(
            name="Bharat Precision Engineering Pvt. Ltd. (Demo)",
            slug="bharat-precision-eng",
            legal_name="Bharat Precision Engineering Private Limited",
            gstin="27AABCB1234F1Z5",
            pan="AABCB1234F",
            msme_udyam_no="UDYAM-MH-26-0049182",
            industry="Industrial Manufacturing & Wholesale Distribution",
            currency="INR",
            address="Plot B-42, Phase II, Chakan MIDC, Pune",
            city="Pune",
            state="Maharashtra",
            pincode="410501",
            phone="+91 20 6721 4400",
            email="ops@bharatprecision.in",
        )
        db.add(org1)
        db.flush()
        db.add(
            Membership(
                user_id=user.id,
                organization_id=org1.id,
                role_id=role_map["OWNER"].id,
                department="Executive Management",
                status="ACTIVE",
                is_default=True,
            )
        )
        db.flush()
        seed_organization_operational_data(db, org1, user)

    # Second workspace for the same user to demonstrate multi-organisation switching
    org2 = db.query(Organization).filter(Organization.slug == "deccan-agro-distributors").first()
    if not org2:
        org2 = Organization(
            name="Deccan Agro & Trading Co. (Clean Workspace)",
            slug="deccan-agro-distributors",
            legal_name="Deccan Agro Wholesale Distributors LLP",
            gstin="27AABCD8899K1Z2",
            pan="AABCD8899K",
            msme_udyam_no="UDYAM-MH-26-0091204",
            industry="Wholesale Trading & Distribution",
            currency="INR",
            address="Market Yard, Gultekdi, Pune",
            city="Pune",
            state="Maharashtra",
            pincode="411037",
            phone="+91 20 2426 1100",
            email="accounts@deccanagro.in",
        )
        db.add(org2)
        db.flush()
        db.add(
            Membership(
                user_id=user.id,
                organization_id=org2.id,
                role_id=role_map["OWNER"].id,
                department="Management",
                status="ACTIVE",
                is_default=False,
            )
        )
        bootstrap_organization_defaults(db, org2)

    db.commit()

