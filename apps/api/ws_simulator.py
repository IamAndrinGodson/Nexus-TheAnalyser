# ws_simulator.py — FastAPI WebSocket router for real-time dashboard simulation
import asyncio
import json
import random
import time
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.risk_engine import calculate_adapted_timeout, RiskContext

router = APIRouter()

# ─── Helpers ──────────────────────────────────────────────────────────────────

ROUTES = ["MUM→DEL", "BLR→HYD", "CHE→PUN", "KOL→MUM", "DEL→NCR", "HYD→BLR", "PUN→MUM", "NCR→KOL"]
TXN_TYPES = ["Freight Transfer", "Cold Chain", "Express Courier", "Bulk Cargo", "Last Mile Delivery", "Tanker Fuel", "Pharma Express", "E-Commerce"]
STATUSES = ["CLEARED", "DELIVERED", "IN TRANSIT", "FLAGGED"]
RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"]
LOG_TEMPLATES = [
    ("TXN-{txn} authorized — ₹{amt} cleared", "success"),
    ("2FA TOTP verified — device fingerprint matched", "info"),
    ("JWT rotated — new token issued", "info"),
    ("Cold chain anomaly acknowledged by manager", "warn"),
    ("Heartbeat OK — risk: {risk}", "info"),
    ("Geo-fence perimeter check passed", "success"),
    ("Biometric score refreshed: {score}", "info"),
    ("Rate limiter: 42 req/min — within threshold", "info"),
    ("Suspicious IP blocked — 203.0.113.x", "warn"),
    ("Session token refreshed — SameSite=Strict", "success"),
]
TIMELINE_ICONS = [
    ("Login", "🔑", "success"),
    ("2FA OK", "✓", "success"),
    ("JWT Rot.", "↺", "info"),
    ("TXN", "⬡", "info"),
    ("Warning", "⚠", "warn"),
    ("Extend", "↑", "success"),
    ("TXN Flag", "◆", "warn"),
    ("Geo Check", "🗺", "info"),
    ("Bio Scan", "🧬", "info"),
]
THREAT_TEMPLATES = [
    {"action": "BLOCKED", "severity": "HIGH", "detail": "Brute-force SSH attempt from {ip}"},
    {"action": "FLAGGED", "severity": "MEDIUM", "detail": "Geo-fence violation — login from {city}"},
    {"action": "BLOCKED", "severity": "CRITICAL", "detail": "SQL injection payload in query param"},
    {"action": "MONITORED", "severity": "LOW", "detail": "Unusual API rate from {ip}"},
    {"action": "BLOCKED", "severity": "HIGH", "detail": "Invalid JWT replay attempt"},
    {"action": "FLAGGED", "severity": "MEDIUM", "detail": "Device fingerprint mismatch"},
    {"action": "BLOCKED", "severity": "CRITICAL", "detail": "XSS payload detected in form input"},
    {"action": "MONITORED", "severity": "LOW", "detail": "Elevated error rate on /api/session"},
    {"action": "FLAGGED", "severity": "HIGH", "detail": "TLS downgrade attempt from proxy"},
    {"action": "BLOCKED", "severity": "MEDIUM", "detail": "Credential stuffing pattern from {ip}"},
]
THREAT_IPS = ["203.0.113.42", "198.51.100.77", "192.0.2.91", "10.255.0.13", "172.16.99.5", "45.33.32.156"]
THREAT_CITIES = ["Lagos", "Minsk", "Unknown VPN", "São Paulo", "Pyongyang"]


def _now() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _rand_amount() -> str:
    val = random.choice([6750, 18250, 123500, 482000, 994000, 35000, 72000, 215000])
    return f"₹{val:,}"


def _rand_amount_paise(amount_str: str) -> int:
    """Convert display amount to paise for risk engine."""
    cleaned = amount_str.replace("₹", "").replace(",", "")
    return int(cleaned) * 100


def _generate_txn(counter: int) -> dict:
    txn_id = f"TXN-{9800 + counter}"
    risk = random.choices(RISK_LEVELS, weights=[60, 30, 10])[0]
    status = random.choices(STATUSES, weights=[40, 25, 25, 10])[0]
    if risk == "HIGH":
        status = random.choice(["FLAGGED", "IN TRANSIT"])
    return {
        "id": txn_id,
        "type": random.choice(TXN_TYPES),
        "amount": _rand_amount(),
        "risk": risk,
        "status": status,
        "route": random.choice(ROUTES),
        "time": _now()[:5],
    }


