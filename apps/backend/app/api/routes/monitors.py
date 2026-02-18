from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.template import Template
from app.models.monitor import Monitor
from app.models.monitor_run import MonitorRun
from app.models.snapshot import Snapshot
from app.schemas.monitor import MonitorCreate, MonitorUpdate, MonitorOut, MonitorRunOut

router = APIRouter(prefix="/monitors", tags=["monitors"])


def _enrich_monitor(monitor: Monitor) -> dict:
    """Add computed fields to monitor output."""
    # Prefer most recent completed run, fall back to most recent overall
    last_run = None
    if monitor.runs:
        # Try to find most recent terminal run first
        for run in monitor.runs:
            if run.status in ("success", "failure"):
                last_run = run
                break
        # If no terminal runs, use most recent (might be "started")
        if not last_run:
            last_run = monitor.runs[0]
    # Count resources from latest snapshot
    resource_count = 0
    if monitor.snapshots:
        latest = sorted(monitor.snapshots, key=lambda s: s.created_at, reverse=True)
        if latest:
            resource_count = latest[0].resource_count
    return MonitorOut(
        id=monitor.id,
        template_id=monitor.template_id,
        name=monitor.name,
        description=monitor.description,
        schedule_hours=monitor.schedule_hours,
        enabled=monitor.enabled,
        scope=monitor.scope,
        ignore_rules=monitor.ignore_rules,
        baseline_snapshot_id=monitor.baseline_snapshot_id,
        created_at=monitor.created_at,
        updated_at=monitor.updated_at,
        product_tag=monitor.template.product_tag if monitor.template else None,
        resource_type=monitor.template.resource_type if monitor.template else None,
        last_run=MonitorRunOut.model_validate(last_run) if last_run else None,
        resource_count=resource_count,
    )


@router.get("", response_model=list[MonitorOut])
async def list_monitors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Monitor)
        .options(selectinload(Monitor.template), selectinload(Monitor.runs), selectinload(Monitor.snapshots))
        .order_by(Monitor.created_at.desc())
    )
    monitors = result.scalars().unique().all()
    return [_enrich_monitor(m) for m in monitors]


@router.post("", response_model=MonitorOut)
async def create_monitor(data: MonitorCreate, db: AsyncSession = Depends(get_db)):
    tpl = await db.get(Template, data.template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    monitor = Monitor(
        template_id=data.template_id,
        name=data.name,
        description=data.description,
        schedule_hours=data.schedule_hours or tpl.default_schedule_hours,
        enabled=data.enabled,
        scope=data.scope,
        ignore_rules=data.ignore_rules or tpl.default_ignore_rules,
    )
    db.add(monitor)
    await db.flush()
    await db.refresh(monitor, ["template", "runs", "snapshots"])
    return _enrich_monitor(monitor)


@router.get("/{monitor_id}", response_model=MonitorOut)
async def get_monitor(monitor_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Monitor)
        .where(Monitor.id == monitor_id)
        .options(selectinload(Monitor.template), selectinload(Monitor.runs), selectinload(Monitor.snapshots))
    )
    monitor = result.scalars().first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    return _enrich_monitor(monitor)


@router.patch("/{monitor_id}", response_model=MonitorOut)
async def update_monitor(monitor_id: UUID, data: MonitorUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Monitor)
        .where(Monitor.id == monitor_id)
        .options(selectinload(Monitor.template), selectinload(Monitor.runs), selectinload(Monitor.snapshots))
    )
    monitor = result.scalars().first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(monitor, field, value)

    await db.flush()
    await db.refresh(monitor, ["template", "runs", "snapshots"])
    return _enrich_monitor(monitor)


@router.post("/{monitor_id}/run", response_model=MonitorRunOut)
async def run_monitor(monitor_id: UUID, db: AsyncSession = Depends(get_db)):
    monitor = await db.get(Monitor, monitor_id)
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    # Create the run record here so we can return it immediately
    run = MonitorRun(monitor_id=monitor_id, status="started")
    db.add(run)
    await db.flush()

    # Trigger celery task with the run_id so it updates the same record
    from app.tasks.monitor_task import run_monitor_task
    run_monitor_task.delay(str(monitor_id), str(run.id))

    return run
