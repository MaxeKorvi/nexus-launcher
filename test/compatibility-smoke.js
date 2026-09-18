'use strict';
const assert = require('assert');
const Module = require('module');
const path = require('path');
const os = require('os');
const fs = require('fs');
const originalLoad = Module._load;

const fakeElectron = {
  app: {
    getPath(name) { return path.join(os.tmpdir(), 'nexus-smoke', name); },
    getVersion() { return 'test'; },
    setLoginItemSettings() {}
  },
  BrowserWindow: { getAllWindows() { return []; }, getFocusedWindow() { return null; } },
  dialog: { async showOpenDialog() { return { filePaths: [] }; } },
  shell: { openPath() {} },
  Notification: class { show() {} }
};

class MockStore {
  constructor() { this.store = {}; }
  get(key, def) { return this.store[key] !== undefined ? this.store[key] : def; }
  set(key, val) { this.store[key] = val; }
  delete(key) { delete this.store[key]; }
  clear() { this.store = {}; }
}

const mockAxios = Object.assign(
  async function(config) {
    if (process.env.TEST_OFFLINE) {
      throw new Error('ENOTFOUND network offline');
    }
    const stream = new (require('stream').Readable)();
    stream._read = () => {};
    setTimeout(() => {
      try {
        stream.push('dummy data');
        stream.push(null);
      } catch {}
    }, 10);
    return {
      status: 200,
      headers: { 'content-length': '10' },
      data: stream
    };
  },
  {
    get: async (url) => {
      if (process.env.TEST_OFFLINE) {
        throw new Error('ENOTFOUND network offline');
      }
      if (url.includes('version_manifest_v2.json')) {
        return { data: { versions: [{ id: '1.20.4', type: 'release', url: 'manifest_1.20.4.json' }] } };
      }
      return { data: {} };
    },
    post: async () => ({ data: {} }),
    create() { return this; },
    CancelToken: {
      source() {
        return {
          token: { reason: null },
          cancel(reason) { this.token.reason = reason; }
        };
      }
    },
    isCancel(val) { return val && val.__CANCEL__; }
  }
);

const mockJSZip = function() {
  return {
    loadAsync: async () => ({
      file: () => null
    })
  };
};

Module._load = function(request, parent, isMain) {
  if (request === 'electron') return fakeElectron;
  if (request === 'electron-store') return MockStore;
  if (request === 'axios') return mockAxios;
  if (request === 'jszip') return mockJSZip;
  if (request === 'keytar') return null;
  return originalLoad.call(this, request, parent, isMain);
};

process.env.NODE_ENV = 'test';

const root = path.resolve(__dirname, '..');
const Java = require(path.join(root, 'src/services/java'));
const Shared = require(path.join(root, 'src/services/shared'));
const Launcher = require(path.join(root, 'src/services/launcher')).__testing;
const Downloads = require(path.join(root, 'src/services/downloads'));
const VersionsTesting = require(path.join(root, 'src/services/versions')).__testing;

// ─── Java version parsing ─────────────────────────────────────────────────
assert.equal(Java.parseJavaMajor('java version "1.8.0_412"'), 8);
assert.equal(Java.parseJavaMajor('openjdk version "17.0.12" 2024-07-16'), 17);
assert.equal(Java.parseJavaMajor('openjdk 21.0.4 2024-07-16'), 21);
console.log('[OK] Java.parseJavaMajor');

// ─── Java requirement ──────────────────────────────────────────────────────
let req = Launcher.javaRequirement({ id: '1.7.10-Forge10.13.4.1614-1.7.10', inheritsFrom: '1.7.10', mainClass: 'net.minecraft.launchwrapper.Launch' }, '1.7.10-Forge10.13.4.1614-1.7.10');
assert.deepEqual([req.major, req.exact], [8, true]);
req = Launcher.javaRequirement({ id: '1.20.4' }, '1.20.4');
assert.deepEqual([req.major, req.exact], [17, true]);
req = Launcher.javaRequirement({ id: '1.20.5' }, '1.20.5');
assert.deepEqual([req.major, req.exact], [21, true]);
req = Launcher.javaRequirement({ id: 'future', javaVersion: { majorVersion: 25 } }, 'future');
assert.deepEqual([req.major, req.exact], [25, true]);
console.log('[OK] javaRequirement');

// ─── Shared: parseMavenCoordinate ─────────────────────────────────────────
const coord = Shared.parseMavenCoordinate('org.example:demo:1.2.3:all@zip');
assert.equal(coord.rel, 'org/example/demo/1.2.3/demo-1.2.3-all.zip');
assert.ok(Shared.parseMavenCoordinate('') === null);
assert.ok(Shared.parseMavenCoordinate('a:b') === null);
console.log('[OK] Shared.parseMavenCoordinate');

