"""
routers/session.py — Session management endpoints for NEXUS TLS.

Endpoints:
  POST /api/session/heartbeat   — Periodic heartbeat from frontend
  POST /api/session/extend      — User explicitly extends session
  DELETE /api/session/tab/{id}  — Kill a specific tab
  POST /api/session/biometrics  — Receive biometric score from Web Worker
  GET  /api/session/{id}/info   — Get session details
  GET  /api/session/{id}/logs   — Get audit logs for a session
"""

import json
import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from services.risk_engine import calculate_adapted_timeout, RiskContext
from database import get_db
from db_models import SessionModel, AuditLogModel
from middleware.auth import verify_jwt

router = APIRouter(prefix="/api/session", tags=["session"])


# ── Helpers ────────────────────────────────────────────────────────────────────
async def log_session_event(
    db: AsyncSession,
    session_id: str,
    message: str,
    event_type: str = "info",
    severity: str = "info",
    metadata: Optional[dict] = None,
):
    """Persist an audit log entry for a session event."""
    log = AuditLogModel(
        session_id=session_id,
        message=message,
        event_type=event_type,
        severity=severity,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(log)
    await db.commit()


async def get_session_or_404(db: AsyncSession, session_id: str) -> SessionModel:
    """Retrieve a session by ID or raise 404."""
    result = await db.execute(
        select(SessionModel).where(SessionModel.id == session_id)
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session


def build_risk_context(session: SessionModel, request: Request) -> RiskContext:
    """Build a RiskContext from session state and request info."""
    return RiskContext(
        user_id=session.user_id or "unknown",
        session_id=session.id,
        biometric_score=session.trust_score or 85,
        device_trust_score=session.device_trust or 50,
        is_geo_anomaly=session.geo_anomaly or False,
        is_trusted_device=True,
        is_off_hours=_is_off_hours(),
        max_active_txn_amount=0,
        failed_totp_last_hour=0,
        is_in_geo_fence=not (session.geo_anomaly or False),
    )


def _is_off_hours() -> bool:
    """Check if current UTC hour is outside 03:30-13:30 (IST 09:00-19:00)."""
    hour = datetime.datetime.now(datetime.timezone.utc).hour
    return hour < 3 or hour >= 14  # rough IST offset


# ─── HEARTBEAT ─────────────────────────────────────────────────────────────────
@router.post("/heartbeat")
async def session_heartbeat(
    request: Request,
    session_payload: dict = Depends(verify_jwt),
    db: AsyncSession = Depends(get_db),
):
    """
    Called every 15s by the frontend to:
    1. Confirm session is still valid
    2. Receive updated adapted_timeout
    3. Receive step_up_required flag
    """
    session_id = session_payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="No session_id in token.")

    session = await get_session_or_404(db, session_id)

    if session.status != "ACTIVE":
        raise HTTPException(status_code=401, detail="Session is no longer active.")

    # Calculate adapted timeout
    ctx = build_risk_context(session, request)
    result = calculate_adapted_timeout(ctx)

    # Update session state
    session.adapted_timeout = result.adapted_timeout
    session.risk_level = result.risk_level
    await db.commit()

    return {
        "valid": True,
        "adapted_timeout": result.adapted_timeout,
        "risk_level": result.risk_level,
        "step_up_required": result.requires_step_up,
        "active_factors": result.active_factors,
    }


# ─── EXTEND SESSION ───────────────────────────────────────────────────────────
@router.post("/extend")
async def extend_session(
    session_payload: dict = Depends(verify_jwt),
    db: AsyncSession = Depends(get_db),
):
    """User explicitly extends session — resets activity timer."""
    session_id = session_payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="No session_id in token.")

    session = await get_session_or_404(db, session_id)

    if session.status != "ACTIVE":
        raise HTTPException(status_code=401, detail="Session is no longer active.")

    session.remaining_timeout = session.adapted_timeout
    await db.commit()

    await log_session_event(
        db, session_id, "User extended session", "success", "info"
    )

    return {"extended": True, "message": "Session extended successfully"}


