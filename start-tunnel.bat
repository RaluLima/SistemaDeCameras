@echo off
title Camera Monitor - Cloudflare Tunnel
cd /d "%~dp0"
del /q "tunnel-err.log" >nul 2>&1
start "" "cloudflared.exe" tunnel --url http://127.0.0.1:3000 2> "tunnel-err.log"
echo Tunel iniciado. URL publica em tunnel-err.log
