"""
Auth Routes – /api/auth
  POST /register  – citizen self-registration
  POST /login     – login and get JWT
  GET  /me        – return current user profile
"""
from fastapi import APIRouter, status, Depends
from app.services.auth_service import auth_service
from app.schemas.user_schema import UserRegisterSchema, UserLoginSchema
from app.utils.jwt_handler import get_current_user_payload
from app.utils.helpers import success_response

router = APIRouter()


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    summary="Register a new citizen account",
)
async def register(payload: UserRegisterSchema):
    """
    Creates a new citizen user and returns a JWT token.
    - Validates unique email
    - Hashes password with bcrypt
    """
    result = await auth_service.register(payload)
    return success_response(data=result, message="Registration successful")


@router.post(
    "/login",
    summary="Login and obtain JWT",
)
async def login(payload: UserLoginSchema):
    """Authenticates credentials and returns a signed JWT."""
    result = await auth_service.login(payload)
    return success_response(data=result, message="Login successful")


@router.get(
    "/me",
    summary="Get current user profile",
)
async def get_me(payload: dict = Depends(get_current_user_payload)):
    """Returns the profile of the currently authenticated user."""
    profile = await auth_service.get_profile(payload["sub"])
    return success_response(data=profile)
