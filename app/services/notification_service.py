"""
Notification Service – Socket.IO server and helper functions.

Architecture
------------
- Socket.IO is mounted at /ws/socket.io on the ASGI app.
- Personal room: userId — receives status change notifications
- Department room: department name — receives new complaint notifications
- Cluster room: clusterId — receives trending/nearby complaint alerts
- Notifications are persisted to MongoDB for the notification feed API.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

import socketio

from app.config.database import get_notifications_collection

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Create an async Socket.IO server with CORS open (restrict by env in production)
# ---------------------------------------------------------------------------
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",      # tighten via env in production
    logger=False,
    engineio_logger=False,
)

# ---------------------------------------------------------------------------
# Socket.IO event handlers
# ---------------------------------------------------------------------------
@sio.event
async def connect(sid, environ, auth):
    """
    Client connected.
    auth dict may contain:
      - userId      → joins personal room
      - department  → joins department room
    """
    user_id    = (auth or {}).get("userId")
    department = (auth or {}).get("department")

    if user_id:
        await sio.enter_room(sid, user_id)
        logger.debug("Socket.IO: user %s joined personal room", user_id)

    if department:
        await sio.enter_room(sid, f"dept:{department}")
        logger.debug("Socket.IO: user %s joined department room %s", user_id, department)


@sio.event
async def join_cluster(sid, data):
    """Client requests to join a geo cluster room to receive nearby alerts."""
    cluster_id = data.get("clusterId")
    if cluster_id:
        await sio.enter_room(sid, f"cluster:{cluster_id}")
        logger.debug("Socket.IO: sid=%s joined cluster room %s", sid, cluster_id)


@sio.event
async def disconnect(sid):
    logger.debug("Socket.IO: client disconnected sid=%s", sid)


# ---------------------------------------------------------------------------
# Notification helpers
# ---------------------------------------------------------------------------
async def _persist_notification(user_id: str, payload: dict) -> None:
    """Save a notification to MongoDB for REST retrieval."""
    try:
        doc = {
            "userId":    user_id,
            "type":      payload.get("type"),
            "message":   payload.get("message"),
            "data":      payload.get("data"),
            "read":      False,
            "createdAt": datetime.now(timezone.utc),
        }
        await get_notifications_collection().insert_one(doc)
    except Exception as exc:
        logger.error("Failed to persist notification: %s", exc)


async def send_status_change_notification(
    user_id: str,
    complaint_id: str,
    new_status: str,
    category: str,
) -> None:
    """Push a status-change event to the complaint owner's personal room."""
    payload = {
        "type":    "STATUS_CHANGE",
        "message": f"Your complaint ({category}) status changed to {new_status.upper()}",
        "data": {
            "complaint_id": complaint_id,
            "new_status":   new_status,
            "category":     category,
        },
    }
    await sio.emit("notification", payload, room=user_id)
    await _persist_notification(user_id, payload)
    logger.info("Notified user %s: status → %s", user_id, new_status)


async def send_new_complaint_notification(
    department_room: str,
    complaint_id: str,
    category: str,
    priority: str,
) -> None:
    """Push a new-complaint event to all authority members in a department room."""
    room = f"dept:{department_room}"
    payload = {
        "type":    "NEW_COMPLAINT",
        "message": f"New {priority.upper()} priority {category} complaint assigned",
        "data": {
            "complaint_id": complaint_id,
            "category":     category,
            "priority":     priority,
        },
    }
    await sio.emit("notification", payload, room=room)
    logger.info("Broadcast new complaint %s to room %s", complaint_id, room)


async def send_authority_assignment_notification(
    user_id: str,
    complaint_id: str,
    category: str,
    department: str,
) -> None:
    """
    Notify an authority user when a complaint is assigned to them.
    """
    payload = {
        "type":    "COMPLAINT_ASSIGNED",
        "message": f"A {category} complaint has been assigned to you ({department})",
        "data": {
            "complaint_id": complaint_id,
            "category":     category,
            "department":   department,
        },
    }
    await sio.emit("notification", payload, room=user_id)
    await _persist_notification(user_id, payload)
    logger.info("Assignment notification sent to authority %s", user_id)


async def send_trending_complaint_notification(
    cluster_id: str,
    complaint_id: str,
    category: str,
) -> None:
    """
    Notify nearby users (subscribed to a cluster room) about trending / urgent complaints.
    """
    room = f"cluster:{cluster_id}"
    payload = {
        "type":    "TRENDING_COMPLAINT",
        "message": f"⚠️ Urgent {category} issue reported in your area",
        "data": {
            "complaint_id": complaint_id,
            "cluster_id":   cluster_id,
            "category":     category,
        },
    }
    await sio.emit("notification", payload, room=room)
    logger.info("Trending notification sent to cluster room %s", room)


# ---------------------------------------------------------------------------
# REST notification helpers (for notification_routes)
# ---------------------------------------------------------------------------
async def get_user_notifications(user_id: str, limit: int = 30) -> list:
    cursor = (
        get_notifications_collection()
        .find({"userId": user_id})
        .sort("createdAt", -1)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    for doc in docs:
        doc["id"] = str(doc.pop("_id"))
    return docs


async def mark_notification_read(notification_id: str, user_id: str) -> bool:
    from bson import ObjectId
    result = await get_notifications_collection().update_one(
        {"_id": ObjectId(notification_id), "userId": user_id},
        {"$set": {"read": True}},
    )
    return result.modified_count > 0


async def mark_all_notifications_read(user_id: str) -> int:
    result = await get_notifications_collection().update_many(
        {"userId": user_id, "read": False},
        {"$set": {"read": True}},
    )
    return result.modified_count
