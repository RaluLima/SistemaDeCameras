# ============================================
# Camera Monitor - Script de Inicializacao
# ============================================
# Execute: powershell -ExecutionPolicy Bypass -File .\start-server.ps1

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$redisDir  = "$projectDir\tools\redis"
$cloudflared = "$projectDir\cloudflared.exe"
$mediamtx  = "$projectDir\mediamtx.exe"

# Le chaves do .env para nao duplicar segredos no script
$envFile = "$projectDir\.env"
$envMap = @{}
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$') {
            $envMap[$Matches[1]] = $Matches[2].Trim()
        }
    }
}
# Caminhos/senha do PostgreSQL sao configuraveis via .env (instalador.ps1);
# os valores abaixo sao o padrao usado nesta maquina.
$pgBin     = if ($envMap["PG_BIN"])   { $envMap["PG_BIN"] }   else { "D:\PostgreSQL\18\bin" }
$pgData    = if ($envMap["PG_DATA"])  { $envMap["PG_DATA"] }  else { "D:\PostgreSQL\18\data" }
$pgPass    = if ($envMap["PG_PASSWORD"]) { $envMap["PG_PASSWORD"] } else { "ralu201527" }
$aiSecret   = if ($envMap["AI_SERVICE_KEY"])       { $envMap["AI_SERVICE_KEY"] }       else { "camview-ai-secret-2024" }
$recSecret  = if ($envMap["RECORDING_SERVICE_KEY"]) { $envMap["RECORDING_SERVICE_KEY"] } else { "" }
$recordings = if ($envMap["RECORDINGS_DIR"])        { $envMap["RECORDINGS_DIR"] }        else { "$projectDir\recordings" }
$ffmpegBin  = "$projectDir\tools\ffmpeg\bin\ffmpeg.exe"

