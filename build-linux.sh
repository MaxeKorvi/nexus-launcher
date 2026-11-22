#!/usr/bin/env bash
# Nexus Launcher — Linux Build Script
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "[Nexus Launcher] Building for Linux..."
ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron ./scripts/build-crossplatform.js
echo "[Nexus Launcher] Linux build complete!"
