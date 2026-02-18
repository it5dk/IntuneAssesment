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
