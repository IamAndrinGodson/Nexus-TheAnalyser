// components/session/ServerAdminDashboard.jsx
// ─── SERVER-SIDE MONITORING DASHBOARD ─────────────────────────────────────────
// This dashboard is shown ONLY on the server machine (NEXT_PUBLIC_IS_SERVER=true).
// Full monitoring: trust charts, biometrics, risk, transactions, threats, policies,
// connected clients, activity feed, audit log, and session force-kill.
"use client";

import React, { useState, useEffect } from "react";
import { useSessionEngine } from "./SessionProvider";

// ─── SHARED UTILS ──────────────────────────────────────────────────────────────
const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const Tag = ({ c, children }) => (
    <span style={{
        background: `${c}15`, border: `1px solid ${c}33`, color: c, padding: "3px 8px",
        borderRadius: 6, fontSize: 9, fontWeight: 700, letterSpacing: 1, fontFamily: "'JetBrains Mono',monospace",
    }}>{children}</span>
);

const Dot = ({ c, pulse }) => (
    <span style={{
        width: 6, height: 6, borderRadius: "50%", background: c, display: "inline-block",
        boxShadow: `0 0 10px ${c}`, animation: pulse ? "ping 1.5s ease-out infinite" : "none"
    }} />
);

// ─── EVENT METADATA ────────────────────────────────────────────────────────────
const EVENT_META = {
    tab_open: { icon: "🔓", label: "Tab Opened", color: "#00e5a0" },
    tab_close: { icon: "✖", label: "Tab Closed", color: "#ff4d4d" },
    tab_visibility: { icon: "👁", label: "Visibility (Switched App/Tab)", color: "#00c8b0" },
    tab_focus: { icon: "🎯", label: "Window Focus", color: "#00e5a0" },
    tab_blur: { icon: "💨", label: "Window Blur", color: "#f5c518" },
    tab_idle: { icon: "💤", label: "Client Inactive", color: "#ff4d4d" },
    tab_active: { icon: "⚡", label: "Client Active", color: "#00e5a0" },
    page_change: { icon: "🔀", label: "URL Visited", color: "#a78bfa" },
};

// ─── PANEL WRAPPER ────────────────────────────────────────────────────────────
const Panel = ({ children, style = {} }) => (
    <div style={{
        background: "rgba(10,21,32,0.6)", backdropFilter: "blur(12px)",
        border: "1px solid #1e2d45", borderRadius: 14, padding: "20px",
        ...style,
    }}>{children}</div>
);

const PanelTitle = ({ icon, children, badge }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>{children}</span>
        {badge !== undefined && badge > 0 && (
            <span style={{ background: "#0088ff", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 10, padding: "2px 8px", fontFamily: "monospace" }}>{badge}</span>
        )}
    </div>
);

// ─── TRUST SCORE CHART (SVG Area) ─────────────────────────────────────────────
function TrustScoreChart({ history }) {
    if (!history || history.length < 2) return null;
    const w = 400, h = 100, pad = 4;
    const pts = history.map((v, i) => {
        const x = pad + (i / (history.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - 20) / 80) * (h - pad * 2);
        return `${x},${y}`;
    });
    const line = pts.join(" ");
    const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
    const latest = history[history.length - 1];
    const c = latest >= 80 ? "#00e5a0" : latest >= 60 ? "#f5c518" : "#ff4d4d";
    return (
        <Panel>
            <PanelTitle icon="📈">TRUST SCORE TREND</PanelTitle>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: c, fontFamily: "'JetBrains Mono',monospace" }}>{latest}</div>
                <Tag c={c}>{latest >= 80 ? "HEALTHY" : latest >= 60 ? "CAUTION" : "CRITICAL"}</Tag>
            </div>
            <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 100, animation: "neonPulse 3s infinite alternate", "--pulse-color": c }}>
                <defs>
                    <linearGradient id="trustGradAdmin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={c} stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                <polygon points={area} fill="url(#trustGradAdmin)" style={{ transition: "all 3s linear" }} />
                <polyline points={line} fill="none" stroke={c} strokeWidth="2" style={{ transition: "all 3s linear" }} />
            </svg>
        </Panel>
    );
}

