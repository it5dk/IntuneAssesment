import uuid
from datetime import datetime, timezone
from sqlalchemy import Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Snapshot(Base):
    __tablename__ = "snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    monitor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("monitors.id"), nullable=False)
    resource_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    monitor = relationship("Monitor", back_populates="snapshots", foreign_keys=[monitor_id])
    items = relationship("SnapshotItem", back_populates="snapshot", cascade="all, delete-orphan")
