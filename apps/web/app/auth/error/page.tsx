// app/auth/error/page.tsx — Auth error page
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ErrorMessage() {
    const searchParams = useSearchParams();
    const error = searchParams.get("error") || "Unknown error";

    const errorMessages: Record<string, string> = {
        CredentialsSignin: "Invalid email or password. Please try again.",
        INVALID_TOTP: "Invalid TOTP verification code.",
        SessionRequired: "You must be logged in to access this page.",
        Default: "An authentication error occurred.",
    };

    const message = errorMessages[error] || errorMessages.Default;

    return (
        <p style={{ color: "#4a6080", fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
            {message}
        </p>
    );
}

export default function AuthErrorPage() {
    return (
        <div
            style={{
                minHeight: "100vh",
                background: "#060d1a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Syne', sans-serif",
            }}
        >
            <div style={{ textAlign: "center", maxWidth: 400 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
                <div style={{ fontSize: 9, letterSpacing: 4, color: "#ff4d4d", marginBottom: 10 }}>
                    AUTHENTICATION ERROR
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#f0f6ff", marginBottom: 14 }}>
                    Access Denied
                </div>
                
                <Suspense fallback={<p style={{ color: "#4a6080", fontSize: 13, marginBottom: 24 }}>Loading...</p>}>
                    <ErrorMessage />
                </Suspense>

                <a
                    href="/auth/login"
                    style={{
                        display: "inline-block",
                        padding: "11px 28px",
                        borderRadius: 9,
                        border: "none",
                        background: "linear-gradient(135deg, #00e5a0, #00c8b0)",
                        color: "#050f1f",
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: "none",
                        letterSpacing: 1,
                    }}
                >
                    Return to Login →
                </a>
            </div>
        </div>
    );
}
