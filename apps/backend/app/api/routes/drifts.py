""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\api\routes\drifts.py
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

from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.drift import Drift
from app.schemas.drift import DriftOut

router = APIRouter(prefix="/drifts", tags=["drifts"])


@router.get("", response_model=list[DriftOut])
async def list_drifts(
    status: str | None = Query(None),
    monitorId: UUID | None = Query(None),
    severity: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(Drift).options(selectinload(Drift.items)).order_by(Drift.detected_at.desc())
    if status:
        q = q.where(Drift.status == status)
    if monitorId:
        q = q.where(Drift.monitor_id == monitorId)
    if severity:
        q = q.where(Drift.severity == severity)
    result = await db.execute(q)
    return result.scalars().unique().all()


@router.get("/{drift_id}", response_model=DriftOut)
async def get_drift(drift_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Drift)
        .where(Drift.id == drift_id)
        .options(selectinload(Drift.items))
    )
    drift = result.scalars().first()
    if not drift:
        raise HTTPException(status_code=404, detail="Drift not found")
    return drift


@router.post("/{drift_id}/resolve")
async def resolve_drift(drift_id: UUID, db: AsyncSession = Depends(get_db)):
    drift = await db.get(Drift, drift_id)
    if not drift:
        raise HTTPException(status_code=404, detail="Drift not found")

    drift.status = "resolved"
    drift.resolved_at = datetime.now(timezone.utc)
    await db.flush()
    return {"status": "ok", "drift_id": str(drift_id)}


