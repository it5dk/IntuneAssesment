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
