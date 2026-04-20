"""
NEXUS TLS — Real-Time WebSocket Engine backed by SQLite.
v3: Faster 1-second ticks, cached DB reads, responsive trust scoring.
"""

import asyncio
import json
import time
import random
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import database
import db_models as models
from services.risk_engine import RiskContext, calculate_adapted_timeout
from sqlalchemy import select, desc

router = APIRouter()

THREAT_CITIES = ["Moscow", "Beijing", "São Paulo", "Lagos", "Jakarta", "Tehran", "Pyongyang"]
THREAT_TYPES = [
    ("Brute-force SSH", "CRITICAL"), ("Credential Stuffing", "HIGH"),
    ("SQL Injection Attempt", "CRITICAL"), ("XSS Payload Detected", "MEDIUM"),
    ("Anomalous API Burst", "HIGH"), ("Session Hijack Attempt", "CRITICAL"),
    ("DNS Tunneling", "MEDIUM"), ("Port Scan Detected", "LOW"),
]
MERCHANTS = ["Amazon Pay", "PhonePe", "Razorpay", "Stripe India", "PayTM", "HDFC NetBanking", "ICICI Direct"]
ROUTES = ["BLR→MUM", "DEL→HYD", "CHN→PNQ", "KOL→GOA", "BLR→DEL", "MUM→CHN"]

# ── GLOBAL shared state (visible to ALL WebSocket sessions) ──
# These are module-level so the server admin dashboard can see all client events.
global_client_activities: list = []   # Rolling log of the last 50 client events
global_tabs_state: dict = {}          # {tabId: {id, title, route, visible, focused, idle, lastAct}}
global_connections: set = set()       # All active WebSocket connections

global_system_stats = {
    "uptime": 99.98,
    "activeSessions": random.randint(148, 210),
    "avgTrustScore": 91.0,
    "p95Latency": round(random.uniform(12, 22), 1),
    "totalRequests": random.randint(40000, 80000),
    "blockedThreats": random.randint(18, 40),
}

def _now():
    return datetime.now(timezone.utc).strftime("%H:%M:%S")


async def _persist_log(session_id: str, message: str, event_type: str):
    async with database.AsyncSessionLocal() as db:
        db.add(models.AuditLogModel(session_id=session_id, message=message, event_type=event_type))
        await db.commit()


async def _persist_session(session_id: str, **fields):
    async with database.AsyncSessionLocal() as db:
        q = select(models.SessionModel).where(models.SessionModel.id == session_id)
        res = await db.execute(q)
        row = res.scalars().first()
        if row:
            for k, v in fields.items():
                setattr(row, k, v)
            await db.commit()


async def _persist_txn(session_id: str, txn_id: str, amount: int, merchant: str,
                       route: str, risk_level: str, status: str):
    async with database.AsyncSessionLocal() as db:
        db.add(models.TransactionModel(
            id=txn_id, session_id=session_id, amount=amount,
            merchant=merchant, route=route, risk_level=risk_level, status=status
        ))
        await db.commit()


async def _fetch_logs(session_id: str, limit: int = 20):
    async with database.AsyncSessionLocal() as db:
        q = (select(models.AuditLogModel)
             .where(models.AuditLogModel.session_id == session_id)
             .order_by(desc(models.AuditLogModel.timestamp))
             .limit(limit))
        res = await db.execute(q)
        rows = res.scalars().all()
        return [{"t": r.timestamp.strftime("%H:%M:%S"), "msg": r.message, "type": r.event_type} for r in rows]


async def _fetch_txns(session_id: str, limit: int = 12):
    async with database.AsyncSessionLocal() as db:
        q = (select(models.TransactionModel)
             .where(models.TransactionModel.session_id == session_id)
             .order_by(desc(models.TransactionModel.timestamp))
             .limit(limit))
        res = await db.execute(q)
        return res.scalars().all()


