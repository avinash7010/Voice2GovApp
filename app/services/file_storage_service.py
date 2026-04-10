"""
File Storage Service – Cloudinary-first, local fallback.

Priority:
  1. Cloudinary (if CLOUDINARY_CLOUD_NAME is set)
  2. AWS S3  (if AWS_S3_BUCKET is set)
  3. Local filesystem fallback (uploads/ dir) – for dev

Returns: { "url": str, "provider": str }
"""
import io
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Optional

from fastapi import UploadFile

logger = logging.getLogger(__name__)

UPLOAD_DIR = Path("uploads")


# ---------------------------------------------------------------------------
# Cloudinary uploader
# ---------------------------------------------------------------------------
async def _upload_cloudinary(file_bytes: bytes, filename: str, folder: str = "voice2gov") -> str:
    """Upload bytes to Cloudinary. Returns secure URL."""
    try:
        import cloudinary                    # type: ignore
        import cloudinary.uploader           # type: ignore
        from app.config.settings import settings  # noqa

        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
        # Run blocking call in thread pool
        import asyncio
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: cloudinary.uploader.upload(
                io.BytesIO(file_bytes),
                folder=folder,
                public_id=f"{folder}/{filename}",
                overwrite=False,
                resource_type="auto",
            ),
        )
        return result["secure_url"]
    except Exception as exc:
        logger.error("Cloudinary upload failed: %s", exc)
        raise


# ---------------------------------------------------------------------------
# AWS S3 uploader
# ---------------------------------------------------------------------------
async def _upload_s3(file_bytes: bytes, filename: str, bucket: str) -> str:
    """Upload bytes to AWS S3. Returns public URL."""
    try:
        import aioboto3  # type: ignore
        from app.config.settings import settings

        session = aioboto3.Session(
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        key = f"voice2gov/{filename}"
        async with session.client("s3") as s3:
            await s3.put_object(
                Bucket=bucket,
                Key=key,
                Body=file_bytes,
                ContentType="image/jpeg",
                ACL="public-read",
            )
        return f"https://{bucket}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
    except Exception as exc:
        logger.error("S3 upload failed: %s", exc)
        raise


# ---------------------------------------------------------------------------
# Local fallback
# ---------------------------------------------------------------------------
async def _save_local(file_bytes: bytes, filename: str) -> str:
    UPLOAD_DIR.mkdir(exist_ok=True)
    dest = UPLOAD_DIR / filename
    dest.write_bytes(file_bytes)
    # Return a relative URL (needs static file mount in main.py)
    return f"/uploads/{filename}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
class FileStorageService:

    async def upload_file(
        self,
        file: Optional[UploadFile] = None,
        file_bytes: Optional[bytes] = None,
        original_name: str = "image.jpg",
    ) -> dict:
        """
        Accept file from:
        - UploadFile (multipart form)
        - raw bytes

        Returns { "url": str, "provider": str }
        """
        # Resolve bytes
        if file is not None:
            content = await file.read()
            original_name = file.filename or original_name
        elif file_bytes is not None:
            content = file_bytes
        else:
            raise ValueError("No file source provided")

        # Unique filename
        ext = Path(original_name).suffix or ".jpg"
        unique_name = f"{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}"

        # Try Cloudinary → S3 → local
        from app.config.settings import settings  # lazy import

        if getattr(settings, "CLOUDINARY_CLOUD_NAME", None):
            url = await _upload_cloudinary(content, unique_name)
            provider = "cloudinary"
        elif getattr(settings, "AWS_S3_BUCKET", None):
            url = await _upload_s3(content, unique_name, settings.AWS_S3_BUCKET)
            provider = "s3"
        else:
            url = await _save_local(content, unique_name)
            provider = "local"

        logger.info("File uploaded via %s → %s", provider, url)
        return {"url": url, "provider": provider}

    async def delete_file(self, url: str) -> bool:
        """Best-effort deletion. Returns True if deleted."""
        try:
            if "cloudinary.com" in url:
                import cloudinary.uploader  # type: ignore
                # Extract public_id from URL
                public_id = url.split("/upload/")[-1].rsplit(".", 1)[0]
                cloudinary.uploader.destroy(public_id)
            elif url.startswith("/uploads/"):
                path = Path("." + url)
                if path.exists():
                    path.unlink()
            return True
        except Exception as exc:
            logger.warning("File deletion failed for %s: %s", url, exc)
            return False


file_storage = FileStorageService()
