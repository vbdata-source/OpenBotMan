@echo off
echo ============================================
echo   OpenBotMan Installation Script (Windows)
echo ============================================
echo.

:: Check Node.js
echo [1/5] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found!
    echo Please install Node.js v20+ from https://nodejs.org
    pause
    exit /b 1
)
echo       Found Node.js

:: Check/Install pnpm
echo [2/5] Checking pnpm...
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo       Installing pnpm...
    call npm install -g pnpm
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install pnpm
        pause
        exit /b 1
    )
)
echo       Found pnpm

:: Install dependencies
echo [3/5] Installing dependencies...
call pnpm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo       Dependencies installed

:: Build
echo [4/5] Building project...
call pnpm build --force
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)
echo       Build complete

:: Check Claude CLI
echo [5/5] Checking Claude CLI...
where claude >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo WARNING: Claude CLI not found!
    echo To use OpenBotMan with Claude, install Claude CLI:
    echo   npm install -g @anthropic-ai/claude-code
    echo   OR download from https://claude.ai/download
    echo Then run: claude setup-token
    echo.
) else (
    echo       Found Claude CLI
)

echo.
echo ============================================
echo   Installation Complete!
echo ============================================
echo.
echo To start a discussion:
echo   pnpm cli discuss "Your topic" --agents 3 --max-rounds 4
echo.
echo For help:
echo   pnpm cli discuss --help
echo.
