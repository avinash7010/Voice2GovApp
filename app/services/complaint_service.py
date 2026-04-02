"""
Complaint Service – orchestrates AI classification, geo clustering,
file storage, routing, voting, and CRUD.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status, UploadFile

from app.repositories.complaint_repo import complaint_repo
from app.schemas.complaint_schema import ComplaintCreateSchema, ComplaintStatusUpdateSchema
from app.models.complaint_model import complaint_helper
from app.services.ai_service import classify_and_route
from app.services.routing_service import routing_service
from app.services.notification_service import (
    send_status_change_notification,
    send_new_complaint_notification,
    send_trending_complaint_notification,
)

logger = logging.getLogger(__name__)


class ComplaintService:

    # ------------------------------------------------------------------
    # Create complaint
    # ------------------------------------------------------------------
    async def create_complaint(
        self,
        payload: ComplaintCreateSchema,
        user_id: str,
        image_file: Optional[UploadFile] = None,
    ) -> dict:
        """
        Full pipeline:
          1. Reverse-geocode location (if provided)
          2. Upload image to Cloudinary/S3 if provided
          3. Count similar open complaints (for priority)
          4. Run AI classification + priority scoring (with confidence)
          5. Persist to MongoDB
          6. Assign geo cluster ID
          7. Push Socket.IO notification to department room
        """
        # --- 1. Enrich location ---
        location_dict = None
        if payload.location:
            address = await routing_service.reverse_geocode(
                payload.location.lat, payload.location.lng
            )
            location_dict = {
                "lat":     payload.location.lat,
                "lng":     payload.location.lng,
                "address": address,
            }

        # --- 2. Handle image upload ---
        image_url = None
        if image_file or payload.image:
            try:
                from app.services.file_storage_service import file_storage
                if image_file:
                    upload_result = await file_storage.upload_file(file=image_file)
                else:
                    upload_result = await file_storage.upload_file(file_b64=payload.image)
                image_url = upload_result["url"]
            except Exception as exc:
                logger.warning("Image upload failed, storing as-is: %s", exc)
                image_url = payload.image  # fallback: store base64

        # --- Use combined description (manual text + transcribed speech) ---
        full_text = payload.description
        if payload.audio_text:
            full_text = f"{full_text} {payload.audio_text}".strip()

        # --- 3. Find similar existing complaints for priority boost ---
        from app.services.ai_service import text_classifier  # lazy import to avoid cycle
        tentative_category, _ = text_classifier.classify(full_text)
        similar = await complaint_repo.find_by_category(tentative_category, full_text)
        similar_count = len(similar)

        # --- 4. Run AI pipeline ---
        ai_result = await classify_and_route(
            description=full_text,
            image_b64=None,     # already uploaded above
            votes=0,
            similar_count=similar_count,
        )

        # Validate image only if passed as base64 (legacy)
        if payload.image and not image_file and not ai_result.get("image_valid", True):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=ai_result.get("image_message", "Invalid image"),
            )

        # --- 5. Build document ---
        doc = {
            "userId":           user_id,
            "description":      full_text,
            "imageUrl":         image_url,          # stored URL (not base64)
            "location":         location_dict,
            "category":         ai_result["category"],
            "department":       ai_result["department"],
            "status":           "pending",
            "priority":         ai_result["priority"],
            "confidence":       ai_result["confidence"],
            "isUrgent":         ai_result["is_urgent"],
            "urgencyKeywords":  ai_result["urgency_keywords"],
            "votes":            0,
            "voters":           [],
        }

        created = await complaint_repo.create(doc)
        result  = complaint_helper(created)

        # --- 6. Assign geo cluster if location provided ---
        if location_dict:
            try:
                from app.services.geo_service import geo_service
                cluster_id = await geo_service.assign_cluster_id(
                    result["id"], location_dict["lat"], location_dict["lng"]
                )
                result["clusterId"] = cluster_id
            except Exception as exc:
                logger.warning("Geo clustering failed: %s", exc)

        # --- 7. Notify department room ---
        await send_new_complaint_notification(
            department_room=ai_result["department"],
            complaint_id=result["id"],
            category=ai_result["category"],
            priority=ai_result["priority"],
        )

        # Notify nearby users if complaint is urgent / hotspot
        if ai_result["is_urgent"] and location_dict:
            await send_trending_complaint_notification(
                cluster_id=result.get("clusterId", ""),
                complaint_id=result["id"],
                category=ai_result["category"],
            )

        logger.info(
            "Complaint %s created [%s / %s / %s | conf=%.2f | urgent=%s]",
            result["id"], ai_result["category"], ai_result["department"],
            ai_result["priority"], ai_result["confidence"], ai_result["is_urgent"],
        )
        return result

    # ------------------------------------------------------------------
    # Read complaints
    # ------------------------------------------------------------------
    async def get_complaint_by_id(self, complaint_id: str) -> dict:
        doc = await complaint_repo.find_by_id(complaint_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Complaint not found")
        return complaint_helper(doc)

    async def get_user_complaints(
        self, user_id: str, skip: int = 0, limit: int = 20
    ) -> list:
        docs = await complaint_repo.find_by_user(user_id, skip=skip, limit=limit)
        return [complaint_helper(d) for d in docs]

    async def get_all_complaints(
        self,
        filters: dict = None,
        skip: int = 0,
        limit: int = 50,
        sort_field: str = "createdAt",
        sort_dir: int = -1,
    ) -> list:
        docs = await complaint_repo.find_all(
            filters=filters, skip=skip, limit=limit,
            sort_field=sort_field, sort_dir=sort_dir,
        )
        return [complaint_helper(d) for d in docs]

    async def get_authority_complaints(
        self, department: str, skip: int = 0, limit: int = 50
    ) -> list:
        docs = await complaint_repo.find_by_department(department, skip=skip, limit=limit)
        return [complaint_helper(d) for d in docs]

    # ------------------------------------------------------------------
    # Vote
    # ------------------------------------------------------------------
    async def vote_complaint(self, complaint_id: str, user_id: str) -> dict:
        """
        Add a vote. After voting, recalculate priority based on new vote total.
        Raises 409 if user already voted.
        """
        updated = await complaint_repo.add_vote(complaint_id, user_id)
        if updated is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You have already voted for this complaint",
            )

        result = complaint_helper(updated)

        # Recalculate priority after vote
        from app.services.ai_service import priority_engine  # lazy import
        new_priority = priority_engine.calculate(
            result["description"], votes=result["votes"]
        )
        if new_priority != result["priority"]:
            await complaint_repo.update_priority(complaint_id, new_priority)
            result["priority"] = new_priority

        return result

    # ------------------------------------------------------------------
    # Update status (authority / admin)
    # ------------------------------------------------------------------
    async def update_status(
        self,
        complaint_id: str,
        payload: ComplaintStatusUpdateSchema,
        actor_id: str,
    ) -> dict:
        """Update complaint status and push real-time notification to owner."""
        # Verify complaint exists first
        existing = await complaint_repo.find_by_id(complaint_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Complaint not found")

        updated = await complaint_repo.update_status(
            complaint_id,
            payload.status.value,
            admin_notes=payload.admin_notes,
        )
        result = complaint_helper(updated)

        # Push notification to complaint owner
        await send_status_change_notification(
            user_id=result["userId"],
            complaint_id=complaint_id,
            new_status=result["status"],
            category=result["category"],
        )

        logger.info(
            "Complaint %s status → %s (by actor %s)", complaint_id, payload.status, actor_id
        )
        return result


complaint_service = ComplaintService()
