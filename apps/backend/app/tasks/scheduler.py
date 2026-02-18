"""Celery beat schedule: periodically check monitors and dispatch runs."""
import logging
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.tasks.celery_app import celery_app
from app.models.monitor import Monitor

logger = logging.getLogger(__name__)

sync_engine = create_engine(settings.DATABASE_URL_SYNC, pool_pre_ping=True)


@celery_app.task(name="dispatch_scheduled_monitors")
def dispatch_scheduled_monitors():
    """Check all enabled monitors and dispatch runs based on schedule."""
    from app.tasks.monitor_task import run_monitor_task
    from datetime import datetime, timezone, timedelta

    with Session(sync_engine) as db:
        monitors = db.execute(
            select(Monitor).where(Monitor.enabled == True)
        ).scalars().all()

        now = datetime.now(timezone.utc)
        dispatched = 0

        for monitor in monitors:
            # Check if a run is needed based on schedule
            from app.models.monitor_run import MonitorRun
            last_run = db.execute(
                select(MonitorRun)
                .where(MonitorRun.monitor_id == monitor.id)
                .order_by(MonitorRun.started_at.desc())
                .limit(1)
            ).scalars().first()

            should_run = False
            if not last_run:
                should_run = True
            else:
                next_run_at = last_run.started_at + timedelta(hours=monitor.schedule_hours)
                if now >= next_run_at:
                    should_run = True

            if should_run:
                run_monitor_task.delay(str(monitor.id))
                dispatched += 1
                logger.info("Dispatched run for monitor %s (%s)", monitor.name, monitor.id)

        logger.info("Scheduler dispatched %d monitor runs", dispatched)


# Configure beat schedule
celery_app.conf.beat_schedule = {
    "dispatch-scheduled-monitors": {
        "task": "dispatch_scheduled_monitors",
        "schedule": 300.0,  # Check every 5 minutes
    },
}
