""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\models\drift.py
#  Description: (edit inside USER NOTES below)
# 
#  BEGIN AUTODOC META
#  Version: 0.0.0.3
#  Last-Updated: 2026-02-19 00:30:35
#  Managed-By: autosave.ps1
#  END AUTODOC META
# 
#  BEGIN USER NOTES
#  Your notes here. We will NEVER change this block.
#  END USER NOTES
""" END AUTODOC HEADER

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Drift(Base):
    __tablename__ = "drifts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    monitor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("monitors.id"), nullable=False)
    snapshot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("snapshots.id"), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(255), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(128), nullable=False)
    display_name: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    change_type: Mapped[str] = mapped_column(String(16), nullable=False)  # added|removed|modified
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="MEDIUM")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")  # active|resolved
    property_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    monitor = relationship("Monitor", back_populates="drifts")
    snapshot = relationship("Snapshot")
    items = relationship("DriftItem", back_populates="drift", cascade="all, delete-orphan")

