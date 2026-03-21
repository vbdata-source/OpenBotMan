@echo off
REM OpenBotMan Setup Script for Windows

echo ============================================
echo OpenBotMan Setup
echo ============================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found!
    echo Please install Python 3.8+ and try again.
    pause
    exit /b 1
)

echo [1/5] Creating virtual environment...
python -m venv venv
if errorlevel 1 (
    echo ERROR: Failed to create virtual environment
    pause
    exit /b 1
)

echo [2/5] Activating virtual environment...
call venv\Scripts\activate.bat

echo [3/5] Installing dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo [4/5] Setting up configuration files...
if not exist config.yaml (
    copy config.example.yaml config.yaml
    echo Created config.yaml from example
) else (
    echo config.yaml already exists, skipping
)

if not exist .env (
    copy .env.example .env
    echo Created .env from example
    echo.
    echo IMPORTANT: Edit .env and add your ANTHROPIC_API_KEY
) else (
    echo .env already exists, skipping
)

echo [5/5] Creating log directory...
if not exist logs mkdir logs

echo.
echo ============================================
echo Setup Complete!
echo ============================================
echo.
echo Next steps:
echo 1. Edit .env and add your ANTHROPIC_API_KEY
echo 2. Edit config.yaml if needed
echo 3. Run: python orchestrator.py
echo.
echo See QUICKSTART.md for detailed instructions.
echo.
pause
