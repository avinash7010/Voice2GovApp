"""
Async MongoDB connection management using Motor driver.
Provides a single shared client + database instance for the whole application.
"""
import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config.settings import settings

logger = logging.getLogger(__name__)

# Module-level holders (set during startup)
_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    """Open MongoDB connection pool on application startup."""
    global _client, _db
    _client = AsyncIOMotorClient(
        settings.MONGO_URL,
        maxPoolSize=20,
        minPoolSize=5,
        serverSelectionTimeoutMS=5000,
    )
    _db = _client[settings.DATABASE_NAME]

    # Verify connectivity
    await _client.admin.command("ping")

    # Create indexes on first connect
    await _create_indexes()
    logger.info("✅  Connected to MongoDB: %s", settings.DATABASE_NAME)


async def close_mongo_connection() -> None:
    """Close MongoDB connection pool on application shutdown."""
    global _client
    if _client:
        _client.close()
        logger.info("🛑  MongoDB connection closed")


def get_database() -> AsyncIOMotorDatabase:
    """Return the active database handle."""
    if _db is None:
        raise RuntimeError("Database not initialised. Call connect_to_mongo() first.")
    return _db


# ---------------------------------------------------------------------------
# Collection helpers – call get_database() lazily so they're always fresh
# ---------------------------------------------------------------------------
def get_users_collection():
    return get_database()["users"]


def get_complaints_collection():
    return get_database()["complaints"]


def get_notifications_collection():
    return get_database()["notifications"]


# ---------------------------------------------------------------------------
# Index definitions
# ---------------------------------------------------------------------------
async def _create_indexes() -> None:
    """Ensure all required MongoDB indexes exist (idempotent)."""
    db = get_database()

    # users
    await db["users"].create_index("email", unique=True)
    await db["users"].create_index("role")

    # complaints – core query fields
    await db["complaints"].create_index("userId")
    await db["complaints"].create_index("status")
    await db["complaints"].create_index("category")
    await db["complaints"].create_index("department")
    await db["complaints"].create_index("priority")
    await db["complaints"].create_index([("createdAt", -1)])

    # geo clustering index
    await db["complaints"].create_index("clusterId")
    await db["complaints"].create_index([("location.lat", 1), ("location.lng", 1)])

    # compound index for filtered + sorted queries
    await db["complaints"].create_index([("status", 1), ("createdAt", -1)])
    await db["complaints"].create_index([("department", 1), ("status", 1)])
    await db["complaints"].create_index([("category", 1), ("createdAt", -1)])

    # notifications
    await db["notifications"].create_index("userId")
    await db["notifications"].create_index("read")
    await db["notifications"].create_index([("userId", 1), ("createdAt", -1)])

    logger.info("✅  MongoDB indexes verified")
