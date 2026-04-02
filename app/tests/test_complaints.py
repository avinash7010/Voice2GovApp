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
        resp = await client.post("/api/complaints/", json=COMPLAINT_PAYLOAD, headers=citizen_headers)
        assert resp.status_code == 201
        data = resp.json()["data"]
        # Core AI fields must be present
        assert "category"   in data
        assert "department" in data
        assert "status"     in data
        assert data["status"] == "pending"

    async def test_create_complaint_no_auth(self, client):
        resp = await client.post("/api/complaints/", json=COMPLAINT_PAYLOAD)
        assert resp.status_code == 403

    async def test_create_complaint_description_too_short(self, client, citizen_headers):
        resp = await client.post(
            "/api/complaints/",
            json={"description": "Bad"},
            headers=citizen_headers,
        )
        assert resp.status_code == 422

    async def test_create_complaint_garbage_category(self, client, citizen_headers):
        resp = await client.post("/api/complaints/", json={
            "description": "Garbage not collected for a week, trash piling up causing stench and mosquito breeding"
        }, headers=citizen_headers)
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["category"] == "garbage"
        assert "Municipality" in data["department"]

    async def test_create_complaint_water_category(self, client, citizen_headers):
        resp = await client.post("/api/complaints/", json={
            "description": "Water pipe leakage on our street causing flooding and dirty water contamination"
        }, headers=citizen_headers)
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["category"] == "water"


@pytest.mark.asyncio
class TestComplaintRead:
    async def test_get_my_complaints(self, client, citizen_headers):
        # Create at least one
        await client.post("/api/complaints/", json=COMPLAINT_PAYLOAD, headers=citizen_headers)
        resp = await client.get("/api/complaints/user", headers=citizen_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json()["data"]["complaints"], list)

    async def test_get_complaint_by_id(self, client, citizen_headers):
        # Create and retrieve
        create_resp = await client.post("/api/complaints/", json=COMPLAINT_PAYLOAD, headers=citizen_headers)
        cid = create_resp.json()["data"]["id"]
        resp = await client.get(f"/api/complaints/{cid}", headers=citizen_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["id"] == cid

    async def test_get_complaint_invalid_id(self, client, citizen_headers):
        resp = await client.get("/api/complaints/000000000000000000000000", headers=citizen_headers)
        assert resp.status_code == 404


@pytest.mark.asyncio
class TestComplaintVote:
    async def test_vote_success(self, client, citizen_headers):
        create_resp = await client.post("/api/complaints/", json=COMPLAINT_PAYLOAD, headers=citizen_headers)
        cid  = create_resp.json()["data"]["id"]

        # Register a different user to vote (same user can't vote own complaint
        # in a real app but model-level we test the vote logic)
        vote_resp = await client.post(
            f"/api/complaints/{cid}/vote", headers=citizen_headers
        )
        assert vote_resp.status_code == 200

    async def test_vote_duplicate(self, client, citizen_headers):
        create_resp = await client.post("/api/complaints/", json=COMPLAINT_PAYLOAD, headers=citizen_headers)
        cid  = create_resp.json()["data"]["id"]

        await client.post(f"/api/complaints/{cid}/vote", headers=citizen_headers)
        # Second vote from same user should conflict
        vote_resp = await client.post(
            f"/api/complaints/{cid}/vote", headers=citizen_headers
        )
        assert vote_resp.status_code == 409
