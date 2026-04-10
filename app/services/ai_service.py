"""
AI Service – NLP Text Classification, Image Validation, and Priority Scoring.

Components
----------
1. TextClassifier  – spaCy + keyword hybrid classifier with confidence score
2. ImageProcessor  – OpenCV/Pillow image validation
3. PriorityEngine  – rule-based priority scoring with urgency detection
4. UrgencyDetector – detects fire/accident/dangerous type keywords
4. VoskSTT         – Speech-to-text via Vosk (optional)

All heavy models are loaded lazily on first use so startup is fast.
"""
from __future__ import annotations

import base64
import io
import logging
import os
import re
from typing import Optional, Tuple

from app.models.complaint_category import ComplaintCategory

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Category → Department mapping
# ---------------------------------------------------------------------------
DEPARTMENT_MAP: dict[str, str] = {
    ComplaintCategory.ELECTRICITY.value: "EB (Electricity Board)",
    ComplaintCategory.WATER.value: "Water Department",
    ComplaintCategory.ROAD.value: "Highways Department",
    ComplaintCategory.SANITATION.value: "Municipality",
    ComplaintCategory.OTHER.value: "General Administration",
}

# ---------------------------------------------------------------------------
# Keyword patterns per category (used as fallback when spaCy is unavailable)
# ---------------------------------------------------------------------------
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    ComplaintCategory.ELECTRICITY.value: [
        "electricity", "power", "light", "lamp", "voltage", "outage",
        "blackout", "transformer", "electric", "wiring", "socket",
        "streetlight", "street light", "pole", "power cut", "no power",
    ],
    ComplaintCategory.WATER.value: [
        "water", "pipe", "leakage", "leak", "drain", "sewage",
        "flood", "drainage", "tap", "supply", "contaminated", "dirty water",
        "water supply", "no water", "pipeline",
    ],
    ComplaintCategory.ROAD.value: [
        "road", "pothole", "accident", "highway", "footpath", "pavement",
        "traffic", "signal", "speed breaker", "manhole", "bridge",
        "road damage", "broken road", "street",
    ],
    ComplaintCategory.SANITATION.value: [
        "garbage", "trash", "waste", "dumping", "litter", "bin",
        "sanitation", "stench", "smell", "mosquito", "hygiene",
        "garbage dump", "waste management",
    ],
}

# High-severity keywords that bump priority
SEVERITY_KEYWORDS = [
    "urgent", "emergency", "accident", "death", "fire", "flood",
    "dangerous", "hazardous", "critical", "serious", "major",
    "immediately", "collapsed", "explosion", "leaking gas",
    "electrocution", "live wire", "injury", "injured",
]

# Urgency keywords → always set priority to high or urgent
URGENCY_KEYWORDS = [
    "fire", "accident", "dangerous", "electrocution", "collapsed",
    "explosion", "injury", "death", "emergency", "hazardous", "live wire",
]