# ─── KILL TAB ──────────────────────────────────────────────────────────────────
@router.delete("/tab/{tab_id}")
async def kill_tab(
    tab_id: str,
    session_payload: dict = Depends(verify_jwt),
    db: AsyncSession = Depends(get_db),
):
    """Kill a specific tab from the session graph."""
    session_id = session_payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="No session_id in token.")

    await log_session_event(
        db, session_id,
        f"Tab killed: {tab_id}",
        event_type="warn",
        severity="warn",
        metadata={"tab_id": tab_id},
    )

    return {"killed": True, "tab_id": tab_id}


# ─── BIOMETRIC SCORE ──────────────────────────────────────────────────────────
class BiometricPayload(BaseModel):
    composite_score: int


@router.post("/biometrics")
async def update_biometric_score(
    payload: BiometricPayload,
    session_payload: dict = Depends(verify_jwt),
    db: AsyncSession = Depends(get_db),
):
    """Receive biometric trust score from Web Worker every 10s."""
    session_id = session_payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="No session_id in token.")

    session = await get_session_or_404(db, session_id)

    score = payload.composite_score
    session.trust_score = score
    await db.commit()

    if score < 40:
        await log_session_event(
            db, session_id,
            f"CRITICAL biometric drop: score={score}",
            event_type="danger",
            severity="high",
            metadata={"score": score},
        )
        return {"score": score, "action": "STEP_UP_AUTH_REQUIRED"}

    if score < 65:
        await log_session_event(
            db, session_id,
            f"Low biometric score: {score}",
            event_type="warning",
            severity="medium",
            metadata={"score": score},
        )
        return {"score": score, "action": "WARNING"}

    return {"score": score, "action": "OK"}


# ─── SESSION INFO ──────────────────────────────────────────────────────────────
@router.get("/{session_id}/info")
async def get_session_info(
    session_id: str,
    token_payload: dict = Depends(verify_jwt),
    db: AsyncSession = Depends(get_db),
):
    """Get details about a specific session."""
    session = await get_session_or_404(db, session_id)

    return {
        "id": session.id,
        "user_id": session.user_id,
        "status": session.status,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "risk_level": session.risk_level,
        "trust_score": session.trust_score,
        "adapted_timeout": session.adapted_timeout,
        "base_timeout": session.base_timeout,
        "geo_anomaly": session.geo_anomaly,
        "ip_address": session.ip_address,
    }


# ─── SESSION LOGS ─────────────────────────────────────────────────────────────
@router.get("/{session_id}/logs")
async def get_session_logs(
    session_id: str,
    limit: int = 50,
    token_payload: dict = Depends(verify_jwt),
    db: AsyncSession = Depends(get_db),
):
    """Get audit logs for a specific session."""
    result = await db.execute(
        select(AuditLogModel)
        .where(AuditLogModel.session_id == session_id)
        .order_by(desc(AuditLogModel.timestamp))
        .limit(limit)
    )
    logs = result.scalars().all()

    return {
        "session_id": session_id,
        "count": len(logs),
        "logs": [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "message": log.message,
                "event_type": log.event_type,
                "severity": log.severity,
                "metadata": json.loads(log.metadata_json) if log.metadata_json else None,
            }
            for log in logs
        ],
    }

# ─── TAB EVENT BEACON ─────────────────────────────────────────────────────────
@router.post("/tab-event", status_code=204)
async def tab_event_beacon(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receives navigator.sendBeacon() calls on tab close.
    Beacon is fired even as the page unloads — more reliable than WebSocket.
    Body: {type, tabId, route, title}
    Always returns 204 (sendBeacon ignores the response body).
    """
    try:
        body = await request.json()
    except Exception:
        return  # malformed beacon — ignore

    tab_id = body.get("tabId", "unknown")
    route = body.get("route", "/")
    event_type = body.get("type", "TAB_CLOSE")

    # Derive session_id from JWT if present, else log to a generic session
    try:
        token_payload = await verify_jwt(request)
        session_id = token_payload.get("session_id", "beacon-unknown")
    except Exception:
        session_id = "beacon-unknown"

    await log_session_event(
        db, session_id,
        f"[Beacon] {event_type}: {route} [tab {tab_id[:8]}]",
        event_type="warning",
        severity="medium",
        metadata={"tabId": tab_id, "route": route, "source": "beacon"},
    )
