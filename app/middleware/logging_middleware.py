"""
Logging Middleware – logs every HTTP request/response with timing, status, and metadata.
Also sets up root application logging to file + console.
"""
import logging
import time
import uuid
from contextvars import ContextVar
from logging.handlers import RotatingFileHandler
from pathlib import Path

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


# ---------------------------------------------------------------------------
# Logging setup (called once at app startup)
# ---------------------------------------------------------------------------
LOG_DIR = Path("logs")
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdFilter(logging.Filter):
    """Inject request_id from contextvar into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get("-")
        return True


def setup_logging(debug: bool = False) -> None:
    """Configure root logger: rotating file + colorised console."""
    LOG_DIR.mkdir(exist_ok=True)

    log_level = logging.DEBUG if debug else logging.INFO
    fmt = "%(asctime)s | %(levelname)-8s | %(name)s | [%(request_id)s] %(message)s"
    date_fmt = "%Y-%m-%d %H:%M:%S"
    formatter = logging.Formatter(fmt, datefmt=date_fmt)
    request_filter = RequestIdFilter()

    # Root logger
    root = logging.getLogger()
    root.setLevel(log_level)

    # Console handler
    console = logging.StreamHandler()
    console.setLevel(log_level)
    console.setFormatter(formatter)
    console.addFilter(request_filter)

    # Rotating file – app.log (10 MB × 5 backups)
    file_handler = RotatingFileHandler(
        LOG_DIR / "app.log", maxBytes=10_485_760, backupCount=5, encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    file_handler.addFilter(request_filter)

    # Error-only file
    err_handler = RotatingFileHandler(
        LOG_DIR / "error.log", maxBytes=5_242_880, backupCount=3, encoding="utf-8"
    )
    err_handler.setLevel(logging.ERROR)
    err_handler.setFormatter(formatter)
    err_handler.addFilter(request_filter)

    if not root.handlers:
        root.addHandler(console)
        root.addHandler(file_handler)
        root.addHandler(err_handler)
    else:
        # Ensure existing handlers still emit request_id after hot reloads/tests.
        for handler in root.handlers:
            handler.addFilter(request_filter)

    # Silence noisy third-party loggers
    for noisy in ("uvicorn.access", "motor", "pymongo", "socketio", "engineio"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


# ---------------------------------------------------------------------------
# Request logging middleware
# ---------------------------------------------------------------------------
logger = logging.getLogger("voice2gov.http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every HTTP request: method, path, status, duration, request-id."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        start = time.perf_counter()

        # Attach request_id to request state for downstream use
        request.state.request_id = request_id
        token = request_id_ctx.set(request_id)

        try:
            response = await call_next(request)
        except Exception as exc:
            logger.exception(
                "UNHANDLED %s %s -> 500 | %.2fms",
                request.method,
                request.url.path,
                (time.perf_counter() - start) * 1000,
            )
            request_id_ctx.reset(token)
            raise

        duration_ms = (time.perf_counter() - start) * 1000
        level = logging.WARNING if response.status_code >= 400 else logging.INFO
        logger.log(
            level,
            "%s %s -> %d | %.2fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        response.headers["X-Request-ID"] = request_id
        request_id_ctx.reset(token)
        return response
