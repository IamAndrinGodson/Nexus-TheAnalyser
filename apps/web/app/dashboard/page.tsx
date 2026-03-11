"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { SessionProvider } from "../../components/session/SessionProvider";

const NexusDashboard = dynamic(
    () => import("../../components/session/NexusDashboard"),
    { ssr: false }
);

const ServerAdminDashboard = dynamic(
    () => import("../../components/session/ServerAdminDashboard"),
    { ssr: false }
);

export default function DashboardPage() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Explicit logic for rendering Admin vs Client Dashboard
        // 1. If accessing via localhost:3000, it's the Admin Dashboard
        // 2. If accessing via Ngrok, localtunnel, or localhost:3002, it's the Client Dashboard
        
        const host = window.location.host;
        const port = window.location.port;

        // Force Admin ONLY if explicitly opened on localhost port 3000
        const isLocalAdmin = port === "3000";
        
        // Check if NEXT_PUBLIC_IS_SERVER is true in .env, BUT if we are on an external ngrok URL,
        // we override and force Client mode. This prevents the server from serving Admin 
        // to public endpoints just because the .env file says `true` for the host machine.
        const isNgrok = host.includes("ngrok") || host.includes("loca.lt") || host.includes("serveo.net");
        
        const envAdmin = process.env.NEXT_PUBLIC_IS_SERVER === "true";
        
        const shouldBeAdmin = isLocalAdmin || (envAdmin && !isNgrok && port !== "3002");
        
        setIsAdmin(shouldBeAdmin);
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", color: "#00e5a0", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, letterSpacing: 2 }}>
                INITIALIZING NEXUS...
            </div>
        );
    }

    return (
        <SessionProvider isAdmin={isAdmin}>
            {isAdmin ? <ServerAdminDashboard /> : <NexusDashboard />}
        </SessionProvider>
    );
}
