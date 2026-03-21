@echo off
REM ============================================
REM OpenBotMan - API Server + Web UI
REM ============================================
REM Startet beide Dienste parallel:
REM   - API Server  -> http://localhost:8080
REM   - Web UI      -> http://localhost:5173
REM ============================================

cd /d "%~dp0"

REM Pruefe ob .env existiert
if not exist ".env" (
    echo.
    echo  .env Datei nicht gefunden!
    echo.
    echo  Erstmalige Einrichtung:
    echo    1. copy .env.example .env
    echo    2. notepad .env  (Keys eintragen)
    echo    3. start.bat
    echo.
    pause
    exit /b 1
)

REM Lade .env Datei
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    echo %%a | findstr /b "#" >nul 2>&1
    if errorlevel 1 (
        set "%%a=%%b"
    )
)

echo.
echo  ========================================
echo   OpenBotMan
echo  ========================================
echo   API Server:  http://localhost:8080
echo   Web UI:      http://localhost:5173
echo  ========================================
echo.

REM Starte API Server im Hintergrund
echo  Starte API Server...
start "OpenBotMan API" cmd /c "cd /d "%~dp0" && pnpm api"

REM Kurz warten, damit der API-Server hochfaehrt
timeout /t 3 /nobreak >nul

REM Starte Web UI im Vordergrund
echo  Starte Web UI...
pnpm web

REM Falls Web UI beendet wird
echo.
echo  Web UI beendet. API Server laeuft ggf. noch im anderen Fenster.
pause
