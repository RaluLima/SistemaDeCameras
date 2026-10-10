@echo off
cd /d "%~dp0"
title Camera Monitor Server
color 0A

echo.
echo ========================================
echo   Camera Monitor - Iniciando Servidores
echo ========================================
echo.

:: Verificar Redis
echo [1/7] Verificando Redis...
netstat -ano | findstr ":6379" | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo       Redis parado. Iniciando...
    start /B "" "tools\redis\redis-server.exe" "tools\redis\redis.windows.conf"
    timeout /t 3 /nobreak >nul
)
echo       Redis OK

:: Verificar PostgreSQL
echo [2/7] Verificando PostgreSQL...
netstat -ano | findstr ":5432" | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo       PostgreSQL parado. Iniciando...
    "D:\PostgreSQL\18\bin\pg_ctl" start -D "D:\PostgreSQL\18\data" -l "D:\PostgreSQL\18\data\startup.log" -w
    timeout /t 4 /nobreak >nul
)
echo       PostgreSQL OK

:: Verificar MediaMTX
echo [3/7] Verificando MediaMTX...
netstat -ano | findstr ":8888" | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo       MediaMTX parado. Iniciando...
    start /B "" "mediamtx.exe" "mediamtx.yml"
    timeout /t 3 /nobreak >nul
)
echo       MediaMTX OK

:: Sincronizar banco de dados
echo [4/7] Sincronizando banco de dados...
call npx prisma generate >nul 2>&1
call npx prisma migrate deploy
echo       Banco OK

:: Verificar Next.js
echo [5/7] Verificando Next.js...
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo       Next.js parado. Iniciando...
    start /B powershell -NoProfile -Command "Set-Location '%~dp0'; node server.js"
    timeout /t 10 /nobreak >nul
)
echo       Next.js OK

:: Verificar AI Service
echo [6/7] Verificando AI Service...
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo       AI Service parado. Iniciando...
    start /B powershell -NoProfile -Command "Set-Location '%~dp0'; `$env:NEXTJS_URL='http://localhost:3000'; `$env:AI_SECRET='camview-ai-secret-2024'; `$env:REDIS_URL='redis://localhost:6379'; python ai-service\main.py"
    timeout /t 8 /nobreak >nul
)
echo       AI Service OK

:: Verificar Recorder (gravacao de segmentos)
echo [7/7] Verificando Recorder...
if exist "recorder\worker.pid" (
    for /f %%p in ('type "recorder\worker.pid"') do (
        tasklist /FI "PID eq %%p" /NH 2>nul | find "%%p" >nul 2>&1
        if not errorlevel 1 (
            echo       Recorder ja rodando ^(PID %%p^)
            goto :recorder_done
        )
    )
    del /q "recorder\worker.pid" >nul 2>&1
)
if not exist "recorder\worker.js" (
    echo       recorder\worker.js nao encontrado.
    goto :recorder_done
)
if not exist "tools\ffmpeg\bin\ffmpeg.exe" (
    echo       ffmpeg nao encontrado em tools\ffmpeg\bin\ffmpeg.exe
    goto :recorder_done
)
set "REC_KEY="
for /f "tokens=1,* delims==" %%a in ('findstr /b /c:"RECORDING_SERVICE_KEY" ".env" 2^>nul') do set "REC_KEY=%%b"
set "REC_KEY=%REC_KEY:"=%"
if not defined REC_KEY (
    echo       RECORDING_SERVICE_KEY ausente no .env - recorder ignorado
    goto :recorder_done
)
echo       Recorder parado. Iniciando...
start /B powershell -NoProfile -Command "Set-Location '%~dp0'; `$env:API_URL='http://localhost:3000'; `$env:RECORDER_KEY='%REC_KEY%'; `$env:FFMPEG='%~dp0tools\ffmpeg\bin\ffmpeg.exe'; `$env:OUTPUT_DIR='%~dp0recordings'; Start-Process -FilePath 'node' -ArgumentList 'recorder\worker.js' -WorkingDirectory '%~dp0' -WindowStyle Hidden -RedirectStandardOutput 'recorder.log' -RedirectStandardError 'recorder-error.log'"
timeout /t 5 /nobreak >nul
echo       Recorder OK
:recorder_done

:: Verificar Cloudflare Tunnel
netstat -ano | findstr ":20241" | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    if exist "cloudflared.exe" (
        echo       Tunnel parado. Iniciando...
        del /q "tunnel-err.log" >nul 2>&1
        start /B "cloudflared" "cloudflared.exe" tunnel --url http://localhost:3000 2> "tunnel-err.log"
        timeout /t 15 /nobreak >nul
    ) else (
        echo       cloudflared.exe nao encontrado.
    )
)
echo       Cloudflare Tunnel OK

echo.
echo ========================================
echo   Todos os servidores rodando!
echo ========================================
echo.
echo   Local:      http://localhost:3000
echo   Internet:   (veja tunnel-err.log)
echo   MediaMTX:   http://localhost:8888
echo   Admin:      admin@admin.com / admin123
echo   Usuario:    user@user.com / user123
echo.
echo   Pressione Ctrl+C para parar
echo ========================================
echo.

pause