// ─── BIOMETRIC RADAR ──────────────────────────────────────────────────────────
function BiometricRadar({ scores }) {
    const { keystrokeRhythm = 85, mouseVelocity = 80, scrollPattern = 75, clickPattern = 85, dwellTime = 90 } = scores;
    const labels = ["Keystroke", "Mouse", "Scroll", "Click", "Dwell"];
    const values = [keystrokeRhythm, mouseVelocity, scrollPattern, clickPattern, dwellTime];
    const cx = 90, cy = 90, r = 70;
    const getPt = (val, i) => {
        const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const dist = (val / 100) * r;
        return { x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist };
    };
    const pts = values.map((v, i) => getPt(v, i));
    const polygon = pts.map(p => `${p.x},${p.y}`).join(" ");
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / 5);
    const c = avg >= 80 ? "#00e5a0" : avg >= 60 ? "#f5c518" : "#ff4d4d";

    return (
        <Panel>
            <PanelTitle icon="🎯">BIOMETRIC RADAR</PanelTitle>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <svg viewBox="0 0 180 180" style={{ width: 160, height: 160, animation: "neonPulse 3s infinite alternate", "--pulse-color": c }}>
                    {[20, 40, 60, 80, 100].map(v => {
                        const ringPts = [0, 1, 2, 3, 4].map(i => getPt(v, i));
                        return <polygon key={v} points={ringPts.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#1e2d45" strokeWidth="0.5" />;
                    })}
                    <polygon points={polygon} fill={`${c}20`} stroke={c} strokeWidth="1.5" style={{ transition: "all 3s linear" }} />
                    {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={c} style={{ transition: "all 3s linear" }} />)}
                    {[0, 1, 2, 3, 4].map(i => {
                        const p = getPt(105, i);
                        return <text key={i} x={p.x} y={p.y} fill="#5a7a9a" fontSize="7" textAnchor="middle" dominantBaseline="central">{labels[i]}</text>;
                    })}
                </svg>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {labels.map((l, i) => (
                        <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10 }}>
                            <span style={{ color: "#5a7a9a", width: 60 }}>{l}</span>
                            <div style={{ width: 60, height: 4, background: "#1e2d45", borderRadius: 2 }}>
                                <div style={{ width: `${values[i]}%`, height: "100%", background: values[i] >= 80 ? "#00e5a0" : values[i] >= 60 ? "#f5c518" : "#ff4d4d", borderRadius: 2, transition: "width 3s linear, background 3s linear" }} />
                            </div>
                            <span style={{ color: values[i] >= 80 ? "#00e5a0" : values[i] >= 60 ? "#f5c518" : "#ff4d4d", fontFamily: "monospace", fontWeight: 600 }}>{values[i]}</span>
                        </div>
                    ))}
                    <div style={{ marginTop: 4, fontSize: 9, color: "#5a7a9a" }}>
                        AVG: <span style={{ color: c, fontWeight: 700, fontFamily: "monospace" }}>{avg}</span>
                    </div>
                </div>
            </div>
        </Panel>
    );
}

// ─── RISK MONITOR ──────────────────────────────────────────────────────────────
function RiskMonitor({ riskLevel, adaptedTimeout, remaining, riskFactors }) {
    const riskColors = { LOW: "#00e5a0", MEDIUM: "#f5c518", HIGH: "#ff4d4d" };
    const rc = riskColors[riskLevel] || "#0088ff";

    return (
        <Panel>
            <PanelTitle icon="⚡">RISK & SESSION MONITOR</PanelTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ textAlign: "center", background: `${rc}0a`, border: `1px solid ${rc}22`, borderRadius: 10, padding: "14px" }}>
                    <div style={{ fontSize: 9, color: "#555", letterSpacing: 2, marginBottom: 6 }}>RISK LEVEL</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: rc, fontFamily: "'JetBrains Mono',monospace" }}>{riskLevel}</div>
                </div>
                <div style={{ textAlign: "center", background: "#0088ff0a", border: "1px solid #0088ff22", borderRadius: 10, padding: "14px" }}>
                    <div style={{ fontSize: 9, color: "#555", letterSpacing: 2, marginBottom: 6 }}>TIMEOUT</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#0088ff", fontFamily: "'JetBrains Mono',monospace" }}>{fmt(adaptedTimeout)}</div>
                </div>
                <div style={{ textAlign: "center", background: remaining <= 30 ? "#ff4d4d0a" : "#00e5a00a", border: `1px solid ${remaining <= 30 ? "#ff4d4d22" : "#00e5a022"}`, borderRadius: 10, padding: "14px" }}>
                    <div style={{ fontSize: 9, color: "#555", letterSpacing: 2, marginBottom: 6 }}>REMAINING</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: remaining <= 30 ? "#ff4d4d" : "#00e5a0", fontFamily: "'JetBrains Mono',monospace" }}>{fmt(remaining)}</div>
                </div>
            </div>
            {riskFactors && riskFactors.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 8, color: "#555", letterSpacing: 2, marginBottom: 4 }}>ACTIVE RISK FACTORS</div>
                    {riskFactors.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, padding: "4px 8px", background: "rgba(0,0,0,0.2)", borderRadius: 6 }}>
                            <span style={{ color: f.impact === "+" ? "#ff4d4d" : "#00e5a0", fontWeight: 800, width: 14, textAlign: "center" }}>{f.impact}</span>
                            <span style={{ color: "#8aa0b8", flex: 1 }}>{f.label}</span>
                            <span style={{ color: "#5a7a9a", fontFamily: "monospace" }}>±{f.delta}s</span>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
}

