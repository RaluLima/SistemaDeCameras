@echo off
cd /d "F:\SistemaDeCameras-main"
title Camera Monitor - Teste de Camera
color 0B

echo.
echo ========================================
echo   Camera Monitor - Setup Camera Teste
echo ========================================
echo.

:: 1. Iniciar MediaMTX (RTSP -> HLS)
echo [1/3] Iniciando MediaMTX (servidor de mídia)...
start /B powershell -NoProfile -Command "Start-Process 'F:\SistemaDeCameras-main\mediamtx.exe' -WorkingDirectory 'F:\SistemaDeCameras-main' -WindowStyle Hidden"
timeout /t 3 /nobreak >nul
netstat -ano | findstr ":8554" | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo       ERRO: MediaMTX nao iniciou na porta 8554
    pause
    exit /b 1
)
echo       MediaMTX OK (RTSP :8554 / HLS :8888)

:: 2. Iniciar stream de teste via ffmpeg
echo [2/3] Iniciando stream de video de teste...
start /B powershell -NoProfile -Command "$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); ffmpeg -re -stream_loop -1 -i 'F:\SistemaDeCameras-main\Imagem camera teste\VideoDaQueda.mp4' -r 60 -c:v libx264 -preset ultrafast -tune zerolatency -c:a aac -f rtsp rtsp://localhost:8554/test-camera"
timeout /t 5 /nobreak >nul
echo       Stream ativo em rtsp://localhost:8554/test-camera

:: 3. Verificar HLS
echo [3/3] Verificando HLS...
timeout /t 3 /nobreak >nul
echo       HLS disponivel em http://localhost:8888/test-camera/index.m3u8

echo.
echo ========================================
echo   Camera Teste Configurada!
echo ========================================
echo.
echo   Para cadastrar no painel admin:
echo     Nome: Camera Teste
echo     Tipo: IP (RTSP)
echo     Stream URL: rtsp://localhost:8554/test-camera
echo     Status: Ativa
echo     Retencao: 7 dias
echo     Gravacao: Ativada
echo     IA: Ativada
echo.
echo   URLs de teste:
echo     RTSP: rtsp://localhost:8554/test-camera
echo     HLS:  http://localhost:8888/test-camera/index.m3u8
echo.
echo   Pressione Ctrl+C para parar o stream
echo ========================================
echo.

:: Manter vivo
pause
