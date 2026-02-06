@echo off
setlocal EnableDelayedExpansion
:: OpenBotMan API Server Starter
:: ==============================

cd /d C:\Sources\OpenBotMan\packages\api-server

:: API Key für Authentifizierung
set OPENBOTMAN_API_KEYS=local-dev-key

echo.
echo ========================================
echo   OpenBotMan API Server
echo ========================================
echo   URL:     http://localhost:8080
echo   API Key: local-dev-key
echo ========================================
echo.

:: Prüfe ob pnpm verfügbar ist
where pnpm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo FEHLER: pnpm nicht gefunden!
    echo Bitte installieren: npm install -g pnpm
    pause
    exit /b 1
)

echo Starte Server...
echo.

pnpm start

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo FEHLER beim Starten! Exit code: %ERRORLEVEL%
    pause
)