async def _ensure_session(session_id: str):
    async with database.AsyncSessionLocal() as db:
        q = select(models.SessionModel).where(models.SessionModel.id == session_id)
        res = await db.execute(q)
        row = res.scalars().first()
        if row:
            # Reset to fresh state on each WS reconnect (demo mode)
            row.trust_score = 85
            row.base_timeout = 120
            row.adapted_timeout = 120
            row.remaining_timeout = 120
            row.geo_anomaly = False
            row.risk_level = "LOW"
            row.status = "ACTIVE"
            await db.commit()
            return 85, 120

        # Ensure "demo-user" exists to satisfy user_id ForeignKey
        u_q = select(models.UserModel).where(models.UserModel.id == "demo-user")
        u_res = await db.execute(u_q)
        if not u_res.scalars().first():
            db.add(models.UserModel(
                id="demo-user",
                email="demo@nexus.io",
                password_hash="mock",
                role="operator"
            ))

        db.add(models.SessionModel(
            id=session_id, user_id="demo-user",
            base_timeout=120, adapted_timeout=120,
            remaining_timeout=120, trust_score=85
        ))
        db.add(models.AuditLogModel(
            session_id=session_id,
            message="Session opened — NEXUS TLS REAL ENGINE v3",
            event_type="success"
        ))
        await db.commit()
        return 85, 120


