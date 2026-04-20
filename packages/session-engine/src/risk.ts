// packages/session-engine/src/risk.ts — Client-side risk calculation

const BASE_TIMEOUT = 120; // seconds

export interface RiskContext {
    biometricScore: number;        // 0–100
    deviceTrustScore: number;      // 0–80
    isGeoAnomaly: boolean;
    isTrustedDevice: boolean;
    isOffHours: boolean;           // outside 09:00–19:00
    maxActiveTxnAmount: number;    // in paise
    failedTotpLastHour: number;
    isInGeoFence: boolean;
}

export interface RiskResult {
    adaptedTimeout: number;        // seconds
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    activeFactors: Array<{ label: string; impact: "+" | "-"; delta: number }>;
    requiresStepUp: boolean;
}

export function calculateRisk(ctx: RiskContext): RiskResult {
    let delta = 0;
    const factors: RiskResult["activeFactors"] = [];
    let requiresStepUp = false;

    // High-value transaction shortens timeout
    if (ctx.maxActiveTxnAmount > 40_000_00) { // > ₹4,00,000
        delta -= 30;
        factors.push({ label: "Active TXN > ₹4L", impact: "+", delta: 30 });
    }

    // Trusted device relaxes timeout
    if (ctx.isTrustedDevice) {
        delta += 45;
        factors.push({ label: "Trusted device", impact: "-", delta: 45 });
    }

    // Off-hours tightens timeout
    if (ctx.isOffHours) {
        delta -= 10;
        factors.push({ label: "Off-hours access", impact: "+", delta: 10 });
    }

    // In geo-fence relaxes timeout
    if (ctx.isInGeoFence) {
        delta += 20;
        factors.push({ label: "Within geo-fence", impact: "-", delta: 20 });
    }

    // Geo anomaly shortens significantly
    if (ctx.isGeoAnomaly) {
        delta -= 45;
        requiresStepUp = true;
        factors.push({ label: "Geo anomaly detected", impact: "+", delta: 45 });
    }

    // Biometric confidence
    if (ctx.biometricScore >= 85) {
        delta += 30;
        factors.push({ label: "High biometric confidence", impact: "-", delta: 30 });
    } else if (ctx.biometricScore < 65) {
        delta -= 20;
        factors.push({ label: "Low biometric score", impact: "+", delta: 20 });
        if (ctx.biometricScore < 40) {
            requiresStepUp = true;
        }
    }

    // Recent TOTP failures
    if (ctx.failedTotpLastHour >= 3) {
        delta -= 45;
        requiresStepUp = true;
        factors.push({ label: "Multiple TOTP failures", impact: "+", delta: 45 });
    }

    const adaptedTimeout = Math.max(45, Math.min(14400, BASE_TIMEOUT + delta)); // clamp 45s – 4h

    const riskScore = -delta;
    const riskLevel: RiskResult["riskLevel"] =
        riskScore <= 0 ? "LOW" : riskScore <= 40 ? "MEDIUM" : "HIGH";

    return {
        adaptedTimeout,
        riskLevel,
        activeFactors: factors,
        requiresStepUp,
    };
}
