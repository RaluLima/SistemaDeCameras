@echo off
cd /d "F:\SistemaDeCameras-main"
del /q "F:\SistemaDeCameras-main\tunnel-err.log" >nul 2>&1
powershell -NoProfile -Command "Start-Process 'F:\SistemaDeCameras-main\cloudflared.exe' -ArgumentList 'tunnel','--url','http://127.0.0.1:3000' -RedirectStandardError 'F:\SistemaDeCameras-main\tunnel-err.log' -WindowStyle Hidden"
