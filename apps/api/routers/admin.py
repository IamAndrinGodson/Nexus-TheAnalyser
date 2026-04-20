"""
routers/admin.py — Admin-only endpoints for NEXUS TLS.

These endpoints require the `admin` role and provide server-level monitoring
and control capabilities.

Endpoints:
  GET  /api/admin/sessions              — List all active sessions
  GET  /api/admin/users                 — List all registered users
  POST /api/admin/sessions/{id}/kill    — Force-kill a client session
  GET  /api/admin/dashboard-stats       — Aggregated stats for admin dashboard
"""

import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from db_models import UserModel, SessionModel, AuditLogModel, TransactionModel
from middleware.auth import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ─── LIST ALL SESSIONS ─────────────────────────────────────────────────────────
@router.get("/sessions")
async def list_sessions(
    status_filter: Optional[str] = None,
    token_payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all sessions (admin only). Optionally filter by status."""
    query = select(SessionModel).order_by(SessionModel.created_at.desc())
    if status_filter:
        query = query.where(SessionModel.status == status_filter.upper())

    result = await db.execute(query.limit(100))
    sessions = result.scalars().all()

    return {
        "count": len(sessions),
        "sessions": [
            {
                "id": s.id,
                "user_id": s.user_id,
                "status": s.status,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
                "ip_address": s.ip_address,
                "user_agent": s.user_agent,
                "risk_level": s.risk_level,
                "trust_score": s.trust_score,
                "adapted_timeout": s.adapted_timeout,
                "remaining_timeout": s.remaining_timeout,
                "geo_anomaly": s.geo_anomaly,
                "geo_city": s.geo_city,
                "geo_country": s.geo_country,
            }
            for s in sessions
        ],
    }


# ─── LIST ALL USERS ────────────────────────────────────────────────────────────
@router.get("/users")
async def list_users(
    token_payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all registered users (admin only)."""
    result = await db.execute(
        select(UserModel).order_by(UserModel.created_at.desc())
    )
    users = result.scalars().all()

    return {
        "count": len(users),
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "role": u.role,
                "org_id": u.org_id,
                "is_active": u.is_active,
                "totp_enabled": u.totp_enabled,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login": u.last_login.isoformat() if u.last_login else None,
            }
            for u in users
        ],
    }


# ─── FORCE KILL SESSION ────────────────────────────────────────────────────────
@router.post("/sessions/{session_id}/kill")
async def kill_session(
    session_id: str,
    token_payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Force-kill a client session (admin only)."""
    result = await db.execute(
        select(SessionModel).where(SessionModel.id == session_id)
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    session.status = "KILLED"
    session.ended_at = datetime.datetime.now(datetime.timezone.utc)

    # Log the admin action
    log = AuditLogModel(
        session_id=session_id,
        message=f"Session force-killed by admin ({token_payload.get('email', 'unknown')})",
        event_type="danger",
        severity="high",
    )
    db.add(log)
    await db.commit()

    return {"killed": True, "session_id": session_id}


# ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
@router.get("/dashboard-stats")
async def dashboard_stats(
    token_payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated stats for admin dashboard (admin only)."""

    # Active sessions count
    active_result = await db.execute(
        select(func.count(SessionModel.id)).where(SessionModel.status == "ACTIVE")
    )
    active_sessions = active_result.scalar() or 0

    # Total users count
    user_result = await db.execute(select(func.count(UserModel.id)))
    total_users = user_result.scalar() or 0

    # Average trust score of active sessions
    avg_trust_result = await db.execute(
        select(func.avg(SessionModel.trust_score)).where(SessionModel.status == "ACTIVE")
    )
    avg_trust = round(avg_trust_result.scalar() or 0, 1)

    # Total audit events
    events_result = await db.execute(select(func.count(AuditLogModel.id)))
    total_events = events_result.scalar() or 0

    # High-risk sessions
    high_risk_result = await db.execute(
        select(func.count(SessionModel.id)).where(
            SessionModel.status == "ACTIVE",
            SessionModel.risk_level == "HIGH",
        )
    )
    high_risk_sessions = high_risk_result.scalar() or 0

    # Total transactions
    txn_result = await db.execute(select(func.count(TransactionModel.id)))
    total_transactions = txn_result.scalar() or 0

    return {
        "active_sessions": active_sessions,
        "total_users": total_users,
        "avg_trust_score": avg_trust,
        "total_events": total_events,
        "high_risk_sessions": high_risk_sessions,
        "total_transactions": total_transactions,
    }
