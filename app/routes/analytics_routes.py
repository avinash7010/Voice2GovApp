"""
Admin Analytics Routes – /api/v1/admin/analytics & /api/v1/admin/trends

All routes:
  GET /api/v1/admin/analytics           – platform overview stats
  GET /api/v1/admin/analytics/trends    – complaints over time
  GET /api/v1/admin/analytics/departments – department performance
"""
from typing import Literal

from fastapi import APIRouter, Depends, Query, status, HTTPException

from app.services.analytics_service import analytics_service
from app.utils.jwt_handler import get_current_user_payload
from app.models.user_model import UserRole
from app.utils.helpers import success_response

router = APIRouter()


# ---------------------------------------------------------------------------
# Role guard – admin only
# ---------------------------------------------------------------------------
async def require_admin(payload: dict = Depends(get_current_user_payload)):
    if payload.get("role") != UserRole.ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return payload


# ---------------------------------------------------------------------------
# GET /api/v1/admin/analytics
# ---------------------------------------------------------------------------
@router.get(
    "",
    summary="Platform analytics overview",
    description=(
        "Returns: total complaints, per-category breakdown, per-department breakdown, "
        "resolution rate, pending vs resolved ratio, total users."
    ),
)
async def get_analytics(_: dict = Depends(require_admin)):
    data = await analytics_service.get_overview()
    return success_response(data=data, message="Analytics retrieved")


# ---------------------------------------------------------------------------
# GET /api/v1/admin/analytics/trends
# ---------------------------------------------------------------------------
@router.get(
    "/trends",
    summary="Complaint trends over time (daily / weekly)",
)
async def get_trends(
    period: Literal["daily", "weekly"] = Query("daily", description="Grouping period"),
    _: dict = Depends(require_admin),
):
    data = await analytics_service.get_trends(period=period)
    return success_response(data=data, message=f"Trends ({period}) retrieved")


# ---------------------------------------------------------------------------
# GET /api/v1/admin/analytics/departments
# ---------------------------------------------------------------------------
@router.get(
    "/departments",
    summary="Department-wise resolution performance",
)
async def get_department_performance(_: dict = Depends(require_admin)):
    data = await analytics_service.get_department_performance()
    return success_response(data=data, message="Department performance retrieved")
