"""
Shared pytest fixtures and async test configuration.
Uses mongomock-motor for an in-memory MongoDB replacement.
"""
import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock

# ── App imports ─────────────────────────────────────────────────
from app.main import app
from app.config import database as db_module


# ---------------------------------------------------------------------------
# Event-loop policy
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def event_loop():
    """Create a single event loop for the whole test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ---------------------------------------------------------------------------
# In-memory MongoDB via mongomock-motor
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture(scope="session", autouse=True)
async def mock_db():
    """
    Replace the real Motor client with mongomock-motor so tests
    run without a real MongoDB instance.
    """
    import mongomock_motor
    client = mongomock_motor.AsyncMongoMockClient()
    mock_database = client["voice2gov_test"]

    # Patch module-level globals
    db_module._client = client
    db_module._db     = mock_database

    yield mock_database

    client.close()


# ---------------------------------------------------------------------------
# HTTP Test client
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture(scope="session")
async def client():
    """Async HTTPX client that talks directly to the ASGI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Registered user fixture
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture(scope="session")
async def registered_user(client):
    """Register a fresh citizen user and return the response JSON."""
    resp = await client.post("/api/auth/register", json={
        "name":     "Test Citizen",
        "email":    "testcitizen@example.com",
        "password": "Test@12345",
        "phone":    "+919999999999",
    })
    assert resp.status_code == 201, resp.text
    return resp.json()["data"]


@pytest_asyncio.fixture(scope="session")
async def citizen_token(registered_user):
    return registered_user["access_token"]


@pytest_asyncio.fixture(scope="session")
async def citizen_headers(citizen_token):
    return {"Authorization": f"Bearer {citizen_token}"}
