""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\api\routes\snapshots.py
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

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.snapshot import Snapshot
from app.models.monitor import Monitor
from app.schemas.snapshot import SnapshotOut

router = APIRouter(prefix="/snapshots", tags=["snapshots"])


@router.get("", response_model=list[SnapshotOut])
async def list_snapshots(
    monitorId: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(Snapshot).options(selectinload(Snapshot.items)).order_by(Snapshot.created_at.desc())
    if monitorId:
        q = q.where(Snapshot.monitor_id == monitorId)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{snapshot_id}", response_model=SnapshotOut)
async def get_snapshot(snapshot_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Snapshot)
        .where(Snapshot.id == snapshot_id)
        .options(selectinload(Snapshot.items))
    )
    snapshot = result.scalars().first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snapshot


@router.post("/{snapshot_id}/baseline")
async def set_baseline(snapshot_id: UUID, db: AsyncSession = Depends(get_db)):
    snapshot = await db.get(Snapshot, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    monitor = await db.get(Monitor, snapshot.monitor_id)
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    monitor.baseline_snapshot_id = snapshot_id
    await db.flush()
    return {"status": "ok", "baseline_snapshot_id": str(snapshot_id)}

