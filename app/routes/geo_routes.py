"""
Geo / Hotspot Routes – /api/v1/complaints/geo

  GET /api/v1/complaints/geo/hotspots      – top complaint hotspots
  GET /api/v1/complaints/geo/nearby         – complaints near a coordinate
  POST /api/v1/complaints/geo/backfill      – admin: backfill cluster IDs
"""
from fastapi import APIRouter, Depends, Query, status, HTTPException

from app.services.geo_service import geo_service
from app.models.complaint_model import complaint_helper
from app.utils.jwt_handler import get_current_user_payload
from app.models.user_model import UserRole
from app.utils.helpers import success_response

router = APIRouter()


async def require_admin(payload: dict = Depends(get_current_user_payload)):
    if payload.get("role") != UserRole.ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return payload


# ---------------------------------------------------------------------------
# GET /api/v1/complaints/geo/hotspots
# ---------------------------------------------------------------------------
@router.get(
    "/hotspots",
    summary="Get complaint hotspots (areas with many complaints)",
)
async def get_hotspots(
    min_complaints: int = Query(3, ge=1, description="Minimum complaints to qualify as hotspot"),
    days: int           = Query(30, ge=1, le=365, description="Lookback window in days"),
    category: str       = Query(None, description="Filter by category"),
    _: dict             = Depends(get_current_user_payload),
):
    """
    Returns top locations with clustered complaints.
    Each result has: clusterId, complaint_count, center lat/lng, top_category, severity.
    """
    hotspots = await geo_service.get_hotspots(
        min_complaints=min_complaints, days=days, category=category
    )
    return success_response(
        data={"hotspots": hotspots, "total": len(hotspots)},
        message="Hotspots retrieved",
    )


# ---------------------------------------------------------------------------
# GET /api/v1/complaints/geo/nearby
# ---------------------------------------------------------------------------
@router.get(
    "/nearby",
    summary="Get complaints near a coordinate",
)
async def get_nearby(
    lat: float  = Query(..., ge=-90, le=90),
    lng: float  = Query(..., ge=-180, le=180),
    radius: float = Query(0.009, description="Search radius in degrees (~1 km = 0.009)"),
    _: dict     = Depends(get_current_user_payload),
):
    docs = await geo_service.get_nearby_complaints(lat, lng, radius_deg=radius)
    return success_response(
        data={"complaints": [complaint_helper(d) for d in docs], "count": len(docs)},
        message="Nearby complaints retrieved",
    )


# ---------------------------------------------------------------------------
# POST /api/v1/complaints/geo/backfill  (admin only)
# ---------------------------------------------------------------------------
@router.post(
    "/backfill",
    summary="[Admin] Backfill clusterId for existing complaints",
)
async def backfill_clusters(_: dict = Depends(require_admin)):
    count = await geo_service.batch_assign_clusters()
    return success_response(data={"updated": count}, message="Cluster backfill complete")
