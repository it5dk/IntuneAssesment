""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\schemas\overview.py
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

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class RecentDrift(BaseModel):
    id: UUID
    display_name: str
    resource_type: str
    property_count: int
    severity: str
    status: str
    detected_at: datetime


class MonitorStatus(BaseModel):
    id: UUID
    name: str
    product_tag: str
    resource_count: int
    schedule_hours: int
    enabled: bool
    last_run_status: str | None = None
    last_run_at: datetime | None = None


class OverviewOut(BaseModel):
    active_monitors_count: int
    active_drifts_count: int
    resources_monitored_count: int
    success_rate: float
    recent_drifts: list[RecentDrift]
    monitor_status: list[MonitorStatus]

