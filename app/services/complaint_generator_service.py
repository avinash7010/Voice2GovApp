"""Utility service to convert raw complaint text into structured JSON."""
import re
from typing import Dict

from app.models.complaint_category import ComplaintCategory


CATEGORY_RULES = [
    (ComplaintCategory.ROAD.value, "Public Works Department", ["pothole", "road", "street", "traffic", "bridge"]),
    (ComplaintCategory.SANITATION.value, "Municipal Corporation", ["garbage", "waste", "trash", "sewage", "cleanliness"]),
    (ComplaintCategory.WATER.value, "Water Supply Department", ["water", "drain", "pipeline", "leak", "drainage"]),
    (ComplaintCategory.ELECTRICITY.value, "Electricity Board", ["electricity", "power", "transformer", "voltage", "outage"]),
]

HIGH_PRIORITY_WORDS = {"urgent", "immediately", "danger", "accident", "emergency", "hazard"}
LOW_PRIORITY_WORDS = {"minor", "small", "whenever", "later", "not urgent", "sometime"}

LOCATION_PATTERNS = [
    r"\b(?:at|near|in|on)\s+([A-Za-z0-9,\-\s]{3,60})",
    r"\b(?:area|locality|location)\s*[:\-]\s*([A-Za-z0-9,\-\s]{3,60})",
]


def _clean_text(text: str) -> str:
    """Normalize whitespace while preserving original complaint content."""
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    return cleaned


def _extract_location(text: str) -> str:
    """Extract a probable location phrase from complaint text."""
    for pattern in LOCATION_PATTERNS:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            location = re.sub(r"\s+", " ", match.group(1)).strip(" ,.-")
            if location:
                return location
    return "Unknown"


def _detect_category(text_lower: str) -> Dict[str, str]:
    """Map complaint keywords to category and department."""
    for category, department, keywords in CATEGORY_RULES:
        if any(keyword in text_lower for keyword in keywords):
            return {"category": category, "department": department}
    return {"category": ComplaintCategory.OTHER.value, "department": "Municipality"}


def _detect_priority(text_lower: str) -> str:
    """Assign priority based on urgency/severity words."""
    if any(word in text_lower for word in HIGH_PRIORITY_WORDS):
        return "High"
    if any(word in text_lower for word in LOW_PRIORITY_WORDS):
        return "Low"
    return "Medium"


def _build_title(text: str, max_len: int = 60) -> str:
    """Create a short summary title constrained to max length."""
    if not text:
        return "Complaint"

    # Use sentence fragment before punctuation first; then hard-truncate.
    fragment = re.split(r"[.!?]", text, maxsplit=1)[0].strip()
    fragment = fragment or text

    if len(fragment) <= max_len:
        return fragment

    trimmed = fragment[:max_len].rstrip()
    if " " in trimmed:
        trimmed = trimmed.rsplit(" ", 1)[0]
    return f"{trimmed}..."


def generate_complaint(text: str) -> Dict[str, str]:
    """
    Convert raw transcribed speech text into structured complaint JSON.

    Returns keys:
      - title
      - description
      - category
      - department
      - priority
      - location
    """
    cleaned_text = _clean_text(text)
    text_lower = cleaned_text.lower()

    category_info = _detect_category(text_lower)
    priority = _detect_priority(text_lower)
    location = _extract_location(cleaned_text)

    return {
        "title": _build_title(cleaned_text),
        "description": cleaned_text,
        "category": category_info["category"],
        "department": category_info["department"],
        "priority": priority,
        "location": location,
    }
