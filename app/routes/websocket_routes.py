"""WebSocket endpoints for complaint live updates."""
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException, status
from app.utils.jwt_handler import decode_access_token

from app.services.websocket_manager import websocket_manager

logger = logging.getLogger(__name__)

router = APIRouter()



@router.websocket("/ws/complaints/{complaint_id}")
async def complaint_updates_socket(websocket: WebSocket, complaint_id: str, token: str = Query(...)):
    """Keep a live connection open for complaint-specific updates."""
    try:
        payload = decode_access_token(token)
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket_manager.connect(complaint_id, websocket)
    try:
        while True:
            # Keep the connection alive and react to disconnects cleanly.
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for complaint %s", complaint_id)
    finally:
        websocket_manager.disconnect(complaint_id, websocket)
