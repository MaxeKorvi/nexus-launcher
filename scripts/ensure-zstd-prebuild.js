'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ZSTD_VERSION = '7.0.0';
const CACHE_BASE = path.join(os.homedir(), '.cache', 'nexus-builder-prebuilds');
const TARGET_NODE = path.resolve(__dirname, '..', 'node_modules', '@mongodb-js', 'zstd', 'build', 'Release', 'zstd.node');

function ensureZstdPrebuild(targetPlatform) {
  const tag = targetPlatform === 'win32' ? 'win32-x64' : 'linux-x64';
  const cacheDir = path.join(CACHE_BASE, tag);
  const cachedNode = path.join(cacheDir, 'build', 'Release', 'zstd.node');

  if (!fs.existsSync(cachedNode)) {
    fs.mkdirSync(cacheDir, { recursive: true });
    const url = `https://github.com/mongodb-js/zstd/releases/download/v${ZSTD_VERSION}/zstd-v${ZSTD_VERSION}-napi-v9-${tag}.tar.gz`;
    console.log(`[Prebuild] Downloading ${tag} zstd.node from ${url}...`);
    execSync(`curl -fsSL "${url}" | tar -xz -C "${cacheDir}"`, { stdio: 'inherit' });
  }

  fs.mkdirSync(path.dirname(TARGET_NODE), { recursive: true });
  fs.copyFileSync(cachedNode, TARGET_NODE);
  console.log(`[Prebuild] Activated ${tag} zstd.node -> ${TARGET_NODE}`);
}

module.exports = { ensureZstdPrebuild };
