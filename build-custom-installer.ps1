# Nexus Launcher Custom Modern Installer Build Script
$nodePath = "node"
if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    $fallback = "C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
    if (Test-Path $fallback) { $nodePath = $fallback }
}

Write-Host "==> [1/3] Packing win-unpacked with electron-builder..." -ForegroundColor Cyan
& $nodePath node_modules/electron-builder/cli.js --win --dir

Write-Host "==> [2/3] Zipping win-unpacked payload..." -ForegroundColor Cyan
Remove-Item -Path "installer-ui\payload\NexusLauncher.zip" -Force -ErrorAction SilentlyContinue
& ".\node_modules\7zip-bin\win\x64\7za.exe" a -tzip "installer-ui\payload\NexusLauncher.zip" ".\dist\win-unpacked\*" -mx=3

Write-Host "==> [3/3] Building custom installer UI..." -ForegroundColor Cyan
Remove-Item -Path "dist\custom-installer\*" -Recurse -Force -ErrorAction SilentlyContinue
powershell -Command "Set-Location installer-ui; & '$nodePath' ..\node_modules\electron-builder\cli.js --win"

Copy-Item -Path "dist\custom-installer\Nexus Launcher Setup 2026.1.1.exe" -Destination "dist\Nexus Launcher Setup 2026.1.1.exe" -Force
Write-Host "==> [SUCCESS] Modern installer built at: dist\Nexus Launcher Setup 2026.1.1.exe" -ForegroundColor Green
