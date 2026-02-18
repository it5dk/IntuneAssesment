import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class DriftItem(Base):
    __tablename__ = "drift_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drift_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drifts.id"), nullable=False)
    json_path: Mapped[str] = mapped_column(String(512), nullable=False)
    change_type: Mapped[str] = mapped_column(String(16), nullable=False)  # added|removed|modified
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    drift = relationship("Drift", back_populates="items")
