'use strict';

/**
 * Versions Repository
 *  - Full Mojang manifest
 *  - Per-version isolated installation roots: <gameFolder>/nexus-versions/<profile-id>/
 *  - Fabric, Forge, Quilt and NeoForge loader profiles
 *  - Downloads client, libraries, natives and assets with checksum verification
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const Downloads = require('./downloads');
const JSZip = require('jszip');
const Settings = require('./settings');
const { searchCurseForge, resolveCurseForgeDownload } = require('./catalog');
const {
  createHttpsAgent, osName, sanitizeName, parseMavenCoordinate, mavenPath,
  ruleMatches, isAllowed, compareVersionLike, minecraftMinor, sleep
} = require('./shared');

const MANIFEST_URLS = [
  'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json',
  'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json',
  'https://launchermeta.mojang.com/mc/game/version_manifest.json'
];
const FABRIC_META = 'https://meta.fabricmc.net/v2';
const QUILT_META = 'https://meta.quiltmc.org/v3';
const FORGE_MAVEN = 'https://maven.minecraftforge.net/net/minecraftforge/forge';
const NEOFORGE_MAVEN = 'https://maven.neoforged.net/releases/net/neoforged/neoforge';
const AUTHLIB_INJECTOR_API = 'https://authserver.ely.by/api/authlib-injector';
const MODRINTH = 'https://api.modrinth.com/v2';
const CUSTOM_SKIN_LOADER_PROJECT = 'idMHQ4n2';

const defaultGameDir = () => Settings.getAll().gameFolder || path.join(app.getPath('home'), '.minecraft');
const isolatedRoot = () => path.join(defaultGameDir(), 'nexus-versions');
const versionsDir = (root) => path.join(root, 'versions');
function timeoutMs() { return Math.max(10000, Number(Settings.getAll().networkTimeout || 60) * 1000); }

function cacheDir() {
  try { return path.join(app.getPath('userData'), 'cache'); }
  catch { return path.join(defaultGameDir(), 'nexus-cache'); }
}

function cacheFile(name) {
  return path.join(cacheDir(), name);
}

async function readCachedJson(name) {
  try {
    return JSON.parse(await fsp.readFile(cacheFile(name), 'utf8'));
  } catch {
    return null;
  }
}

async function writeCachedJson(name, data) {
  try {
    await fsp.mkdir(cacheDir(), { recursive: true });
    await fsp.writeFile(cacheFile(name), JSON.stringify({ savedAt: new Date().toISOString(), data }, null, 2));
  } catch {}
}

function commonFallbackManifest() {
  const ids = [
    '1.21.8', '1.21.7', '1.21.6', '1.21.5', '1.21.4', '1.21.1', '1.20.6', '1.20.4', '1.20.1',
    '1.19.4', '1.19.2', '1.18.2', '1.17.1', '1.16.5', '1.15.2', '1.14.4', '1.13.2', '1.12.2',
    '1.11.2', '1.10.2', '1.9.4', '1.8.9', '1.7.10'
  ];
  return {
    latest: { release: ids[0], snapshot: ids[0] },
    versions: ids.map(id => ({
      id,
      type: 'release',
      url: '',
      time: '',
      releaseTime: ''
    }))
  };
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function axiosOptions(extra = {}) {
  return {
    timeout: timeoutMs(),
    httpsAgent: createHttpsAgent({ insecure: process.env.NEXUS_INSECURE_TLS === '1' }),
    headers: {
      'User-Agent': BROWSER_UA,
      'Accept': 'application/json, text/plain, */*',
      ...(extra.headers || {})
    },
    ...extra
  };
}

async function getJsonWithRetry(urls, cacheName = '', extra = {}) {
  const list = Array.isArray(urls) ? urls : [urls];
  let lastErr = null;

  for (const url of list.filter(Boolean)) {
    for (const family of [undefined, 4]) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const opts = axiosOptions({ ...extra, family });
          const { data } = await axios.get(url, opts);
          if (cacheName) await writeCachedJson(cacheName, data);
          return data;
        } catch (err) {
          lastErr = err;
          const status = err && err.response && err.response.status;
          if (status && status >= 400 && status < 500 && status !== 429) break;
          await sleep(350 * attempt);
        }
      }
    }
  }

  if (cacheName) {
    const cached = await readCachedJson(cacheName);
    if (cached && cached.data) return cached.data;
  }

  throw lastErr || new Error('Не удалось получить данные с сервера.');
}

async function getTextWithRetry(urls, cacheName = '') {
  const list = Array.isArray(urls) ? urls : [urls];
  let lastErr = null;
  for (const url of list.filter(Boolean)) {
    for (const family of [undefined, 4]) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { data } = await axios.get(url, axiosOptions({ family, responseType: 'text' }));
          if (cacheName) await writeCachedJson(cacheName, String(data));
          return String(data);
        } catch (err) {
          lastErr = err;
          const status = err && err.response && err.response.status;
          if (status && status >= 400 && status < 500 && status !== 429) break;
          await sleep(350 * attempt);
        }
      }
    }
  }
  if (cacheName) {
    const cachedValue = await readCachedJson(cacheName);
    if (cachedValue && typeof cachedValue.data === 'string') return cachedValue.data;
  }
  throw lastErr || new Error('Не удалось получить метаданные загрузчика.');
}

async function getManifest() {
  try {
    return await getJsonWithRetry(MANIFEST_URLS, 'version_manifest.json');
  } catch (err) {
    const cached = await readCachedJson('version_manifest.json');
    if (cached && cached.data) return cached.data;
    return commonFallbackManifest();
  }
}

async function getVersionMetaFromManifestEntry(entry) {
  if (!entry || !entry.url) throw new Error('Нет ссылки на JSON версии. Проверьте интернет и обновите список версий.');
  const cacheName = `version_${String(entry.id || 'unknown').replace(/[^a-z0-9_.-]/gi, '_')}.json`;
  return getJsonWithRetry([entry.url], cacheName);
}

function instanceDir(id) { return path.join(isolatedRoot(), sanitizeName(id)); }
function normalizeLoader(loader) {
  const v = String(loader || 'vanilla').toLowerCase();
  if (v === 'none') return 'vanilla';
  if (v === 'forgeoptifine' || v === 'forge_optifine' || v === 'forge-optifine') return 'forgeoptifine';
  if (v === 'fabriciris' || v === 'fabric_iris' || v === 'fabric-iris' || v === 'iris') return 'fabriciris';
  return v;
}

const KNOWN_OPTIFINE_MAP = {
  '1.7.10': { mcversion: '1.7.10', type: 'HD_U', patch: 'E7', filename: 'OptiFine_1.7.10_HD_U_E7.jar' },
  '1.8.9': { mcversion: '1.8.9', type: 'HD_U', patch: 'M5', filename: 'OptiFine_1.8.9_HD_U_M5.jar' },
  '1.12.2': { mcversion: '1.12.2', type: 'HD_U', patch: 'G5', filename: 'OptiFine_1.12.2_HD_U_G5.jar' },
  '1.16.5': { mcversion: '1.16.5', type: 'HD_U', patch: 'G8', filename: 'OptiFine_1.16.5_HD_U_G8.jar' },
  '1.18.2': { mcversion: '1.18.2', type: 'HD_U', patch: 'H7', filename: 'OptiFine_1.18.2_HD_U_H7.jar' },
  '1.19.2': { mcversion: '1.19.2', type: 'HD_U', patch: 'H9', filename: 'OptiFine_1.19.2_HD_U_H9.jar' },
  '1.20.1': { mcversion: '1.20.1', type: 'HD_U', patch: 'I6', filename: 'OptiFine_1.20.1_HD_U_I6.jar' },
  '1.20.2': { mcversion: '1.20.2', type: 'HD_U', patch: 'I7', filename: 'OptiFine_1.20.2_HD_U_I7.jar' },
  '1.20.4': { mcversion: '1.20.4', type: 'HD_U', patch: 'I7', filename: 'OptiFine_1.20.4_HD_U_I7.jar' }
};

async function getOptiFineList() {
  return cached('optifine:versionList', async () => {
    try {
      const data = await getJsonWithRetry('https://bmclapi2.bangbang93.com/optifine/versionList', 'optifine_version_list.json');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  });
}

async function findOptiFineForVersion(mcVersion) {
  if (KNOWN_OPTIFINE_MAP[mcVersion]) return KNOWN_OPTIFINE_MAP[mcVersion];

  // Scrape optifine.net/downloads for this version
  try {
    const res = await axios.get('https://optifine.net/downloads', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 8000
    });
    const escaped = mcVersion.replace(/\./g, '\\.');
    const rx = new RegExp(`adloadx\\?f=(OptiFine_${escaped}_([^'"]+)\\.jar)`, 'i');
    const m = String(res.data || '').match(rx);
    if (m) {
      return { mcversion: mcVersion, filename: m[1], type: 'HD_U', patch: m[2] };
    }
  } catch {}

  const list = await getOptiFineList();
  const matching = list.filter(x => x.mcversion === mcVersion);
  if (matching.length) {
    const release = matching.find(x => !String(x.filename || '').startsWith('preview_'));
    return release || matching[0];
  }
  return null;
}