function Test-Port($port) {
    return $null -ne (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Wait-Port($port, $timeoutSec) {
    $deadline = (Get-Date).AddSeconds($timeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-Port $port) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return (Test-Port $port)
}

function Stop-Port($port) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Camera Monitor - Iniciando Servidor"  -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Redis
Write-Host "`n[1/10] Verificando Redis..." -ForegroundColor Yellow
if (Test-Port 6379) {
    Write-Host "  Redis ja rodando na porta 6379" -ForegroundColor Green
} elseif (Test-Path "$redisDir\redis-server.exe") {
    Start-Process -FilePath "$redisDir\redis-server.exe" -ArgumentList "$redisDir\redis.windows.conf" -WorkingDirectory $redisDir -WindowStyle Hidden
    if (Wait-Port 6379 15) {
        Write-Host "  Redis iniciado na porta 6379" -ForegroundColor Green
    } else {
        Write-Host "  Redis NAO subiu - veja tools\redis\*.log" -ForegroundColor Red
    }
} else {
    Write-Host "  Redis nao encontrado em $redisDir" -ForegroundColor Red
}

# 2. PostgreSQL
Write-Host "`n[2/10] Verificando PostgreSQL..." -ForegroundColor Yellow
if (Test-Port 5432) {
    Write-Host "  PostgreSQL ja rodando na porta 5432" -ForegroundColor Green
} else {
    Write-Host "  Iniciando PostgreSQL..." -ForegroundColor Yellow
    & "$pgBin\pg_ctl" start -D $pgData -l "$pgData\startup.log" -w
    Start-Sleep -Seconds 3
    Write-Host "  PostgreSQL rodando na porta 5432" -ForegroundColor Green
}

# 3. Banco de dados
Write-Host "`n[3/10] Verificando banco de dados..." -ForegroundColor Yellow
$env:PGPASSWORD = $pgPass
$dbExists = & "$pgBin\psql" -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='camera_monitor'" 2>&1
if ($dbExists -notmatch "1") {
    Write-Host "  Criando banco camera_monitor..." -ForegroundColor Yellow
    & "$pgBin\psql" -U postgres -h localhost -c "CREATE DATABASE camera_monitor;" 2>&1 | Out-Null
}
Write-Host "  Banco camera_monitor OK" -ForegroundColor Green

# 4. Dependencias Node
Write-Host "`n[4/10] Verificando dependencias..." -ForegroundColor Yellow
if (-not (Test-Path "$projectDir\node_modules\next\package.json")) {
    Write-Host "  Instalando..." -ForegroundColor Yellow
    Push-Location $projectDir; & npm install; Pop-Location
}
Write-Host "  Dependencias OK" -ForegroundColor Green

# 5. Prisma (client + migrations)
Write-Host "`n[5/10] Aplicando migrations Prisma..." -ForegroundColor Yellow
Push-Location $projectDir
& npx prisma generate 2>&1 | Out-Null
& npx prisma migrate deploy 2>&1 | Select-String -Pattern "All migrations|already in sync|Error" | ForEach-Object { Write-Host "  $_" }
Pop-Location
Write-Host "  Banco sincronizado" -ForegroundColor Green

# 6. MediaMTX (streaming RTSP/HLS/WebRTC)
Write-Host "`n[6/10] Verificando MediaMTX..." -ForegroundColor Yellow
if (Test-Port 8888) {
    Write-Host "  MediaMTX ja rodando na porta 8888" -ForegroundColor Green
} elseif (Test-Path $mediamtx) {
    Start-Process -FilePath $mediamtx -ArgumentList "$projectDir\mediamtx.yml" -WorkingDirectory $projectDir -WindowStyle Hidden
    if (Wait-Port 8888 15) {
        Write-Host "  MediaMTX iniciado (HLS :8888, RTSP :8554, WebRTC :8889)" -ForegroundColor Green
    } else {
        Write-Host "  MediaMTX NAO subiu" -ForegroundColor Red
    }
} else {
    Write-Host "  mediamtx.exe nao encontrado" -ForegroundColor Red
}

# 7. Next.js
Write-Host "`n[7/10] Iniciando servidor Next.js..." -ForegroundColor Yellow
Stop-Port 3000
Start-Process powershell -ArgumentList "-NoProfile", "-Command", "Set-Location '$projectDir'; node server.js *> '$projectDir\server.log'" -WindowStyle Hidden
if (Wait-Port 3000 45) {
    Write-Host "  Next.js rodando na porta 3000" -ForegroundColor Green
} else {
    Write-Host "  Next.js NAO subiu - veja server.log" -ForegroundColor Red
}

# 8. AI Service
Write-Host "`n[8/10] Verificando AI Service..." -ForegroundColor Yellow
if (Test-Port 8000) {
    Write-Host "  AI Service ja rodando na porta 8000" -ForegroundColor Green
} else {
    $env:NEXTJS_URL = "http://localhost:3000"
    $env:AI_SECRET  = $aiSecret
    $env:REDIS_URL  = "redis://localhost:6379"
    Start-Process powershell -ArgumentList "-NoProfile", "-Command", "Set-Location '$projectDir\ai-service'; python main.py *> '$projectDir\ai-service.log'" -WindowStyle Hidden
    if (Wait-Port 8000 30) {
        Write-Host "  AI Service rodando na porta 8000" -ForegroundColor Green
    } else {
        Write-Host "  AI Service NAO subiu - veja ai-service.log" -ForegroundColor Red
    }
}

# 9. Recorder (gravacao de segmentos das cameras com recordingEnabled)
Write-Host "`n[9/10] Verificando Recorder..." -ForegroundColor Yellow
$recorderPidFile = "$projectDir\recorder\worker.pid"
$recorderRunning = $false
if (Test-Path $recorderPidFile) {
    $recPid = (Get-Content $recorderPidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($recPid -and (Get-Process -Id $recPid -ErrorAction SilentlyContinue)) {
        $recorderRunning = $true
    } else {
        Remove-Item $recorderPidFile -Force -ErrorAction SilentlyContinue
    }
}
if ($recorderRunning) {
    Write-Host "  Recorder ja rodando" -ForegroundColor Green
} elseif (-not $recSecret) {
    Write-Host "  RECORDING_SERVICE_KEY ausente no .env - recorder ignorado" -ForegroundColor Red
} elseif (-not (Test-Path "$projectDir\recorder\worker.js")) {
    Write-Host "  recorder\worker.js nao encontrado" -ForegroundColor Red
} else {
    if (-not (Test-Path $ffmpegBin)) { $ffmpegBin = "ffmpeg" }
    $recCmd = "`$env:API_URL='http://localhost:3000'; `$env:RECORDER_KEY='$recSecret'; `$env:FFMPEG='$ffmpegBin'; `$env:OUTPUT_DIR='$recordings'; Start-Process -FilePath 'node' -ArgumentList '$projectDir\recorder\worker.js' -WorkingDirectory '$projectDir' -WindowStyle Hidden -RedirectStandardOutput '$projectDir\recorder.log' -RedirectStandardError '$projectDir\recorder-error.log'"
    Start-Process powershell -ArgumentList "-NoProfile", "-Command", $recCmd -WindowStyle Hidden
    Start-Sleep -Seconds 4
    if ((Test-Path $recorderPidFile) -and (Get-Process -Id ((Get-Content $recorderPidFile | Select-Object -First 1)) -ErrorAction SilentlyContinue)) {
        Write-Host "  Recorder rodando (gravacao de segmentos ativa)" -ForegroundColor Green
    } else {
        Write-Host "  Recorder NAO subiu - veja recorder.log" -ForegroundColor Red
    }
}

# 10. Cloudflare Tunnel
Write-Host "`n[10/10] Verificando Cloudflare Tunnel..." -ForegroundColor Yellow
$tunnelUrl = ""
if (Test-Path $cloudflared) {
    if (Test-Port 20241) {
        Write-Host "  Tunnel ja rodando" -ForegroundColor Green
    } else {
        $tunnelErr = "$projectDir\tunnel-err.log"
        if (Test-Path $tunnelErr) { Remove-Item $tunnelErr -Force }
        Start-Process -FilePath $cloudflared -ArgumentList "tunnel", "--url", "http://localhost:3000" -WorkingDirectory $projectDir -RedirectStandardError $tunnelErr -WindowStyle Hidden
        Start-Sleep -Seconds 15
        $tunnelLog = Get-Content $tunnelErr -ErrorAction SilentlyContinue
        $match = $tunnelLog | Select-String "https://[a-zA-Z0-9\-]+\.trycloudflare\.com" | Select-Object -Last 1
        if ($match) {
            $tunnelUrl = ([regex]::Match($match.ToString(), "https://[a-zA-Z0-9\-]+\.trycloudflare\.com")).Value
            Write-Host "  Tunnel ativo: $tunnelUrl" -ForegroundColor Green
        } else {
            Write-Host "  Tunnel NAO conectou - veja $tunnelErr" -ForegroundColor Red
        }
    }
    if (-not $tunnelUrl) {
        $tunnelLog = Get-Content "$projectDir\tunnel-err.log" -ErrorAction SilentlyContinue
        $match = $tunnelLog | Select-String "https://[a-zA-Z0-9\-]+\.trycloudflare\.com" | Select-Object -Last 1
        if ($match) { $tunnelUrl = ([regex]::Match($match.ToString(), "https://[a-zA-Z0-9\-]+\.trycloudflare\.com")).Value }
    }
} else {
    Write-Host "  cloudflared.exe nao encontrado em $cloudflared" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SERVIDOR ONLINE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Local:      http://localhost:3000" -ForegroundColor White
Write-Host "  Rede:       http://$(hostname):3000" -ForegroundColor White
Write-Host "  MediaMTX:   http://localhost:8888" -ForegroundColor White
if ($tunnelUrl) {
    Write-Host "  Internet:   $tunnelUrl" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "  Login Admin:" -ForegroundColor Yellow
Write-Host "    Email:    admin@admin.com" -ForegroundColor White
Write-Host "    Senha:    admin123" -ForegroundColor White
Write-Host ""
Write-Host "  Login Usuario:" -ForegroundColor Yellow
Write-Host "    Email:    user@user.com" -ForegroundColor White
Write-Host "    Senha:    user123" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Servidor rodando. Pressione Ctrl+C para sair..." -ForegroundColor Gray
while ($true) { Start-Sleep -Seconds 60 }
