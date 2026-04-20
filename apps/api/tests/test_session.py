"""
tests/test_session.py — Integration tests for session management endpoints.
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


@pytest_asyncio.fixture
async def auth_token(client: AsyncClient) -> str:
    """Register a user, login, and return the access token."""
    await client.post("/api/auth/register", json={
        "email": "session@nexus.io",
        "password": "SecurePass123!",
    })
    login = await client.post("/api/auth/login", json={
        "email": "session@nexus.io",
        "password": "SecurePass123!",
    })
    return login.json()["access_token"]


@pytest_asyncio.fixture
async def auth_header(auth_token: str) -> dict:
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.mark.asyncio
class TestHeartbeat:

    async def test_heartbeat_success(self, client: AsyncClient, auth_header: dict):
        resp = await client.post("/api/session/heartbeat", headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert data["valid"] is True
        assert "adapted_timeout" in data
        assert "risk_level" in data
        assert "step_up_required" in data
        assert "active_factors" in data

    async def test_heartbeat_unauthorized(self, client: AsyncClient):
        resp = await client.post("/api/session/heartbeat")
        assert resp.status_code == 401


@pytest.mark.asyncio
class TestExtendSession:

    async def test_extend_success(self, client: AsyncClient, auth_header: dict):
        resp = await client.post("/api/session/extend", headers=auth_header)
        assert resp.status_code == 200
        assert resp.json()["extended"] is True


@pytest.mark.asyncio
class TestBiometrics:

    async def test_biometrics_ok(self, client: AsyncClient, auth_header: dict):
        resp = await client.post("/api/session/biometrics", json={
            "composite_score": 85,
        }, headers=auth_header)
        assert resp.status_code == 200
        assert resp.json()["action"] == "OK"

    async def test_biometrics_warning(self, client: AsyncClient, auth_header: dict):
        resp = await client.post("/api/session/biometrics", json={
            "composite_score": 55,
        }, headers=auth_header)
        assert resp.status_code == 200
        assert resp.json()["action"] == "WARNING"

    async def test_biometrics_step_up(self, client: AsyncClient, auth_header: dict):
        resp = await client.post("/api/session/biometrics", json={
            "composite_score": 30,
        }, headers=auth_header)
        assert resp.status_code == 200
        assert resp.json()["action"] == "STEP_UP_AUTH_REQUIRED"


@pytest.mark.asyncio
class TestSessionInfo:

    async def test_get_session_info(self, client: AsyncClient, auth_token: str, auth_header: dict):
        # Get session_id from token by decoding
        from jose import jwt
        payload = jwt.decode(auth_token, os.getenv("JWT_SECRET", "super-secret-key-change-in-prod"), algorithms=["HS256"])
        session_id = payload["session_id"]

        resp = await client.get(f"/api/session/{session_id}/info", headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == session_id
        assert data["status"] == "ACTIVE"

    async def test_get_session_logs(self, client: AsyncClient, auth_token: str, auth_header: dict):
        from jose import jwt
        payload = jwt.decode(auth_token, os.getenv("JWT_SECRET", "super-secret-key-change-in-prod"), algorithms=["HS256"])
        session_id = payload["session_id"]

        resp = await client.get(f"/api/session/{session_id}/logs", headers=auth_header)
        assert resp.status_code == 200
        data = resp.json()
        assert data["session_id"] == session_id
        assert isinstance(data["logs"], list)
        # Should have at least one log from the login event
        assert data["count"] >= 1


@pytest.mark.asyncio
class TestKillTab:

    async def test_kill_tab(self, client: AsyncClient, auth_header: dict):
        resp = await client.delete("/api/session/tab/tab-01", headers=auth_header)
        assert resp.status_code == 200
        assert resp.json()["killed"] is True
        assert resp.json()["tab_id"] == "tab-01"


@pytest.mark.asyncio
class TestEvents:

    async def test_ingest_event(self, client: AsyncClient, auth_token: str, auth_header: dict):
        from jose import jwt
        payload = jwt.decode(auth_token, os.getenv("JWT_SECRET", "super-secret-key-change-in-prod"), algorithms=["HS256"])
        session_id = payload["session_id"]

        resp = await client.post("/api/events/ingest", json={
            "session_id": session_id,
            "event_type": "JWT_ROTATED",
            "severity": "info",
            "message": "JWT token rotated",
        })
        assert resp.status_code == 200
        assert resp.json()["ingested"] is True

    async def test_get_timeline(self, client: AsyncClient, auth_token: str, auth_header: dict):
        from jose import jwt
        payload = jwt.decode(auth_token, os.getenv("JWT_SECRET", "super-secret-key-change-in-prod"), algorithms=["HS256"])
        session_id = payload["session_id"]

        resp = await client.get(f"/api/events/timeline/{session_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["session_id"] == session_id
        assert isinstance(data["events"], list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