async function downloadOptiFineMod(rootDir, mcVersion) {
  const optifine = await findOptiFineForVersion(mcVersion);
  if (!optifine) {
    console.warn(`[versions] OptiFine not found for Minecraft ${mcVersion}`);
    return null;
  }
  const modsDir = path.join(rootDir, 'mods');
  await fsp.mkdir(modsDir, { recursive: true });
  const fileName = optifine.filename || `OptiFine_${mcVersion}_${optifine.type}_${optifine.patch}.jar`;
  const destPath = path.join(modsDir, fileName);
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 50000) return fileName;

  emitInstallProgress(mcVersion, `OptiFine (${fileName})`, 0, 100, 'downloading');

  // 1. Direct download via optifine.net token scraping
  try {
    const adloadxUrl = `https://optifine.net/adloadx?f=${encodeURIComponent(fileName)}`;
    const page = await axios.get(adloadxUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000
    });
    const m = String(page.data || '').match(/href=['"](downloadx\?[^'"]+)['"]/i);
    if (m) {
      const directUrl = 'https://optifine.net/' + m[1];
      const partPath = `${destPath}.part`;
      const resp = await axios.get(directUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': adloadxUrl
        },
        responseType: 'arraybuffer',
        timeout: 45000
      });
      if (resp.data && resp.data.byteLength > 50000) {
        await fsp.writeFile(partPath, resp.data);
        await fsp.rename(partPath, destPath);
        emitInstallProgress(mcVersion, `OptiFine (${fileName})`, 100, 100, 'downloading');
        return fileName;
      }
    }
  } catch (err) {
    console.warn('[versions] Direct OptiFine download failed, trying mirrors:', err.message);
  }

  // 2. Fallback to mirrors
  const urls = [
    `https://bmclapi2.bangbang93.com/maven/com/optifine/${mcVersion}/${fileName}`,
    `https://bmclapi2.bangbang93.com/optifine/${mcVersion}/${optifine.type}/${optifine.patch}`,
    `https://files.prismsystems.dev/optifine/${fileName}`,
    `https://raw.githubusercontent.com/Suir/OptiFine-Archive/master/${mcVersion}/${fileName}`
  ];
  await Downloads.start({
    id: `optifine-${mcVersion}`,
    label: `OptiFine ${mcVersion}`,
    url: urls[0],
    urls,
    path: destPath,
    kind: 'mod'
  });
  return fileName;
}

async function downloadIrisAndSodiumMods(rootDir, mcVersion) {
  const modsDir = path.join(rootDir, 'mods');
  await fsp.mkdir(modsDir, { recursive: true });

  const getModRelease = async (projectId) => {
    try {
      const url = `https://api.modrinth.com/v2/project/${projectId}/version?game_versions=${encodeURIComponent(JSON.stringify([mcVersion]))}&loaders=${encodeURIComponent(JSON.stringify(['fabric']))}`;
      const data = await getJsonWithRetry(url, `${projectId}_${mcVersion}.json`);
      if (Array.isArray(data) && data.length) {
        const file = data[0].files.find(f => f.primary) || data[0].files[0];
        return file ? { url: file.url, filename: file.filename } : null;
      }
    } catch (e) {
      console.warn(`[versions] Could not fetch ${projectId} from Modrinth:`, e.message);
    }
    return null;
  };

  const iris = await getModRelease('iris');
  const sodium = await getModRelease('sodium');

  if (iris) {
    const dest = path.join(modsDir, iris.filename);
    if (!fs.existsSync(dest)) {
      await Downloads.start({
        id: `iris-${mcVersion}`,
        label: `Iris Shaders (${mcVersion})`,
        url: iris.url,
        path: dest,
        kind: 'mod'
      });
    }
  }

  if (sodium) {
    const dest = path.join(modsDir, sodium.filename);
    if (!fs.existsSync(dest)) {
      await Downloads.start({
        id: `sodium-${mcVersion}`,
        label: `Sodium (${mcVersion})`,
        url: sodium.url,
        path: dest,
        kind: 'mod'
      });
    }
  }
}

const loaderAvailabilityCache = new Map();
const loaderVersionsCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

async function cached(key, factory, ttl = CACHE_TTL) {
  const hit = loaderVersionsCache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const value = await factory();
  loaderVersionsCache.set(key, { at: Date.now(), value });
  return value;
}

function minecraftFromNeoForgeVersion(neoVersion) {
  // Modern NeoForge artifact versions encode the Minecraft line: 21.1.x -> 1.21.1, 20.6.x -> 1.20.6.
  const m = String(neoVersion || '').match(/^(\d+)\.(\d+)(?:\.|$)/);
  if (!m) return null;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || major < 20) return null;
  return `1.${major}.${minor}`;
}

function groupLatestByMinecraft(items) {
  const map = {};
  for (const item of items) {
    if (!item || !item.mcVersion || !item.version) continue;
    const old = map[item.mcVersion];
    if (!old || compareVersionLike(old.version, item.version) < 0) map[item.mcVersion] = item;
  }
  return map;
}

function sortLoaderVersions(items) {
  return [...(items || [])].sort((a, b) =>
    Number(Boolean(b && b.stable)) - Number(Boolean(a && a.stable)) ||
    compareVersionLike(b && b.version, a && a.version)
  );
}

