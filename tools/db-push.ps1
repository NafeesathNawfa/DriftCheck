# Loads .env and pushes migrations to the remote Supabase Postgres (Session pooler).
# Usage:  powershell -ExecutionPolicy Bypass -File tools\db-push.ps1
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) {
  Write-Host "Missing .env — copy .env.example to .env and fill in SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD." -ForegroundColor Red
  exit 1
}

Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$') {
    [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
  }
}

if (-not $env:SUPABASE_DB_HOST -or $env:SUPABASE_DB_HOST -like "*pooler*") {
  # fine
} elseif ($env:SUPABASE_DB_HOST -eq "aws-0-ap-northeast-1.pooler.supabase.com") {
  # correct
} else {
  Write-Host ".env SUPABASE_DB_HOST is missing or wrong." -ForegroundColor Yellow
  exit 1
}

if (-not $env:SUPABASE_DB_PASSWORD) {
  Write-Host ".env SUPABASE_DB_PASSWORD is empty." -ForegroundColor Yellow
  exit 1
}

$script = Join-Path $PSScriptRoot "db-migrate.mjs"
Write-Host "Pushing migrations via pg driver -> $env:SUPABASE_DB_HOST ..." -ForegroundColor Cyan
node $script
if ($LASTEXITCODE -eq 0) { Write-Host "Done." -ForegroundColor Green }
exit $LASTEXITCODE