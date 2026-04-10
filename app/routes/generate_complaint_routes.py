"""Route for generating structured complaints from raw transcribed text."""
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status

from app.services.complaint_generator_service import generate_complaint
from app.utils.helpers import success_response


router = APIRouter()


class GenerateComplaintRequest(BaseModel):
    """Incoming request payload for complaint generation."""

    text: str = Field(..., min_length=1, description="Raw transcribed complaint text")


@router.post("/generate-complaint", summary="Generate structured complaint from text")
async def generate_complaint_route(payload: GenerateComplaintRequest):
    """Convert plain complaint text to structured complaint metadata."""
    try:
        result = generate_complaint(payload.text)
        return success_response(
            data=result,
            message="Complaint generated",
            legacy_fields=result if isinstance(result, dict) else None,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate complaint: {exc}",
        ) from exc
