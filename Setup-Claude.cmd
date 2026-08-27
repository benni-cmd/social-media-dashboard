@echo off
title Claude Setup
set "LOG=%~dp0setup-ergebnis.txt"
echo ============================================
echo   Claude installieren und einloggen
echo ============================================
echo.
echo Schritt 1: Installation laeuft (kann 1-2 Minuten dauern)...
echo ==== Setup ====> "%LOG%"
call npm install -g @anthropic-ai/claude-code>> "%LOG%" 2>&1
echo -- claude --version -->> "%LOG%"
"%APPDATA%\npm\claude.cmd" --version>> "%LOG%" 2>&1
echo Installierte Version:
"%APPDATA%\npm\claude.cmd" --version
echo.
echo Schritt 2: Login. Dein Browser oeffnet sich gleich.
echo Melde dich mit deinem Claude-ABO-Konto an (NICHT "API key").
echo.
pause
"%APPDATA%\npm\claude.cmd" auth login
echo -- auth status -->> "%LOG%"
"%APPDATA%\npm\claude.cmd" auth status>> "%LOG%" 2>&1
echo.
echo === Status nach dem Login ===
"%APPDATA%\npm\claude.cmd" auth status
echo.
echo Fertig. Schreib mir "fertig" - ich lese das Ergebnis aus.
pause
