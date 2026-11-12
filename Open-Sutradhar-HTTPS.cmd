@echo off
title Sutradhar HTTPS Launcher
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0infra\start-background-https.ps1"
if exist "%~dp0LIVE_HTTPS_URL.txt" (
    set /p HTTPS_URL=<"%~dp0LIVE_HTTPS_URL.txt"
    start "" "%HTTPS_URL%"
) else (
    start "" "http://localhost:8000"
)

