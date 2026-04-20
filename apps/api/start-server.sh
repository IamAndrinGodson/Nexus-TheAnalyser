#!/usr/bin/env bash
# =============================================================================
# NEXUS TLS — Server Startup Script (Linux / macOS)
# Run this on the SERVER machine to start the FastAPI backend.
# Usage: bash start-server.sh
# =============================================================================

set -e

echo ""
echo " ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗"
echo " ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝"
echo " ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗"
echo " ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║"
echo " ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║"
echo " ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝  TLS Backend"
echo ""

# ── Step 1: Check for .env ───────────────────────────────────────────────────
echo "[1/4] Checking for .env file..."
if [ ! -f ".env" ]; then
  echo "  ERROR: .env not found. Please run:"
  echo "    cp .env.example .env"
  echo "  Then set CORS_ORIGINS to include all client machine IPs."
  exit 1
fi

# ── Step 2: Virtual environment ───────────────────────────────────────────────
echo "[2/4] Activating Python virtual environment..."
if [ ! -d ".venv" ]; then
  echo "  .venv not found — creating and installing dependencies..."
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt
fi
source .venv/bin/activate

# ── Step 3: Show IP ───────────────────────────────────────────────────────────
echo "[3/4] Your server IP addresses:"
echo "-----------------------------------------------"
# Works on Linux and macOS
if command -v ip &>/dev/null; then
  ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v 127
else
  ifconfig | grep 'inet ' | awk '{print $2}' | grep -v 127.0.0.1
fi
echo "-----------------------------------------------"
echo "  ^^^ Share one of these IPs with client machines."
echo "  They must set RISK_API_URL=http://<YOUR_IP>:8000 in apps/web/.env"
echo ""

# ── Step 4: Start server ──────────────────────────────────────────────────────
echo "[4/4] Starting FastAPI server on 0.0.0.0:8000 ..."
echo "  Local:   http://localhost:8000"
echo "  Network: http://<YOUR_LAN_IP>:8000"
echo "  Docs:    http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop."
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
