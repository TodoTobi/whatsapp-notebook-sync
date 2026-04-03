@echo off
chcp 65001 >nul
title WA Sync

cls
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║        WhatsApp → Google Docs Sync       ║
echo  ║              by TodoTobi                  ║
echo  ╚══════════════════════════════════════════╝
echo.

:: ── Verificar que Node.js está instalado ──────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js no encontrado.
    echo  Descargalo en https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: ── Verificar que existe node_modules ────────────────────────────────────────
if not exist "node_modules\" (
    echo  [Setup] Instalando dependencias por primera vez...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] Fallo npm install.
        pause
        exit /b 1
    )
    echo.
)

:: ── Verificar credentials.json ────────────────────────────────────────────────
if not exist "credentials.json" (
    echo  [ERROR] No se encontro credentials.json
    echo  Descargalo desde Google Cloud Console y pegalo en esta carpeta.
    echo.
    pause
    exit /b 1
)

:: ── Lanzar el proceso ─────────────────────────────────────────────────────────
echo  [OK] Todo listo. Iniciando...
echo.
echo  Dashboard: http://localhost:3030
echo  Para detener el proceso: cerrá esta ventana o usá el dashboard.
echo.
echo  ──────────────────────────────────────────────────────────────────
echo.

node index.js

:: ── Si el proceso termina ────────────────────────────────────────────────────
echo.
echo  ──────────────────────────────────────────────────────────────────
echo  [Info] El proceso terminó.
echo.
pause