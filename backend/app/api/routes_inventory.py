"""Products, Warehouses, Multi-Location Inventory Ledger, Alerts & Forecasting API routes."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.ai.forecasting import (
    calculate_reorder_metrics,
    generate_organization_inventory_forecasts,
)
from app.api.deps import TenantContext, record_audit_log, require_permissions
from app.core.database import get_db
from app.models.entities import (
    Approval,
    InventoryBalance,
    InventoryBatch,
    Product,
    StockMovement,
    Supplier,
    Warehouse,
)
from app.schemas.api_schemas import (
    ProductCreateRequest,
    ProductUpdateRequest,
    StockMovementCreateRequest,
    WarehouseCreateRequest,
)

router = APIRouter()


@router.get("/products", tags=["Products & Catalogue"])
def list_products(
    search: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    low_stock_only: bool = Query(default=False),
    ctx: TenantContext = Depends(require_permissions("inventory:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """List organisation products with live multi-warehouse stock balances and reorder risk status."""
    query = db.query(Product).filter(
        Product.organization_id == ctx.organization.id,
        Product.is_active.is_(True),
    )
    if search:
        q = f"%{search.strip()}%"
        query = query.filter(
            (Product.name.ilike(q)) | (Product.sku.ilike(q)) | (Product.barcode.ilike(q))
        )
    if category:
        query = query.filter(Product.category_name == category)

    products = query.order_by(Product.name.asc()).all()
    suppliers = {
        s.id: s.name
        for s in db.query(Supplier).filter(Supplier.organization_id == ctx.organization.id).all()
    }

    items: List[Dict[str, Any]] = []
    for p in products:
        balances = (
            db.query(InventoryBalance)
            .filter(
                InventoryBalance.organization_id == ctx.organization.id,
                InventoryBalance.product_id == p.id,
            )
            .all()
        )
        on_hand = float(sum((b.on_hand_qty or Decimal("0")) for b in balances))
        reserved = float(sum((b.reserved_qty or Decimal("0")) for b in balances))
        available = float(sum((b.available_qty or Decimal("0")) for b in balances))
        rop = float(p.reorder_point or Decimal("0"))
        is_low_stock = on_hand <= rop

        if low_stock_only and not is_low_stock:
            continue

        metrics = calculate_reorder_metrics(
            current_stock=on_hand,
            avg_daily_demand=float(p.avg_daily_demand or Decimal("5")),
            lead_time_days=int(p.lead_time_days or 7),
            safety_stock=float(p.safety_stock or Decimal("20")),
        )

        items.append(
            {
                "id": p.id,
                "sku": p.sku,
                "barcode": p.barcode,
                "hsn_code": p.hsn_code,
                "name": p.name,
                "description": p.description,
                "category_name": p.category_name,
                "uom_symbol": p.uom_symbol,
                "unit_cost": float(p.unit_cost or 0),
                "selling_price": float(p.selling_price or 0),
                "tax_rate": float(p.tax_rate or 18),
                "reorder_point": rop,
                "safety_stock": float(p.safety_stock or 0),
                "lead_time_days": p.lead_time_days,
                "avg_daily_demand": float(p.avg_daily_demand or 0),
                "preferred_supplier_id": p.preferred_supplier_id,
                "preferred_supplier_name": suppliers.get(p.preferred_supplier_id or "", "Unassigned"),
                "is_batch_tracked": p.is_batch_tracked,
                "on_hand_qty": on_hand,
                "reserved_qty": reserved,
                "available_qty": available,
                "stock_value_inr": round(on_hand * float(p.unit_cost or 0), 2),
                "is_low_stock": is_low_stock,
                "risk_level": metrics["risk_level"],
                "days_of_supply": metrics["days_of_supply"],
                "expected_stockout_date": metrics["expected_stockout_date"],
            }
        )

    return {"items": items, "total": len(items)}


@router.post("/products", status_code=status.HTTP_201_CREATED, tags=["Products & Catalogue"])
def create_product(
    payload: ProductCreateRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("inventory:write")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Create a new product SKU within the organisation and optionally post initial stock movement."""
    existing = (
        db.query(Product)
        .filter(
            Product.organization_id == ctx.organization.id,
            Product.sku == payload.sku.strip().upper(),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SKU '{payload.sku}' already exists in this organisation.",
        )

    product = Product(
        organization_id=ctx.organization.id,
        sku=payload.sku.strip().upper(),
        name=payload.name.strip(),
        barcode=payload.barcode,
        hsn_code=payload.hsn_code,
        category_name=payload.category_name,
        uom_symbol=payload.uom_symbol.upper(),
        unit_cost=payload.unit_cost,
        selling_price=payload.selling_price,
        tax_rate=payload.tax_rate,
        reorder_point=payload.reorder_point,
        safety_stock=payload.safety_stock,
        lead_time_days=payload.lead_time_days,
        avg_daily_demand=payload.avg_daily_demand,
        preferred_supplier_id=payload.preferred_supplier_id,
        is_batch_tracked=payload.is_batch_tracked,
        description=payload.description,
        is_active=True,
    )
    db.add(product)
    db.flush()

    wh = None
    if payload.warehouse_id:
        wh = (
            db.query(Warehouse)
            .filter(
                Warehouse.organization_id == ctx.organization.id,
                Warehouse.id == payload.warehouse_id,
            )
            .first()
        )
    if not wh:
        wh = (
            db.query(Warehouse)
            .filter(Warehouse.organization_id == ctx.organization.id)
            .order_by(Warehouse.is_primary.desc())
            .first()
        )

    if wh:
        init_qty = payload.initial_stock if payload.initial_stock > 0 else Decimal("0.00")
        bal = InventoryBalance(
            organization_id=ctx.organization.id,
            product_id=product.id,
            warehouse_id=wh.id,
            on_hand_qty=init_qty,
            reserved_qty=Decimal("0.00"),
            available_qty=init_qty,
            last_movement_at=datetime.now(timezone.utc) if init_qty > 0 else None,
        )
        db.add(bal)
        if init_qty > 0:
            db.add(
                StockMovement(
                    organization_id=ctx.organization.id,
                    product_id=product.id,
                    warehouse_id=wh.id,
                    movement_type="IN",
                    quantity=init_qty,
                    unit_cost=product.unit_cost,
                    balance_after=init_qty,
                    reference_type="OPENING_STOCK",
                    reference_id=product.sku,
                    notes="Initial opening stock balance upon SKU creation",
                    status="APPROVED",
                    created_by_id=ctx.user.id,
                    approved_by_id=ctx.user.id,
                )
            )

    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="PRODUCT_CREATED",
        entity_type="PRODUCT",
        entity_id=product.id,
        summary=f"Created product SKU {product.sku} ({product.name}).",
        request=request,
    )
    db.commit()

    return {
        "id": product.id,
        "sku": product.sku,
        "name": product.name,
        "uom_symbol": product.uom_symbol,
        "unit_cost": float(product.unit_cost),
        "on_hand_qty": float(payload.initial_stock),
    }


