"""WebSocket connection manager for complaint live updates."""
import logging
from collections import defaultdict
from typing import DefaultDict, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Track WebSocket clients per complaint ID and broadcast updates."""

    def __init__(self) -> None:
        self._complaint_connections: DefaultDict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, complaint_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._complaint_connections[complaint_id].add(websocket)
        logger.info(
            "WebSocket connected for complaint %s (clients=%d)",
            complaint_id,
            len(self._complaint_connections[complaint_id]),
        )

    def disconnect(self, complaint_id: str, websocket: WebSocket) -> None:
        connections = self._complaint_connections.get(complaint_id)
        if not connections:
            return

        connections.discard(websocket)
        if not connections:
            self._complaint_connections.pop(complaint_id, None)
        logger.info(
            "WebSocket disconnected for complaint %s (clients=%d)",
            complaint_id,
            len(self._complaint_connections.get(complaint_id, set())),
        )

    async def broadcast_complaint(self, complaint_id: str, complaint: dict) -> None:
        """Broadcast normalized complaint data to all connected clients."""
        connections = list(self._complaint_connections.get(complaint_id, set()))
        if not connections:
            return

        stale_connections = []
        for websocket in connections:
            try:
                await websocket.send_json(complaint)
            except Exception as exc:
                logger.warning(
                    "WebSocket broadcast failed for complaint %s: %s",
                    complaint_id,
                    exc,
                )
                stale_connections.append(websocket)

        for websocket in stale_connections:
            self.disconnect(complaint_id, websocket)


websocket_manager = WebSocketManager()
