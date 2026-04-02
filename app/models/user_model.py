"""
User MongoDB model / document schema.
Uses raw dicts for Motor – not an ODM – but keeps field definitions central.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from bson import ObjectId
from pydantic import BaseModel, EmailStr, Field


class UserRole(str, Enum):
    CITIZEN   = "citizen"
    AUTHORITY = "authority"
    ADMIN     = "admin"


class UserModel(BaseModel):
    """Represents a User document as stored in MongoDB."""
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    email: EmailStr
    password: str                    # bcrypt hash
    role: UserRole = UserRole.CITIZEN
    is_active: bool = True
    phone: Optional[str] = None
    address: Optional[str] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


# ---------------------------------------------------------------------------
# Serialisation helpers shared across the app
# ---------------------------------------------------------------------------
def user_helper(user: dict) -> dict:
    """Convert a raw MongoDB user document to a serialisable dict."""
    return {
        "id":        str(user["_id"]),
        "name":      user.get("name", ""),
        "email":     user.get("email", ""),
        "role":      user.get("role", UserRole.CITIZEN),
        "is_active": user.get("is_active", True),
        "phone":     user.get("phone"),
        "address":   user.get("address"),
        "createdAt": user.get("createdAt"),
        "updatedAt": user.get("updatedAt"),
    }
