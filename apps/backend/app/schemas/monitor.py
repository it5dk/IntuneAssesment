""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\schemas\monitor.py
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

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Any


class MonitorCreate(BaseModel):
    template_id: UUID
    name: str
    description: str = ""
    schedule_hours: int | None = None
    enabled: bool = True
    scope: dict | None = None
    ignore_rules: list[Any] = []


class MonitorUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    schedule_hours: int | None = None
    enabled: bool | None = None
    scope: dict | None = None
    ignore_rules: list[Any] | None = None


class MonitorRunOut(BaseModel):
    id: UUID
    monitor_id: UUID
    status: str
    started_at: datetime
    finished_at: datetime | None = None
    error: str | None = None
    snapshot_id: UUID | None = None

    model_config = {"from_attributes": True}


class MonitorOut(BaseModel):
    id: UUID
    template_id: UUID
    name: str
    description: str
    schedule_hours: int
    enabled: bool
    scope: dict | None = None
    ignore_rules: list[Any]
    baseline_snapshot_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    product_tag: str | None = None
    resource_type: str | None = None
    last_run: MonitorRunOut | None = None
    resource_count: int = 0

    model_config = {"from_attributes": True}


