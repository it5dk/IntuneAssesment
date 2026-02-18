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
