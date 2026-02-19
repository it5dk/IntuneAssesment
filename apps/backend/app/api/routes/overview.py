""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\api\routes\overview.py
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

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.monitor import Monitor
from app.models.monitor_run import MonitorRun
from app.models.drift import Drift
from app.models.snapshot import Snapshot
from app.models.snapshot_item import SnapshotItem
from app.schemas.overview import OverviewOut, RecentDrift, MonitorStatus

router = APIRouter(tags=["overview"])


@router.get("/overview", response_model=OverviewOut)
async def get_overview(db: AsyncSession = Depends(get_db)):
    # Active monitors
    active_monitors = (await db.execute(
        select(func.count()).select_from(Monitor).where(Monitor.enabled == True)
    )).scalar() or 0

    # Active drifts
    active_drifts = (await db.execute(
        select(func.count()).select_from(Drift).where(Drift.status == "active")
    )).scalar() or 0

    # Resources monitored: unique resource IDs from latest snapshots per monitor
    # For simplicity, count all snapshot items from the most recent snapshots
    monitors_result = await db.execute(select(Monitor).options(selectinload(Monitor.snapshots)))
    monitors = monitors_result.scalars().unique().all()

    resources_monitored = 0
    for m in monitors:
        if m.snapshots:
            latest = sorted(m.snapshots, key=lambda s: s.created_at, reverse=True)[0]
            resources_monitored += latest.resource_count

    # Success rate from last 50 runs
    runs_result = await db.execute(
        select(MonitorRun).order_by(MonitorRun.started_at.desc()).limit(50)
    )
    runs = runs_result.scalars().all()
    if runs:
        successes = sum(1 for r in runs if r.status == "success")
        success_rate = round(successes / len(runs) * 100, 1)
    else:
        success_rate = 100.0

    # Recent drifts (top 10)
    drifts_result = await db.execute(
        select(Drift).order_by(Drift.detected_at.desc()).limit(10)
    )
    recent_drifts_raw = drifts_result.scalars().all()
    recent_drifts = [
        RecentDrift(
            id=d.id,
            display_name=d.display_name,
            resource_type=d.resource_type,
            property_count=d.property_count,
            severity=d.severity,
            status=d.status,
            detected_at=d.detected_at,
        )
        for d in recent_drifts_raw
    ]

    # Monitor status list
    monitors_full = await db.execute(
        select(Monitor)
        .options(selectinload(Monitor.template), selectinload(Monitor.runs), selectinload(Monitor.snapshots))
    )
    all_monitors = monitors_full.scalars().unique().all()
    monitor_status = []
    for m in all_monitors:
        # Prefer most recent completed run, fall back to most recent overall
        last_run = None
        if m.runs:
            for run in m.runs:
                if run.status in ("success", "failure"):
                    last_run = run
                    break
            if not last_run:
                last_run = m.runs[0]
        rc = 0
        if m.snapshots:
            latest = sorted(m.snapshots, key=lambda s: s.created_at, reverse=True)
            if latest:
                rc = latest[0].resource_count
        monitor_status.append(MonitorStatus(
            id=m.id,
            name=m.name,
            product_tag=m.template.product_tag if m.template else "",
            resource_count=rc,
            schedule_hours=m.schedule_hours,
            enabled=m.enabled,
            last_run_status=last_run.status if last_run else None,
            last_run_at=last_run.started_at if last_run else None,
        ))

    return OverviewOut(
        active_monitors_count=active_monitors,
        active_drifts_count=active_drifts,
        resources_monitored_count=resources_monitored,
        success_rate=success_rate,
        recent_drifts=recent_drifts,
        monitor_status=monitor_status,
    )


