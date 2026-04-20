// packages/biometrics/src/scoring.ts — Statistical scoring functions

/**
 * Coefficient of Variation: std_dev / mean
 * Used to measure consistency of behavioral patterns
 */
export function coefficientOfVariation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return 0;
    const variance =
        values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
}

/**
 * Score keystroke cadence consistency
 * Lower variance in typing rhythm = higher score (more consistent = more likely same user)
 */
export function scoreKeystrokeCadence(interKeyDeltas: number[]): number {
    if (interKeyDeltas.length < 5) return 90; // insufficient data
    return Math.max(0, 100 - coefficientOfVariation(interKeyDeltas) * 100);
}

/**
 * Score mouse velocity normality
 * Detects robotic (too even) or chaotic (too varied) movement
 * Optimal CV is around 0.4 for natural human mouse movement
 */
export function scoreMouseVelocity(velocities: number[]): number {
    if (velocities.length < 5) return 85;
    const cv = coefficientOfVariation(velocities);
    return Math.max(0, 100 - Math.abs(cv - 0.4) * 150);
}

/**
 * Score click rhythm consistency
 */
export function scoreClickRhythm(clickDeltas: number[]): number {
    if (clickDeltas.length < 3) return 90;
    return Math.max(0, 100 - coefficientOfVariation(clickDeltas) * 80);
}

/**
 * Compute weighted composite biometric score
 */
export function computeCompositeScore(params: {
    keystrokeScore: number;
    mouseScore: number;
    clickScore: number;
    scrollScore?: number;
    dwellScore?: number;
}): number {
    const {
        keystrokeScore,
        mouseScore,
        clickScore,
        scrollScore = 85,
        dwellScore = 90,
    } = params;

    // Weighted composite matching the guide's weights:
    // Keystroke: 25%, Mouse: 25%, Scroll: 20%, Click: 15%, Dwell: 15%
    const composite =
        keystrokeScore * 0.25 +
        mouseScore * 0.25 +
        scrollScore * 0.2 +
        clickScore * 0.15 +
        dwellScore * 0.15;

    return Math.round(Math.max(0, Math.min(100, composite)));
}
