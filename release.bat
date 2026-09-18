@echo off
setlocal
cd /d "C:\Users\Administrator\Documents\launcher"
echo ===================================================
echo [1/2] Pushing fixes to GitHub...
echo ===================================================
"C:\Program Files\Git\cmd\git.exe" add .
"C:\Program Files\Git\cmd\git.exe" commit -m "Fix modded version launch and Ely.by skin upload (Release 2026.1.1)"
"C:\Program Files\Git\cmd\git.exe" push origin main
echo.
echo ===================================================
echo [2/2] Building Windows NSIS installer locally...
echo ===================================================
call npm run dist:win:nsis
echo.
echo ===================================================
echo Done!
echo ===================================================
pause
