// app/auth/login/page.tsx — Login page with TOTP support
"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [totp, setTotp] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showTotp, setShowTotp] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const result = await signIn("credentials", {
                email,
                password,
                totp,
                redirect: false,
            });

            if (result?.error) {
                if (result.error === "TOTP_REQUIRED" || result.error === "CredentialsSignin") {
                    setError("Two-factor authentication required.");
                    setShowTotp(true);
                } else {
                    setError("Invalid email or password.");
                }
            } else {
                window.location.href = "/dashboard";
            }
        } catch {
            setError("An unexpected error occurred.");
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
                @keyframes pulse-icon { from { transform: scale(1); } to { transform: scale(1.05); } }
                @keyframes subtleFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
                @keyframes scanline { 0% { transform: translateY(-100%); opacity: 0; } 50% { opacity: 0.1; } 100% { transform: translateY(100vh); opacity: 0; } }
                @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
                @keyframes orbFloat1 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(10vw, 15vh) scale(1.1); } }
                @keyframes orbFloat2 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-10vw, -15vh) scale(1.1); } }
                @keyframes gridMove { 0% { background-position: 0 0; } 100% { background-position: 50px 50px; } }
            `}</style>

            {/* Dynamic Grid Background */}
            <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundImage: "linear-gradient(rgba(0, 229, 160, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 160, 0.03) 1px, transparent 1px)", backgroundSize: "50px 50px", animation: "gridMove 15s linear infinite", pointerEvents: "none" }}></div>

            {/* Floating Cyber Orbs */}
            <div style={{ position: "fixed", top: "-10%", left: "-5%", width: "40vw", height: "40vw", background: "radial-gradient(circle, rgba(0,229,160,0.08) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", filter: "blur(60px)", animation: "orbFloat1 20s ease-in-out infinite", pointerEvents: "none", zIndex: 0 }}></div>
            <div style={{ position: "fixed", bottom: "-10%", right: "-5%", width: "40vw", height: "40vw", background: "radial-gradient(circle, rgba(0,136,255,0.08) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", filter: "blur(60px)", animation: "orbFloat2 25s ease-in-out infinite", pointerEvents: "none", zIndex: 0 }}></div>

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
                        SECURE SESSION LOGIN
                    </div>
                </div>

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

                    {/* TOTP (shown after first login or if required) */}
                    {showTotp && (
                        <div style={{ marginBottom: 16 }}>
                            <label
                                style={{
                                    fontSize: 9,
                                    letterSpacing: 2,
                                    color: "#a78bfa",
                                    display: "block",
                                    marginBottom: 6,
                                }}
                            >
                                TOTP CODE
                            </label>
                            <input
                                type="text"
                                value={totp}
                                onChange={(e) => setTotp(e.target.value)}
                                maxLength={6}
                                style={{
                                    width: "100%",
                                    padding: "12px 14px",
                                    borderRadius: 10,
                                    border: "1px solid #a78bfa33",
                                    background: "#111111",
                                    color: "#a78bfa",
                                    fontSize: 18,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    letterSpacing: 8,
                                    textAlign: "center",
                                    outline: "none",
                                    transition: "all 0.3s ease",
                                }}
                                placeholder="000000"
                            />
                        </div>
                    )}

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
                                : "linear-gradient(135deg, #00e5a0, #0088ff)",
                            color: loading ? "#4a6080" : "#000000",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: loading ? "not-allowed" : "pointer",
                            letterSpacing: 1,
                            fontFamily: "'Syne', sans-serif",
                            boxShadow: loading ? "none" : "0 4px 22px #00e5a044",
                            transition: "all 0.3s ease"
                        }}
                    >
                        {loading ? "Authenticating..." : "Sign In →"}
                    </button>
                </form>

                {/* Registration Link */}
                <div
                    style={{
                        marginTop: 24,
                        textAlign: "center",
                        fontSize: 11,
                        color: "#4a6080",
                    }}
                >
                    Don't have an account?{" "}
                    <Link
                        href="/auth/register"
                        style={{
                            color: "#00e5a0",
                            textDecoration: "none",
                            fontWeight: 600,
                        }}
                    >
                        Initialize Profile
                    </Link>
                </div>

                {/* Footer */}
                <div
                    style={{
                        marginTop: 24,
                        textAlign: "center",
                        fontSize: 9,
                        color: "#2a4060",
                        letterSpacing: 1.5,
                    }}
                >
                    TLS 1.3 · JWT · TOTP 2FA · HttpOnly Cookies
                </div>
            </div>
        </div>
    );
}
