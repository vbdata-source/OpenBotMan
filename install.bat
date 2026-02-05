@echo off
echo ============================================
echo   OpenBotMan Installation Script (Windows)
echo ============================================
echo.

:: Check Node.js
echo [1/5] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found!
    echo Please install Node.js v20+ from https://nodejs.org
    exit /b 1
)
for /f "tokens=1 delims=v" %%a in ('node --version') do set NODE_VER=%%a
echo       Found Node.js %NODE_VER%

:: Check/Install pnpm
echo [2/5] Checking pnpm...
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo       Installing pnpm...
    npm install -g pnpm
    if errorlevel 1 (
        echo ERROR: Failed to install pnpm
        exit /b 1
    )
)
for /f %%a in ('pnpm --version') do set PNPM_VER=%%a
echo       Found pnpm %PNPM_VER%

:: Install dependencies
echo [3/5] Installing dependencies...
call pnpm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    exit /b 1
)
echo       Dependencies installed

:: Build
echo [4/5] Building project...
call pnpm build
if errorlevel 1 (
    echo ERROR: Build failed
    exit /b 1
)
echo       Build complete

:: Check Claude CLI
echo [5/5] Checking Claude CLI...
claude.cmd --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo WARNING: Claude CLI not found!
    echo To use OpenBotMan with Claude, install Claude CLI:
    echo   npm install -g @anthropic-ai/claude-code
    echo   OR download from https://claude.ai/download
    echo Then run: claude setup-token
    echo.
) else (
    for /f "tokens=*" %%a in ('claude.cmd --version') do set CLAUDE_VER=%%a
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
