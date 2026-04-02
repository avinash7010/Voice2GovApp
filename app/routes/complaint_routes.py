"""
Complaint Routes – /api/v1/complaints

  POST   /                      – file a new complaint (citizen) [multipart or JSON]
  GET    /user                  – my complaints (citizen)
  GET    /{id}                  – single complaint (authenticated)
  POST   /{id}/vote             – upvote a complaint (citizen)
  GET    /                      – list all complaints (authority | admin)
  GET    /authority/complaints  – department complaints (authority)
  PATCH  /{id}/status           – update status (authority | admin)
  GET    /geo/hotspots          – geo hotspots (see geo_routes)
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query, status, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse

from app.services.complaint_service import complaint_service
from app.schemas.complaint_schema import ComplaintCreateSchema, ComplaintStatusUpdateSchema
from app.utils.jwt_handler import get_current_user_payload
from app.utils.helpers import success_response, paginate_params
from app.models.user_model import UserRole

router = APIRouter()


# ---------------------------------------------------------------------------
# Role guard helpers
# ---------------------------------------------------------------------------
def _require_role(*roles: UserRole):
    """Returns a dependency that raises 403 if user's role not in `roles`."""
    async def _check(payload: dict = Depends(get_current_user_payload)):
        if payload.get("role") not in [r.value for r in roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return payload
    return _check


def _parse_sort(sort_param: Optional[str]) -> tuple:
    """
    Parse ?sort=createdAt_desc → ("createdAt", -1).
    Defaults to createdAt_desc if invalid.
    """
    valid_fields = {"createdAt", "priority", "votes", "status", "updatedAt"}
    if not sort_param:
        return "createdAt", -1
    if "_" in sort_param:
        parts = sort_param.rsplit("_", 1)
        field = parts[0]
        direction = -1 if parts[1].lower() == "desc" else 1
        if field in valid_fields:
            return field, direction
    return "createdAt", -1


# ---------------------------------------------------------------------------
# POST /api/v1/complaints  – file a new complaint (supports multipart + JSON)
# ---------------------------------------------------------------------------
@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    summary="File a new civic complaint",
)
async def create_complaint(
    description: str   = Form(..., min_length=10, max_length=2000),
    audio_text: str    = Form(None),
    lat: float         = Form(None),
    lng: float         = Form(None),
    image: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user_payload),
):
    """
    Accepts description via form data. Optional file upload for image.
    Runs AI classification (with confidence) and geo clustering.
    """
    from app.schemas.complaint_schema import LocationSchema
    location = LocationSchema(lat=lat, lng=lng) if lat is not None and lng is not None else None

    # Build a pseudo-schema for the service
    class _Payload:
        pass
    payload = _Payload()
    payload.description = description
    payload.audio_text = audio_text
    payload.location = location
    payload.image = None  # using UploadFile instead

    result = await complaint_service.create_complaint(
        payload, user_id=current_user["sub"], image_file=image
    )
    return success_response(
        data=result,
        message=f"Complaint filed. Category: {result['category']}, Dept: {result['department']}",
    )


# JSON endpoint (for backwards compatibility / API clients without multipart)
@router.post(
    "/json",
    status_code=status.HTTP_201_CREATED,
    summary="File a new complaint (JSON body with optional base64 image)",
)
async def create_complaint_json(
    payload: ComplaintCreateSchema,
    current_user: dict = Depends(get_current_user_payload),
):
    result = await complaint_service.create_complaint(payload, user_id=current_user["sub"])
    return success_response(
        data=result,
        message=f"Complaint filed. Category: {result['category']}, Dept: {result['department']}",
    )


