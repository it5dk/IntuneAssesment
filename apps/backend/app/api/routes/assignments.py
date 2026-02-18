from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.snapshot import Snapshot
from app.models.snapshot_item import SnapshotItem
from app.models.monitor import Monitor
from app.models.template import Template

router = APIRouter(prefix="/assignments", tags=["assignments"])


async def _get_latest_items(db: AsyncSession, resource_type: str) -> list[SnapshotItem]:
    """Get items from the latest snapshot for a given resource type."""
    monitor_q = (
        select(Monitor.id)
        .join(Template, Monitor.template_id == Template.id)
        .where(Template.resource_type == resource_type)
    )
    monitor_ids = (await db.execute(monitor_q)).scalars().all()
    if not monitor_ids:
        return []

    all_items = []
    for mid in monitor_ids:
        snap = (await db.execute(
            select(Snapshot)
            .where(Snapshot.monitor_id == mid)
            .order_by(Snapshot.created_at.desc())
            .limit(1)
        )).scalars().first()
        if snap:
            items = (await db.execute(
                select(SnapshotItem).where(SnapshotItem.snapshot_id == snap.id)
            )).scalars().all()
            all_items.extend(items)
    return all_items


@router.get("/all")
async def all_assignments(
    type_filter: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Get all assignments (app + group) in a unified view."""
    app_items = await _get_latest_items(db, "microsoft.graph.mobileAppAssessment")
    group_items = await _get_latest_items(db, "intune.groupAssignment")

    assignments = []

    for item in app_items:
        norm = item.normalized or {}
        if type_filter and type_filter != "app":
            continue
        for a in norm.get("assignments", []):
            target = a.get("target", {})
            entry = {
                "type": "app",
                "source_name": norm.get("displayName", item.display_name),
                "source_id": item.resource_id,
                "intent": a.get("intent", ""),
                "target_type": target.get("@odata.type", ""),
                "target_group_id": target.get("groupId"),
            }
            if search and search.lower() not in entry["source_name"].lower():
                continue
            assignments.append(entry)

    for item in group_items:
        norm = item.normalized or {}
        if type_filter and type_filter != "group":
            continue
        for a in norm.get("assignments", []):
            entry = {
                "type": "group_policy",
                "source_name": a.get("policy_name", ""),
                "source_id": a.get("policy_id", ""),
                "intent": a.get("intent", "apply"),
                "target_type": a.get("target_type", ""),
                "target_group_id": item.resource_id,
                "policy_type": a.get("policy_type", ""),
            }
            if search and search.lower() not in entry["source_name"].lower():
                continue
            assignments.append(entry)

    return {"assignments": assignments, "total": len(assignments)}


@router.get("/apps")
async def app_assignments(
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List app assignments with per-app grouping."""
    items = await _get_latest_items(db, "microsoft.graph.mobileAppAssessment")

    apps = []
    for item in items:
        norm = item.normalized or {}
        if search and search.lower() not in (norm.get("displayName", "") or "").lower():
            continue
        app_assignments_list = []
        for a in norm.get("assignments", []):
            target = a.get("target", {})
            app_assignments_list.append({
                "intent": a.get("intent", ""),
                "target_type": target.get("@odata.type", ""),
                "target_group_id": target.get("groupId"),
            })
        apps.append({
            "id": item.resource_id,
            "display_name": norm.get("displayName", item.display_name),
            "publisher": norm.get("publisher", ""),
            "assignment_count": len(app_assignments_list),
            "assignments": app_assignments_list,
        })

    return {"apps": apps, "total": len(apps)}


@router.get("/groups")
async def group_assignments(
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List assignments grouped by target group."""
    items = await _get_latest_items(db, "intune.groupAssignment")

    groups = []
    for item in items:
        norm = item.normalized or {}
        assignments_list = norm.get("assignments", [])
        if search:
            matches = any(search.lower() in a.get("policy_name", "").lower() for a in assignments_list)
            if not matches and search.lower() not in item.resource_id.lower():
                continue
        groups.append({
            "group_id": item.resource_id,
            "assignment_count": norm.get("assignment_count", len(assignments_list)),
            "assignments": assignments_list,
        })

    return {"groups": groups, "total": len(groups)}
