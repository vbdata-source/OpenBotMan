@echo off
:: OpenBotMan API Server Starter
:: ==============================

cd /d C:\Sources\OpenBotMan\packages\api-server

:: API Key setzen (ändere dies für Production!)
set OPENBOTMAN_API_KEYS=local-dev-key

:: Optional: Anthropic API Key für claude-api Provider
:: set ANTHROPIC_API_KEY=sk-ant-xxxxx

echo.
echo ========================================
echo   OpenBotMan API Server
echo ========================================
echo   URL:     http://localhost:8080
echo   API Key: local-dev-key
echo ========================================
echo.

pnpm start
