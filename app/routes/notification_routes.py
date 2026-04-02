"""
Notification Routes – /api/notifications
  GET    /              – my notifications
  PATCH  /{id}/read     – mark one as read
  PATCH  /read-all      – mark all as read
"""
from fastapi import APIRouter, Depends, Query
from app.services.notification_service import (
    get_user_notifications,
    mark_notification_read,
    mark_all_notifications_read,
)
from app.utils.jwt_handler import get_current_user_payload
from app.utils.helpers import success_response

router = APIRouter()


@router.get(
    "/",
    summary="Get my notifications",
)
async def list_notifications(
    limit: int = Query(30, ge=1, le=100),
    current_user: dict = Depends(get_current_user_payload),
):
    notifications = await get_user_notifications(current_user["sub"], limit=limit)
    return success_response(data={"notifications": notifications})


@router.patch(
    "/{notification_id}/read",
    summary="Mark a notification as read",
)
async def mark_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user_payload),
):
    updated = await mark_notification_read(notification_id, current_user["sub"])
    if not updated:
        return success_response(message="Notification not found or already read")
    return success_response(message="Notification marked as read")


@router.patch(
    "/read-all",
    summary="Mark all my notifications as read",
)
async def mark_all_read(current_user: dict = Depends(get_current_user_payload)):
    count = await mark_all_notifications_read(current_user["sub"])
    return success_response(message=f"{count} notifications marked as read")
