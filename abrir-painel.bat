@echo off
title Camera Monitor - Painel de Servidores
cd /d "%~dp0"
if exist "dist\CameraMonitor-Panel.exe" (
    start "" "dist\CameraMonitor-Panel.exe"
) else (
    echo Painel compilado nao encontrado em "%~dp0dist\CameraMonitor-Panel.exe"
    echo Iniciando o painel a partir do fonte Python...
    python server_panel.py
)
