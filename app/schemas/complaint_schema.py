"""
Pydantic request / response schemas for Complaint endpoints.
"""
from typing import Optional
from pydantic import BaseModel, Field
from app.models.complaint_model import ComplaintStatus, ComplaintPriority, ComplaintCategory


# ---------------------------------------------------------------------------
# Sub-schemas
# ---------------------------------------------------------------------------
class LocationSchema(BaseModel):
    lat: float = Field(..., ge=-90, le=90,    examples=[13.0827])
    lng: float = Field(..., ge=-180, le=180,  examples=[80.2707])


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------
class ComplaintCreateSchema(BaseModel):
    """Payload to file a new complaint."""
    description: str          = Field(..., min_length=10, max_length=2000)
    image: Optional[str]      = Field(None,  description="Base64 encoded image or public URL")
    audio_text: Optional[str] = Field(None,  description="Transcribed speech text (Vosk output)")
    location: Optional[LocationSchema] = None

    class Config:
        json_schema_extra = {
            "example": {
                "description": "Street light not working near bus stop for 3 days",
                "location": {"lat": 13.0827, "lng": 80.2707},
            }
        }


class ComplaintStatusUpdateSchema(BaseModel):
    """Payload for authority/admin to update a complaint's status."""
    status: ComplaintStatus
    admin_notes: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {"status": "in_progress", "admin_notes": "Assigned to lineman"}
        }


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------
class ComplaintResponseSchema(BaseModel):
    id: str
    userId: str
    description: str
    image: Optional[str]     = None
    location: Optional[dict] = None
    category: ComplaintCategory
    department: str
    status: ComplaintStatus
    priority: ComplaintPriority
    votes: int
    assignedTo: Optional[str] = None
    adminNotes: Optional[str] = None
    createdAt: Optional[str]  = None
    updatedAt: Optional[str]  = None
