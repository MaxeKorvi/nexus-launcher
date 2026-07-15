'use strict';

/**
 * Java runtime manager.
 *
 * Important compatibility rules:
 *  - Legacy Minecraft/Forge (up to 1.16.x) must use Java 8.
 *  - Modern versions use the Java major declared by Mojang metadata.
 *  - Java 8 reports itself as "1.8.x"; parse it as major 8, not 1.
 *
 * Runtimes are discovered from the OS and from Nexus' private jvm directory.
 * Missing runtimes are downloaded dynamically through Azul's public Metadata API
 * instead of hard-coding an update-specific archive URL.
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const { app, dialog } = require('electron');
const { spawnSync } = require('child_process');
const JSZip = require('jszip');
const Downloads = require('./downloads');

const AZUL_PACKAGES = 'https://api.azul.com/metadata/v1/zulu/packages/';
const jvmDir = () => path.join(app.getPath('userData'), 'jvm');

function javaBinary(home) {
  return path.join(home, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
}

function parseJavaMajor(output) {
  const text = String(output || '');
  const quoted = text.match(/(?:java|openjdk)\s+version\s+"([^"]+)"/i);
  const bare = text.match(/(?:openjdk|java)\s+([0-9]+(?:\.[0-9]+)*)/i);
  const value = (quoted && quoted[1]) || (bare && bare[1]) || '';
  const parts = value.split(/[._+-]/).filter(Boolean).map(x => Number.parseInt(x, 10));
  if (!parts.length || !Number.isFinite(parts[0])) return null;
  if (parts[0] === 1 && Number.isFinite(parts[1])) return parts[1];
  return parts[0];
}

function inspectExecutable(executable) {
  if (!executable) return null;
  try {
    const result = spawnSync(executable, ['-XshowSettings:properties', '-version'], {
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
      env: process.env
    });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    const version = parseJavaMajor(output);
    if (!version || result.error) return null;
    const vendor = (output.match(/java\.vendor\s*=\s*([^\r\n]+)/i) || [])[1];
    const home = (output.match(/java\.home\s*=\s*([^\r\n]+)/i) || [])[1];
    const arch = (output.match(/os\.arch\s*=\s*([^\r\n]+)/i) || [])[1];
    return {
      path: executable,
      version,
      vendor: vendor ? vendor.trim() : '',
      home: home ? home.trim() : '',
      arch: arch ? arch.trim() : '',
      raw: output.trim()
    };
  } catch {
    return null;
  }
}

function addCandidate(target, candidate, source, label) {
  if (!candidate) return;
  let executable = candidate;
  try {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) executable = javaBinary(candidate);
  } catch {}
  const inspected = inspectExecutable(executable);
  if (!inspected) return;
  let key = inspected.path;
  try { if (fs.existsSync(inspected.path)) key = fs.realpathSync(inspected.path); } catch {}
  if (target.has(key)) return;
  target.set(key, { ...inspected, path: inspected.path, source, label: label || `Java ${inspected.version}` });
}

async function childDirectories(root, depth = 1) {
  const out = [];
  if (!root || !fs.existsSync(root)) return out;
  async function walk(dir, left) {
    let entries = [];
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      out.push(full);
      if (left > 1) await walk(full, left - 1);
    }
  }
  await walk(root, depth);
  return out;
}

async function detectSystem() {
  const found = new Map();

  addCandidate(found, process.env.JAVA_HOME, 'env', 'JAVA_HOME');
  addCandidate(found, 'java', 'path', 'Java из PATH');

  if (process.platform === 'linux') {
    for (const root of ['/usr/lib/jvm', '/usr/java', '/opt/java', '/opt/jdk']) {
      for (const dir of await childDirectories(root, 2)) addCandidate(found, dir, 'system', path.basename(dir));
    }
  } else if (process.platform === 'darwin') {
    const root = '/Library/Java/JavaVirtualMachines';
    for (const dir of await childDirectories(root, 1)) {
      addCandidate(found, path.join(dir, 'Contents', 'Home'), 'system', path.basename(dir));
    }
  } else if (process.platform === 'win32') {
    const roots = [
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Java'),
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Eclipse Adoptium'),
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Azul Systems'),
      process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Java'),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Eclipse Adoptium')
    ].filter(Boolean);
    for (const root of roots) {
      for (const dir of await childDirectories(root, 2)) addCandidate(found, dir, 'system', path.basename(dir));
    }
  }

  return Array.from(found.values()).sort((a, b) => (a.version - b.version) || String(a.path).localeCompare(String(b.path)));
}

async function listInstalled() {
  const found = new Map();
  for (const item of await detectSystem()) {
    let key = item.path;
    try { if (fs.existsSync(item.path)) key = fs.realpathSync(item.path); } catch {}
    found.set(key, item);
  }

  const dir = jvmDir();
  if (fs.existsSync(dir)) {
    for (const child of await childDirectories(dir, 1)) {
      const executable = javaBinary(child);
      const inspected = inspectExecutable(executable);
      if (!inspected) continue;
      let key = inspected.path;
      try { key = fs.realpathSync(inspected.path); } catch {}
      found.set(key, { ...inspected, source: 'bundled', label: `Nexus Java ${inspected.version}` });
    }
  }

  return Array.from(found.values()).sort((a, b) => (a.version - b.version) || String(a.path).localeCompare(String(b.path)));
}

function azulOs() {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'linux';
}

function azulArch() {
  if (process.arch === 'arm64' || process.arch === 'arm') return 'arm';
  return 'x86';
}

function compareNumberArraysDesc(a, b) {
  const aa = Array.isArray(a) ? a : [];
  const bb = Array.isArray(b) ? b : [];
  const max = Math.max(aa.length, bb.length);
  for (let i = 0; i < max; i++) {
    const diff = (bb[i] || 0) - (aa[i] || 0);
    if (diff) return diff;
  }
  return 0;
}

function supportedArchive(name) {
  const value = String(name || '').toLowerCase();
  if (process.platform === 'win32') return value.endsWith('.zip');
  return value.endsWith('.tar.gz') || value.endsWith('.tgz');
}

async function findAzulPackage(version, packageType) {
  const baseParams = {
    java_version: Number(version),
    os: azulOs(),
    arch: azulArch(),
    hw_bitness: os.arch().includes('64') ? 64 : 32,
    java_package_type: packageType,
    release_status: 'ga',
    availability_types: 'CA',
    page: 1,
    page_size: 100
  };
  const variants = [
    { ...baseParams, certifications: 'tck' },
    baseParams
  ];
  for (const params of variants) {
    const { data } = await axios.get(AZUL_PACKAGES, {
      params,
      timeout: 30000,
      headers: { Accept: 'application/json', 'User-Agent': 'NexusLauncher/1.1.12' }
    });
    const packages = (Array.isArray(data) ? data : [])
      .filter(x => x && x.download_url && supportedArchive(x.name || x.download_url))
      .sort((a, b) => Number(Boolean(b.latest)) - Number(Boolean(a.latest)) || compareNumberArraysDesc(a.distro_version, b.distro_version));
    if (packages.length) return packages[0];
  }
  return null;
}

function safeTarget(root, relative) {
  const clean = path.normalize(relative).replace(/^([.][.][\\/])+/, '');
  const target = path.resolve(root, clean);
  const base = path.resolve(root) + path.sep;
  if (target !== path.resolve(root) && !target.startsWith(base)) throw new Error('Небезопасный путь в Java-архиве: ' + relative);
  return target;
}

async function extractZipStripRoot(archive, target) {
  const zip = await JSZip.loadAsync(await fsp.readFile(archive));
  const names = Object.keys(zip.files).filter(Boolean);
  const firstSegments = names.map(name => name.replace(/\\/g, '/').split('/')[0]).filter(Boolean);
  const commonRoot = firstSegments.length && firstSegments.every(x => x === firstSegments[0]) ? firstSegments[0] : null;
  for (const [rawName, entry] of Object.entries(zip.files)) {
    let name = rawName.replace(/\\/g, '/');
    if (commonRoot && (name === commonRoot || name.startsWith(commonRoot + '/'))) name = name.slice(commonRoot.length).replace(/^\//, '');
    if (!name) continue;
    const out = safeTarget(target, name);
    if (entry.dir) {
      await fsp.mkdir(out, { recursive: true });
    } else {
      await fsp.mkdir(path.dirname(out), { recursive: true });
      await fsp.writeFile(out, await entry.async('nodebuffer'));
    }
  }
}

async function extractArchive(archive, target) {
  await fsp.rm(target, { recursive: true, force: true });
  await fsp.mkdir(target, { recursive: true });
  if (/\.zip$/i.test(archive)) {
    await extractZipStripRoot(archive, target);
  } else {
    const result = spawnSync('tar', ['-xzf', archive, '-C', target, '--strip-components=1'], {
      encoding: 'utf8',
      timeout: 120000,
      windowsHide: true
    });
    if (result.error || result.status !== 0) {
      throw new Error(`Не удалось распаковать Java: ${(result.stderr || result.error && result.error.message || '').trim()}`);
    }
  }
  if (process.platform !== 'win32') {
    try { await fsp.chmod(javaBinary(target), 0o755); } catch {}
  }
}

async function download(version) {
  const major = Number(version);
  if (!Number.isInteger(major) || major < 8) throw new Error('Некорректная версия Java: ' + version);

  let pkg = await findAzulPackage(major, 'jre');
  if (!pkg) pkg = await findAzulPackage(major, 'jdk');
  if (!pkg) throw new Error(`Не найден свободный Java ${major} для ${process.platform}/${process.arch}.`);

  const archiveName = pkg.name || path.basename(new URL(pkg.download_url).pathname) || `java-${major}.archive`;
  const tmpPath = path.join(app.getPath('temp'), `nexus-${Date.now()}-${archiveName}`);
  await Downloads.start({
    id: `java-${major}-${Date.now()}`,
    label: `Java ${major}`,
    url: pkg.download_url,
    path: tmpPath,
    kind: 'java'
  });

  const target = path.join(jvmDir(), `java${major}`);
  try {
    await extractArchive(tmpPath, target);
  } finally {
    try { await fsp.unlink(tmpPath); } catch {}
  }

  const executable = javaBinary(target);
  const inspected = inspectExecutable(executable);
  if (!inspected || inspected.version !== major) {
    await fsp.rm(target, { recursive: true, force: true });
    throw new Error(`Скачанная Java не прошла проверку: ожидалась ${major}, обнаружено ${inspected ? inspected.version : 'неизвестно'}.`);
  }
  return { ok: true, path: executable, version: major, source: 'bundled', label: `Nexus Java ${major}` };
}

async function ensureVersion(version, { exact = false, preferredPath = null } = {}) {
  const major = Number(version);
  let list = await listInstalled();
  if (preferredPath) {
    const preferred = inspectExecutable(preferredPath);
    if (preferred && !list.some(x => x.path === preferred.path)) list.push({ ...preferred, source: 'settings', label: 'Java из настроек' });
  }

  const exactCandidates = list.filter(x => Number(x.version) === major);
  if (exactCandidates.length) {
    const preferredExact = preferredPath && exactCandidates.find(x => x.path === preferredPath);
    return preferredExact || exactCandidates.find(x => x.source === 'bundled') || exactCandidates[0];
  }

  if (!exact) {
    const compatible = list
      .filter(x => Number(x.version) >= major)
      .sort((a, b) => (a.version - b.version) || (a.source === 'bundled' ? -1 : 1));
    if (compatible.length) return compatible[0];
  }

  return download(major);
}

async function pickPath() {
  const r = await dialog.showOpenDialog({
    title: 'Выберите java binary',
    properties: ['openFile'],
    filters: process.platform === 'win32' ? [{ name: 'Java', extensions: ['exe'] }] : []
  });
  return r.filePaths[0] || null;
}

module.exports = {
  detectSystem,
  listInstalled,
  download,
  ensureVersion,
  inspectExecutable,
  parseJavaMajor,
  pickPath
};
