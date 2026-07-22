'use strict';

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { app } = require('electron');
const JSZip = require('jszip');
const Downloads = require('./downloads');
const InstallState = require('./install-state');
const Settings = require('./settings');
const { searchMinecraftInside, resolveMinecraftInsideDownload, searchCurseForge, resolveCurseForgeDownload, dedupeByPriority } = require('./catalog');
const { sanitizeName } = require('./shared');

const defaultRoot = () => Settings.getAll().gameFolder || path.join(app.getPath('home'), '.minecraft');
const savesDir = (rootDir) => path.join(rootDir || defaultRoot(), 'saves');

function safeJoin(root, relative) {
  const clean = path.normalize(String(relative || '')).replace(/^([.][.][\\/])+/, '');
  const target = path.resolve(root, clean);
  const base = path.resolve(root) + path.sep;
  if (target !== path.resolve(root) && !target.startsWith(base)) throw new Error('Небезопасный путь в архиве карты: ' + relative);
  return target;
}


async function detectArchiveFormat(filePath) {
  const fd = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(1024);
    const { bytesRead } = await fd.read(buf, 0, buf.length, 0);
    const head = buf.slice(0, bytesRead);
    if (head.length >= 4 && head[0] === 0x50 && head[1] === 0x4B && [0x03, 0x05, 0x07].includes(head[2]) && [0x04, 0x06, 0x08].includes(head[3])) return 'zip';
    if (head.length >= 7 && head[0] === 0x52 && head[1] === 0x61 && head[2] === 0x72 && head[3] === 0x21 && head[4] === 0x1A && head[5] === 0x07) return 'rar';
    if (head.length >= 6 && head[0] === 0x37 && head[1] === 0x7A && head[2] === 0xBC && head[3] === 0xAF && head[4] === 0x27 && head[5] === 0x1C) return '7z';
    if (head.length >= 3 && head[0] === 0x1F && head[1] === 0x8B && head[2] === 0x08) return 'tar.gz';
    if (head.length >= 265 && head.slice(257, 262).toString('ascii') === 'ustar') return 'tar';
    return '';
  } finally {
    await fd.close();
  }
}

function stripKnownArchiveExt(fileName) {
  return String(fileName || 'map')
    .replace(/\.tar\.gz$/i, '')
    .replace(/\.(zip|rar|7z|tar|tgz|gz)$/i, '');
}

function fileNameForDetectedFormat(fileName, format) {
  if (!format) return fileName;
  const ext = format === 'tar.gz' ? 'tar.gz' : format;
  if (new RegExp(`\\.${ext.replace('.', '\\.')}$`, 'i').test(fileName)) return fileName;
  return `${stripKnownArchiveExt(fileName)}.${ext}`;
}

async function moveFileSafe(src, dest) {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fsp.rename(src, dest);
  } catch (err) {
    if (err && err.code === 'EXDEV') {
      await fsp.copyFile(src, dest);
      await fsp.unlink(src).catch(() => {});
      return;
    }
    throw err;
  }
}

async function list({ query = '', mcVersion = '', page = 0, pageSize = 60 } = {}) {
  const results = await Promise.allSettled([
    searchCurseForge({ query, type: 'world', mcVersion, page, pageSize }),
    searchMinecraftInside({ section: 'maps', query, mcVersion, page, pageSize })
  ]);
  const hits = [];
  const errors = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      hits.push(...(result.value.hits || []));
      if (result.value.error) errors.push(result.value.error);
    } else errors.push(result.reason && result.reason.message || String(result.reason));
  }
  const ordered = dedupeByPriority(hits, ['curseforge', 'minecraft-inside']);
  return { source: 'all', total: ordered.length, hits: ordered.slice(0, pageSize), errors };
}

