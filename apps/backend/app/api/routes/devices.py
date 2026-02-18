from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.models.snapshot import Snapshot
from app.models.snapshot_item import SnapshotItem
from app.models.monitor import Monitor
from app.models.template import Template

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("")
async def list_devices(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=10, le=500),
    compliance_state: str | None = Query(None),
    os: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List managed devices from the latest device monitor snapshot.
    Supports pagination, compliance filtering, OS filtering, and search.
    """
    # Find the latest snapshot from a managedDevice monitor
    monitor_q = (
        select(Monitor.id)
        .join(Template, Monitor.template_id == Template.id)
        .where(Template.resource_type == "microsoft.graph.managedDevice")
    )
    monitor_ids = (await db.execute(monitor_q)).scalars().all()

    if not monitor_ids:
        return {"devices": [], "total": 0, "page": page, "page_size": page_size}

    # Get latest snapshot
    snap_q = (
        select(Snapshot)
        .where(Snapshot.monitor_id.in_(monitor_ids))
        .order_by(Snapshot.created_at.desc())
        .limit(1)
    )
    snapshot = (await db.execute(snap_q)).scalars().first()
    if not snapshot:
        return {"devices": [], "total": 0, "page": page, "page_size": page_size}

    # Query items with filters
    items_q = select(SnapshotItem).where(
        SnapshotItem.snapshot_id == snapshot.id,
        SnapshotItem.resource_type == "microsoft.graph.managedDevice",
    )

    result = await db.execute(items_q)
    all_items = result.scalars().all()

    # In-memory filtering (JSONB fields)
    devices = []
    for item in all_items:
        norm = item.normalized or {}
        if compliance_state and norm.get("complianceState") != compliance_state:
            continue
        if os and os.lower() not in (norm.get("operatingSystem", "") or "").lower():
            continue
        if search:
            searchable = f"{norm.get('deviceName', '')} {norm.get('userPrincipalName', '')} {norm.get('serialNumber', '')}".lower()
            if search.lower() not in searchable:
                continue
        devices.append({
            "id": item.resource_id,
            "device_name": norm.get("deviceName", ""),
            "os": norm.get("operatingSystem", ""),
            "os_version": norm.get("osVersion", ""),
            "compliance_state": norm.get("complianceState", "unknown"),
            "is_encrypted": norm.get("isEncrypted", False),
            "model": norm.get("model", ""),
            "manufacturer": norm.get("manufacturer", ""),
            "serial_number": norm.get("serialNumber", ""),
            "user": norm.get("userPrincipalName", ""),
            "enrolled": norm.get("enrolledDateTime"),
            "last_sync": norm.get("lastSyncDateTime"),
            "management_agent": norm.get("managementAgent", ""),
        })

    total = len(devices)
    start = (page - 1) * page_size
    end = start + page_size

    return {
        "devices": devices[start:end],
        "total": total,
        "page": page,
        "page_size": page_size,
        "snapshot_id": str(snapshot.id),
        "snapshot_at": snapshot.created_at.isoformat(),
    }


@router.get("/summary")
async def device_summary(db: AsyncSession = Depends(get_db)):
    """Get device compliance and OS summary stats."""
    monitor_q = (
        select(Monitor.id)
        .join(Template, Monitor.template_id == Template.id)
        .where(Template.resource_type == "microsoft.graph.managedDevice")
    )
    monitor_ids = (await db.execute(monitor_q)).scalars().all()

    if not monitor_ids:
        return {"total": 0, "compliance": {}, "os_breakdown": {}, "encryption": {"encrypted": 0, "not_encrypted": 0}}

    snap_q = (
        select(Snapshot)
        .where(Snapshot.monitor_id.in_(monitor_ids))
        .order_by(Snapshot.created_at.desc())
        .limit(1)
    )
    snapshot = (await db.execute(snap_q)).scalars().first()
    if not snapshot:
        return {"total": 0, "compliance": {}, "os_breakdown": {}, "encryption": {"encrypted": 0, "not_encrypted": 0}}

    items_q = select(SnapshotItem).where(
        SnapshotItem.snapshot_id == snapshot.id,
        SnapshotItem.resource_type == "microsoft.graph.managedDevice",
    )
    items = (await db.execute(items_q)).scalars().all()

    compliance: dict[str, int] = {}
    os_breakdown: dict[str, int] = {}
    encrypted = 0
    not_encrypted = 0

    for item in items:
        norm = item.normalized or {}
        cs = norm.get("complianceState", "unknown")
        compliance[cs] = compliance.get(cs, 0) + 1
        os_name = norm.get("operatingSystem", "Unknown")
        os_breakdown[os_name] = os_breakdown.get(os_name, 0) + 1
        if norm.get("isEncrypted"):
            encrypted += 1
        else:
            not_encrypted += 1

    return {
        "total": len(items),
        "compliance": compliance,
        "os_breakdown": os_breakdown,
        "encryption": {"encrypted": encrypted, "not_encrypted": not_encrypted},
    }