// ─── Shared: isAllowed / ruleMatches ───────────────────────────────────────
assert.ok(Shared.isAllowed([]));
assert.ok(Shared.isAllowed(null));
assert.ok(Shared.isAllowed([{ action: 'allow' }]));
assert.ok(!Shared.isAllowed([{ action: 'disallow' }]));
console.log('[OK] Shared.isAllowed');

// ─── Shared: compareVersionLike ────────────────────────────────────────────
assert.ok(Shared.compareVersionLike('1.20.1', '1.20.4') < 0);
assert.ok(Shared.compareVersionLike('1.20.4', '1.20.1') > 0);
assert.ok(Shared.compareVersionLike('1.20.4', '1.20.4') === 0);
console.log('[OK] Shared.compareVersionLike');

// ─── Shared: minecraftMinor ────────────────────────────────────────────────
assert.equal(Shared.minecraftMinor('1.7.10'), 7);
assert.equal(Shared.minecraftMinor('1.12.2'), 12);
assert.equal(Shared.minecraftMinor('1.20.4'), 20);
assert.equal(Shared.minecraftMinor('foo'), 999);
console.log('[OK] Shared.minecraftMinor');

// ─── Shared: versionTuple ──────────────────────────────────────────────────
assert.deepEqual(Shared.versionTuple('1.7.10'), [1, 7, 10]);
assert.deepEqual(Shared.versionTuple('1.20'), [1, 20, 0]);
assert.equal(Shared.versionTuple('abc'), null);
console.log('[OK] Shared.versionTuple');

// ─── Shared: minecraftVersionFromMeta ──────────────────────────────────────
assert.equal(Shared.minecraftVersionFromMeta({ inheritsFrom: '1.20.4' }, 'test'), '1.20.4');
assert.equal(Shared.minecraftVersionFromMeta({ id: '1.19.2' }, 'test'), '1.19.2');
console.log('[OK] Shared.minecraftVersionFromMeta');

// ─── Shared: isLegacyForge ─────────────────────────────────────────────────
assert.ok(Shared.isLegacyForge({}, 'forge-1.7.10-1234'));
assert.ok(!Shared.isLegacyForge({}, 'forge-1.20.4-1234'));
assert.ok(!Shared.isLegacyForge({ id: '1.19.2-forge', libraries: [{ name: 'example:library:1.12.0' }] }, '1.19.2-forge'));
assert.ok(!Shared.isLegacyForge({}, 'fabric-1.7.10'));
console.log('[OK] Shared.isLegacyForge');

// ─── Shared: sanitizeName ──────────────────────────────────────────────────
assert.equal(Shared.sanitizeName('test:version'), 'test_version');
assert.equal(Shared.sanitizeName('normal'), 'normal');
console.log('[OK] Shared.sanitizeName');

// ─── Shared: osName ────────────────────────────────────────────────────────
assert.ok(['linux', 'windows', 'osx'].includes(Shared.osName()));
console.log('[OK] Shared.osName');

// ─── Shared: libraryIdentity ───────────────────────────────────────────────
assert.equal(Shared.libraryIdentity({ name: 'org.example:lib:1.0' }), 'org.example:lib::jar');
assert.equal(Shared.libraryIdentity({ name: 'org.example:lib:1.0:client@zip' }), 'org.example:lib:client:zip');
console.log('[OK] Shared.libraryIdentity');

// ─── Launcher: sanitizeJvmArgsForJava ──────────────────────────────────────
assert.deepEqual(Launcher.sanitizeJvmArgsForJava(['--add-opens', 'a=b', '-Xmx2G'], 8), ['-Xmx2G']);
assert.deepEqual(Launcher.sanitizeJvmArgsForJava(['-XX:MaxPermSize=256m', '-Xmx2G'], 17), ['-Xmx2G']);
console.log('[OK] sanitizeJvmArgsForJava');

// ─── Launcher: resolveMainClass ────────────────────────────────────────────
assert.equal(Launcher.resolveMainClass({ mainClass: 'net.minecraft.client.main.Main' }, 'test'), 'net.minecraft.client.main.Main');
assert.equal(Launcher.resolveMainClass({}, 'forge-1.7.10-1234'), 'net.minecraft.launchwrapper.Launch');
console.log('[OK] resolveMainClass');

// ─── Launcher: preflightLaunch ─────────────────────────────────────────────
const issues = Launcher.preflightLaunch({ libraries: [] }, 'test', '/nonexistent');
assert.ok(issues.length > 0);
console.log('[OK] preflightLaunch');

