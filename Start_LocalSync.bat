@echo off
title LocalSync Server
echo =========================================
echo       Starting LocalSync Server...
echo =========================================
cd /d "%~dp0"

:: Start the server in the background and wait 2 seconds
start /b npm start

:: Wait for server to start
timeout /t 3 /nobreak >nul

:: Open browser
echo Opening LocalSync in your browser...
start http://localhost:3000

echo.
echo LocalSync is running! You can minimize this window.
echo Close this window to stop the server.
echo.
:: Keep window open to see logs
cmd /k
