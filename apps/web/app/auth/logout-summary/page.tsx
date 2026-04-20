// app/auth/logout-summary/page.tsx — Post-logout summary screen
"use client";

export default function LogoutSummaryPage() {
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
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100px", background: "linear-gradient(to bottom, transparent, #ff4d4d11, transparent)", animation: "scanline 8s linear infinite", pointerEvents: "none", zIndex: 0 }}></div>

            <div style={{ textAlign: "center", maxWidth: 400, padding: "0 20px", zIndex: 1, animation: "subtleFloat 6s ease-in-out infinite" }}>
                <div
                    style={{
                        width: 72,
                        height: 72,
                        borderRadius: "50%",
                        background: "#050505",
                        border: "2px solid #ff4d4d44",
                        margin: "0 auto 22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 28,
                        boxShadow: "0 0 36px #ff4d4d22",
                        animation: "pulse-icon 1s ease-in-out infinite alternate",
                    }}
                >
                    🔒
                </div>
                <div
                    style={{ fontSize: 9, letterSpacing: 5, color: "#ff4d4d", marginBottom: 10 }}
                >
                    SESSION TERMINATED
                </div>
                <div
                    style={{
                        fontSize: 26,
                        fontWeight: 800,
                        color: "#f0f6ff",
                        marginBottom: 14,
                        lineHeight: 1.2,
                    }}
                >
                    Securely logged out
                </div>
                <p
                    style={{
                        color: "#777",
                        fontSize: 13,
                        lineHeight: 1.8,
                        marginBottom: 24,
                    }}
                >
                    Session closed due to inactivity.
                    <br />
                    All transactions saved. Audit log retained.
                </p>

                <div
                    style={{
                        background: "#11111188",
                        border: "1px solid #1a1a1a",
                        borderRadius: 12,
                        padding: "14px 18px",
                        marginBottom: 24,
                        textAlign: "left",
                    }}
                >
                    {[
                        ["Duration", "—"],
                        ["Last Activity", "—"],
                        ["Transactions", "—"],
                        ["Behaviour Score", "—"],
                        ["Anomalies", "0 detected"],
                    ].map(([k, v]) => (
                        <div
                            key={k}
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginBottom: 7,
                            }}
                        >
                            <span style={{ fontSize: 11, color: "#555" }}>{k}</span>
                            <span
                                style={{
                                    fontSize: 11,
                                    color: "#00e5a0",
                                    fontFamily: "monospace",
                                }}
                            >
                                {v}
                            </span>
                        </div>
                    ))}
                </div>

                <a
                    href="/auth/login"
                    style={{
                        display: "block",
                        width: "100%",
                        padding: "13px",
                        borderRadius: 11,
                        border: "none",
                        background: "linear-gradient(135deg, #00e5a0, #0088ff)",
                        color: "#000",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        letterSpacing: 1,
                        textDecoration: "none",
                        textAlign: "center",
                        boxShadow: "0 4px 22px #00e5a044",
                        transition: "all 0.3s ease"
                    }}
                >
                    Sign In Again →
                </a>
            </div>
        </div>
    );
}
