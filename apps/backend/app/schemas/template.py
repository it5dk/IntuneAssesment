""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\schemas\template.py
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


class TemplateOut(BaseModel):
    id: UUID
    name: str
    description: str
    icon_key: str
    product_tag: str
    resource_type: str
    graph_endpoints: list[str]
    default_schedule_hours: int
    default_ignore_rules: list[Any]
    default_severity: str
    created_at: datetime

    model_config = {"from_attributes": True}

