"""
Complaint MongoDB model / document schema.
v2: added imageUrl, confidence, isUrgent, urgencyKeywords, clusterId fields.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from bson import ObjectId
from pydantic import BaseModel, Field


class ComplaintStatus(str, Enum):
    PENDING     = "pending"
    IN_PROGRESS = "in_progress"
    RESOLVED    = "resolved"
    REJECTED    = "rejected"


class ComplaintCategory(str, Enum):
    ELECTRICITY = "electricity"
    WATER       = "water"
    ROAD        = "road"
    GARBAGE     = "garbage"
    OTHER       = "other"


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
    description: str
    imageUrl: Optional[str]     = None                 # Cloudinary/S3/local URL
    image: Optional[str]        = None                 # legacy base64 (deprecated)
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


def complaint_helper(complaint: dict) -> dict:
    """Convert a raw MongoDB complaint document to a serialisable dict."""
    location = complaint.get("location")
    return {
        "id":               str(complaint["_id"]),
        "userId":           str(complaint.get("userId", "")),
        "description":      complaint.get("description", ""),
        "imageUrl":         complaint.get("imageUrl") or complaint.get("image"),  # backward compat
        "audio":            complaint.get("audio"),
        "location":         location,
        "clusterId":        complaint.get("clusterId"),
        "category":         complaint.get("category", "other"),
        "department":       complaint.get("department", "General"),
        "status":           complaint.get("status", "pending"),
        "priority":         complaint.get("priority", "low"),
        "confidence":       complaint.get("confidence", 0.0),
        "isUrgent":         complaint.get("isUrgent", False),
        "urgencyKeywords":  complaint.get("urgencyKeywords", []),
        "votes":            complaint.get("votes", 0),
        "assignedTo":       complaint.get("assignedTo"),
        "adminNotes":       complaint.get("adminNotes"),
        "resolvedAt":       complaint.get("resolvedAt"),
        "createdAt":        complaint.get("createdAt"),
        "updatedAt":        complaint.get("updatedAt"),
    }
