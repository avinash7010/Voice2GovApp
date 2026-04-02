"""
Complaint Repository – all MongoDB CRUD operations for the complaints collection.
Upgraded with sort parameter support.
"""
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from app.config.database import get_complaints_collection
from app.utils.helpers import validate_object_id


class ComplaintRepository:
    """Data-access layer for the complaints collection."""

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------
    async def find_by_id(self, complaint_id: str) -> Optional[dict]:
        oid = validate_object_id(complaint_id)
        return await get_complaints_collection().find_one({"_id": oid})

    async def find_by_user(self, user_id: str, skip: int = 0, limit: int = 20) -> list:
        cursor = (
            get_complaints_collection()
            .find({"userId": user_id})
            .sort("createdAt", -1)
            .skip(skip)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def find_all(
        self,
        filters: dict = None,
        skip: int = 0,
        limit: int = 50,
        sort_field: str = "createdAt",
        sort_dir: int = -1,
    ) -> list:
        """Admin: paginated list with optional field filters and sort."""
        query = filters or {}
        cursor = (
            get_complaints_collection()
            .find(query)
            .sort(sort_field, sort_dir)
            .skip(skip)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def find_by_department(self, department: str, skip: int = 0, limit: int = 50) -> list:
        """Authority: fetch complaints assigned to a specific department."""
        cursor = (
            get_complaints_collection()
            .find({"department": department, "status": {"$ne": "resolved"}})
            .sort("priority", -1)
            .skip(skip)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def find_by_category(self, category: str, description: str) -> list:
        """Find similar complaints (same category, non-resolved) to check for duplicates."""
        cursor = get_complaints_collection().find(
            {"category": category, "status": {"$ne": "resolved"}},
            {"_id": 1, "votes": 1},
        ).limit(10)
        return await cursor.to_list(length=10)

    async def count(self, filters: dict = None) -> int:
        return await get_complaints_collection().count_documents(filters or {})

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------
    async def create(self, complaint_data: dict) -> dict:
        """Insert and return the new complaint document."""
        complaint_data.setdefault("createdAt", datetime.now(timezone.utc))
        complaint_data.setdefault("updatedAt", datetime.now(timezone.utc))
        result = await get_complaints_collection().insert_one(complaint_data)
        return await get_complaints_collection().find_one({"_id": result.inserted_id})

    async def update_status(
        self,
        complaint_id: str,
        status: str,
        admin_notes: Optional[str] = None,
    ) -> Optional[dict]:
        """Update status (and optionally admin notes). Returns updated doc."""
        oid = validate_object_id(complaint_id)
        update_fields = {
            "status": status,
            "updatedAt": datetime.now(timezone.utc),
        }
        if admin_notes is not None:
            update_fields["adminNotes"] = admin_notes
        if status == "resolved":
            update_fields["resolvedAt"] = datetime.now(timezone.utc)

        await get_complaints_collection().update_one({"_id": oid}, {"$set": update_fields})
        return await get_complaints_collection().find_one({"_id": oid})

    async def add_vote(self, complaint_id: str, user_id: str) -> Optional[dict]:
        """
        Atomically increment vote count and add user_id to voters list.
        Returns the updated document, or None if the user already voted.
        """
        oid = validate_object_id(complaint_id)
        result = await get_complaints_collection().update_one(
            {"_id": oid, "voters": {"$ne": user_id}},   # guard: user not already in list
            {
                "$inc": {"votes": 1},
                "$push": {"voters": user_id},
                "$set": {"updatedAt": datetime.now(timezone.utc)},
            },
        )
        if result.modified_count == 0:
            return None  # already voted or complaint not found
        return await get_complaints_collection().find_one({"_id": oid})

    async def update_priority(self, complaint_id: str, priority: str) -> None:
        oid = validate_object_id(complaint_id)
        await get_complaints_collection().update_one(
            {"_id": oid},
            {"$set": {"priority": priority, "updatedAt": datetime.now(timezone.utc)}},
        )

    async def delete(self, complaint_id: str) -> bool:
        oid = validate_object_id(complaint_id)
        result = await get_complaints_collection().delete_one({"_id": oid})
        return result.deleted_count > 0


# Singleton instance used by services
complaint_repo = ComplaintRepository()
