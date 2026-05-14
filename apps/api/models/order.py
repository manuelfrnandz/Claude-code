import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from apps.api.db.database import Base


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    # Order number (human-readable, auto-generated)
    order_number: Mapped[str] = mapped_column(String(20), index=True, unique=True)

    # Status
    status: Mapped[str] = mapped_column(
        String(50), default="pending"
    )  # pending | confirmed | preparing | ready | delivered | cancelled

    # Items: [{"name": str, "quantity": int, "unit_price": float, "notes": str}]
    items: Mapped[list] = mapped_column(JSONB, default=list)

    # Pricing
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    discount: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)

    # Payment
    payment_method: Mapped[str | None] = mapped_column(String(50))
    payment_status: Mapped[str] = mapped_column(
        String(50), default="pending"
    )  # pending | paid | refunded

    # Delivery
    delivery_type: Mapped[str] = mapped_column(String(20), default="pickup")  # pickup | delivery
    delivery_address: Mapped[dict | None] = mapped_column(JSONB)
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    notes: Mapped[str | None] = mapped_column(Text)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