# ---------------------------------------------------------------------------
# GET /api/v1/complaints/user  – citizen's own complaints
# ---------------------------------------------------------------------------
@router.get("/user", summary="Get my complaints")
async def get_my_complaints(
    page: int  = Query(1,  ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort: str  = Query("createdAt_desc"),
    current_user: dict = Depends(get_current_user_payload),
):
    params    = paginate_params(page, limit)
    sort_field, sort_dir = _parse_sort(sort)
    complaints = await complaint_service.get_user_complaints(
        current_user["sub"], skip=params["skip"], limit=params["limit"]
    )
    total = len(complaints)
    return success_response(data={
        "complaints": complaints,
        "page": page,
        "limit": limit,
        "total": total,
    })


# ---------------------------------------------------------------------------
# GET /api/v1/complaints/{id}  – single complaint detail
# ---------------------------------------------------------------------------
@router.get("/{complaint_id}", summary="Get a single complaint by ID")
async def get_complaint(
    complaint_id: str,
    _: dict = Depends(get_current_user_payload),
):
    complaint = await complaint_service.get_complaint_by_id(complaint_id)
    return success_response(data=complaint)


# ---------------------------------------------------------------------------
# POST /api/v1/complaints/{id}/vote  – upvote
# ---------------------------------------------------------------------------
@router.post("/{complaint_id}/vote", summary="Upvote a complaint")
async def vote_complaint(
    complaint_id: str,
    current_user: dict = Depends(get_current_user_payload),
):
    """Each user can vote once per complaint. Voting recalculates priority."""
    result = await complaint_service.vote_complaint(complaint_id, current_user["sub"])
    return success_response(data=result, message="Vote registered")


# ---------------------------------------------------------------------------
# GET /api/v1/complaints  – admin/authority: all complaints with filters + sort
# ---------------------------------------------------------------------------
@router.get(
    "/",
    summary="[Authority/Admin] List all complaints with filters, sorting, pagination",
)
async def list_all_complaints(
    page: int       = Query(1,  ge=1),
    limit: int      = Query(50, ge=1, le=100),
    status_filter: str  = Query(None, alias="status"),
    category: str   = Query(None),
    department: str = Query(None),
    priority: str   = Query(None),
    sort: str       = Query("createdAt_desc", description="field_asc or field_desc"),
    current_user: dict = Depends(
        _require_role(UserRole.AUTHORITY, UserRole.ADMIN)
    ),
):
    filters: dict = {}
    if status_filter:
        filters["status"] = status_filter
    if category:
        filters["category"] = category
    if department:
        filters["department"] = department
    if priority:
        filters["priority"] = priority

    sort_field, sort_dir = _parse_sort(sort)
    params = paginate_params(page, limit)
    complaints = await complaint_service.get_all_complaints(
        filters=filters, skip=params["skip"], limit=params["limit"],
        sort_field=sort_field, sort_dir=sort_dir,
    )
    from app.repositories.complaint_repo import complaint_repo
    total = await complaint_repo.count(filters)
    return success_response(data={
        "complaints": complaints,
        "total": total,
        "page": page,
        "limit": limit,
    })


# ---------------------------------------------------------------------------
# GET /api/v1/authority/complaints  – authority dept-scoped complaints
# ---------------------------------------------------------------------------
@router.get(
    "/authority/complaints",
    summary="[Authority] Get complaints for my department",
)
async def authority_complaints(
    department: str = Query(..., description="Department name, e.g. 'EB (Electricity Board)'"),
    page: int       = Query(1,  ge=1),
    limit: int      = Query(50, ge=1, le=100),
    current_user: dict = Depends(
        _require_role(UserRole.AUTHORITY, UserRole.ADMIN)
    ),
):
    params = paginate_params(page, limit)
    complaints = await complaint_service.get_authority_complaints(
        department=department, skip=params["skip"], limit=params["limit"]
    )
    return success_response(data={"complaints": complaints, "department": department})


# ---------------------------------------------------------------------------
# PATCH /api/v1/complaints/{id}/status  – update status
# ---------------------------------------------------------------------------
@router.patch(
    "/{complaint_id}/status",
    summary="[Authority/Admin] Update complaint status",
)
async def update_status(
    complaint_id: str,
    payload: ComplaintStatusUpdateSchema,
    current_user: dict = Depends(
        _require_role(UserRole.AUTHORITY, UserRole.ADMIN)
    ),
):
    """
    Updates complaint status (pending → in_progress → resolved | rejected).
    Triggers Socket.IO notification to the complaint owner.
    """
    result = await complaint_service.update_status(
        complaint_id, payload, actor_id=current_user["sub"]
    )
    return success_response(data=result, message="Status updated")
