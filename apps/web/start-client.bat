@echo off
:: =============================================================================
:: NEXUS TLS — Client Startup Script (Windows)
:: Run this on each CLIENT machine to start the Next.js frontend.
:: =============================================================================

echo.
echo  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
echo  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
echo  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
echo  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
echo  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
echo  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝  TLS Frontend
echo.

:: ── Step 1: Check for .env ───────────────────────────────────────────────────
echo [1/3] Checking for .env file...
if not exist ".env" (
    echo  ERROR: .env file not found!
    echo.
    echo  Please copy .env.example to .env first:
    echo    copy .env.example .env
    echo.
    echo  Then open .env and set:
    echo    RISK_API_URL=http://^<SERVER_IP^>:8000
    echo    NEXTAUTH_URL=http://localhost:3000
    echo    NEXTAUTH_SECRET=^<same as apps/api JWT_SECRET^>
    echo.
    pause
    exit /b 1
)

:: ── Check RISK_API_URL is configured ─────────────────────────────────────────
findstr /i "RISK_API_URL=http://localhost" .env >nul
if %errorlevel%==0 (
    echo.
    echo  [WARNING] RISK_API_URL is still pointing to localhost.
    echo  If the FastAPI server is on another machine, update .env:
    echo    RISK_API_URL=http://^<SERVER_IP^>:8000
    echo.
)

:: ── Step 2: Install dependencies ─────────────────────────────────────────────
echo [2/3] Installing / verifying npm dependencies...
if not exist "node_modules" (
    echo  node_modules not found — running npm install...
    npm install
)

:: ── Step 3: Start the Next.js dev server ─────────────────────────────────────
echo [3/3] Starting Next.js frontend on http://localhost:3000 ...
echo.
echo  Open this URL in your browser:  http://localhost:3000
echo  Press Ctrl+C to stop.
echo.

npm run dev

pause
