@echo off
:: =============================================================================
:: NEXUS TLS — Server Startup Script (Windows)
:: Run this on the SERVER machine to start the FastAPI backend.
:: =============================================================================

echo.
echo  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
echo  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
echo  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
echo  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
echo  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
echo  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝  TLS Backend
echo.
echo [1/4] Checking for .env file...

if not exist ".env" (
    echo  ERROR: .env file not found!
    echo  Please copy .env.example to .env and fill in your values:
    echo    copy .env.example .env
    echo  Then open .env and set CORS_ORIGINS to include ALL client machine IPs.
    pause
    exit /b 1
)

echo [2/4] Activating Python virtual environment...
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
) else (
    echo  WARNING: .venv not found. Creating and installing dependencies...
    python -m venv .venv
    call .venv\Scripts\activate.bat
    pip install -r requirements.txt
)

echo [3/4] Finding your Server IP address...
echo -----------------------------------------------
ipconfig | findstr /i "IPv4"
echo -----------------------------------------------
echo  ^^ Share the above IP with client machines.
echo  ^^ They must set RISK_API_URL=http://^<YOUR_IP^>:8000 in apps/web/.env
echo.

echo [4/4] Starting FastAPI server on ALL network interfaces (0.0.0.0:8000)...
echo  API will be accessible at:
echo    - Local:   http://localhost:8000
echo    - Network: http://^<YOUR_LAN_IP^>:8000
echo    - Docs:    http://localhost:8000/docs
echo.
echo  Press Ctrl+C to stop the server.
echo.

uvicorn main:app --host 0.0.0.0 --port 8000 --reload

pause
