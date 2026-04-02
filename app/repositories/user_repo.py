"""
User Repository – all MongoDB CRUD operations for the users collection.
All methods are async and return raw dicts (serialised by service/route layer).
"""
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from app.config.database import get_users_collection
from app.utils.helpers import validate_object_id


class UserRepository:
    """Data-access layer for the users collection."""

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------
    async def find_by_email(self, email: str) -> Optional[dict]:
        """Return the user document with the given email, or None."""
        return await get_users_collection().find_one({"email": email.lower()})

    async def find_by_id(self, user_id: str) -> Optional[dict]:
        """Return a user document by _id string, or None."""
        oid = validate_object_id(user_id)
        return await get_users_collection().find_one({"_id": oid})

    async def find_all(self, skip: int = 0, limit: int = 50) -> list:
        """Return a paginated list of all user documents."""
        cursor = get_users_collection().find().skip(skip).limit(limit)
        return await cursor.to_list(length=limit)

    async def count(self) -> int:
        return await get_users_collection().count_documents({})

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------
    async def create(self, user_data: dict) -> dict:
        """
        Insert a new user and return the created document (with generated _id).
        Normalises email to lowercase before insert.
        """
        user_data["email"] = user_data["email"].lower()
        user_data.setdefault("createdAt", datetime.now(timezone.utc))
        user_data.setdefault("updatedAt", datetime.now(timezone.utc))
        result = await get_users_collection().insert_one(user_data)
        created = await get_users_collection().find_one({"_id": result.inserted_id})
        return created

    async def update_role(self, user_id: str, role: str) -> Optional[dict]:
        """Update a user's role and return the updated document."""
        oid = validate_object_id(user_id)
        await get_users_collection().update_one(
            {"_id": oid},
            {"$set": {"role": role, "updatedAt": datetime.now(timezone.utc)}},
        )
        return await get_users_collection().find_one({"_id": oid})

    async def deactivate(self, user_id: str) -> bool:
        """Soft-delete: set is_active=False. Returns True if matched."""
        oid = validate_object_id(user_id)
        result = await get_users_collection().update_one(
            {"_id": oid},
            {"$set": {"is_active": False, "updatedAt": datetime.now(timezone.utc)}},
        )
        return result.matched_count > 0

    async def delete(self, user_id: str) -> bool:
        """Hard delete. Returns True if a document was deleted."""
        oid = validate_object_id(user_id)
        result = await get_users_collection().delete_one({"_id": oid})
        return result.deleted_count > 0

    async def email_exists(self, email: str) -> bool:
        """Return True if a user with this email already exists."""
        doc = await get_users_collection().find_one({"email": email.lower()}, {"_id": 1})
        return doc is not None


# Singleton instance used by services
user_repo = UserRepository()
