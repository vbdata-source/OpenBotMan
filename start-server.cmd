@echo off
REM ============================================
REM OpenBotMan Server Starter (CMD)
REM ============================================
REM Lädt .env Datei und startet den API Server
REM
REM Verwendung:
REM   start-server.cmd
REM
REM Erstmalige Einrichtung:
REM   copy .env.example .env
REM   notepad .env  (Keys eintragen)
REM ============================================

cd /d "%~dp0"

REM Prüfe ob .env existiert
if not exist ".env" (
    echo.
    echo ❌ .env Datei nicht gefunden!
    echo.
    echo Erstmalige Einrichtung:
    echo   1. copy .env.example .env
    echo   2. notepad .env  ^(Keys eintragen^)
    echo   3. start-server.cmd
    echo.
    pause
    exit /b 1
)

echo.
echo 📂 Lade .env Datei...

REM Lade .env Datei (einfaches Parsing)
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    REM Ignoriere Kommentare (Zeilen die mit # beginnen)
    echo %%a | findstr /b "#" >nul
    if errorlevel 1 (
        REM Setze Umgebungsvariable
        set "%%a=%%b"
        echo   ✓ %%a
    )
)

echo.
echo 🚀 Starte OpenBotMan API Server...
echo.

REM Starte Server
pnpm --filter @openbotman/api-server start