# ===========================================================================
# 1. Text Classifier – with confidence score
# ===========================================================================
class TextClassifier:
    """
    Classifies a complaint description into one of the four civic categories.
    Strategy:
      1. Try spaCy similarity scoring with representative phrases → returns confidence
      2. Fall back to keyword counting → confidence = keyword_hits / total_keywords
    
    Returns: (category: str, confidence: float)
    """

    _nlp = None   # cached spaCy model
    _docs: dict[str, object] = {}  # category → spaCy Doc

    @classmethod
    def _load_nlp(cls):
        """Lazy-load the spaCy model (en_core_web_sm)."""
        if cls._nlp is None:
            try:
                import spacy  # noqa: WPS433
                cls._nlp = spacy.load("en_core_web_sm")
                # Pre-compute reference docs for similarity
                cls._docs = {
                    cat: cls._nlp(" ".join(kws))    
                    for cat, kws in CATEGORY_KEYWORDS.items()
                }
                logger.info("✅  spaCy model loaded (en_core_web_sm)")
            except Exception as exc:
                logger.warning("⚠️  spaCy unavailable – using keyword fallback: %s", exc)
                cls._nlp = False  # sentinel: tried and failed
        return cls._nlp

    def classify(self, text: str) -> Tuple[str, float]:
        """
        Return (category, confidence) where confidence ∈ [0.0, 1.0].
        """
        text_lower = text.lower()
        nlp = self._load_nlp()

        # ── spaCy similarity approach ──────────────────────────────────
        if nlp:
            try:
                input_doc = nlp(text_lower)
                if input_doc.has_vector:
                    scores: dict[str, float] = {}
                    for cat, ref_doc in self._docs.items():
                        scores[cat] = input_doc.similarity(ref_doc)

                    best_cat = max(scores, key=lambda c: scores[c])
                    best_score = scores[best_cat]

                    if best_score >= 0.30:  # confidence threshold
                        return best_cat, round(best_score, 4)
            except Exception as exc:
                logger.warning("spaCy classify failed: %s", exc)

        # ── Keyword fallback ───────────────────────────────────────────
        return self._keyword_classify(text_lower)

    @staticmethod
    def _keyword_classify(text: str) -> Tuple[str, float]:
        """Simple keyword count classifier with confidence derived from hit ratio."""
        scores = {cat: 0 for cat in CATEGORY_KEYWORDS}
        total_kws = {cat: len(kws) for cat, kws in CATEGORY_KEYWORDS.items()}

        for cat, keywords in CATEGORY_KEYWORDS.items():
            for kw in keywords:
                if kw in text:
                    scores[cat] += 1

        best = max(scores, key=lambda c: scores[c])
        if scores[best] == 0:
            return ComplaintCategory.OTHER.value, 0.0

        confidence = round(scores[best] / total_kws[best], 4)
        return best, confidence


# ===========================================================================
# 2. Urgency Detector
# ===========================================================================
class UrgencyDetector:
    """
    Detects if a complaint contains urgency keywords (fire, accident, dangerous…).
    Returns: (is_urgent: bool, matched_keywords: list[str])
    """

    @staticmethod
    def detect(text: str) -> Tuple[bool, list]:
        text_lower = text.lower()
        matched = [kw for kw in URGENCY_KEYWORDS if kw in text_lower]
        return len(matched) > 0, matched


