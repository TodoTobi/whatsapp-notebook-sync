@echo off
chcp 65001 >nul
title WA Sync — Detener

echo.
echo  Deteniendo WA Sync...
echo.

:: Matar todos los procesos node.js que corran index.js
taskkill /F /FI "WINDOWTITLE eq WA Sync" /T >nul 2>&1
taskkill /F /IM "node.exe" /FI "WINDOWTITLE eq WA Sync" >nul 2>&1

:: Por si acaso, buscar por el puerto del dashboard
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3030" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo  [OK] Proceso detenido.
echo.
timeout /t 2 >nul