""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\api\routes\devices.py
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

import json
from datetime import datetime, timezone
from pathlib import Path
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
DEVICES_GUIDANCE_URL = "https://learn.microsoft.com/en-us/intune/intune-service/protect/zero-trust-configure-security?toc=%2Fsecurity%2Fzero-trust%2Fassessment%2Ftoc.json&bc=%2Fsecurity%2Fzero-trust%2Fassessment%2Ftoc.json"
ZTA_SOURCE_URL = "https://github.com/microsoft/zerotrustassessment/tree/psnext/src/powershell"
TEST_META_PATH = Path(__file__).resolve().parents[2] / "data" / "zerotrust_testmeta.json"


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


@router.get("/run")
async def run_devices_guidance_check():
    if not TEST_META_PATH.exists():
        return {
            "run_at": datetime.now(timezone.utc).isoformat(),
            "source_url": DEVICES_GUIDANCE_URL,
            "zta_source_url": ZTA_SOURCE_URL,
            "summary": {"total_controls": 0, "high_priority": 0, "medium_priority": 0},
            "controls": [],
            "ideas_to_add_more": ["Devices metadata source file is missing. Re-sync from zerotrustassessment psnext."],
            "error": f"Missing file: {TEST_META_PATH}",
        }

    with TEST_META_PATH.open("r", encoding="utf-8") as f:
        meta = json.load(f)

    device_checks = []
    for test_id, item in meta.items():
        if str(item.get("Pillar", "")).lower() != "devices":
            continue
        risk = str(item.get("RiskLevel", "Medium")).lower()
        priority = "high" if risk == "high" else "medium" if risk == "medium" else "low"
        device_checks.append({
            "id": str(item.get("TestId", test_id)),
            "control": item.get("Title", f"Test {test_id}"),
            "license": f"Tenant: {', '.join(item.get('TenantType', []))}" if item.get("TenantType") else "Tenant: N/A",
            "priority": priority,
            "category": item.get("Category", "General"),
            "implementation_cost": item.get("ImplementationCost", "Unknown"),
            "user_impact": item.get("UserImpact", "Unknown"),
            "sfi_pillar": item.get("SfiPillar", "Devices"),
        })

    device_checks.sort(key=lambda x: int(x["id"]) if x["id"].isdigit() else 999999)

    themes = {}
    for check in device_checks:
        theme = check["sfi_pillar"] or "Devices"
        themes.setdefault(theme, []).append(check)

    controls = [{"theme": theme, "checks": checks} for theme, checks in themes.items()]

    total = len(device_checks)
    high = sum(1 for c in device_checks if c["priority"] == "high")
    medium = sum(1 for c in device_checks if c["priority"] == "medium")
    low = sum(1 for c in device_checks if c["priority"] == "low")

    ideas_to_add = [
        "Track compliance drift by platform and ownership type.",
        "Alert on unmanaged or stale devices with high-risk posture.",
        "Map each failing control to an Intune remediation profile.",
        "Publish weekly device security score and trend delta.",
    ]

    return {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "source_url": DEVICES_GUIDANCE_URL,
        "zta_source_url": ZTA_SOURCE_URL,
        "summary": {"total_controls": total, "high_priority": high, "medium_priority": medium},
        "breakdown": {"high": high, "medium": medium, "low": low},
        "controls": controls,
        "ideas_to_add_more": ideas_to_add,
    }

