// components/session/NexusDashboard.jsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSessionEngine } from "./SessionProvider";
import Head from "next/head";

// ─── UTILS ────────────────────────────────────────────────────────────────────
function fmt(s) {
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}:${rs < 10 ? "0" : ""}${rs} `;
}

const Tag = ({ c, children, onClick }) => (
  <span onClick={onClick} style={{
    background: `${c} 15`, border: `1px solid ${c} 33`, color: c, padding: "3px 8px", cursor: onClick ? "pointer" : "default",
    borderRadius: 6, fontSize: 9, fontWeight: 700, letterSpacing: 1, fontFamily: "'JetBrains Mono',monospace",
    whiteSpace: "nowrap", transition: "all 0.2s"
  }}>
    {children}
  </span>
);

const Dot = ({ c, pulse }) => (
  <span style={{
    width: 6, height: 6, borderRadius: "50%", background: c, display: "inline-block",
    boxShadow: `0 0 10px ${c} `, animation: pulse ? "ping 1.5s ease-out infinite" : "none"
  }} />
);

// ─── NEW COMPONENTS ───────────────────────────────────────────────────────────

// 1. Executive Strip
function ExecutiveStrip({ stats }) {
  const [prev, setPrev] = useState(stats);
  useEffect(() => { setPrev(stats); }, [stats]);

  const kpis = [
    { label: "SYS UPTIME", val: `${stats.uptime}% `, c: "#00e5a0" },
    { label: "ACTIVE SESSIONS", val: stats.activeSessions, c: "#00c8b0", prevVal: prev.activeSessions },
    { label: "AVG TRUST", val: stats.avgTrustScore, c: "#a78bfa", prevVal: prev.avgTrustScore },
    { label: "P95 LATENCY", val: `${stats.p95Latency} ms`, c: stats.p95Latency > 30 ? "#f5c518" : "#00e5a0" },
    { label: "THREATS BLOCKED", val: stats.blockedThreats, c: "#ff4d4d", prevVal: prev.blockedThreats },
  ];

  return (
    <div style={{ display: "flex", gap: 20, padding: "12px 28px", background: "#050910", borderBottom: "1px solid #1a2332", overflowX: "auto" }}>
      {kpis.map((k, i) => {
        const changed = k.prevVal !== undefined && k.val !== k.prevVal;
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", minWidth: 100 }}>
            <span style={{ fontSize: 8, letterSpacing: 2, color: "#3a5070", marginBottom: 4 }}>{k.label}</span>
            <span style={{
              fontSize: 16, fontWeight: 800, color: k.c, fontFamily: "'JetBrains Mono',monospace",
              animation: changed ? `flashValue 1s ease` : "none"
            }}>{k.val}</span>
          </div>
        )
      })}
    </div>
  );
}

// 2. Threat Feed
function ThreatFeed({ threats }) {
  return (
    <div className="anim-panel anim-slide-up d2" style={{ background: "rgba(10, 21, 32, 0.6)", backdropFilter: "blur(12px)", border: "1px solid #1e2d45", borderRadius: 14, padding: "18px", height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>THREAT INTELLIGENCE FEED</div>
        <Dot c="#ff4d4d" pulse />
      </div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
        {threats.map((t, i) => {
          const c = t.severity === "CRITICAL" ? "#ff4d4d" : t.severity === "HIGH" ? "#ff7a50" : t.severity === "MEDIUM" ? "#f5c518" : "#5a7a9a";
          return (
            <div key={i} style={{ display: "flex", gap: 10, padding: "10px", background: i === 0 ? `${c} 11` : "transparent", border: `1px solid ${i === 0 ? c + '33' : '#1e2d4533'} `, borderRadius: 10, animation: i === 0 ? "slideDown 0.3s ease-out" : "none" }}>
              <div style={{ fontSize: 10, color: c, fontWeight: "bold", fontFamily: "monospace", flexShrink: 0 }}>{t.time}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#fff", fontWeight: 600 }}>{t.action}</span>
                  <Tag c={c}>{t.severity}</Tag>
                </div>
                <div style={{ fontSize: 11, color: "#7a9ab0", lineHeight: 1.4 }}>{t.detail}</div>
              </div>
            </div>
          )
        })}
        {threats.length === 0 && <div style={{ textAlign: "center", color: "#555", fontSize: 11, margin: "auto" }}>No recent threats</div>}
      </div>
    </div>
  );
}

// 3. Trust Score Chart (SVG Area)
function TrustScoreChart({ history }) {
  const points = history.map((val, i) => `${(i / Math.max(1, history.length - 1)) * 100},${100 - val} `).join(" ");
  const areaPoints = `0, 100 ${points} 100, 100`;
  const curr = history[history.length - 1] || 0;
  const c = curr > 80 ? "#00e5a0" : curr > 60 ? "#f5c518" : "#ff4d4d";

  return (
    <div className="anim-panel anim-scale-in d1" style={{ background: "rgba(10, 21, 32, 0.6)", backdropFilter: "blur(12px)", border: `1px solid ${c} 44`, borderRadius: 14, padding: "18px", position: "relative", overflow: "hidden", boxShadow: `inset 0 0 40px ${c} 0a` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, position: "relative", zIndex: 2 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>LIVE TRUST TRAJECTORY</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: c, fontFamily: "monospace", textShadow: `0 0 10px ${c} 66` }}>{curr}</div>
      </div>
      <div style={{ height: 60, width: "100%", position: "relative", zIndex: 1 }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="trustGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity="0.4" />
              <stop offset="100%" stopColor={c} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill="url(#trustGrad)" style={{ transition: "all 0.5s" }} />
          <polyline points={points} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "all 0.5s", filter: `drop - shadow(0 0 4px ${c}88)` }} />
          {history.length > 0 && (
            <circle cx="100" cy={100 - curr} r="3" fill="#fff" stroke={c} strokeWidth="2" style={{ transition: "all 0.5s" }} />
          )}
        </svg>
      </div>
      {/* Grid lines */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "30%", width: "100%", height: 1, background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", top: "60%", width: "100%", height: 1, background: "rgba(255,255,255,0.05)" }} />
      </div>
    </div>
  );
}

// 7. Radar Biometrics Chart
function RadarBiometrics({ scores }) {
  // scores: { keystroke, mouse, scroll, click, dwell }
  const r = 40;
  const cx = 50, cy = 50;
  const vals = [scores.keystroke, scores.mouse, scores.scroll, scores.click, scores.dwell];
  const labels = ["KEY", "MOUSE", "SCROLL", "CLICK", "DWELL"];

  const getPt = (val, i) => {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const dist = (val / 100) * r;
    return `${cx + Math.cos(angle) * dist},${cy + Math.sin(angle) * dist} `;
  };

  const points = vals.map((v, i) => getPt(v, i)).join(" ");
  const basePoints = vals.map((_, i) => getPt(100, i)).join(" ");
  const avg = vals.reduce((a, b) => a + b, 0) / 5;
  const tc = avg > 80 ? "#00e5a0" : avg > 60 ? "#f5c518" : "#ff4d4d";

  return (
    <div className="anim-panel anim-slide-up d2" style={{ background: "rgba(10, 21, 32, 0.6)", backdropFilter: "blur(12px)", border: "1px solid #1e2d45", borderRadius: 14, padding: "18px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>BIOMETRIC VECTORS</div>
        <Tag c={tc}>🧬 {Math.round(avg)} AVG</Tag>
      </div>
      <svg width="180" height="180" viewBox="0 0 100 100" style={{ overflow: "visible" }}>
        {/* Web */}
        {[20, 40, 60, 80, 100].map(p => (
          <polygon key={p} points={vals.map((_, i) => getPt(p, i)).join(" ")} fill="none" stroke="#1e2d45" strokeWidth="0.5" />
        ))}
        {/* Axes */}
        {vals.map((_, i) => (
          <line key={i} x1="50" y1="50" x2={getPt(100, i).split(",")[0]} y2={getPt(100, i).split(",")[1]} stroke="#1e2d45" strokeWidth="1" />
        ))}
        {/* Data polygon */}
        <polygon points={points} fill={`${tc} 33`} stroke={tc} strokeWidth="1.5" style={{ transition: "all 0.5s ease" }} />
        {/* Labels */}
        {labels.map((l, i) => {
          const pt = getPt(115, i).split(",");
          return <text key={l} x={pt[0]} y={pt[1]} fontSize="6" fill="#7a9ab0" textAnchor="middle" dominantBaseline="middle" letterSpacing={1}>{l}</text>
        })}
      </svg>
    </div>
  );
}

// 5. Toast Notifications
function Toaster({ toasts, onDismiss }) {
  return (
    <div style={{ position: "fixed", bottom: 20, right: 28, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
      {toasts.slice(0, 1).map(t => {
        const c = t.type === "success" ? "#00e5a0" : t.type === "warning" ? "#f5c518" : t.type === "danger" ? "#ff4d4d" : "#00c8b0";
        return (
          <div key={t.id} style={{
            background: "rgba(5, 5, 5, 0.9)", backdropFilter: "blur(10px)", border: `1px solid ${c} 44`,
            borderRadius: 12, padding: "14px 18px", width: 320, pointerEvents: "auto",
            boxShadow: `0 10px 30px rgba(0, 0, 0, 0.5), inset 0 0 10px ${c} 11`,
            animation: "slideInRight 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
            position: "relative", overflow: "hidden"
          }} onClick={() => onDismiss(t.id)}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: c }}>{t.title}</span>
              <span style={{ fontSize: 9, color: "#555", fontFamily: "monospace" }}>{t.time}</span>
            </div>
            <div style={{ fontSize: 12, color: "#a0c0d8", lineHeight: 1.4 }}>{t.message}</div>
            <div style={{ position: "absolute", bottom: 0, left: 0, height: 2, background: c, animation: "shrinkWidth 6s linear forwards" }} />
          </div>
        );
      })}
    </div>
  );
}

// 6. User Profile Dropdown
function ProfileDropdown({ elapsed, volume, onLogout }) {
  return (
    <div style={{
      position: "absolute", top: 50, right: 0, width: 260, background: "rgba(5,9,16,0.95)",
      backdropFilter: "blur(20px)", border: "1px solid #1a2332", borderRadius: 14,
      boxShadow: "0 20px 50px rgba(0,0,0,0.8)", padding: 18, zIndex: 1000,
      animation: "scaleInTopRight 0.2s ease-out"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#00e5a0,#0088ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: "bold", color: "#000" }}>R</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Ramsey Logistics</div>
          <div style={{ fontSize: 10, color: "#5a7a9a" }}>Fleet Manager Pro</div>
        </div>
      </div>
      <div style={{ background: "#050505", borderRadius: 8, padding: 12, marginBottom: 16, border: "1px solid #111" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: "#555" }}>SESSION DURATION</span>
          <span style={{ fontSize: 11, color: "#00e5a0", fontFamily: "monospace" }}>{elapsed}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, color: "#555" }}>TXN VOLUME</span>
          <span style={{ fontSize: 11, color: "#f5c518", fontFamily: "monospace" }}>₹{(volume / 100000).toFixed(2)}L</span>
        </div>
      </div>
      <button style={{ width: "100%", padding: 10, background: "#111", border: "1px solid #1a1a1a", borderRadius: 8, color: "#fff", fontSize: 11, marginBottom: 8, cursor: "pointer", transition: "all 0.2s" }} className="hover-btn">Settings & Policies</button>
      <button onClick={onLogout} style={{ width: "100%", padding: 10, background: "#ff4d4d15", border: "1px solid #ff4d4d33", borderRadius: 8, color: "#ff4d4d", fontSize: 11, cursor: "pointer", transition: "all 0.2s" }} className="hover-btn">Terminate Session</button>
    </div>
  );
}

// ─── EXISTING MODIFIED COMPONENTS ──────────────────────────────────────────────

function RingTimer({ remaining, total, warn, crit }) {
  const r = 50, circ = 2 * Math.PI * r;
  const pct = remaining / total, dash = circ * pct;
  const c = crit ? "#ff4d4d" : warn ? "#f5c518" : "#00e5a0";
  return (
    <svg width="130" height="130" viewBox="0 0 130 130" style={{ filter: `drop-shadow(0 0 14px ${c}44)` }}>
      <circle cx="65" cy="65" r={r} fill="none" stroke="#0d1726" strokeWidth="9" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={c} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ} `} strokeDashoffset={circ * .25}
        style={{ transition: "stroke-dasharray .8s cubic-bezier(.4,0,.2,1),stroke .4s" }} />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12 * 360 - 90) * Math.PI / 180;
        return <line key={i} x1={65 + 43 * Math.cos(a)} y1={65 + 43 * Math.sin(a)} x2={65 + 47 * Math.cos(a)} y2={65 + 47 * Math.sin(a)} stroke="#1a2b3f" strokeWidth="1.5" />;
      })}
      <text x="65" y="60" textAnchor="middle" fill={c} fontSize="20" fontWeight="700" fontFamily="'JetBrains Mono',monospace">{fmt(remaining)}</text>
      <text x="65" y="76" textAnchor="middle" fill="#3a5070" fontSize="8" fontFamily="'JetBrains Mono',monospace" letterSpacing="2">SESSION</text>
    </svg>
  );
}

