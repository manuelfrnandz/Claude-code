from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select

from apps.api.dependencies import DBSession, TenantID
from apps.api.models.lead import Lead

router = APIRouter()


class LeadUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    stage: str | None = None
    assigned_to: str | None = None
    notes: str | None = None
    custom_fields: dict | None = None


@router.get("")
async def list_leads(
    tenant_id: TenantID,
    db: DBSession,
    stage: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    q = select(Lead).where(Lead.tenant_id == uuid.UUID(tenant_id))
    if stage:
        q = q.where(Lead.stage == stage)
    q = q.order_by(Lead.last_contact_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    leads = result.scalars().all()

    count_q = select(func.count()).select_from(Lead).where(Lead.tenant_id == uuid.UUID(tenant_id))
    if stage:
        count_q = count_q.where(Lead.stage == stage)
    total = (await db.execute(count_q)).scalar()

    return {"items": leads, "total": total, "page": page, "page_size": page_size}


@router.get("/{lead_id}")
async def get_lead(lead_id: uuid.UUID, tenant_id: TenantID, db: DBSession):
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.tenant_id == uuid.UUID(tenant_id))
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.patch("/{lead_id}")
async def update_lead(lead_id: uuid.UUID, data: LeadUpdate, tenant_id: TenantID, db: DBSession):
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.tenant_id == uuid.UUID(tenant_id))
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(lead, field, value)

    if data.stage == "convertido" and not lead.converted_at:
        lead.converted_at = datetime.utcnow()

    return lead
