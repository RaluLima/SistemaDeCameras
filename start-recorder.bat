@echo off
cd /d "%~dp0"
title Camera Monitor - Recorder Worker

:: Le a chave do .env
for /f "tokens=1,* delims==" %%a in ('findstr /b "RECORDING_SERVICE_KEY" ".env"') do (
    set "RECORDER_KEY=%%b"
)
set "RECORDER_KEY=%RECORDER_KEY:"=%"

if not defined RECORDER_KEY (
    echo ERRO: RECORDING_SERVICE_KEY nao encontrada no .env
    exit /b 1
)

if not exist "tools\ffmpeg\bin\ffmpeg.exe" (
    echo ERRO: ffmpeg nao encontrado em tools\ffmpeg\bin\ffmpeg.exe
    exit /b 1
)

set "API_URL=http://localhost:3000"
set "FFMPEG=%~dp0tools\ffmpeg\bin\ffmpeg.exe"
set "OUTPUT_DIR=%~dp0recordings"
set "SEGMENT_SECONDS=%SEGMENT_SECONDS%"
if not defined SEGMENT_SECONDS set "SEGMENT_SECONDS=60"
set "POLL_INTERVAL=%POLL_INTERVAL%"
if not defined POLL_INTERVAL set "POLL_INTERVAL=15"
set "CONCURRENCY=2"

echo.
echo   Recorder Worker
echo   ------------------------------------------
echo   API ............ %API_URL%
echo   ffmpeg ......... %FFMPEG%
echo   saida .......... %OUTPUT_DIR%
echo   segmento ....... %SEGMENT_SECONDS%s
echo   poll ........... %POLL_INTERVAL%s
echo.
echo   Ctrl+C para encerrar.
echo.

node "%~dp0recorder\worker.js"