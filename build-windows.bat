@echo off
REM Nexus Launcher — Windows Build Script
cd /d "%~dp0"
echo [Nexus Launcher] Packaging for Windows...
set ELECTRON_RUN_AS_NODE=1
node_modules\electron\dist\electron.exe scripts\build-win-exe.js
echo [Nexus Launcher] Windows build complete! Check dist\*.exe
pause
