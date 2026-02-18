from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "drift_control",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
)

# Explicitly include task modules
celery_app.conf.include = [
    "app.tasks.monitor_task",
    "app.tasks.scheduler",
]