// ─── CONNECTED CLIENTS PANEL ──────────────────────────────────────────────────
function ConnectedClientsPanel({ tabs }) {
    const activeCount = tabs.filter(t => t.visible !== false && !t.idle).length;
    const hiddenCount = tabs.filter(t => t.visible === false).length;
    const idleCount = tabs.filter(t => t.idle).length;

    return (
        <Panel>
            <PanelTitle icon="👥">CONNECTED CLIENTS</PanelTitle>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                {[
                    { label: "ACTIVE", val: activeCount, c: "#00e5a0" },
                    { label: "HIDDEN", val: hiddenCount, c: "#f5c518" },
                    { label: "IDLE", val: idleCount, c: "#ff4d4d" },
                    { label: "TOTAL", val: tabs.length, c: "#0088ff" },
                ].map(s => (
                    <div key={s.label} style={{ flex: 1, textAlign: "center", background: `${s.c}0a`, border: `1px solid ${s.c}22`, borderRadius: 10, padding: "12px 8px" }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: s.c, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{s.val}</div>
                        <div style={{ fontSize: 8, color: s.c, letterSpacing: 2, marginTop: 6 }}>{s.label}</div>
                    </div>
                ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                {tabs.length === 0 && (
                    <div style={{ textAlign: "center", color: "#3a5070", padding: 20 }}>
                        <div style={{ fontSize: 28, opacity: 0.3, marginBottom: 8 }}>📡</div>
                        <div style={{ fontSize: 11 }}>No clients connected</div>
                        <div style={{ fontSize: 9, color: "#2a4060", marginTop: 4 }}>Waiting for client connections...</div>
                    </div>
                )}
                {tabs.map(tab => {
                    const isHidden = tab.visible === false;
                    const isIdle = tab.idle;
                    const c = isIdle ? "#ff4d4d" : isHidden ? "#f5c518" : "#00e5a0";
                    const status = isIdle ? "IDLE" : isHidden ? "HIDDEN" : tab.focused ? "FOCUSED" : "VISIBLE";

                    return (
                        <div key={tab.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: `${c}08`, border: `1px solid ${c}18`, borderRadius: 10 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 8px ${c}`, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>{tab.title || "Untitled Tab"}</span>
                                    <Tag c={c}>{status}</Tag>
                                </div>
                                <div style={{ display: "flex", gap: 12, marginTop: 4, alignItems: "center" }}>
                                    <span style={{ fontSize: 9, color: "#5a7a9a" }}>Route: <span style={{ color: "#7a9ab0", fontFamily: "monospace" }}>{tab.route || "/"}</span></span>
                                    <span style={{ fontSize: 9, color: "#3a5070", fontFamily: "monospace" }}>tab:{tab.id?.slice(0, 8) || "?"}...</span>
                                    {tab.ip && <span style={{ fontSize: 9, color: "#00e5a0", fontFamily: "monospace", padding: "2px 6px", background: "rgba(0,229,160,0.1)", borderRadius: 4 }}>IP: {tab.ip}</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
}

// ─── ACTIVITY FEED ─────────────────────────────────────────────────────────────
function ServerActivityFeed({ activities }) {
    return (
        <Panel style={{ minHeight: 350 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <PanelTitle icon="📡" badge={activities.length}>CLIENT ACTIVITY FEED</PanelTitle>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e5a0", animation: "ping 1.5s ease-out infinite" }} />
                    <span style={{ fontSize: 8, color: "#00e5a0", fontFamily: "monospace", letterSpacing: 1 }}>LIVE STREAM</span>
                </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, maxHeight: 300 }}>
                {activities.length === 0 && (
                    <div style={{ textAlign: "center", color: "#3a5070", padding: 40 }}>
                        <div style={{ fontSize: 36, opacity: 0.3, marginBottom: 12 }}>📡</div>
                        <div style={{ fontSize: 13, color: "#4a6080" }}>Waiting for client events...</div>
                    </div>
                )}
                {activities.map((act, i) => {
                    const meta = EVENT_META[act.event] || { icon: "•", label: act.event, color: "#5a7a9a" };
                    return (
                        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", background: i === 0 ? `${meta.color}0d` : "transparent", border: `1px solid ${i === 0 ? meta.color + "22" : "transparent"}`, borderRadius: 10, animation: i === 0 ? "slideDown 0.3s ease-out" : "none" }}>
                            <span style={{ fontSize: 16, flexShrink: 0 }}>{meta.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 10, color: meta.color, fontWeight: 700, letterSpacing: 1 }}>{meta.label.toUpperCase()}</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        {act.ip && <span style={{ fontSize: 8, color: "#0088ff", fontFamily: "monospace", padding: "2px 6px", background: "rgba(0,136,255,0.15)", borderRadius: 4, letterSpacing: 1 }}>{act.ip}</span>}
                                        <span style={{ fontSize: 9, color: "#3a5070", fontFamily: "monospace", flexShrink: 0 }}>{act.time}</span>
                                    </div>
                                </div>
                                <div style={{ fontSize: 11, color: "#8aa0b8", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{act.detail}</div>
                                <div style={{ fontSize: 8, color: "#2a3d55", fontFamily: "monospace", marginTop: 2 }}>tab:{act.tabId?.slice(0, 8) || "?"}...</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
}

// ─── SYSTEM STATUS PANEL ──────────────────────────────────────────────────────
function SystemStatusPanel({ stats, wsConnected }) {
    const serverUptime = new Date().toLocaleTimeString();
    return (
        <Panel>
            <PanelTitle icon="🖥️">SYSTEM STATUS</PanelTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                    { icon: "🟢", label: "Server Status", value: "ONLINE", c: "#00e5a0" },
                    { icon: "📊", label: "Uptime", value: `${stats.uptime}%`, c: "#00e5a0" },
                    { icon: "🔗", label: "Active Sessions", value: String(stats.activeSessions), c: "#0088ff" },
                    { icon: "🔒", label: "Avg Trust Score", value: String(stats.avgTrustScore), c: "#00e5a0" },
                    { icon: "⚡", label: "P95 Latency", value: `${stats.p95Latency}ms`, c: stats.p95Latency > 50 ? "#f5c518" : "#00e5a0" },
                    { icon: "🛡️", label: "Blocked Threats", value: String(stats.blockedThreats), c: stats.blockedThreats > 0 ? "#ff4d4d" : "#00e5a0" },
                    { icon: "🌐", label: "WebSocket", value: wsConnected ? "CONNECTED" : "DISCONNECTED", c: wsConnected ? "#00e5a0" : "#ff4d4d" },
                    { icon: "⏰", label: "Server Time", value: serverUptime, c: "#7a9ab0" },
                ].map(m => (
                    <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #1e2d4522" }}>
                        <span style={{ fontSize: 14 }}>{m.icon}</span>
                        <span style={{ fontSize: 9, color: "#5a7a9a", flex: 1, letterSpacing: 1 }}>{m.label}</span>
                        <span style={{ fontSize: 11, color: m.c, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{m.value}</span>
                    </div>
                ))}
            </div>
        </Panel>
    );
}

// ─── THREAT FEED PANEL ────────────────────────────────────────────────────────
function ThreatFeedPanel({ threats }) {
    // FIX: use t.severity (from WS data) instead of t.level
    const critCount = threats.filter(t => t.severity === "CRITICAL" || t.severity === "HIGH").length;
    const warnCount = threats.filter(t => t.severity === "MEDIUM" || t.severity === "WARNING").length;

    return (
        <Panel>
            <PanelTitle icon="🛡️">THREAT OVERVIEW</PanelTitle>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, textAlign: "center", background: "#ff4d4d0a", border: "1px solid #ff4d4d22", borderRadius: 10, padding: "12px" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#ff4d4d", fontFamily: "monospace" }}>{critCount}</div>
                    <div style={{ fontSize: 8, color: "#ff4d4d", letterSpacing: 2, marginTop: 4 }}>CRITICAL</div>
                </div>
                <div style={{ flex: 1, textAlign: "center", background: "#f5c5180a", border: "1px solid #f5c51822", borderRadius: 10, padding: "12px" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#f5c518", fontFamily: "monospace" }}>{warnCount}</div>
                    <div style={{ fontSize: 8, color: "#f5c518", letterSpacing: 2, marginTop: 4 }}>WARNING</div>
                </div>
                <div style={{ flex: 1, textAlign: "center", background: "#0088ff0a", border: "1px solid #0088ff22", borderRadius: 10, padding: "12px" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#0088ff", fontFamily: "monospace" }}>{threats.length}</div>
                    <div style={{ fontSize: 8, color: "#0088ff", letterSpacing: 2, marginTop: 4 }}>TOTAL</div>
                </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                {threats.length === 0 && (
                    <div style={{ textAlign: "center", padding: 16, color: "#3a5070", fontSize: 11 }}>No threats detected</div>
                )}
                {threats.slice(0, 10).map((t, i) => {
                    const tc = t.severity === "CRITICAL" || t.severity === "HIGH" ? "#ff4d4d" : t.severity === "MEDIUM" ? "#f5c518" : "#00e5a0";
                    return (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px", background: `${tc}08`, border: `1px solid ${tc}15`, borderRadius: 8 }}>
                            <div style={{ width: 5, height: 5, borderRadius: "50%", background: tc }} />
                            <span style={{ fontSize: 10, color: "#8aa0b8", flex: 1 }}>{t.detail || t.message || "Threat detected"}</span>
                            {t.city && <span style={{ fontSize: 9, color: "#5a7a9a", fontFamily: "monospace" }}>{t.city}</span>}
                            <Tag c={tc}>{t.severity}</Tag>
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
}

// ─── TRANSACTION MONITOR ──────────────────────────────────────────────────────
function TransactionMonitor({ transactions, txnVolume }) {
    return (
        <Panel>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <PanelTitle icon="💳" badge={transactions.length}>TRANSACTION MONITOR</PanelTitle>
                {txnVolume > 0 && (
                    <div style={{ fontSize: 11, color: "#0088ff", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>₹{txnVolume.toLocaleString()} vol</div>
                )}
            </div>
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
                {transactions.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 20, color: "#3a5070", fontSize: 11 }}>No transactions yet</div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                        <thead>
                            <tr>
                                {["ID", "Amount", "Merchant", "Route", "Risk", "Status"].map(h => (
                                    <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "#5a7a9a", fontWeight: 600, letterSpacing: 1, fontSize: 8, borderBottom: "1px solid #1e2d45" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.slice(0, 12).map((t, i) => {
                                const rc = t.risk === "HIGH" ? "#ff4d4d" : t.risk === "MEDIUM" ? "#f5c518" : "#00e5a0";
                                const sc = t.status === "FLAGGED" || t.status === "BLOCKED" ? "#ff4d4d" : t.status === "DELIVERED" ? "#00e5a0" : "#0088ff";
                                return (
                                    <tr key={i} style={{ borderBottom: "1px solid #1e2d4522" }}>
                                        <td style={{ padding: "8px", color: "#7a9ab0", fontFamily: "monospace" }}>{t.id}</td>
                                        <td style={{ padding: "8px", color: "#fff", fontWeight: 600, fontFamily: "monospace" }}>{t.amount}</td>
                                        <td style={{ padding: "8px", color: "#8aa0b8" }}>{t.merchant}</td>
                                        <td style={{ padding: "8px", color: "#5a7a9a", fontFamily: "monospace" }}>{t.route}</td>
                                        <td style={{ padding: "8px" }}><Tag c={rc}>{t.risk}</Tag></td>
                                        <td style={{ padding: "8px" }}><Tag c={sc}>{t.status}</Tag></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </Panel>
    );
}

// ─── POLICY MANAGEMENT ────────────────────────────────────────────────────────
function PolicyPanel({ updatePolicies }) {
    const [baseTimeout, setBaseTimeout] = useState(120);
    const [bioDrop, setBioDrop] = useState(40);
    const [geoRadius, setGeoRadius] = useState(50);
    const [toggles, setToggles] = useState({ strictGeo: true, killSync: false, threatBlock: true, jwtRot: true, txnRules: true });
    const [deployed, setDeployed] = useState(false);

    const handleDeploy = () => {
        updatePolicies(baseTimeout, bioDrop, geoRadius, toggles);
        setDeployed(true);
        setTimeout(() => setDeployed(false), 3000);
    };

    const Toggle = ({ label, k }) => (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
            <span style={{ fontSize: 10, color: "#8aa0b8" }}>{label}</span>
            <div onClick={() => setToggles(p => ({ ...p, [k]: !p[k] }))} style={{
                width: 36, height: 18, borderRadius: 9, background: toggles[k] ? "#00e5a0" : "#1e2d45",
                position: "relative", cursor: "pointer", transition: "all 0.3s",
            }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: toggles[k] ? 20 : 2, transition: "left 0.3s" }} />
            </div>
        </div>
    );

    return (
        <Panel>
            <PanelTitle icon="⚙️">POLICY MANAGEMENT</PanelTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                    <div style={{ fontSize: 9, color: "#5a7a9a", letterSpacing: 1, marginBottom: 6 }}>BASE TIMEOUT: <span style={{ color: "#00e5a0", fontWeight: 700 }}>{baseTimeout}s</span></div>
                    <input type="range" min={30} max={600} value={baseTimeout} onChange={e => setBaseTimeout(+e.target.value)} style={{ width: "100%", accentColor: "#00e5a0" }} />
                </div>
                <div>
                    <div style={{ fontSize: 9, color: "#5a7a9a", letterSpacing: 1, marginBottom: 6 }}>BIOMETRIC DROP THRESHOLD: <span style={{ color: "#f5c518", fontWeight: 700 }}>{bioDrop}</span></div>
                    <input type="range" min={10} max={80} value={bioDrop} onChange={e => setBioDrop(+e.target.value)} style={{ width: "100%", accentColor: "#f5c518" }} />
                </div>
                <div>
                    <div style={{ fontSize: 9, color: "#5a7a9a", letterSpacing: 1, marginBottom: 6 }}>GEO-FENCE RADIUS: <span style={{ color: "#0088ff", fontWeight: 700 }}>{geoRadius}km</span></div>
                    <input type="range" min={5} max={500} value={geoRadius} onChange={e => setGeoRadius(+e.target.value)} style={{ width: "100%", accentColor: "#0088ff" }} />
                </div>
                <div style={{ borderTop: "1px solid #1e2d4533", paddingTop: 10 }}>
                    <Toggle label="Strict Geo-Fencing" k="strictGeo" />
                    <Toggle label="Cross-Tab Kill Sync" k="killSync" />
                    <Toggle label="Auto-Block Threats" k="threatBlock" />
                    <Toggle label="JWT Auto-Rotation" k="jwtRot" />
                    <Toggle label="Transaction Rules" k="txnRules" />
                </div>
                <button onClick={handleDeploy} style={{
                    padding: "10px", borderRadius: 10, border: "none", fontFamily: "'Syne',sans-serif",
                    background: deployed ? "rgba(0,229,160,0.15)" : "linear-gradient(135deg, #ff4d4d, #ff8800)",
                    color: deployed ? "#00e5a0" : "#000", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
                    boxShadow: deployed ? "none" : "0 4px 20px rgba(255,77,77,0.3)", transition: "all 0.3s",
                }}>
                    {deployed ? "✓ POLICIES DEPLOYED" : "DEPLOY POLICIES"}
                </button>
            </div>
        </Panel>
    );
}

// ─── AUDIT LOG PANEL ──────────────────────────────────────────────────────────
function AuditLogPanel({ logs }) {
    return (
        <Panel>
            <PanelTitle icon="📋" badge={logs.length}>AUDIT LOG</PanelTitle>
            <div style={{ maxHeight: 250, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {logs.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 24, color: "#3a5070", fontSize: 11 }}>No audit events yet</div>
                ) : logs.map((log, i) => {
                    // FIX: handle both WS format (t/msg) and REST format (time/message/timestamp)
                    const timeStr = log.t || log.time || log.timestamp || "";
                    const msgStr = log.msg || log.message || JSON.stringify(log);
                    const eventType = log.type || log.event_type || "info";
                    const typeColors = { success: "#00e5a0", info: "#0088ff", warning: "#f5c518", danger: "#ff4d4d", warn: "#f5c518" };
                    const tc = typeColors[eventType] || "#5a7a9a";
                    return (
                        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, border: "1px solid #1e2d4522" }}>
                            <div style={{ width: 4, height: 4, borderRadius: "50%", background: tc, marginTop: 5, flexShrink: 0 }} />
                            <span style={{ fontSize: 9, color: "#3a5070", fontFamily: "monospace", flexShrink: 0, minWidth: 60 }}>{timeStr}</span>
                            <span style={{ fontSize: 10, color: "#8aa0b8" }}>{msgStr}</span>
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
}

// ─── SERVER ADMIN DASHBOARD ───────────────────────────────────────────────────
export default function ServerAdminDashboard() {
    let session = null;
    try {
        session = useSessionEngine();
    } catch (e) {
        console.warn("[ServerAdmin] SessionProvider not available", e);
    }

    const wsConnected = session?.wsConnected ?? false;
    const stats = session?.systemStats ?? { uptime: 99.97, activeSessions: 0, avgTrustScore: 0, p95Latency: 0, blockedThreats: 0 };
    const threats = session?.threats ?? [];
    const tabs = session?.tabs ?? [];
    const clientActivities = session?.clientActivities ?? [];
    const sessionLog = session?.sessionLog ?? [];
    const riskLevel = session?.riskLevel ?? "LOW";
    const adaptedTimeout = session?.adaptedTimeout ?? 120;
    const remaining = session?.remaining ?? 120;
    const riskFactors = session?.riskFactors ?? [];
    const trustHistory = session?.trustHistory ?? [];
    const biometricScore = session?.biometricScore ?? 85;
    const keystrokeRhythm = session?.keystrokeRhythm ?? 85;
    const mouseVelocity = session?.mouseVelocity ?? 80;
    const scrollPattern = session?.scrollPattern ?? 75;
    const clickPattern = session?.clickPattern ?? 85;
    const dwellTime = session?.dwellTime ?? 90;
    const transactions = session?.transactions ?? [];
    const txnVolume = session?.txnVolume ?? 0;
    const updatePolicies = session?.updatePolicies ?? (() => { });
    const logout = session?.logout ?? (() => { });

    const [clock, setClock] = useState(new Date().toLocaleTimeString());
    const [activeView, setActiveView] = useState("MONITOR");
    useEffect(() => {
        const t = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
        return () => clearInterval(t);
    }, []);

    const navItems = ["MONITOR", "THREATS", "TRANSACTIONS", "POLICIES", "AUDIT LOG"];

    return (
        <>
            <style>{`
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700;800&display=swap');
*,*::before,*::after{ box-sizing: border-box; margin: 0; padding: 0; }
body{ background:#000000; font-family: 'Syne', sans-serif; overflow-x: hidden; }
::-webkit-scrollbar{ width: 6px; height: 6px; }
::-webkit-scrollbar-track{ background:#050910; }
::-webkit-scrollbar-thumb{ background:#1e2d45; border-radius: 3px; }
@keyframes ping{ 0%{transform:scale(1);opacity:.8}100%{transform:scale(2.4);opacity:0} }
@keyframes scanline{0%{transform:translateY(-100%);opacity:0}50%{opacity:0.1}100%{transform:translateY(100vh);opacity:0}}
@keyframes gridMove{0%{background-position:0 0}100%{background-position:50px 50px}}
@keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
@keyframes orbFloat1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(10vw,15vh) scale(1.1)}}
@keyframes orbFloat2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-10vw,-15vh) scale(1.1)}}
@keyframes staggerSlideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes flashValue { 0% { opacity: 1; filter: brightness(2) drop-shadow(0 0 10px rgba(0,229,160,0.8)); } 100% { opacity: 1; filter: brightness(1) drop-shadow(0 0 5px rgba(0,229,160,0.2)); } }
@keyframes neonPulse { 0% { filter: drop-shadow(0 0 5px var(--pulse-color, rgba(0,229,160,0.2))) brightness(1); } 100% { filter: drop-shadow(0 0 15px var(--pulse-color, rgba(0,229,160,0.6))) brightness(1.1); } }
@keyframes cyberBorderGlow { 0% { border-color: rgba(0,229,160,0.3); box-shadow: inset 0 0 15px rgba(0,229,160,0.1); } 50% { border-color: rgba(0,136,255,0.6); box-shadow: inset 0 0 25px rgba(0,136,255,0.2); } 100% { border-color: rgba(0,229,160,0.3); box-shadow: inset 0 0 15px rgba(0,229,160,0.1); } }
.anim-panel{opacity:0;animation:staggerSlideUp .7s cubic-bezier(0.2,0.8,0.2,1) forwards}
.d0{animation-delay:0s}.d1{animation-delay:.1s}.d2{animation-delay:.2s}.d3{animation-delay:.3s}.d4{animation-delay:.4s}

.kpi-card { transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
.kpi-card:hover { transform: translateY(-3px) scale(1.02); filter: brightness(1.2); cursor: default; }
.flash-update { animation: flashValue 0.5s ease-out; }
            `}</style>

            {/* Background */}
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at top, #0a1120 0%, #000000 70%)" }} />
            <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundImage: "linear-gradient(rgba(0, 229, 160, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 160, 0.02) 1px, transparent 1px)", backgroundSize: "40px 40px", animation: "gridMove 20s linear infinite", pointerEvents: "none" }} />
            <div style={{ position: "fixed", top: "-20%", left: "-10%", width: "50vw", height: "50vw", background: "radial-gradient(circle, rgba(255,77,77,0.04) 0%, rgba(0,0,0,0) 60%)", borderRadius: "50%", filter: "blur(80px)", animation: "orbFloat1 25s ease-in-out infinite alternate", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "fixed", bottom: "-20%", right: "-10%", width: "50vw", height: "50vw", background: "radial-gradient(circle, rgba(0,136,255,0.04) 0%, rgba(0,0,0,0) 60%)", borderRadius: "50%", filter: "blur(80px)", animation: "orbFloat2 30s ease-in-out infinite alternate", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100px", background: "linear-gradient(to bottom, transparent, rgba(255,77,77,0.04), transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 9998 }} />

            <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, color: "#fff", display: "flex", flexDirection: "column" }}>

                {/* ─── NAV BAR ─── */}
                <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", height: 64, background: "rgba(3,7,12,0.8)", borderBottom: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#ff4d4d,#ff8800)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#000", fontWeight: 800, boxShadow: "0 0 20px rgba(255,77,77,0.3)" }}>⬡</div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, color: "#fff" }}>NEXUS <span style={{ color: "#ff4d4d" }}>ADMIN</span></div>
                            <div style={{ fontSize: 8, color: "#5a7a9a", letterSpacing: 2 }}>SERVER CONTROL CENTER</div>
                        </div>
                    </div>

                    {/* Navigation tabs */}
                    <div style={{ display: "flex", gap: 2 }}>
                        {navItems.map(item => (
                            <button key={item} onClick={() => setActiveView(item)} style={{
                                padding: "8px 16px", border: "none", borderRadius: 8, fontSize: 9, fontWeight: 700,
                                letterSpacing: 1, cursor: "pointer", fontFamily: "'Syne',sans-serif",
                                background: activeView === item ? "rgba(255,77,77,0.15)" : "transparent",
                                color: activeView === item ? "#ff4d4d" : "#5a7a9a",
                                borderBottom: activeView === item ? "2px solid #ff4d4d" : "2px solid transparent",
                                transition: "all 0.3s",
                            }}>{item}</button>
                        ))}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 20, background: wsConnected ? "rgba(0,229,160,0.08)" : "rgba(245,197,24,0.08)", border: `1px solid ${wsConnected ? "rgba(0,229,160,0.3)" : "rgba(245,197,24,0.3)"}` }}>
                            <Dot c={wsConnected ? "#00e5a0" : "#f5c518"} pulse={wsConnected} />
                            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: wsConnected ? "#00e5a0" : "#f5c518", fontFamily: "'JetBrains Mono',monospace" }}>{wsConnected ? "LIVE" : "OFFLINE"}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 20, background: "rgba(0,136,255,0.08)", border: "1px solid rgba(0,136,255,0.3)" }}>
                            <span style={{ fontSize: 12 }}>👤</span>
                            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#0088ff", fontFamily: "'JetBrains Mono',monospace" }}>{tabs.length} CLIENT{tabs.length !== 1 ? "S" : ""}</span>
                        </div>
                        <div style={{ padding: "5px 14px", borderRadius: 20, background: "rgba(0,0,0,0.5)", border: "1px solid #1e2d45" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#7a9ab0", fontFamily: "'JetBrains Mono',monospace" }}>{clock}</span>
                        </div>
                        <button onClick={() => {
                            if (confirm("FORCE TERMINATE ALL CLIENT SESSIONS GLOBALLY?")) {
                                session?.wsSend?.({ type: "ADMIN_KILL_SESSION" });
                            }
                        }} style={{ background: "rgba(255,10,10,0.2)", border: "1px solid #ff4d4d", color: "#ff4d4d", borderRadius: 8, padding: "6px 14px", fontSize: 9, fontWeight: 700, letterSpacing: 1, cursor: "pointer", boxShadow: "0 0 10px rgba(255,77,77,0.4)" }}>KILL SESSIONS</button>
                        <button onClick={logout} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#7a9ab0", borderRadius: 8, padding: "6px 14px", fontSize: 9, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>LOGOUT</button>
                    </div>
                </nav>

                {/* ─── EXECUTIVE STRIP ─── */}
                <div style={{ display: "flex", justifyContent: "center", gap: 32, padding: "12px 28px", background: "rgba(5,9,16,0.6)", borderBottom: "1px solid #1e2d4533" }}>
                    {[
                        { label: "SERVER UPTIME", val: `${stats.uptime}%`, c: "#00e5a0" },
                        { label: "ACTIVE SESSIONS", val: String(stats.activeSessions), c: "#0088ff" },
                        { label: "AVG TRUST", val: String(stats.avgTrustScore), c: biometricScore >= 70 ? "#00e5a0" : "#f5c518" },
                        { label: "P95 LATENCY", val: `${stats.p95Latency}ms`, c: stats.p95Latency > 50 ? "#f5c518" : "#00e5a0" },
                        { label: "RISK LEVEL", val: riskLevel, c: riskLevel === "LOW" ? "#00e5a0" : riskLevel === "MEDIUM" ? "#f5c518" : "#ff4d4d" },
                        { label: "THREATS", val: String(stats.blockedThreats), c: stats.blockedThreats > 0 ? "#ff4d4d" : "#00e5a0" },
                        { label: "CLIENTS", val: String(tabs.length), c: "#0088ff" },
                    ].map(s => (
                        <div key={s.label} className="kpi-card" style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 8, letterSpacing: 2, color: "#555", marginBottom: 4 }}>{s.label}</div>
                            <div key={s.val} className="flash-update" style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: "'JetBrains Mono',monospace", display: "inline-block" }}>{s.val}</div>
                        </div>
                    ))}
                </div>

                {/* ─── MAIN CONTENT ─── */}
                <div style={{ padding: "28px", maxWidth: 1600, margin: "0 auto", width: "100%", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>

                    {activeView === "MONITOR" && (
                        <>
                            {/* Row 1: Trust + Biometrics + Risk */}
                            <div className="anim-panel d0" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                                <TrustScoreChart history={trustHistory} />
                                <BiometricRadar scores={{ 
                                    keystrokeRhythm: Math.max(50, Math.min(100, stats.avgTrustScore - 2)), 
                                    mouseVelocity: Math.max(50, Math.min(100, stats.avgTrustScore - 8)), 
                                    scrollPattern: Math.max(50, Math.min(100, stats.avgTrustScore - 11)), 
                                    clickPattern: Math.max(50, Math.min(100, stats.avgTrustScore - 4)), 
                                    dwellTime: Math.max(50, Math.min(100, stats.avgTrustScore + 2)) 
                                }} />
                                <RiskMonitor riskLevel={riskLevel} adaptedTimeout={adaptedTimeout} remaining={remaining} riskFactors={riskFactors} />
                            </div>

                            {/* Row 2: Connected Clients + System Status */}
                            <div className="anim-panel d1" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
                                <ConnectedClientsPanel tabs={tabs} />
                                <SystemStatusPanel stats={stats} wsConnected={wsConnected} />
                            </div>

                            {/* Row 3: Activity Feed */}
                            <div className="anim-panel d2">
                                <ServerActivityFeed activities={clientActivities} />
                            </div>
                        </>
                    )}

                    {activeView === "THREATS" && (
                        <div className="anim-panel d0">
                            <ThreatFeedPanel threats={threats} />
                        </div>
                    )}

                    {activeView === "TRANSACTIONS" && (
                        <div className="anim-panel d0">
                            <TransactionMonitor transactions={transactions} txnVolume={txnVolume} />
                        </div>
                    )}

                    {activeView === "POLICIES" && (
                        <div className="anim-panel d0" style={{ maxWidth: 600 }}>
                            <PolicyPanel updatePolicies={updatePolicies} />
                        </div>
                    )}

                    {activeView === "AUDIT LOG" && (
                        <div className="anim-panel d0">
                            <AuditLogPanel logs={sessionLog} />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