function normalizeRepositoryBase(url) {
  if (!url) return null;
  let base = String(url).trim();
  if (!base) return null;
  // Old Forge profiles often point to files.minecraftforge.net/maven. The CDN is
  // now served reliably through maven.minecraftforge.net, so normalize it before
  // queueing downloads. This also avoids http -> https mixed failures.
  if (/files\.minecraftforge\.net\/maven/i.test(base) || /maven\.minecraftforge\.net/i.test(base)) {
    return 'https://maven.minecraftforge.net/';
  }
  return base.replace(/^http:\/\//i, 'https://').replace(/\/?$/, '/');
}

function uniqueUrls(urls) {
  return Array.from(new Set((urls || []).filter(Boolean).map(u => String(u))));
}

function artifactUrls(lib, rel, parsed) {
  const urls = [];
  const base = normalizeRepositoryBase(lib.url);
  if (base) urls.push(base + rel);

  // Reasonable repository fallbacks for loader libraries. They are only tried if
  // the primary URL fails, and the downloader still validates size/SHA-1 when a
  // checksum is available.
  if (parsed && parsed.group === 'net.minecraftforge') urls.push(`https://maven.minecraftforge.net/${rel}`);
  if (parsed && parsed.group === 'net.neoforged') urls.push(`https://maven.neoforged.net/releases/${rel}`);
  if (parsed && parsed.group.startsWith('net.fabricmc')) urls.push(`https://maven.fabricmc.net/${rel}`);
  if (parsed && parsed.group.startsWith('org.quiltmc')) urls.push(`https://maven.quiltmc.org/repository/release/${rel}`);
  // Minecraft libraries mirror. Old Forge 1.7.10/1.8 profiles contain
  // dependencies that disappeared from Maven Central but are still hosted by Mojang.
  if (parsed && (parsed.group.startsWith('net.minecraft') || parsed.group.startsWith('com.mojang') || parsed.group.startsWith('org.lwjgl') || parsed.group.startsWith('net.java') || parsed.group.startsWith('org.lwjgl.lwjgl'))) {
    urls.push(`https://libraries.minecraft.net/${rel}`);
  }
  // Legacy Forge repositories. Required for old jinput/lwjgl/scala artifacts.
  if (parsed && (parsed.group.startsWith('net.java') || parsed.group.startsWith('org.lwjgl') || parsed.group.startsWith('org.scala-lang'))) {
    urls.push(`https://libraries.minecraft.net/${rel}`);
    urls.push(`https://maven.minecraftforge.net/${rel}`);
  }
  // Many legacy Forge dependencies (Scala, ASM, Guava, Apache commons, etc.)
  // are normal Maven Central artifacts. Keep it as the final fallback.
  if (parsed) urls.push(`https://repo1.maven.org/maven2/${rel}`);
  return uniqueUrls(urls);
}

function libraryArtifact(lib) {
  if (lib.downloads && lib.downloads.artifact && lib.downloads.artifact.url) {
    const url = String(lib.downloads.artifact.url).replace(/^http:\/\//i, 'https://');
    const rel = lib.downloads.artifact.path;
    return {
      url,
      urls: uniqueUrls([url, ...artifactUrls(lib, rel, parseMavenCoordinate(lib.name) || {})]),
      rel,
      size: lib.downloads.artifact.size,
      sha1: lib.downloads.artifact.sha1
    };
  }

  // Old Minecraft/Forge profiles describe native-only platform artifacts as
  // org.lwjgl.lwjgl:lwjgl-platform:2.9.1 and net.java.jinput:jinput-platform:2.0.5.
  // There is no non-classified lwjgl-platform-2.9.1.jar / jinput-platform-2.0.5.jar,
  // so trying to download the base artifact always ends with HTTP 404.
  if (lib.natives && lib.natives[osName()]) return null;

  const parsed = parseMavenCoordinate(lib.name);
  if (!parsed) return null;
  const urls = artifactUrls(lib, parsed.rel, parsed);
  if (!urls.length) return null;
  return { url: urls[0], urls, rel: parsed.rel, size: lib.size, sha1: lib.sha1, parsed };
}

function nativeArtifact(lib) {
  if (!lib || !lib.natives || !lib.natives[osName()]) return null;
  const classifierKey = String(lib.natives[osName()]).replace('${arch}', process.arch.includes('64') ? '64' : '32');

  if (lib.downloads && lib.downloads.classifiers && lib.downloads.classifiers[classifierKey]) {
    const classifier = lib.downloads.classifiers[classifierKey];
    const rel = classifier.path;
    return {
      url: String(classifier.url || '').replace(/^http:\/\//i, 'https://'),
      urls: uniqueUrls([classifier.url, ...artifactUrls(lib, rel, parseMavenCoordinate(lib.name) || {})]),
      rel,
      size: classifier.size,
      sha1: classifier.sha1
    };
  }

  const parsed = parseMavenCoordinate(`${lib.name}:${classifierKey}`);
  if (!parsed) return null;
  const urls = artifactUrls(lib, parsed.rel, parsed);
  if (!urls.length) return null;
  return { url: urls[0], urls, rel: parsed.rel, size: lib.size, sha1: lib.sha1, parsed };
}

async function list(filters = {}) {
  const data = await getManifest();
  let versions = data.versions || [];
  if (filters.type && filters.type !== 'all') versions = versions.filter(v => v.type === filters.type);
  if (filters.query) {
    const q = filters.query.toLowerCase();
    versions = versions.filter(v => v.id.toLowerCase().includes(q));
  }
  return {
    latest: data.latest,
    versions,
    counts: {
      release: data.versions.filter(v => v.type === 'release').length,
      snapshot: data.versions.filter(v => v.type === 'snapshot').length,
      old_beta: data.versions.filter(v => v.type === 'old_beta').length,
      old_alpha: data.versions.filter(v => v.type === 'old_alpha').length
    }
  };
}

async function writeInstallMeta(rootDir, meta) {
  await fsp.mkdir(rootDir, { recursive: true });
  const payload = { ...meta, rootDir, path: rootDir, installedAt: meta.installedAt || new Date().toISOString() };
  await fsp.writeFile(path.join(rootDir, 'nexus-install.json'), JSON.stringify(payload, null, 2));
  return payload;
}

async function scanVersionJsons(rootDir, fallback = {}) {
  const dir = versionsDir(rootDir);
  if (!fs.existsSync(dir)) return [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const json = path.join(dir, e.name, `${e.name}.json`);
    if (!fs.existsSync(json)) continue;
    try {
      const meta = JSON.parse(await fsp.readFile(json, 'utf8'));
      out.push({
        id: e.name,
        profileId: e.name,
        title: fallback.title || `Minecraft ${meta.inheritsFrom || meta.id || e.name}`,
        displayName: fallback.displayName || fallback.title || meta.name || e.name,
        minecraft: meta.inheritsFrom || meta.id || e.name,
        type: meta.type || fallback.type || 'release',
        loader: fallback.loader || detectLoader(e.name, meta),
        loaderVersion: fallback.loaderVersion,
        mainClass: meta.mainClass,
        assets: meta.assets,
        releaseTime: meta.releaseTime,
        path: rootDir,
        rootDir,
        kind: fallback.kind || 'version'
      });
    } catch { out.push({ id: e.name, type: 'unknown', path: rootDir, rootDir, kind: fallback.kind || 'version' }); }
  }
  return out;
}

function detectLoader(id, meta = {}) {
  const x = `${id} ${meta.mainClass || ''}`.toLowerCase();
  if (x.includes('forgeoptifine') || (x.includes('forge') && x.includes('optifine'))) return 'forgeoptifine';
  if (x.includes('fabriciris') || (x.includes('fabric') && x.includes('iris'))) return 'fabriciris';
  if (x.includes('neoforge')) return 'neoforge';
  if (x.includes('forge')) return 'forge';
  if (x.includes('quilt')) return 'quilt';
  if (x.includes('fabric')) return 'fabric';
  return 'vanilla';
}

async function getInstalled(root) {
  // When a concrete root is passed, behave like the old low-level scanner.
  if (root) return scanVersionJsons(root);

  const out = [];
  const iso = isolatedRoot();
  if (fs.existsSync(iso)) {
    const dirs = await fsp.readdir(iso, { withFileTypes: true });
    for (const e of dirs.filter(x => x.isDirectory())) {
      const rootDir = path.join(iso, e.name);
      let meta = {};
      try { meta = JSON.parse(await fsp.readFile(path.join(rootDir, 'nexus-install.json'), 'utf8')); } catch {}
      const scanned = await scanVersionJsons(rootDir, meta);
      const primaryId = meta.id || meta.versionId || (scanned[0] && scanned[0].id) || e.name;
      const primary = scanned.find(x => x.id === primaryId) || scanned[0] || { id: primaryId };
      out.push({ ...primary, ...meta, id: primaryId, profileId: primaryId, path: rootDir, rootDir, kind: meta.kind || 'version' });
    }
  }

  // Legacy shared .minecraft/versions entries are still shown so older installs are not lost.
  const legacyDir = versionsDir(defaultGameDir());
  if (fs.existsSync(legacyDir)) {
    const legacy = await scanVersionJsons(defaultGameDir(), { kind: 'legacy' });
    for (const item of legacy) {
      if (!out.some(x => x.id === item.id)) out.push({ ...item, legacy: true });
    }
  }

  // Include locally installed modpacks in the same installed list.
  const mpDir = Settings.getAll().modpacksFolder || path.join(defaultGameDir(), 'modpacks');
  if (fs.existsSync(mpDir)) {
    const dirs = await fsp.readdir(mpDir, { withFileTypes: true });
    for (const e of dirs.filter(x => x.isDirectory())) {
      const rootDir = path.join(mpDir, e.name);
      try {
        const meta = JSON.parse(await fsp.readFile(path.join(rootDir, 'nexus-modpack.json'), 'utf8'));
        out.push({
          id: meta.versionId || meta.minecraft || e.name,
          profileId: meta.versionId || meta.minecraft || e.name,
          displayName: meta.name || e.name,
          type: 'modpack',
          kind: 'modpack',
          loader: meta.loader || 'vanilla',
          loaderVersion: meta.loaderVersion,
          minecraft: meta.minecraft,
          path: rootDir,
          rootDir,
          modpack: true,
          source: meta.source,
          installedAt: meta.installedAt,
          warnings: meta.warnings || []
        });
      } catch {}
    }
  }

  return out.sort((a, b) => String(b.installedAt || b.releaseTime || '').localeCompare(String(a.installedAt || a.releaseTime || '')));
}

function formatInstanceDirName(minecraftVersion, loader) {
  const norm = normalizeLoader(loader);
  if (!norm || norm === 'vanilla') return `${minecraftVersion}-Vanilla`;
  const map = {
    forgeoptifine: `${minecraftVersion}-Forge-OptiFine`,
    fabriciris: `${minecraftVersion}-Fabric-Iris`,
    forge: `${minecraftVersion}-Forge`,
    fabric: `${minecraftVersion}-Fabric`,
    quilt: `${minecraftVersion}-Quilt`,
    neoforge: `${minecraftVersion}-NeoForge`
  };
  return map[norm] || `${minecraftVersion}-${norm}`;
}

async function install(versionId, opts = {}) {
  const loader = normalizeLoader(opts.loader);
  if (loader && loader !== 'vanilla') return installLoader(versionId, opts);
  const dirName = sanitizeName(opts.customDirName || opts.folderName || opts.profileId || formatInstanceDirName(versionId, 'vanilla'));
  const rootDir = opts.gameDir || instanceDir(dirName);
  const result = await installVanilla(versionId, { ...opts, gameDir: rootDir });
  if (!opts.skipInstallMeta) {
    await writeInstallMeta(rootDir, {
      id: versionId,
      versionId,
      minecraft: versionId,
      loader: 'vanilla',
      loaderVersion: null,
      type: 'release',
      kind: 'version',
      title: `Minecraft ${versionId}`
    });
  }
  return { ...result, rootDir, path: rootDir, id: versionId, profileId: versionId, loader: 'vanilla' };
}

const cancelledInstalls = new Set();

function emitInstallProgress(versionId, currentFile, completed, total, stage = 'downloading') {
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send('versions:progress', {
        versionId,
        currentFile: currentFile ? path.basename(currentFile) : '',
        completed,
        total,
        percent,
        stage
      });
    } catch {}
  }
}

async function cancelInstall(versionId) {
  if (versionId) {
    const strId = String(versionId);
    cancelledInstalls.add(strId);
    await Downloads.cancelGroup((item, id) => {
      return (item && (item.versionId === strId || (item.id && item.id.includes(strId)))) || (id && id.includes(strId));
    });
    emitInstallProgress(strId, 'Установка отменена', 0, 0, 'cancelled');
  } else {
    await Downloads.cancelAll();
    emitInstallProgress('all', 'Установка отменена', 0, 0, 'cancelled');
  }
  return { ok: true };
}

async function installVanilla(versionId, opts = {}) {
  const strVersionId = String(versionId);
  cancelledInstalls.delete(strVersionId);
  const rootDir = opts.gameDir || instanceDir(versionId);
  emitInstallProgress(strVersionId, 'Получение манифеста...', 0, 1, 'manifest');
  const data = await getManifest();
  const v = (data.versions || []).find(x => x.id === versionId);
  if (!v) {
    const localJson = path.join(versionsDir(rootDir), versionId, `${versionId}.json`);
    if (fs.existsSync(localJson)) {
      const localMeta = JSON.parse(await fsp.readFile(localJson, 'utf8'));
      if (localMeta.inheritsFrom) return installVanilla(localMeta.inheritsFrom, opts);
    }
    throw new Error('Version not found: ' + versionId);
  }

  const vmeta = await getVersionMetaFromManifestEntry(v);
  const targetDir = path.join(versionsDir(rootDir), versionId);
  await fsp.mkdir(targetDir, { recursive: true });
  await fsp.writeFile(path.join(targetDir, `${versionId}.json`), JSON.stringify(vmeta, null, 2));
  await ensureDefaultOptions(rootDir);

  const dl = [];
  const nativesDir = path.join(targetDir, 'natives');
  const nativeJars = [];

  if (vmeta.downloads && vmeta.downloads.client) {
    dl.push({
      id: `${sanitizeName(rootDir)}-client-${versionId}`,
      label: `Minecraft ${versionId}`,
      url: vmeta.downloads.client.url,
      path: path.join(targetDir, `${versionId}.jar`),
      size: vmeta.downloads.client.size,
      sha1: vmeta.downloads.client.sha1,
      kind: 'client',
      internal: true,
      versionId: strVersionId
    });
  }

  for (const lib of vmeta.libraries || []) {
    if (!isAllowed(lib.rules)) continue;
    const artifact = libraryArtifact(lib);
    if (artifact) {
      dl.push({
        id: `${sanitizeName(rootDir)}-lib-${lib.name}`,
        label: lib.name,
        url: artifact.url,
        urls: artifact.urls,
        path: path.join(rootDir, 'libraries', artifact.rel),
        size: artifact.size,
        sha1: artifact.sha1,
        kind: 'library',
        internal: true,
        versionId: strVersionId
      });
    }
    const native = nativeArtifact(lib);
    if (native) {
      const jarPath = path.join(rootDir, 'libraries', native.rel);
      dl.push({
        id: `${sanitizeName(rootDir)}-native-${lib.name}`,
        label: `${lib.name} natives`,
        url: native.url,
        urls: native.urls,
        path: jarPath,
        size: native.size,
        sha1: native.sha1,
        kind: 'library',
        internal: true,
        versionId: strVersionId
      });
      nativeJars.push({ path: jarPath, exclude: (lib.extract && lib.extract.exclude) || ['META-INF/'] });
    }
  }

  if (vmeta.assetIndex) {
    const indexPath = path.join(rootDir, 'assets', 'indexes', `${vmeta.assetIndex.id}.json`);
    await Downloads.start({
      id: `${sanitizeName(rootDir)}-asset-index-${vmeta.assetIndex.id}`,
      label: `Индекс ресурсов ${vmeta.assetIndex.id}`,
      url: vmeta.assetIndex.url,
      path: indexPath,
      size: vmeta.assetIndex.size,
      sha1: vmeta.assetIndex.sha1,
      kind: 'asset-index',
      internal: true,
      versionId: strVersionId
    });
    let aidx;
    try {
      aidx = JSON.parse(await fsp.readFile(indexPath, 'utf8'));
    } catch (error) {
      throw new Error(`Повреждён индекс ресурсов ${vmeta.assetIndex.id}: ${error.message}`);
    }
    for (const obj of Object.values(aidx.objects || {})) {
      const hash = obj.hash;
      const sub = hash.slice(0, 2);
      dl.push({
        id: `${sanitizeName(rootDir)}-asset-${hash}`,
        label: `Ресурс ${sub}/${hash.slice(0, 8)}`,
        url: `https://resources.download.minecraft.net/${sub}/${hash}`,
        path: path.join(rootDir, 'assets', 'objects', sub, hash),
        size: obj.size,
        sha1: hash,
        kind: 'asset',
        internal: true,
        versionId: strVersionId
      });
    }
  }

  const uniqueDownloads = Array.from(new Map(dl.map(item => [item.path, item])).values());
  const total = uniqueDownloads.length;
  let completed = 0;
  let lastEmit = 0;
  const reportProgress = (currentFileName, force = false) => {
    const now = Date.now();
    if (force || now - lastEmit > 100 || completed === total) {
      lastEmit = now;
      emitInstallProgress(strVersionId, currentFileName, completed, total, 'downloading');
    }
  };

  reportProgress('Подготовка к загрузке...', true);

  try {
    await Promise.all(uniqueDownloads.map(async item => {
      if (cancelledInstalls.has(strVersionId)) {
        throw new Error(`Установка ${versionId} отменена`);
      }
      item.internal = true;
      item.versionId = strVersionId;
      reportProgress(item.label || item.path);
      await Downloads.start(item);
      completed++;
      reportProgress(item.label || item.path);
    }));
  } catch (err) {
    if (cancelledInstalls.has(strVersionId)) {
      emitInstallProgress(strVersionId, 'Установка отменена', 0, 0, 'cancelled');
      throw new Error(`Установка ${versionId} отменена`);
    }
    throw err;
  }

  if (nativeJars.length) {
    emitInstallProgress(strVersionId, 'Распаковка natives...', total, total, 'extracting');
    // Recreate this derived directory so deleted/renamed native libraries do not
    // leave stale binaries that can make LWJGL load an incompatible DLL/SO.
    await fsp.rm(nativesDir, { recursive: true, force: true });
    await fsp.mkdir(nativesDir, { recursive: true });
    for (const { path: jarPath, exclude } of nativeJars) {
      try {
        const buf = await fsp.readFile(jarPath);
        const zip = await JSZip.loadAsync(buf);
        for (const [entryName, entry] of Object.entries(zip.files)) {
          if (entry.dir || exclude.some(ex => entryName.startsWith(ex))) continue;
          const outPath = path.resolve(nativesDir, entryName);
          const nativeRoot = path.resolve(nativesDir) + path.sep;
          if (!outPath.startsWith(nativeRoot)) throw new Error(`Небезопасный путь в архиве natives: ${entryName}`);
          await fsp.mkdir(path.dirname(outPath), { recursive: true });
          await fsp.writeFile(outPath, await entry.async('nodebuffer'));
        }
      } catch (e) {
        throw new Error(`Не удалось распаковать natives из ${path.basename(jarPath)}: ${e.message}`);
      }
    }
  }

  emitInstallProgress(strVersionId, 'Готово!', total, total, 'done');
  return { ok: true, queued: uniqueDownloads.length, versionId, rootDir };
}

async function downloadProfileLibraries(profile, rootDir, prefix) {
  const downloads = [];
  for (const lib of profile.libraries || []) {
    if (!isAllowed(lib.rules)) continue;
    const artifact = libraryArtifact(lib);
    if (!artifact || !artifact.rel) continue;
    const dest = path.join(rootDir, 'libraries', artifact.rel);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) continue;
    downloads.push({
      id: `${sanitizeName(rootDir)}-${prefix}-${lib.name}`,
      label: lib.name,
      url: artifact.url,
      urls: artifact.urls,
      path: dest,
      size: artifact.size,
      sha1: artifact.sha1,
      kind: 'library',
      internal: true
    });
  }
  await Promise.all(downloads.map(async (d) => {
    try {
      await Downloads.start(d);
    } catch (e) {
      console.warn(`[versions] Библиотека пропущена: ${d.label} (${e.message})`);
    }
  }));
}

