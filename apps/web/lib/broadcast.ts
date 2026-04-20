// lib/broadcast.ts — BroadcastChannel wrapper for cross-tab session sync

type TabEvent =
    | { type: "TAB_ALIVE"; tabId: string; title: string; route: string }
    | { type: "TAB_ACTIVITY"; tabId: string; timestamp: number }
    | { type: "TAB_KILLED"; tabId: string }
    | { type: "LOGOUT" }
    | { type: "EXTEND" }
    | { type: "SESSION_EXPIRED" };

export class BroadcastSync {
    private channel: BroadcastChannel;
    private tabId: string;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    constructor(private onEvent: (event: TabEvent) => void) {
        this.tabId = crypto.randomUUID();
        this.channel = new BroadcastChannel("nexus-session");
        this.channel.onmessage = (e) => this.onEvent(e.data as TabEvent);
        this.startHeartbeat();
        this.announce();
    }

    private announce() {
        this.broadcast({
            type: "TAB_ALIVE",
            tabId: this.tabId,
            title: document.title,
            route: window.location.pathname,
        });
    }

    private startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.broadcast({
                type: "TAB_ACTIVITY",
                tabId: this.tabId,
                timestamp: Date.now(),
            });
        }, 5_000);
    }

    broadcast(event: TabEvent) {
        this.channel.postMessage(event);
    }

    destroy() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.channel.close();
    }
}
