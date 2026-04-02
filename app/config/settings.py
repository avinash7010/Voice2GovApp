"""
Application Settings – loaded from .env file via pydantic-settings
"""
from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Voice2Gov"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # MongoDB
    MONGO_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "voice2gov_db"

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 h

    # Admin seed
    ADMIN_EMAIL: str = "admin@voice2gov.com"
    ADMIN_PASSWORD: str = "Admin@123456"

    # CORS – stored as comma-separated string in .env
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    # File limits
    MAX_IMAGE_SIZE: int = 5_242_880  # 5 MB

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 10

    # Cloudinary (optional – set to enable cloud image storage)
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    # AWS S3 (optional – fallback if Cloudinary not set)
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "ap-south-1"
    AWS_S3_BUCKET: Optional[str] = None

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",")]
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
