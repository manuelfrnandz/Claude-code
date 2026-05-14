import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from apps.api.db.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    plan: Mapped[str] = mapped_column(String(50), default="starter")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    messages_used_month: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class TenantConfig(Base):
    __tablename__ = "tenant_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True, unique=True)

    # WhatsApp
    wa_phone_number_id: Mapped[str | None] = mapped_column(String(50))
    wa_access_token: Mapped[str | None] = mapped_column(Text)  # encrypted at rest

    # Bot identity
    bot_name: Mapped[str | None] = mapped_column(String(100))
    business_name: Mapped[str] = mapped_column(String(255))
    business_description: Mapped[str | None] = mapped_column(Text)
    personality: Mapped[str] = mapped_column(String(50), default="amigable")
    language: Mapped[str] = mapped_column(String(20), default="español")

    # Contact & location
    location: Mapped[str | None] = mapped_column(Text)
    phone_human: Mapped[str | None] = mapped_column(String(30))
    website: Mapped[str | None] = mapped_column(String(255))
    notification_email: Mapped[str | None] = mapped_column(String(255))

    # Schedule: {"monday": {"open": "09:00", "close": "18:00"}, ...}
    schedule: Mapped[dict | None] = mapped_column(JSONB)

    # Catalog: [{"name": str, "price": float, "description": str, "category": str}]
    catalog_data: Mapped[list | None] = mapped_column(JSONB)

    # FAQs: [{"question": str, "answer": str}]
    faq_data: Mapped[list | None] = mapped_column(JSONB)

    # Enabled flows
    enabled_flows: Mapped[list | None] = mapped_column(ARRAY(String))  # ["orders", "appointments"]
    orders_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    appointments_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    # Escalation
    escalation_triggers: Mapped[list | None] = mapped_column(ARRAY(String))
    handoff_order_threshold: Mapped[float | None] = mapped_column(default=None)

    # Custom instructions (free-form text from business owner)
    custom_instructions: Mapped[str | None] = mapped_column(Text)

    # Welcome message sent on first contact
    welcome_message: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
