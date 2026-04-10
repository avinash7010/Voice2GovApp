"""
Global Error Handler – catches unhandled exceptions and formats them as
consistent JSON responses so the client always receives a structured body.
"""
import logging
import traceback

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger("voice2gov.errors")


def _error_payload(message: str, code: str) -> dict:
    return {
        "success": False,
        "error": {
            "message": message,
            "code": code,
        },
    }


# ---------------------------------------------------------------------------
# Exception handler factories (registered on the FastAPI app)
# ---------------------------------------------------------------------------

async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Convert HTTPException → standard JSON body."""
    logger.warning(
        "HTTP %d on %s %s: %s",
        exc.status_code, request.method, request.url.path, exc.detail
    )
    message = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(status_code=exc.status_code, content=_error_payload(message, f"HTTP_{exc.status_code}"))


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Convert Pydantic validation errors → structured 422 response."""
    errors = []
    for error in exc.errors():
        loc = " -> ".join(str(l) for l in error["loc"])
        errors.append({"field": loc, "message": error["msg"], "type": error["type"]})

    logger.warning(
        "Validation error on %s %s: %s", request.method, request.url.path, errors
    )
    message = "Request validation failed"
    if errors:
        first = errors[0]
        message = f"{first['field']}: {first['message']}"
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_payload(message, "VALIDATION_ERROR"),
    )


async def pydantic_validation_exception_handler(request: Request, exc: ValidationError):
    """Handle non-request pydantic validation failures consistently."""
    logger.warning("Pydantic validation error on %s %s: %s", request.method, request.url.path, exc.errors())
    message = "Validation failed"
    if exc.errors():
        first = exc.errors()[0]
        loc = " -> ".join(str(l) for l in first.get("loc", []))
        msg = first.get("msg", "Invalid input")
        message = f"{loc}: {msg}" if loc else msg

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_payload(message, "VALIDATION_ERROR"),
    )


async def rate_limit_exception_handler(request: Request, exc: RateLimitExceeded):
    """Normalize rate-limit errors to the standard error schema."""
    logger.warning("Rate limit exceeded on %s %s: %s", request.method, request.url.path, str(exc))
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content=_error_payload("Rate limit exceeded", "RATE_LIMIT_EXCEEDED"),
    )


async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all for unexpected 500 errors."""
    tb = traceback.format_exc()
    logger.error(
        "Unhandled exception on %s %s:\n%s",
        request.method, request.url.path, tb
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_payload("Internal server error. Please try again later.", "INTERNAL_SERVER_ERROR"),
    )
