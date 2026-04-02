"""
Startup script – seeds the admin user if not present and launches uvicorn.
Run with:  python run.py
"""
import asyncio
import uvicorn
from app.config.settings import settings


async def seed_admin():
    """Create default admin user if they don't exist."""
    from app.config.database import connect_to_mongo
    from app.repositories.user_repo import user_repo
    from app.utils.password_hasher import hash_password
    from app.models.user_model import UserRole

    await connect_to_mongo()
    if not await user_repo.email_exists(settings.ADMIN_EMAIL):
        await user_repo.create({
            "name":     "System Admin",
            "email":    settings.ADMIN_EMAIL,
            "password": hash_password(settings.ADMIN_PASSWORD),
            "role":     UserRole.ADMIN,
            "is_active": True,
        })
        print(f"🔑  Admin seeded: {settings.ADMIN_EMAIL}")
    else:
        print(f"✅  Admin already exists: {settings.ADMIN_EMAIL}")


if __name__ == "__main__":
    asyncio.run(seed_admin())
    uvicorn.run(
        "app.main:socket_app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info",
    )
