# Sutradhar Unified Startup Script (Windows PowerShell)
# Starts both the FastAPI Backend (http://localhost:8000) and Vite React Frontend (http://localhost:5173)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  SUTRADHAR — AI Business Operations & Decision Intelligence  " -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan

Push-Location "$RootDir\backend"
& "$RootDir\.venv\Scripts\alembic.exe" upgrade head
Pop-Location

Write-Host "`nStarting Frontend (http://localhost:5173) + Auto-Starting Backend (http://localhost:8000)..." -ForegroundColor Green
Push-Location "$RootDir\frontend"
& npm.cmd run dev
Pop-Location

