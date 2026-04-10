"""
Duplicate complaint detection helpers.

Keeps the matching logic separate from complaint persistence so the service
layer stays focused on orchestration.
"""
import logging
import re
from typing import Optional

from app.config.settings import settings
from app.services.ai_service import text_classifier
from app.services.geo_service import geo_service

logger = logging.getLogger(__name__)


def _normalize_tokens(text: str) -> set[str]:
    cleaned = re.sub(r"[^a-z0-9\s]", " ", (text or "").lower())
    tokens = [token for token in cleaned.split() if len(token) >= 3]
    stop_words = {
        "the", "and", "for", "with", "that", "this", "near", "from", "there",
        "have", "has", "had", "are", "was", "were", "not", "but", "you", "your",
        "our", "their", "its", "about", "into", "over", "under", "road", "street",
    }
    return {token for token in tokens if token not in stop_words}


def _text_similarity(left: str, right: str) -> float:
    tokens_left = _normalize_tokens(left)
    tokens_right = _normalize_tokens(right)
    if not tokens_left or not tokens_right:
        return 0.0
    union = tokens_left | tokens_right
    if not union:
        return 0.0
    return len(tokens_left & tokens_right) / len(union)


class DuplicateDetectionService:
    async def find_parent_complaint_id(
        self,
        description: str,
        lat: Optional[float],
        lng: Optional[float],
    ) -> Optional[str]:
        if lat is None or lng is None:
            return None

        nearby = await geo_service.get_nearby_complaints(
            lat=lat,
            lng=lng,
            radius_deg=settings.DUPLICATE_NEARBY_RADIUS_DEG,
        )
        if not nearby:
            return None

        input_category, _ = text_classifier.classify(description)
        input_tokens = _normalize_tokens(description)
        best_match_id = None
        best_score = 0.0

        for candidate in nearby:
            if candidate.get("status") == "resolved":
                continue

            candidate_description = str(candidate.get("description") or "")
            candidate_category, _ = text_classifier.classify(candidate_description)
            same_category = input_category == candidate_category

            similarity = _text_similarity(description, candidate_description)
            shared_tokens = len(input_tokens & _normalize_tokens(candidate_description))
            similarity_threshold = (
                settings.DUPLICATE_TEXT_SIMILARITY_THRESHOLD - 0.05
                if same_category
                else settings.DUPLICATE_TEXT_SIMILARITY_THRESHOLD
            )
            min_shared_keywords = 2 if same_category else settings.DUPLICATE_TEXT_SHARED_KEYWORDS

            if (
                similarity >= similarity_threshold
                or shared_tokens >= min_shared_keywords
            ) and similarity > best_score:
                best_score = similarity
                best_match_id = str(candidate.get("_id"))

        if best_match_id:
            logger.info("Duplicate complaint match found: %s", best_match_id)
        return best_match_id


duplicate_detection_service = DuplicateDetectionService()