@router.patch("/products/{product_id}", tags=["Products & Catalogue"])
def update_product(
    product_id: str,
    payload: ProductUpdateRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("inventory:write")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Update product specifications, pricing, or reorder point."""
    product = (
        db.query(Product)
        .filter(
            Product.organization_id == ctx.organization.id,
            Product.id == product_id,
        )
        .first()
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    for field in (
        "name",
        "barcode",
        "hsn_code",
        "category_name",
        "uom_symbol",
        "unit_cost",
        "selling_price",
        "tax_rate",
        "reorder_point",
        "safety_stock",
        "lead_time_days",
        "avg_daily_demand",
        "preferred_supplier_id",
        "is_active",
    ):
        val = getattr(payload, field)
        if val is not None:
            setattr(product, field, val)

    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="PRODUCT_UPDATED",
        entity_type="PRODUCT",
        entity_id=product.id,
        summary=f"Updated product {product.sku} ({product.name}).",
        request=request,
    )
    db.commit()
    return {"id": product.id, "sku": product.sku, "name": product.name, "status": "updated"}


@router.delete("/products/{product_id}", tags=["Products & Catalogue"])
def delete_product(
    product_id: str,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("inventory:write")),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Soft-deactivate a product from active catalogue."""
    product = (
        db.query(Product)
        .filter(Product.organization_id == ctx.organization.id, Product.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    product.is_active = False
    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="PRODUCT_ARCHIVED",
        entity_type="PRODUCT",
        entity_id=product.id,
        summary=f"Archived product SKU {product.sku}.",
        request=request,
    )
    db.commit()
    return {"status": "archived", "id": product.id}


# =============================================================================
# WAREHOUSES & INVENTORY LEDGER
# =============================================================================


@router.get("/warehouses", tags=["Inventory & Warehouses"])
def list_warehouses(
    ctx: TenantContext = Depends(require_permissions("inventory:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """List organisation warehouses with SKU counts, total units, and INR inventory valuation."""
    warehouses = (
        db.query(Warehouse)
        .filter(Warehouse.organization_id == ctx.organization.id, Warehouse.is_active.is_(True))
        .order_by(Warehouse.is_primary.desc(), Warehouse.name.asc())
        .all()
    )
    products_map = {
        p.id: p
        for p in db.query(Product).filter(Product.organization_id == ctx.organization.id).all()
    }
    items = []
    for wh in warehouses:
        balances = (
            db.query(InventoryBalance)
            .filter(
                InventoryBalance.organization_id == ctx.organization.id,
                InventoryBalance.warehouse_id == wh.id,
            )
            .all()
        )
        total_units = sum(float(b.on_hand_qty or 0) for b in balances)
        total_value = sum(
            float(b.on_hand_qty or 0) * float(products_map[b.product_id].unit_cost or 0)
            for b in balances
            if b.product_id in products_map
        )
        items.append(
            {
                "id": wh.id,
                "code": wh.code,
                "name": wh.name,
                "city": wh.city,
                "state": wh.state,
                "address": wh.address,
                "manager_name": wh.manager_name,
                "capacity_units": wh.capacity_units,
                "is_primary": wh.is_primary,
                "sku_count": len([b for b in balances if float(b.on_hand_qty or 0) > 0]),
                "total_units": round(total_units, 2),
                "utilization_percent": round(min((total_units / max(wh.capacity_units, 1)) * 100.0, 100.0), 1),
                "total_valuation_inr": round(total_value, 2),
            }
        )
    return {"items": items, "total": len(items)}


@router.post("/warehouses", status_code=status.HTTP_201_CREATED, tags=["Inventory & Warehouses"])
def create_warehouse(
    payload: WarehouseCreateRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("inventory:write")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Create a new warehouse location."""
    existing = (
        db.query(Warehouse)
        .filter(
            Warehouse.organization_id == ctx.organization.id,
            Warehouse.code == payload.code.strip().upper(),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Warehouse code already exists.")

    wh = Warehouse(
        organization_id=ctx.organization.id,
        code=payload.code.strip().upper(),
        name=payload.name.strip(),
        city=payload.city,
        state=payload.state,
        address=payload.address,
        manager_name=payload.manager_name,
        capacity_units=payload.capacity_units,
        is_primary=payload.is_primary,
    )
    db.add(wh)
    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action="WAREHOUSE_CREATED",
        entity_type="WAREHOUSE",
        entity_id=wh.id,
        summary=f"Created warehouse {wh.code} ({wh.name}) in {wh.city}.",
        request=request,
    )
    db.commit()
    return {"id": wh.id, "code": wh.code, "name": wh.name, "city": wh.city}


@router.get("/inventory/balances", tags=["Inventory & Warehouses"])
def get_inventory_balances(
    warehouse_id: Optional[str] = Query(default=None),
    ctx: TenantContext = Depends(require_permissions("inventory:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return multi-location inventory balances, batches, and valuation summary."""
    q = db.query(InventoryBalance).filter(InventoryBalance.organization_id == ctx.organization.id)
    if warehouse_id:
        q = q.filter(InventoryBalance.warehouse_id == warehouse_id)
    balances = q.all()

    products = {
        p.id: p
        for p in db.query(Product).filter(Product.organization_id == ctx.organization.id).all()
    }
    warehouses = {
        w.id: w
        for w in db.query(Warehouse).filter(Warehouse.organization_id == ctx.organization.id).all()
    }
    batches = (
        db.query(InventoryBatch)
        .filter(InventoryBatch.organization_id == ctx.organization.id)
        .all()
    )

    items = []
    total_valuation = 0.0
    for b in balances:
        prod = products.get(b.product_id)
        wh = warehouses.get(b.warehouse_id)
        if not prod or not wh:
            continue
        on_hand = float(b.on_hand_qty or 0)
        val = round(on_hand * float(prod.unit_cost or 0), 2)
        total_valuation += val
        rop = float(prod.reorder_point or 0)
        items.append(
            {
                "id": b.id,
                "product_id": prod.id,
                "sku": prod.sku,
                "product_name": prod.name,
                "category_name": prod.category_name,
                "uom_symbol": prod.uom_symbol,
                "warehouse_id": wh.id,
                "warehouse_code": wh.code,
                "warehouse_name": wh.name,
                "on_hand_qty": on_hand,
                "reserved_qty": float(b.reserved_qty or 0),
                "available_qty": float(b.available_qty or 0),
                "unit_cost": float(prod.unit_cost or 0),
                "valuation_inr": val,
                "reorder_point": rop,
                "status": "CRITICAL" if on_hand <= float(prod.safety_stock or 0) else ("LOW_STOCK" if on_hand <= rop else "OPTIMAL"),
                "last_movement_at": b.last_movement_at.isoformat() if b.last_movement_at else None,
            }
        )

    batch_items = [
        {
            "id": bt.id,
            "product_id": bt.product_id,
            "product_name": products[bt.product_id].name if bt.product_id in products else "SKU",
            "warehouse_name": warehouses[bt.warehouse_id].name if bt.warehouse_id in warehouses else "Warehouse",
            "batch_number": bt.batch_number,
            "manufacturing_date": bt.manufacturing_date.isoformat() if bt.manufacturing_date else None,
            "expiry_date": bt.expiry_date.isoformat() if bt.expiry_date else None,
            "quantity": float(bt.quantity or 0),
        }
        for bt in batches
    ]

    return {
        "items": items,
        "batches": batch_items,
        "total_valuation_inr": round(total_valuation, 2),
        "total_records": len(items),
    }


@router.post("/inventory/movements", status_code=status.HTTP_201_CREATED, tags=["Inventory & Warehouses"])
def create_stock_movement(
    payload: StockMovementCreateRequest,
    request: Request,
    ctx: TenantContext = Depends(require_permissions("inventory:write")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Record a validated stock movement in the immutable ledger and atomically update inventory_balances.
    Prevents negative inventory balances.
    """
    product = (
        db.query(Product)
        .filter(
            Product.organization_id == ctx.organization.id,
            Product.id == payload.product_id,
        )
        .first()
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    warehouse = (
        db.query(Warehouse)
        .filter(
            Warehouse.organization_id == ctx.organization.id,
            Warehouse.id == payload.warehouse_id,
        )
        .first()
    )
    if not warehouse:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found.")

    balance = (
        db.query(InventoryBalance)
        .filter(
            InventoryBalance.organization_id == ctx.organization.id,
            InventoryBalance.product_id == product.id,
            InventoryBalance.warehouse_id == warehouse.id,
        )
        .first()
    )
    if not balance:
        balance = InventoryBalance(
            organization_id=ctx.organization.id,
            product_id=product.id,
            warehouse_id=warehouse.id,
            on_hand_qty=Decimal("0.00"),
            reserved_qty=Decimal("0.00"),
            available_qty=Decimal("0.00"),
        )
        db.add(balance)
        db.flush()

    qty = payload.quantity
    current_qty = Decimal(str(balance.on_hand_qty or 0))

    if payload.movement_type in ("IN", "TRANSFER_IN", "GRN_RECEIPT"):
        new_qty = current_qty + qty
    elif payload.movement_type in ("OUT", "TRANSFER_OUT"):
        if current_qty < qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock at {warehouse.name}: Available={current_qty}, Requested Out={qty}.",
            )
        new_qty = current_qty - qty
    else:  # ADJUSTMENT
        # Positive adjustment or negative adjustment check
        new_qty = max(Decimal("0.00"), current_qty - qty if "variance" in (payload.notes or "").lower() else current_qty + qty)

    balance.on_hand_qty = new_qty
    balance.available_qty = max(Decimal("0.00"), new_qty - Decimal(str(balance.reserved_qty or 0)))
    balance.last_movement_at = datetime.now(timezone.utc)

    unit_cost = payload.unit_cost if payload.unit_cost is not None else product.unit_cost
    movement = StockMovement(
        organization_id=ctx.organization.id,
        product_id=product.id,
        warehouse_id=warehouse.id,
        movement_type=payload.movement_type,
        quantity=qty,
        unit_cost=unit_cost,
        balance_after=new_qty,
        reference_type=payload.reference_type or "MANUAL",
        reference_id=payload.reference_id or f"MV-{datetime.now(timezone.utc).strftime('%H%M%S')}",
        batch_number=payload.batch_number,
        expiry_date=payload.expiry_date,
        notes=payload.notes,
        status="APPROVED",
        created_by_id=ctx.user.id,
        approved_by_id=ctx.user.id,
    )
    db.add(movement)
    db.flush()

    if payload.movement_type == "ADJUSTMENT" and qty >= Decimal("25.00"):
        db.add(
            Approval(
                organization_id=ctx.organization.id,
                entity_type="STOCK_ADJUSTMENT",
                entity_id=movement.id,
                reference_number=movement.reference_id or "ADJ",
                title=f"Stock Adjustment Audit Review: {qty} {product.uom_symbol} of {product.name}",
                amount=(qty * Decimal(str(unit_cost or 0))).quantize(Decimal("0.01")),
                level=1,
                status="PENDING",
                requested_by_id=ctx.user.id,
            )
        )

    record_audit_log(
        db=db,
        organization_id=ctx.organization.id,
        actor=ctx.user,
        action=f"STOCK_MOVEMENT_{payload.movement_type}",
        entity_type="STOCK_MOVEMENT",
        entity_id=movement.id,
        summary=f"Recorded {payload.movement_type} of {qty} {product.uom_symbol} for {product.sku} at {warehouse.code}. Balance after: {new_qty}.",
        request=request,
    )
    db.commit()

    return {
        "id": movement.id,
        "product_id": product.id,
        "sku": product.sku,
        "warehouse_id": warehouse.id,
        "movement_type": movement.movement_type,
        "quantity": float(movement.quantity),
        "balance_after": float(movement.balance_after),
        "status": movement.status,
    }


@router.get("/inventory/movements", tags=["Inventory & Warehouses"])
def list_stock_movements(
    product_id: Optional[str] = Query(default=None),
    movement_type: Optional[str] = Query(default=None),
    ctx: TenantContext = Depends(require_permissions("inventory:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """List immutable stock movement ledger entries."""
    q = db.query(StockMovement).filter(StockMovement.organization_id == ctx.organization.id)
    if product_id:
        q = q.filter(StockMovement.product_id == product_id)
    if movement_type:
        q = q.filter(StockMovement.movement_type == movement_type)

    movements = q.order_by(StockMovement.created_at.desc()).limit(100).all()
    products = {
        p.id: p
        for p in db.query(Product).filter(Product.organization_id == ctx.organization.id).all()
    }
    warehouses = {
        w.id: w
        for w in db.query(Warehouse).filter(Warehouse.organization_id == ctx.organization.id).all()
    }

    items = []
    for m in movements:
        prod = products.get(m.product_id)
        wh = warehouses.get(m.warehouse_id)
        items.append(
            {
                "id": m.id,
                "product_id": m.product_id,
                "sku": prod.sku if prod else "SKU",
                "product_name": prod.name if prod else "Product",
                "uom_symbol": prod.uom_symbol if prod else "PCS",
                "warehouse_id": m.warehouse_id,
                "warehouse_name": wh.name if wh else "Warehouse",
                "movement_type": m.movement_type,
                "quantity": float(m.quantity or 0),
                "unit_cost": float(m.unit_cost or 0),
                "balance_after": float(m.balance_after or 0),
                "reference_type": m.reference_type,
                "reference_id": m.reference_id,
                "batch_number": m.batch_number,
                "notes": m.notes,
                "status": m.status,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
        )
    return {"items": items, "total": len(items)}


@router.get("/inventory/alerts", tags=["Inventory & Warehouses"])
def get_inventory_alerts(
    ctx: TenantContext = Depends(require_permissions("inventory:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return low-stock alerts, imminent stockout predictions, and dead-stock items."""
    forecasts = generate_organization_inventory_forecasts(db, ctx.organization.id)
    alerts = []
    for f in forecasts:
        if f["will_stockout_before_delivery"] or f["current_stock"] <= f["reorder_point"]:
            alerts.append(
                {
                    "alert_type": "STOCKOUT_BEFORE_LEAD_TIME" if f["will_stockout_before_delivery"] else "BELOW_REORDER_POINT",
                    "severity": f["risk_level"],
                    **f,
                }
            )
        elif f["avg_daily_demand"] <= 0.3 and f["current_stock"] >= 150:
            alerts.append(
                {
                    "alert_type": "DEAD_STOCK",
                    "severity": "MEDIUM",
                    **f,
                }
            )
    return {"items": alerts, "total": len(alerts), "all_sku_forecasts": forecasts}


@router.get("/inventory/forecast", tags=["Inventory & Warehouses"])
def get_inventory_forecasts(
    ctx: TenantContext = Depends(require_permissions("inventory:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return demand forecasting and baseline vs advanced model evaluation for all SKUs."""
    forecasts = generate_organization_inventory_forecasts(db, ctx.organization.id)
    return {"items": forecasts, "total": len(forecasts)}