async function installFabricProfile(rootDir, minecraftVersion, loaderVersion) {
  if (!loaderVersion) {
    const loaders = await getFabricLoaders(minecraftVersion);
    loaderVersion = loaders[0] && loaders[0].version;
  }
  if (!loaderVersion) throw new Error('Fabric не найден для Minecraft ' + minecraftVersion);
  const url = `${FABRIC_META}/versions/loader/${encodeURIComponent(minecraftVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`;
  const profile = await getJsonWithRetry(url, `fabric_profile_${minecraftVersion}_${loaderVersion}.json`);
  profile.id = profile.id || `fabric-loader-${loaderVersion}-${minecraftVersion}`;
  profile.inheritsFrom = profile.inheritsFrom || minecraftVersion;
  profile.jar = profile.jar || minecraftVersion;
  profile.type = profile.type || 'release';
  const dir = path.join(rootDir, 'versions', profile.id);
  await fsp.mkdir(dir, { recursive: true });
  await downloadProfileLibraries(profile, rootDir, 'fabric-lib');
  await fsp.writeFile(path.join(dir, `${profile.id}.json`), JSON.stringify(profile, null, 2));
  return { id: profile.id, loaderVersion };
}

async function installQuiltProfile(rootDir, minecraftVersion, loaderVersion) {
  if (!loaderVersion) {
    const loaders = await getQuiltLoaders(minecraftVersion);
    loaderVersion = loaders[0] && loaders[0].version;
  }
  if (!loaderVersion) throw new Error('Quilt не найден для Minecraft ' + minecraftVersion);
  const url = `${QUILT_META}/versions/loader/${encodeURIComponent(minecraftVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`;
  const profile = await getJsonWithRetry(url, `quilt_profile_${minecraftVersion}_${loaderVersion}.json`);
  profile.id = profile.id || `quilt-loader-${loaderVersion}-${minecraftVersion}`;
  profile.inheritsFrom = profile.inheritsFrom || minecraftVersion;
  profile.jar = profile.jar || minecraftVersion;
  profile.type = profile.type || 'release';
  const dir = path.join(rootDir, 'versions', profile.id);
  await fsp.mkdir(dir, { recursive: true });
  await downloadProfileLibraries(profile, rootDir, 'quilt-lib');
  await fsp.writeFile(path.join(dir, `${profile.id}.json`), JSON.stringify(profile, null, 2));
  return { id: profile.id, loaderVersion };
}

async function getFabricLoaders(mcVersion) {
  return cached(`fabric-loaders:${mcVersion}`, async () => {
    const data = await getJsonWithRetry(
      `${FABRIC_META}/versions/loader/${encodeURIComponent(mcVersion)}`,
      `fabric_loaders_${mcVersion}.json`
    );
    const items = Array.isArray(data) ? data
      .filter(x => x && x.loader && x.loader.version)
      .map(x => ({
        loader: 'fabric', version: x.loader.version,
        stable: typeof x.loader.stable === 'boolean' ? x.loader.stable : !/-/.test(x.loader.version), mcVersion
      })) : [];
    return sortLoaderVersions(items);
  });
}
async function getQuiltLoaders(mcVersion) {
  return cached(`quilt-loaders:${mcVersion}`, async () => {
    const data = await getJsonWithRetry(
      `${QUILT_META}/versions/loader/${encodeURIComponent(mcVersion)}`,
      `quilt_loaders_${mcVersion}.json`
    );
    const items = Array.isArray(data) ? data
      .filter(x => x && x.loader && x.loader.version)
      .map(x => ({
        loader: 'quilt', version: x.loader.version,
        stable: typeof x.loader.stable === 'boolean' ? x.loader.stable : !/-/.test(x.loader.version), mcVersion
      }))
      // Quilt Meta does not guarantee response order. It currently starts with
      // old 0.20 beta builds, so selecting [0] installed an obsolete loader.
      : [];
    return sortLoaderVersions(items);
  });
}

async function fetchMavenVersions(baseUrl) {
  const cacheName = `maven_${Buffer.from(baseUrl).toString('hex').slice(-48)}.json`;
  const data = await getTextWithRetry(`${baseUrl}/maven-metadata.xml`, cacheName);
  return Array.from(String(data).matchAll(/<version>([^<]+)<\/version>/g)).map(m => m[1]);
}

function forgeMinecraftVersion(fullForgeVersion) {
  const m = String(fullForgeVersion || '').match(/^(\d+\.\d+(?:\.\d+)?)-/);
  return m ? m[1] : null;
}

function buildForgeMap(list) {
  return groupLatestByMinecraft((list || []).map(version => ({
    loader: 'forge',
    version,
    mcVersion: forgeMinecraftVersion(version),
    label: 'Forge'
  })).filter(x => x.mcVersion));
}

function buildNeoForgeMap(list) {
  return groupLatestByMinecraft((list || []).map(version => ({
    loader: 'neoforge',
    version,
    mcVersion: minecraftFromNeoForgeVersion(version),
    label: 'NeoForge'
  })).filter(x => x.mcVersion));
}

function pickForgeVersion(list, mcVersion) {
  const item = buildForgeMap(list)[mcVersion];
  return item ? item.version : null;
}
function pickNeoForgeVersion(list, mcVersion) {
  const item = buildNeoForgeMap(list)[mcVersion];
  return item ? item.version : null;
}


function recommendedInstallerJava(mcVersion) {
  const match = String(mcVersion || '').match(/^1\.(\d+)(?:\.(\d+))?/);
  const minor = match ? Number(match[1]) : 999;
  const patch = match ? Number(match[2] || 0) : 0;
  if (minor <= 16) return 8;
  if (minor === 17) return 16;
  if (minor > 20 || (minor === 20 && patch >= 5)) return 21;
  return 17;
}

