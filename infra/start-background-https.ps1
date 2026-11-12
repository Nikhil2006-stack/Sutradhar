# Sutradhar Always-On Background Server & Public HTTPS Tunnel Launcher
# Automatically starts the unified Sutradhar server (127.0.0.1:8000) and Cloudflare HTTPS tunnel
# Saves the public https://*.trycloudflare.com URL to LIVE_HTTPS_URL.txt in the project root.

$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$BackendDir = Join-Path $RootDir "backend"
$PythonExe = Join-Path $RootDir ".venv\Scripts\python.exe"
$CloudflaredExe = Join-Path $RootDir "infra\bin\cloudflared.exe"
$TunnelLog = Join-Path $RootDir "infra\bin\tunnel.log"
$UrlFile = Join-Path $RootDir "LIVE_HTTPS_URL.txt"

# 1. Ensure Unified Server (FastAPI + React SPA) is listening on port 8000
$portActive = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", 8000)
    $portActive = $tcp.Connected
    $tcp.Close()
} catch {
    $portActive = $false
}

if (-not $portActive) {
    Start-Process -FilePath $PythonExe -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port 8000" -WorkingDirectory $BackendDir -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

# 2. Ensure Public HTTPS Tunnel is running and capture URL
if (Test-Path $CloudflaredExe) {
    $existingTunnel = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if (-not $existingTunnel) {
        if (Test-Path $TunnelLog) { Remove-Item $TunnelLog -Force -ErrorAction SilentlyContinue }
        Start-Process -FilePath $CloudflaredExe -ArgumentList "tunnel --url http://127.0.0.1:8000 --no-autoupdate --logfile `"$TunnelLog`"" -WorkingDirectory $RootDir -WindowStyle Hidden
        for ($i = 0; $i -lt 15; $i++) {
            Start-Sleep -Seconds 1
            if (Test-Path $TunnelLog) {
                $content = Get-Content $TunnelLog -Raw -ErrorAction SilentlyContinue
                if ($content -match "https://[a-zA-Z0-9\-]+\.trycloudflare\.com") {
                    $httpsUrl = $Matches[0]
                    Set-Content -Path $UrlFile -Value $httpsUrl
                    break
                }
            }
        }
    }
}
