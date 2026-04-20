# Nexus TLS — Secure Session Management System

NEXUS TLS is an advanced, high-security session management platform built for logistics and enterprise sectors requiring strict compliance and risk-adaptive controls. It goes beyond traditional static timeouts by intelligently adapting to user behavior, transaction risk, and cross-tab activity in real-time.

## 🚀 Core Features & Innovations

### 1. Risk-Adaptive Session Timeouts
Traditional platforms use fixed inactivity timeouts (e.g., exactly 15 minutes). NEXUS TLS continually evaluates the **risk profile** of the current session and adapts the timeout dynamically.
- **How it works:** Every 15 seconds, the frontend sends a heartbeat to the backend containing the current context. The backend evaluates active risk factors (e.g., "High-value transaction > ₹4L detected", "Unusual login time") and calculates a new `adapted_timeout`. If the user performs a high-risk action, their inactivity window shrinks to protect the session.

### 2. Live Behavioral Biometrics (In-Browser ML)
NEXUS TLS analyzes *how* a user interacts with the application, not just *what* they do.
- **How it works:** A dedicated Web Worker silently runs in the background of the browser. It monitors mouse velocity, keystroke cadence, click rhythms, and scroll patterns. It computes a unified **Behavioral Trust Score (0-100)**. If a user's behavior drastically changes (e.g., a session hijack where an attacker takes over the mouse), the score drops. The backend can use this to immediately force a step-up authentication (like a TOTP prompt) or kill the session.

### 3. Cross-Tab Session Sync & Tab Kill-Switch
Users often have multiple tabs open. NEXUS TLS ensures security spans all of them simultaneously.
- **How it works:** Using the browser's native `BroadcastChannel` API, all active tabs for a user communicate securely with each other without needing a server round-trip. 
    - **Sync:** If you extend your session in Tab A, Tab B's timer instantly resets.
    - **Kill-Switch:** If a specific tab is deemed anomalous or left idle too long, you can remotely "kill" that specific tab from the dashboard without logging out of the entire session.
    - **Global Logout:** If the timer hits zero or you click logout, a `LOGOUT` broadcast is sent, instantly terminating the session across *all* open tabs simultaneously.

### 4. Geo-Fencing & Trusted Device Posture
Sessions are anchored not just to tokens, but to physical locations and known hardware.
- **How it works:** The backend uses MaxMind GeoIP to ensure the user's IP falls within allowed geographic radii (e.g., "50km from Mumbai HQ"). If an IP hops to a new country mid-session, the backend flags an anomaly.

### 5. Immutable Audit Log & Session Replay
Every action is recorded for compliance.
- **How it works:** From login to session termination, all major events (JWT rotations, warnings, high-value transactions) are logged. The dashboard features a "Session Replay Timeline" allowing administrators to scrub through the lifecycle of a session and see exactly when anomalies occurred.

---

## 🏗️ Technical Architecture & How It Runs

The system is built as a highly decoupled Monorepo using `pnpm workspaces`.

### Frontend: Next.js (App Router)
- **Tech:** Next.js 14, React 18, NextAuth.js
- **Role:** Handles the UI, the `SessionProvider` context, and the visual dashboard. 
- **The Engine:** The `SessionProvider.tsx` component is the heart of the frontend. It attaches native event listeners (`mousemove`, `keydown`) to detect activity, spins up the Web Worker for biometric scoring, manages the `BroadcastChannel` for cross-tab sync, and polls the Next.js API routes every 15 seconds.

### Backend: FastAPI (Python)
- **Tech:** FastAPI, Pydantic, SQLAlchemy, Celery
- **Role:** The high-performance risk engine. 
- **The Engine:** The Next.js frontend proxies its heartbeats to the FastAPI backend. FastAPI evaluates the incoming biometric scores, checks the Redis database for session state, runs the rules engine (e.g., looking at transaction values or geo-IP data), and returns the new adapted timeout limit.

### Key Workflows

1. **Authentication:** 
   User logs in via `/auth/login`. NextAuth validates credentials (and TOTP if enabled). A secure, `HttpOnly` JWT cookie is issued. 
2. **Session Ignition:**
   The Next.js `SessionProvider` mounts. It spawns the Web Worker and opens a `BroadcastChannel`. 
3. **The Heartbeat Loop:**
   Every 15s, a fetch request hits `/api/session/heartbeat` (which proxies to FastAPI). FastAPI returns `{ valid: true, adapted_timeout: 75, risk_level: "MEDIUM" }`. 
4. **The Countdown:**
   The React state decrements the timer every second. If activity is detected, the timer resets—but only up to the limit of the newly `adapted_timeout` provided by the backend.
5. **Warning & Termination:**
   If the timer drops to 30s, a warning modal interrupts the screen. At 0s, the session is wiped from state, the JWT is rotated out, and the user receives a post-logout summary.
