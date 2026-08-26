# ============================================
# Camera Monitor - Script de Inicializacao
# ============================================
# Execute: powershell -ExecutionPolicy Bypass -File F:\SistemaDeCameras-main\start-server.ps1

$ErrorActionPreference = "Stop"
$projectDir = "F:\SistemaDeCameras-main"
$pgBin = "C:\Program Files\PostgreSQL\16\bin"
$pgData = "C:\Program Files\PostgreSQL\16\data"
$cloudflared = "$projectDir\cloudflared.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Camera Monitor - Iniciando Servidor"  -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. PostgreSQL
Write-Host "`n[1/5] Verificando PostgreSQL..." -ForegroundColor Yellow
$pgRunning = & "$pgBin\pg_ctl" status -D $pgData 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Iniciando PostgreSQL..." -ForegroundColor Yellow
    & "$pgBin\pg_ctl" start -D $pgData -l "$pgData\startup.log" -w
    Start-Sleep -Seconds 3
}
Write-Host "  PostgreSQL rodando na porta 5432" -ForegroundColor Green

# 2. Banco de dados
Write-Host "`n[2/5] Verificando banco de dados..." -ForegroundColor Yellow
$env:PGPASSWORD = "postgres"
$dbExists = & "$pgBin\psql" -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='camera_monitor'" 2>&1
if ($dbExists -ne "1") {
    Write-Host "  Criando banco camera_monitor..." -ForegroundColor Yellow
    & "$pgBin\psql" -U postgres -h localhost -c "CREATE DATABASE camera_monitor;" 2>&1 | Out-Null
}
Write-Host "  Banco camera_monitor OK" -ForegroundColor Green

# 3. Dependencias
Write-Host "`n[3/5] Verificando dependencias..." -ForegroundColor Yellow
if (-not (Test-Path "$projectDir\node_modules\.package-lock.json")) {
    Write-Host "  Instalando..." -ForegroundColor Yellow
    Push-Location $projectDir; & npm install; Pop-Location
}
Write-Host "  Dependencias OK" -ForegroundColor Green

# 4. Next.js (producao)
Write-Host "`n[4/5] Iniciando servidor Next.js..." -ForegroundColor Yellow
$existingNode = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existingNode) {
    Write-Host "  Porta 3000 ja em uso, matando processo anterior..." -ForegroundColor Yellow
    Stop-Process -Id $existingNode.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}
Start-Process powershell -ArgumentList "-NoProfile", "-Command", "Set-Location '$projectDir'; node node_modules\next\dist\bin\next start -p 3000 -H 0.0.0.0" -WindowStyle Hidden
Start-Sleep -Seconds 6
Write-Host "  Next.js rodando na porta 3000" -ForegroundColor Green

# 5. Cloudflare Tunnel
Write-Host "`n[5/5] Iniciando Cloudflare Tunnel..." -ForegroundColor Yellow
if (Test-Path $cloudflared) {
    $existingTunnel = Get-NetTCPConnection -LocalPort 20241 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($existingTunnel) {
        Stop-Process -Id $existingTunnel.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
    Start-Process -FilePath $cloudflared -ArgumentList "tunnel", "--url", "http://localhost:3000" -RedirectStandardError "$projectDir\tunnel-err.log" -WindowStyle Hidden
    Start-Sleep -Seconds 12
    $tunnelLog = Get-Content "$projectDir\tunnel-err.log" -ErrorAction SilentlyContinue
    $tunnelUrl = ($tunnelLog | Select-String "trycloudflare.com" | Select-Object -Last 1).ToString().Trim()
    $tunnelUrl = $tunnelUrl -replace ".*\|", "" -replace "\s*\|.*", "" -replace ".*https://", "https://"
    $tunnelUrl = $tunnelUrl.Trim()
    Write-Host "  Tunnel ativo" -ForegroundColor Green
} else {
    $tunnelUrl = "(cloudflared.exe nao encontrado)"
    Write-Host "  cloudflared.exe nao encontrado em $cloudflared" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SERVIDOR ONLINE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Local:      http://localhost:3000" -ForegroundColor White
Write-Host "  Rede:       http://$(hostname):3000" -ForegroundColor White
Write-Host "  Internet:   $tunnelUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Login Admin:" -ForegroundColor Yellow
Write-Host "    Email:    admin@admin.com" -ForegroundColor White
Write-Host "    Senha:    admin123" -ForegroundColor White
Write-Host ""
Write-Host "  Login Usuario:" -ForegroundColor Yellow
Write-Host "    Email:    user@user.com" -ForegroundColor White
Write-Host "    Senha:    user123" -ForegroundColor White
Write-Host ""
Write-Host "  Pressione Ctrl+C para parar tudo" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Manter script vivo
Write-Host "Servidor rodando. Pressione Ctrl+C para sair..." -ForegroundColor Gray
while ($true) { Start-Sleep -Seconds 60 }
