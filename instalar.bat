@echo off
rem ============================================================
rem   Camera Monitor - Instalador (duplo clique)
rem   Instala/configura TUDO: Node, Python, PostgreSQL, binarios,
rem   dependencias, banco de dados e o painel grafico.
rem ============================================================
setlocal
cd /d "%~dp0"

echo.
echo   Instalando Camera Monitor...
echo   Se pedir, clique em "Sim" (permissao de Administrador).
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar.ps1" %*
set "ERR=%ERRORLEVEL%"

echo.
if "%ERR%"=="0" (
    echo   Instalacao concluida. Veja INSTALACAO.md.
) else (
    echo   Instalacao terminou com avisos/falhas - veja a lista acima.
)
echo.
pause
exit /b %ERR%
