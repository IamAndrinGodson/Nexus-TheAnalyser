// app/api/session/heartbeat/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions) as any;
    if (!session || !session.backendToken) {
        return NextResponse.json({ valid: false }, { status: 401 });
    }

    try {
        const API_URL = process.env.RISK_API_URL || "http://localhost:8000";

        const res = await fetch(`${API_URL}/api/session/heartbeat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.backendToken}`,
            },
        });

        if (res.status === 401 || res.status === 403) {
            return NextResponse.json({ valid: false }, { status: 401 });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (e) {
        console.error("Heartbeat error", e);
        return NextResponse.json({ valid: false }, { status: 500 });
    }
}
