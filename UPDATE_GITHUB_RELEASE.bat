@echo off
setlocal
title Nexus Launcher - GitHub Release Update

echo ===================================================
echo   Nexus Launcher 2026.1.1 - GitHub Release Update
echo ===================================================
echo.

cd /d "C:\Users\Administrator\Documents\launcher"
if errorlevel 1 (
    echo [ERROR] Cannot open directory C:\Users\Administrator\Documents\launcher
    goto :done
)

set "GIT=git"
where git >nul 2>&1
if errorlevel 1 (
    if exist "C:\Program Files\Git\cmd\git.exe" (
        set "GIT=C:\Program Files\Git\cmd\git.exe"
    )
)

echo [1/3] Adding changes to git...
"%GIT%" add .

echo [2/3] Committing changes...
"%GIT%" commit -m "Fix release builds: smoke tests, loader launches, and Ely skin upload"

echo [3/3] Pushing to GitHub (origin main)...
"%GIT%" push origin main

if errorlevel 1 (
    echo.
    echo [ERROR] Push failed! Please check git connection.
) else (
    echo.
    echo ===================================================
    echo [SUCCESS] Changes pushed to GitHub main branch!
    echo.
    echo GitHub Actions has started building release packages:
    echo  - Nexus Launcher Setup 2026.1.1.exe
    echo  - Nexus-Launcher-Portable-2026.1.1-x86.exe
    echo  - Nexus-Launcher-2026.1.1-x86_64.AppImage
    echo.
    echo The installer in Release 2026.1.1 will be updated
    echo automatically once GitHub Actions finishes.
    echo ===================================================
)

:done
echo.
pause
