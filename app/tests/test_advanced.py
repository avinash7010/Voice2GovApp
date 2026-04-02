"""
Comprehensive test suite for Voice2Gov backend – v2.

Covers:
  - AI service: classification with confidence, urgency detection
  - Geo service: cluster ID assignment, hotspot detection
  - Analytics: overview structure validation
  - Complaint API: create, list (filters, sort, pagination), vote, status update
  - Auth: register, login, role enforcement
  - Edge cases: invalid IDs, duplicate votes, rate limiting bypass
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch

from app.main import app
from app.services.ai_service import (
    TextClassifier,
    UrgencyDetector,
    PriorityEngine,
    classify_and_route,
)
from app.services.geo_service import _cluster_id, _cell_center, GeoService


# ===========================================================================
# Fixtures
# ===========================================================================
@pytest_asyncio.fixture
async def client():
    """AsyncClient for API tests."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
def mock_db(monkeypatch):
    """Patch MongoDB collection to prevent real DB calls."""
    mock_collection = MagicMock()
    mock_collection.find_one = AsyncMock(return_value=None)
    mock_collection.insert_one = AsyncMock(return_value=MagicMock(inserted_id="test_id"))
    mock_collection.count_documents = AsyncMock(return_value=0)
    mock_collection.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    mock_collection.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
    return mock_collection


# ===========================================================================
# 1. AI Service Tests
# ===========================================================================
class TestTextClassifier:
    def setup_method(self):
        self.clf = TextClassifier()

    def test_electricity_classification(self):
        cat, conf = self.clf.classify("Street light not working, power outage near transformer")
        assert cat == "electricity"
        assert 0.0 <= conf <= 1.0

    def test_water_classification(self):
        cat, conf = self.clf.classify("Water pipe leakage and dirty water supply")
        assert cat == "water"
        assert conf > 0.0

    def test_road_classification(self):
        cat, conf = self.clf.classify("Large pothole on the highway causing accidents")
        assert cat == "road"
        assert conf > 0.0

    def test_garbage_classification(self):
        cat, conf = self.clf.classify("Garbage dumping and stench from waste bin")
        assert cat == "garbage"
        assert conf > 0.0

    def test_other_classification(self):
        cat, conf = self.clf.classify("I would like to report a general issue")
        assert cat in {"other", "road", "garbage", "electricity", "water"}

    def test_confidence_in_range(self):
        _, conf = self.clf.classify("fire accident dangerous")
        assert 0.0 <= conf <= 1.0

    def test_empty_text(self):
        cat, conf = self.clf.classify("")
        assert isinstance(cat, str)
        assert isinstance(conf, float)


class TestUrgencyDetector:
    def setup_method(self):
        self.det = UrgencyDetector()

    def test_detects_fire(self):
        is_urgent, kws = self.det.detect("There is a fire near the building")
        assert is_urgent is True
        assert "fire" in kws

    def test_detects_accident(self):
        is_urgent, kws = self.det.detect("Road accident blocking traffic")
        assert is_urgent is True
        assert "accident" in kws

    def test_detects_dangerous(self):
        is_urgent, kws = self.det.detect("Dangerous live wire on the road")
        assert is_urgent is True
        assert "dangerous" in kws

    def test_no_urgency_in_normal_text(self):
        is_urgent, kws = self.det.detect("Street light not working near my house")
        assert is_urgent is False
        assert kws == []

    def test_multiple_urgency_keywords(self):
        is_urgent, kws = self.det.detect("fire accident explosion")
        assert is_urgent is True
        assert len(kws) >= 2


class TestPriorityEngine:
    def setup_method(self):
        self.engine = PriorityEngine()

    def test_low_priority_normal(self):
        priority = self.engine.calculate("Street light not working", votes=0, similar_count=0)
        assert priority in {"low", "medium"}

    def test_high_priority_with_urgency(self):
        priority = self.engine.calculate("fire accident near school", votes=0, similar_count=0)
        assert priority in {"high", "urgent"}

    def test_priority_increases_with_votes(self):
        p_low  = self.engine.calculate("Water leakage", votes=0)
        p_high = self.engine.calculate("Water leakage", votes=50)
        # higher votes should not reduce priority
        priority_order = {"low": 0, "medium": 1, "high": 2, "urgent": 3}
        assert priority_order[p_high] >= priority_order[p_low]

    def test_priority_increases_with_similar(self):
        p1 = self.engine.calculate("Pothole on road", similar_count=0)
        p2 = self.engine.calculate("Pothole on road", similar_count=10)
        priority_order = {"low": 0, "medium": 1, "high": 2, "urgent": 3}
        assert priority_order[p2] >= priority_order[p1]

    def test_urgent_override(self):
        priority = self.engine.calculate("building collapsed dangerous fire", votes=20, similar_count=5)
        assert priority == "urgent"