@router.websocket("/ws/session/real/{session_id}")
async def websocket_real_engine(websocket: WebSocket, session_id: str):
    client_ip = websocket.client.host if websocket.client else "Unknown"
    print(f"\n[WS_ENGINE] => CLIENT CONNECTED TO REAL ENGINE: {session_id} from {client_ip}\n", flush=True)
    await websocket.accept()
    global_connections.add(websocket)

    try:
        init_trust, base_timeout = await _ensure_session(session_id)
        print(f"[WS_ENGINE] Session initialized: trust={init_trust}, timeout={base_timeout}", flush=True)
    except Exception as e:
        import traceback
        import logging
        logging.getLogger(__name__).exception(f"FATAL: _ensure_session crashed: {e}")
        await websocket.close()
        return

    # ── Hot in-memory state (NO DB on hot path) ──
    trust_score = init_trust
    adapted_timeout = base_timeout
    remaining = adapted_timeout
    risk_level = "LOW"
    risk_factors = []

    keystroke_rhythm = trust_score
    mouse_velocity = trust_score
    scroll_pattern = trust_score
    click_pattern = trust_score
    dwell_time = trust_score

    last_mouse = time.time()
    last_key = time.time()
    session_start = time.time()

    trust_history = [trust_score] * 5
    # Use the GLOBAL shared state for client tabs and activities
    global global_tabs_state, global_client_activities
    tab_count = len(global_tabs_state)
    threats = []
    notifications = []
    nid = 0
    timeline = []
    tick = 0
    txn_counter = 0
    is_geo_anomaly = False
    is_admin = False

    # Cached DB results (refreshed every few ticks)
    cached_logs = []
    cached_txns = []
    cached_txn_dicts = []



    # ── Telemetry receiver ──
    async def receive_telemetry():
        nonlocal last_mouse, last_key, trust_score, remaining, adapted_timeout
        nonlocal tab_count, nid, notifications, base_timeout
        global global_tabs_state, global_client_activities
        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                evt = msg.get("type", "")
                tab_id = msg.get("tabId", "")
                now_str = _now()

                # ── Basic activity events ──────────────────────────────────
                if evt == "mousemove":
                    last_mouse = time.time()

                elif evt == "keydown":
                    last_key = time.time()

                elif evt == "click":
                    last_mouse = time.time()

                elif evt == "EXTEND":
                    remaining = adapted_timeout
                    last_mouse = time.time()
                    last_key = time.time()
                    nid += 1
                    notifications.append({
                        "id": nid, "type": "success",
                        "title": "Session Extended",
                        "message": f"Timer reset to {adapted_timeout // 60:02d}:{adapted_timeout % 60:02d}",
                        "time": now_str,
                    })
                    asyncio.create_task(_persist_log(session_id, "User extended session", "success"))

                elif evt == "LOGOUT":
                    asyncio.create_task(_persist_session(session_id, status="LOGGED_OUT"))
                    asyncio.create_task(_persist_log(session_id, "User requested logout", "info"))
                    try:
                        await websocket.send_text(json.dumps({"forceLogout": True}))
                    except Exception:
                        pass
                    return  # exit receive_telemetry

                elif evt == "ADMIN_CONNECT":
                    is_admin = True
                    # Admin dashboard connected — no client tab tracking needed

                elif evt == "ADMIN_KILL_SESSION":
                    if is_admin:
                        asyncio.create_task(_persist_log(session_id, f"ADMIN INITIATED SECURE FORCE KILL FOR ALL CLIENTS", "danger"))
                        global_client_activities.insert(0, {
                            "time": now_str, "tabId": "ADMIN", "ip": client_ip,
                            "event": "tab_close",
                            "detail": "ADMIN INITIATED FORCE LOGOUT ALL CLIENTS",
                        })
                        for conn in list(global_connections):
                            try:
                                await conn.send_text(json.dumps({"forceLogout": True}))
                            except Exception:
                                pass

                elif evt == "ACTIVITY":
                    last_mouse = time.time()
                    last_key = time.time()

                # ── Tab lifecycle ──────────────────────────────────────────
                elif evt == "TAB_OPEN":
                    tab_count += 1
                    global_tabs_state[tab_id] = {
                        "id": tab_id,
                        "ip": client_ip,
                        "title": msg.get("title", f"Tab {tab_count}"),
                        "route": msg.get("route", "/"),
                        "visible": msg.get("visible", True),
                        "focused": msg.get("focused", False),
                        "idle": False,
                        "lastAct": now_str,
                    }
                    global_client_activities.insert(0, {
                        "time": now_str, "tabId": tab_id, "ip": client_ip,
                        "event": "tab_open",
                        "detail": f"Opened: {msg.get('route', '/')} — {msg.get('title', 'Tab')}",
                    })
                    global_client_activities = global_client_activities[:50]
                    asyncio.create_task(_persist_log(
                        session_id,
                        f"Tab opened: {msg.get('route', '/')} [{tab_id[:8]}]",
                        "info"
                    ))

                elif evt == "TAB_CLOSE":
                    if tab_id in global_tabs_state:
                        route = global_tabs_state[tab_id].get("route", "/")
                        del global_tabs_state[tab_id]
                        tab_count = max(0, tab_count - 1)
                        global_client_activities.insert(0, {
                            "time": now_str, "tabId": tab_id, "ip": client_ip,
                            "event": "tab_close",
                            "detail": f"Closed tab: {route} [{tab_id[:8]}]",
                        })
                        asyncio.create_task(_persist_log(
                            session_id,
                            f"Tab closed: {route} [{tab_id[:8]}]",
                            "warning"
                        ))

                # ── Visibility (user switched browser tabs) ─────────────────
                elif evt == "TAB_VISIBILITY":
                    visible = msg.get("visible", True)
                    route = msg.get("route", "/")
                    title = msg.get("title", "")
                    if tab_id in global_tabs_state:
                        global_tabs_state[tab_id]["visible"] = visible
                        global_tabs_state[tab_id]["title"] = title
                        global_tabs_state[tab_id]["route"] = route
                        global_tabs_state[tab_id]["lastAct"] = now_str
                    action = "visible" if visible else "hidden"
                    global_client_activities.insert(0, {
                        "time": now_str, "tabId": tab_id, "ip": client_ip,
                        "event": "tab_visibility",
                        "detail": f"Tab {action}: {route}",
                    })
                    if not visible:
                        asyncio.create_task(_persist_log(
                            session_id,
                            f"Tab hidden — user switched away [{tab_id[:8]}]",
                            "warning"
                        ))

                # ── Window focus/blur (user alt-tabbed to another app) ─────
                elif evt == "TAB_FOCUS":
                    if tab_id in global_tabs_state:
                        global_tabs_state[tab_id]["focused"] = True
                        global_tabs_state[tab_id]["lastAct"] = now_str
                    global_client_activities.insert(0, {
                        "time": now_str, "tabId": tab_id, "ip": client_ip,
                        "event": "tab_focus",
                        "detail": f"Window focused [{tab_id[:8]}]",
                    })

                elif evt == "TAB_BLUR":
                    if tab_id in global_tabs_state:
                        global_tabs_state[tab_id]["focused"] = False
                        global_tabs_state[tab_id]["lastAct"] = now_str
                    global_client_activities.insert(0, {
                        "time": now_str, "tabId": tab_id, "ip": client_ip,
                        "event": "tab_blur",
                        "detail": f"Window lost focus [{tab_id[:8]}]",
                    })
                    asyncio.create_task(_persist_log(
                        session_id,
                        f"User alt-tabbed away [{tab_id[:8]}]",
                        "info"
                    ))

                # ── Idle / Active ─────────────────────────────────────────
                elif evt == "TAB_IDLE":
                    if tab_id in global_tabs_state:
                        global_tabs_state[tab_id]["idle"] = True
                    global_client_activities.insert(0, {
                        "time": now_str, "tabId": tab_id, "ip": client_ip,
                        "event": "tab_idle",
                        "detail": f"Tab went idle (10s no interaction)",
                    })
                    asyncio.create_task(_persist_log(
                        session_id,
                        f"Tab idle >10s [{tab_id[:8]}]",
                        "warning"
                    ))

                elif evt == "TAB_ACTIVE":
                    if tab_id in global_tabs_state:
                        global_tabs_state[tab_id]["idle"] = False
                        global_tabs_state[tab_id]["lastAct"] = now_str
                    global_client_activities.insert(0, {
                        "time": now_str, "tabId": tab_id, "ip": client_ip,
                        "event": "tab_active",
                        "detail": f"Tab became active again",
                    })

                # ── Page navigation ───────────────────────────────────────
                elif evt == "PAGE_CHANGE":
                    route = msg.get("route", "/")
                    title = msg.get("title", "")
                    if tab_id in global_tabs_state:
                        old_route = global_tabs_state[tab_id].get("route", "/")
                        global_tabs_state[tab_id]["route"] = route
                        global_tabs_state[tab_id]["title"] = title
                        global_tabs_state[tab_id]["lastAct"] = now_str
                        if old_route != route:  # only log actual navigations
                            global_client_activities.insert(0, {
                                "time": now_str, "tabId": tab_id, "ip": client_ip,
                                "event": "page_change",
                                "detail": f"{old_route} → {route}",
                            })
                            asyncio.create_task(_persist_log(
                                session_id,
                                f"Page nav: {old_route} → {route} [{tab_id[:8]}]",
                                "info"
                            ))

                elif evt == "POLICY_UPDATE":
                    new_base = msg.get("baseTimeout", 120)
                    base_timeout = new_base
                    remaining = new_base
                    nid += 1
                    notifications.append({
                        "id": nid, "type": "success",
                        "title": "Policies Deployed",
                        "message": f"Base timeout → {new_base}s",
                        "time": now_str,
                    })
                    asyncio.create_task(_persist_log(session_id, f"Policies updated — Base T/O: {new_base}s", "info"))

                # Keep activities list at 30 entries
                global_client_activities = global_client_activities[:30]

        except WebSocketDisconnect:
            pass
        except Exception:
            pass

    telemetry_task = asyncio.create_task(receive_telemetry())

    try:
        while True:
            # ▶▶▶ 1-SECOND TICK for responsive updates ◀◀◀
            await asyncio.sleep(1)
            tick += 1
            now = time.time()
            was_active = min(now - last_mouse, now - last_key) < 2  # previous state

            # ── 1. Trust score — driven by activity freshness (NO randomness) ──
            mouse_idle = now - last_mouse
            key_idle = now - last_key
            min_idle = min(mouse_idle, key_idle)

            if is_admin:
                trust_score = 100
            elif min_idle > 20:
                trust_score = max(30, trust_score - 3)
            elif min_idle > 12:
                trust_score = max(40, trust_score - 2)
            elif min_idle > 6:
                trust_score = max(50, trust_score - 1)
            elif min_idle < 2:
                trust_score = min(95, trust_score + 1)
            else:
                trust_score = trust_score  # hold steady

            # Trust score stabilized — no artificial jitter

            # ── 2. Sub-scores follow trust ──
            # Removed random jitter to prevent UI twitching; sub-scores now stable
            keystroke_rhythm = max(50, min(100, trust_score - 3))
            mouse_velocity = max(50, min(100, trust_score - 9))
            scroll_pattern = max(50, min(100, trust_score - 12))
            click_pattern = max(50, min(100, trust_score - 5))
            dwell_time = max(50, min(100, trust_score + 1))

            trust_history.append(trust_score)
            if len(trust_history) > 30:
                trust_history = trust_history[-30:]

            # ── 3. Risk engine (every 2 ticks to save CPU) ──
            if tick % 2 == 0:
                max_txn_amt = max([t.amount for t in cached_txns] + [0]) if cached_txns else 0
                ctx = RiskContext(
                    user_id="demo-user", session_id=session_id,
                    biometric_score=trust_score,
                    device_trust_score=max(50, trust_score - 10),
                    is_geo_anomaly=is_geo_anomaly,
                    is_trusted_device=True, is_off_hours=False,
                    max_active_txn_amount=max_txn_amt,
                    failed_totp_last_hour=0,
                    is_in_geo_fence=not is_geo_anomaly,
                )
                res = calculate_adapted_timeout(ctx)
                delta = res.adapted_timeout - 120
                adapted_timeout = max(45, base_timeout + delta)
                risk_level = res.risk_level
                risk_factors = res.active_factors

            # ── 4. Countdown (1 per second) ──
            currently_active = min_idle < 2
            if is_admin:
                remaining = adapted_timeout
            elif currently_active and not was_active:
                # User just came back from idle — reset timer once
                remaining = adapted_timeout
            elif not currently_active:
                remaining = max(0, remaining - 1)
            # else: currently active and was already active — hold remaining steady

            if remaining > adapted_timeout:
                remaining = adapted_timeout
            if remaining <= 0:
                asyncio.create_task(_persist_log(session_id, "Session terminated due to timeout", "danger"))
                try:
                    await websocket.send_text(json.dumps({"forceLogout": True}))
                    await asyncio.sleep(0.5)
                except Exception:
                    pass
                break

            # ── 5. DB reads — cached, refreshed every 4s ──
            if tick % 4 == 0:
                try:
                    cached_logs = await _fetch_logs(session_id, 20)
                    cached_txns = await _fetch_txns(session_id, 12)
                    cached_txn_dicts = [
                        {"id": t.id, "amount": f"₹{t.amount // 100:,}",
                         "merchant": t.merchant, "route": t.route,
                         "risk": t.risk_level, "status": t.status}
                        for t in cached_txns
                    ]
                except Exception:
                    pass

            # Timeline: just append current position
            t_out = [e for e in timeline if e.get("label") != "NOW"]
            t_out.append({"pct": 100, "label": "NOW", "icon": "●", "type": "now"})

            # ── 12. System stats (completely static to prevent UI flicker) ──
            global_system_stats["avgTrustScore"] = round(global_system_stats["avgTrustScore"] * 0.95 + trust_score * 0.05, 1)

            elapsed = int(now - session_start)
            elapsed_str = f"{elapsed // 3600:02d}:{(elapsed % 3600) // 60:02d}:{elapsed % 60:02d}"

            for tab_id, tab in global_tabs_state.items():
                if tab.get("focused") or tab.get("visible", True):
                    global_tabs_state[tab_id]["lastAct"] = _now()

            txn_volume = sum(t.amount for t in cached_txns) // 100 if cached_txns else 0

            # ── 13. Build & send payload ──
            # LIGHTWEIGHT tick: only fast-changing values (every second)
            payload = {
                "remaining": remaining,
                "expiresAt": int(time.time() * 1000) + (remaining * 1000),
                "adaptedTimeout": adapted_timeout,
                "riskLevel": risk_level,
                "biometricScore": trust_score,
                "keystrokeRhythm": keystroke_rhythm,
                "mouseVelocity": mouse_velocity,
                "scrollPattern": scroll_pattern,
                "clickPattern": click_pattern,
                "dwellTime": dwell_time,
                "showWarning": remaining <= 30,
                "isActive": mouse_idle < 10,
                "sessionElapsed": elapsed_str,
            }

            # FULL snapshot: heavy arrays only every 3 seconds to reduce React re-renders
            if tick % 3 == 0:
                tabs_list = list(global_tabs_state.values())
                payload.update({
                    "tabs": tabs_list,
                    "sessionLog": cached_logs,
                    "riskFactors": risk_factors,
                    "transactions": cached_txn_dicts,
                    "timeline": t_out,
                    "geoAnomaly": is_geo_anomaly,
                    "trustHistory": trust_history,
                    "threats": threats,
                    "systemStats": global_system_stats,
                    "notifications": notifications[-5:],
                    "txnVolume": txn_volume,
                    "clientActivities": global_client_activities[:20],
                })
                notifications = []

            # Persist snapshot (fire-and-forget, every 5s)
            if tick % 5 == 0:
                asyncio.create_task(_persist_session(
                    session_id,
                    trust_score=trust_score,
                    adapted_timeout=adapted_timeout,
                    remaining_timeout=remaining,
                    risk_level=risk_level,
                    keystroke_rhythm=keystroke_rhythm,
                    mouse_velocity=mouse_velocity,
                    scroll_pattern=scroll_pattern,
                    click_pattern=click_pattern,
                    dwell_time=dwell_time,
                    geo_anomaly=is_geo_anomaly,
                ))

            try:
                await websocket.send_text(json.dumps(payload))
            except Exception:
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[ws_engine] Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        global_connections.discard(websocket)
        telemetry_task.cancel()
        await _persist_session(session_id, status="ENDED")
        await _persist_log(session_id, "Session disconnected", "warning")
