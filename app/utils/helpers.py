"""
Miscellaneous helper utilities used across the application.
"""
import re
import base64
import binascii
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import HTTPException, status


# ---------------------------------------------------------------------------
# ObjectId helpers
# ---------------------------------------------------------------------------
def validate_object_id(oid: str) -> ObjectId:
    """Parse a hex string to ObjectId or raise 400."""
    try:
        return ObjectId(oid)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid ObjectId: '{oid}'",
        )


def stringify_id(doc: dict) -> dict:
    """Convert _id ObjectId to string 'id' in-place, return the dict."""
    if doc and "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc


# ---------------------------------------------------------------------------
# Standard API response builders
# ---------------------------------------------------------------------------
def success_response(
    data=None,
    message: Optional[str] = None,
    legacy_fields: Optional[dict] = None,
) -> dict:
    """
    Standard success envelope with optional legacy top-level fields.

    `legacy_fields` lets routes keep older response keys for compatibility
    while still returning the standard shape.
    """
    response = {
        "success": True,
        "data": data,
    }
    if message is not None:
        response["message"] = message
    if legacy_fields:
        response.update(legacy_fields)
    return response


def error_response(message: str, code: str = "ERROR") -> dict:
    return {
        "success": False,
        "message": message,
        "data": None,
        "error": {
            "message": message,
            "code": code,
        },
    }


# ---------------------------------------------------------------------------
# Base64 image helper
# ---------------------------------------------------------------------------
def validate_base64_image(b64_string: str, max_bytes: int = 5_242_880) -> bool:
    """
    Check that a string is valid base64 and does not exceed max_bytes.
    Supports 'data:image/jpeg;base64,...' prefix format.
    """
    if not b64_string:
        return False
    # Strip data-URI prefix if present
    if "," in b64_string:
        _, b64_string = b64_string.split(",", 1)
    try:
        decoded = base64.b64decode(b64_string, validate=True)
        return len(decoded) <= max_bytes
    except binascii.Error:
        return False


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------
def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def format_datetime(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return dt.isoformat()


# ---------------------------------------------------------------------------
# Pagination helper
# ---------------------------------------------------------------------------
def paginate_params(page: int = 1, limit: int = 20) -> dict:
    """Return skip/limit for MongoDB queries."""
    page  = max(1, page)
    limit = min(100, max(1, limit))
    return {"skip": (page - 1) * limit, "limit": limit}
