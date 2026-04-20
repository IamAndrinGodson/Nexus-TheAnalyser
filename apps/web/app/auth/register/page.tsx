// app/auth/register/page.tsx — Registration page
"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/backend/api/auth/register", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "1",
                },
                body: JSON.stringify({
                    email,
                    password,
                    role: "operator",
                    org_id: "default-org",
                }),
            });

            // Handle non-JSON responses (e.g. HTML redirect from middleware)
            const contentType = res.headers.get("content-type") || "";
            if (!contentType.includes("application/json")) {
                console.error("Non-JSON response:", res.status, res.statusText);
                setError(`Server returned non-JSON response (${res.status}). Please try again.`);
                return;
            }

            const data = await res.json();

            if (!res.ok) {
                let errorMsg = `Registration failed (${res.status}).`;
                if (data.detail) {
                    if (typeof data.detail === "string") {
                        errorMsg = data.detail;
                    } else if (Array.isArray(data.detail)) {
                        errorMsg = data.detail.map((err: any) => err.msg || JSON.stringify(err)).join(", ");
                    } else {
                        errorMsg = JSON.stringify(data.detail);
                    }
                }
                setError(errorMsg);
            } else {
                setSuccess(true);
                setTimeout(() => {
                    window.location.href = "/auth/login";
                }, 2000);
            }
        } catch (err: any) {
            console.error("Registration error:", err);
            if (err.message?.includes("fetch")) {
                setError("Cannot connect to server. Is the backend running?");
            } else {
                setError(err.message || "An unexpected error occurred.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "#000000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Syne', sans-serif",
                position: "relative",
            }}
        >
            <style>{`
                @keyframes subtleFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
                @keyframes scanline { 0% { transform: translateY(-100%); opacity: 0; } 50% { opacity: 0.1; } 100% { transform: translateY(100vh); opacity: 0; } }
                @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
                @keyframes gridMove { 0% { background-position: 0 0; } 100% { background-position: 50px 50px; } }
            `}</style>

            {/* Dynamic Grid Background */}
            <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundImage: "linear-gradient(rgba(0, 229, 160, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 160, 0.03) 1px, transparent 1px)", backgroundSize: "50px 50px", animation: "gridMove 15s linear infinite", pointerEvents: "none" }}></div>

            {/* OLED Scanline Overlay */}
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.2) 51%)", backgroundSize: "100% 4px", opacity: 0.15 }}></div>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100px", background: "linear-gradient(to bottom, transparent, #00e5a011, transparent)", animation: "scanline 8s linear infinite", pointerEvents: "none", zIndex: 0 }}></div>

            <div
                style={{
                    background: "linear-gradient(140deg, #050505, #111111)",
                    border: "1px solid #1a1a1a",
                    borderRadius: 20,
                    padding: "48px 44px",
                    maxWidth: 420,
                    width: "90%",
                    boxShadow: "0 24px 64px #00000099, inset 0 0 40px #00e5a00a",
                    animation: "subtleFloat 6s ease-in-out infinite",
                    zIndex: 1,
                }}
            >
                {/* Logo */}
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <div
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            background: "linear-gradient(270deg, #00e5a0, #0088ff, #00e5a0)",
                            backgroundSize: "200% 200%",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 22,
                            color: "#000",
                            fontWeight: 800,
                            marginBottom: 14,
                            animation: "gradientShift 4s ease infinite",
                            boxShadow: "0 0 20px #00e5a044"
                        }}
                    >
                        ⬡
                    </div>
                    <div
                        style={{
                            fontSize: 18,
                            fontWeight: 800,
                            color: "#f0f6ff",
                            letterSpacing: 1,
                        }}
                    >
                        NEXUS TLS
                    </div>
                    <div
                        style={{ fontSize: 10, color: "#555", letterSpacing: 3, marginTop: 4 }}
                    >
                        OPERATOR REGISTRATION
                    </div>
                </div>

                {success ? (
                    <div style={{ textAlign: "center", padding: "20px 0" }}>
                        <div style={{ color: "#00e5a0", fontSize: 16, marginBottom: 12 }}>
                            Registration successful!
                        </div>
                        <div style={{ color: "#888", fontSize: 12 }}>
                            Redirecting to login...
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {/* Email */}
                        <div style={{ marginBottom: 16 }}>
                            <label
                                style={{
                                    fontSize: 9,
                                    letterSpacing: 2,
                                    color: "#3a5070",
                                    display: "block",
                                    marginBottom: 6,
                                }}
                            >
                                EMAIL
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                style={{
                                    width: "100%",
                                    padding: "12px 14px",
                                    borderRadius: 10,
                                    border: "1px solid #1a1a1a",
                                    background: "#111111",
                                    color: "#f0f6ff",
                                    fontSize: 13,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    outline: "none",
                                    transition: "all 0.3s ease",
                                }}
                                placeholder="operator@nexus.io"
                            />
                        </div>

                        {/* Password */}
                        <div style={{ marginBottom: 16 }}>
                            <label
                                style={{
                                    fontSize: 9,
                                    letterSpacing: 2,
                                    color: "#3a5070",
                                    display: "block",
                                    marginBottom: 6,
                                }}
                            >
                                PASSWORD
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                style={{
                                    width: "100%",
                                    padding: "12px 14px",
                                    borderRadius: 10,
                                    border: "1px solid #1a1a1a",
                                    background: "#111111",
                                    color: "#f0f6ff",
                                    fontSize: 13,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    outline: "none",
                                    transition: "all 0.3s ease",
                                }}
                                placeholder="••••••••"
                            />
                        </div>

                        {/* Confirm Password */}
                        <div style={{ marginBottom: 16 }}>
                            <label
                                style={{
                                    fontSize: 9,
                                    letterSpacing: 2,
                                    color: "#3a5070",
                                    display: "block",
                                    marginBottom: 6,
                                }}
                            >
                                CONFIRM PASSWORD
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                style={{
                                    width: "100%",
                                    padding: "12px 14px",
                                    borderRadius: 10,
                                    border: "1px solid #1a1a1a",
                                    background: "#111111",
                                    color: "#f0f6ff",
                                    fontSize: 13,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    outline: "none",
                                    transition: "all 0.3s ease",
                                }}
                                placeholder="••••••••"
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div
                                style={{
                                    padding: "10px 14px",
                                    background: "#ff4d4d18",
                                    border: "1px solid #ff4d4d33",
                                    borderRadius: 8,
                                    fontSize: 11,
                                    color: "#ff4d4d",
                                    marginBottom: 16,
                                }}
                            >
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: "100%",
                                padding: "13px",
                                borderRadius: 11,
                                border: "none",
                                background: loading
                                    ? "#1a1a1a"
                                    : "linear-gradient(135deg, #0088ff, #00e5a0)",
                                color: loading ? "#4a6080" : "#000000",
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: loading ? "not-allowed" : "pointer",
                                letterSpacing: 1,
                                fontFamily: "'Syne', sans-serif",
                                boxShadow: loading ? "none" : "0 4px 22px #0088ff44",
                                transition: "all 0.3s ease"
                            }}
                        >
                            {loading ? "Registering..." : "Initialize Profile →"}
                        </button>
                    </form>
                )}

                {/* Footer */}
                <div
                    style={{
                        marginTop: 24,
                        textAlign: "center",
                        fontSize: 11,
                        color: "#4a6080",
                    }}
                >
                    Already have an account?{" "}
                    <Link
                        href="/auth/login"
                        style={{
                            color: "#00e5a0",
                            textDecoration: "none",
                            fontWeight: 600,
                        }}
                    >
                        Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
}
