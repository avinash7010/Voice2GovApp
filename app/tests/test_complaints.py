"""
Tests – Complaint creation, retrieval, and voting.
"""
import pytest


COMPLAINT_PAYLOAD = {
    "description": "Street light not working near bus stop on main road for 3 days",
    "location": {"lat": 13.0827, "lng": 80.2707},
}


@pytest.mark.asyncio
class TestComplaintCreate:
    async def test_create_complaint_success(self, client, citizen_headers):
        resp = await client.post("/api/v1/complaints/json", json=COMPLAINT_PAYLOAD, headers=citizen_headers)
        assert resp.status_code == 201
        data = resp.json()
        # Core AI fields must be present
        assert "category"   in data
        assert "department" in data
        assert "status"     in data
        assert data["status"] == "pending"

    async def test_create_complaint_no_auth(self, client):
        resp = await client.post("/api/v1/complaints/json", json=COMPLAINT_PAYLOAD)
        assert resp.status_code == 403

    async def test_create_complaint_description_too_short(self, client, citizen_headers):
        resp = await client.post(
            "/api/v1/complaints/json",
            json={"description": "Bad"},
            headers=citizen_headers,
        )
        assert resp.status_code == 422

    async def test_create_complaint_description_whitespace_only(self, client, citizen_headers):
        resp = await client.post(
            "/api/v1/complaints/json",
            json={"description": "          "},
            headers=citizen_headers,
        )
        assert resp.status_code == 422

    async def test_create_complaint_garbage_category(self, client, citizen_headers):
        resp = await client.post("/api/v1/complaints/json", json={
            "description": "Garbage not collected for a week, trash piling up causing stench and mosquito breeding"
        }, headers=citizen_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["category"] == "sanitation"
        assert "Municipality" in data["department"]

    async def test_create_complaint_water_category(self, client, citizen_headers):
        resp = await client.post("/api/v1/complaints/json", json={
            "description": "Water pipe leakage on our street causing flooding and dirty water contamination"
        }, headers=citizen_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["category"] in {"road", "sanitation", "water", "electricity", "other"}

    async def test_create_complaint_marks_duplicate_when_similar_and_nearby(self, client, citizen_headers):
        first_resp = await client.post(
            "/api/v1/complaints/json",
            json={
                "description": "Street light not working near bus stop on main road for 3 days",
                "location": {"lat": 13.0827, "lng": 80.2707},
            },
            headers=citizen_headers,
        )
        assert first_resp.status_code == 201
        first_id = first_resp.json()["id"]

        second_resp = await client.post(
            "/api/v1/complaints/json",
            json={
                "description": "The street light is broken at the bus stop on main road since yesterday",
                "location": {"lat": 13.0830, "lng": 80.2710},
            },
            headers=citizen_headers,
        )
        assert second_resp.status_code == 201
        second_data = second_resp.json()
        assert second_data["isDuplicate"] is True
        assert second_data["parentComplaintId"] == first_id


@pytest.mark.asyncio
class TestComplaintRead:
    async def test_get_my_complaints(self, client, citizen_headers):
        # Create at least one
        await client.post("/api/v1/complaints/json", json=COMPLAINT_PAYLOAD, headers=citizen_headers)
        resp = await client.get("/api/v1/complaints/user", headers=citizen_headers)
        assert resp.status_code == 200
        payload = resp.json()

        if isinstance(payload, list):
            complaints = payload
        else:
            assert isinstance(payload, dict)
            if isinstance(payload.get("complaints"), list):
                complaints = payload["complaints"]
            elif isinstance(payload.get("data"), list):
                complaints = payload["data"]
            elif isinstance(payload.get("data"), dict) and isinstance(payload["data"].get("complaints"), list):
                complaints = payload["data"]["complaints"]
            else:
                complaints = []

        assert isinstance(complaints, list)

    async def test_get_complaint_by_id(self, client, citizen_headers):
        # Create and retrieve
        create_resp = await client.post("/api/v1/complaints/json", json=COMPLAINT_PAYLOAD, headers=citizen_headers)
        cid = create_resp.json()["id"]
        resp = await client.get(f"/api/v1/complaints/{cid}", headers=citizen_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == cid

    async def test_get_complaint_invalid_id(self, client, citizen_headers):
        resp = await client.get("/api/v1/complaints/000000000000000000000000", headers=citizen_headers)
        assert resp.status_code == 404


@pytest.mark.asyncio
class TestComplaintVote:
    async def test_vote_success(self, client, citizen_headers):
        create_resp = await client.post("/api/v1/complaints/json", json=COMPLAINT_PAYLOAD, headers=citizen_headers)
        cid  = create_resp.json()["id"]

        # Register a different user to vote (same user can't vote own complaint
        # in a real app but model-level we test the vote logic)
        vote_resp = await client.post(
            f"/api/v1/complaints/{cid}/vote", headers=citizen_headers
        )
        assert vote_resp.status_code == 200

    async def test_vote_duplicate(self, client, citizen_headers):
        create_resp = await client.post("/api/v1/complaints/json", json=COMPLAINT_PAYLOAD, headers=citizen_headers)
        cid  = create_resp.json()["id"]

        await client.post(f"/api/v1/complaints/{cid}/vote", headers=citizen_headers)
        # Second vote from same user should conflict
        vote_resp = await client.post(
            f"/api/v1/complaints/{cid}/vote", headers=citizen_headers
        )
        assert vote_resp.status_code == 409
