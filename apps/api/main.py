"""
main.py — FastAPI Risk Engine entrypoint for NEXUS TLS.

Features:
  - Auth endpoints (register, login, TOTP, logout)
  - Session management (heartbeat, extend, biometrics, tab control)
  - Risk scoring engine
  - Geo-fencing & IP lookup
  - Event ingestion & timeline
  - Real-time WebSocket engine (demo + production)
  - OpenTelemetry instrumentation (optional)
  - Rate limiting on sensitive endpoints
"""

import os
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# OpenTelemetry (optional)
try:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

    otel_endpoint = os.getenv("OTEL_ENDPOINT")
    if otel_endpoint:
        tracer_provider = TracerProvider()
        tracer_provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=otel_endpoint))
        )
        trace.set_tracer_provider(tracer_provider)
        OTEL_AVAILABLE = True
    else:
        OTEL_AVAILABLE = False
except ImportError:
    OTEL_AVAILABLE = False

from routers import auth, session, risk, geo, events, admin
import ws_simulator
import ws_engine
import database


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables on startup."""
    await database.init_db()
    yield


app = FastAPI(
    title="NEXUS TLS Risk Engine",
    description=(
        "Secure session management API with risk-adaptive timeouts, "
        "geo-fencing, behavioral biometrics, and 2FA."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# Use allow_origin_regex to also accept Ngrok tunnel domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3002",
        "http://localhost:8000",
    ],
    allow_origin_regex=r"https?://.*\.ngrok(-free)?\.dev|https?://.*\.ngrok\.io",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router)         # /api/auth/*
app.include_router(session.router)      # /api/session/*
app.include_router(risk.router)         # /api/risk/*
app.include_router(geo.router)          # /api/geo/*
app.include_router(events.router)       # /api/events/*
app.include_router(admin.router)        # /api/admin/*
app.include_router(ws_simulator.router) # /ws/session/sim/*
app.include_router(ws_engine.router)    # /ws/session/real/*

# ── OpenTelemetry ──────────────────────────────────────────────────────────────
if OTEL_AVAILABLE:
    FastAPIInstrumentor.instrument_app(app)


# ─── Health & Info ─────────────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    """Server health check endpoint."""
    db_info = database.get_db_info()
    return {
        "status": "healthy",
        "service": "nexus-tls-risk-engine",
        "version": "2.0.0",
        "database": db_info["backend"],
        "otel": OTEL_AVAILABLE,
    }


@app.get("/api/info")
async def api_info():
    """Return API info and available endpoints."""
    return {
        "name": "NEXUS TLS Risk Engine",
        "version": "2.0.0",
        "endpoints": {
            "auth": [
                "POST /api/auth/register",
                "POST /api/auth/login",
                "POST /api/auth/totp/setup",
                "POST /api/auth/totp/verify",
                "GET  /api/auth/me",
                "POST /api/auth/password",
                "POST /api/auth/logout",
            ],
            "session": [
                "POST /api/session/heartbeat",
                "POST /api/session/extend",
                "DELETE /api/session/tab/{tab_id}",
                "POST /api/session/biometrics",
                "GET  /api/session/{session_id}/info",
                "GET  /api/session/{session_id}/logs",
            ],
            "risk": [
                "POST /api/risk/score",
            ],
            "geo": [
                "POST /api/geo/lookup",
                "POST /api/geo/fence-check",
            ],
            "events": [
                "POST /api/events/ingest",
                "GET  /api/events/timeline/{session_id}",
                "GET  /api/events/stats",
            ],
            "admin": [
                "GET  /api/admin/sessions",
                "GET  /api/admin/users",
                "POST /api/admin/sessions/{session_id}/kill",
                "GET  /api/admin/dashboard-stats",
            ],
            "websocket": [
                "WS /ws/session/real/{session_id}",
                "WS /ws/session/sim/{session_id}",
            ],
        },
    }
