""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\tasks\monitor_task.py
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

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.tasks.celery_app import celery_app
from app.core.database import Base
from app.models.monitor import Monitor
from app.models.monitor_run import MonitorRun
from app.models.snapshot import Snapshot
from app.models.snapshot_item import SnapshotItem
from app.models.drift import Drift
from app.collectors import COLLECTOR_MAP
from app.services.drift_engine import compute_drift

logger = logging.getLogger(__name__)

# Sync engine for Celery workers (Celery doesn't play well with asyncio sessions)
sync_engine = create_engine(settings.DATABASE_URL_SYNC, pool_pre_ping=True)


def _run_async(coro):
    """Helper to run async collector from sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(bind=True, name="run_monitor_task", max_retries=0)
def run_monitor_task(self, monitor_id: str, run_id: str | None = None):
    logger.info("Starting monitor run for %s (run_id=%s)", monitor_id, run_id)
    mid = uuid.UUID(monitor_id)

    with Session(sync_engine) as db:
        monitor = db.execute(
            select(Monitor).where(Monitor.id == mid).options(selectinload(Monitor.template))
        ).scalars().first()

        if not monitor:
            logger.error("Monitor %s not found", monitor_id)
            return

        # Reuse existing run record or create a new one
        if run_id:
            rid = uuid.UUID(run_id)
            run = db.get(MonitorRun, rid)
            if not run:
                run = MonitorRun(id=rid, monitor_id=mid, status="started")
                db.add(run)
                db.flush()
        else:
            run = MonitorRun(monitor_id=mid, status="started")
            db.add(run)
            db.flush()

        run_id_actual = run.id

        try:
            resource_type = monitor.template.resource_type
            collector_fn = COLLECTOR_MAP.get(resource_type)
            if not collector_fn:
                raise ValueError(f"No collector for resource type: {resource_type}")

            # Run the async collector
            items_data = _run_async(collector_fn())

            # Create snapshot
            snapshot = Snapshot(monitor_id=mid, resource_count=len(items_data))
            db.add(snapshot)
            db.flush()

            # Create snapshot items
            for item in items_data:
                si = SnapshotItem(
                    snapshot_id=snapshot.id,
                    resource_id=item["resource_id"],
                    resource_type=item["resource_type"],
                    display_name=item["display_name"],
                    raw_json=item["raw_json"],
                    normalized=item["normalized"],
                    hash=item["hash"],
                )
                db.add(si)

            db.flush()

            # Set baseline if first snapshot
            if not monitor.baseline_snapshot_id:
                monitor.baseline_snapshot_id = snapshot.id
                logger.info("Set initial baseline snapshot %s for monitor %s", snapshot.id, monitor_id)
            else:
                # Compute drift vs baseline
                baseline_items = db.execute(
                    select(SnapshotItem).where(SnapshotItem.snapshot_id == monitor.baseline_snapshot_id)
                ).scalars().all()
                current_items = db.execute(
                    select(SnapshotItem).where(SnapshotItem.snapshot_id == snapshot.id)
                ).scalars().all()

                # Merge template + monitor ignore rules
                ignore_patterns = list(monitor.template.default_ignore_rules or [])
                ignore_patterns.extend(monitor.ignore_rules or [])

                drifts = compute_drift(
                    baseline_items=baseline_items,
                    current_items=current_items,
                    ignore_patterns=ignore_patterns,
                    monitor_id=mid,
                    snapshot_id=snapshot.id,
                    resource_type=resource_type,
                )
                for drift in drifts:
                    db.add(drift)

            # Update run
            run.status = "success"
            run.finished_at = datetime.now(timezone.utc)
            run.snapshot_id = snapshot.id

            db.commit()
            logger.info("Monitor run %s completed successfully (%d resources)", run_id_actual, len(items_data))

        except Exception as e:
            logger.exception("Monitor run %s failed: %s", run_id_actual, str(e))
            db.rollback()

            # Update run status in new transaction
            with Session(sync_engine) as db2:
                failed_run = db2.get(MonitorRun, run_id_actual)
                if failed_run:
                    failed_run.status = "failure"
                    failed_run.finished_at = datetime.now(timezone.utc)
                    failed_run.error = str(e)[:2000]
                    db2.commit()

            # Don't re-raise - this prevents Celery from retrying with new run records
            return