# ===========================================================================
# 3. Image Processor
# ===========================================================================
class ImageProcessor:
    """Validate and optionally resize base64 images using OpenCV / Pillow."""

    @staticmethod
    def validate_and_process(b64_image: str) -> Tuple[bool, str]:
        """
        Validates a base64 image string.
        :returns: (is_valid: bool, message: str)
        """
        if not b64_image:
            return True, "No image"

        # Strip data-URI header
        if "," in b64_image:
            header, b64_image = b64_image.split(",", 1)
        else:
            header = ""

        try:
            raw_bytes = base64.b64decode(b64_image, validate=True)
        except Exception:
            return False, "Invalid base64 encoding"

        # Size guard – 5 MB
        if len(raw_bytes) > 5_242_880:
            return False, "Image exceeds 5 MB limit"

        # Try OpenCV first
        try:
            import cv2  # noqa: WPS433
            import numpy as np  # noqa: WPS433
            arr = np.frombuffer(raw_bytes, np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                return False, "Could not decode image with OpenCV"
            h, w = img.shape[:2]
            logger.debug("Image validated via OpenCV: %dx%d", w, h)
            return True, f"Valid image ({w}x{h})"
        except ImportError:
            pass

        # Fallback to Pillow
        try:
            from PIL import Image  # noqa: WPS433
            img = Image.open(io.BytesIO(raw_bytes))
            img.verify()
            return True, f"Valid image ({img.format})"
        except Exception as exc:
            return False, f"Invalid image: {exc}"


# ===========================================================================
# 4. Priority Engine – with urgency override
# ===========================================================================
class PriorityEngine:
    """
    Calculates complaint priority from:
      - Urgency keyword detection (instant high/urgent)
      - Severity keywords in description  (0–3 pts)
      - Vote count                        (0–3 pts)
      - Duplicate / similar complaints    (0–2 pts)

    Returns: 'low' | 'medium' | 'high' | 'urgent'
    """

    urgency_detector = UrgencyDetector()

    def calculate(
        self,
        description: str,
        votes: int = 0,
        similar_count: int = 0,
    ) -> str:
        """
        :returns: 'low' | 'medium' | 'high' | 'urgent'
        """
        text_lower = description.lower()

        # ── Urgency override ─────────────────────────────────────────
        is_urgent, _ = self.urgency_detector.detect(text_lower)
        if is_urgent:
            # Still check vote/similar for differentiation between urgent and high
            if votes >= 10 or similar_count >= 3:
                return "urgent"
            return "high"

        score = 0

        # ── Severity keyword scoring ──────────────────────────────────
        keyword_hits = sum(1 for kw in SEVERITY_KEYWORDS if kw in text_lower)
        if keyword_hits >= 3:
            score += 3
        elif keyword_hits == 2:
            score += 2
        elif keyword_hits == 1:
            score += 1

        # ── Votes ─────────────────────────────────────────────────────
        if votes >= 50:
            score += 3
        elif votes >= 20:
            score += 2
        elif votes >= 5:
            score += 1

        # ── Repetition / similar open complaints ──────────────────────
        if similar_count >= 5:
            score += 2
        elif similar_count >= 2:
            score += 1

        # Map score to priority level
        if score >= 6:
            return "urgent"
        if score >= 4:
            return "high"
        if score >= 2:
            return "medium"
        return "low"


# ===========================================================================
# 5. Vosk Speech-to-Text (optional)
# ===========================================================================
class VoskSTT:
    """
    Minimal wrapper around Vosk for offline speech-to-text.
    Returns empty string if Vosk or model is unavailable.
    Model path: vosk-model/ inside the repo root.
    """

    _model = None
    import os
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    MODEL_PATH = os.path.join(BASE_DIR, "vosk-model")

    @classmethod
    def _load_model(cls):
        if cls._model is None:
            try:
                from vosk import Model  # noqa: WPS433
                cls._model = Model(cls.MODEL_PATH)
                logger.info("✅  Vosk model loaded from '%s'", cls.MODEL_PATH)
            except Exception as exc:
                logger.warning("⚠️  Vosk unavailable: %s", exc)
                cls._model = False
        return cls._model

    def transcribe(self, audio_bytes: bytes, sample_rate: int = 16000) -> str:
        """
        Transcribe raw PCM audio bytes.
        :returns: Transcribed text or empty string.
        """
        import json  # noqa: WPS433
        model = self._load_model()
        if not model:
            return ""
        try:
            from vosk import KaldiRecognizer  # noqa: WPS433
            rec = KaldiRecognizer(model, sample_rate)
            rec.AcceptWaveform(audio_bytes)
            result = json.loads(rec.FinalResult())
            return result.get("text", "")
        except Exception as exc:
            logger.error("Vosk transcription error: %s", exc)
            return ""


# ===========================================================================
# Module-level singletons
# ===========================================================================
text_classifier  = TextClassifier()
image_processor  = ImageProcessor()
priority_engine  = PriorityEngine()
urgency_detector = UrgencyDetector()
vosk_stt         = VoskSTT()


# ===========================================================================
# Public API called by complaint_service
# ===========================================================================
async def classify_and_route(
    description: str,
    votes: int = 0,
    similar_count: int = 0,
) -> dict:
    """
    Main AI pipeline entry point.

    :param description:    Complaint text (may include transcribed speech).
    :param votes:          Current vote count (for priority recalculation).
    :param similar_count:  Count of similar open complaints.
    :returns: {
        category, department, priority,
        confidence, is_urgent, urgency_keywords
    }
    """
    # 1. Classify category with confidence
    category, confidence = text_classifier.classify(description)

    # 2. Map to department
    department = DEPARTMENT_MAP.get(category, "General Administration")

    # 3. Detect urgency
    is_urgent, urgency_keywords = urgency_detector.detect(description)

    # 4. Calculate priority (urgency-aware)
    priority = priority_engine.calculate(description, votes=votes, similar_count=similar_count)

    return {
        "category":         category,
        "department":       department,
        "priority":         priority,
        "confidence":       confidence,
        "is_urgent":        is_urgent,
        "urgency_keywords": urgency_keywords,
    }
