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
    print(f"\n[WS_ENGINE] => CLIENT CONNECTED TO REAL ENGINE: {session_id}\n", flush=True)
    await websocket.accept()

    try:
        init_trust, base_timeout = await _ensure_session(session_id)
        print(f"[WS_ENGINE] Session initialized: trust={init_trust}, timeout={base_timeout}", flush=True)
    except Exception as e:
        import traceback
        with open("C:/tmp/ws_crash.log", "w") as f:
            f.write(f"FATAL: _ensure_session crashed: {e}\n")
            traceback.print_exc(file=f)
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
    tabs = []
    tab_count = 0
    threats = []
    notifications = []
    nid = 0
    timeline = []
    tick = 0
    txn_counter = 0
    is_geo_anomaly = False

    # Cached DB results (refreshed every few ticks)
    cached_logs = []
    cached_txns = []
    cached_txn_dicts = []

    system_stats = {
        "uptime": 99.98,
        "activeSessions": random.randint(148, 210),
        "avgTrustScore": float(trust_score),
        "p95Latency": round(random.uniform(12, 22), 1),
        "totalRequests": random.randint(40000, 80000),
        "blockedThreats": random.randint(18, 40),
    }

    # ── Telemetry receiver ──
    async def receive_telemetry():
        nonlocal last_mouse, last_key, trust_score, remaining, adapted_timeout
        nonlocal tab_count, tabs, nid, notifications, base_timeout
        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                evt = msg.get("type", "")

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
                        "time": _now(),
                    })
                    asyncio.create_task(_persist_log(session_id, "User extended session", "success"))

                elif evt == "ACTIVITY":
                    last_mouse = time.time()
                    last_key = time.time()

                elif evt == "TAB_OPEN":
                    tid = msg.get("tabId", f"tab-{tab_count + 1}")
                    if not any(t["id"] == tid for t in tabs):
                        tab_count += 1
                        tabs.append({"id": tid, "title": msg.get("title", "Tab"),
                                     "route": msg.get("route", "/"), "active": False,
                                     "idle": False, "lastAct": _now()})

                elif evt == "TAB_CLOSE":
                    tid = msg.get("tabId")
                    tabs = [t for t in tabs if t["id"] != tid]
                    tab_count = max(1, tab_count - 1)

                elif evt == "POLICY_UPDATE":
                    new_base = msg.get("baseTimeout", 120)
                    base_timeout = new_base
                    remaining = new_base
                    nid += 1
                    notifications.append({
                        "id": nid, "type": "success",
                        "title": "Policies Deployed",
                        "message": f"Base timeout → {new_base}s",
                        "time": _now(),
                    })
                    asyncio.create_task(_persist_log(session_id, f"Policies updated — Base T/O: {new_base}s", "info"))

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

            # ── 1. Trust score — driven by activity freshness ──
            mouse_idle = now - last_mouse
            key_idle = now - last_key
            min_idle = min(mouse_idle, key_idle)

            if min_idle > 20:
                trust_score = max(30, trust_score - 3)
            elif min_idle > 12:
                trust_score = max(40, trust_score - 2)
            elif min_idle > 6:
                trust_score = max(50, trust_score + random.choice([-1, -1, 0]))
            elif min_idle < 2:
                trust_score = min(95, trust_score + random.choice([0, 1, 1, 2]))
            else:
                trust_score = max(55, min(95, trust_score + random.choice([-1, 0, 0, 1])))

            # Natural jitter so graph always moves
            trust_score = max(30, min(98, trust_score + random.choice([-1, 0, 0, 0, 1])))

            # ── 2. Sub-scores follow trust ──
            keystroke_rhythm = max(50, min(100, trust_score + random.randint(-6, 6)))
            mouse_velocity   = max(50, min(100, trust_score + random.randint(-8, 8)))
            scroll_pattern   = max(50, min(100, trust_score + random.randint(-4, 4)))
            click_pattern    = max(50, min(100, trust_score + random.randint(-3, 5)))
            dwell_time       = max(55, min(100, trust_score + random.randint(-3, 6)))

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
            if min_idle < 2:
                remaining = adapted_timeout
            else:
                remaining = max(0, remaining - 1)
            
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

            # ── 6. Generate transactions (every 15s) ──
            if tick % 15 == 0:
                txn_counter += 1
                is_high = random.random() < 0.15
                amt = random.randint(500, 5000000)
                txn_id = f"TXN-{txn_counter:04d}"
                merchant = random.choice(MERCHANTS)
                route = random.choice(ROUTES)
                r_lvl = "HIGH" if is_high else random.choice(["LOW", "LOW", "MEDIUM"])
                status = random.choice(["FLAGGED", "BLOCKED"]) if is_high else random.choice(["CLEARED", "IN_TRANSIT", "DELIVERED"])
                asyncio.create_task(_persist_txn(session_id, txn_id, amt, merchant, route, r_lvl, status))
                if is_high:
                    nid += 1
                    notifications.append({"id": nid, "type": "danger",
                                          "title": "High-Risk Transaction",
                                          "message": f"{txn_id} — ₹{amt // 100:,} flagged", "time": _now()})
                    asyncio.create_task(_persist_log(session_id, f"TXN {txn_id} flagged (₹{amt // 100:,})", "danger"))

            # ── 7. Generate audit log (every 6s) ──
            if tick % 6 == 0:
                log_msgs = [
                    ("JWT rotated", "info"), ("2FA TOTP verified", "success"),
                    (f"Biometric trust: {trust_score}", "info"), ("Heartbeat OK", "info"),
                    (f"Risk: {risk_level}", "warning" if risk_level != "LOW" else "info"),
                ]
                msg_text, msg_type = random.choice(log_msgs)
                asyncio.create_task(_persist_log(session_id, msg_text, msg_type))

            # ── 8. Threats (every 10s) ──
            if tick % 10 == 0:
                detail, severity = random.choice(THREAT_TYPES)
                threats.insert(0, {
                    "ip": f"{random.randint(1,254)}.{random.randint(0,254)}.{random.randint(0,254)}.{random.randint(1,254)}",
                    "city": random.choice(THREAT_CITIES), "detail": detail,
                    "severity": severity, "time": _now(),
                    "blocked": severity in ("CRITICAL", "HIGH"),
                })
                threats = threats[:15]
                if severity == "CRITICAL":
                    nid += 1
                    notifications.append({"id": nid, "type": "danger",
                                          "title": "Critical Threat", "message": detail[:60], "time": _now()})

            # ── 9. Geo anomaly (every 30s) ──
            if tick % 30 == 0:
                is_geo_anomaly = random.random() < 0.12
                if is_geo_anomaly:
                    nid += 1
                    notifications.append({"id": nid, "type": "warning",
                                          "title": "Geo Anomaly",
                                          "message": f"Login from {random.choice(THREAT_CITIES)}", "time": _now()})

            # ── 10. Trust warning ──
            if trust_score < 55 and tick % 8 == 0:
                nid += 1
                notifications.append({"id": nid, "type": "warning",
                                      "title": "Trust Score Low",
                                      "message": f"Score: {trust_score} — step-up may trigger", "time": _now()})

            # ── 11. Timeline ──
            if tick % 12 == 0 and len(timeline) < 12:
                icons = [("Auth Check", "🔑", "info"), ("Heartbeat", "♥", "success"),
                         ("Risk Eval", "⚡", "warning"), ("Token Rotate", "🔄", "info")]
                choice = random.choice(icons)
                pct = min(95, len(timeline) * 9 + random.randint(0, 6))
                timeline.append({"pct": pct, "label": choice[0], "icon": choice[1], "type": choice[2]})

            t_out = [e for e in timeline if e.get("label") != "NOW"]
            t_out.append({"pct": 100, "label": "NOW", "icon": "●", "type": "now"})

            # ── 12. System stats ──
            system_stats["activeSessions"] = max(80, min(260, system_stats["activeSessions"] + random.randint(-2, 2)))
            system_stats["avgTrustScore"] = round(system_stats["avgTrustScore"] * 0.9 + trust_score * 0.1, 1)
            system_stats["p95Latency"] = round(max(8, min(40, system_stats["p95Latency"] + random.uniform(-1, 1))), 1)
            system_stats["totalRequests"] += random.randint(15, 50)
            system_stats["blockedThreats"] += (1 if tick % 10 == 0 else 0)

            elapsed = int(now - session_start)
            elapsed_str = f"{elapsed // 3600:02d}:{(elapsed % 3600) // 60:02d}:{elapsed % 60:02d}"

            for tab in tabs:
                if tab["active"]:
                    tab["lastAct"] = _now()

            txn_volume = sum(t.amount for t in cached_txns) // 100 if cached_txns else 0

            # ── 13. Build & send payload ──
            payload = {
                "remaining": remaining,
                "adaptedTimeout": adapted_timeout,
                "riskLevel": risk_level,
                "biometricScore": trust_score,
                "keystrokeRhythm": keystroke_rhythm,
                "mouseVelocity": mouse_velocity,
                "scrollPattern": scroll_pattern,
                "clickPattern": click_pattern,
                "dwellTime": dwell_time,
                "tabs": tabs,
                "sessionLog": cached_logs,
                "riskFactors": risk_factors,
                "transactions": cached_txn_dicts,
                "timeline": t_out,
                "geoAnomaly": is_geo_anomaly,
                "showWarning": remaining <= 30,
                "isActive": mouse_idle < 10,
                "trustHistory": trust_history,
                "threats": threats,
                "systemStats": system_stats,
                "notifications": notifications[-5:],
                "sessionElapsed": elapsed_str,
                "txnVolume": txn_volume,
            }
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
        telemetry_task.cancel()
        await _persist_session(session_id, status="ENDED")
        await _persist_log(session_id, "Session disconnected", "warning")
