# NEXUS TLS — Secure Session Management System
### Full-Stack Architecture & Implementation Guide
> **Domain:** Secure Digital Transactions & Logistics | **Version:** 2.0 | **Status:** Production-Ready Blueprint

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [The 5 Innovations](#3-the-5-innovations)
4. [System Architecture Overview](#4-system-architecture-overview)
5. [Full Tech Stack](#5-full-tech-stack)
6. [Database Schema](#6-database-schema)
7. [Backend — FastAPI Risk Service](#7-backend--fastapi-risk-service)
8. [Frontend — Next.js Session Engine](#8-frontend--nextjs-session-engine)
9. [Session Engine Package](#9-session-engine-package)
10. [Behavioral Biometrics Worker](#10-behavioral-biometrics-worker)
11. [Cross-Tab Sync](#11-cross-tab-sync)
12. [Authentication & JWT Strategy](#12-authentication--jwt-strategy)
13. [Redis Session Store](#13-redis-session-store)
14. [Geo-Fence Service](#14-geo-fence-service)
15. [Deployment — Step by Step](#15-deployment--step-by-step)
16. [CI/CD Pipeline](#16-cicd-pipeline)
17. [Observability & Alerting](#17-observability--alerting)
18. [Security Hardening Checklist](#18-security-hardening-checklist)
19. [Competitor Comparison](#19-competitor-comparison)
20. [Cost & Timeline Estimates](#20-cost--timeline-estimates)

---

## 1. Executive Summary

**NEXUS TLS** is a domain-specific secure session management system built for high-stakes digital transaction and logistics platforms. Unlike generic IAM solutions (Okta, Azure AD, AWS Cognito), NEXUS TLS combines:

- **Behavioral biometrics** scored in real-time using in-browser ML
- **Risk-adaptive timeouts** that shorten or lengthen based on live transaction context
- **Cross-tab session synchronization** with per-tab kill-switch capability
- **Session replay timelines** stored as append-only audit events
- **Geo-fence anomaly detection** using MaxMind GeoIP2

The system is designed to prevent unauthorized access to financial and logistics data while maintaining a smooth, non-disruptive user experience through predictive warning systems and graceful session extension flows.

---

## 2. Problem Statement

### Core Challenge

In logistics and digital transaction platforms, sessions face a unique combination of threats:

| Threat Vector | Industry Impact |
|---|---|
| Unattended terminals in warehouses | Physical unauthorized access to active sessions |
| High-value transactions left mid-flow | Financial fraud via session hijacking |
| Multi-tab operational workflows | Session token inconsistency across tabs |
| Shift handovers without logout | Compliance violations (DPDPA, ISO 27001) |
| Geo-anomalous logins | Account takeover from credential stuffing |

### Why Existing Solutions Fall Short

Generic session timeout systems use a single fixed timer (e.g., 15 minutes) applied uniformly. This creates two failure modes:

1. **Too short** → Disrupts active users processing large shipment batches → Productivity loss
2. **Too long** → Leaves sensitive screens open in warehouse environments → Security gap

NEXUS TLS solves this with a **context-aware, signal-driven session engine** that adapts the timeout in real-time.

---

## 3. The 5 Innovations

### 3.1 Behavioral Biometrics Engine

**What it does:** Continuously scores user identity confidence (0–100) based on five behavioral signals collected passively in-browser:

| Signal | Method | Weight |
|---|---|---|
| Keystroke cadence | Inter-key timing variance via `keydown` events | 25% |
| Mouse velocity | Speed + acceleration vector sampling at 60fps | 25% |
| Scroll pattern | Momentum, frequency, and direction changes | 20% |
| Click rhythm | Inter-click timing and spatial distribution | 15% |
| Dwell time | Time-on-element before interaction | 15% |

**How it works:**
- A **Web Worker** runs continuously, receiving event streams from the main thread
- Every 10 seconds it computes a composite **Behaviour Trust Score**
- If score drops below **60**, the system triggers step-up authentication (re-prompt TOTP)
- If score drops below **40**, the session is immediately invalidated as a security event

**Why it's innovative:** This is continuous, passive, zero-friction authentication. The user never sees a prompt unless their pattern deviates significantly.

---

### 3.2 Risk-Adaptive Timeout

**What it does:** Instead of a fixed timeout, the session window is recalculated every 30 seconds based on a weighted risk model.

**Risk factors and their timeout adjustments:**

| Factor | Direction | Delta | Rationale |
|---|---|---|---|
| Active transaction > ₹4,00,000 | Shorten | −30s | High-value sessions are higher risk if abandoned |
| Trusted device fingerprint | Lengthen | +45s | Known device = lower impersonation risk |
| Unusual time-of-day (outside 9am–7pm) | Shorten | −10s | Off-hours access is higher risk |
| Location within geo-fence | Lengthen | +20s | In-office = physically controlled environment |
| Biometric score > 85 | Lengthen | +30s | Confident identity = relax timeout |
| Biometric score < 65 | Shorten | −20s | Uncertain identity = tighten |
| Multiple failed 2FA in last 1h | Shorten | −45s | Attack signal on this account |

**Calculation:**
```
adapted_timeout = base_timeout + Σ(active_factor_deltas)
adapted_timeout = clamp(adapted_timeout, 45s, 240m)
```

**Why it's innovative:** No existing commercial IAM platform dynamically adjusts timeout using live transaction context + biometric confidence simultaneously.

---

### 3.3 Cross-Tab Session Synchronization

**What it does:** All browser tabs running the platform share exactly one session token. The session engine broadcasts activity, warnings, and logout signals across all tabs in real-time.

**Architecture:**
- Primary channel: **BroadcastChannel API** (same-origin, zero-latency)
- Fallback: **WebSocket** connection to session relay server (for cross-device scenarios)
- The "leader tab" (most recently active) owns the countdown; others are followers
- Any tab can be **killed remotely** by an authorized admin or the user themselves

**Tab states:**

| State | Description | Color |
|---|---|---|
| `ACTIVE` | Current focus tab, owns timer | Green |
| `IDLE` | Open but no recent activity | Yellow |
| `BACKGROUND` | Open, session valid, no focus | Grey |
| `KILLED` | Forcibly closed by admin/user | Red |

**Why it's innovative:** Existing solutions treat all tabs as independent session holders. NEXUS TLS treats them as a **single session graph** with visibility and control.

---

### 3.4 Session Replay Timeline

**What it does:** Every session event is stored as an append-only timestamped record. The UI exposes a **scrubable timeline** showing the full session history — logins, 2FA events, JWT rotations, transaction approvals, warnings, and extensions.

**Event types stored:**

```
SESSION_OPENED | 2FA_VERIFIED | JWT_ROTATED | TXN_AUTHORIZED
TXN_FLAGGED | INACTIVITY_WARNING | SESSION_EXTENDED | TAB_KILLED
BIOMETRIC_DROP | GEO_ANOMALY | STEP_UP_AUTH | SESSION_CLOSED
```

**Storage:**
- PostgreSQL with **TimescaleDB extension** for time-series event storage
- Events are **append-only** — never updated or deleted (compliance requirement)
- Retained for **90 days** (configurable per jurisdiction)
- SIEM integration via webhook push on HIGH severity events

**Why it's innovative:** Other platforms provide logs. NEXUS TLS provides a **visual timeline replay** for dispute resolution and security forensics — critical for logistics where delivery disputes are common.

---

### 3.5 Geo-Fence + Device Trust Map

**What it does:** On each session request, the user's IP is resolved to a city-level location using **MaxMind GeoIP2**. This is compared against:

1. Known trusted office zones (configured per organization)
2. The user's historical login locations (rolling 30-day window)
3. Global threat intelligence feeds (Spamhaus, AbuseIPDB)

If the login originates outside all trusted zones AND differs from historical locations by more than 200km, a **geo-anomaly** is flagged, which:
- Shortens the adaptive timeout by 45 seconds
- Triggers an additional TOTP challenge
- Logs a HIGH severity event to the audit trail
- Notifies the security team via webhook

**Device Trust scoring:**

| Signal | Trust Contribution |
|---|---|
| Browser fingerprint matches history | +30 pts |
| OS + User-Agent matches history | +20 pts |
| Same ASN (ISP) as usual | +15 pts |
| No VPN/proxy detected | +10 pts |
| Hardware concurrency matches | +5 pts |
| **Max score** | **80 pts** |

Sessions from devices scoring below 40 require re-verification.

---

## 4. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                           │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Next.js App    │  │ Biometrics Worker │  │ BroadcastCh. │  │
│  │  (React 18)     │◄─┤ (Web Worker)     │  │ (Cross-Tab)  │  │
│  │                 │  │ TF.js / ONNX     │  │              │  │
│  └────────┬────────┘  └──────────────────┘  └──────┬───────┘  │
│           │ HTTPS + HttpOnly Cookie                 │          │
└───────────┼─────────────────────────────────────────┼──────────┘
            │                                         │ WebSocket
            ▼                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VERCEL EDGE NETWORK                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Next.js App Router (SSR)                   │   │
│  │  /api/auth  /api/session  /api/extend  /api/events      │   │
│  └──────┬──────────────┬─────────────────┬─────────────────┘   │
│         │              │                 │                      │
└─────────┼──────────────┼─────────────────┼────────────────────-┘
          │              │                 │
          ▼              ▼                 ▼
   ┌──────────┐   ┌─────────────┐   ┌──────────────┐
   │  Redis   │   │  FastAPI    │   │  Socket.io   │
   │ (Upstash)│   │ Risk Engine │   │  WS Server   │
   │  Session │   │  (Railway)  │   │  (Railway)   │
   │  Store   │   │             │   │              │
   └──────────┘   └──────┬──────┘   └──────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌──────────┐ ┌────────┐ ┌────────────┐
        │PostgreSQL│ │MaxMind │ │ AbuseIPDB  │
        │Supabase  │ │GeoIP2  │ │ Threat Feed│
        │TimescaleDB│ │        │ │            │
        └──────────┘ └────────┘ └────────────┘
                         │
                    ┌────▼─────┐
                    │ Grafana  │
                    │ + Loki   │
                    │ + Tempo  │
                    └──────────┘
```

---

## 5. Full Tech Stack

### Frontend

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Next.js (App Router) | 14.x | SSR, API routes, edge middleware |
| UI Library | React | 18.x | Concurrent rendering for real-time UI |
| Styling | Tailwind CSS + CSS Modules | 3.x | Utility-first + scoped component styles |
| Auth Client | NextAuth.js | 4.x | Session management, CSRF, JWT |
| State | Zustand | 4.x | Lightweight global store for session state |
| Real-time | Socket.io client | 4.x | WebSocket cross-tab fallback |
| Biometrics | TensorFlow.js / ONNX Web | 4.x / 1.x | In-browser ML inference |
| Maps | Mapbox GL JS | 3.x | Geo-fence visualization |
| Monitoring | Sentry (browser) | 7.x | Frontend error tracking |
| 2FA QR | qrcode | 1.5.x | TOTP QR code generation |

### Backend

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| API Framework | FastAPI | 0.111 | Async Python API for risk engine |
| Validation | Pydantic v2 | 2.x | Request/response schema validation |
| Auth | python-jose + passlib | — | JWT signing, bcrypt hashing |
| OTP | pyotp | 2.x | TOTP generation and verification |
| Geo | geoip2 | 4.x | MaxMind GeoIP2 database queries |
| HTTP Client | httpx | 0.27 | Async calls to threat feeds |
| Task Queue | Celery + Redis | 5.x | Async session event processing |
| WSGI | Uvicorn | 0.29 | ASGI server for FastAPI |

### Data Layer

| Store | Technology | Purpose |
|---|---|---|
| Primary DB | PostgreSQL 16 (Supabase) | Users, transactions, audit log |
| Time-series | TimescaleDB extension | Session event replay timeline |
| Cache / Sessions | Redis (Upstash) | Session tokens, TTL management, rate limiting |
| Object Storage | Supabase Storage (S3-compatible) | Session replay exports, reports |

### Infrastructure

| Component | Service | Rationale |
|---|---|---|
| Frontend hosting | Vercel | Zero-config edge deployment, global CDN |
| Backend hosting | Railway | Docker-based, auto-scaling Python services |
| Database | Supabase | Managed Postgres, real-time subscriptions, pgbouncer |
| Redis | Upstash | Serverless Redis, per-request billing, TLS enforced |
| Secrets | Doppler / Vercel Env | Encrypted secret sync across environments |
| CDN | Vercel Edge Network | 50ms p95 globally |

### DevOps & Observability

| Tool | Purpose |
|---|---|
| GitHub Actions | CI/CD pipeline |
| Docker + docker-compose | Local dev + Railway deployment |
| Grafana + Loki | Log aggregation and dashboards |
| Grafana Tempo | Distributed tracing (OpenTelemetry) |
| Prometheus | Metrics collection |
| Snyk | Dependency vulnerability scanning |
| OWASP ZAP | DAST security scanning in CI |
| Trivy | Container image scanning |

---

## 6. Database Schema

### PostgreSQL Tables

```sql
-- Users table
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  totp_secret   TEXT,                        -- encrypted at rest
  role          TEXT DEFAULT 'operator',
  org_id        UUID REFERENCES orgs(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_login    TIMESTAMPTZ
);

-- Sessions table
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL,             -- SHA-256 of JWT, never store raw
  ip_address      INET,
  user_agent      TEXT,
  device_score    INTEGER DEFAULT 0,         -- 0–80 device trust score
  geo_city        TEXT,
  geo_country     TEXT,
  geo_lat         DECIMAL(9,6),
  geo_lon         DECIMAL(9,6),
  is_geo_anomaly  BOOLEAN DEFAULT FALSE,
  adapted_timeout INTEGER DEFAULT 120,       -- seconds, recalculated live
  biometric_score INTEGER DEFAULT 100,
  status          TEXT DEFAULT 'active',     -- active | expired | killed | suspicious
  created_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  last_activity   TIMESTAMPTZ DEFAULT now()
);

-- Session events (append-only, TimescaleDB hypertable)
CREATE TABLE session_events (
  time        TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id  UUID REFERENCES sessions(id),
  user_id     UUID REFERENCES users(id),
  event_type  TEXT NOT NULL,
  severity    TEXT DEFAULT 'info',           -- info | warn | high
  metadata    JSONB DEFAULT '{}',
  ip_address  INET,
  PRIMARY KEY (time, session_id)
);

-- Convert to TimescaleDB hypertable for time-series performance
SELECT create_hypertable('session_events', 'time');

-- Transactions table (logistics domain)
CREATE TABLE transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES sessions(id),
  user_id       UUID REFERENCES users(id),
  txn_ref       TEXT UNIQUE NOT NULL,        -- e.g. TXN-9821
  txn_type      TEXT,                        -- Freight, Cold Chain, etc.
  amount_paise  BIGINT NOT NULL,             -- Store in smallest unit
  currency      TEXT DEFAULT 'INR',
  risk_level    TEXT DEFAULT 'LOW',          -- LOW | MEDIUM | HIGH
  status        TEXT DEFAULT 'PENDING',
  route_origin  TEXT,
  route_dest    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  authorized_at TIMESTAMPTZ,
  flagged_at    TIMESTAMPTZ,
  flagged_reason TEXT
);

-- Trusted geo-zones per org
CREATE TABLE geo_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES orgs(id),
  name        TEXT NOT NULL,
  lat         DECIMAL(9,6) NOT NULL,
  lon         DECIMAL(9,6) NOT NULL,
  radius_km   INTEGER DEFAULT 50,
  is_active   BOOLEAN DEFAULT TRUE
);

-- Device fingerprints (trusted devices per user)
CREATE TABLE trusted_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  fingerprint_hash TEXT NOT NULL,
  label           TEXT,                      -- e.g. "Chrome on MacBook"
  last_seen       TIMESTAMPTZ DEFAULT now(),
  trust_granted_at TIMESTAMPTZ DEFAULT now(),
  is_revoked      BOOLEAN DEFAULT FALSE
);
```

### Redis Key Structure

```
# Active session
session:{session_id}  →  JSON { user_id, role, expires_at, adapted_timeout, biometric_score, ... }
TTL: adapted_timeout seconds

# User's active sessions index
user_sessions:{user_id}  →  SET of session_ids

# Rate limiting
ratelimit:login:{ip}  →  counter  (TTL: 15 min)
ratelimit:totp:{user_id}  →  counter  (TTL: 5 min)

# Tab registry per session
tabs:{session_id}  →  HASH { tab_id: { title, route, last_active, status } }

# JWT denylist (for revoked tokens before expiry)
denylist:{jti}  →  "1"  (TTL: original token TTL)
```

---

## 7. Backend — FastAPI Risk Service

### Project Structure

```
apps/api/
├── main.py                  # FastAPI app entrypoint
├── routers/
│   ├── session.py           # Session CRUD endpoints
│   ├── risk.py              # Risk scoring endpoint
│   ├── geo.py               # Geo-fence lookup
│   └── events.py            # Session event ingestion
├── services/
│   ├── risk_engine.py       # Adaptive timeout calculator
│   ├── biometrics.py        # Biometric score processor
│   ├── geo_service.py       # MaxMind GeoIP2 wrapper
│   └── threat_feed.py       # AbuseIPDB integration
├── models/
│   ├── session.py           # Pydantic models
│   └── risk.py
├── db/
│   ├── postgres.py          # Async SQLAlchemy session
│   └── redis.py             # Redis connection pool
├── middleware/
│   ├── auth.py              # JWT verification middleware
│   └── rate_limit.py        # Redis-backed rate limiter
├── tasks/
│   └── celery_app.py        # Async event processing
├── Dockerfile
└── requirements.txt
```

### Risk Engine Core Logic

```python
# services/risk_engine.py
from dataclasses import dataclass
from typing import Optional
import asyncio

BASE_TIMEOUT = 120  # seconds

@dataclass
class RiskContext:
    user_id: str
    session_id: str
    biometric_score: int          # 0–100
    device_trust_score: int       # 0–80
    is_geo_anomaly: bool
    is_trusted_device: bool
    is_off_hours: bool            # outside 09:00–19:00 user local time
    max_active_txn_amount: int    # in paise
    failed_totp_last_hour: int
    is_in_geo_fence: bool

@dataclass
class RiskResult:
    adapted_timeout: int          # seconds
    risk_level: str               # LOW | MEDIUM | HIGH
    active_factors: list[dict]
    requires_step_up: bool

def calculate_adapted_timeout(ctx: RiskContext) -> RiskResult:
    delta = 0
    factors = []
    requires_step_up = False

    # High-value transaction shortens timeout
    if ctx.max_active_txn_amount > 40_000_00:  # > ₹4,00,000
        delta -= 30
        factors.append({"label": "Active TXN > ₹4L", "impact": "+", "delta": 30})

    # Trusted device relaxes timeout
    if ctx.is_trusted_device:
        delta += 45
        factors.append({"label": "Trusted device", "impact": "-", "delta": 45})

    # Off-hours tightens timeout
    if ctx.is_off_hours:
        delta -= 10
        factors.append({"label": "Off-hours access", "impact": "+", "delta": 10})

    # In geo-fence relaxes timeout
    if ctx.is_in_geo_fence:
        delta += 20
        factors.append({"label": "Within geo-fence", "impact": "-", "delta": 20})

    # Geo anomaly shortens significantly
    if ctx.is_geo_anomaly:
        delta -= 45
        requires_step_up = True
        factors.append({"label": "Geo anomaly detected", "impact": "+", "delta": 45})

    # Biometric confidence
    if ctx.biometric_score >= 85:
        delta += 30
        factors.append({"label": "High biometric confidence", "impact": "-", "delta": 30})
    elif ctx.biometric_score < 65:
        delta -= 20
        factors.append({"label": "Low biometric score", "impact": "+", "delta": 20})
        if ctx.biometric_score < 40:
            requires_step_up = True

    # Recent TOTP failures
    if ctx.failed_totp_last_hour >= 3:
        delta -= 45
        requires_step_up = True
        factors.append({"label": "Multiple TOTP failures", "impact": "+", "delta": 45})

    adapted = max(45, min(14400, BASE_TIMEOUT + delta))  # clamp 45s – 4h

    risk_score = -delta  # positive delta = lower risk
    risk_level = "LOW" if risk_score <= 0 else "MEDIUM" if risk_score <= 40 else "HIGH"

    return RiskResult(
        adapted_timeout=adapted,
        risk_level=risk_level,
        active_factors=factors,
        requires_step_up=requires_step_up
    )
```

### Key API Endpoints

```python
# routers/session.py
from fastapi import APIRouter, Depends, HTTPException, Request
from ..services.risk_engine import calculate_adapted_timeout, RiskContext
from ..db.redis import get_redis
from ..middleware.auth import verify_jwt

router = APIRouter(prefix="/api/session", tags=["session"])

@router.post("/heartbeat")
async def session_heartbeat(
    request: Request,
    session_payload: dict = Depends(verify_jwt),
    redis = Depends(get_redis)
):
    """
    Called every 15s by the frontend to:
    1. Confirm session is still valid
    2. Receive updated adapted_timeout
    3. Receive step_up_required flag
    """
    session_id = session_payload["session_id"]
    
    # Fetch current risk context from Redis
    session_data = await redis.get(f"session:{session_id}")
    if not session_data:
        raise HTTPException(status_code=401, detail="Session expired")
    
    ctx = RiskContext(**build_risk_context(session_data, request))
    result = calculate_adapted_timeout(ctx)
    
    # Update TTL in Redis with new adapted timeout
    await redis.expire(f"session:{session_id}", result.adapted_timeout)
    
    # Persist updated timeout to DB (async via Celery)
    update_session_timeout.delay(session_id, result.adapted_timeout)
    
    return {
        "valid": True,
        "adapted_timeout": result.adapted_timeout,
        "risk_level": result.risk_level,
        "step_up_required": result.requires_step_up,
        "active_factors": result.active_factors
    }


@router.post("/extend")
async def extend_session(
    session_payload: dict = Depends(verify_jwt),
    redis = Depends(get_redis)
):
    """User explicitly extends session — resets activity timer"""
    session_id = session_payload["session_id"]
    await redis.set(f"last_activity:{session_id}", "now", ex=3600)
    
    # Log extension event
    await log_session_event(session_id, "SESSION_EXTENDED", "info")
    
    return {"extended": True, "message": "Session extended successfully"}


@router.delete("/tab/{tab_id}")
async def kill_tab(
    tab_id: str,
    session_payload: dict = Depends(verify_jwt),
    redis = Depends(get_redis)
):
    """Kill a specific tab from the session graph"""
    session_id = session_payload["session_id"]
    
    await redis.hdel(f"tabs:{session_id}", tab_id)
    
    # Broadcast kill signal to that tab via WebSocket relay
    await broadcast_tab_event(session_id, tab_id, "TAB_KILLED")
    await log_session_event(session_id, "TAB_KILLED", "warn", {"tab_id": tab_id})
    
    return {"killed": True, "tab_id": tab_id}


@router.post("/biometrics")
async def update_biometric_score(
    payload: BiometricPayload,
    session_payload: dict = Depends(verify_jwt),
    redis = Depends(get_redis)
):
    """Receive biometric trust score from Web Worker every 10s"""
    session_id = session_payload["session_id"]
    
    score = payload.composite_score
    
    # Update score in session store
    await redis.hset(f"session:{session_id}", "biometric_score", score)
    
    # Trigger step-up if score critically low
    if score < 40:
        await log_session_event(session_id, "BIOMETRIC_DROP", "high", {"score": score})
        return {"score": score, "action": "STEP_UP_AUTH_REQUIRED"}
    
    return {"score": score, "action": "OK"}
```

---

## 8. Frontend — Next.js Session Engine

### Project Structure

```
apps/web/
├── app/
│   ├── layout.tsx              # Root layout with SessionProvider
│   ├── dashboard/
│   │   └── page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   └── session/
│   │       ├── heartbeat/route.ts
│   │       ├── extend/route.ts
│   │       └── events/route.ts
├── components/
│   ├── session/
│   │   ├── SessionProvider.tsx  # Context + hooks
│   │   ├── SessionTimer.tsx     # Nav bar timer strip
│   │   ├── WarningModal.tsx     # Expiry warning dialog
│   │   ├── LogoutScreen.tsx     # Post-logout summary
│   │   ├── BiometricsPanel.tsx  # Live biometric scores
│   │   ├── RiskAdaptivePanel.tsx
│   │   ├── CrossTabPanel.tsx
│   │   ├── ReplayTimeline.tsx
│   │   └── GeoFenceMap.tsx
│   └── ui/                     # shadcn/ui components
├── lib/
│   ├── session-engine/         # Core session logic (shared pkg)
│   ├── biometrics.worker.ts    # Web Worker
│   └── broadcast.ts            # BroadcastChannel wrapper
├── middleware.ts               # Edge middleware — auth check on every route
└── next.config.ts
```

### Session Provider

```typescript
// components/session/SessionProvider.tsx
"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";

const BASE_TIMEOUT = 120;
const WARN_AT = 30;
const HEARTBEAT_INTERVAL = 15_000;
const ACTIVITY_DEBOUNCE = 1_500;

const ACTIVITY_EVENTS = ["mousemove","keydown","mousedown","touchstart","scroll","click"] as const;

interface SessionState {
  remaining: number;
  adaptedTimeout: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  biometricScore: number;
  showWarning: boolean;
  isActive: boolean;
  tabs: TabInfo[];
  sessionLog: SessionEvent[];
  extend: () => void;
  killTab: (tabId: string) => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [remaining, setRemaining] = useState(BASE_TIMEOUT);
  const [adaptedTimeout, setAdaptedTimeout] = useState(BASE_TIMEOUT);
  const [riskLevel, setRiskLevel] = useState<"LOW"|"MEDIUM"|"HIGH">("LOW");
  const [biometricScore, setBiometricScore] = useState(100);
  const [showWarning, setShowWarning] = useState(false);
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [sessionLog, setSessionLog] = useState<SessionEvent[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // ── Activity detection ───────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    setRemaining(adaptedTimeout);
    setShowWarning(false);
  }, [adaptedTimeout]);

  useEffect(() => {
    const handler = () => {
      clearTimeout(debounceRef.current!);
      debounceRef.current = setTimeout(resetTimer, ACTIVITY_DEBOUNCE);
    };
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handler, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handler));
  }, [resetTimer]);

  // ── Countdown tick ───────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    timerRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { handleLogout(); return 0; }
        if (prev <= WARN_AT) setShowWarning(true);
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [session]);

  // ── Heartbeat to backend (every 15s) ────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const ping = async () => {
      try {
        const res = await fetch("/api/session/heartbeat", { method: "POST" });
        const data = await res.json();
        if (!data.valid) { handleLogout(); return; }
        setAdaptedTimeout(data.adapted_timeout);
        setRiskLevel(data.risk_level);
        if (data.step_up_required) triggerStepUp();
      } catch (e) {
        console.error("Heartbeat failed", e);
      }
    };
    ping();
    const interval = setInterval(ping, HEARTBEAT_INTERVAL);
    return () => clearInterval(interval);
  }, [session]);

  // ── Biometrics Web Worker ────────────────────────────────────────────
  useEffect(() => {
    workerRef.current = new Worker(new URL("../../lib/biometrics.worker.ts", import.meta.url));
    workerRef.current.onmessage = async (e) => {
      const { score } = e.data;
      setBiometricScore(score);
      await fetch("/api/session/biometrics", {
        method: "POST",
        body: JSON.stringify({ composite_score: score }),
        headers: { "Content-Type": "application/json" }
      });
    };
    return () => workerRef.current?.terminate();
  }, []);

  // ── BroadcastChannel (cross-tab) ────────────────────────────────────
  useEffect(() => {
    broadcastRef.current = new BroadcastChannel("nexus-session");
    broadcastRef.current.onmessage = (e) => {
      if (e.data.type === "LOGOUT") handleLogout();
      if (e.data.type === "EXTEND") resetTimer();
      if (e.data.type === "TABS_UPDATE") setTabs(e.data.tabs);
    };
    return () => broadcastRef.current?.close();
  }, []);

  const extend = useCallback(async () => {
    resetTimer();
    await fetch("/api/session/extend", { method: "POST" });
    broadcastRef.current?.postMessage({ type: "EXTEND" });
    addLog("Session extended by user", "success");
  }, [resetTimer]);

  const killTab = useCallback(async (tabId: string) => {
    await fetch(`/api/session/tab/${tabId}`, { method: "DELETE" });
    setTabs(prev => prev.filter(t => t.id !== tabId));
  }, []);

  const handleLogout = useCallback(() => {
    broadcastRef.current?.postMessage({ type: "LOGOUT" });
    clearInterval(timerRef.current!);
    signOut({ callbackUrl: "/auth/logout-summary" });
  }, []);

  const addLog = (msg: string, type: string) => {
    const t = new Date().toTimeString().slice(0,8);
    setSessionLog(prev => [{ time: t, msg, type }, ...prev.slice(0, 19)]);
  };

  return (
    <SessionContext.Provider value={{
      remaining, adaptedTimeout, riskLevel, biometricScore,
      showWarning, isActive: true, tabs, sessionLog,
      extend, killTab
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSessionEngine = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessionEngine must be used inside SessionProvider");
  return ctx;
};
```

### Edge Middleware (Route Protection)

```typescript
// middleware.ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    
    // Check if session is expired server-side
    if (token?.expires && Date.now() > token.expires * 1000) {
      return NextResponse.redirect(new URL("/auth/session-expired", req.url));
    }
    
    // Enforce role-based route access
    const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
    if (isAdminRoute && token?.role !== "admin") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
    
    // Add security headers to every response
    const response = NextResponse.next();
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "geolocation=(), microphone=()");
    
    return response;
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|auth/login).*)"],
};
```

---

## 9. Session Engine Package

```typescript
// packages/session-engine/src/index.ts
export { calculateRisk } from "./risk";
export { InactivityTimer } from "./timer";
export { BroadcastSync } from "./broadcast";
export { TabRegistry } from "./tabs";

// packages/session-engine/src/timer.ts
export class InactivityTimer {
  private remaining: number;
  private timeout: number;
  private interval: ReturnType<typeof setInterval> | null = null;
  private onWarn: () => void;
  private onExpire: () => void;
  private warnAt: number;

  constructor(config: {
    timeout: number;
    warnAt: number;
    onWarn: () => void;
    onExpire: () => void;
  }) {
    this.timeout = config.timeout;
    this.remaining = config.timeout;
    this.warnAt = config.warnAt;
    this.onWarn = config.onWarn;
    this.onExpire = config.onExpire;
  }

  start() {
    this.interval = setInterval(() => {
      this.remaining -= 1;
      if (this.remaining <= this.warnAt) this.onWarn();
      if (this.remaining <= 0) {
        this.stop();
        this.onExpire();
      }
    }, 1000);
  }

  reset(newTimeout?: number) {
    if (newTimeout) this.timeout = newTimeout;
    this.remaining = this.timeout;
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  get timeLeft() { return this.remaining; }
}
```

---

## 10. Behavioral Biometrics Worker

```typescript
// lib/biometrics.worker.ts
// Runs in a Web Worker — no DOM access, pure computation

interface BiometricSample {
  type: "key" | "mouse" | "scroll" | "click";
  timestamp: number;
  value: number;         // inter-event delta for keys; velocity for mouse
}

const samples: BiometricSample[] = [];
let lastKeyTime = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let lastMouseTime = 0;
let clickTimes: number[] = [];

// Receive raw events from main thread
self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data;

  if (type === "KEYDOWN") {
    const now = data.timestamp;
    if (lastKeyTime > 0) {
      const delta = now - lastKeyTime;
      samples.push({ type: "key", timestamp: now, value: delta });
    }
    lastKeyTime = now;
  }

  if (type === "MOUSEMOVE") {
    const { x, y, timestamp } = data;
    if (lastMouseTime > 0) {
      const dt = timestamp - lastMouseTime;
      const dx = x - lastMouseX;
      const dy = y - lastMouseY;
      const velocity = Math.sqrt(dx * dx + dy * dy) / dt;
      samples.push({ type: "mouse", timestamp, value: velocity });
    }
    lastMouseX = x; lastMouseY = y; lastMouseTime = timestamp;
  }

  if (type === "CLICK") {
    clickTimes.push(data.timestamp);
    if (clickTimes.length > 20) clickTimes.shift();
  }

  if (type === "COMPUTE_SCORE") {
    const score = computeScore();
    self.postMessage({ score });
    // Clear old samples (keep last 2 minutes)
    const cutoff = Date.now() - 120_000;
    samples.splice(0, samples.findIndex(s => s.timestamp > cutoff));
  }
};

function computeScore(): number {
  if (samples.length < 10) return 90; // Not enough data — assume legitimate

  const keySamples = samples.filter(s => s.type === "key").map(s => s.value);
  const mouseSamples = samples.filter(s => s.type === "mouse").map(s => s.value);

  // Keystroke cadence consistency (lower variance = more consistent = higher score)
  const keyScore = keySamples.length > 5
    ? Math.max(0, 100 - coefficientOfVariation(keySamples) * 100)
    : 90;

  // Mouse velocity normality (detect robotic even movement OR chaotic outliers)
  const mouseScore = mouseSamples.length > 5
    ? Math.max(0, 100 - Math.abs(coefficientOfVariation(mouseSamples) - 0.4) * 150)
    : 85;

  // Click rhythm
  const clickDeltas = clickTimes.slice(1).map((t, i) => t - clickTimes[i]);
  const clickScore = clickDeltas.length > 3
    ? Math.max(0, 100 - coefficientOfVariation(clickDeltas) * 80)
    : 90;

  // Weighted composite
  const composite = keyScore * 0.35 + mouseScore * 0.35 + clickScore * 0.30;
  return Math.round(Math.max(0, Math.min(100, composite)));
}

function coefficientOfVariation(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance) / mean;
}

// Trigger score computation every 10 seconds
setInterval(() => self.postMessage({ type: "REQUEST_SCORE" }), 10_000);
```

---

## 11. Cross-Tab Sync

```typescript
// lib/broadcast.ts
type TabEvent =
  | { type: "TAB_ALIVE"; tabId: string; title: string; route: string }
  | { type: "TAB_ACTIVITY"; tabId: string; timestamp: number }
  | { type: "TAB_KILLED"; tabId: string }
  | { type: "LOGOUT" }
  | { type: "EXTEND" }
  | { type: "SESSION_EXPIRED" };

export class BroadcastSync {
  private channel: BroadcastChannel;
  private tabId: string;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private onEvent: (event: TabEvent) => void) {
    this.tabId = crypto.randomUUID();
    this.channel = new BroadcastChannel("nexus-session");
    this.channel.onmessage = (e) => this.onEvent(e.data as TabEvent);
    this.startHeartbeat();
    this.announce();
  }

  private announce() {
    this.broadcast({
      type: "TAB_ALIVE",
      tabId: this.tabId,
      title: document.title,
      route: window.location.pathname
    });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.broadcast({ type: "TAB_ACTIVITY", tabId: this.tabId, timestamp: Date.now() });
    }, 5_000);
  }

  broadcast(event: TabEvent) {
    this.channel.postMessage(event);
  }

  destroy() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.channel.close();
  }
}
```

---

## 12. Authentication & JWT Strategy

### NextAuth Configuration

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyPassword, verifyTOTP, getUserByEmail } from "@/lib/auth";
import { createSession, rotateJWT } from "@/lib/session";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "TOTP Code", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials) return null;

        const user = await getUserByEmail(credentials.email);
        if (!user) return null;

        const passwordValid = await verifyPassword(credentials.password, user.password_hash);
        if (!passwordValid) return null;

        // TOTP verification (required for all logistics operators)
        if (user.totp_secret) {
          const totpValid = verifyTOTP(credentials.totp, user.totp_secret);
          if (!totpValid) throw new Error("INVALID_TOTP");
        }

        return { id: user.id, email: user.email, role: user.role, orgId: user.org_id };
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 4 * 60 * 60,   // 4 hours absolute maximum
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.orgId = user.orgId;
        token.sessionId = crypto.randomUUID();
        // Create Redis session entry
        await createSession(token.sessionId as string, { userId: user.id, role: user.role });
      }

      // Rotate JWT every 5 minutes (rolling token)
      const now = Math.floor(Date.now() / 1000);
      if (token.iat && now - (token.iat as number) > 300) {
        token = await rotateJWT(token);
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.role = token.role as string;
      session.sessionId = token.sessionId as string;
      return session;
    }
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  cookies: {
    sessionToken: {
      name: "__Secure-next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      }
    }
  }
};
```

---

## 13. Redis Session Store

```python
# db/redis.py — FastAPI side
import redis.asyncio as redis
import json
from cryptography.fernet import Fernet

ENCRYPTION_KEY = Fernet.generate_key()
cipher = Fernet(ENCRYPTION_KEY)

async def get_redis():
    return await redis.from_url(
        os.getenv("REDIS_URL"),
        encoding="utf-8",
        decode_responses=True,
        ssl=True
    )

async def store_session(r, session_id: str, data: dict, ttl: int):
    """Encrypt and store session data with TTL"""
    encrypted = cipher.encrypt(json.dumps(data).encode()).decode()
    await r.setex(f"session:{session_id}", ttl, encrypted)

async def get_session(r, session_id: str) -> dict | None:
    raw = await r.get(f"session:{session_id}")
    if not raw:
        return None
    decrypted = cipher.decrypt(raw.encode())
    return json.loads(decrypted)

async def extend_session(r, session_id: str, new_ttl: int):
    """Reset TTL without touching data"""
    await r.expire(f"session:{session_id}", new_ttl)

async def revoke_session(r, session_id: str, jti: str, original_ttl: int):
    """Add JWT to denylist and delete session"""
    await r.setex(f"denylist:{jti}", original_ttl, "1")
    await r.delete(f"session:{session_id}")
    await r.delete(f"tabs:{session_id}")
```

---

## 14. Geo-Fence Service

```python
# services/geo_service.py
import geoip2.database
import geoip2.errors
from math import radians, sin, cos, sqrt, atan2
import httpx
import os

class GeoFenceService:
    def __init__(self):
        self.reader = geoip2.database.Reader(os.getenv("GEOIP2_DB_PATH"))

    def lookup_ip(self, ip: str) -> dict:
        try:
            response = self.reader.city(ip)
            return {
                "city": response.city.name,
                "country": response.country.iso_code,
                "lat": float(response.location.latitude or 0),
                "lon": float(response.location.longitude or 0),
                "accuracy_radius": response.location.accuracy_radius
            }
        except geoip2.errors.AddressNotFoundError:
            return {"city": None, "country": None, "lat": 0, "lon": 0}

    def haversine_km(self, lat1, lon1, lat2, lon2) -> float:
        R = 6371.0
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        return R * 2 * atan2(sqrt(a), sqrt(1 - a))

    def is_in_any_zone(self, lat: float, lon: float, zones: list[dict]) -> bool:
        for zone in zones:
            dist = self.haversine_km(lat, lon, zone["lat"], zone["lon"])
            if dist <= zone["radius_km"]:
                return True
        return False

    async def is_malicious_ip(self, ip: str) -> bool:
        """Check AbuseIPDB threat feed"""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.abuseipdb.com/api/v2/check",
                params={"ipAddress": ip, "maxAgeInDays": 30},
                headers={"Key": os.getenv("ABUSEIPDB_KEY"), "Accept": "application/json"}
            )
            data = resp.json()
            return data.get("data", {}).get("abuseConfidenceScore", 0) > 50
```

---

## 15. Deployment — Step by Step

### Prerequisites

```bash
# Required tools
node >= 20.x
python >= 3.12
docker >= 24.x
pnpm >= 9.x
railway CLI
vercel CLI
```

### Step 1 — Repository Setup

```bash
mkdir nexus-tls && cd nexus-tls
git init
pnpm init

# Create monorepo structure
mkdir -p apps/web apps/api packages/session-engine packages/biometrics

# Root package.json
cat > package.json << 'EOF'
{
  "name": "nexus-tls",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint"
  }
}
EOF

pnpm add -D turbo typescript @types/node
```

### Step 2 — Next.js Frontend

```bash
cd apps/web
pnpm create next-app . --typescript --tailwind --app --no-src-dir

# Install dependencies
pnpm add next-auth @auth/prisma-adapter
pnpm add zustand
pnpm add socket.io-client
pnpm add @tensorflow/tfjs
pnpm add mapbox-gl @types/mapbox-gl
pnpm add qrcode otplib
pnpm add @sentry/nextjs
```

### Step 3 — FastAPI Backend

```bash
cd apps/api
python3 -m venv venv && source venv/bin/activate

pip install fastapi uvicorn[standard] pydantic[email]
pip install sqlalchemy asyncpg alembic
pip install redis[hiredis] celery
pip install python-jose[cryptography] passlib[bcrypt] pyotp
pip install geoip2 httpx cryptography
pip install opentelemetry-sdk opentelemetry-instrumentation-fastapi

pip freeze > requirements.txt
```

### Step 4 — Upstash Redis

```bash
# Install Upstash CLI or use dashboard at console.upstash.com
# Create database:
#   Region: ap-south-1 (Mumbai — closest to logistics hub)
#   TLS: Enabled
#   Eviction: noeviction (sessions must not be silently dropped)

# Copy REDIS_URL to your .env:
# REDIS_URL=rediss://default:{password}@{endpoint}.upstash.io:6379
```

### Step 5 — Supabase PostgreSQL

```bash
# At supabase.com — create new project
# Enable pgbouncer (connection pooling) in project settings
# Run migrations:

cd apps/api
alembic init alembic
# Configure alembic/env.py with DATABASE_URL
alembic revision --autogenerate -m "initial_schema"
alembic upgrade head

# Enable TimescaleDB extension in Supabase SQL editor:
# CREATE EXTENSION IF NOT EXISTS timescaledb;
# SELECT create_hypertable('session_events', 'time');
```

### Step 6 — Environment Variables

```bash
# apps/web/.env.local
NEXTAUTH_SECRET=<32-byte-random-secret>
NEXTAUTH_URL=https://yourdomain.com
DATABASE_URL=postgresql://postgres:{pw}@{host}:5432/postgres?pgbouncer=true
REDIS_URL=rediss://default:{pw}@{endpoint}.upstash.io:6379
RISK_API_URL=https://your-api.railway.app
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
SENTRY_DSN=https://...@sentry.io/...

# apps/api/.env
DATABASE_URL=postgresql+asyncpg://postgres:{pw}@{host}:5432/postgres
REDIS_URL=rediss://default:{pw}@{endpoint}.upstash.io:6379
JWT_SECRET=<same-as-nextauth-secret>
GEOIP2_DB_PATH=/app/data/GeoLite2-City.mmdb
ABUSEIPDB_KEY=<your-key>
ENCRYPTION_KEY=<fernet-key>
CORS_ORIGINS=["https://yourdomain.com"]
```

### Step 7 — Docker Configuration

```dockerfile
# apps/api/Dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download MaxMind GeoIP2 database
RUN mkdir -p data && \
    wget -qO- "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MAXMIND_KEY}&suffix=tar.gz" | \
    tar -xz --strip-components=1 -C data/

COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

```yaml
# docker-compose.yml (local dev)
version: "3.9"
services:
  web:
    build: ./apps/web
    ports: ["3000:3000"]
    env_file: ./apps/web/.env.local
    depends_on: [api]

  api:
    build: ./apps/api
    ports: ["8000:8000"]
    env_file: ./apps/api/.env
    depends_on: [redis, postgres]

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass devpassword --tls-port 0
    ports: ["6379:6379"]

  postgres:
    image: timescale/timescaledb:latest-pg16
    environment:
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: nexus_dev
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data

  grafana:
    image: grafana/grafana:latest
    ports: ["3001:3000"]
    volumes:
      - grafana_data:/var/lib/grafana

volumes:
  pgdata:
  grafana_data:
```

### Step 8 — Deploy to Vercel + Railway

```bash
# Deploy frontend to Vercel
cd apps/web
vercel --prod
# Set all env vars via: vercel env add

# Deploy backend to Railway
cd apps/api
railway login
railway init
railway up
# Set env vars: railway variables set KEY=VALUE

# Set custom domain in Vercel dashboard
# Update NEXTAUTH_URL and CORS_ORIGINS with production domain
```

---

## 16. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter web test
      - run: pnpm --filter web lint
      - run: pnpm --filter web build

  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: cd apps/api && pip install -r requirements.txt
      - run: cd apps/api && pytest tests/ -v --cov=. --cov-report=xml

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Snyk dependency scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      - name: Trivy container scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: "apps/api"
          severity: "CRITICAL,HIGH"

  deploy:
    needs: [test-frontend, test-backend, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy frontend (Vercel)
        run: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
      - name: Deploy backend (Railway)
        run: railway up --service api
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

## 17. Observability & Alerting

### Grafana Dashboard Setup

```bash
# Start local Grafana stack
docker-compose up grafana loki tempo prometheus

# Access Grafana at http://localhost:3001
# Default credentials: admin / admin
```

### Key Metrics to Monitor

```yaml
# prometheus/alerts.yml
groups:
  - name: session-alerts
    rules:
      - alert: HighSessionLogoutRate
        expr: rate(session_logouts_total[5m]) > 10
        for: 2m
        labels: { severity: warning }
        annotations:
          summary: "Unusually high auto-logout rate"

      - alert: BiometricScoreDrop
        expr: avg(session_biometric_score) < 60
        for: 5m
        labels: { severity: critical }
        annotations:
          summary: "Average biometric score critically low — possible attack"

      - alert: GeoAnomalySpike
        expr: rate(geo_anomalies_total[10m]) > 5
        for: 1m
        labels: { severity: critical }
        annotations:
          summary: "Multiple geo-anomaly logins detected"

      - alert: RedisSessionStoreDown
        expr: redis_up == 0
        for: 30s
        labels: { severity: critical }
        annotations:
          summary: "Redis session store is unreachable — all sessions at risk"
```

### OpenTelemetry Tracing (FastAPI)

```python
# main.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

tracer_provider = TracerProvider()
tracer_provider.add_span_processor(
    BatchSpanProcessor(OTLPSpanExporter(endpoint="http://tempo:4317"))
)
trace.set_tracer_provider(tracer_provider)

app = FastAPI(title="NEXUS TLS Risk Engine")
FastAPIInstrumentor.instrument_app(app)
```

---

## 18. Security Hardening Checklist

### Authentication

- [ ] Passwords hashed with bcrypt (cost factor 12)
- [ ] TOTP enforced for all operator accounts
- [ ] JWT signed with RS256 (asymmetric, not HS256)
- [ ] JWT stored in HttpOnly + Secure + SameSite=Lax cookie
- [ ] JWT denylist maintained in Redis for revoked tokens
- [ ] JWT rotation every 5 minutes (rolling)
- [ ] Refresh tokens stored server-side only
- [ ] Login rate limited: 5 attempts per 15 minutes per IP
- [ ] TOTP rate limited: 3 attempts per 5 minutes per user

### Session Management

- [ ] Sessions encrypted at rest in Redis (Fernet AES-128)
- [ ] Session ID never exposed in URL parameters
- [ ] Session invalidated on password change
- [ ] Only 1 concurrent active session per user (configurable)
- [ ] Session TTL enforced server-side (never trust client timer alone)
- [ ] Tab registry cleaned up on session expiry

### Transport Security

- [ ] TLS 1.3 enforced (TLS 1.0/1.1 disabled)
- [ ] HSTS header with `max-age=63072000; includeSubDomains; preload`
- [ ] CSP header configured (no `unsafe-inline` for scripts)
- [ ] CORS restricted to explicit allowed origins
- [ ] X-Frame-Options: DENY
- [ ] Certificate pinning for mobile clients (if applicable)

### Infrastructure

- [ ] Redis requires AUTH password
- [ ] PostgreSQL SSL mode = `require`
- [ ] Database credentials rotated every 90 days (Doppler automation)
- [ ] Docker images scanned with Trivy in CI
- [ ] Snyk SCA on every PR
- [ ] OWASP ZAP DAST scan on staging before every production deploy
- [ ] Penetration test quarterly (external vendor)
- [ ] WAF configured on Vercel (block SQLi, XSS patterns)

### Compliance (DPDPA / ISO 27001)

- [ ] Session events retained for 90 days minimum
- [ ] Audit log is append-only (no UPDATE/DELETE on session_events)
- [ ] User data localized to India (ap-south-1) if required by law
- [ ] Data processing agreement with all sub-processors
- [ ] Right to erasure workflow implemented (purges personal session data after 90 days)
- [ ] Annual ISO 27001 audit scheduled

---

## 19. Competitor Comparison

| Feature | NEXUS TLS | Okta | Azure AD | Ping ID | AWS Cognito |
|---|---|---|---|---|---|
| Inactivity Timeout | ✅ Risk-Adaptive | ✅ Fixed | ✅ Fixed | ✅ Fixed | ✅ Fixed |
| Behavioral Biometrics | ✅ Live, in-browser ML | ❌ | ❌ | ⚠️ Partial | ❌ |
| Risk-Adaptive Timeout | ✅ Real-time | ❌ | ❌ | ❌ | ❌ |
| Cross-Tab Kill Switch | ✅ Per-tab control | ❌ | ❌ | ❌ | ❌ |
| Session Replay Timeline | ✅ Scrubable UI | ⚠️ Logs only | ⚠️ Logs only | ❌ | ❌ |
| Geo-Fence Map (live) | ✅ With anomaly rings | ⚠️ Basic | ⚠️ Conditional | ⚠️ Basic | ❌ |
| Logistics Domain Rules | ✅ TXN-value based | ❌ | ❌ | ❌ | ❌ |
| Warning Modal UX | ✅ Countdown + extend | ✅ Basic | ✅ Basic | ✅ Basic | ❌ |
| JWT Rotation | ✅ 5-min rolling | ✅ | ✅ | ✅ | ✅ |
| SIEM Integration | ✅ Webhook + OTEL | ✅ | ✅ | ✅ | ✅ |
| Open Source / Self-host | ✅ Full control | ❌ SaaS only | ❌ SaaS only | ❌ SaaS only | ⚠️ Managed |
| **Overall Score** | **10/10** | **7/10** | **7/10** | **6/10** | **5/10** |

---

## 20. Cost & Timeline Estimates

### Infrastructure Cost at Scale

| Service | 500 users/day | 5,000 users/day | 50,000 users/day |
|---|---|---|---|
| Vercel (frontend) | $0 (hobby) | $20/mo (Pro) | $150/mo (Enterprise) |
| Railway (API) | $5/mo | $25/mo | $120/mo |
| Upstash Redis | $0 (free tier) | $15/mo | $80/mo |
| Supabase DB | $0 (free tier) | $25/mo | $100/mo |
| MaxMind GeoIP2 | $0 (GeoLite2 free) | $0 | $24/mo (commercial) |
| Grafana Cloud | $0 (free tier) | $0 | $49/mo |
| **Total** | **~$5/mo** | **~$85/mo** | **~$523/mo** |

### Build Timeline (3-Engineer Team)

| Phase | Duration | Deliverables |
|---|---|---|
| **Phase 1** — Core Session | Week 1–2 | Auth, JWT rotation, Redis store, basic timeout |
| **Phase 2** — Biometrics | Week 3–4 | Web Worker, scoring model, step-up auth trigger |
| **Phase 3** — Risk Engine | Week 4–5 | FastAPI service, adaptive timeout, geo-fence |
| **Phase 4** — Cross-Tab + Timeline | Week 5–6 | BroadcastChannel, tab kill, event replay |
| **Phase 5** — Observability | Week 6–7 | Grafana, Loki, alerts, SIEM webhooks |
| **Phase 6** — Security Audit | Week 7–8 | Pen test, OWASP ZAP, hardening checklist |
| **Total** | **8 weeks** | Production-ready system |

### Team Roles

| Role | Responsibility |
|---|---|
| Full-stack Engineer | Next.js, NextAuth, session engine package, cross-tab sync |
| Backend Engineer | FastAPI risk service, Redis store, geo-fence, Celery tasks |
| DevOps / Security Engineer | CI/CD, Docker, Grafana, hardening checklist, pen test coordination |

---

*Document prepared for NEXUS TLS v2.0 — Secure Session Management System for Digital Transactions & Logistics.*
*Last updated: 2026 | Classification: Internal Technical Reference*
