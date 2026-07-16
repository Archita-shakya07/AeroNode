# Run this script in VS Code's PowerShell terminal from the project root.
# It starts the backend and frontend in two separate windows.

param(
  [switch]$BackendOnly,
  [switch]$FrontendOnly
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $projectRoot

# Load .env if it exists
$envFile = Join-Path $projectRoot ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#') { return }
    if ($_ -match '^\s*([\w.]+)\s*=\s*(.*)\s*$') {
      $name = $matches[1]
      $value = $matches[2].Trim('"').Trim("'")
      [Environment]::SetEnvironmentVariable($name, $value, "Process") | Out-Null
    }
  }
  Write-Host "Loaded environment from .env" -ForegroundColor Green
} else {
  Write-Host "WARNING: .env file not found. Create it from .env.example first." -ForegroundColor Yellow
}

# Backend window
if (-not $FrontendOnly) {
  $backendDir = Join-Path $projectRoot "artifacts" "api-server"
  $backendCommand = "cd `"$projectRoot`"; `$env:NODE_ENV='development'; pnpm --filter @workspace/api-server run dev"
  Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $backendCommand -WindowStyle Normal
  Write-Host "Started backend in new window" -ForegroundColor Green
}

# Frontend window
if (-not $BackendOnly) {
  $frontendCommand = "cd `"$projectRoot`"; pnpm --filter @workspace/collabsphere run dev"
  Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $frontendCommand -WindowStyle Normal
  Write-Host "Started frontend in new window" -ForegroundColor Green
}

Write-Host "`nOpen http://localhost:${env:FRONTEND_PORT} once both servers are ready." -ForegroundColor Cyan
