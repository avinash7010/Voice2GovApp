"""
JWT Handler – token creation and decoding.
Uses python-jose with HS256.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config.settings import settings

# Reusable bearer scheme
bearer_scheme = HTTPBearer()
bearer_scheme_optional = HTTPBearer(auto_error=False)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a signed JWT.
    :param data: payload dict – must include a 'sub' key (user id as str).
    :param expires_delta: optional custom expiry; defaults to settings value.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and verify a JWT. Raises HTTPException on failure.
    :returns: payload dict
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        return payload
    except JWTError:
        raise credentials_exception


# ---------------------------------------------------------------------------
# FastAPI dependency – extracts & validates the bearer token
# ---------------------------------------------------------------------------
async def get_current_user_payload(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """FastAPI dependency: validate JWT and return the decoded payload."""
    return decode_access_token(credentials.credentials)


async def get_optional_user_payload(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme_optional),
) -> Optional[dict]:
    """Return decoded JWT payload when present, otherwise None."""
    if credentials is None:
        return None
    try:
        return decode_access_token(credentials.credentials)
    except HTTPException:
        return None