async function ensureLauncherProfiles(gameDir) {
  const file = path.join(gameDir, 'launcher_profiles.json');
  if (fs.existsSync(file)) return;
  await fsp.writeFile(file, JSON.stringify({
    profiles: {},
    selectedProfile: '',
    clientToken: 'nexus-' + Date.now(),
    authenticationDatabase: {},
    launcherVersion: { name: 'Nexus Launcher', format: 21 }
  }, null, 2));
}

async function installerJavaCandidates(mcVersion) {
  const Java = require('./java');
  const settings = Settings.getAll();
  const target = recommendedInstallerJava(mcVersion);
  try {
    await Java.ensureVersion(target, { exact: target === 8, preferredPath: settings.java && settings.java.path });
  } catch (error) {
    console.warn('[versions] preferred installer Java is unavailable:', error.message);
  }
  const list = await Java.listInstalled();
  const score = (j) => {
    const v = Number(j.version) || 0;
    if (target === 8) {
      if (v === 8) return 100;
      if (v === 11) return 60;
      if (v >= 17) return 20;
      return 10;
    }
    if (v === target) return 100;
    if (v >= target) return 90 - Math.min(40, v - target);
    return 10 + v;
  };
  const candidates = [...list].sort((a, b) => score(b) - score(a));
  if (settings.java && settings.java.path && !candidates.some(j => j.path === settings.java.path)) {
    candidates.push({ path: settings.java.path, version: null, source: 'settings', label: 'Java из настроек' });
  }
  if (!candidates.length) throw new Error('Java не найдена. Укажите Java в настройках. Для старых Forge-сборок желательно Java 8.');
  return candidates;
}

function installerArgSets(gameDir) {
  // Never omit gameDir: recent NeoForge installers ignore cwd and silently use
  // the user's shared .minecraft folder when no path is supplied. Nexus would
  // then report success but be unable to find or launch the installed profile.
  return [
    ['--installClient', gameDir],
    ['--install-client', gameDir]
  ];
}

async function runInstallerJar(javaPath, installerPath, gameDir, installerArgs) {
  await ensureLauncherProfiles(gameDir);
  await new Promise((resolve, reject) => {
    const args = [
      '-Djava.net.preferIPv4Stack=true',
      '-Dsun.net.client.defaultConnectTimeout=60000',
      '-Dsun.net.client.defaultReadTimeout=300000',
      '-jar', installerPath,
      ...(installerArgs || ['--installClient', gameDir])
    ];
    const child = spawn(javaPath, args, {
      cwd: gameDir,
      env: { ...process.env, NEXUS_INSTALL_DIR: gameDir },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let settled = false;
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch {}
      reject(new Error(`Installer timeout (${path.basename(javaPath)} ${installerArgs.join(' ')}): установщик не ответил за 10 минут`));
    }, 10 * 60 * 1000);
    child.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > 9000) stdout = stdout.slice(-9000); });
    child.stderr.on('data', d => { stderr += d.toString(); if (stderr.length > 9000) stderr = stderr.slice(-9000); });
    child.on('exit', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) return resolve();
      const log = `${stdout}\n${stderr}`.trim().slice(-2200);
      reject(new Error(`Installer exited with ${code} (${path.basename(javaPath)} ${installerArgs.join(' ')}): ${log || 'нет вывода от установщика'}`));
    });
    child.on('error', err => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function runInstallerWithJavaFallback(installerPath, gameDir, minecraftVersion) {
  const candidates = await installerJavaCandidates(minecraftVersion);
  const argSets = installerArgSets(gameDir);
  let lastError = null;
  for (const java of candidates) {
    for (const args of argSets) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await runInstallerJar(java.path, installerPath, gameDir, args);
          return { javaPath: java.path, javaVersion: java.version || null, args };
        } catch (err) {
          lastError = err;
          console.warn('[versions] installer failed with', java.path, args.join(' '), `attempt ${attempt}/3`, err.message);
          const msg = String(err.message || '');
          if (/UnrecognizedOptionException|not a recognized option|Unknown option|Invalid option/i.test(msg)) break;
          const transient = /timed out|timeout|checksum|download|connection|socket|handshake|HTTP|manifest/i.test(msg);
          if (!transient || attempt >= 3) break;
          await sleep(1000 * attempt);
        }
      }
    }
  }
  throw lastError || new Error('Установщик загрузчика не запустился.');
}

async function extractBundledMavenArtifacts(zip, rootDir, profile) {
  const extracted = [];
  for (const lib of profile.libraries || []) {
    if (!isAllowed(lib.rules)) continue;
    const artifact = libraryArtifact(lib);
    if (!artifact || !artifact.rel) continue;
    const candidates = [
      `maven/${artifact.rel}`,
      artifact.rel,
      `libraries/${artifact.rel}`
    ];

    // Legacy Forge (notably 1.7.10) declares net.minecraftforge:forge without
    // a classifier, while its installer bundles the same runtime artifact as
    // forge-<version>-universal.jar. The old official installer copied that
    // file to the classifier-less library path. Reproduce that behaviour before
    // attempting Maven, where the classifier-less URL correctly returns 404.
    if (artifact.parsed && artifact.parsed.group === 'net.minecraftforge' &&
        artifact.parsed.artifact === 'forge' && !artifact.parsed.classifier) {
      const universalName = `${artifact.parsed.artifact}-${artifact.parsed.version}-universal.${artifact.parsed.extension}`;
      const universalRel = path.posix.join(
        ...artifact.parsed.group.split('.'),
        artifact.parsed.artifact,
        artifact.parsed.version,
        universalName
      );
      candidates.unshift(
        `maven/${universalRel}`,
        universalRel,
        `libraries/${universalRel}`,
        universalName
      );
    }

    let entryName = candidates.find(name => zip.file(name));
    if (!entryName && artifact.parsed && artifact.parsed.group === 'net.minecraftforge' &&
        artifact.parsed.artifact === 'forge' && !artifact.parsed.classifier) {
      const suffix = `forge-${artifact.parsed.version}-universal.${artifact.parsed.extension}`;
      entryName = Object.keys(zip.files).find(name => !zip.files[name].dir && name.endsWith(suffix));
    }
    if (!entryName) continue;
    const outPath = path.join(rootDir, 'libraries', artifact.rel);
    await fsp.mkdir(path.dirname(outPath), { recursive: true });
    await fsp.writeFile(outPath, await zip.file(entryName).async('nodebuffer'));
    extracted.push(artifact.rel);
  }
  return extracted;
}

async function extractLegacyForgeInstallFile(zip, rootDir, installProfile, profile) {
  const install = installProfile && installProfile.install;
  if (!install || !install.filePath) return null;

  const declared = String(install.filePath).replace(/^\/+/, '');
  const basename = path.posix.basename(declared);
  const entryName = [declared, basename, `maven/${declared}`, `libraries/${declared}`]
    .find(name => zip.file(name)) ||
    Object.keys(zip.files).find(name => !zip.files[name].dir && path.posix.basename(name) === basename);
  if (!entryName) return null;

  const forgeLib = (profile.libraries || []).find(lib => {
    const parsed = parseMavenCoordinate(lib.name);
    return parsed && parsed.group === 'net.minecraftforge' && parsed.artifact === 'forge';
  });
  const runtimeArtifact = forgeLib && libraryArtifact(forgeLib);
  if (!runtimeArtifact || !runtimeArtifact.rel) return null;

  // SimpleInstaller's legacy behaviour: copy install.filePath (usually the
  // root-level *-universal.jar) to the classifier-less runtime coordinate from
  // versionInfo. This prevents the invalid Maven request seen on Forge 1.7.10.
  const outPath = path.join(rootDir, 'libraries', runtimeArtifact.rel);
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  await fsp.writeFile(outPath, await zip.file(entryName).async('nodebuffer'));
  return runtimeArtifact.rel;
}

async function installForgeProfileDirect(rootDir, minecraftVersion, installerPath, fullVersion) {
  const buf = await fsp.readFile(installerPath);
  const zip = await JSZip.loadAsync(buf);
  let profile = null;
  let installProfile = null;

  if (zip.file('install_profile.json')) {
    installProfile = JSON.parse(await zip.file('install_profile.json').async('string'));
    if (installProfile.versionInfo) profile = installProfile.versionInfo;
    if (!profile && installProfile.json) {
      const jsonPath = String(installProfile.json).replace(/^\/?/, '');
      if (zip.file(jsonPath)) profile = JSON.parse(await zip.file(jsonPath).async('string'));
    }
  }
  if (!profile && zip.file('version.json')) {
    profile = JSON.parse(await zip.file('version.json').async('string'));
  }
  if (!profile) throw new Error('Не удалось прочитать профиль Forge из installer.jar');

  profile.id = profile.id || `forge-${fullVersion}`;
  profile.inheritsFrom = profile.inheritsFrom || minecraftVersion;
  profile.type = profile.type || 'release';
  profile.jar = profile.jar || minecraftVersion;

  await extractLegacyForgeInstallFile(zip, rootDir, installProfile, profile);
  await extractBundledMavenArtifacts(zip, rootDir, profile);
  await downloadProfileLibraries(profile, rootDir, 'forge-direct-lib');
  const dir = path.join(rootDir, 'versions', profile.id);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, `${profile.id}.json`), JSON.stringify(profile, null, 2));
  await ensureLegacyLaunchwrapperDeclaration([{ id: profile.id, file: path.join(dir, `${profile.id}.json`), meta: profile }], rootDir);
  return { id: profile.id, loaderVersion: fullVersion, direct: true };
}