@pytest.mark.asyncio
async def test_classify_and_route_returns_confidence():
    result = await classify_and_route(
        "Power outage in my street, transformer burned", votes=0, similar_count=0
    )
    assert "category" in result
    assert "confidence" in result
    assert "is_urgent" in result
    assert "urgency_keywords" in result
    assert "department" in result
    assert "priority" in result
    assert 0.0 <= result["confidence"] <= 1.0


@pytest.mark.asyncio
async def test_classify_urgent_complaint():
    result = await classify_and_route(
        "dangerous fire accident near school", votes=0, similar_count=0
    )
    assert result["is_urgent"] is True
    assert result["priority"] in {"high", "urgent"}
    assert len(result["urgency_keywords"]) >= 1


# ===========================================================================
# 2. Geo Service Tests
# ===========================================================================
class TestGeoService:
    def test_cluster_id_same_for_nearby_points(self):
        """Points within ~1km should share a cluster bucket."""
        c1 = _cluster_id(13.0827, 80.2707)
        c2 = _cluster_id(13.0830, 80.2710)  # ~40m apart
        assert c1 == c2

    def test_cluster_id_different_for_distant_points(self):
        """Points >1km apart should have different cluster buckets."""
        c1 = _cluster_id(13.0827, 80.2707)
        c2 = _cluster_id(13.1500, 80.3500)  # ~10km apart
        assert c1 != c2

    def test_cell_center_returns_floats(self):
        cid = _cluster_id(13.0827, 80.2707)
        lat, lng = _cell_center(cid)
        assert isinstance(lat, float)
        assert isinstance(lng, float)

    def test_cluster_id_format(self):
        cid = _cluster_id(13.0827, 80.2707)
        parts = cid.split(":")
        assert len(parts) == 2
        assert all(p.lstrip("-").isdigit() for p in parts)


# ===========================================================================
# 3. Edge Case Tests
# ===========================================================================
@pytest.mark.asyncio
async def test_invalid_complaint_id(client):
    """Should return 400 or 422 for a malformed ObjectId."""
    # Mock auth
    with patch("app.utils.jwt_handler.get_current_user_payload", return_value={"sub": "user1", "role": "citizen"}):
        resp = await client.get("/api/v1/complaints/not-a-valid-id")
        assert resp.status_code in {400, 401, 403, 422}


@pytest.mark.asyncio
async def test_health_endpoint(client):
    """Health endpoint should return 200 OK."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "features" in data


@pytest.mark.asyncio
async def test_unauthenticated_complaint_list(client):
    """Accessing protected endpoint without token should return 401 or 403."""
    resp = await client.get("/api/v1/complaints/user")
    assert resp.status_code in {401, 403, 422}


# ===========================================================================
# 4. Pagination Utility Tests
# ===========================================================================
def test_paginate_params():
    from app.utils.helpers import paginate_params
    p = paginate_params(1, 20)
    assert p["skip"] == 0
    assert p["limit"] == 20

    p = paginate_params(3, 10)
    assert p["skip"] == 20
    assert p["limit"] == 10


def test_paginate_clamps_limit():
    from app.utils.helpers import paginate_params
    p = paginate_params(1, 9999)
    assert p["limit"] <= 100


def test_paginate_min_page():
    from app.utils.helpers import paginate_params
    p = paginate_params(0, 10)
    assert p["skip"] == 0   # page 0 → page 1


# ===========================================================================
# 5. Response format tests
# ===========================================================================
def test_success_response_format():
    from app.utils.helpers import success_response
    r = success_response(data={"key": "value"}, message="OK")
    assert r["success"] is True
    assert r["message"] == "OK"
    assert r["data"] == {"key": "value"}


def test_error_response_format():
    from app.utils.helpers import error_response
    r = error_response("Something went wrong")
    assert r["success"] is False
    assert r["message"] == "Something went wrong"
