"""
Global Error Handler – catches unhandled exceptions and formats them as
consistent JSON responses so the client always receives a structured body.
"""
import logging
import traceback

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("voice2gov.errors")


# ---------------------------------------------------------------------------
# Exception handler factories (registered on the FastAPI app)
# ---------------------------------------------------------------------------

async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Convert HTTPException → standard JSON body."""
    logger.warning(
        "HTTP %d on %s %s: %s",
        exc.status_code, request.method, request.url.path, exc.detail
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": str(exc.detail),
            "data": None,
        },
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Convert Pydantic validation errors → structured 422 response."""
    errors = []
    for error in exc.errors():
        loc = " → ".join(str(l) for l in error["loc"])
        errors.append({"field": loc, "message": error["msg"], "type": error["type"]})

    logger.warning(
        "Validation error on %s %s: %s", request.method, request.url.path, errors
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "Request validation failed",
            "data": {"errors": errors},
        },
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
        content={
            "success": False,
            "message": "Internal server error. Please try again later.",
            "data": None,
        },
    )
