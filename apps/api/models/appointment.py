import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from apps.api.db.database import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    service: Mapped[str] = mapped_column(String(255))
    customer_name: Mapped[str | None] = mapped_column(String(255))
    customer_phone: Mapped[str] = mapped_column(String(30))

    # When
    requested_date: Mapped[str] = mapped_column(String(10))   # YYYY-MM-DD
    requested_time: Mapped[str] = mapped_column(String(5))    # HH:MM
    confirmed_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    status: Mapped[str] = mapped_column(
        String(30), default="pending"
    )  # pending | confirmed | cancelled | completed | no_show

    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
