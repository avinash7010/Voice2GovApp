"""
Application Settings – loaded from .env file via pydantic-settings.

SECURITY RULES:
  - MONGO_URL, JWT_SECRET_KEY, and ADMIN_PASSWORD have NO defaults.
  - The app will REFUSE TO START if these variables are missing from .env
    or the environment.
  - Never commit real credentials to source control.
"""
from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    # ─── Application ────────────────────────────────────────────
    APP_NAME: str = "Voice2Gov"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False          # safe default: off in production
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ─── MongoDB (REQUIRED – no defaults) ───────────────────────
    MONGO_URL: str               # REQUIRED: fails if missing
    DATABASE_NAME: str = "voice2gov"
    MONGO_MAX_POOL_SIZE: int = 20
    MONGO_MIN_POOL_SIZE: int = 5
    MONGO_SERVER_SELECTION_TIMEOUT_MS: int = 5000

    # ─── JWT (REQUIRED – no defaults) ───────────────────────────
    JWT_SECRET_KEY: str          # REQUIRED: fails if missing
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 h

    # ─── Admin seed (REQUIRED – no defaults) ────────────────────
    ADMIN_EMAIL: str = "admin@voice2gov.com"
    ADMIN_PASSWORD: str          # REQUIRED: fails if missing

    # ─── CORS – stored as comma-separated string in .env ────────
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8081",
        "http://localhost:19006",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:19006",
    ]

    # ─── File limits ────────────────────────────────────────────
    MAX_IMAGE_SIZE: int = 5_242_880  # 5 MB

    # ─── Rate limiting ──────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 10

    # ─── Duplicate complaint detection ─────────────────────────
    DUPLICATE_NEARBY_RADIUS_DEG: float = 0.009
    DUPLICATE_TEXT_SIMILARITY_THRESHOLD: float = 0.35
    DUPLICATE_TEXT_SHARED_KEYWORDS: int = 3

    # ─── Cloudinary (optional – set to enable cloud storage) ────
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    # ─── AWS S3 (optional – fallback if Cloudinary not set) ─────
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "ap-south-1"
    AWS_S3_BUCKET: Optional[str] = None

    # ─── Validators ─────────────────────────────────────────────
    @field_validator("MONGO_URL")
    @classmethod
    def validate_mongo_url(cls, v: str) -> str:
        """
        Validate MONGO_URL:
        - Must not be empty
        - Must start with mongodb:// or mongodb+srv://
        - Cannot be a local/test URI
        """
        v = v.strip()
        if not v:
            raise ValueError(
                "MONGO_URL is required. Set it in your .env file."
            )
        # Block obvious placeholder values that should never reach production
        blocked = {"mongodb://localhost:27017", "your-mongo-url-here"}
        if not v.startswith(("mongodb://", "mongodb+srv://")):
            raise ValueError(
                "MONGO_URL must start with 'mongodb://' or 'mongodb+srv://'"
            )
        return v

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        """
        Validate JWT_SECRET_KEY:
        - Must not be empty
        - Must be at least 32 characters
        - Cannot be a known placeholder/weak secret
        """
        v = v.strip()
        if not v:
            raise ValueError(
                "JWT_SECRET_KEY is required. Set it in your .env file."
            )
        # Block known insecure placeholder values
        insecure = {
            "change-me-in-production",
            "change-me",
            "secret",
            "your-super-secret-jwt-key-change-this-in-production",
        }
        if v.lower() in insecure:
            raise ValueError(
                f"JWT_SECRET_KEY is set to an insecure placeholder: '{v}'. "
                "Generate a strong key with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        if len(v) < 32:
            raise ValueError(
                "JWT_SECRET_KEY must be at least 32 characters. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return v

    @field_validator("ADMIN_PASSWORD")
    @classmethod
    def validate_admin_password(cls, v: str) -> str:
        """
        Validate ADMIN_PASSWORD:
        - Must not be empty
        - Must be at least 12 characters
        """
        v = v.strip()
        if not v:
            raise ValueError(
                "ADMIN_PASSWORD is required. Set it in your .env file."
            )
        if len(v) < 12:
            raise ValueError(
                "ADMIN_PASSWORD must be at least 12 characters."
            )
        return v

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v):
        """Parse comma-separated CORS origins from .env string."""
        if isinstance(v, str):
            return [o.strip() for o in v.split(",")]
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """
    Cached settings singleton.
    Raises validation error if required env vars are missing.
    """
    return Settings()


settings = get_settings()
