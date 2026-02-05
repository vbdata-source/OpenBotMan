@echo off
:: OpenBotMan API Server Starter
:: ==============================

cd /d C:\Sources\OpenBotMan\packages\api-server

:: Claude CLI zum PATH hinzufügen (verschiedene Installationsorte)
set PATH=%PATH%;%APPDATA%\npm;%LOCALAPPDATA%\npm;%USERPROFILE%\.local\bin

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
echo Starte mit claude-cli Provider...
echo (Falls Fehler: Pruefe ob "claude --version" funktioniert)
echo.

:: Teste ob claude verfuegbar ist
where claude.cmd >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo WARNUNG: claude.cmd nicht im PATH gefunden!
    echo Versuche direkten Pfad...
    set PATH=%PATH%;C:\Users\LocalUser\AppData\Roaming\npm
)

pnpm start
