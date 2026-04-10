"""
Complaint MongoDB model / document schema.
v2: added imageUrl, confidence, isUrgent, urgencyKeywords, clusterId fields.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from bson import ObjectId
from pydantic import BaseModel, Field
from app.models.complaint_category import ComplaintCategory


class ComplaintStatus(str, Enum):
    PENDING     = "pending"
    IN_PROGRESS = "in_progress"
    RESOLVED    = "resolved"
    REJECTED    = "rejected"


class ComplaintPriority(str, Enum):
    LOW    = "low"
    MEDIUM = "medium"
    HIGH   = "high"
    URGENT = "urgent"


class LocationModel(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None


class ComplaintModel(BaseModel):
    """Represents a Complaint document as stored in MongoDB."""
    id: Optional[str]           = Field(default=None, alias="_id")
    userId: str                                        # ObjectId as string
    title: Optional[str] = None
    description: str
    push_token: Optional[str]   = None
    imageUrl: Optional[str]     = None                 # Cloudinary/S3/local URL
    audio: Optional[str]        = None                 # transcribed text / file path
    location: Optional[LocationModel] = None
    clusterId: Optional[str]    = None                 # geo cluster bucket id
    category: ComplaintCategory = ComplaintCategory.OTHER
    department: str             = "General"
    status: ComplaintStatus     = ComplaintStatus.PENDING
    priority: ComplaintPriority = ComplaintPriority.LOW
    confidence: float           = 0.0                  # AI classification confidence
    isUrgent: bool              = False                 # urgency keyword detected
    urgencyKeywords: list       = Field(default_factory=list)
    isDuplicate: bool           = False
    parentComplaintId: Optional[str] = None
    votes: int                  = 0
    voters: list                = Field(default_factory=list)
    assignedTo: Optional[str]   = None                # authority userId
    resolvedAt: Optional[datetime] = None
    adminNotes: Optional[str]   = None
    createdAt: datetime         = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime         = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


def ensure_title(complaint: dict) -> dict:
    """Ensure a complaint has a short title derived from its description."""
    title = (complaint.get("title") or "").strip()
    if title:
        complaint["title"] = title
        return complaint

    description = (complaint.get("description") or "").strip()
    complaint["title"] = description[:60] if description else "Complaint"
    return complaint


def _extract_coordinates(location) -> tuple[Optional[float], Optional[float]]:
    """Extract latitude and longitude from location data.
    
    Returns:
        Tuple of (latitude, longitude) or (None, None) if not found
    """
    if not location:
        return None, None
    
    if isinstance(location, dict):
        # Try to get lat/lng from the dict
        lat = location.get("lat") or location.get("latitude")
        lng = location.get("lng") or location.get("longitude")
        
        if lat is not None and lng is not None:
            try:
                return float(lat), float(lng)
            except (ValueError, TypeError):
                pass
    
    return None, None


def _format_location(location) -> str:
    """Convert stored location payload into a flat human-readable string."""
    if not location:
        return "Unknown"

    if isinstance(location, str):
        cleaned = location.strip()
        return cleaned or "Unknown"

    if isinstance(location, dict):
        address = str(location.get("address") or "").strip()
        if address:
            return address

        lat = location.get("lat") or location.get("latitude")
        lng = location.get("lng") or location.get("longitude")
        if lat is not None and lng is not None:
            return f"{lat}, {lng}"

    return str(location).strip() or "Unknown"


def _format_datetime(value) -> Optional[str]:
    if value is None:
        return datetime.now(timezone.utc).isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _stringify(value, fallback: str) -> str:
    if value is None:
        return fallback
    return str(getattr(value, "value", value))


def normalize_complaint(obj: dict) -> dict:
    """Normalize a complaint document into the standard flat API payload."""
    complaint = ensure_title(dict(obj or {}))
    created_at = _format_datetime(complaint.get("createdAt") or complaint.get("created_at"))
    location_data = complaint.get("location")
    latitude, longitude = _extract_coordinates(location_data)
    
    response = {
        "id": str(complaint.get("_id") or complaint.get("id") or ""),
        "title": complaint.get("title", "Complaint"),
        "description": complaint.get("description", ""),
        "category": _stringify(complaint.get("category"), "other"),
        "department": complaint.get("department", "General"),
        "priority": _stringify(complaint.get("priority"), "low"),
        "location": _format_location(location_data),
        "status": _stringify(complaint.get("status"), "pending"),
        "created_at": created_at,
        "isDuplicate": bool(complaint.get("isDuplicate", False)),
        "parentComplaintId": complaint.get("parentComplaintId"),
    }
    
    # Include numeric coordinates if available
    if latitude is not None:
        response["latitude"] = latitude
    if longitude is not None:
        response["longitude"] = longitude
    
    # Include image URL if available. Support common legacy keys.
    image_url = (
        complaint.get("imageUrl")
        or complaint.get("image_url")
        or complaint.get("image")
    )
    if image_url:
        response["imageUrl"] = image_url
        response["image_url"] = image_url
        response["image"] = image_url
    
    return response


def complaint_helper(complaint: dict) -> dict:
    """Backward-compatible alias for normalized complaint payloads."""
    return normalize_complaint(complaint)
