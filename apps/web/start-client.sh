#!/usr/bin/env bash
# =============================================================================
# NEXUS TLS — Client Startup Script (Linux / macOS)
# Run this on each CLIENT machine to start the Next.js frontend.
# Usage: bash start-client.sh
# =============================================================================

set -e

echo ""
echo " ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗"
echo " ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝"
echo " ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗"
echo " ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║"
echo " ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║"
echo " ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝  TLS Frontend"
echo ""

# ── Step 1: Check for .env ───────────────────────────────────────────────────
echo "[1/3] Checking for .env file..."
if [ ! -f ".env" ]; then
  echo "  ERROR: .env not found! Please run:"
  echo "    cp .env.example .env"
  echo "  Then set:"
  echo "    RISK_API_URL=http://<SERVER_IP>:8000"
  echo "    NEXTAUTH_URL=http://localhost:3000"
  echo "    NEXTAUTH_SECRET=<same as apps/api JWT_SECRET>"
  exit 1
fi

# Warn if still on localhost
if grep -q "RISK_API_URL=http://localhost" .env; then
  echo ""
  echo "  [WARNING] RISK_API_URL is still pointing to localhost."
  echo "  If the FastAPI server is on a different machine, update .env:"
  echo "    RISK_API_URL=http://<SERVER_IP>:8000"
  echo ""
fi

# ── Step 2: Install dependencies ─────────────────────────────────────────────
echo "[2/3] Checking npm dependencies..."
if [ ! -d "node_modules" ]; then
  echo "  node_modules not found — running npm install..."
  npm install
fi

# ── Step 3: Start the dev server ─────────────────────────────────────────────
echo "[3/3] Starting Next.js frontend on http://localhost:3000 ..."
echo ""
echo "  Open: http://localhost:3000"
echo "  Press Ctrl+C to stop."
echo ""

npm run dev
