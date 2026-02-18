""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\schemas\snapshot.py
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
from typing import Any


class SnapshotItemOut(BaseModel):
    id: UUID
    resource_id: str
    resource_type: str
    display_name: str
    raw_json: dict[str, Any]
    normalized: dict[str, Any]
    hash: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SnapshotOut(BaseModel):
    id: UUID
    monitor_id: UUID
    resource_count: int
    created_at: datetime
    items: list[SnapshotItemOut] | None = None

    model_config = {"from_attributes": True}

