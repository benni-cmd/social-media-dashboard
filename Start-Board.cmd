@echo off
title Social-Media-Board
cd /d "%~dp0"
echo ============================================
echo   Social-Media-Board startet ...
echo   Adresse: http://localhost:4321
echo ============================================
echo.
echo Der Browser oeffnet sich gleich. Zum Beenden dieses
echo Fenster schliessen.
echo.
start "" http://localhost:4321
node server.js
pause
