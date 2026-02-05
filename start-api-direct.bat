@echo off
:: OpenBotMan API Server mit DIREKTEM API Aufruf (ohne CLI)
:: =========================================================
:: Nutze diese Variante wenn claude.cmd nicht funktioniert
:: Erfordert: ANTHROPIC_API_KEY

cd /d C:\Sources\OpenBotMan\packages\api-server

:: API Key für Authentifizierung
set OPENBOTMAN_API_KEYS=local-dev-key

:: WICHTIG: Deinen Anthropic API Key hier eintragen!
:: Hol dir einen Key von: https://console.anthropic.com/
set ANTHROPIC_API_KEY=sk-ant-DEIN-KEY-HIER

if "%ANTHROPIC_API_KEY%"=="sk-ant-DEIN-KEY-HIER" (
    echo.
    echo =====================================================
    echo   FEHLER: ANTHROPIC_API_KEY nicht gesetzt!
    echo =====================================================
    echo.
    echo Bitte editiere diese Datei und trage deinen API Key ein.
    echo Du findest ihn unter: https://console.anthropic.com/
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   OpenBotMan API Server (Direct API)
echo ========================================
echo   URL:      http://localhost:8080
echo   Provider: claude-api (direkt)
echo ========================================
echo.

pnpm start -- --provider claude-api
