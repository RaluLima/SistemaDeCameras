@echo off
cd /d "F:\SistemaDeCameras-main"
title Camera Monitor Server
color 0A

echo.
echo ========================================
echo   Camera Monitor - Iniciando Servidores
echo ========================================
echo.

:: Verificar PostgreSQL
echo [1/3] Verificando PostgreSQL...
"C:\Program Files\PostgreSQL\16\bin\pg_ctl" status -D "C:\Program Files\PostgreSQL\16\data" >nul 2>&1
if %errorlevel% neq 0 (
    echo       PostgreSQL parado. Iniciando...
    "C:\Program Files\PostgreSQL\16\bin\pg_ctl" start -D "C:\Program Files\PostgreSQL\16\data" -l "C:\Program Files\PostgreSQL\16\data\startup.log" -w
    timeout /t 3 /nobreak >nul
)
echo       PostgreSQL OK

:: Verificar Next.js
echo [2/3] Verificando Next.js...
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo       Next.js parado. Iniciando...
    start /B powershell -NoProfile -Command "Set-Location 'F:\SistemaDeCameras-main'; node node_modules\next\dist\bin\next start -p 3000 -H 0.0.0.0"
    timeout /t 8 /nobreak >nul
)
echo       Next.js OK

:: Verificar Cloudflare Tunnel
echo [3/3] Verificando Cloudflare Tunnel...
netstat -ano | findstr ":20241" | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo       Tunnel parado. Iniciando...
    del /q "F:\SistemaDeCameras-main\tunnel-err.log" >nul 2>&1
    start /B powershell -NoProfile -Command "Start-Process 'F:\SistemaDeCameras-main\cloudflared.exe' -ArgumentList 'tunnel','--url','http://127.0.0.1:3000' -RedirectStandardError 'F:\SistemaDeCameras-main\tunnel-err.log' -WindowStyle Hidden"
    timeout /t 10 /nobreak >nul
)
echo       Cloudflare Tunnel OK

echo.
echo ========================================
echo   Todos os servidores rodando!
echo ========================================
echo.
echo   Local:      http://localhost:3000
echo   Painel:     http://localhost:3000/admin/servers
echo.
echo   Pressione Ctrl+C para parar
echo ========================================
echo.

:: Manter janela aberta
pause
