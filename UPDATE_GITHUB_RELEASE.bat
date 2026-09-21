@echo off
setlocal
title Nexus Launcher - GitHub Release Update

echo ===================================================
echo   Nexus Launcher 2026.1.2 - GitHub Release Update
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
"%GIT%" commit -m "Nexus Launcher 2026.1.2: Modern Version Manager and Themes UI"

echo [3/4] Pushing to GitHub (origin main)...
"%GIT%" push origin main

echo [4/4] Creating and pushing release tag 2026.1.2...
"%GIT%" tag -f 2026.1.2
"%GIT%" push origin 2026.1.2 --force

if errorlevel 1 (
    echo.
    echo [ERROR] Push failed! Please check git connection.
) else (
    echo.
    echo [5/5] Updating and deploying Netlify project...
    set "NODE=node"
    where node >nul 2>&1
    if errorlevel 1 (
        if exist "C:\Program Files\nodejs\node.exe" (
            set "NODE=C:\Program Files\nodejs\node.exe"
        )
    )
    "%NODE%" update-netlify.js

    echo.
    echo ===================================================
    echo [SUCCESS] Release 2026.1.2 pushed and Netlify updated!
    echo.
    echo GitHub Actions has started building release packages:
    echo  - Nexus Launcher Setup 2026.1.2.exe
    echo  - Nexus-Launcher-Portable-2026.1.2-x86.exe
    echo  - Nexus-Launcher-2026.1.2-x86_64.AppImage
    echo.
    echo The installer in Release 2026.1.2 will be updated
    echo automatically once GitHub Actions finishes.
    echo ===================================================
)

:done
echo.
pause
