""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\models\template.py
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
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    icon_key: Mapped[str] = mapped_column(String(64), nullable=False, default="shield")
    product_tag: Mapped[str] = mapped_column(String(32), nullable=False)  # entra | intune
    resource_type: Mapped[str] = mapped_column(String(128), nullable=False)
    graph_endpoints: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    default_schedule_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=24)
    default_ignore_rules: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    default_severity: Mapped[str] = mapped_column(String(16), nullable=False, default="MEDIUM")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    monitors = relationship("Monitor", back_populates="template")


