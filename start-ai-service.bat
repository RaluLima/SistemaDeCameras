@echo off
echo ============================================
echo   CamView AI Service - Local Development
echo ============================================
echo.

cd /d "%~dp0"

echo [1/2] Verificando dependencias Python...
pip install -q -r ai-service\requirements.txt 2>nul

echo [2/2] Iniciando AI Service na porta 8000...
set NEXTJS_URL=http://localhost:3000
set AI_SECRET=camview-ai-secret-2024
set REDIS_URL=redis://localhost:6379

python ai-service\main.py

pause
