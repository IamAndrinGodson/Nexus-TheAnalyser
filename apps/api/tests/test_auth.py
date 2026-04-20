"""
tests/test_auth.py — Integration tests for auth endpoints.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Force SQLite for tests
os.environ["DATABASE_URL"] = ""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from main import app
from database import engine, Base


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Create fresh tables for each test."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
class TestRegistration:

    async def test_register_success(self, client: AsyncClient):
        resp = await client.post("/api/auth/register", json={
            "email": "test@nexus.io",
            "password": "SecurePass123!",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "test@nexus.io"
        assert data["role"] == "operator"
        assert "id" in data

    async def test_register_duplicate_email(self, client: AsyncClient):
        await client.post("/api/auth/register", json={
            "email": "dup@nexus.io",
            "password": "SecurePass123!",
        })
        resp = await client.post("/api/auth/register", json={
            "email": "dup@nexus.io",
            "password": "AnotherPass456!",
        })
        assert resp.status_code == 409

    async def test_register_short_password(self, client: AsyncClient):
        resp = await client.post("/api/auth/register", json={
            "email": "short@nexus.io",
            "password": "short",
        })
        assert resp.status_code == 422  # Validation error

    async def test_register_invalid_email(self, client: AsyncClient):
        resp = await client.post("/api/auth/register", json={
            "email": "not-an-email",
            "password": "SecurePass123!",
        })
        assert resp.status_code == 422

    async def test_register_custom_role(self, client: AsyncClient):
        resp = await client.post("/api/auth/register", json={
            "email": "admin@nexus.io",
            "password": "SecurePass123!",
            "role": "admin",
        })
        assert resp.status_code == 201
        assert resp.json()["role"] == "admin"


@pytest.mark.asyncio
class TestLogin:

    async def test_login_success(self, client: AsyncClient):
        # Register first
        await client.post("/api/auth/register", json={
            "email": "login@nexus.io",
            "password": "SecurePass123!",
        })
        # Login
        resp = await client.post("/api/auth/login", json={
            "email": "login@nexus.io",
            "password": "SecurePass123!",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "session_id" in data
        assert data["role"] == "operator"
        assert data["expires_in"] > 0

    async def test_login_wrong_password(self, client: AsyncClient):
        await client.post("/api/auth/register", json={
            "email": "wrong@nexus.io",
            "password": "SecurePass123!",
        })
        resp = await client.post("/api/auth/login", json={
            "email": "wrong@nexus.io",
            "password": "WrongPassword!",
        })
        assert resp.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        resp = await client.post("/api/auth/login", json={
            "email": "nobody@nexus.io",
            "password": "AnyPass123!",
        })
        assert resp.status_code == 401

    async def test_jwt_token_works(self, client: AsyncClient):
        # Register + login
        await client.post("/api/auth/register", json={
            "email": "jwt@nexus.io",
            "password": "SecurePass123!",
        })
        login_resp = await client.post("/api/auth/login", json={
            "email": "jwt@nexus.io",
            "password": "SecurePass123!",
        })
        token = login_resp.json()["access_token"]

        # Use token to access /me
        me_resp = await client.get("/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == "jwt@nexus.io"


@pytest.mark.asyncio
class TestUserInfo:

    async def test_get_me_unauthorized(self, client: AsyncClient):
        resp = await client.get("/api/auth/me")
        assert resp.status_code == 401

    async def test_get_me_with_token(self, client: AsyncClient):
        await client.post("/api/auth/register", json={
            "email": "me@nexus.io",
            "password": "SecurePass123!",
        })
        login = await client.post("/api/auth/login", json={
            "email": "me@nexus.io",
            "password": "SecurePass123!",
        })
        token = login.json()["access_token"]

        resp = await client.get("/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "me@nexus.io"
        assert data["totp_enabled"] is False


@pytest.mark.asyncio
class TestPasswordChange:

    async def test_change_password(self, client: AsyncClient):
        await client.post("/api/auth/register", json={
            "email": "pwd@nexus.io",
            "password": "OldPass123!",
        })
        login = await client.post("/api/auth/login", json={
            "email": "pwd@nexus.io",
            "password": "OldPass123!",
        })
        token = login.json()["access_token"]

        # Change password
        resp = await client.post("/api/auth/password", json={
            "current_password": "OldPass123!",
            "new_password": "NewPass456!",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200

        # Login with new password
        login2 = await client.post("/api/auth/login", json={
            "email": "pwd@nexus.io",
            "password": "NewPass456!",
        })
        assert login2.status_code == 200

    async def test_change_password_wrong_current(self, client: AsyncClient):
        await client.post("/api/auth/register", json={
            "email": "pwd2@nexus.io",
            "password": "OldPass123!",
        })
        login = await client.post("/api/auth/login", json={
            "email": "pwd2@nexus.io",
            "password": "OldPass123!",
        })
        token = login.json()["access_token"]

        resp = await client.post("/api/auth/password", json={
            "current_password": "WrongOldPass!",
            "new_password": "NewPass456!",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401


@pytest.mark.asyncio
class TestLogout:

    async def test_logout(self, client: AsyncClient):
        await client.post("/api/auth/register", json={
            "email": "logout@nexus.io",
            "password": "SecurePass123!",
        })
        login = await client.post("/api/auth/login", json={
            "email": "logout@nexus.io",
            "password": "SecurePass123!",
        })
        token = login.json()["access_token"]

        resp = await client.post("/api/auth/logout", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200
        assert "session_id" in resp.json()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