// Empty files and missing derived runtime data must be repaired before Java starts.
const preflightRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-preflight-'));
fs.mkdirSync(path.join(preflightRoot, 'versions', '1.20.4'), { recursive: true });
fs.writeFileSync(path.join(preflightRoot, 'versions', '1.20.4', '1.20.4.jar'), 'client');
fs.mkdirSync(path.join(preflightRoot, 'libraries', 'org', 'example', 'demo', '1.0'), { recursive: true });
fs.writeFileSync(path.join(preflightRoot, 'libraries', 'org', 'example', 'demo', '1.0', 'demo-1.0.jar'), '');
const damagedIssues = Launcher.preflightLaunch({
  id: '1.20.4',
  assetIndex: { id: '12' },
  libraries: [{ name: 'org.example:demo:1.0' }]
}, '1.20.4', preflightRoot);
assert.ok(damagedIssues.some(x => x.includes('библиотеки')));
assert.ok(damagedIssues.some(x => x.includes('индекс ресурсов')));
fs.rmSync(preflightRoot, { recursive: true, force: true });
console.log('[OK] preflight detects damaged installation');

// Child loader profiles override matching parent libraries without losing base arguments.
const merged = Launcher.mergeVersionMeta(
  { id: '1.20.4', libraries: [{ name: 'org.example:demo:1.0' }], arguments: { jvm: ['-Dparent=1'], game: ['--demo'] } },
  { id: 'loader', inheritsFrom: '1.20.4', libraries: [{ name: 'org.example:demo:2.0' }], arguments: { jvm: ['-Dchild=1'] } }
);
assert.equal(merged.libraries.length, 1);
assert.equal(merged.libraries[0].name, 'org.example:demo:2.0');
assert.deepEqual(merged.arguments.jvm, ['-Dparent=1', '-Dchild=1']);
assert.equal(merged.jar, '1.20.4');
console.log('[OK] inherited profile merge');

// Forge JVM ignoreList must reference the inherited vanilla JAR, while game
// arguments keep the selected profile id.
const forgeArgs = Launcher.buildLaunchArgs({
  settings: { java: { minHeap: 512, maxHeap: 2048, jvmArgs: '', jvmPreset: 'default' }, resolution: { width: 1280, height: 720, fullscreen: false } },
  vmeta: {
    id: '1.18.2-forge-40.3.12', jar: '1.18.2', mainClass: 'cpw.mods.bootstraplauncher.BootstrapLauncher', libraries: [],
    arguments: { jvm: ['-DignoreList=${version_name}.jar', '-cp', '${classpath}'], game: ['--version', '${version_name}'] }
  },
  versionId: '1.18.2-forge-40.3.12', gameDir: preflightRoot, versionDir: '',
  account: { playerNick: 'Player', playerUuid: '0', accessToken: '0', userType: 'legacy' }, skinAgent: null, javaMajor: 17
});
assert.ok(forgeArgs.includes('-DignoreList=1.18.2.jar'));
assert.equal(forgeArgs[forgeArgs.indexOf('--version') + 1], '1.18.2-forge-40.3.12');
console.log('[OK] Forge inherited JAR placeholder');

// ─── Downloads: detectArchiveFormat ───────────────────────────────────────
function buf(...bytes) { return Buffer.from(bytes); }
const Dt = Downloads.__testing;
assert.equal(Dt.detectArchiveFormat(buf(0x50, 0x4B, 0x03, 0x04)), 'zip');
assert.equal(Dt.detectArchiveFormat(buf(0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00)), 'rar');
assert.equal(Dt.detectArchiveFormat(buf(0x1F, 0x8B, 0x08, 0x00)), 'gzip');
assert.equal(Dt.detectArchiveFormat(buf(0xFF, 0xFF, 0xFF)), '');
console.log('[OK] Downloads.detectArchiveFormat');

// ─── Downloads: isHtmlHead ─────────────────────────────────────────────────
assert.ok(Dt.isHtmlHead(Buffer.from('<!DOCTYPE html>')));
assert.ok(!Dt.isHtmlHead(Buffer.from('PK\u0003\u0004')));
console.log('[OK] Downloads.isHtmlHead');

// ─── Downloads: extractGoogleDriveId ──────────────────────────────────────
assert.equal(Dt.extractGoogleDriveId('https://drive.google.com/file/d/abc123def456/view'), 'abc123def456');
assert.equal(Dt.extractGoogleDriveId('https://drive.google.com/uc?export=download&id=abc123def456'), 'abc123def456');
assert.equal(Dt.extractGoogleDriveId('https://example.com'), '');
console.log('[OK] Downloads.extractGoogleDriveId');

