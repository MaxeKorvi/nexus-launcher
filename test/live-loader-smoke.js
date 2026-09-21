'use strict';

const Module = require('module');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const originalLoad = Module._load;
class MockStore {
  constructor() { this.store = {}; }
  get(key, fallback) { return this.store[key] === undefined ? fallback : this.store[key]; }
  set(key, value) { this.store[key] = value; }
  delete(key) { delete this.store[key]; }
  clear() { this.store = {}; }
}
const fakeElectron = {
  app: { getPath: () => path.join(os.tmpdir(), 'nexus-live-loader-smoke'), getVersion: () => '2026.1.2' },
  BrowserWindow: { getAllWindows: () => [] },
  shell: { openPath() {} },
  dialog: { async showOpenDialog() { return { filePaths: [] }; } }
};
Module._load = function(request, parent, isMain) {
  if (request === 'electron') return fakeElectron;
  if (request === 'electron-store') return MockStore;
  return originalLoad.call(this, request, parent, isMain);
};
process.env.NODE_ENV = 'test';

async function main() {
  const Versions = require('../src/services/versions');
  const api = Versions.__testing;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-loader-'));
  try {
    for (const [name, install] of [
      ['fabric', api.installFabricProfile],
      ['quilt', api.installQuiltProfile]
    ]) {
      const loaderInfo = await api.resolveLoaderInfo(name, '1.20.1');
      const result = await install(root, '1.20.1', loaderInfo.version);
      const profileFile = path.join(root, 'versions', result.id, `${result.id}.json`);
      const profile = JSON.parse(await fs.readFile(profileFile, 'utf8'));
      for (const lib of profile.libraries || []) {
        const parsed = api.parseMavenCoordinate(lib.name);
        if (!parsed) throw new Error(`${name}: invalid Maven coordinate ${lib.name}`);
        const file = path.join(root, 'libraries', parsed.rel);
        const stat = await fs.stat(file);
        if (!stat.size) throw new Error(`${name}: empty library ${lib.name}`);
      }
      console.log(`[OK] ${name} ${result.loaderVersion}: ${profile.libraries.length} libraries`);
    }
    if (process.argv.includes('--installers')) {
      for (const [name, minecraft, install] of [
        ['forge', '1.20.1', api.installForgeProfile],
        ['neoforge', '1.21.1', api.installNeoForgeProfile]
      ]) {
        const loaderInfo = await api.resolveLoaderInfo(name, minecraft);
        const result = await install(root, minecraft, loaderInfo.version);
        const profileFile = path.join(root, 'versions', result.id, `${result.id}.json`);
        const profile = JSON.parse(await fs.readFile(profileFile, 'utf8'));
        if (!profile.mainClass) throw new Error(`${name}: profile has no mainClass`);
        console.log(`[OK] ${name} ${result.loaderVersion}: ${result.id} (${profile.mainClass})`);
      }
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
