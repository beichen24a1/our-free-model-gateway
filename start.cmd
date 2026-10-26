@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Starting Our Free Model standalone gateway...
node server.mjs
echo.
echo Gateway stopped. Press any key to close.
pause >nul