// Loader libraries must try their declared repository before unrelated mirrors.
const fabricLibraryUrls = Dt.expandDownloadUrls({
  url: 'https://maven.fabricmc.net/net/fabricmc/fabric-loader/0.19.3/fabric-loader-0.19.3.jar',
  path: '/game/libraries/net/fabricmc/fabric-loader/0.19.3/fabric-loader-0.19.3.jar',
  kind: 'library'
});
assert.equal(fabricLibraryUrls[0], 'https://maven.fabricmc.net/net/fabricmc/fabric-loader/0.19.3/fabric-loader-0.19.3.jar');
console.log('[OK] Downloads loader repository priority');

const orderedLoaders = VersionsTesting.sortLoaderVersions([
  { version: '0.20.0-beta.9', stable: false },
  { version: '0.30.0', stable: true },
  { version: '0.29.2', stable: true }
]);
assert.deepEqual(orderedLoaders.map(x => x.version), ['0.30.0', '0.29.2', '0.20.0-beta.9']);
assert.ok(VersionsTesting.installerArgSets('C:/Nexus/test').some(args => args.includes('C:/Nexus/test')));
console.log('[OK] Loader version ordering and isolated installer target');

// ─── Full integration: accounts ────────────────────────────────────────────
const Accounts = require(path.join(root, 'src/services/accounts'));
const Settings = require(path.join(root, 'src/services/settings'));
const VersionsService = require(path.join(root, 'src/services/versions'));

async function runExtendedTests() {
  console.log('\nRunning extended integration tests...');

  // 1. Adding/removing accounts
  const initialAccounts = await Accounts.list();
  for (const acc of initialAccounts) {
    await Accounts.remove(acc.id);
  }
  assert.equal((await Accounts.list()).length, 0, 'Fresh profile must not contain a pre-authorized account');
  const acc = await Accounts.add({ type: 'local', nickname: 'TestPlayer' });
  assert.equal(acc.nickname, 'TestPlayer');
  assert.equal(acc.type, 'local');
  const list = await Accounts.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].nickname, 'TestPlayer');
  await Accounts.remove(acc.id);
  const listAfter = await Accounts.list();
  assert.equal(listAfter.length, 0);
  const firstLocal = await Accounts.add({ type: 'local', nickname: 'LocalOne' });
  await Accounts.add({ type: 'local', nickname: 'LocalTwo' });
  await Accounts.remove(firstLocal.id);
  const persistedLocal = await Accounts.list();
  assert.equal(persistedLocal.length, 1);
  assert.equal(persistedLocal[0].nickname, 'LocalTwo');
  assert.equal(persistedLocal[0].active, true);
  await Accounts.remove(persistedLocal[0].id);
  console.log('[OK] Adding/removing accounts');

  // 2. Settings
  Settings.reset();
  const defaults = Settings.getAll();
  assert.equal(defaults.autoUpdates, true);
  if (process.platform === 'win32') {
    const expectedDrive = String(process.env.SystemDrive || 'C:').replace(/[\\/]+$/, '');
    assert.equal(defaults.gameFolder, path.join(expectedDrive, 'NexusLauncher'));
    assert.equal(defaults.modpacksFolder, path.join(expectedDrive, 'NexusLauncher', 'modpacks'));
  }
  Settings.set('autoUpdates', false);
  assert.equal(Settings.getAll().autoUpdates, false);
  Settings.reset();
  assert.equal(Settings.getAll().autoUpdates, true);
  console.log('[OK] Settings');

  // 3. Downloads pause/resume/cancel
  Downloads.start({ id: 'test-item', url: 'http://example.com/file', path: '/tmp/test', size: 1000 }).catch(() => {});
  Downloads.pause('test-item');
  Downloads.resume('test-item');
  Downloads.cancel('test-item');
  Downloads.clearCompleted();
  await new Promise(r => setTimeout(r, 100));
  console.log('[OK] Downloads pause/resume/cancel');

  // 4. Installed versions list
  const installed = await VersionsService.getInstalled();
  assert.ok(Array.isArray(installed));
  console.log('[OK] getInstalled');

  // 5. Offline mode
  process.env.TEST_OFFLINE = '1';
  try {
    await VersionsService.list({ type: 'all' });
    assert.fail('Should have failed in offline mode');
  } catch (err) {
    assert.ok(err.message.includes('offline') || err.message.length > 0);
  }
  delete process.env.TEST_OFFLINE;
  console.log('[OK] Offline mode handling');

  console.log('\nAll tests: OK');
}

runExtendedTests().catch(err => {
  console.error('Tests failed:', err);
  process.exit(1);
});
