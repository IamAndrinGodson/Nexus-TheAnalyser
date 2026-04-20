# NEXUS TLS — Deployment Guide

> **How to run this project across multiple machines:**  
> One machine acts as the **Server** (FastAPI backend), and one or more machines act as **Clients** (Next.js frontend).

---

## Architecture Overview

```
┌─────────────────────────────────────┐       LAN / WiFi Network
│         SERVER MACHINE              │ ←──────────────────────────┐
│                                     │                            │
│  • apps/api  (FastAPI + SQLite)     │                            │
│  • Port 8000 open on LAN            │                            │
└─────────────────────────────────────┘                            │
                                                                   │
┌─────────────────────────────────────┐                            │
│         CLIENT MACHINE(S)           │ ───────────────────────────┘
│                                     │
│  • apps/web  (Next.js)              │
│  • Port 3000 — browser opens here   │
│  • All API calls proxied to Server  │
└─────────────────────────────────────┘
```

---

## Prerequisites

Both machines need:
- **Git** — to clone the repo
- **Node.js ≥ 18** — for the Next.js frontend (client)
- **Python ≥ 3.10** — for the FastAPI backend (server)
- Both on the **same WiFi/LAN** (or use ngrok for internet access)

---

## Step 1 — Clone the Repo on All Machines

Run this on **both** the server and every client machine:

```bash
git clone https://github.com/IamAndrinGodson/Codeathon-4.0.git
cd Codeathon-4.0
```

---

## Step 2 — Set Up the SERVER Machine

### 2a. Find the Server's LAN IP

**Windows:**
```powershell
ipconfig
# Look for "IPv4 Address" under your WiFi adapter
# Example: 192.168.1.100
```

**Linux/Mac:**
```bash
ip a   # or:  ifconfig
# Look for inet under wlan0 or eth0
```

> 📌 **Write down this IP** — you'll need it on every client machine.

### 2b. Configure Server Environment

```bash
cd apps/api
copy .env.example .env          # Windows
# cp .env.example .env          # Linux/Mac
```

Open `.env` and update **`CORS_ORIGINS`** to include **every client machine's IP**:

```env
# Example — two clients on LAN:
CORS_ORIGINS=["http://192.168.1.101:3000","http://192.168.1.102:3000"]

# If client and server are on same machine (dev only):
CORS_ORIGINS=["http://localhost:3000"]
```

> **Leave `DATABASE_URL` blank** to use the built-in SQLite database (easiest for demos). No PostgreSQL install required.

### 2c. Open Firewall Port 8000

**Windows (required):**
1. Open **Windows Defender Firewall → Advanced Settings**
2. New **Inbound Rule** → Port → TCP → `8000` → Allow → Name: `NEXUS-API`

**Linux:**
```bash
sudo ufw allow 8000/tcp
```

### 2d. Start the Server

**Windows:**
```cmd
cd apps/api
start-server.bat
```

**Linux/Mac:**
```bash
cd apps/api
bash start-server.sh
```

The script will:
- Auto-create a Python virtual environment (`.venv`) if missing
- Install all Python dependencies from `requirements.txt`
- Print your LAN IP addresses
- Start FastAPI on `http://0.0.0.0:8000`

✅ **Verify:** Open `http://localhost:8000/health` on the server → should return `{"status":"healthy"}`

---

## Step 3 — Set Up Each CLIENT Machine

### 3a. Configure Client Environment

```bash
cd apps/web
copy .env.example .env          # Windows
# cp .env.example .env          # Linux/Mac
```

Open `.env` and set these three values:

```env
# Replace 192.168.1.100 with the SERVER's actual LAN IP from Step 2a
RISK_API_URL=http://192.168.1.100:8000

# This client machine's own URL (usually keep as localhost)
NEXTAUTH_URL=http://localhost:3000

# Must be identical to JWT_SECRET in apps/api/.env
NEXTAUTH_SECRET=92b0c3f5a89e4c1d76ea2f9b87c65d4e1f3a2b5c8e7d9b0a1c3e5f7a9d2b4c6e
```

> ⚠️ **`NEXTAUTH_SECRET` and `JWT_SECRET` must be the same string** on both machines.

### 3b. Start the Client

**Windows:**
```cmd
cd apps/web
start-client.bat
```

**Linux/Mac:**
```bash
cd apps/web
bash start-client.sh
```

The script will:
- Check that `.env` exists and warn if `RISK_API_URL` is still on localhost
- Auto-install npm dependencies if `node_modules` is missing
- Start Next.js on `http://localhost:3000`

✅ **Verify:** Open `http://localhost:3000` — the NEXUS login page should appear.

---

## How API Calls Work (No CORS Issues)

Thanks to the Next.js proxy configured in `next.config.ts`, the browser **never talks directly** to the FastAPI server. Instead:

```
Browser → Next.js (port 3000) → FastAPI (port 8000)
```

Frontend code can call the backend using either:

| Method | URL Pattern | Notes |
|--------|-------------|-------|
| **Proxied** (recommended) | `/api/backend/api/auth/login` | No CORS issues, server IP hidden |
| **Direct** | `http://<SERVER_IP>:8000/api/auth/login` | Requires CORS header on FastAPI |

The existing frontend code uses the proxied approach through `RISK_API_URL`.

---

## Quick Reference

| What | Where | Command |
|------|-------|---------|
| Start backend | `apps/api/` | `start-server.bat` |
| Start frontend | `apps/web/` | `start-client.bat` |
| API health check | Browser | `http://<SERVER_IP>:8000/health` |
| API docs (Swagger) | Browser on server | `http://localhost:8000/docs` |
| Frontend | Browser on client | `http://localhost:3000` |

---

## Troubleshooting

### ❌ Client can't connect to server
- Confirm the server is running (`/health` endpoint works on server itself)
- Check Windows Firewall on the server — port `8000` must be open
- Confirm both machines are on the **same WiFi network**
- Ping test: from client, run `ping <SERVER_IP>`

### ❌ Login fails / 401 errors
- Check that `NEXTAUTH_SECRET` (in `apps/web/.env`) matches `JWT_SECRET` (in `apps/api/.env`)

### ❌ CORS errors in browser console
- Add the client machine's origin to `CORS_ORIGINS` in `apps/api/.env`, then restart the server
- Example: `CORS_ORIGINS=["http://192.168.1.101:3000"]`

### ❌ WebSocket connections failing
- WebSocket (`ws://`) also needs to reach port `8000` — same firewall rule applies

---

## Internet Access / Remote Deployment

### Using ngrok (quick demo, no server config needed)

On the **server machine**, after starting the API:

```bash
# Install ngrok from https://ngrok.com
ngrok http 8000
# → Gives you a public URL like: https://abc123.ngrok.io
```

On each **client machine**, set:
```env
RISK_API_URL=https://abc123.ngrok.io
```

### Cloud Deployment

| Component | Recommended Platform |
|-----------|---------------------|
| FastAPI backend | Railway, Render, Fly.io, AWS EC2 |
| Next.js frontend | Vercel (zero-config), Netlify |
| PostgreSQL | Supabase (already configured in web/.env) |
| Redis | Upstash (already configured in web/.env) |

For cloud deployments, set environment variables in the platform's dashboard instead of `.env` files.

---

*Generated for NEXUS TLS v2.0.0 — Codeathon 4.0 Project by Error404*
