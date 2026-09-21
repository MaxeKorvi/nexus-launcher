@echo off
setlocal
title Nexus Launcher - Deploy to Netlify (Release 2026.1.2)

echo ===================================================
echo   Nexus Launcher 2026.1.2 - Deploy to Netlify
echo ===================================================
echo.

cd /d "C:\Users\Administrator\Documents\launcher"

set "NODE=node"
where node >nul 2>&1
if errorlevel 1 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "NODE=C:\Program Files\nodejs\node.exe"
    )
)

"%NODE%" update-netlify.js

echo.
pause
