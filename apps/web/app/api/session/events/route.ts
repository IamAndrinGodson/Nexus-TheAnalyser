// app/api/session/events/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions) as any;
    if (!session || !session.backendToken) {
        return NextResponse.json({ recorded: false }, { status: 401 });
    }

    try {
        const body = await request.json();

        const API_URL = process.env.RISK_API_URL || "http://localhost:8000";

        const res = await fetch(`${API_URL}/api/events/ingest`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.backendToken}`,
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            return NextResponse.json({ recorded: false }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (e) {
        console.error("Event ingest error", e);
        return NextResponse.json({ recorded: false }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const session = await getServerSession(authOptions) as any;
    if (!session || !session.backendToken) {
        return NextResponse.json({ events: [] }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get("session_id") || session.sessionId;

        const API_URL = process.env.RISK_API_URL || "http://localhost:8000";

        const res = await fetch(`${API_URL}/api/events/timeline/${sessionId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.backendToken}`,
            },
        });

        if (!res.ok) {
            return NextResponse.json({ events: [] }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (e) {
        console.error("Event timeline error", e);
        return NextResponse.json({ events: [] }, { status: 500 });
    }
}
