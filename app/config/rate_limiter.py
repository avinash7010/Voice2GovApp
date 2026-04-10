"""Shared rate limiter configuration for FastAPI routes and app setup."""

from slowapi import Limiter
from slowapi.util import get_remote_address


# Default: 60 requests per minute per client IP.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"],
)
