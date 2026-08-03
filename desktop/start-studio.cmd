@echo off
setlocal
title Broadcast Web Studio
cd /d "%~dp0"

rem Always show a console — PowerShell launcher does the real work.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-studio.ps1"
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
  echo.
  echo Launcher failed with code %ERR%.
  pause
)
exit /b %ERR%