function RiskAdaptivePanel({ riskLevel, adaptedTimeout, baseTimeout, factors }) {
  const c = riskLevel === "LOW" ? "#00e5a0" : riskLevel === "MEDIUM" ? "#f5c518" : "#ff4d4d";
  const pct = Math.round((adaptedTimeout / baseTimeout) * 100);
  return (
    <div className="anim-panel anim-scale-in d3" style={{ background: "rgba(10, 21, 32, 0.6)", backdropFilter: "blur(12px)", border: `1px solid ${c} 33`, borderRadius: 14, padding: "18px", boxShadow: `inset 0 0 30px ${c}08`, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>DYNAMIC TIMEOUT</div>
        <Tag c={c}>⬟ {riskLevel}</Tag>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, textAlign: "center", background: "#050910", borderRadius: 10, padding: "10px", border: "1px solid #1a2332" }}>
          <div style={{ fontSize: 9, color: "#555", letterSpacing: 1, marginBottom: 4 }}>BASE</div>
          <div style={{ fontFamily: "monospace", fontSize: 16, color: "#777" }}>{fmt(baseTimeout)}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", color: "#444", fontSize: 14 }}>→</div>
        <div style={{ flex: 1, textAlign: "center", background: `${c} 11`, border: `1px solid ${c} 33`, borderRadius: 10, padding: "10px" }}>
          <div style={{ fontSize: 9, color: c, letterSpacing: 1, marginBottom: 4 }}>ADAPTED</div>
          <div style={{ fontFamily: "monospace", fontSize: 16, color: c, fontWeight: 700 }}>{fmt(adaptedTimeout)}</div>
        </div>
      </div>
      <div style={{ height: 4, background: "#111", borderRadius: 2, marginBottom: 14, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}% `, background: c, borderRadius: 2, transition: "width 1s cubic-bezier(0.2, 0.8, 0.2, 1)" }} />
      </div>
      <div style={{ fontSize: 9, color: "#3a5070", letterSpacing: 2, marginBottom: 8 }}>ACTIVE RISK FACTORS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {factors.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", background: "#050910", padding: "6px 10px", borderRadius: 8, border: "1px solid #111823" }}>
            <span style={{ fontSize: 9, color: f.impact === "+" ? "#ff4d4d" : "#00e5a0" }}>{f.impact === "+" ? "▲" : "▼"}</span>
            <span style={{ fontSize: 10, color: "#7a9ab0", flex: 1 }}>{f.label}</span>
            <span style={{ fontSize: 10, color: f.impact === "+" ? "#ff4d4d" : "#00e5a0", fontFamily: "monospace", fontWeight: 700 }}>{f.impact}{f.delta}s</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CrossTabPanel({ tabs, onKillTab }) {
  return (
    <div className="anim-panel anim-scale-in d4" style={{ background: "rgba(10, 21, 32, 0.6)", backdropFilter: "blur(12px)", border: "1px solid #1e2d45", borderRadius: 14, padding: "18px", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>CROSS-TAB SESSIONS</div>
        <Tag c="#00c8b0">{tabs.length} TABS</Tag>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tabs.map(tab => (
          <div key={tab.id} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
            background: tab.active ? "rgba(0, 200, 176, 0.05)" : "#050910", borderRadius: 10,
            border: tab.idle ? "1px solid #ff4d4d33" : tab.active ? "1px solid #00c8b033" : "1px solid #1a2332",
            transition: "all 0.3s"
          }}>
            <Dot c={tab.idle ? "#ff4d4d" : tab.active ? "#00e5a0" : "#f5c518"} pulse={tab.active} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: tab.active ? "#fff" : "#7a9ab0", fontWeight: tab.active ? 600 : 400 }}>{tab.title}</div>
              <div style={{ fontSize: 9, color: "#4a6080", fontFamily: "monospace", marginTop: 2 }}>{tab.route} · act: {tab.lastAct}</div>
            </div>
            {!tab.active && (
              <button onClick={() => onKillTab(tab.id)} style={{
                background: "#ff4d4d15", border: "1px solid #ff4d4d33", color: "#ff4d4d",
                borderRadius: 6, padding: "4px 12px", fontSize: 9, cursor: "pointer", letterSpacing: 1,
                transition: "all 0.2s"
              }} className="hover-btn">KILL</button>
            )}
            {tab.active && <Tag c="#00c8b0">THIS TAB</Tag>}
          </div>
        ))}
      </div>
    </div>
  );
}

function GeoFenceMap({ threatLevel }) {
  const zones = [
    { name: "Mumbai HQ", x: 62, y: 52, r: 8, c: "#00e5a0", trusted: true, you: true },
    { name: "Delhi Office", x: 55, y: 38, r: 7, c: "#00e5a0", trusted: true, you: false },
    { name: "Bangalore", x: 55, y: 62, r: 6, c: "#00e5a0", trusted: true, you: false },
    { name: "Anomaly", x: 30, y: 30, r: 12, c: "#ff4d4d", trusted: false, you: false },
  ];
  const c = threatLevel === "CLEAR" ? "#00e5a0" : "#ff4d4d";
  return (
    <div className="anim-panel anim-slide-right d5" style={{ background: "rgba(10, 21, 32, 0.6)", backdropFilter: "blur(12px)", border: `1px solid ${c} 33`, borderRadius: 14, padding: "18px", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>GEO-FENCE TRUST</div>
        <Tag c={c}>{threatLevel === "CLEAR" ? "CLEAR" : "ANOMALY"}</Tag>
      </div>
      <div style={{ position: "relative", background: "#03060a", borderRadius: 10, overflow: "hidden", flex: 1, border: "1px solid #111823", minHeight: 140 }}>
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={`h${i} `} x1="0" y1={`${(i + 1) * 12.5}% `} x2="100%" y2={`${(i + 1) * 12.5}% `} stroke="#1e2d4522" strokeWidth="1" />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <line key={`v${i} `} x1={`${(i + 1) * 10}% `} y1="0" x2={`${(i + 1) * 10}% `} y2="100%" stroke="#1e2d4522" strokeWidth="1" />
          ))}
          {threatLevel !== "CLEAR" && (
            <>
              <circle cx="30%" cy="30%" r="20%" fill="url(#anomalyGrad)" opacity="0.5" />
              <circle cx="30%" cy="30%" r="18%" fill="none" stroke="#ff4d4d" strokeWidth="1" opacity="0.4" style={{ animation: "ping 2s ease-out infinite" }} />
              <circle cx="30%" cy="30%" r="12%" fill="none" stroke="#ff4d4d" strokeWidth="1.5" opacity="0.6" style={{ animation: "ping 2s ease-out .5s infinite" }} />
              <line x1="30%" y1="30%" x2="62%" y2="52%" stroke="#ff4d4d55" strokeWidth="1.5" strokeDasharray="4,4" style={{ animation: "dashMove 1s linear infinite" }} />
            </>
          )}
          <defs>
            <radialGradient id="anomalyGrad">
              <stop offset="0%" stopColor="#ff4d4d" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ff4d4d" stopOpacity="0" />
            </radialGradient>
          </defs>
          {zones.filter(z => z.trusted).map((z, i) => (
            <line key={i} x1="62%" y1="52%" x2={`${z.x}% `} y2={`${z.y}% `} stroke="#00e5a044" strokeWidth="1.5" strokeDasharray="4,4" style={{ animation: "dashMove 2s linear infinite reverse" }} />
          ))}
          {threatLevel === "CLEAR" && (
            <circle cx="62%" cy="52%" r="25%" fill="none" stroke="#00e5a0" strokeWidth="1" opacity="0.1" style={{ animation: "ping 3s ease-out infinite" }} />
          )}
          {zones.map((z, i) => (
            <g key={i} className="hover-zone" style={{ cursor: "pointer", transition: "all 0.2s" }}>
              <circle cx={`${z.x}% `} cy={`${z.y}% `} r={z.r} fill={`${z.c} 22`} stroke={z.c} strokeWidth="1.5" style={{ transition: "r 0.2s" }} />
              {z.you && <circle cx={`${z.x}% `} cy={`${z.y}% `} r="3.5" fill={z.c} />}
              {!z.trusted && threatLevel !== "CLEAR" && <text x={`${z.x}% `} y={`${z.y}% `} textAnchor="middle" dominantBaseline="middle" fontSize="10">⚠</text>}
              <text x={`${z.x}% `} y={`${z.y + 12}% `} textAnchor="middle" fill={z.c} fontSize="8" fontFamily="monospace" opacity="0.8">{z.name}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function ReplayTimeline({ events, scrub, onScrub }) {
  return (
    <div className="anim-panel anim-slide-left d6" style={{ background: "rgba(10, 21, 32, 0.6)", backdropFilter: "blur(12px)", border: "1px solid #1e2d45", borderRadius: 14, padding: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>SESSION REPLAY SCRUBBER</div>
        <Tag c="#f5c518">REC ●</Tag>
      </div>
      <div style={{ position: "relative", marginBottom: 16 }}>
        <div style={{ height: 4, background: "#050910", borderRadius: 2, position: "relative", border: "1px solid #111823" }}>
          <div style={{ height: "100%", width: `${scrub}% `, background: "linear-gradient(90deg,#0088ff,#00e5a0)", borderRadius: 2, transition: "width .1s", boxShadow: "0 0 15px #00e5a066" }} />
          {events.map((e, i) => {
            const tc = e.type === "success" ? "#00e5a0" : e.type === "warn" ? "#f5c518" : e.type === "now" ? "#fff" : "#5a7a9a";
            return (
              <div key={i} title={e.label} style={{
                position: "absolute", left: `${e.pct}% `, top: "50%", transform: "translate(-50%,-50%)",
                width: e.type === "now" ? 12 : 8, height: e.type === "now" ? 12 : 8,
                borderRadius: "50%", background: tc, cursor: "pointer",
                boxShadow: `0 0 8px ${tc} `, border: `2px solid #000`, zIndex: 2,
                transition: "transform 0.2s"
              }} className="hover-scale" />
            );
          })}
        </div>
        <input type="range" min="0" max="100" value={scrub} onChange={e => onScrub(Number(e.target.value))} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: 20, top: -8 }} />
      </div>
      <div style={{ position: "relative", height: 24 }}>
        {events.map((e, i) => {
          const tc = e.type === "success" ? "#00e5a0" : e.type === "warn" ? "#f5c518" : e.type === "now" ? "#fff" : "#7a9ab0";
          const shouldShow = Math.abs(e.pct - scrub) < 15 || e.type === "now";
          return (
            <div key={i} style={{
              position: "absolute", left: `${e.pct}% `, transform: "translateX(-50%)",
              textAlign: "center", transition: "opacity .3s, transform 0.3s",
              opacity: shouldShow ? 1 : 0, pointerEvents: "none"
            }}>
              <div style={{ fontSize: 13, filter: `drop - shadow(0 0 4px ${tc}88)` }}>{e.icon}</div>
              <div style={{ fontSize: 8, color: tc, letterSpacing: .5, whiteSpace: "nowrap", fontWeight: 600, marginTop: 2 }}>{e.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TransactionsTable({ txns }) {
  const [filter, setFilter] = useState("ALL");
  const filtered = filter === "ALL" ? txns : txns.filter(t => t.status === filter);

  return (
    <div className="anim-panel anim-slide-up d7" style={{ background: "rgba(10, 21, 32, 0.6)", backdropFilter: "blur(12px)", border: "1px solid #1e2d45", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #1e2d45", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>LIVE TRANSACTIONS</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["ALL", "CLEARED", "FLAGGED"].map(f => (
            <Tag key={f} c={filter === f ? "#00e5a0" : "#5a7a9a"} onClick={() => setFilter(f)}>{f}</Tag>
          ))}
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e2d4588", background: "rgba(0,0,0,0.5)" }}>
              {["TXN ID", "TYPE", "ROUTE", "AMOUNT", "RISK", "STATUS"].map(h => (
                <th key={h} style={{ padding: "10px 18px", textAlign: "left", fontSize: 8, letterSpacing: 2, color: "#4a6080" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => {
              const stC = t.status === "CLEARED" || t.status === "DELIVERED" ? "#00e5a0" : t.status === "FLAGGED" ? "#ff4d4d" : "#f5c518";
              const rkC = t.risk === "LOW" ? "#00e5a0" : t.risk === "MEDIUM" ? "#f5c518" : "#ff4d4d";
              return (
                <tr key={t.id} className="txn-row" style={{ borderBottom: "1px solid #1e2d4533", background: i % 2 ? "transparent" : "rgba(255,255,255,0.01)", transition: "all 0.3s", cursor: "pointer" }}>
                  <td style={{ padding: "12px 18px", fontFamily: "monospace", fontSize: 11, color: "#fff", fontWeight: 600 }}>{t.id}</td>
                  <td style={{ padding: "12px 18px", fontSize: 11, color: "#a0c0d8" }}>{t.type}</td>
                  <td style={{ padding: "12px 18px", fontFamily: "monospace", fontSize: 11, color: "#5a7a9a" }}>{t.route}</td>
                  <td style={{ padding: "12px 18px", fontFamily: "monospace", fontSize: 12, color: "#00e5a0", fontWeight: 700 }}>{t.amount}</td>
                  <td style={{ padding: "12px 18px" }}><Tag c={rkC}>{t.risk}</Tag></td>
                  <td style={{ padding: "12px 18px", fontSize: 10, color: stC, fontFamily: "monospace", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Dot c={stC} pulse={t.status === "IN TRANSIT"} /> {t.status}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 20, color: "#555", fontSize: 12 }}>No transactions matching filter</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
// ─── POLICIES TAB ─────────────────────────────────────────────────────────────
function PoliciesView({ updatePolicies }) {
  const [deploying, setDeploying] = useState(false);

  const [baseTimeout, setBaseTimeout] = useState(120);
  const [bioDrop, setBioDrop] = useState(60);
  const [geoRadius, setGeoRadius] = useState(50);

  const [toggles, setToggles] = useState({
    strictGeo: true,
    killSync: true,
    threatBlock: true,
    jwtRot: true,
    txnRules: true
  });

  const toggleConfig = [
    { key: "strictGeo", l: "Strict Geo-Fencing (Block Anomalies)", c: "#ff4d4d" },
    { key: "killSync", l: "Cross-Tab Kill Switch Sync", c: "#00c8b0" },
    { key: "threatBlock", l: "Threat IP Auto-Block", c: "#f5c518" },
    { key: "jwtRot", l: "Enforce JWT Rotation (5m)", c: "#00e5a0" },
    { key: "txnRules", l: "Logistics TXN Value Rules", c: "#a78bfa" }
  ];

  const handleDeploy = () => {
    setDeploying(true);
    updatePolicies(baseTimeout, bioDrop, geoRadius, toggles);
    setTimeout(() => setDeploying(false), 1500);
  };

  return (
    <div className="anim-panel anim-slide-up d0" style={{ padding: "28px", maxWidth: 1000, margin: "0 auto", width: "100%" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>SESSION POLICIES</h2>
        <p style={{ fontSize: 13, color: "#7a9ab0", lineHeight: 1.6 }}>Configure global logistics risk parameters and biometric thresholds. Changes take effect on the next WebSocket tick.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        <div style={{ background: "rgba(10, 21, 32, 0.6)", backdropFilter: "blur(12px)", border: "1px solid #1e2d45", borderRadius: 14, padding: "24px" }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#00e5a0", marginBottom: 20, fontWeight: 700 }}>TIMEOUT & BIOMETRIC RULES</div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "#a0c0d8" }}>Base Session Timeout</span>
              <span style={{ fontSize: 11, color: "#00e5a0", fontFamily: "monospace" }}>{baseTimeout} mins</span>
            </div>
            <input type="range" min="15" max="240" value={baseTimeout} onChange={e => setBaseTimeout(Number(e.target.value))} style={{ width: "100%", accentColor: "#00e5a0", cursor: "pointer" }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "#a0c0d8" }}>Biometric Drop Threshold</span>
              <span style={{ fontSize: 11, color: "#ff4d4d", fontFamily: "monospace" }}>Score &lt; {bioDrop}</span>
            </div>
            <input type="range" min="30" max="90" value={bioDrop} onChange={e => setBioDrop(Number(e.target.value))} style={{ width: "100%", accentColor: "#ff4d4d", cursor: "pointer" }} />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "#a0c0d8" }}>Geo-Fence Radius</span>
              <span style={{ fontSize: 11, color: "#f5c518", fontFamily: "monospace" }}>{geoRadius} km</span>
            </div>
            <input type="range" min="5" max="500" value={geoRadius} onChange={e => setGeoRadius(Number(e.target.value))} style={{ width: "100%", accentColor: "#f5c518", cursor: "pointer" }} />
          </div>
        </div>

        <div style={{ background: "rgba(10, 21, 32, 0.6)", backdropFilter: "blur(12px)", border: "1px solid #1e2d45", borderRadius: 14, padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#00c8b0", marginBottom: 4, fontWeight: 700 }}>ACTIVE ENFORCEMENT TOGGLES</div>

          {toggleConfig.map((t, i) => {
            const isOn = toggles[t.key];
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(0,0,0,0.3)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 11, color: "#fff" }}>{t.l}</span>
                <div
                  onClick={() => setToggles(p => ({ ...p, [t.key]: !p[t.key] }))}
                  style={{ width: 36, height: 20, borderRadius: 10, background: isOn ? t.c : "#333", position: "relative", cursor: "pointer", transition: "background 0.3s" }}
                >
                  <div style={{ position: "absolute", top: 2, left: isOn ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.3s", boxShadow: "0 2px 5px rgba(0,0,0,0.5)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={handleDeploy} className="hover-btn" style={{
          padding: "14px 32px", background: deploying ? "#050910" : "linear-gradient(135deg,#00e5a0,#00c8b0)",
          border: deploying ? "1px solid #00e5a0" : "none", color: deploying ? "#00e5a0" : "#000",
          borderRadius: 10, fontSize: 13, fontWeight: 800, letterSpacing: 1.5, cursor: "pointer",
          boxShadow: deploying ? "none" : "0 10px 25px rgba(0,229,160,0.3)", transition: "all 0.3s",
          display: "flex", alignItems: "center", gap: 8
        }}>
          {deploying ? <><Dot c="#00e5a0" pulse /> DEPLOYING...</> : "DEPLOY POLICIES →"}
        </button>
      </div>
    </div>
  );
}

// ─── AUDIT LOG TAB ────────────────────────────────────────────────────────────
function AuditLogView({ logs }) {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const filtered = logs.filter(l => {
    if (filter !== "ALL" && l.type !== filter.toLowerCase()) return false;
    const text = l.msg || "";
    if (search && !text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      const csv = "TIME,SEVERITY,MESSAGE\n" + filtered.map(l => `${l.t || l.time},${l.type.toUpperCase()}, "${l.msg}"`).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `nexus_audit_${Date.now()}.csv`;
      a.click();
      setExporting(false);
    }, 800);
  };

  return (
    <div className="anim-panel anim-slide-up d0" style={{ padding: "28px", maxWidth: 1200, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>SYSTEM AUDIT LOG</h2>
          <p style={{ fontSize: 13, color: "#7a9ab0", lineHeight: 1.6 }}>Immutable ledger of all session events, biometric evaluations, and threat interventions.</p>
        </div>
        <button onClick={handleExport} className="hover-btn" style={{
          padding: "10px 20px", background: "rgba(0,0,0,0.5)", border: "1px solid #1e2d45",
          color: exporting ? "#00e5a0" : "#a0c0d8", borderRadius: 8, fontSize: 11, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s"
        }}>
          {exporting ? "EXPORTING..." : "⭳ EXPORT TO CSV"}
        </button>
      </div>

      <div style={{ background: "rgba(10, 21, 32, 0.6)", backdropFilter: "blur(12px)", border: "1px solid #1e2d45", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e2d45", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.3)" }}>
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ background: "#050910", border: "1px solid #1e2d45", padding: "8px 14px", borderRadius: 8, color: "#fff", fontSize: 12, width: 300, outline: "none" }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            {["ALL", "SUCCESS", "INFO", "WARN", "DANGER"].map(f => (
              <Tag key={f} c={filter === f ? (f === "WARN" ? "#f5c518" : f === "DANGER" ? "#ff4d4d" : f === "SUCCESS" ? "#00e5a0" : "#00c8b0") : "#5a7a9a"} onClick={() => setFilter(f)}>{f}</Tag>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 20px" }}>
          {filtered.map((l, i) => {
            const c = l.type === "success" ? "#00e5a0" : l.type === "warn" ? "#f5c518" : l.type === "danger" ? "#ff4d4d" : "#5a7a9a";
            return (
              <div key={i} style={{ display: "flex", gap: 16, padding: "12px 0", borderBottom: "1px solid #1e2d4533", alignItems: "center", animation: "slideInRight 0.3s ease-out" }}>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "#4a6080", flexShrink: 0 }}>{l.t || l.time}</span>
                <div style={{ width: 80 }}><Tag c={c}>{l.type.toUpperCase()}</Tag></div>
                <span style={{ fontSize: 12, color: "#fff" }}>{l.msg}</span>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#555", fontSize: 13 }}>No log entries found.</div>}
        </div>
      </div>
    </div>
  );
}

// ─── COMPARISON TAB ───────────────────────────────────────────────────────────
function CompareView() {
  const COMPARISON = [
    { feature: "Continuous BIOMETRIC Authentication", nexus: "✓ Live scoring (Key/Mouse/Scroll)", okta: "✗ Pre-auth only", azure: "✗ Risk-based IP/Location", ping: "✗ Pre-auth only", aws: "✗ Basic auth" },
    { feature: "Logistics-centric RISK Engine", nexus: "✓ TXN Value + Route checks", okta: "✗ Standard IAM", azure: "✗ Standard IAM", ping: "✗ Standard IAM", aws: "✗ Standard IAM" },
    { feature: "Real-time ADAPTIVE Timeout", nexus: "✓ Adjusts based on live risk", okta: "✗ Fixed timeout", azure: "✗ Fixed timeout", ping: "✗ Fixed timeout", aws: "✗ Fixed timeout" },
    { feature: "Cross-tab Session SYNC & KILL", nexus: "✓ Built-in Broadcast Channel", okta: "✗ Cookie-based", azure: "✗ Cookie-based", ping: "✗ Cookie-based", aws: "✗ Cookie-based" },
    { feature: "Live Session REPLAY", nexus: "✓ High-fidelity timeline", okta: "✗ Text logs only", azure: "✗ Basic logs", ping: "✗ Text logs only", aws: "✗ Basic logs" },
    { feature: "Geo-Fence Anomaly Tracking", nexus: "✓ Live map with pulse rings", okta: "✓ Geo-blocking", azure: "✓ Conditional Access", ping: "✓ Geo-blocking", aws: "✗ Basic" },
  ];

  return (
    <div className="anim-panel anim-slide-up d0" style={{ padding: "28px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>NEXUS TLS vs INDUSTRY</h2>
        <p style={{ fontSize: 13, color: "#7a9ab0", lineHeight: 1.6 }}>Comparing session management capabilities across the leading identity & access management platforms. NEXUS TLS is the only solution combining domain-specific logistics rules, live behavioural biometrics, and risk-adaptive timeouts in a single platform.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16, marginBottom: 32 }}>
        {[
          { name: "NEXUS TLS", score: 10, c: "#00e5a0", label: "Our Solution" },
          { name: "Okta", score: 7, c: "#f5c518", label: "Industry Leader" },
          { name: "Azure AD", score: 7, c: "#f5c518", label: "Enterprise" },
          { name: "Ping ID", score: 6, c: "#f5c518", label: "Enterprise" },
          { name: "AWS Cognito", score: 5, c: "#5a7a9a", label: "Cloud Native" },
        ].map(s => (
          <div key={s.name} style={{ background: "rgba(10, 21, 32, 0.6)", backdropFilter: "blur(12px)", border: `1px solid ${s.c} 33`, borderRadius: 14, padding: "20px", textAlign: "center", boxShadow: `inset 0 0 20px ${s.c} 0a` }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.c, fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>{s.score}<span style={{ fontSize: 16, color: "#555" }}>/10</span></div>
            <div style={{ fontSize: 13, color: "#fff", fontWeight: 700, marginBottom: 4 }}>{s.name}</div>
            <div style={{ fontSize: 10, color: "#5a7a9a", letterSpacing: 1 }}>{s.label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "rgba(10, 21, 32, 0.6)", backdropFilter: "blur(12px)", border: "1px solid #1e2d45", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e2d45", fontSize: 9, letterSpacing: 3, color: "#555", background: "rgba(0,0,0,0.3)" }}>FEATURE COMPARISON MATRIX</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.5)" }}>
                {["FEATURE", "NEXUS TLS ✦", "OKTA", "AZURE AD", "PING ID", "AWS COGNITO"].map((c, i) => (
                  <th key={c} style={{
                    padding: "14px 20px", textAlign: "left", fontSize: 10, letterSpacing: 1.5,
                    color: i === 1 ? "#00e5a0" : "#4a6080",
                    borderBottom: `1px solid ${i === 1 ? "#00e5a033" : "#1e2d45"} `,
                    background: i === 1 ? "#00e5a008" : "transparent",
                    whiteSpace: "nowrap"
                  }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: "1px solid #1e2d4533", background: ri % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                  {["feature", "nexus", "okta", "azure", "ping", "aws"].map((c, ci) => {
                    const v = row[c];
                    const isNexus = ci === 1;
                    const isCheck = v.startsWith("✓");
                    const isCross = v.startsWith("✗");
                    return (
                      <td key={c} style={{
                        padding: "14px 20px",
                        color: isNexus ? (isCheck ? "#00e5a0" : "#f5c518") : isCross ? "#3a5070" : isCheck ? "#5a7a9a" : "#7a9ab0",
                        fontWeight: isNexus ? 700 : 400,
                        background: isNexus ? "#00e5a006" : "transparent",
                        borderLeft: isNexus ? "1px solid #00e5a022" : "none",
                        borderRight: isNexus ? "1px solid #00e5a022" : "none"
                      }}>{v}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── ARCHITECTURE TAB ─────────────────────────────────────────────────────────
function TechStackView() {
  const TECH_STACK = [
    { layer: "Frontend UI", tech: "Next.js 14 + React", c: "#00e5a0" },
    { layer: "State Sync", tech: "BroadcastChannel API", c: "#00c8b0" },
    { layer: "Real-time", tech: "FastAPI WebSockets", c: "#0088ff" },
    { layer: "Biometrics", tech: "TensorFlow.js Worker", c: "#a78bfa" },
    { layer: "Cache/Lock", tech: "Redis Edge", c: "#ff4d4d" },
    { layer: "Database", tech: "PostgreSQL (Prisma)", c: "#f5c518" },
  ];

  return (
    <div className="anim-panel anim-slide-up d0" style={{ padding: "28px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>SYSTEM ARCHITECTURE</h2>
        <p style={{ fontSize: 13, color: "#7a9ab0", lineHeight: 1.6 }}>Built on high-performance infrastructure designed for the intense demands of real-time logistics monitoring.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 32 }}>
        {TECH_STACK.map((s, i) => (
          <div key={i} className={`anim - panel anim - scale -in d${i + 1} `} style={{ background: "rgba(10, 21, 32, 0.6)", backdropFilter: "blur(12px)", border: `1px solid ${s.c} 33`, borderRadius: 14, padding: "24px", boxShadow: `inset 0 0 15px ${s.c} 0a` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Dot c={s.c} pulse={false} />
              <span style={{ fontSize: 9, letterSpacing: 2, color: s.c }}>{s.layer.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'JetBrains Mono',monospace" }}>{s.tech}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "rgba(10, 21, 32, 0.6)", backdropFilter: "blur(12px)", border: "1px solid #1e2d45", borderRadius: 14, padding: "24px" }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: "#555", marginBottom: 20 }}>DATA FLOW PIPELINE</div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center", padding: "20px 0" }}>
          {[
            { label: "Client Browser", c: "#00e5a0", icon: "🌐" },
            { label: "WAF/CDN", c: "#00c8b0", icon: "🛡️" },
            { label: "FastAPI WS", c: "#0088ff", icon: "⚡" },
            { label: "Risk Engine", c: "#f5c518", icon: "⚖️" },
            { label: "Redis State", c: "#ff4d4d", icon: "💾" },
          ].map((n, i, arr) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ padding: "12px 20px", borderRadius: 12, background: `${n.c} 11`, border: `1px solid ${n.c} 44`, color: n.c, fontSize: 12, fontWeight: 600, display: "flex", gap: 8, alignItems: "center", boxShadow: `0 0 10px ${n.c} 22` }}>
                <span>{n.icon}</span><span>{n.label}</span>
              </div>
              {i < arr.length - 1 && <span style={{ color: "#3a5070", fontSize: 20 }}>→</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP PAGE ────────────────────────────────────────────────────────────

export default function App() {
  let session = null;
  try {
    session = useSessionEngine();
  } catch (e) {
    console.warn("[NexusDashboard] SessionProvider not available, using fallbacks", e);
  }

  const [view, setView] = useState("dashboard");
  const [scrub, setScrub] = useState(100);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifHistory, setNotifHistory] = useState([]);

  // Fallbacks if SessionProvider is not wrapped correctly
  const wsConnected = session?.wsConnected ?? false;
  const wsRemaining = session?.remaining ?? 120;
  const showWarn = session?.showWarning ?? false;
  const stats = session?.systemStats ?? { uptime: 99.97, activeSessions: 142, avgTrustScore: 91, p95Latency: 18, blockedThreats: 12 };
  const threats = session?.threats ?? [];
  const trustHistory = session?.trustHistory ?? [91];
  const scores = {
    keystroke: session?.keystrokeRhythm ?? 88,
    mouse: session?.mouseVelocity ?? 82,
    scroll: session?.scrollPattern ?? 79,
    click: session?.clickPattern ?? 88,
    dwell: session?.dwellTime ?? 92
  };
  const threatLevel = session?.geoAnomaly ? "ANOMALY" : "CLEAR";
  const tabs = session?.tabs ?? [];
  const riskLevel = session?.riskLevel ?? "LOW";
  const adaptedTimeout = session?.adaptedTimeout ?? 120;
  const factors = session?.riskFactors ?? [];
  const liveTimeline = session?.timeline ?? [];
  const liveTxns = session?.transactions ?? [];
  const sessionLog = session?.sessionLog ?? [];

  const sessionExtend = session?.extend ?? (() => { });
  const killTab = session?.killTab ?? (() => { });
  const logout = session?.logout ?? (() => { });
  const dismissToast = session?.dismissNotification ?? (() => { });
  const updatePolicies = session?.updatePolicies ?? (() => { });
  const toasty = session?.notifications ?? [];

  // Accumulate notifications into persistent history
  useEffect(() => {
    if (toasty.length > 0) {
      setNotifHistory(prev => {
        const merged = [...toasty.map(n => ({ ...n, ts: Date.now() })), ...prev];
        return merged.slice(0, 25);
      });
    }
  }, [JSON.stringify(toasty)]);

  // ── Timer: WS sends remaining every 1s — no client interpolation needed ──
  const [displayRemaining, setDisplayRemaining] = useState(wsRemaining);
  const lastWsRef = useRef(wsRemaining);

  // Sync directly with WS (server ticks every 1s now)
  useEffect(() => {
    lastWsRef.current = wsRemaining;
    setDisplayRemaining(wsRemaining);
  }, [wsRemaining]);

  // Wrapped extend — optimistic UI update + backend call
  const extend = () => {
    const target = adaptedTimeout;
    setDisplayRemaining(target);
    lastWsRef.current = target;
    sessionExtend();
  };

  const remaining = displayRemaining;
  const warn = remaining <= 30 && remaining > 10, crit = remaining <= 10;
  const tc = crit ? "#ff4d4d" : warn ? "#f5c518" : "#00e5a0";

  return (
    <>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700;800&display=swap');
        *,*:: before,*::after{ box-sizing: border-box; margin: 0; padding: 0; }
        body{ background:#000000; font-family: 'Syne', sans-serif; overflow-x: hidden; }
        :: -webkit-scrollbar{ width: 6px; height: 6px; }
        :: -webkit-scrollbar-track{ background:#050910; }
        :: -webkit-scrollbar-thumb{ background:#1e2d45; border-radius: 3px; }
        :: -webkit-scrollbar-thumb:hover{ background:#3a5070; }

@keyframes ping{ 0% { transform: scale(1); opacity: .8 }100% { transform: scale(2.4); opacity: 0 } }
@keyframes scanline { 0% { transform: translateY(-100%); opacity: 0; } 50% { opacity: 0.1; } 100% { transform: translateY(100vh); opacity: 0; } }
@keyframes gridMove { 0% { background- position: 0 0; } 100% { background- position: 50px 50px; } }
@keyframes subtleFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes orbFloat1 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(10vw, 15vh) scale(1.1); } }
@keyframes orbFloat2 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-10vw, -15vh) scale(1.1); } }

@keyframes staggerSlideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes staggerScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@keyframes staggerSlideLeft { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
@keyframes staggerSlideRight { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: translateX(0); } }
@keyframes flashValue { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideInRight { from { opacity: 0; transform: translateX(50px); } to { opacity: 1; transform: translateX(0); } }
@keyframes shrinkWidth { from { width: "100%"; } to { width: "0%"; } }
@keyframes scaleInTopRight { from { opacity: 0; transform: scale(0.95) translate(10px, -10px); } to { opacity: 1; transform: scale(1) translate(0, 0); } }
@keyframes dashMove { to { stroke-dashoffset: -8; } }

        .anim-panel { opacity: 0; animation-fill-mode: forwards; animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1); }
        .anim-slide-up { animation-name: staggerSlideUp; animation-duration: .7s; }
        .anim-scale-in { animation-name: staggerScaleIn; animation-duration: .7s; }
        .anim-slide-left { animation-name: staggerSlideLeft; animation-duration: .7s; }
        .anim-slide-right { animation-name: staggerSlideRight; animation-duration: .7s; }
        .d0 { animation-delay: 0s; } .d1 { animation-delay: .1s; } .d2 { animation-delay: .2s; }
        .d3 { animation-delay: .3s; } .d4 { animation-delay: .4s; } .d5 { animation-delay: .5s; }
        .d6 { animation-delay: .6s; } .d7 { animation-delay: .7s; }

        .vnav-btn { position: relative; background: transparent; border: none; cursor: pointer; padding: 10px 16px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 2px; transition: all 0.3s; white-space: nowrap; font-weight: 700; color: #5a7a9a; border-bottom: 2px solid transparent; }
        .vnav-btn.on { color: #00e5a0; border-bottom: 2px solid #00e5a0; text-shadow: 0 0 10px rgba(0,229,160,0.4); background: linear-gradient(to top, rgba(0,229,160,0.1) 0%, transparent 80%); }
        .vnav-btn.off:hover { color: #a0c0d8; border-bottom: 2px solid #3a5070; background: linear-gradient(to top, rgba(255,255,255,0.02) 0%, transparent 80%); }

        .hover-btn:hover { filter: brightness(1.2); transform: translateY(-1px); }
        .txn-row:hover { background: rgba(0, 229, 160, 0.05)!important; box-shadow: inset 0 0 10px rgba(0, 229, 160, 0.1); }
`}</style>

      {/* Background Effects */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at top, #0a1120 0%, #000000 70%)" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundImage: "linear-gradient(rgba(0, 229, 160, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 160, 0.02) 1px, transparent 1px)", backgroundSize: "40px 40px", animation: "gridMove 20s linear infinite", pointerEvents: "none" }} />
      <div style={{ position: "fixed", top: "-20%", left: "-10%", width: "50vw", height: "50vw", background: "radial-gradient(circle, rgba(0,229,160,0.05) 0%, rgba(0,0,0,0) 60%)", borderRadius: "50%", filter: "blur(80px)", animation: "orbFloat1 25s ease-in-out infinite alternate", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "-20%", right: "-10%", width: "50vw", height: "50vw", background: "radial-gradient(circle, rgba(0,136,255,0.04) 0%, rgba(0,0,0,0) 60%)", borderRadius: "50%", filter: "blur(80px)", animation: "orbFloat2 30s ease-in-out infinite alternate", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100px", background: "linear-gradient(to bottom, transparent, rgba(0,229,160,0.05), transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 9998 }} />

      <Toaster toasts={toasty} onDismiss={dismissToast} />

      {/* WARNING OVERLAY — appears at 30 seconds */}
      {(warn || crit) && (
        <div style={{
          position: "fixed", top: 64, left: 0, right: 0, zIndex: 200, padding: "12px 28px",
          background: crit ? "linear-gradient(90deg, rgba(255,20,20,0.2), rgba(255,77,77,0.1))" : "linear-gradient(90deg, rgba(245,197,24,0.15), rgba(255,160,0,0.08))",
          borderBottom: `2px solid ${tc} 66`, backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          animation: crit ? "flashValue 1s infinite" : "none"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>{crit ? "🚨" : "⚠️"}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: tc, letterSpacing: 1 }}>
                {crit ? "CRITICAL — SESSION EXPIRING" : "WARNING — SESSION TIMEOUT APPROACHING"}
              </div>
              <div style={{ fontSize: 11, color: "#a0c0d8" }}>
                {remaining} seconds remaining. {crit ? "Immediate action required." : "Extend now to stay logged in."}
              </div>
            </div>
          </div>
          <button onClick={extend} className="hover-btn" style={{
            padding: "10px 24px", background: `${tc} 22`, border: `1px solid ${tc} 66`, color: tc,
            borderRadius: 8, fontSize: 12, fontWeight: 800, letterSpacing: 1.5, cursor: "pointer",
            boxShadow: `0 0 20px ${tc} 33`, transition: "all 0.2s"
          }}>EXTEND NOW</button>
        </div>
      )}

      <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, color: "#fff", display: "flex", flexDirection: "column" }}>

        {/* NAV */}
        <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", height: 64, background: "rgba(3, 7, 12, 0.8)", borderBottom: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#00e5a0,#0088ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#000", fontWeight: 800, boxShadow: "0 0 20px rgba(0,229,160,0.3)" }}>⬡</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, color: "#fff" }}>NEXUS <span style={{ color: "#00e5a0" }}>TLS</span></div>
              <div style={{ fontSize: 8, color: "#5a7a9a", letterSpacing: 2 }}>ENTERPRISE EDITION</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 2, background: "rgba(10, 21, 32, 0.4)", borderRadius: 8, padding: 4, border: "1px solid #1e2d45", boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)", overflowX: "auto" }}>
            {[{ id: "dashboard", l: "DASHBOARD" }, { id: "policies", l: "POLICIES" }, { id: "audit", l: "AUDIT LOG" }, { id: "compare", l: "COMPARISON" }, { id: "techstack", l: "ARCHITECTURE" }].map(v => (
              <button key={v.id} className={`vnav-btn ${view === v.id ? "on" : "off"}`} onClick={() => setView(v.id)}>{v.l}</button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 20, background: wsConnected ? "rgba(0,229,160,0.08)" : "rgba(245,197,24,0.08)", border: `1px solid ${wsConnected ? "rgba(0,229,160,0.3)" : "rgba(245,197,24,0.3)"} ` }}>
              <Dot c={wsConnected ? "#00e5a0" : "#f5c518"} pulse={wsConnected} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: wsConnected ? "#00e5a0" : "#f5c518", fontFamily: "'JetBrains Mono',monospace" }}>{wsConnected ? "LIVE DATA" : "SIMULATED"}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 16px", background: "rgba(0,0,0,0.5)", border: `1px solid ${tc} 55`, borderRadius: 20, boxShadow: `0 0 20px ${tc} 15` }}>
              <span style={{ fontSize: 9, color: "#7a9ab0", letterSpacing: 2 }}>SESSION</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 800, color: tc, animation: crit ? "flashValue .6s infinite" : "none" }}>{fmt(remaining)}</span>
              <button onClick={extend} className="hover-btn" style={{ background: `${tc} 15`, border: `1px solid ${tc} 44`, color: tc, borderRadius: 6, padding: "3px 10px", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer", transition: "all .2s" }}>EXTEND</button>
            </div>

            <div style={{ position: "relative" }}>
              <div onClick={() => setProfileOpen(!profileOpen)} className="hover-scale" style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#00e5a0,#0088ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: "bold", color: "#000", cursor: "pointer", border: "2px solid rgba(255,255,255,0.1)", boxShadow: "0 0 15px rgba(0,136,255,0.4)" }}>R</div>
              {profileOpen && <ProfileDropdown elapsed={session?.sessionElapsed} volume={session?.txnVolume} onLogout={logout} />}
            </div>
          </div>
        </nav>

        <ExecutiveStrip stats={stats} />

        {/* DASHBOARD CONTENT */}
        {view === "dashboard" && (
          <div style={{ padding: "28px", maxWidth: 1600, margin: "0 auto", width: "100%", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Top Row: Visualizations */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
              {/* Session Integrity */}
              <div className="anim-panel anim-scale-in d0" style={{ background: "rgba(10,21,32,0.6)", backdropFilter: "blur(12px)", border: `1px solid ${tc} 33`, borderRadius: 14, padding: "24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", boxShadow: `inset 0 0 40px ${tc} 0a` }}>
                <div style={{ fontSize: 9, letterSpacing: 3, color: "#555", marginBottom: 16 }}>SESSION INTEGRITY</div>
                <RingTimer remaining={remaining} total={120} warn={warn} crit={crit} />
                <div style={{ marginTop: 20, width: "100%", display: "flex", justifyContent: "space-between", background: "rgba(0,0,0,0.3)", padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 8, color: "#555", letterSpacing: 1.5, marginBottom: 4 }}>JWT ROTATION</div>
                    <div style={{ fontSize: 11, color: "#00e5a0", fontFamily: "monospace", fontWeight: 700 }}>1m 42s</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 8, color: "#555", letterSpacing: 1.5, marginBottom: 4 }}>STATE</div>
                    <div style={{ fontSize: 11, color: tc, fontFamily: "monospace", fontWeight: 700 }}>{crit ? "CRITICAL" : warn ? "WARNING" : "SECURE"}</div>
                  </div>
                </div>
              </div>

              <TrustScoreChart history={trustHistory} />
              <RadarBiometrics scores={scores} />
            </div>

            {/* ── ANALYST INTELLIGENCE ROW ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 20 }}>

              {/* Security Posture Score */}
              <div className="anim-panel anim-slide-up d1" style={{ background: "rgba(10,21,32,0.6)", backdropFilter: "blur(12px)", border: "1px solid #1e2d45", borderRadius: 14, padding: "20px", display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 9, letterSpacing: 3, color: "#555", marginBottom: 12 }}>SECURITY POSTURE</div>
                {(() => {
                  const posture = Math.round((stats.avgTrustScore + scores.keystroke + scores.mouse + scores.click + scores.dwell) / 5);
                  const pColor = posture >= 80 ? "#00e5a0" : posture >= 60 ? "#f5c518" : "#ff4d4d";
                  const pLabel = posture >= 80 ? "STRONG" : posture >= 60 ? "MODERATE" : "WEAK";
                  return (
                    <div style={{ textAlign: "center", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                      <div style={{ fontSize: 48, fontWeight: 900, color: pColor, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1, textShadow: `0 0 30px ${pColor} 44` }}>{posture}</div>
                      <Tag c={pColor} style={{ marginTop: 8 }}>{pLabel}</Tag>
                      <div style={{ width: "100%", marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                        {[
                          { label: "Biometric", val: stats.avgTrustScore },
                          { label: "Keystroke", val: scores.keystroke },
                          { label: "Mouse", val: scores.mouse },
                          { label: "Device Trust", val: Math.max(50, stats.avgTrustScore - 10) }
                        ].map(r => (
                          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 9, color: "#5a7a9a", width: 55, textAlign: "right" }}>{r.label}</span>
                            <div style={{ flex: 1, height: 4, background: "#0a1520", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ width: `${r.val}% `, height: "100%", background: r.val >= 80 ? "#00e5a0" : r.val >= 60 ? "#f5c518" : "#ff4d4d", borderRadius: 2, transition: "width 0.5s" }} />
                            </div>
                            <span style={{ fontSize: 9, color: "#7a9ab0", fontFamily: "monospace", width: 24 }}>{r.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Session Metadata */}
              <div className="anim-panel anim-slide-up d2" style={{ background: "rgba(10,21,32,0.6)", backdropFilter: "blur(12px)", border: "1px solid #1e2d45", borderRadius: 14, padding: "20px", display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 9, letterSpacing: 3, color: "#555", marginBottom: 12 }}>SESSION METADATA</div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { icon: "🌐", label: "IP Address", value: "192.168.1.42", sub: "Private / Trusted" },
                    { icon: "📍", label: "Location", value: "Mumbai, IN", sub: threatLevel === "ANOMALY" ? "⚠ Geo Anomaly!" : "Within Geo-Fence" },
                    { icon: "💻", label: "Device", value: "Windows 11 / Chrome", sub: "Fingerprint: ★ Trusted" },
                    { icon: "🔑", label: "Auth Method", value: "SSO + 2FA TOTP", sub: "Last verified: 3m ago" },
                    { icon: "⏱", label: "Session Age", value: session?.sessionElapsed ?? "00:00:00", sub: `Elapsed since login` },
                  ].map(m => (
                    <div key={m.label} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid #1e2d4533" }}>
                      <span style={{ fontSize: 14 }}>{m.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 9, color: "#5a7a9a", letterSpacing: 1 }}>{m.label}</span>
                          <span style={{ fontSize: 11, color: "#fff", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{m.value}</span>
                        </div>
                        <div style={{ fontSize: 9, color: m.sub?.includes("Anomaly") ? "#ff4d4d" : "#4a6080", marginTop: 2 }}>{m.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Real-Time Activity Monitor */}
              <div className="anim-panel anim-slide-up d3" style={{ background: "rgba(10,21,32,0.6)", backdropFilter: "blur(12px)", border: "1px solid #1e2d45", borderRadius: 14, padding: "20px", display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 9, letterSpacing: 3, color: "#555", marginBottom: 12 }}>ACTIVITY MONITOR</div>
                {(() => {
                  const engagement = Math.min(100, Math.round((scores.click + scores.keystroke + scores.mouse) / 3));
                  const eColor = engagement >= 70 ? "#00e5a0" : engagement >= 40 ? "#f5c518" : "#ff4d4d";
                  const eLabel = engagement >= 70 ? "HIGH" : engagement >= 40 ? "MODERATE" : "LOW";
                  return (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ textAlign: "center", marginBottom: 4 }}>
                        <div style={{ fontSize: 9, color: "#5a7a9a", letterSpacing: 1 }}>ENGAGEMENT LEVEL</div>
                        <div style={{ fontSize: 32, fontWeight: 900, color: eColor, fontFamily: "'JetBrains Mono',monospace" }}>{engagement}%</div>
                        <Tag c={eColor}>{eLabel}</Tag>
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                          { label: "Mouse Activity", val: scores.mouse, icon: "🖱" },
                          { label: "Keyboard Input", val: scores.keystroke, icon: "⌨" },
                          { label: "Click Patterns", val: scores.click, icon: "👆" },
                          { label: "Scroll Behavior", val: scores.scroll, icon: "📜" },
                          { label: "Dwell Analysis", val: scores.dwell, icon: "⏳" }
                        ].map(a => (
                          <div key={a.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 11 }}>{a.icon}</span>
                            <span style={{ fontSize: 9, color: "#5a7a9a", width: 70 }}>{a.label}</span>
                            <div style={{ flex: 1, height: 6, background: "#0a1520", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{
                                width: `${a.val}% `, height: "100%", borderRadius: 3, transition: "width 0.5s ease",
                                background: a.val >= 75 ? "linear-gradient(90deg, #00e5a0, #00c8b0)" : a.val >= 50 ? "linear-gradient(90deg, #f5c518, #ffaa00)" : "linear-gradient(90deg, #ff4d4d, #ff2020)"
                              }} />
                            </div>
                            <span style={{ fontSize: 9, color: "#7a9ab0", fontFamily: "monospace", width: 20 }}>{a.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Risk Breakdown */}
              <div className="anim-panel anim-slide-up d4" style={{ background: "rgba(10,21,32,0.6)", backdropFilter: "blur(12px)", border: "1px solid #1e2d45", borderRadius: 14, padding: "20px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>RISK BREAKDOWN</div>
                  <Tag c={riskLevel === "HIGH" ? "#ff4d4d" : riskLevel === "MEDIUM" ? "#f5c518" : "#00e5a0"}>{riskLevel}</Tag>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  {factors.length > 0 ? factors.map((f, i) => {
                    const fc = f.delta > 0 ? "#ff4d4d" : "#00e5a0";
                    const pct = Math.min(100, Math.abs(f.delta) * 2);
                    return (
                      <div key={i} style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #1e2d4555", borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>{f.label}</span>
                          <span style={{ fontSize: 11, color: fc, fontFamily: "monospace", fontWeight: 700 }}>{f.delta > 0 ? "+" : ""}{f.delta}s</span>
                        </div>
                        <div style={{ height: 3, background: "#0a1520", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${pct}% `, height: "100%", background: fc, borderRadius: 2, transition: "width 0.5s" }} />
                        </div>
                        <div style={{ fontSize: 8, color: "#4a6080", marginTop: 4 }}>{f.impact}</div>
                      </div>
                    );
                  }) : (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 28, opacity: 0.3 }}>🛡️</div>
                      <div style={{ fontSize: 11, color: "#4a6080" }}>No active risk factors</div>
                      <div style={{ fontSize: 9, color: "#3a5070" }}>Session within normal parameters</div>
                    </div>
                  )}
                  <div style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid #1e2d4533", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 9, color: "#5a7a9a" }}>Adapted Timeout</span>
                    <span style={{ fontSize: 11, color: "#00e5a0", fontFamily: "monospace", fontWeight: 700 }}>{fmt(adaptedTimeout)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Row: Operational Controls */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 20, gridAutoRows: "1fr" }}>
              <div style={{ gridColumn: "span 1" }}><ThreatFeed threats={threats} /></div>
              <div style={{ gridColumn: "span 2" }}><RiskAdaptivePanel riskLevel={riskLevel} adaptedTimeout={adaptedTimeout} baseTimeout={120} factors={factors} /></div>
              <div style={{ gridColumn: "span 1" }}><CrossTabPanel tabs={tabs} onKillTab={killTab} /></div>
            </div>

            {/* Bottom Row: Context & Action */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20 }}>
              <GeoFenceMap threatLevel={threatLevel} />
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <ReplayTimeline events={liveTimeline} scrub={scrub} onScrub={setScrub} />
                <TransactionsTable txns={liveTxns} />
              </div>
            </div>

            {/* ── NOTIFICATION FEED ── */}
            <div className="anim-panel anim-slide-up d3" style={{ background: "rgba(10,21,32,0.6)", backdropFilter: "blur(12px)", border: "1px solid #1e2d45", borderRadius: 14, padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🔔</span>
                  <span style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>LIVE NOTIFICATIONS</span>
                  {notifHistory.length > 0 && (
                    <span style={{ background: "#ff4d4d", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 10, padding: "2px 8px", fontFamily: "monospace" }}>{notifHistory.length}</span>
                  )}
                </div>
                {notifHistory.length > 0 && (
                  <button onClick={() => setNotifHistory([])} style={{ background: "rgba(255,77,77,0.1)", border: "1px solid #ff4d4d33", color: "#ff4d4d", borderRadius: 6, padding: "4px 12px", fontSize: 9, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>CLEAR ALL</button>
                )}
              </div>
              <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {notifHistory.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 30, color: "#3a5070" }}>
                    <div style={{ fontSize: 28, opacity: 0.3, marginBottom: 8 }}>🔕</div>
                    <div style={{ fontSize: 11 }}>No notifications yet</div>
                    <div style={{ fontSize: 9, color: "#2a4060", marginTop: 4 }}>Events will appear here in real-time</div>
                  </div>
                ) : notifHistory.map((n, i) => {
                  const nc = n.type === "success" ? "#00e5a0" : n.type === "warning" ? "#f5c518" : n.type === "danger" ? "#ff4d4d" : "#0088ff";
                  const icon = n.type === "success" ? "✅" : n.type === "warning" ? "⚠️" : n.type === "danger" ? "🚨" : "ℹ️";
                  return (
                    <div key={`${n.id} -${i} `} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 14px", background: `${nc}08`, border: `1px solid ${nc} 22`, borderRadius: 10, animation: i === 0 ? "slideInRight 0.3s ease" : "none" }}>
                      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>{icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: nc }}>{n.title}</span>
                          <span style={{ fontSize: 9, color: "#4a6080", fontFamily: "monospace", flexShrink: 0 }}>{n.time}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#8aa0b8", lineHeight: 1.4 }}>{n.message}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* OTHER VIEWS */}
        {view === "policies" && <PoliciesView updatePolicies={updatePolicies} />}
        {view === "audit" && <AuditLogView logs={sessionLog} />}
        {view === "compare" && <CompareView />}
        {view === "techstack" && <TechStackView />}

      </div>
    </>
  );
}
