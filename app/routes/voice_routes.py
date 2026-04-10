"""
Voice Routes – /api/v1/voice

    POST /         – transcribe uploaded audio and return {"text": ...}
    POST /upload   – legacy upload response with metadata
"""
import logging
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.services.transcription_service import transcription_service
from app.utils.jwt_handler import get_current_user_payload
from app.utils.helpers import success_response


router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path("uploads/audio")
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
ALLOWED_MIME_TYPES = {"audio/mpeg", "audio/wav", "audio/mp4"}
MIME_EXTENSION_MAP = {
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/mp4": ".m4a",
}


async def _store_and_transcribe_audio(file: UploadFile) -> tuple[str, str]:
    """
    Validate upload, persist file locally, and return (stored_path, text).
    """
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Allowed types: audio/mpeg, audio/wav, audio/mp4",
        )

    extension = Path(file.filename or "").suffix.lower()
    if not extension:
        extension = MIME_EXTENSION_MAP[file.content_type]

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    unique_name = f"{timestamp}_{uuid4().hex}{extension}"
    destination = UPLOAD_DIR / unique_name

    file_size = 0
    chunks = []
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        file_size += len(chunk)
        if file_size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Uploaded file exceeds 5MB size limit",
            )
        chunks.append(chunk)

    file_bytes = b"".join(chunks)
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    destination.write_bytes(file_bytes)
    transcription = await transcription_service.transcribe_file(destination)
    text = transcription.strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not transcribe speech from the uploaded audio",
        )

    return str(destination).replace("\\", "/"), text


@router.post("", summary="Transcribe uploaded audio")
async def transcribe_audio(
    file: UploadFile = File(...),
    _: dict = Depends(get_current_user_payload),
):
    """
    Canonical voice-to-text endpoint.
    Returns a minimal response shape for client-side consumption.
    """
    try:
        _, text = await _store_and_transcribe_audio(file)
        return {"text": text}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to transcribe uploaded audio")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to transcribe audio: {exc}",
        ) from exc


@router.post("/upload", summary="Upload audio recording")
async def upload_audio(
    file: UploadFile = File(...),
    _: dict = Depends(get_current_user_payload),
):
    """
    Legacy upload endpoint retained for backward compatibility.
    """
    try:
        file_path, text = await _store_and_transcribe_audio(file)

        payload = {
            "file_path": file_path,
            "transcription": text,
        }
        return success_response(
            data=payload,
            message="Audio processed",
            legacy_fields=payload,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to upload audio")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload audio: {exc}",
        ) from exc
