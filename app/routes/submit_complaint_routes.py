"""Public complaint submission endpoint used by the mobile app."""
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import ValidationError

from app.models.complaint_model import normalize_complaint
from app.schemas.complaint_schema import ComplaintResponseSchema, ComplaintSubmitSchema
from app.services.complaint_service import complaint_service
from app.utils.jwt_handler import get_current_user_payload
from app.utils.helpers import success_response

router = APIRouter()


@router.post(
    "/complaints",
    summary="Submit a structured complaint",
    response_model=dict,
)
async def submit_complaint(
    request: Request,
    title: str | None = Form(default=None),
    description: str | None = Form(default=None),
    category: str | None = Form(default=None),
    department: str | None = Form(default=None),
    priority: str | None = Form(default=None),
    location: str | None = Form(default=None),
    push_token: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    current_user: dict = Depends(get_current_user_payload),
):
    """Store a structured complaint with optional image and return the normalized complaint object."""
    content_type = request.headers.get("content-type", "")

    try:
        if "application/json" in content_type:
            body = await request.json()
            payload = ComplaintSubmitSchema(**body)
        else:
            if not all([title, description, category, department, priority, location]):
                raise HTTPException(
                    status_code=422,
                    detail="Missing required complaint fields in form data.",
                )

            payload = ComplaintSubmitSchema(
                title=title,
                description=description,
                category=category,
                department=department,
                priority=priority,
                location=location,
                push_token=push_token,
            )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    # Pass image file to the service for upload
    complaint = await complaint_service.create_structured_complaint(
        payload, user_id=user_id, image_file=image
    )
    normalized = normalize_complaint(complaint)
    return success_response(
        data=normalized,
        message="Complaint submitted",
        legacy_fields=normalized,
    )
