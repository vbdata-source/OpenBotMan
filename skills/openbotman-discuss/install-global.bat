@echo off
:: Install OpenBotMan Skill globally for Claude Code
:: Run this from the OpenBotMan directory

set SKILL_SRC=%~dp0
set SKILL_DST=%USERPROFILE%\.claude\skills\openbotman-discuss

echo Installing OpenBotMan Skill globally...
echo Source: %SKILL_SRC%
echo Target: %SKILL_DST%

:: Create target directory
if not exist "%USERPROFILE%\.claude\skills" mkdir "%USERPROFILE%\.claude\skills"

:: Copy skill
xcopy /E /I /Y "%SKILL_SRC%*" "%SKILL_DST%\"

echo.
echo ========================================
echo   Skill installed successfully!
echo ========================================
echo.
echo The skill is now available in all projects.
echo.
echo To use: Ask Claude Code something like:
echo   "Frag die OpenBotMan Experten: ..."
echo.
echo Make sure the API server is running:
echo   C:\Sources\OpenBotMan\start-api.bat
echo.
pause
