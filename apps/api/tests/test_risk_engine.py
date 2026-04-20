"""
tests/test_risk_engine.py — Unit tests for the NEXUS TLS risk engine.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from services.risk_engine import calculate_adapted_timeout, RiskContext, RiskResult, BASE_TIMEOUT


def _ctx(**overrides) -> RiskContext:
    """Build a default RiskContext with optional overrides."""
    defaults = {
        "user_id": "test-user",
        "session_id": "test-session",
        "biometric_score": 85,
        "device_trust_score": 50,
        "is_geo_anomaly": False,
        "is_trusted_device": True,
        "is_off_hours": False,
        "max_active_txn_amount": 0,
        "failed_totp_last_hour": 0,
        "is_in_geo_fence": True,
    }
    defaults.update(overrides)
    return RiskContext(**defaults)


class TestRiskEngineBasic:
    """Basic risk engine calculations."""

    def test_default_context_low_risk(self):
        result = calculate_adapted_timeout(_ctx())
        assert result.risk_level == "LOW"
        assert result.requires_step_up is False
        assert result.adapted_timeout >= 45

    def test_returns_risk_result_type(self):
        result = calculate_adapted_timeout(_ctx())
        assert isinstance(result, RiskResult)
        assert isinstance(result.adapted_timeout, int)
        assert isinstance(result.risk_level, str)
        assert isinstance(result.active_factors, list)
        assert isinstance(result.requires_step_up, bool)

    def test_timeout_clamped_minimum(self):
        # Even with extreme risk, timeout should not go below 45s
        result = calculate_adapted_timeout(_ctx(
            biometric_score=10,
            is_geo_anomaly=True,
            is_trusted_device=False,
            is_off_hours=True,
            max_active_txn_amount=500_000_00,
            failed_totp_last_hour=5,
            is_in_geo_fence=False,
        ))
        assert result.adapted_timeout >= 45

    def test_timeout_clamped_maximum(self):
        result = calculate_adapted_timeout(_ctx(
            biometric_score=95,
            is_trusted_device=True,
            is_in_geo_fence=True,
        ))
        assert result.adapted_timeout <= 14400


class TestRiskFactors:
    """Individual risk factor evaluation."""

    def test_high_value_transaction_shortens_timeout(self):
        no_txn = calculate_adapted_timeout(_ctx(max_active_txn_amount=0))
        hi_txn = calculate_adapted_timeout(_ctx(max_active_txn_amount=500_000_00))
        assert hi_txn.adapted_timeout < no_txn.adapted_timeout

    def test_trusted_device_extends_timeout(self):
        untrusted = calculate_adapted_timeout(_ctx(is_trusted_device=False))
        trusted = calculate_adapted_timeout(_ctx(is_trusted_device=True))
        assert trusted.adapted_timeout > untrusted.adapted_timeout

    def test_off_hours_shortens_timeout(self):
        normal = calculate_adapted_timeout(_ctx(is_off_hours=False))
        off_hours = calculate_adapted_timeout(_ctx(is_off_hours=True))
        assert off_hours.adapted_timeout < normal.adapted_timeout

    def test_geo_fence_extends_timeout(self):
        outside = calculate_adapted_timeout(_ctx(is_in_geo_fence=False))
        inside = calculate_adapted_timeout(_ctx(is_in_geo_fence=True))
        assert inside.adapted_timeout > outside.adapted_timeout

    def test_geo_anomaly_shortens_and_requires_step_up(self):
        normal = calculate_adapted_timeout(_ctx(is_geo_anomaly=False))
        anomaly = calculate_adapted_timeout(_ctx(is_geo_anomaly=True))
        assert anomaly.adapted_timeout < normal.adapted_timeout
        assert anomaly.requires_step_up is True

    def test_high_biometric_extends_timeout(self):
        low = calculate_adapted_timeout(_ctx(biometric_score=50))
        high = calculate_adapted_timeout(_ctx(biometric_score=90))
        assert high.adapted_timeout > low.adapted_timeout

    def test_low_biometric_shortens_timeout(self):
        high = calculate_adapted_timeout(_ctx(biometric_score=90))
        low = calculate_adapted_timeout(_ctx(biometric_score=40))
        assert low.adapted_timeout < high.adapted_timeout

    def test_very_low_biometric_requires_step_up(self):
        result = calculate_adapted_timeout(_ctx(biometric_score=30))
        assert result.requires_step_up is True

    def test_totp_failures_require_step_up(self):
        result = calculate_adapted_timeout(_ctx(failed_totp_last_hour=5))
        assert result.requires_step_up is True


class TestRiskLevels:
    """Risk level classification."""

    def test_low_risk(self):
        result = calculate_adapted_timeout(_ctx(
            biometric_score=95,
            is_trusted_device=True,
            is_in_geo_fence=True,
        ))
        assert result.risk_level == "LOW"

    def test_medium_risk(self):
        result = calculate_adapted_timeout(_ctx(
            biometric_score=50,
            is_trusted_device=False,
            is_in_geo_fence=False,
            is_off_hours=True,
        ))
        assert result.risk_level == "MEDIUM"

    def test_high_risk(self):
        result = calculate_adapted_timeout(_ctx(
            biometric_score=30,
            is_geo_anomaly=True,
            is_trusted_device=False,
            is_off_hours=True,
            max_active_txn_amount=500_000_00,
        ))
        assert result.risk_level == "HIGH"


class TestRiskFactorsOutput:
    """Risk factor labels in output."""

    def test_factors_contain_labels(self):
        result = calculate_adapted_timeout(_ctx(
            is_trusted_device=True,
            is_in_geo_fence=True,
            biometric_score=90,
        ))
        labels = [f["label"] for f in result.active_factors]
        assert "Trusted device" in labels
        assert "Within geo-fence" in labels
        assert "High biometric confidence" in labels

    def test_high_txn_factor_appears(self):
        result = calculate_adapted_timeout(_ctx(max_active_txn_amount=500_000_00))
        labels = [f["label"] for f in result.active_factors]
        assert any("TXN" in l or "txn" in l.lower() for l in labels)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
