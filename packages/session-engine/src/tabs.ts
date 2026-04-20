// packages/session-engine/src/tabs.ts — Tab registry for cross-tab session management

export interface TabInfo {
    id: string;
    title: string;
    route: string;
    status: "ACTIVE" | "IDLE" | "BACKGROUND" | "KILLED";
    lastActivity: number;
}

export class TabRegistry {
    private tabs: Map<string, TabInfo> = new Map();
    private idleThreshold: number; // ms

    constructor(idleThreshold = 60_000) {
        this.idleThreshold = idleThreshold;
    }

    register(tabId: string, title: string, route: string): void {
        this.tabs.set(tabId, {
            id: tabId,
            title,
            route,
            status: "ACTIVE",
            lastActivity: Date.now(),
        });
    }

    updateActivity(tabId: string): void {
        const tab = this.tabs.get(tabId);
        if (tab) {
            tab.lastActivity = Date.now();
            tab.status = "ACTIVE";
        }
    }

    markIdle(tabId: string): void {
        const tab = this.tabs.get(tabId);
        if (tab) tab.status = "IDLE";
    }

    kill(tabId: string): void {
        const tab = this.tabs.get(tabId);
        if (tab) {
            tab.status = "KILLED";
            this.tabs.delete(tabId);
        }
    }

    getAll(): TabInfo[] {
        return Array.from(this.tabs.values());
    }

    getActive(): TabInfo[] {
        return this.getAll().filter((t) => t.status === "ACTIVE");
    }

    pruneStale(): string[] {
        const now = Date.now();
        const stale: string[] = [];
        for (const [id, tab] of this.tabs) {
            if (now - tab.lastActivity > this.idleThreshold && tab.status !== "KILLED") {
                tab.status = "IDLE";
                stale.push(id);
            }
        }
        return stale;
    }

    get count(): number {
        return this.tabs.size;
    }
}