async function extractMapZip(zipPath, root, title) {
  const zip = await JSZip.loadAsync(await fsp.readFile(zipPath));
  const entries = Object.entries(zip.files).filter(([name]) => name && !name.startsWith('__MACOSX/'));
  if (!entries.length) throw new Error('Архив карты пуст.');

  const normalized = entries.map(([name]) => name.replace(/\\/g, '/'));
  const first = normalized.map(name => name.split('/')[0]).filter(Boolean);
  const commonRoot = first.length && first.every(x => x === first[0]) ? first[0] : null;
  const rootHasLevelDat = commonRoot && normalized.some(name => name === `${commonRoot}/level.dat`);
  const directHasLevelDat = normalized.some(name => name === 'level.dat');

  const targetRoot = rootHasLevelDat
    ? root
    : path.join(root, sanitizeName(title));
  await fsp.mkdir(targetRoot, { recursive: true });

  for (const [rawName, entry] of entries) {
    let name = rawName.replace(/\\/g, '/');
    if (!rootHasLevelDat && commonRoot && name.startsWith(commonRoot + '/')) name = name.slice(commonRoot.length + 1);
    if (!name || name.startsWith('__MACOSX/')) continue;
    const out = safeJoin(targetRoot, name);
    if (entry.dir) {
      await fsp.mkdir(out, { recursive: true });
    } else {
      await fsp.mkdir(path.dirname(out), { recursive: true });
      await fsp.writeFile(out, await entry.async('nodebuffer'));
    }
  }

  if (!rootHasLevelDat && !directHasLevelDat && !fs.existsSync(path.join(targetRoot, 'level.dat'))) {
    // The map may still be valid (some downloads contain documentation beside
    // the world), but surface a useful warning instead of pretending otherwise.
    return { path: targetRoot, warning: 'Архив распакован, но level.dat не найден в корне карты.' };
  }
  return { path: rootHasLevelDat ? path.join(root, commonRoot) : targetRoot };
}

async function install(map) {
  const rootDir = map && (map.gameDir || map.rootDir);
  if (!rootDir) {
    throw new Error('Выберите установленную версию Minecraft. Карта должна ставиться в saves выбранной установки.');
  }
  const dir = savesDir(rootDir);
  await fsp.mkdir(dir, { recursive: true });
  const resolved = map.source === 'curseforge'
    ? await resolveCurseForgeDownload({ projectId: map.id, mcVersion: map.mcVersion, type: 'world' })
    : await resolveMinecraftInsideDownload(map);
  if (!resolved || !resolved.url) throw new Error('Источник не вернул ссылку для скачивания карты.');
  let fileName = resolved.fileName || `${Date.now()}.zip`;
  const tempPath = path.join(dir, `.nexus-map-${Date.now()}-${sanitizeName(fileName)}.download`);
  await Downloads.start({
    id: `map-${map.id}`,
    label: map.title || fileName,
    url: resolved.url,
    urls: resolved.urls,
    path: tempPath,
    size: resolved.fileSize || 0,
    kind: 'world'
  });

  const detectedFormat = await detectArchiveFormat(tempPath).catch(() => '');
  fileName = fileNameForDetectedFormat(fileName, detectedFormat);

  if (detectedFormat === 'zip' || (!detectedFormat && /\.zip$/i.test(fileName))) {
    try {
      const extracted = await extractMapZip(tempPath, dir, map.title || path.basename(fileName, '.zip'));
      await InstallState.add(rootDir, 'maps', map, { fileName, path: extracted.path, mcVersion: map.mcVersion, loader: map.loader });
      return { ok: true, fileName, path: extracted.path, warning: extracted.warning, rootDir };
    } finally {
      try { await fsp.unlink(tempPath); } catch {}
    }
  }

  const destination = path.join(dir, fileName);
  await moveFileSafe(tempPath, destination);
  await InstallState.add(rootDir, 'maps', map, { fileName, path: destination, mcVersion: map.mcVersion, loader: map.loader });
  const prettyFormat = detectedFormat ? detectedFormat.toUpperCase() : 'не-ZIP';
  return {
    ok: true,
    fileName,
    path: destination,
    rootDir,
    warning: `Карта скачана как архив ${prettyFormat} и сохранена в saves. Встроенная распаковка пока поддерживает только ZIP, поэтому этот файл нужно распаковать вручную.`
  };
}

async function listInstalled(rootDir) {
  const dir = savesDir(rootDir);
  const registry = await InstallState.list(rootDir, 'maps');
  if (!fs.existsSync(dir)) return registry;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const physical = entries.map(entry => {
    const found = registry.find(x => String(x.fileName || '').toLowerCase() === entry.name.toLowerCase() || String(x.path || '').endsWith('/' + entry.name)) || {};
    return {
      ...found,
      fileName: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(dir, entry.name)
    };
  });
  const extras = registry.filter(x => !physical.some(p => String(p.fileName || '').toLowerCase() === String(x.fileName || '').toLowerCase()));
  return [...physical, ...extras];
}

module.exports = { list, install, listInstalled };
