from fastapi import APIRouter, Depends, Request
from services.risk_engine import calculate_adapted_timeout, RiskContext

router = APIRouter(prefix="/api/risk", tags=["risk"])

@router.post("/score")
async def compute_risk_score(request: Request):
    """Compute risk score from a provided context payload"""
    body = await request.json()
    ctx = RiskContext(
        user_id=body.get("user_id", "unknown"),
        session_id=body.get("session_id", "unknown"),
        biometric_score=body.get("biometric_score", 100),
        device_trust_score=body.get("device_trust_score", 50),
        is_geo_anomaly=body.get("is_geo_anomaly", False),
        is_trusted_device=body.get("is_trusted_device", True),
        is_off_hours=body.get("is_off_hours", False),
        max_active_txn_amount=body.get("max_active_txn_amount", 0),
        failed_totp_last_hour=body.get("failed_totp_last_hour", 0),
        is_in_geo_fence=body.get("is_in_geo_fence", True),
    )
    result = calculate_adapted_timeout(ctx)
    return {
        "adapted_timeout": result.adapted_timeout,
        "risk_level": result.risk_level,
        "active_factors": result.active_factors,
        "requires_step_up": result.requires_step_up,
    }
