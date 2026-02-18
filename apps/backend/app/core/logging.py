import logging
import uuid
from contextvars import ContextVar
from app.core.config import settings

correlation_id: ContextVar[str] = ContextVar("correlation_id", default="")


def get_correlation_id() -> str:
    cid = correlation_id.get()
    if not cid:
        cid = str(uuid.uuid4())[:8]
        correlation_id.set(cid)
    return cid


class CorrelationFilter(logging.Filter):
    def filter(self, record):
        record.correlation_id = get_correlation_id()
        return True


def setup_logging():
    fmt = "%(asctime)s [%(correlation_id)s] %(levelname)s %(name)s: %(message)s"
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(fmt))
    handler.addFilter(CorrelationFilter())

    root = logging.getLogger()
    root.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
    root.handlers = [handler]

    # Quieten noisy libs
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
