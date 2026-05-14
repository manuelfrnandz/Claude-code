import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from apps.api.db.database import Base


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    phone_number: Mapped[str] = mapped_column(String(30), index=True)
    name: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    source: Mapped[str] = mapped_column(String(50), default="whatsapp_inbound")

    # Lead qualification
    intent_detected: Mapped[str | None] = mapped_column(String(50))
    stage: Mapped[str] = mapped_column(
        String(50), default="nuevo"
    )  # nuevo | calificado | convertido | perdido

    # Flexible extra fields per business
    custom_fields: Mapped[dict | None] = mapped_column(JSONB)

    # Timestamps
    first_contact_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_contact_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assigned_to: Mapped[str | None] = mapped_column(String(255))  # agent email/id

    notes: Mapped[str | None] = mapped_column(Text)
