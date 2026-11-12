"""Transparent baseline & ML-assisted inventory demand forecasting engine."""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models.entities import InventoryBalance, Product, StockMovement, Supplier


def calculate_reorder_metrics(
    current_stock: float,
    avg_daily_demand: float,
    lead_time_days: int,
    safety_stock: float,
    demand_std_dev: float | None = None,
) -> Dict[str, Any]:
    """
    Compute transparent baseline inventory metrics:
    Reorder Point (ROP) = (Average Daily Demand * Lead Time) + Safety Stock
    """
    daily = max(avg_daily_demand, 0.0)
    lt = max(lead_time_days, 1)
    std = demand_std_dev if demand_std_dev is not None else (daily * 0.22)
    computed_safety_stock = max(safety_stock, round(1.65 * std * math.sqrt(lt), 2))
    reorder_point = round((daily * lt) + computed_safety_stock, 2)

    days_of_supply = round(current_stock / daily, 1) if daily > 0 else 999.0
    today = datetime.now(timezone.utc).date()
    expected_stockout_date = (
        (today + timedelta(days=max(int(math.floor(days_of_supply)), 0))).isoformat()
        if daily > 0 and days_of_supply < 180
        else None
    )

    will_stockout_before_delivery = daily > 0 and days_of_supply < lt
    deficit_during_lead_time = max((daily * lt) - current_stock, 0.0)
    # Suggested reorder quantity covers 2x lead-time cycle + safety stock minus current stock
    target_stock = (daily * max(lt * 2, 14)) + computed_safety_stock
    suggested_reorder_qty = max(math.ceil(target_stock - current_stock), 0)

    if will_stockout_before_delivery:
        risk_level = "CRITICAL"
    elif current_stock <= reorder_point:
        risk_level = "HIGH"
    elif current_stock <= reorder_point * 1.25:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return {
        "current_stock": round(current_stock, 2),
        "avg_daily_demand": round(daily, 2),
        "lead_time_days": lt,
        "safety_stock": round(computed_safety_stock, 2),
        "reorder_point": reorder_point,
        "days_of_supply": days_of_supply,
        "expected_stockout_date": expected_stockout_date,
        "will_stockout_before_delivery": will_stockout_before_delivery,
        "deficit_during_lead_time": round(deficit_during_lead_time, 2),
        "suggested_reorder_qty": float(suggested_reorder_qty),
        "risk_level": risk_level,
    }