def _generate_log(trust_score: int, risk_level: str, txn_counter: int) -> dict:
    template, log_type = random.choice(LOG_TEMPLATES)
    msg = template.format(
        txn=9800 + txn_counter,
        amt=_rand_amount(),
        risk=risk_level,
        score=trust_score,
    )
    return {"t": _now(), "msg": msg, "type": log_type}


def _generate_threat() -> dict:
    tpl = random.choice(THREAT_TEMPLATES)
    return {
        "time": _now(),
        "action": tpl["action"],
        "severity": tpl["severity"],
        "detail": tpl["detail"].format(
            ip=random.choice(THREAT_IPS),
            city=random.choice(THREAT_CITIES),
        ),
        "source": random.choice(THREAT_IPS),
    }


# ─── WebSocket endpoint ──────────────────────────────────────────────────────

@router.websocket("/ws/session/{session_id}")
async def ws_session(websocket: WebSocket, session_id: str):
    await websocket.accept()

    # ── Initial simulated state ──
    trust_score = 91
    keystroke_rhythm = 88
    mouse_velocity = 82
    scroll_pattern = 79
    click_pattern = 88
    dwell_time = 92
    remaining = 120
    tab_count = 1
    txn_counter = 0
    is_geo_anomaly = False
    is_off_hours = False
    last_mouse_event = time.time()
    last_key_event = time.time()
    session_start = time.time()

    # Seed initial data
    transactions = [_generate_txn(i) for i in range(5)]
    txn_counter = 5

    logs = [
        {"t": _now(), "msg": "Session opened — NEXUS TLS v2", "type": "success"},
        {"t": _now(), "msg": "2FA TOTP verified — device fingerprint matched", "type": "info"},
    ]

    timeline = [
        {"pct": 0, "label": "Login", "icon": "🔑", "type": "success"},
        {"pct": 12, "label": "2FA OK", "icon": "✓", "type": "success"},
    ]

    tabs = [
        {"id": "tab-1", "title": "Dashboard", "route": "/dashboard", "active": True, "idle": False, "lastAct": _now()},
    ]

    # Trust score history for area chart (last 30 points)
    trust_history = [trust_score] * 5

    # Threat feed
    threats = [_generate_threat() for _ in range(3)]

    # Notification queue
    notifications = []
    notification_id = 0

    # System-wide stats (simulated)
    system_stats = {
        "uptime": 99.97,
        "activeSessions": random.randint(142, 196),
        "avgTrustScore": trust_score,
        "p95Latency": round(random.uniform(12, 28), 1),
        "totalRequests": random.randint(45000, 62000),
        "blockedThreats": random.randint(12, 34),
    }

    tick = 0

    # ── Telemetry receiver (runs concurrently) ──
    async def receive_telemetry():
        nonlocal trust_score, last_mouse_event, last_key_event, tab_count, tabs, remaining
        nonlocal notification_id, notifications
        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                evt_type = msg.get("type", "")

                if evt_type == "mousemove":
                    last_mouse_event = time.time()
                    trust_score = min(99, trust_score + random.choice([0, 0, 1]))
                    remaining = max(remaining, adapted_timeout)

                elif evt_type == "keydown":
                    last_key_event = time.time()
                    trust_score = min(99, trust_score + random.choice([0, 1]))
                    remaining = max(remaining, adapted_timeout)

                elif evt_type == "EXTEND":
                    remaining = adapted_timeout
                    last_mouse_event = time.time()
                    last_key_event = time.time()
                    notification_id += 1
                    notifications.append({
                        "id": notification_id,
                        "type": "success",
                        "title": "Session Extended",
                        "message": f"Timer reset to {adapted_timeout//60:02d}:{adapted_timeout%60:02d} (adapted)",
                        "time": _now(),
                    })

                elif evt_type == "ACTIVITY":
                    last_mouse_event = time.time()
                    last_key_event = time.time()
                    remaining = max(remaining, adapted_timeout)

                elif evt_type == "TAB_OPEN":
                    tab_id = msg.get("tabId", f"tab-{tab_count + 1}")
                    if any(t["id"] == tab_id for t in tabs):
                        continue
                    tab_count += 1
                    tabs.append({
                        "id": tab_id,
                        "title": msg.get("title", "New Tab"),
                        "route": msg.get("route", "/unknown"),
                        "active": False,
                        "idle": False,
                        "lastAct": _now(),
                    })

                elif evt_type == "TAB_CLOSE":
                    tab_id = msg.get("tabId")
                    tabs = [t for t in tabs if t["id"] != tab_id]
                    tab_count = max(1, tab_count - 1)

                elif evt_type == "POLICY_UPDATE":
                    # Update base timeout dynamically
                    new_base = msg.get("baseTimeout", 120)
                    remaining = new_base
                    
                    # Log the change
                    notification_id += 1
                    notifications.append({
                        "id": notification_id,
                        "type": "success",
                        "title": "Policies Deployed",
                        "message": f"Base timeout set to {new_base}m. Bio drop at {msg.get('bioDrop', 60)}.",
                        "time": _now(),
                    })
                    
                    logs.insert(0, {
                        "t": _now(),
                        "msg": f"Global policies updated by admin — Base T/O: {new_base}m",
                        "type": "info"
                    })
                    logs = logs[:20]

        except WebSocketDisconnect:
            pass
        except Exception:
            pass

    # Start telemetry receiver as a background task
    telemetry_task = asyncio.create_task(receive_telemetry())

    try:
        while True:
            await asyncio.sleep(2)
            tick += 1

            # ── Trust score drift based on activity ──
            now = time.time()
            mouse_idle = now - last_mouse_event
            key_idle = now - last_key_event

            if mouse_idle > 10:
                drift = random.choice([-2, -1, -1, -1, 0])
                trust_score = max(30, trust_score + drift)
            elif mouse_idle > 5:
                drift = random.choice([-1, 0, 0, 0])
                trust_score = max(40, trust_score + drift)
            else:
                drift = random.choice([0, 0, 0, 1])
                trust_score = min(99, trust_score + drift)

            # Sub-scores follow trust with variance
            keystroke_rhythm = max(50, min(99, trust_score + random.randint(-8, 8)))
            mouse_velocity = max(50, min(99, trust_score + random.randint(-10, 10)))
            scroll_pattern = max(50, min(99, trust_score + random.randint(-6, 6)))
            click_pattern = max(50, min(99, trust_score + random.randint(-5, 7)))
            dwell_time = max(55, min(99, trust_score + random.randint(-3, 9)))

            # ── Trust history (for chart) ──
            trust_history.append(trust_score)
            if len(trust_history) > 30:
                trust_history = trust_history[-30:]

            # ── Occasionally toggle geo anomaly or off-hours ──
            if tick % 15 == 0:
                is_geo_anomaly = random.random() < 0.15
                if is_geo_anomaly:
                    notification_id += 1
                    notifications.append({
                        "id": notification_id,
                        "type": "warning",
                        "title": "Geo Anomaly Detected",
                        "message": f"Login attempt from {random.choice(THREAT_CITIES)}",
                        "time": _now(),
                    })
            if tick % 20 == 0:
                is_off_hours = random.random() < 0.2

            # ── Get the highest active txn amount for risk engine ──
            max_txn_amount = 0
            for txn in transactions:
                try:
                    max_txn_amount = max(max_txn_amount, _rand_amount_paise(txn["amount"]))
                except (ValueError, KeyError):
                    pass

            # ── Call the real risk engine ──
            ctx = RiskContext(
                user_id="demo-user",
                session_id=session_id,
                biometric_score=trust_score,
                device_trust_score=min(80, trust_score - 10),
                is_geo_anomaly=is_geo_anomaly,
                is_trusted_device=True,
                is_off_hours=is_off_hours,
                max_active_txn_amount=max_txn_amount,
                failed_totp_last_hour=0,
                is_in_geo_fence=not is_geo_anomaly,
            )
            result = calculate_adapted_timeout(ctx)

            adapted_timeout = result.adapted_timeout
            risk_level = result.risk_level
            risk_factors = result.active_factors

            # ── Countdown timer ──
            remaining = max(0, remaining - 2)
            if remaining <= 0:
                remaining = adapted_timeout  # auto-extend in demo mode

            # ── Generate new transaction occasionally ──
            if tick % 3 == 0:
                txn_counter += 1
                new_txn = _generate_txn(txn_counter)
                transactions.insert(0, new_txn)
                transactions = transactions[:12]  # keep last 12

                # Notification for high-risk TXN
                if new_txn["risk"] == "HIGH":
                    notification_id += 1
                    notifications.append({
                        "id": notification_id,
                        "type": "danger",
                        "title": "High-Risk Transaction",
                        "message": f"{new_txn['id']} — {new_txn['amount']} flagged",
                        "time": _now(),
                    })

            # ── Generate new log entry every tick ──
            new_log = _generate_log(trust_score, risk_level, txn_counter)
            logs.insert(0, new_log)
            logs = logs[:20]

            # ── Threat feed (new threat every ~5 ticks) ──
            if tick % 5 == 0:
                new_threat = _generate_threat()
                threats.insert(0, new_threat)
                threats = threats[:15]

                if new_threat["severity"] == "CRITICAL":
                    notification_id += 1
                    notifications.append({
                        "id": notification_id,
                        "type": "danger",
                        "title": "Critical Threat",
                        "message": new_threat["detail"][:60],
                        "time": _now(),
                    })

            # ── Trust score drop notification ──
            if trust_score < 60 and tick % 4 == 0:
                notification_id += 1
                notifications.append({
                    "id": notification_id,
                    "type": "warning",
                    "title": "Trust Score Low",
                    "message": f"Biometric score dropped to {trust_score} — step-up auth may trigger",
                    "time": _now(),
                })

            # ── Grow timeline ──
            if tick % 5 == 0 and len(timeline) < 12:
                choice = random.choice(TIMELINE_ICONS)
                pct = min(95, len(timeline) * 10 + random.randint(0, 8))
                timeline.append({"pct": pct, "label": choice[0], "icon": choice[1], "type": choice[2]})

            # Ensure "NOW" marker is always at the end
            timeline_out = [e for e in timeline if e.get("label") != "NOW"]
            timeline_out.append({"pct": 100, "label": "NOW", "icon": "●", "type": "now"})

            # ── Update tab activity timestamps ──
            for tab in tabs:
                if tab["active"]:
                    tab["lastAct"] = _now()

            # ── System stats drift ──
            system_stats["activeSessions"] = max(80, min(250, system_stats["activeSessions"] + random.randint(-3, 3)))
            system_stats["avgTrustScore"] = round((system_stats["avgTrustScore"] * 0.9 + trust_score * 0.1), 1)
            system_stats["p95Latency"] = round(max(8, min(45, system_stats["p95Latency"] + random.uniform(-2, 2))), 1)
            system_stats["totalRequests"] += random.randint(20, 80)
            system_stats["blockedThreats"] += (1 if tick % 5 == 0 else 0)

            # ── Session elapsed ──
            elapsed = int(now - session_start)
            elapsed_str = f"{elapsed // 3600:02d}:{(elapsed % 3600) // 60:02d}:{elapsed % 60:02d}"

            # ── Transaction volume (sum of current TXNs) ──
            txn_volume = 0
            for txn in transactions:
                try:
                    txn_volume += _rand_amount_paise(txn["amount"]) // 100
                except (ValueError, KeyError):
                    pass

            # ── Build payload ──
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
                "sessionLog": [{"t": l["t"], "msg": l["msg"], "type": l["type"]} for l in logs],
                "riskFactors": risk_factors,
                "transactions": transactions,
                "timeline": timeline_out,
                "geoAnomaly": is_geo_anomaly,
                "showWarning": remaining <= 30,
                "isActive": mouse_idle < 10,
                # New business-class fields
                "trustHistory": trust_history,
                "threats": threats,
                "systemStats": system_stats,
                "notifications": notifications[-5:],  # last 5 pending
                "sessionElapsed": elapsed_str,
                "txnVolume": txn_volume,
            }

            # Clear delivered notifications
            notifications = []

            try:
                await websocket.send_text(json.dumps(payload))
            except Exception:
                break

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        telemetry_task.cancel()
        try:
            await telemetry_task
        except asyncio.CancelledError:
            pass
