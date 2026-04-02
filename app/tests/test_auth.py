"""
Tests – Authentication endpoints.
"""
import pytest


@pytest.mark.asyncio
class TestAuthRegister:
    async def test_register_success(self, client):
        resp = await client.post("/api/auth/register", json={
            "name":     "Alice Gov",
            "email":    "alice@voice2gov.com",
            "password": "Alice@9876",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["success"] is True
        assert "access_token" in data["data"]
        assert data["data"]["user"]["role"] == "citizen"

    async def test_register_duplicate_email(self, client):
        payload = {"name": "Dup", "email": "dup@voice2gov.com", "password": "Dup@12345"}
        await client.post("/api/auth/register", json=payload)
        resp = await client.post("/api/auth/register", json=payload)
        assert resp.status_code == 409
        assert resp.json()["success"] is False

    async def test_register_missing_name(self, client):
        resp = await client.post("/api/auth/register", json={
            "email": "noname@voice2gov.com", "password": "Pass@1234"
        })
        assert resp.status_code == 422   # Unprocessable entity

    async def test_register_short_password(self, client):
        resp = await client.post("/api/auth/register", json={
            "name": "Bob", "email": "bob@e.com", "password": "short"
        })
        assert resp.status_code == 422


@pytest.mark.asyncio
class TestAuthLogin:
    USER = {"name": "Login Test", "email": "logintest@v2g.com", "password": "Login@1234"}

    async def test_login_success(self, client):
        await client.post("/api/auth/register", json=self.USER)
        resp = await client.post("/api/auth/login", json={
            "email": self.USER["email"], "password": self.USER["password"]
        })
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "access_token" in data

    async def test_login_wrong_password(self, client):
        resp = await client.post("/api/auth/login", json={
            "email": self.USER["email"], "password": "WrongPass@99"
        })
        assert resp.status_code == 401

    async def test_login_unknown_email(self, client):
        resp = await client.post("/api/auth/login", json={
            "email": "nobody@voice2gov.com", "password": "Pass@1234"
        })
        assert resp.status_code == 401


@pytest.mark.asyncio
class TestAuthMe:
    async def test_get_profile(self, client, citizen_headers):
        resp = await client.get("/api/auth/me", headers=citizen_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["email"] == "testcitizen@example.com"

    async def test_get_profile_no_token(self, client):
        resp = await client.get("/api/auth/me")
        assert resp.status_code == 403
