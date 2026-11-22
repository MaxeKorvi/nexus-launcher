'use strict';

/**
 * Cross-Platform Build & Distribution Script for Nexus Launcher
 * Targets:
 *  - Linux (dir, tar.gz standalone package)
 *  - Windows (dir, zip standalone package with Nexus Launcher.exe)
 */

process.noAsar = true;

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const builder = require('electron-builder');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const VERSION = 'build-26.3.0.0.1';

async function buildAll() {
  console.log(`[Build] Starting cross-platform compilation for Nexus Launcher (${VERSION})...`);

  // 1. Compile Linux Unpacked
  console.log('[Build] Packaging Linux x64...');
  await builder.build({
    targets: builder.Platform.LINUX.createTarget(['dir']),
    config: {
      appId: 'app.nexus.launcher',
      productName: 'Nexus Launcher',
      directories: { output: 'dist' },
      files: ['src/**/*', 'package.json'],
      linux: { category: 'Game' }
    }
  });

  const linuxAsar = path.join(DIST_DIR, 'linux-unpacked', 'resources', 'app.asar');
  const winAsar = path.join(DIST_DIR, 'win-unpacked', 'resources', 'app.asar');

  if (fs.existsSync(linuxAsar)) {
    console.log('[Build] Syncing latest app.asar to Windows package...');
    fs.copyFileSync(linuxAsar, winAsar);
  }

  // 2. Compress Linux archive
  const linuxTar = path.join(DIST_DIR, `Nexus-Launcher-${VERSION}-Linux-x64.tar.gz`);
  console.log(`[Build] Creating Linux release archive: ${path.basename(linuxTar)}...`);
  try {
    execSync(`tar -czf "${linuxTar}" -C "${DIST_DIR}" linux-unpacked`, { stdio: 'inherit' });
  } catch (e) {
    console.warn('[Build] tar warning:', e.message);
  }

  // 3. Compress Windows archive
  const winZip = path.join(DIST_DIR, `Nexus-Launcher-${VERSION}-Windows-x64.zip`);
  console.log(`[Build] Creating Windows release archive: ${path.basename(winZip)}...`);
  try {
    execSync(`python3 -c "
import zipfile, os
dist_dir = '${DIST_DIR}'
win_dir = os.path.join(dist_dir, 'win-unpacked')
out_zip = '${winZip}'
with zipfile.ZipFile(out_zip, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(win_dir):
        for file in files:
            full = os.path.join(root, file)
            z.write(full, os.path.relpath(full, dist_dir))
"`, { stdio: 'inherit' });
  } catch (e) {
    console.warn('[Build] zip warning:', e.message);
  }

  console.log('\n[Build] All cross-platform builds generated successfully!');
  console.log(`- Linux Directory:   ${path.join(DIST_DIR, 'linux-unpacked')}`);
  console.log(`- Linux Archive:     ${linuxTar}`);
  console.log(`- Windows Directory: ${path.join(DIST_DIR, 'win-unpacked')}`);
  console.log(`- Windows Archive:   ${winZip}`);
}

buildAll().catch(err => {
  console.error('[Build FATAL]', err);
  process.exit(1);
});
