"""
Pydantic request / response schemas for Complaint endpoints.
"""
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from app.models.complaint_category import ComplaintCategory
from app.models.complaint_model import ComplaintStatus, ComplaintPriority


CATEGORY_ALIAS_MAP = {
    "water": ComplaintCategory.WATER.value,
    "road": ComplaintCategory.ROAD.value,
    "roads": ComplaintCategory.ROAD.value,
    "road accident": ComplaintCategory.ROAD.value,
    "sanitation": ComplaintCategory.SANITATION.value,
    "garbage": ComplaintCategory.SANITATION.value,
    "trash": ComplaintCategory.SANITATION.value,
    "waste": ComplaintCategory.SANITATION.value,
    "electricity": ComplaintCategory.ELECTRICITY.value,
    "power": ComplaintCategory.ELECTRICITY.value,
    "infrastructure": ComplaintCategory.OTHER.value,
    "fire accident": ComplaintCategory.OTHER.value,
    "fire": ComplaintCategory.OTHER.value,
    "accident": ComplaintCategory.OTHER.value,
    "other": ComplaintCategory.OTHER.value,
}


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
    title: Optional[str]      = Field(None, max_length=60)
    push_token: Optional[str] = Field(None, description="Expo push token for this device")
    audio_text: Optional[str] = Field(None,  description="Transcribed speech text (Vosk output)")
    location: Optional[LocationSchema] = None

    class Config:
        json_schema_extra = {
            "example": {
                "description": "Street light not working near bus stop for 3 days",
                "location": {"lat": 13.0827, "lng": 80.2707},
            }
        }

    @field_validator("title", "push_token", "audio_text", mode="before")
    @classmethod
    def _strip_optional_strings(cls, value):
        if value is None:
            return value
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value

    @field_validator("description")
    @classmethod
    def _validate_description(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("description cannot be empty")
        if len(cleaned) < 10:
            raise ValueError("description must contain at least 10 non-whitespace characters")
        return cleaned


class ComplaintSubmitSchema(BaseModel):
    """Structured complaint payload from the UI."""

    title: Optional[str] = Field(None, max_length=60)
    description: str = Field(..., min_length=1, max_length=2000)
    push_token: Optional[str] = Field(None, description="Expo push token for this device")
    category: Optional[ComplaintCategory] = Field(None)
    department: Optional[str] = Field(None, max_length=120)
    priority: Optional[str] = Field(None, max_length=32)
    location: Optional[str] = Field(None, max_length=255)

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Pothole on main road",
                "description": "There is a large pothole near City Hospital.",
                "category": "road",
                "department": "Public Works Department",
                "priority": "High",
                "location": "City Hospital, Main Road",
            }
        }

    @field_validator("title", "push_token", "department", "priority", "location", mode="before")
    @classmethod
    def _strip_optional_fields(cls, value):
        if value is None:
            return value
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value

    @field_validator("category", mode="before")
    @classmethod
    def _normalize_category(cls, value):
        if value is None:
            return value

        if isinstance(value, ComplaintCategory):
            return value

        if isinstance(value, str):
            normalized = value.strip().lower()
            if not normalized:
                return ComplaintCategory.OTHER.value
            return CATEGORY_ALIAS_MAP.get(normalized, ComplaintCategory.OTHER.value)

        return ComplaintCategory.OTHER.value

    @field_validator("description")
    @classmethod
    def _validate_description(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("description cannot be empty")
        return cleaned


class ComplaintStatusUpdateSchema(BaseModel):
    """Payload for authority/admin to update a complaint's status."""
    status: ComplaintStatus
    admin_notes: Optional[str] = Field(None, max_length=2000)

    @field_validator("admin_notes", mode="before")
    @classmethod
    def _strip_admin_notes(cls, value):
        if value is None:
            return value
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value

    class Config:
        json_schema_extra = {
            "example": {"status": "in_progress", "admin_notes": "Assigned to lineman"}
        }


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------
class ComplaintResponseSchema(BaseModel):
    id: str
    title: str
    description: str
    category: ComplaintCategory
    department: str
    priority: str
    location: str
    status: str
    created_at: str
    isDuplicate: bool = False
    parentComplaintId: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    imageUrl: Optional[str] = None
