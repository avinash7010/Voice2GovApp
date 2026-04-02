"""
Auth Middleware – optional global JWT pre-validation layer.

FastAPI dependency injection already handles auth per-route.
This middleware provides a global X-Auth-Validated header for tracing
and logs suspicious unauthenticated access to sensitive paths.
"""
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("voice2gov.auth")

# Paths that require authentication (prefix match)
PROTECTED_PREFIXES = ["/api/v1/admin", "/api/v1/complaints", "/api/v1/notifications"]

# Paths always accessible without auth
PUBLIC_PATHS = {
    "/health",
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/docs",
    "/api/redoc",
    "/api/openapi.json",
}


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Lightweight bearer-token presence check.
    Actual token *validation* is delegated to FastAPI dependency `get_current_user_payload`.
    This layer just logs missing tokens on protected routes.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if path in PUBLIC_PATHS or path.startswith("/ws/"):
            return await call_next(request)

        is_protected = any(path.startswith(p) for p in PROTECTED_PREFIXES)
        has_token = "Authorization" in request.headers

        if is_protected and not has_token:
            logger.warning("Unauthenticated access attempt: %s %s", request.method, path)

        response = await call_next(request)
        return response
