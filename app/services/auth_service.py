"""
Auth Service – registration and login business logic.
Sits between routes and repositories, orchestrating hashing, token creation, etc.
"""
import logging
from fastapi import HTTPException, status
from app.repositories.user_repo import user_repo
from app.utils.password_hasher import hash_password, verify_password
from app.utils.jwt_handler import create_access_token
from app.models.user_model import UserRole, user_helper
from app.schemas.user_schema import UserRegisterSchema, UserLoginSchema

logger = logging.getLogger(__name__)


class AuthService:
    """Handles registration, login, and token issuance."""

    async def register(self, payload: UserRegisterSchema) -> dict:
        """
        Register a new citizen user.
        Raises HTTPException if email is already taken.
        """
        # 1. Check uniqueness
        if await user_repo.email_exists(payload.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        # 2. Hash password
        hashed = hash_password(payload.password)

        # 3. Build document
        user_data = {
            "name":     payload.name,
            "email":    payload.email.lower(),
            "password": hashed,
            "role":     UserRole.CITIZEN,
            "is_active": True,
            "phone":    payload.phone,
            "address":  payload.address,
        }

        # 4. Persist
        created = await user_repo.create(user_data)
        logger.info("New user registered: %s", created["email"])

        # 5. Build token
        token = create_access_token(
            data={"sub": str(created["_id"]), "role": created["role"]}
        )

        return {
            "access_token": token,
            "token_type":   "bearer",
            "user":         user_helper(created),
        }

    async def login(self, payload: UserLoginSchema) -> dict:
        """
        Authenticate and return a JWT.
        Raises HTTPException on invalid credentials or inactive account.
        """
        # 1. Fetch user
        user = await user_repo.find_by_email(payload.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        # 2. Verify password
        if not verify_password(payload.password, user["password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        # 3. Check active
        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Contact admin.",
            )

        # 4. Issue token
        token = create_access_token(
            data={"sub": str(user["_id"]), "role": user["role"]}
        )

        return {
            "access_token": token,
            "token_type":   "bearer",
            "user":         user_helper(user),
        }

    async def get_profile(self, user_id: str) -> dict:
        """Return a public user profile dict."""
        user = await user_repo.find_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user_helper(user)


auth_service = AuthService()
