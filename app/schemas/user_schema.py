"""
Pydantic request / response schemas for User endpoints.
These are separate from the MongoDB model so API contracts stay stable.
"""
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from app.models.user_model import UserRole


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------
class UserRegisterSchema(BaseModel):
    name: str            = Field(..., min_length=2, max_length=100, examples=["Rahul Kumar"])
    email: EmailStr      = Field(..., examples=["rahul@example.com"])
    password: str        = Field(..., min_length=8, examples=["Secret@123"])
    phone: Optional[str] = Field(None, examples=["+919876543210"])
    address: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Rahul Kumar",
                "email": "rahul@example.com",
                "password": "Secret@123",
                "phone": "+919876543210",
                "address": "Chennai, Tamil Nadu",
            }
        }


class UserLoginSchema(BaseModel):
    email: EmailStr
    password: str

    class Config:
        json_schema_extra = {
            "example": {"email": "rahul@example.com", "password": "Secret@123"}
        }


class UpdateRoleSchema(BaseModel):
    user_id: str
    role: UserRole

    class Config:
        json_schema_extra = {
            "example": {"user_id": "6628a...", "role": "authority"}
        }


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------
class UserResponseSchema(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    is_active: bool
    phone: Optional[str] = None
    address: Optional[str] = None


class TokenResponseSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponseSchema
