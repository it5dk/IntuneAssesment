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
