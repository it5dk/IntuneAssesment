from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.snapshot import Snapshot
from app.models.snapshot_item import SnapshotItem
from app.services.drift_engine import _diff_dicts

router = APIRouter(prefix="/compare", tags=["compare"])


class CompareRequest(BaseModel):
    snapshot_a_id: UUID
    snapshot_b_id: UUID
    resource_id: str | None = None  # Optional: compare specific resource


@router.post("")
async def compare_snapshots(req: CompareRequest, db: AsyncSession = Depends(get_db)):
    """Compare two snapshots side-by-side. Returns identical, modified, added, removed items."""
    snap_a = await db.get(Snapshot, req.snapshot_a_id)
    snap_b = await db.get(Snapshot, req.snapshot_b_id)
    if not snap_a or not snap_b:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    items_a_q = select(SnapshotItem).where(SnapshotItem.snapshot_id == req.snapshot_a_id)
    items_b_q = select(SnapshotItem).where(SnapshotItem.snapshot_id == req.snapshot_b_id)

    if req.resource_id:
        items_a_q = items_a_q.where(SnapshotItem.resource_id == req.resource_id)
        items_b_q = items_b_q.where(SnapshotItem.resource_id == req.resource_id)

    items_a = (await db.execute(items_a_q)).scalars().all()
    items_b = (await db.execute(items_b_q)).scalars().all()

    map_a = {i.resource_id: i for i in items_a}
    map_b = {i.resource_id: i for i in items_b}

    all_ids = set(list(map_a.keys()) + list(map_b.keys()))

    identical = []
    modified = []
    added = []
    removed = []

    for rid in sorted(all_ids):
        a = map_a.get(rid)
        b = map_b.get(rid)

        if a and not b:
            removed.append({
                "resource_id": rid,
                "display_name": a.display_name,
                "resource_type": a.resource_type,
                "snapshot": "a",
                "data": a.normalized,
            })
        elif b and not a:
            added.append({
                "resource_id": rid,
                "display_name": b.display_name,
                "resource_type": b.resource_type,
                "snapshot": "b",
                "data": b.normalized,
            })
        elif a.hash == b.hash:
            identical.append({
                "resource_id": rid,
                "display_name": a.display_name,
                "resource_type": a.resource_type,
            })
        else:
            diffs = _diff_dicts(a.normalized, b.normalized)
            modified.append({
                "resource_id": rid,
                "display_name": a.display_name,
                "resource_type": a.resource_type,
                "changes": diffs,
                "data_a": a.normalized,
                "data_b": b.normalized,
            })

    return {
        "snapshot_a": {"id": str(snap_a.id), "created_at": snap_a.created_at.isoformat(), "resource_count": snap_a.resource_count},
        "snapshot_b": {"id": str(snap_b.id), "created_at": snap_b.created_at.isoformat(), "resource_count": snap_b.resource_count},
        "summary": {
            "identical": len(identical),
            "modified": len(modified),
            "added": len(added),
            "removed": len(removed),
            "total_settings_analyzed": sum(len(m.get("changes", [])) for m in modified) + len(identical),
        },
        "identical": identical,
        "modified": modified,
        "added": added,
        "removed": removed,
    }
