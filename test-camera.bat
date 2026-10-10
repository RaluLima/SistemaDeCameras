@echo off
cd /d "%~dp0"
title Camera Monitor - Teste de Queda
color 0B

set "FFMPEG=%~dp0tools\ffmpeg\bin\ffmpeg.exe"
set "VIDEO=%~dp0Imagem camera teste\VideoDaQueda.mp4"
set "RTSP=rtsp://localhost:8554/test-camera"

echo.
echo ========================================
echo   Camera Monitor - Teste de Queda
echo ========================================
echo.

if not exist "%FFMPEG%" (
    echo   ERRO: ffmpeg nao encontrado em "%FFMPEG%"
    pause
    exit /b 1
)
if not exist "%VIDEO%" (
    echo   ERRO: video nao encontrado em "%VIDEO%"
    pause
    exit /b 1
)

echo   [1/3] Verificando MediaMTX na porta 8554...
netstat -ano | findstr ":8554" | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo         MediaMTX parado. Iniciando...
    start "" "%~dp0mediamtx.exe" -WorkingDirectory "%~dp0" -WindowStyle Hidden
    timeout /t 4 /nobreak >nul
    netstat -ano | findstr ":8554" | findstr "LISTENING" >nul 2>&1
    if %errorlevel% neq 0 (
        echo         ERRO: MediaMTX nao subiu na porta 8554
        pause
        exit /b 1
    )
)
echo         MediaMTX OK

echo   [2/3] Publicando o video de teste no RTSP...
start "" /B "%FFMPEG%" -re -stream_loop -1 -i "%VIDEO%" -r 30 -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -g 60 -c:a aac -f rtsp -rtsp_transport tcp %RTSP%
timeout /t 6 /nobreak >nul
echo         Stream ativo em %RTSP%

echo   [3/3] Verificando HLS...
timeout /t 3 /nobreak >nul
echo         HLS em http://localhost:8888/test-camera/index.m3u8

echo.
echo ========================================
echo   CAMERA DE TESTE PRONTA
echo ========================================
echo.
echo   Para ativar a deteccao de queda:
echo.
echo   1) No painel admin, crie a camera:
echo        Nome .............. Camera Teste Queda
echo        Tipo .............. IP (RTSP)
echo        Stream URL ........ %RTSP%
echo        Status ............ Ativa
echo        Retencao .......... 7 dias
echo        Gravacao .......... Ativada
echo        IA (monitoramento) Ativada
echo.
echo   2) Ligue o servico de IA (porta 8000) e abra:
echo        /admin/ai-monitoring
echo.
echo   Links:
echo     RTSP .. %RTSP%
echo     HLS ... http://localhost:8888/test-camera/index.m3u8
echo.
echo   Ctrl+C encerra apenas este script.
echo   Para parar o video, use "taskkill /IM ffmpeg.exe /F"
echo ========================================
echo.

pause
