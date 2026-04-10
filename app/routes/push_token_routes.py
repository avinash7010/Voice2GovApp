"""Routes for registering Expo push tokens."""
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status

from app.services.notifications_service import push_tokens
from app.utils.helpers import success_response

router = APIRouter()


class PushTokenRegisterSchema(BaseModel):
    token: str = Field(..., min_length=1)


@router.post("/register-push-token", summary="Register an Expo push token")
async def register_push_token(payload: PushTokenRegisterSchema):
    token = payload.token.strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token is required",
        )

    before_count = len(push_tokens)
    push_tokens.add(token)
    after_count = len(push_tokens)

    return success_response(
        message="Push token registered",
        data={
            "token": token,
            "added": after_count > before_count,
            "total": after_count,
        },
    )
