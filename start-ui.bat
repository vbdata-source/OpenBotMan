@echo off
REM ============================================
REM OpenBotMan - Web UI + API Server
REM ============================================

cd /d "%~dp0."

if not exist .env (
    echo.
    echo  .env Datei nicht gefunden!
    echo  1. copy .env.example .env
    echo  2. notepad .env
    echo  3. start-ui.bat
    echo.
    pause
    exit /b 1
)

echo.
echo  ========================================
echo   OpenBotMan
echo  ========================================
echo   API Server:  http://localhost:8080
echo   Web UI:      http://localhost:3000
echo  ========================================
echo.

echo  Starte API Server...
start "OpenBotMan API" cmd /c "cd /d %~dp0. && pnpm api"

timeout /t 3 /nobreak >nul

echo  Starte Web UI...
start "" http://localhost:3000
pnpm web

echo.
echo  Web UI beendet. API Server laeuft ggf. noch im anderen Fenster.
pause