async function installForgeProfile(rootDir, minecraftVersion, forgeVersion) {
  const versions = await fetchMavenVersions(FORGE_MAVEN);
  const requested = forgeVersion && String(forgeVersion).startsWith(`${minecraftVersion}-`) ? String(forgeVersion) : (forgeVersion ? `${minecraftVersion}-${forgeVersion}` : null);
  const fullVersion = requested || pickForgeVersion(versions, minecraftVersion);
  if (!fullVersion) throw new Error('Forge не найден для Minecraft ' + minecraftVersion);
  const installerUrl = `${FORGE_MAVEN}/${fullVersion}/forge-${fullVersion}-installer.jar`;
  const installerPath = path.join(app.getPath('temp'), `forge-${sanitizeName(fullVersion)}-installer.jar`);
  await Downloads.start({
    id: `forge-installer-${fullVersion}`,
    label: `Forge ${fullVersion}`,
    url: installerUrl,
    urls: [installerUrl, `https://files.minecraftforge.net/maven/net/minecraftforge/forge/${fullVersion}/forge-${fullVersion}-installer.jar`],
    path: installerPath,
    kind: 'loader'
  });

  // Forge 1.12.2 and older use legacy SimpleInstaller/versionInfo. Running the
  // jar with --installClient can fail with “installClient is not a recognized
  // option”, so install those versions directly from installer.jar instead.
  if (minecraftMinor(minecraftVersion) <= 12) {
    try {
      return await installForgeProfileDirect(rootDir, minecraftVersion, installerPath, fullVersion);
    } catch (directError) {
      throw new Error(`Legacy Forge ${fullVersion} не установлен: ${directError.message}`);
    }
  }

  try {
    await runInstallerWithJavaFallback(installerPath, rootDir, minecraftVersion);
  } catch (installerError) {
    // Modern installers have processors that create patched runtime artifacts.
    // Merely extracting version.json produces a profile that looks installed
    // but cannot launch, so never claim success through the legacy fallback.
    throw new Error(`Forge ${fullVersion} не установлен полностью: ${installerError.message}`);
  }
  const installed = await scanVersionJsons(rootDir);
  const profile = installed.find(x => /forge/i.test(x.id)) || installed.find(x => x.id !== minecraftVersion);
  if (!profile) throw new Error('Forge installer завершился, но профиль Forge не найден.');
  return { id: profile.id, loaderVersion: fullVersion };
}

async function installNeoForgeProfile(rootDir, minecraftVersion, neoVersion) {
  const versions = await fetchMavenVersions(NEOFORGE_MAVEN);
  const fullVersion = neoVersion || pickNeoForgeVersion(versions, minecraftVersion);
  if (!fullVersion) throw new Error('NeoForge не найден для Minecraft ' + minecraftVersion);
  const installerUrl = `${NEOFORGE_MAVEN}/${fullVersion}/neoforge-${fullVersion}-installer.jar`;
  const installerPath = path.join(app.getPath('temp'), `neoforge-${sanitizeName(fullVersion)}-installer.jar`);
  await Downloads.start({ id: `neoforge-installer-${fullVersion}`, label: `NeoForge ${fullVersion}`, url: installerUrl, path: installerPath, kind: 'loader' });
  await runInstallerWithJavaFallback(installerPath, rootDir, minecraftVersion);
  const installed = await scanVersionJsons(rootDir);
  const profile = installed.find(x => /neoforge/i.test(x.id)) || installed.find(x => x.id !== minecraftVersion);
  if (!profile) throw new Error('NeoForge installer завершился, но профиль NeoForge не найден.');
  return { id: profile.id, loaderVersion: fullVersion };
}


function isModdedLoader(loader) {
  return ['fabric', 'forge', 'quilt', 'neoforge', 'forgeoptifine', 'fabriciris'].includes(normalizeLoader(loader));
}

function skinModType(fileName) {
  const n = String(fileName || '').toLowerCase();
  if (/custom[-_ ]?skin[-_ ]?loader|customskinloader/.test(n)) return 'customskinloader';
  if (/tl[-_ ]?skin[-_ ]?cape|tlskincape|tl_skin_cape|tl-skin-and-cape/.test(n)) return 'tlskincape';
  return '';
}

async function listSkinModFiles(rootDir) {
  const modsDir = path.join(rootDir, 'mods');
  if (!fs.existsSync(modsDir)) return [];
  const files = await fsp.readdir(modsDir);
  return files
    .map(fileName => ({
      fileName,
      type: skinModType(fileName),
      path: path.join(modsDir, fileName),
      enabled: /\.jar$/i.test(fileName),
      disabled: /\.jar\.disabled$/i.test(fileName) || /\.disabled$/i.test(fileName)
    }))
    .filter(x => x.type);
}

async function setSkinJarEnabled(item, enabled) {
  if (!item || !fs.existsSync(item.path)) return null;
  if (enabled && item.disabled) {
    const target = item.path.replace(/\.disabled$/i, '');
    if (fs.existsSync(target)) {
      await fsp.unlink(item.path);
      return target;
    }
    await fsp.rename(item.path, target);
    return target;
  }
  if (!enabled && item.enabled) {
    const target = `${item.path}.disabled`;
    if (fs.existsSync(target)) {
      await fsp.unlink(item.path);
      return target;
    }
    await fsp.rename(item.path, target);
    return target;
  }
  return item.path;
}

async function ensureDefaultOptions(gameDir) {
  const optFile = path.join(gameDir, 'options.txt');
  if (fs.existsSync(optFile)) return;
  const defaultOptions = [
    'version:3465',
    'graphicsMode:1',
    'renderDistance:12',
    'simulationDistance:10',
    'mipmapLevels:4',
    'maxFps:144',
    'fov:0.1',
    'gamma:1.0',
    'entityDistanceScaling:1.0',
    'autoJump:false',
    'narrator:0',
    'particles:0',
    'smoothLighting:true',
    'ao:2'
  ].join('\r\n') + '\r\n';
  try {
    await fsp.writeFile(optFile, defaultOptions, 'utf8');
  } catch {}
}

function normalizeSkinSystem(system) {
  const s = String(system || 'ely').toLowerCase();
  if (['ely', 'ely.by', 'elyby'].includes(s)) return 'ely';
  if (['tlauncher', 'tl', 't-launcher'].includes(s)) return 'tlauncher';
  if (['both', 'all', 'ely_tl', 'both_ely_tl'].includes(s)) return 'both';
  return 'none';
}

async function configureCustomSkinLoader(rootDir, mode) {
  const cslDir = path.join(rootDir, 'CustomSkinLoader');
  await fsp.mkdir(cslDir, { recursive: true });
  const cslConfigFile = path.join(cslDir, 'CustomSkinLoader.json');

  let load_list = [];
  if (mode === 'ely') {
    load_list = [
      { name: "ElyBy", type: "ElyBy" },
      { name: "Mojang", type: "Mojang" }
    ];
  } else if (mode === 'tlauncher') {
    load_list = [
      {
        name: "TLauncher",
        type: "Custom",
        skin: "https://skin.tlauncher.org/skin/{USERNAME}.png",
        cape: "https://skin.tlauncher.org/cape/{USERNAME}.png"
      },
      { name: "Mojang", type: "Mojang" }
    ];
  } else if (mode === 'both') {
    load_list = [
      { name: "ElyBy", type: "ElyBy" },
      {
        name: "TLauncher",
        type: "Custom",
        skin: "https://skin.tlauncher.org/skin/{USERNAME}.png",
        cape: "https://skin.tlauncher.org/cape/{USERNAME}.png"
      },
      { name: "Mojang", type: "Mojang" }
    ];
  }

  const configObj = {
    version: "14.15",
    enable: mode !== 'none',
    load_list
  };

  await fsp.writeFile(cslConfigFile, JSON.stringify(configObj, null, 2), 'utf8');
}

async function applySkinSystem(rootDir, system = 'ely') {
  const mode = normalizeSkinSystem(system);
  const files = await listSkinModFiles(rootDir);
  const changed = [];
  const enableMods = mode !== 'none';
  for (const file of files) {
    const enable = (enableMods && file.type === 'customskinloader');
    const newPath = await setSkinJarEnabled(file, enable);
    changed.push({ ...file, enabled: enable, path: newPath || file.path });
  }
  if (enableMods) {
    try {
      await configureCustomSkinLoader(rootDir, mode);
    } catch (e) {
      console.warn('[versions] Failed to write CSL config:', e.message);
    }
  }
  return { ok: true, system: mode, changed };
}

async function installCustomSkinLoader(rootDir, minecraftVersion, loader) {
  const effectiveLoader = loader === 'forgeoptifine' ? 'forge' : normalizeLoader(loader);
  const loaders = effectiveLoader === 'neoforge' ? ['neoforge', 'forge'] : [effectiveLoader];
  for (const l of loaders) {
    try {
      const { data } = await axios.get(`${MODRINTH}/project/${CUSTOM_SKIN_LOADER_PROJECT}/version`, {
        timeout: timeoutMs(),
        params: {
          game_versions: JSON.stringify([minecraftVersion]),
          loaders: JSON.stringify([l])
        }
      });
      if (!Array.isArray(data) || !data.length) continue;
      const version = data[0];
      const file = (version.files || []).find(f => f.primary) || (version.files || [])[0];
      if (!file || !file.url) continue;
      const dest = path.join(rootDir, 'mods', file.filename);
      await Downloads.start({
        id: `skinmod-csl-${sanitizeName(rootDir)}-${file.filename}`,
        label: `CustomSkinLoader: ${file.filename}`,
        url: file.url,
        path: dest,
        size: file.size,
        sha1: file.hashes && file.hashes.sha1,
        kind: 'mod'
      });
      return { file: dest, project: 'CustomSkinLoader', loader: l };
    } catch (e) {
      console.warn('[versions] CustomSkinLoader skipped for', l, e.message);
    }
  }
  return null;
}

async function installSkinSupportMods(rootDir, minecraftVersion, loader) {
  if (!isModdedLoader(loader)) return null;
  const currentSkinSystem = normalizeSkinSystem(Settings.getAll().skinSystem || 'ely');
  // If skin system is disabled, do NOT download or inject any skin mod!
  if (currentSkinSystem === 'none') {
    await applySkinSystem(rootDir, 'none');
    return { customSkinLoader: null, tlskincape: null, warnings: [] };
  }

  await fsp.mkdir(path.join(rootDir, 'mods'), { recursive: true });
  const warnings = [];
  let customSkinLoader = null;

  try { customSkinLoader = await installCustomSkinLoader(rootDir, minecraftVersion, loader); }
  catch (e) { warnings.push(`CustomSkinLoader: ${e.message}`); }

  if (!customSkinLoader) warnings.push('CustomSkinLoader не найден для этой версии/загрузчика.');

  await applySkinSystem(rootDir, currentSkinSystem);
  return { customSkinLoader, tlskincape: null, warnings };
}

