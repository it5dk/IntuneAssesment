""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\schemas\drift.py
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


class DriftItemOut(BaseModel):
    id: UUID
    json_path: str
    change_type: str
    old_value: str | None = None
    new_value: str | None = None

    model_config = {"from_attributes": True}


class DriftOut(BaseModel):
    id: UUID
    monitor_id: UUID
    snapshot_id: UUID
    resource_id: str
    resource_type: str
    display_name: str
    change_type: str
    severity: str
    status: str
    property_count: int
    detected_at: datetime
    resolved_at: datetime | None = None
    items: list[DriftItemOut] | None = None

    model_config = {"from_attributes": True}

