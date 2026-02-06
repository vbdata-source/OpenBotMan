@echo off
:: OpenBotMan API Server Starter
:: ==============================

cd /d C:\Sources\OpenBotMan

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
echo Starte Server...
echo.

:: Starte explizit den API-Server (nicht orchestrator!)
pnpm --filter @openbotman/api-server start

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo FEHLER beim Starten! Exit code: %ERRORLEVEL%
    pause
)
