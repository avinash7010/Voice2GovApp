"""
Admin Routes – /api/admin  (admin role only)
  GET    /users               – list all users
  PATCH  /user/role           – change a user's role
  DELETE /user/{id}           – delete a user
  GET    /complaints          – all complaints (optionally filtered)
  GET    /stats               – platform statistics
"""
from fastapi import APIRouter, Depends, Query, status, HTTPException

from app.repositories.user_repo import user_repo
from app.repositories.complaint_repo import complaint_repo
from app.services.complaint_service import complaint_service
from app.schemas.user_schema import UpdateRoleSchema
from app.models.user_model import UserRole, user_helper
from app.models.complaint_model import complaint_helper
from app.utils.jwt_handler import get_current_user_payload
from app.utils.helpers import success_response, paginate_params

router = APIRouter()


# ---------------------------------------------------------------------------
# Role guard – admin only
# ---------------------------------------------------------------------------
async def require_admin(payload: dict = Depends(get_current_user_payload)):
    if payload.get("role") != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return payload


# ---------------------------------------------------------------------------
# GET /api/admin/users
# ---------------------------------------------------------------------------
@router.get(
    "/users",
    summary="List all registered users",
)
async def list_users(
    page: int  = Query(1,  ge=1),
    limit: int = Query(50, ge=1, le=100),
    legacy: bool = Query(False, description="Return legacy wrapped response"),
    _: dict = Depends(require_admin),
):
    params = paginate_params(page, limit)
    users  = await user_repo.find_all(skip=params["skip"], limit=params["limit"])
    total  = await user_repo.count()
    user_items = [user_helper(u) for u in users]
    if legacy:
        return success_response(
            data={"users": user_items, "total": total, "page": page}
        )
    payload = {
        "data": user_items,
        "page": page,
        "limit": params["limit"],
        "total": total,
        "users": user_items,
    }
    return success_response(data=payload, message="Users retrieved", legacy_fields=payload)


# ---------------------------------------------------------------------------
# PATCH /api/admin/user/role
# ---------------------------------------------------------------------------
@router.patch(
    "/user/role",
    summary="Update a user's role",
)
async def update_user_role(
    payload: UpdateRoleSchema,
    _: dict = Depends(require_admin),
):
    updated = await user_repo.update_role(payload.user_id, payload.role.value)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return success_response(data=user_helper(updated), message="Role updated")


# ---------------------------------------------------------------------------
# DELETE /api/admin/user/{id}
# ---------------------------------------------------------------------------
@router.delete(
    "/user/{user_id}",
    summary="Delete a user account",
)
async def delete_user(
    user_id: str,
    admin: dict = Depends(require_admin),
):
    # Prevent self-deletion
    if user_id == admin["sub"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    deleted = await user_repo.delete(user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found")
    return success_response(message="User deleted")


# ---------------------------------------------------------------------------
# GET /api/admin/complaints
# ---------------------------------------------------------------------------
@router.get(
    "/complaints",
    summary="Admin: list all complaints with filters",
)
async def admin_list_complaints(
    page: int       = Query(1,  ge=1),
    limit: int      = Query(50, ge=1, le=100),
    status_filter: str  = Query(None, alias="status"),
    category: str   = Query(None),
    department: str = Query(None),
    priority: str   = Query(None),
    legacy: bool    = Query(False, description="Return legacy wrapped response"),
    _: dict = Depends(require_admin),
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

    params = paginate_params(page, limit)
    complaints = await complaint_service.get_all_complaints(
        filters=filters, skip=params["skip"], limit=params["limit"]
    )
    total = await complaint_repo.count(filters)
    if legacy:
        return success_response(
            data={"complaints": complaints, "total": total, "page": page}
        )
    payload = {
        "data": complaints,
        "page": page,
        "limit": params["limit"],
        "total": total,
        "complaints": complaints,
    }
    return success_response(data=payload, message="Complaints retrieved", legacy_fields=payload)


# ---------------------------------------------------------------------------
# GET /api/admin/stats
# ---------------------------------------------------------------------------
@router.get(
    "/stats",
    summary="Platform statistics dashboard",
)
async def platform_stats(_: dict = Depends(require_admin)):
    """Returns aggregate counts for admin dashboard."""
    total_users      = await user_repo.count()
    total_complaints = await complaint_repo.count()
    pending          = await complaint_repo.count({"status": "pending"})
    in_progress      = await complaint_repo.count({"status": "in_progress"})
    resolved         = await complaint_repo.count({"status": "resolved"})
    rejected         = await complaint_repo.count({"status": "rejected"})

    return success_response(data={
        "total_users":      total_users,
        "total_complaints": total_complaints,
        "by_status": {
            "pending":     pending,
            "in_progress": in_progress,
            "resolved":    resolved,
            "rejected":    rejected,
        },
    })
