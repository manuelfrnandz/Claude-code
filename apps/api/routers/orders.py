from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select

from apps.api.dependencies import DBSession, TenantID
from apps.api.models.order import Order

router = APIRouter()

VALID_STATUSES = {"pending", "confirmed", "preparing", "ready", "delivered", "cancelled"}


class OrderStatusUpdate(BaseModel):
    status: str


@router.get("")
async def list_orders(
    tenant_id: TenantID,
    db: DBSession,
    order_status: str | None = Query(None, alias="status"),
    date: str | None = Query(None, description="Filter by date YYYY-MM-DD"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    q = select(Order).where(Order.tenant_id == uuid.UUID(tenant_id))
    if order_status:
        q = q.where(Order.status == order_status)
    q = q.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    orders = result.scalars().all()

    count_q = select(func.count()).select_from(Order).where(Order.tenant_id == uuid.UUID(tenant_id))
    total = (await db.execute(count_q)).scalar()

    return {"items": orders, "total": total, "page": page, "page_size": page_size}


@router.get("/summary")
async def orders_summary(tenant_id: TenantID, db: DBSession, date: str | None = Query(None)):
    """Daily summary: total orders, revenue, avg ticket."""
    q = select(
        func.count(Order.id).label("total_orders"),
        func.sum(Order.total).label("total_revenue"),
        func.avg(Order.total).label("avg_ticket"),
    ).where(Order.tenant_id == uuid.UUID(tenant_id))

    result = await db.execute(q)
    row = result.one()
    return {
        "total_orders": row.total_orders or 0,
        "total_revenue": float(row.total_revenue or 0),
        "avg_ticket": float(row.avg_ticket or 0),
    }


@router.get("/{order_id}")
async def get_order(order_id: uuid.UUID, tenant_id: TenantID, db: DBSession):
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.tenant_id == uuid.UUID(tenant_id))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: uuid.UUID,
    data: OrderStatusUpdate,
    tenant_id: TenantID,
    db: DBSession,
):
    if data.status not in VALID_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid status: {data.status}")

    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.tenant_id == uuid.UUID(tenant_id))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    order.status = data.status
    now = datetime.now(timezone.utc)
    if data.status == "confirmed":
        order.confirmed_at = now
    elif data.status in ("delivered", "cancelled"):
        order.completed_at = now

    return order
