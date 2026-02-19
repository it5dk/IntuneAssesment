""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\api\routes\configuration.py
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

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.snapshot import Snapshot
from app.models.snapshot_item import SnapshotItem
from app.models.monitor import Monitor
from app.models.template import Template

router = APIRouter(prefix="/configuration", tags=["configuration"])

CONFIG_RESOURCE_TYPES = [
    "microsoft.graph.deviceConfiguration",
    "microsoft.graph.deviceCompliancePolicy",
]


@router.get("/policies")
async def list_configuration_policies(
    platform: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all configuration and compliance policies from latest snapshots."""
    # Find monitors for config-related resource types
    monitor_q = (
        select(Monitor.id, Template.resource_type)
        .join(Template, Monitor.template_id == Template.id)
        .where(Template.resource_type.in_(CONFIG_RESOURCE_TYPES))
    )
    rows = (await db.execute(monitor_q)).all()
    if not rows:
        return {"policies": [], "total": 0}

    monitor_ids = [r[0] for r in rows]

    # Get latest snapshot per monitor
    policies = []
    for mid in monitor_ids:
        snap = (await db.execute(
            select(Snapshot)
            .where(Snapshot.monitor_id == mid)
            .order_by(Snapshot.created_at.desc())
            .limit(1)
        )).scalars().first()
        if not snap:
            continue

        items = (await db.execute(
            select(SnapshotItem).where(SnapshotItem.snapshot_id == snap.id)
        )).scalars().all()

        for item in items:
            norm = item.normalized or {}
            odata_type = norm.get("platform", norm.get("@odata.type", ""))

            if platform:
                if platform.lower() not in odata_type.lower():
                    continue
            if search:
                searchable = f"{norm.get('displayName', '')} {norm.get('description', '')}".lower()
                if search.lower() not in searchable:
                    continue

            policies.append({
                "id": item.resource_id,
                "display_name": norm.get("displayName", item.display_name),
                "description": norm.get("description", ""),
                "resource_type": item.resource_type,
                "platform": odata_type,
                "last_modified": norm.get("lastModifiedDateTime"),
                "version": norm.get("version"),
                "snapshot_id": str(snap.id),
            })

    return {"policies": policies, "total": len(policies)}


@router.get("/policies/{policy_id}/settings")
async def get_policy_settings(
    policy_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get granular settings for a specific configuration policy."""
    # Find the snapshot item for this policy
    item_q = (
        select(SnapshotItem)
        .where(
            SnapshotItem.resource_id == policy_id,
            SnapshotItem.resource_type.in_(CONFIG_RESOURCE_TYPES),
        )
        .order_by(SnapshotItem.created_at.desc())
        .limit(1)
    )
    item = (await db.execute(item_q)).scalars().first()
    if not item:
        return {"policy_id": policy_id, "settings": [], "raw": {}}

    # Extract settings from raw JSON (flatten key-value pairs that aren't metadata)
    raw = item.raw_json or {}
    skip_keys = {"id", "@odata.type", "displayName", "description", "createdDateTime",
                 "lastModifiedDateTime", "version", "roleScopeTagIds"}

    settings = []
    for key, value in raw.items():
        if key.startswith("@") or key in skip_keys:
            continue
        settings.append({
            "key": key,
            "value": value,
            "type": type(value).__name__,
        })

    return {
        "policy_id": policy_id,
        "display_name": item.display_name,
        "resource_type": item.resource_type,
        "platform": raw.get("@odata.type", ""),
        "settings": settings,
        "raw": raw,
        "normalized": item.normalized,
    }


@router.get("/summary")
async def configuration_summary(db: AsyncSession = Depends(get_db)):
    """Get summary of all configuration policies."""
    monitor_q = (
        select(Monitor.id, Template.resource_type)
        .join(Template, Monitor.template_id == Template.id)
        .where(Template.resource_type.in_(CONFIG_RESOURCE_TYPES))
    )
    rows = (await db.execute(monitor_q)).all()

    total = 0
    by_type: dict[str, int] = {}
    by_platform: dict[str, int] = {}

    for mid, rtype in rows:
        snap = (await db.execute(
            select(Snapshot)
            .where(Snapshot.monitor_id == mid)
            .order_by(Snapshot.created_at.desc())
            .limit(1)
        )).scalars().first()
        if not snap:
            continue

        items = (await db.execute(
            select(SnapshotItem).where(SnapshotItem.snapshot_id == snap.id)
        )).scalars().all()

        for item in items:
            total += 1
            by_type[item.resource_type] = by_type.get(item.resource_type, 0) + 1
            plat = (item.normalized or {}).get("platform", "Unknown")
            by_platform[plat] = by_platform.get(plat, 0) + 1

    return {"total": total, "by_type": by_type, "by_platform": by_platform}


