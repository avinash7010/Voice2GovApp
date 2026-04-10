"""
Voice2Gov – AI-based Civic Grievance System
Main Application Entry Point – Production-Level v2.0
"""
from contextlib import asynccontextmanager
from pathlib import Path

import socketio
import uvicorn
from fastapi import FastAPI, Request
from pydantic import ValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi.errors import RateLimitExceeded

from app.config.database import connect_to_mongo, close_mongo_connection
from app.config.rate_limiter import limiter
from app.config.settings import settings
from app.repositories.user_repo import user_repo
from app.utils.password_hasher import hash_password
from app.models.user_model import UserRole
from app.middleware.logging_middleware import setup_logging, RequestLoggingMiddleware
from app.middleware.auth_middleware import AuthMiddleware
from app.middleware.error_handler import (
    http_exception_handler,
    validation_exception_handler,
    pydantic_validation_exception_handler,
    rate_limit_exception_handler,
    unhandled_exception_handler,
)
from app.routes import auth_routes, complaint_routes, admin_routes, notification_routes, voice_routes
from app.routes import analytics_routes, geo_routes
from app.routes import submit_complaint_routes
from app.routes import generate_complaint_routes
from app.routes import websocket_routes
from app.routes import push_token_routes
from app.services.notification_service import sio


UPLOADS_DIR = Path("uploads")


# ---------------------------------------------------------------------------
# Setup Logging FIRST (before anything else)
# ---------------------------------------------------------------------------
setup_logging(debug=settings.DEBUG)

import logging
logger = logging.getLogger("voice2gov.app")


async def _ensure_admin_user() -> None:
    """Create initial admin user from environment variables if missing."""
    admin_email = settings.ADMIN_EMAIL.lower().strip()

    # Only create when no user exists for ADMIN_EMAIL.
    existing_admin = await user_repo.find_by_email(admin_email)
    if existing_admin:
        logger.info("✅  Admin user exists: %s", admin_email)
        return

    # Hash env-provided password before storing; never persist plain text.
    hashed_password = hash_password(settings.ADMIN_PASSWORD)
    await user_repo.create(
        {
            "name": "System Admin",
            "email": admin_email,
            "password": hashed_password,
            "role": UserRole.ADMIN,
            "is_active": True,
        }
    )
    logger.info("✅  Seeded admin user: %s", admin_email)


# ---------------------------------------------------------------------------
# Lifespan – startup / shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle events."""
    # Startup
    await connect_to_mongo()
    await _ensure_admin_user()
    # Serve uploads directory for local file storage
    UPLOADS_DIR.mkdir(exist_ok=True)
    logger.info("✅  %s v%s started", settings.APP_NAME, settings.APP_VERSION)
    yield
    # Shutdown
    await close_mongo_connection()
    logger.info("🛑  Application shutdown complete")


# ---------------------------------------------------------------------------
# FastAPI instance
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "AI-powered Civic Grievance Management System. "
        "Production-grade v2 with analytics, geo clustering, "
        "cloud storage, and real-time notifications."
    ),
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exception_handler)

# ---------------------------------------------------------------------------
# Exception handlers (global)
# ---------------------------------------------------------------------------
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(ValidationError, pydantic_validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# ---------------------------------------------------------------------------
# Middleware stack (order matters – outermost first)
# ---------------------------------------------------------------------------
app.add_middleware(RequestLoggingMiddleware)      # request logging
app.add_middleware(AuthMiddleware)                # auth awareness logging
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Static file serving (local uploads fallback)
# ---------------------------------------------------------------------------
UPLOADS_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# ---------------------------------------------------------------------------
# API Routers – versioned under /api/v1/
# ---------------------------------------------------------------------------
V1 = "/api/v1"

app.include_router(auth_routes.router,          prefix=f"{V1}/auth",                tags=["Authentication"])
app.include_router(complaint_routes.router,     prefix=f"{V1}/complaints",          tags=["Complaints"])
app.include_router(admin_routes.router,         prefix=f"{V1}/admin",               tags=["Admin"])
app.include_router(notification_routes.router,  prefix=f"{V1}/notifications",       tags=["Notifications"])
app.include_router(voice_routes.router,         prefix=f"{V1}/voice",               tags=["Voice"])
app.include_router(analytics_routes.router,     prefix=f"{V1}/admin/analytics",     tags=["Analytics"])
app.include_router(geo_routes.router,           prefix=f"{V1}/complaints/geo",      tags=["Geo Intelligence"])
app.include_router(submit_complaint_routes.router, prefix=f"{V1}",                tags=["Complaints"])
app.include_router(generate_complaint_routes.router,                                  tags=["Complaint Generation"])
app.include_router(websocket_routes.router,                                           tags=["WebSockets"])
app.include_router(push_token_routes.router, prefix=f"{V1}",                       tags=["Push Notifications"])

# ---------------------------------------------------------------------------
# Socket.IO ASGI app (mounted at /ws)
# ---------------------------------------------------------------------------
socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="/ws/socket.io")

# ---------------------------------------------------------------------------
# Root route
# ---------------------------------------------------------------------------
@app.get("/")
async def root():
    return {
        "message": "Voice2Gov API is running 🚀",
        "docs": "/api/docs"
    }

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
@app.get(f"{V1}/health", tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "features": [
            "v1 API versioning",
            "pagination + filtering + sorting",
            "AI classification + confidence + urgency",
            "geo clustering + hotspots",
            "analytics dashboard",
            "Socket.IO real-time notifications",
            "Cloudinary/S3 file storage",
            "rate limiting",
            "structured logging",
        ],
    }


# ---------------------------------------------------------------------------
# Dev runner
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run(
        "app.main:socket_app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info",
    )