def evaluate_forecast_models(daily_series: List[float], horizon_days: int = 14) -> Dict[str, Any]:
    """
    Compare Simple Moving Average (Baseline) vs Exponential Smoothing / Linear Trend
    and evaluate holdout forecast error (MAE & MAPE).
    """
    series = [max(float(x), 0.0) for x in daily_series if x is not None]
    if len(series) < 7:
        base_val = series[-1] if series else 5.0
        series = [round(base_val * (0.9 + 0.03 * (i % 5)), 2) for i in range(14)]

    # Split last 4 points for backtesting evaluation
    train = series[:-4] if len(series) > 6 else series
    test = series[-4:] if len(series) > 6 else series[-2:]

    # 1. Baseline: 7-day Simple Moving Average
    window = train[-7:] if len(train) >= 7 else train
    sma_pred = sum(window) / max(len(window), 1)
    sma_preds = [round(sma_pred, 2) for _ in test]

    # 2. Advanced: Holt Linear Exponential Smoothing (alpha=0.45, beta=0.25)
    alpha, beta = 0.45, 0.25
    level = train[0]
    trend = (train[-1] - train[0]) / max(len(train) - 1, 1)
    for val in train[1:]:
        prev_level = level
        level = alpha * val + (1 - alpha) * (level + trend)
        trend = beta * (level - prev_level) + (1 - beta) * trend

    holt_test_preds = [round(max(level + (i + 1) * trend, 0.0), 2) for i in range(len(test))]

    def _mae(actual: List[float], pred: List[float]) -> float:
        return round(sum(abs(a - p) for a, p in zip(actual, pred)) / max(len(actual), 1), 3)

    def _mape(actual: List[float], pred: List[float]) -> float:
        terms = [abs(a - p) / max(a, 1.0) for a, p in zip(actual, pred)]
        return round((sum(terms) / max(len(terms), 1)) * 100.0, 2)

    sma_mae = _mae(test, sma_preds)
    sma_mape = _mape(test, sma_preds)
    holt_mae = _mae(test, holt_test_preds)
    holt_mape = _mape(test, holt_test_preds)

    # Refit on full series for forward horizon
    full_level = series[0]
    full_trend = (series[-1] - series[0]) / max(len(series) - 1, 1)
    for val in series[1:]:
        prev_l = full_level
        full_level = alpha * val + (1 - alpha) * (full_level + full_trend)
        full_trend = beta * (full_level - prev_l) + (1 - beta) * full_trend

    full_sma = sum(series[-7:]) / min(len(series), 7)
    today = datetime.now(timezone.utc).date()
    forecast_points = []
    for d in range(1, horizon_days + 1):
        f_date = (today + timedelta(days=d)).isoformat()
        adv_val = round(max(full_level + d * full_trend, 0.0), 2)
        forecast_points.append(
            {
                "date": f_date,
                "day_offset": d,
                "baseline_sma_forecast": round(full_sma, 2),
                "advanced_holt_forecast": adv_val,
            }
        )

    selected_model = "HOLT_EXPONENTIAL_SMOOTHING" if holt_mae <= sma_mae else "SIMPLE_MOVING_AVERAGE"

    return {
        "selected_model": selected_model,
        "baseline_metrics": {"model": "7-Day Moving Average", "mae": sma_mae, "mape_percent": sma_mape},
        "advanced_metrics": {
            "model": "Holt Trend Exponential Smoothing",
            "mae": holt_mae,
            "mape_percent": holt_mape,
        },
        "forecast_14d_total": round(sum(p["advanced_holt_forecast"] for p in forecast_points), 2),
        "forecast_series": forecast_points,
    }


def generate_organization_inventory_forecasts(db: Session, organization_id: str) -> List[Dict[str, Any]]:
    """Compute SKU-level inventory forecasts and reorder calculations for an organisation."""
    products = (
        db.query(Product)
        .filter(Product.organization_id == organization_id, Product.is_active.is_(True))
        .order_by(Product.name.asc())
        .all()
    )
    results: List[Dict[str, Any]] = []
    for product in products:
        balances = (
            db.query(InventoryBalance)
            .filter(
                InventoryBalance.organization_id == organization_id,
                InventoryBalance.product_id == product.id,
            )
            .all()
        )
        total_on_hand = float(sum((b.on_hand_qty or Decimal("0")) for b in balances))

        out_movements = (
            db.query(StockMovement)
            .filter(
                StockMovement.organization_id == organization_id,
                StockMovement.product_id == product.id,
                StockMovement.movement_type == "OUT",
            )
            .order_by(StockMovement.created_at.asc())
            .all()
        )
        daily_demand = float(product.avg_daily_demand or Decimal("5.0"))
        series = [float(m.quantity) for m in out_movements] if out_movements else [
            round(daily_demand * f, 2) for f in (0.9, 1.05, 0.95, 1.1, 1.0, 0.92, 1.08, 1.04)
        ]

        supplier_lead_time = int(product.lead_time_days or 7)
        supplier_name = None
        if product.preferred_supplier_id:
            sup = db.query(Supplier).filter(Supplier.id == product.preferred_supplier_id).first()
            if sup:
                supplier_name = sup.name
                supplier_lead_time = int(sup.lead_time_days or supplier_lead_time)

        reorder_data = calculate_reorder_metrics(
            current_stock=total_on_hand,
            avg_daily_demand=daily_demand,
            lead_time_days=supplier_lead_time,
            safety_stock=float(product.safety_stock or Decimal("20.0")),
        )
        model_eval = evaluate_forecast_models(series, horizon_days=14)

        results.append(
            {
                "product_id": product.id,
                "sku": product.sku,
                "product_name": product.name,
                "category_name": product.category_name,
                "uom_symbol": product.uom_symbol,
                "unit_cost": float(product.unit_cost or 0),
                "preferred_supplier_name": supplier_name,
                **reorder_data,
                "forecast_evaluation": model_eval,
            }
        )
    return results

