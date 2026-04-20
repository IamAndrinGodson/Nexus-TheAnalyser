// packages/session-engine/src/timer.ts — InactivityTimer class

export interface TimerConfig {
    timeout: number;
    warnAt: number;
    onWarn: () => void;
    onExpire: () => void;
    onTick?: (remaining: number) => void;
}

export class InactivityTimer {
    private remaining: number;
    private timeout: number;
    private interval: ReturnType<typeof setInterval> | null = null;
    private onWarn: () => void;
    private onExpire: () => void;
    private onTick?: (remaining: number) => void;
    private warnAt: number;

    constructor(config: TimerConfig) {
        this.timeout = config.timeout;
        this.remaining = config.timeout;
        this.warnAt = config.warnAt;
        this.onWarn = config.onWarn;
        this.onExpire = config.onExpire;
        this.onTick = config.onTick;
    }

    start() {
        this.interval = setInterval(() => {
            this.remaining -= 1;
            this.onTick?.(this.remaining);
            if (this.remaining <= this.warnAt) this.onWarn();
            if (this.remaining <= 0) {
                this.stop();
                this.onExpire();
            }
        }, 1000);
    }

    reset(newTimeout?: number) {
        if (newTimeout) this.timeout = newTimeout;
        this.remaining = this.timeout;
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
    }

    get timeLeft(): number {
        return this.remaining;
    }

    get isRunning(): boolean {
        return this.interval !== null;
    }
}
