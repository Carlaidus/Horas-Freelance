@echo off
echo.
echo  VFX HOURS TRACKER
echo  ==================
echo.
cd /d "%~dp0"
start "" "http://localhost:3000"
node server.js
pause
