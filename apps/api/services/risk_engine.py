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
