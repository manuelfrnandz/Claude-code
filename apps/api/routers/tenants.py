from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from apps.api.dependencies import DBSession
from apps.api.models.tenant import Tenant, TenantConfig

router = APIRouter()


class TenantConfigUpdate(BaseModel):
    bot_name: str | None = None
    business_name: str | None = None
    business_description: str | None = None
    personality: str | None = None
    language: str | None = None
    location: str | None = None
    phone_human: str | None = None
    website: str | None = None
    notification_email: str | None = None
    schedule: dict | None = None
    catalog_data: list | None = None
    faq_data: list | None = None
    enabled_flows: list[str] | None = None
    orders_enabled: bool | None = None
    appointments_enabled: bool | None = None
    escalation_triggers: list[str] | None = None
    custom_instructions: str | None = None
    welcome_message: str | None = None


@router.get("/{tenant_id}/config")
async def get_tenant_config(tenant_id: uuid.UUID, db: DBSession):
    result = await db.execute(
        select(TenantConfig).where(TenantConfig.tenant_id == tenant_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config not found")
    return config


@router.put("/{tenant_id}/config")
async def upsert_tenant_config(tenant_id: uuid.UUID, data: TenantConfigUpdate, db: DBSession):
    result = await db.execute(
        select(TenantConfig).where(TenantConfig.tenant_id == tenant_id)
    )
    config = result.scalar_one_or_none()

    if config is None:
        config = TenantConfig(tenant_id=tenant_id)
        db.add(config)

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(config, field, value)

    await db.flush()
    return config
