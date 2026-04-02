"""
Password hashing utilities using bcrypt via passlib.
"""
from passlib.context import CryptContext

# bcrypt context – use rounds=12 for production security
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(plain_password: str) -> str:
    """Return bcrypt hash of the plain-text password."""
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True if plain_password matches the stored hash."""
    return _pwd_context.verify(plain_password, hashed_password)
