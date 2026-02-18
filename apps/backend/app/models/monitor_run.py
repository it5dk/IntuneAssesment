""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\models\monitor_run.py
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
from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class MonitorRun(Base):
    __tablename__ = "monitor_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    monitor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("monitors.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="started")  # started|success|failure
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    snapshot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("snapshots.id", use_alter=True), nullable=True)

    monitor = relationship("Monitor", back_populates="runs")
    snapshot = relationship("Snapshot", foreign_keys=[snapshot_id], post_update=True)