async function installLoader(minecraftVersion, opts = {}) {
  const loader = normalizeLoader(opts.loader);
  const loaderInfo = await resolveLoaderInfo(loader, minecraftVersion, opts.loaderVersion);
  const resolvedLoaderVersion = opts.loaderVersion || loaderInfo.version;
  const dirName = sanitizeName(opts.customDirName || opts.folderName || formatInstanceDirName(minecraftVersion, loader));
  const rootDir = opts.gameDir || instanceDir(dirName);
  await installVanilla(minecraftVersion, { gameDir: rootDir, skipInstallMeta: true });

  let profile;
  if (loader === 'fabric') profile = await installFabricProfile(rootDir, minecraftVersion, resolvedLoaderVersion);
  else if (loader === 'quilt') profile = await installQuiltProfile(rootDir, minecraftVersion, resolvedLoaderVersion);
  else if (loader === 'forge') profile = await installForgeProfile(rootDir, minecraftVersion, resolvedLoaderVersion);
  else if (loader === 'neoforge') profile = await installNeoForgeProfile(rootDir, minecraftVersion, resolvedLoaderVersion);
  else if (loader === 'forgeoptifine') {
    profile = await installForgeProfile(rootDir, minecraftVersion, resolvedLoaderVersion);
    try {
      await downloadOptiFineMod(rootDir, minecraftVersion);
    } catch (e) {
      console.warn('[versions] Не удалось скачать OptiFine:', e.message);
    }
  }
  else if (loader === 'fabriciris') {
    profile = await installFabricProfile(rootDir, minecraftVersion, resolvedLoaderVersion);
    try {
      await downloadIrisAndSodiumMods(rootDir, minecraftVersion);
    } catch (e) {
      console.warn('[versions] Не удалось скачать Iris & Sodium:', e.message);
    }
  }
  else throw new Error('Неизвестный загрузчик модов: ' + loader);

  const skinSupport = await installSkinSupportMods(rootDir, minecraftVersion, loader === 'forgeoptifine' ? 'forge' : (loader === 'fabriciris' ? 'fabric' : loader));

  await writeInstallMeta(rootDir, {
    id: profile.id,
    versionId: profile.id,
    minecraft: minecraftVersion,
    loader,
    loaderVersion: profile.loaderVersion,
    type: 'release',
    kind: 'version',
    title: loader === 'forgeoptifine' ? `${minecraftVersion} · Forge + OptiFine` : (loader === 'fabriciris' ? `${minecraftVersion} · Fabric + Iris Shaders` : `${minecraftVersion} · ${loader}`),
    authlibInjectorApi: AUTHLIB_INJECTOR_API,
    skinSystem: Settings.getAll().skinSystem || 'tlskincape',
    skinSupport: skinSupport || { customSkinLoader: null, tlskincape: null, warnings: [] }
  });
  return { ok: true, id: profile.id, profileId: profile.id, versionId: profile.id, minecraft: minecraftVersion, loader, loaderVersion: profile.loaderVersion, rootDir, path: rootDir };
}


async function readProfileChain(rootDir, versionId, seen = new Set()) {
  if (seen.has(versionId)) throw new Error(`Цикл наследования версий: ${versionId}`);
  seen.add(versionId);
  const file = path.join(versionsDir(rootDir), versionId, `${versionId}.json`);
  if (!fs.existsSync(file)) throw new Error(`Профиль версии отсутствует: ${versionId}`);
  const meta = JSON.parse(await fsp.readFile(file, 'utf8'));
  const chain = [{ id: versionId, file, meta }];
  if (meta.inheritsFrom) chain.push(...await readProfileChain(rootDir, meta.inheritsFrom, seen));
  return chain;
}

async function readInstallMeta(rootDir) {
  try {
    return JSON.parse(await fsp.readFile(path.join(rootDir, 'nexus-install.json'), 'utf8'));
  } catch {
    return null;
  }
}

function legacyLaunchwrapperVersion(mcVersion) {
  return minecraftMinor(mcVersion) <= 7 ? '1.11' : '1.12';
}

async function ensureLegacyLaunchwrapperDeclaration(chain, rootDir) {
  if (!chain.length) return false;
  const child = chain[0];
  const base = chain[chain.length - 1];
  const mcVersion = (child.meta && child.meta.inheritsFrom) || (base.meta && base.meta.id) || base.id;
  const loader = detectLoader(child.id, child.meta);
  const mainClass = String(child.meta.mainClass || '');
  if ((loader !== 'forge' && loader !== 'forgeoptifine') || minecraftMinor(mcVersion) > 12) return false;
  if (!/launchwrapper\.Launch/i.test(mainClass) && mainClass) return false;
  const allLibraries = chain.flatMap(x => x.meta.libraries || []);
  if (allLibraries.some(lib => /^net\.minecraft:launchwrapper:/i.test(String(lib.name || '')))) return false;

  const version = legacyLaunchwrapperVersion(mcVersion);
  child.meta.libraries = [...(child.meta.libraries || []), {
    name: `net.minecraft:launchwrapper:${version}`,
    url: 'https://libraries.minecraft.net/'
  }];
  child.meta.mainClass = child.meta.mainClass || 'net.minecraft.launchwrapper.Launch';
  await fsp.writeFile(child.file, JSON.stringify(child.meta, null, 2));
  return true;
}

function missingProfileFiles(chain, rootDir) {
  const missing = [];
  const seen = new Set();
  const base = chain[chain.length - 1];
  const baseId = (base.meta && base.meta.id) || base.id;
  const clientJar = path.join(versionsDir(rootDir), baseId, `${baseId}.jar`);
  if (!fs.existsSync(clientJar) || fs.statSync(clientJar).size <= 0) missing.push({ kind: 'client', path: clientJar, id: baseId });

  for (const profile of chain) {
    for (const lib of profile.meta.libraries || []) {
      if (!isAllowed(lib.rules)) continue;
      const artifact = libraryArtifact(lib);
      if (!artifact || !artifact.rel) continue;
      const file = path.join(rootDir, 'libraries', artifact.rel);
      if (seen.has(file)) continue;
      seen.add(file);
      if (!fs.existsSync(file) || fs.statSync(file).size <= 0) missing.push({ kind: 'library', path: file, lib, artifact });
    }
  }
  return missing;
}

async function repairMissingProfileLibraries(missing, rootDir) {
  const failures = [];
  let repaired = 0;
  for (const item of missing) {
    if (item.kind !== 'library' || !item.artifact || !(item.artifact.url || (item.artifact.urls || []).length)) continue;
    try {
      await Downloads.start({
        id: `${sanitizeName(rootDir)}-repair-${sanitizeName(item.lib.name || path.basename(item.path))}`,
        label: item.lib.name || path.basename(item.path),
        url: item.artifact.url,
        urls: uniqueUrls([...(item.artifact.urls || []), 'https://libraries.minecraft.net/' + item.artifact.rel]),
        path: item.path,
        size: item.artifact.size,
        sha1: item.artifact.sha1,
        kind: 'library'
      });
      repaired += 1;
    } catch (error) {
      failures.push({ item, error });
    }
  }
  return { repaired, failures };
}

/**
 * Repairs the complete selected profile, not only its inherited vanilla base.
 * This is used both by the launch pre-check and by the "Проверить файлы" button.
 */
async function repair(versionId, opts = {}) {
  const rootDir = opts.gameDir || opts.rootDir || instanceDir(versionId);
  const installMeta = await readInstallMeta(rootDir);
  let chain;

  try {
    chain = await readProfileChain(rootDir, versionId);
  } catch (initialError) {
    if (installMeta && installMeta.loader && installMeta.loader !== 'vanilla' && installMeta.minecraft) {
      const reinstalled = await installLoader(installMeta.minecraft, {
        gameDir: rootDir,
        loader: installMeta.loader,
        loaderVersion: installMeta.loaderVersion
      });
      versionId = reinstalled.versionId || reinstalled.id || installMeta.versionId || installMeta.id || versionId;
      chain = await readProfileChain(rootDir, versionId);
    } else {
      throw initialError;
    }
  }

  await ensureLegacyLaunchwrapperDeclaration(chain, rootDir);
  chain = await readProfileChain(rootDir, versionId);
  const base = chain[chain.length - 1];
  const baseVersion = (base.meta && base.meta.id) || base.id;

  // Mojang client, assets, natives and vanilla libraries.
  await installVanilla(baseVersion, { gameDir: rootDir, skipInstallMeta: true });
  chain = await readProfileChain(rootDir, versionId);
  await ensureLegacyLaunchwrapperDeclaration(chain, rootDir);
  chain = await readProfileChain(rootDir, versionId);

  let missing = missingProfileFiles(chain, rootDir);
  let repaired = 0;
  if (missing.length) {
    const firstPass = await repairMissingProfileLibraries(missing, rootDir);
    repaired += firstPass.repaired;
  }

  missing = missingProfileFiles(chain, rootDir);
  if (missing.length && installMeta && installMeta.loader && installMeta.loader !== 'vanilla' && installMeta.minecraft) {
    // Rebuild loader-specific artifacts that cannot be downloaded directly,
    // such as the classifier-less legacy Forge universal runtime.
    const reinstalled = await installLoader(installMeta.minecraft, {
      gameDir: rootDir,
      loader: installMeta.loader,
      loaderVersion: installMeta.loaderVersion
    });
    versionId = reinstalled.versionId || reinstalled.id || versionId;
    chain = await readProfileChain(rootDir, versionId);
    await ensureLegacyLaunchwrapperDeclaration(chain, rootDir);
    chain = await readProfileChain(rootDir, versionId);
    missing = missingProfileFiles(chain, rootDir);
    if (missing.length) {
      const secondPass = await repairMissingProfileLibraries(missing, rootDir);
      repaired += secondPass.repaired;
    }
  }

  missing = missingProfileFiles(chain, rootDir);
  if (missing.length) {
    const sample = missing.slice(0, 6).map(x => x.lib && x.lib.name ? x.lib.name : x.path).join(', ');
    throw new Error(`Не удалось восстановить ${missing.length} файлов версии: ${sample}`);
  }

  if (installMeta && installMeta.loader && installMeta.loader !== 'vanilla' && installMeta.minecraft) {
    await installSkinSupportMods(rootDir, installMeta.minecraft, installMeta.loader);
  } else {
    await applySkinSystem(rootDir, Settings.getAll().skinSystem || 'tlskincape');
  }

  return {
    ok: true,
    versionId,
    rootDir,
    path: rootDir,
    baseVersion,
    repaired
  };
}

