@echo off
title Social-Media-Board
cd /d "%~dp0"
echo ============================================
echo   Social-Media-Board startet ...
echo   Adresse: https://localhost:4321
echo   Schliesst sich automatisch nach 1 Stunde
echo   ohne Aktivitaet.
echo ============================================
echo.

:: Ollama starten (falls noch nicht aktiv — laeuft dann im Hintergrund)
start /B "" ollama serve >nul 2>&1
timeout /t 2 /nobreak >nul

echo Browser oeffnet sich gleich ...
echo Dieses Fenster offen lassen. Zum Beenden: Fenster schliessen.
echo.
start "" https://localhost:4321
node server.js

echo.
echo ============================================
echo   Board beendet. Ollama-Modelle entladen.
echo ============================================
timeout /t 4 /nobreak >nul
