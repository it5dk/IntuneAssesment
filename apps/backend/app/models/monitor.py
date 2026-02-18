""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\models\monitor.py
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
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Monitor(Base):
    __tablename__ = "monitors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("templates.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(1024), nullable=False, default="")
    schedule_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=24)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    scope: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ignore_rules: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    baseline_snapshot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("snapshots.id", use_alter=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    template = relationship("Template", back_populates="monitors")
    runs = relationship("MonitorRun", back_populates="monitor", order_by="MonitorRun.started_at.desc()")
    snapshots = relationship("Snapshot", back_populates="monitor", foreign_keys="Snapshot.monitor_id")
    baseline_snapshot = relationship("Snapshot", foreign_keys=[baseline_snapshot_id], post_update=True)
    drifts = relationship("Drift", back_populates="monitor")

