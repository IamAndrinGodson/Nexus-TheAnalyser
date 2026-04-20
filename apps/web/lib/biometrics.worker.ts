// lib/biometrics.worker.ts — Web Worker for behavioral biometrics scoring
// Runs in a Web Worker — no DOM access, pure computation

interface BiometricSample {
    type: "key" | "mouse" | "scroll" | "click";
    timestamp: number;
    value: number;
}

const samples: BiometricSample[] = [];
let lastKeyTime = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let lastMouseTime = 0;
const clickTimes: number[] = [];

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
        lastMouseX = x;
        lastMouseY = y;
        lastMouseTime = timestamp;
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
        const idx = samples.findIndex((s) => s.timestamp > cutoff);
        if (idx > 0) samples.splice(0, idx);
    }
};

function computeScore(): number {
    if (samples.length < 10) return 90; // Not enough data — assume legitimate

    const keySamples = samples
        .filter((s) => s.type === "key")
        .map((s) => s.value);
    const mouseSamples = samples
        .filter((s) => s.type === "mouse")
        .map((s) => s.value);

    // Keystroke cadence consistency
    const keyScore =
        keySamples.length > 5
            ? Math.max(0, 100 - coefficientOfVariation(keySamples) * 100)
            : 90;

    // Mouse velocity normality
    const mouseScore =
        mouseSamples.length > 5
            ? Math.max(
                0,
                100 - Math.abs(coefficientOfVariation(mouseSamples) - 0.4) * 150
            )
            : 85;

    // Click rhythm
    const clickDeltas = clickTimes
        .slice(1)
        .map((t, i) => t - clickTimes[i]);
    const clickScore =
        clickDeltas.length > 3
            ? Math.max(0, 100 - coefficientOfVariation(clickDeltas) * 80)
            : 90;

    // Weighted composite
    const composite = keyScore * 0.35 + mouseScore * 0.35 + clickScore * 0.3;
    return Math.round(Math.max(0, Math.min(100, composite)));
}

function coefficientOfVariation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return 0;
    const variance =
        values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
}

// Trigger score computation every 10 seconds
setInterval(() => self.postMessage({ type: "REQUEST_SCORE" }), 10_000);
