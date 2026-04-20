"""
routers/events.py — Session event ingestion and timeline retrieval.

Endpoints:
  POST /api/events/ingest           — Ingest a session event for audit trail
  GET  /api/events/timeline/{id}    — Get session event timeline for replay
  GET  /api/events/stats            — Get aggregate event statistics
"""

import json
import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from database import get_db
from db_models import AuditLogModel, SessionModel
from middleware.auth import verify_jwt

router = APIRouter(prefix="/api/events", tags=["events"])


# ── Models ─────────────────────────────────────────────────────────────────────
class SessionEvent(BaseModel):
    session_id: str
    event_type: str
    severity: str = "info"
    metadata: dict = {}
    message: Optional[str] = None


# ─── INGEST EVENT ──────────────────────────────────────────────────────────────
@router.post("/ingest")
async def ingest_event(
    event: SessionEvent,
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest a session event for audit trail.
    Persists to the audit_logs table.
    """
    # Verify session exists
    result = await db.execute(
        select(SessionModel).where(SessionModel.id == event.session_id)
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    log = AuditLogModel(
        session_id=event.session_id,
        message=event.message or f"Event: {event.event_type}",
        event_type=event.event_type,
        severity=event.severity,
        metadata_json=json.dumps(event.metadata) if event.metadata else None,
    )
    db.add(log)
    await db.commit()

    return {
        "ingested": True,
        "event_type": event.event_type,
        "session_id": event.session_id,
        "log_id": log.id,
    }


# ─── TIMELINE ─────────────────────────────────────────────────────────────────
@router.get("/timeline/{session_id}")
async def get_timeline(
    session_id: str,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    event_type: Optional[str] = Query(default=None, description="Filter by event type"),
    severity: Optional[str] = Query(default=None, description="Filter by severity"),
    db: AsyncSession = Depends(get_db),
):
    """Get session event timeline for replay with filtering and pagination."""
    query = (
        select(AuditLogModel)
        .where(AuditLogModel.session_id == session_id)
    )

    if event_type:
        query = query.where(AuditLogModel.event_type == event_type)
    if severity:
        query = query.where(AuditLogModel.severity == severity)

    query = query.order_by(AuditLogModel.timestamp.asc()).offset(offset).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    # Get total count
    count_query = (
        select(func.count(AuditLogModel.id))
        .where(AuditLogModel.session_id == session_id)
    )
    if event_type:
        count_query = count_query.where(AuditLogModel.event_type == event_type)
    if severity:
        count_query = count_query.where(AuditLogModel.severity == severity)

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    return {
        "session_id": session_id,
        "total": total,
        "offset": offset,
        "limit": limit,
        "events": [
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


# ─── EVENT STATS ───────────────────────────────────────────────────────────────
@router.get("/stats")
async def get_event_stats(
    session_id: Optional[str] = Query(default=None),
    token_payload: dict = Depends(verify_jwt),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregate event statistics, optionally filtered by session."""
    base_query = select(
        AuditLogModel.event_type,
        func.count(AuditLogModel.id).label("count"),
    )

    if session_id:
        base_query = base_query.where(AuditLogModel.session_id == session_id)

    base_query = base_query.group_by(AuditLogModel.event_type)
    result = await db.execute(base_query)
    rows = result.all()

    # Severity breakdown
    sev_query = select(
        AuditLogModel.severity,
        func.count(AuditLogModel.id).label("count"),
    )
    if session_id:
        sev_query = sev_query.where(AuditLogModel.session_id == session_id)
    sev_query = sev_query.group_by(AuditLogModel.severity)
    sev_result = await db.execute(sev_query)
    sev_rows = sev_result.all()

    return {
        "session_id": session_id,
        "by_event_type": {row.event_type: row.count for row in rows},
        "by_severity": {row.severity: row.count for row in sev_rows},
    }