async function remove(versionId, root) {
  const iso = path.resolve(isolatedRoot());
  const defaultDir = path.resolve(defaultGameDir());
  const mpDir = path.resolve(Settings.getAll().modpacksFolder || path.join(defaultGameDir(), 'modpacks'));

  if (root) {
    const resolvedRoot = path.resolve(root);
    if (resolvedRoot === defaultDir) {
      const legacyVersionDir = path.resolve(versionsDir(resolvedRoot), sanitizeName(versionId));
      const versionsRoot = path.resolve(versionsDir(resolvedRoot)) + path.sep;
      if (!legacyVersionDir.startsWith(versionsRoot)) throw new Error('Некорректный путь версии.');
      if (fs.existsSync(legacyVersionDir)) await fsp.rm(legacyVersionDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      return true;
    }

    // Whole-directory removal is allowed for launcher-managed directories
    // (isolated instances in nexus-versions, modpacks folder, or folders with nexus metadata).
    const isInsideIsolated = (resolvedRoot.startsWith(iso + path.sep) && resolvedRoot !== iso) || resolvedRoot === path.join(iso, sanitizeName(versionId));
    const isInsideModpacks = (resolvedRoot.startsWith(mpDir + path.sep) && resolvedRoot !== mpDir) || resolvedRoot === path.join(mpDir, sanitizeName(versionId));
    const hasMarker = fs.existsSync(path.join(resolvedRoot, 'nexus-install.json')) ||
      fs.existsSync(path.join(resolvedRoot, 'nexus-modpack.json'));

    if (!isInsideIsolated && !isInsideModpacks && !hasMarker) {
      throw new Error('Каталог не помечен как установка Nexus; удаление отменено.');
    }
    if (fs.existsSync(resolvedRoot)) {
      await fsp.rm(resolvedRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
    return true;
  }

  const installed = await getInstalled();
  const found = installed.find(x => x.id === versionId || x.profileId === versionId);
  if (found && found.path && fs.existsSync(found.path) && !found.legacy) {
    await fsp.rm(found.path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    return true;
  }
  const dir = path.join(versionsDir(defaultGameDir()), versionId);
  if (fs.existsSync(dir)) await fsp.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  return true;
}

async function getFabricAvailability() {
  return cached('availability:fabric', async () => {
    const data = await getJsonWithRetry(`${FABRIC_META}/versions/game`, 'fabric_games.json');
    const map = {};
    for (const item of Array.isArray(data) ? data : []) {
      if (item.version) map[item.version] = { loader: 'fabric', mcVersion: item.version, label: 'Fabric', stable: item.stable !== false };
    }
    return map;
  });
}

async function getQuiltAvailability() {
  return cached('availability:quilt', async () => {
    const data = await getJsonWithRetry(`${QUILT_META}/versions/game`, 'quilt_games.json');
    const map = {};
    for (const item of Array.isArray(data) ? data : []) {
      const version = item.version || item.id;
      if (version) map[version] = { loader: 'quilt', mcVersion: version, label: 'Quilt', stable: item.stable !== false };
    }
    return map;
  });
}

async function getForgeAvailability() {
  return cached('availability:forge', async () => buildForgeMap(await fetchMavenVersions(FORGE_MAVEN)));
}

async function getNeoForgeAvailability() {
  return cached('availability:neoforge', async () => buildNeoForgeMap(await fetchMavenVersions(NEOFORGE_MAVEN)));
}

async function getLoaderAvailability(loader, mcVersions = null) {
  const normalized = normalizeLoader(loader);
  const versionsFilter = Array.isArray(mcVersions) && mcVersions.length ? new Set(mcVersions.map(String)) : null;
  if (normalized === 'vanilla') {
    const versions = {};
    if (versionsFilter) for (const v of versionsFilter) versions[v] = { loader: 'vanilla', version: v, mcVersion: v, label: 'Vanilla', available: true };
    return { loader: normalized, versions };
  }

  const cacheKey = `${normalized}:${versionsFilter ? Array.from(versionsFilter).sort().join('|') : '*'}`;
  const hit = loaderAvailabilityCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value;

  let base = {};
  if (normalized === 'fabric' || normalized === 'fabriciris') base = await getFabricAvailability();
  else if (normalized === 'quilt') base = await getQuiltAvailability();
  else if (normalized === 'forge' || normalized === 'forgeoptifine') base = await getForgeAvailability();
  else if (normalized === 'neoforge') base = await getNeoForgeAvailability();
  else throw new Error('Неизвестный загрузчик модов: ' + loader);

  const versions = {};
  const keys = versionsFilter ? Array.from(versionsFilter) : Object.keys(base);
  for (const mc of keys) {
    const info = base[mc];
    const isAvailable = info && (normalized !== 'fabriciris' || isIrisSupported(mc));
    const lbl = normalized === 'fabriciris' ? 'Fabric + Iris Shaders' : (normalized === 'forgeoptifine' ? 'Forge + OptiFine' : (info ? info.label : normalized));
    versions[mc] = isAvailable
      ? { ...info, loader: normalized, label: lbl, available: true, version: (info && info.version) || null, mcVersion: mc }
      : { loader: normalized, mcVersion: mc, available: false, label: lbl };
  }
  const value = { loader: normalized, versions, generatedAt: Date.now() };
  loaderAvailabilityCache.set(cacheKey, { at: Date.now(), value });
  return value;
}

function isIrisSupported(mc) {
  // Iris supports MC 1.16.5 up through modern versions
  const parts = String(mc).split('.').map(n => parseInt(n, 10) || 0);
  if (parts[0] !== 1) return false;
  if (parts[1] < 16) return false;
  if (parts[1] === 16 && (parts[2] || 0) < 5) return false;
  return true;
}

async function resolveLoaderInfo(loader, mcVersion, requestedVersion = null) {
  const normalized = normalizeLoader(loader);
  if (normalized === 'vanilla') return { loader: 'vanilla', version: mcVersion, mcVersion, label: 'Vanilla', available: true };

  if (requestedVersion) {
    const requested = String(requestedVersion);
    let ok = false;
    if (normalized === 'fabric' || normalized === 'fabriciris') ok = (await getFabricLoaders(mcVersion)).some(x => x.version === requested);
    else if (normalized === 'quilt') ok = (await getQuiltLoaders(mcVersion)).some(x => x.version === requested);
    else if (normalized === 'forge' || normalized === 'forgeoptifine') {
      const full = requested.startsWith(`${mcVersion}-`) ? requested : `${mcVersion}-${requested}`;
      ok = (await fetchMavenVersions(FORGE_MAVEN)).includes(full);
      return ok
        ? { loader: normalized, version: full, mcVersion, label: normalized === 'forgeoptifine' ? 'Forge + OptiFine' : 'Forge', available: true }
        : Promise.reject(new Error(`Forge ${requested} недоступен для Minecraft ${mcVersion}`));
    } else if (normalized === 'neoforge') {
      ok = (await fetchMavenVersions(NEOFORGE_MAVEN)).some(v => v === requested && minecraftFromNeoForgeVersion(v) === mcVersion);
    }
    if (!ok) throw new Error(`${normalized} ${requested} недоступен для Minecraft ${mcVersion}`);
    return { loader: normalized, version: requested, mcVersion, label: normalized === 'forgeoptifine' ? 'Forge + OptiFine' : (normalized === 'fabriciris' ? 'Fabric + Iris' : normalized), available: true };
  }

  const availability = await getLoaderAvailability(normalized, [mcVersion]);
  const info = availability.versions[mcVersion];
  if (!info || !info.available) throw new Error(`${normalized} недоступен для Minecraft ${mcVersion}`);
  return info;
}

async function getLoaders(mcVersion) {
  const out = [{ loader: 'vanilla', version: mcVersion, mcVersion, label: 'Vanilla', available: true }];
  for (const loader of ['fabric', 'fabriciris', 'quilt', 'forge', 'forgeoptifine', 'neoforge']) {
    try {
      const availability = await getLoaderAvailability(loader, [mcVersion]);
      const info = availability.versions[mcVersion];
      if (info && info.available) {
        out.push({
          ...info,
          loader,
          label: ({ fabric: 'Fabric', fabriciris: 'Fabric + Iris (Шейдеры)', quilt: 'Quilt', forge: 'Forge', forgeoptifine: 'Forge + OptiFine', neoforge: 'NeoForge' })[loader]
        });
      }
    } catch {}
  }
  return out;
}

async function getStoragePaths(versionId) {
  const all = isolatedRoot();
  if (!versionId || versionId === '—') return { all, selected: null };
  try {
    const installed = await getInstalled();
    const found = installed.find(x => x.id === versionId || x.profileId === versionId || x.versionId === versionId || x.displayName === versionId);
    if (found && (found.rootDir || found.path)) return { all, selected: found.rootDir || found.path };
  } catch {}
  return { all, selected: instanceDir(versionId) };
}

module.exports = { list, getInstalled, install, cancelInstall, repair, remove, getLoaders, getLoaderAvailability, getStoragePaths, installVanilla, applySkinSystem, installSkinSupportMods };
if (process.env.NODE_ENV === 'test') {
  module.exports.__testing = {
    parseMavenCoordinate, extractLegacyForgeInstallFile, extractBundledMavenArtifacts,
    legacyLaunchwrapperVersion, recommendedInstallerJava, installFabricProfile,
    installQuiltProfile, installForgeProfile, installNeoForgeProfile,
    getFabricLoaders, getQuiltLoaders, resolveLoaderInfo, downloadProfileLibraries,
    sortLoaderVersions, installerArgSets
  };
}
