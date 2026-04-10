"""Expo push notification helpers and in-memory token registry."""
from __future__ import annotations

import logging
from typing import Set

import httpx

logger = logging.getLogger(__name__)

push_tokens: Set[str] = set()
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push_notification(token: str, title: str, body: str) -> None:
    """Send a single Expo push notification and log failures without raising."""
    token = token.strip()
    if not token:
        return

    payload = {
        "to": token,
        "title": title,
        "body": body,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(EXPO_PUSH_URL, json=payload)
            response.raise_for_status()
    except Exception as exc:
        logger.error("Failed to send push notification to %s: %s", token, exc)
