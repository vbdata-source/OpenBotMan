# ============================================
# OpenBotMan Server Starter (PowerShell)
# ============================================
# Lädt .env Datei und startet den API Server
#
# Verwendung:
#   .\start-server.ps1
#
# Erstmalige Einrichtung:
#   copy .env.example .env
#   notepad .env  (Keys eintragen)
# ============================================

$ErrorActionPreference = "Stop"

# Pfad zur .env Datei
$envFile = Join-Path $PSScriptRoot ".env"

# Prüfe ob .env existiert
if (-not (Test-Path $envFile)) {
    Write-Host "❌ .env Datei nicht gefunden!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Erstmalige Einrichtung:" -ForegroundColor Yellow
    Write-Host "  1. copy .env.example .env"
    Write-Host "  2. notepad .env  (Keys eintragen)"
    Write-Host "  3. .\start-server.ps1"
    Write-Host ""
    exit 1
}

# Lade .env Datei
Write-Host "📂 Lade .env Datei..." -ForegroundColor Cyan
Get-Content $envFile | ForEach-Object {
    # Ignoriere Kommentare und leere Zeilen
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') {
        return
    }
    
    # Parse KEY=VALUE
    if ($_ -match '^([^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        
        # Entferne Quotes wenn vorhanden
        $value = $value -replace '^["'']|["'']$', ''
        
        # Setze Umgebungsvariable
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
        
        # Zeige geladene Keys (ohne sensitive Werte)
        if ($key -match 'KEY|SECRET|PASSWORD|TOKEN') {
            $masked = if ($value.Length -gt 8) { $value.Substring(0, 4) + "****" + $value.Substring($value.Length - 4) } else { "****" }
            Write-Host "  ✓ $key = $masked" -ForegroundColor DarkGray
        } else {
            Write-Host "  ✓ $key = $value" -ForegroundColor DarkGray
        }
    }
}

Write-Host ""
Write-Host "🚀 Starte OpenBotMan API Server..." -ForegroundColor Green
Write-Host ""

# Starte Server
Set-Location $PSScriptRoot
pnpm --filter @openbotman/api-server start
