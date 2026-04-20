// packages/biometrics/src/worker.ts — Web Worker biometric scoring logic
// This file is designed to run inside a Web Worker context

import {
    coefficientOfVariation,
    scoreKeystrokeCadence,
    scoreMouseVelocity,
    scoreClickRhythm,
    computeCompositeScore,
} from "./scoring";

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

/**
 * Process incoming event from main thread
 */
export function processEvent(type: string, data: any): void {
    if (type === "KEYDOWN") {
        const now = data.timestamp;
        if (lastKeyTime > 0) {
            samples.push({ type: "key", timestamp: now, value: now - lastKeyTime });
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

    if (type === "SCROLL") {
        samples.push({
            type: "scroll",
            timestamp: data.timestamp,
            value: data.delta || 0,
        });
    }

    if (type === "CLICK") {
        clickTimes.push(data.timestamp);
        if (clickTimes.length > 20) clickTimes.shift();
    }
}

/**
 * Compute the full biometric score from accumulated samples
 */
export function computeScore(): number {
    if (samples.length < 10) return 90;

    const keySamples = samples.filter((s) => s.type === "key").map((s) => s.value);
    const mouseSamples = samples.filter((s) => s.type === "mouse").map((s) => s.value);
    const clickDeltas = clickTimes.slice(1).map((t, i) => t - clickTimes[i]);

    const keystrokeScore = scoreKeystrokeCadence(keySamples);
    const mouseScore = scoreMouseVelocity(mouseSamples);
    const clickScore = scoreClickRhythm(clickDeltas);

    return computeCompositeScore({ keystrokeScore, mouseScore, clickScore });
}

/**
 * Clean old samples (keep last 2 minutes)
 */
export function pruneSamples(): void {
    const cutoff = Date.now() - 120_000;
    const idx = samples.findIndex((s) => s.timestamp > cutoff);
    if (idx > 0) samples.splice(0, idx);
}
