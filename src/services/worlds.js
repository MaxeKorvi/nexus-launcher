'use strict';

/**
 * World Backup & Save Manager for Nexus Launcher
 * Allows listing, backing up, restoring, importing (drag & drop), and deleting Minecraft worlds.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const zlib = require('zlib');
const { app } = require('electron');
const JSZip = require('jszip');
const Settings = require('./settings');

const defaultGameDir = () => {
  try {
    const s = Settings.getAll();
    if (s && s.gameFolder) return s.gameFolder;
  } catch {}
  const home = (app && typeof app.getPath === 'function' && app.getPath('home')) || process.env.USERPROFILE || process.env.HOME || '.';
  return path.join(home, '.minecraft');
};
const savesDir = (rootDir) => path.join(rootDir || defaultGameDir(), 'saves');
const backupsDir = (rootDir) => path.join(rootDir || defaultGameDir(), 'backups');

function sanitizeWorldName(val) {
  return String(val || 'world').replace(/[/\\?%*:|"<>]/g, '_').trim();
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i] || 'MB'}`;
}

async function getDirSize(dir) {
  let total = 0;
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        total += await getDirSize(full);
      } else if (ent.isFile()) {
        const st = await fsp.stat(full);
        total += st.size;
      }
    }
  } catch {}
  return total;
}

/**
 * Reads the true UTF-8 world name directly from level.dat (NBT tag Data.LevelName).
 * Fixes broken filesystem encoding/mojibake on Windows (e.g. Cyrillic characters).
 */
async function readLevelName(levelDatPath) {
  try {
    const raw = await fsp.readFile(levelDatPath);
    let buf;
    try {
      buf = zlib.gunzipSync(raw);
    } catch {
      buf = raw;
    }

    // Look for "LevelName" string tag in uncompressed NBT
    const target = Buffer.from('LevelName');
    const idx = buf.indexOf(target);
    if (idx !== -1) {
      const valLenIdx = idx + target.length;
      if (valLenIdx + 2 <= buf.length) {
        const strLen = buf.readUInt16BE(valLenIdx);
        if (strLen > 0 && valLenIdx + 2 + strLen <= buf.length) {
          const nameBuf = buf.subarray(valLenIdx + 2, valLenIdx + 2 + strLen);
          const name = nameBuf.toString('utf8');
          if (name && name.trim() && !name.includes('\uFFFD')) {
            return name.trim();
          }
        }
      }
    }
  } catch {}
  return null;
}

async function list(rootDir) {
  const dir = savesDir(rootDir);
  if (!fs.existsSync(dir)) {
    await fsp.mkdir(dir, { recursive: true });
    return [];
  }

  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const worlds = [];

  for (const ent of entries.filter(e => e.isDirectory())) {
    const worldPath = path.join(dir, ent.name);
    const levelDat = path.join(worldPath, 'level.dat');
    if (!fs.existsSync(levelDat)) {
      continue; // Not a valid Minecraft save
    }

    try {
      const stat = await fsp.stat(worldPath);
      let icon = null;
      const iconPath = path.join(worldPath, 'icon.png');
      if (fs.existsSync(iconPath)) {
        try {
          const buf = await fsp.readFile(iconPath);
          icon = `data:image/png;base64,${buf.toString('base64')}`;
        } catch {}
      }

      const sizeBytes = await getDirSize(worldPath);

      // Read real world name from level.dat to avoid mojibake like "1"
      const realLevelName = await readLevelName(levelDat);
      const displayName = realLevelName || ent.name;

      worlds.push({
        name: ent.name,
        displayName: displayName,
        path: worldPath,
        lastModified: stat.mtime.toISOString(),
        sizeBytes,
        sizeFormatted: formatBytes(sizeBytes),
        icon
      });
    } catch {}
  }

  return worlds.sort((a, b) => String(b.lastModified).localeCompare(String(a.lastModified)));
}

async function backup(worldName, rootDir, note = '') {
  const worldSafe = sanitizeWorldName(worldName);
  const src = path.join(savesDir(rootDir), worldSafe);
  if (!fs.existsSync(src)) {
    throw new Error(`Мир "${worldSafe}" не найден в папке saves`);
  }

  const destDir = backupsDir(rootDir);
  if (!fs.existsSync(destDir)) {
    await fsp.mkdir(destDir, { recursive: true });
  }

  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const zipName = `${worldSafe}_backup_${dateStr}.zip`;
  const zipPath = path.join(destDir, zipName);

  const zip = new JSZip();

  async function addFolder(folderPath, zipFolder) {
    const items = await fsp.readdir(folderPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(folderPath, item.name);
      if (item.isDirectory()) {
        const subZip = zipFolder.folder(item.name);
        await addFolder(fullPath, subZip);
      } else if (item.isFile()) {
        const data = await fsp.readFile(fullPath);
        zipFolder.file(item.name, data);
      }
    }
  }

  await addFolder(src, zip);

  zip.file('.nexus-world-meta.json', JSON.stringify({
    worldName: worldSafe,
    createdAt: new Date().toISOString(),
    note: note || ''
  }, null, 2));

  const buf = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  await fsp.writeFile(zipPath, buf);

  const st = await fsp.stat(zipPath);
  return {
    ok: true,
    fileName: zipName,
    path: zipPath,
    sizeBytes: st.size,
    sizeFormatted: formatBytes(st.size)
  };
}

async function listBackups(rootDir) {
  const dir = backupsDir(rootDir);
  if (!fs.existsSync(dir)) {
    await fsp.mkdir(dir, { recursive: true });
    return [];
  }

  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const backups = [];

  for (const ent of entries.filter(e => e.isFile() && e.name.endsWith('.zip'))) {
    const fullPath = path.join(dir, ent.name);
    try {
      const stat = await fsp.stat(fullPath);
      let worldName = ent.name.split('_backup_')[0] || ent.name.replace('.zip', '');
      let note = '';

      backups.push({
        fileName: ent.name,
        worldName,
        note,
        path: fullPath,
        lastModified: stat.mtime.toISOString(),
        sizeBytes: stat.size,
        sizeFormatted: formatBytes(stat.size)
      });
    } catch {}
  }

  return backups.sort((a, b) => String(b.lastModified).localeCompare(String(a.lastModified)));
}

async function restore(backupFileName, rootDir, targetWorldName = null) {
  const dir = backupsDir(rootDir);
  const zipPath = path.join(dir, backupFileName);
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Бэкап "${backupFileName}" не найден`);
  }

  const sDir = savesDir(rootDir);
  if (!fs.existsSync(sDir)) {
    await fsp.mkdir(sDir, { recursive: true });
  }

  const zipBuf = await fsp.readFile(zipPath);
  const zip = await JSZip.loadAsync(zipBuf);

  let detectedWorldName = targetWorldName;
  if (!detectedWorldName) {
    if (zip.file('.nexus-world-meta.json')) {
      try {
        const metaRaw = await zip.file('.nexus-world-meta.json').async('string');
        const parsed = JSON.parse(metaRaw);
        if (parsed && parsed.worldName) detectedWorldName = parsed.worldName;
      } catch {}
    }
    if (!detectedWorldName) {
      detectedWorldName = backupFileName.split('_backup_')[0] || 'Restored_World';
    }
  }

  const targetDir = path.join(sDir, sanitizeWorldName(detectedWorldName));
  await fsp.mkdir(targetDir, { recursive: true });

  for (const [rawName, entry] of Object.entries(zip.files)) {
    if (!rawName || rawName === '.nexus-world-meta.json' || rawName.startsWith('__MACOSX/')) continue;
    const cleanName = rawName.replace(/\\/g, '/');
    const dest = path.join(targetDir, cleanName);

    if (entry.dir) {
      await fsp.mkdir(dest, { recursive: true });
    } else {
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      const buf = await entry.async('nodebuffer');
      await fsp.writeFile(dest, buf);
    }
  }

  return { ok: true, worldName: detectedWorldName, path: targetDir };
}

async function deleteBackup(backupFileName, rootDir) {
  const dir = backupsDir(rootDir);
  const zipPath = path.join(dir, backupFileName);
  if (fs.existsSync(zipPath)) {
    await fsp.unlink(zipPath);
    return { ok: true };
  }
  return { ok: false, error: 'not_found' };
}

/**
 * Imports a Minecraft world from an arbitrary folder or archive (.zip, .rar, etc.)
 * Validates strictly: only archives containing world files (level.dat) are permitted.
 * Extraneous directories like mods/ or config/ cause rejection with clear explanation.
 */
async function importWorld(sourcePath, rootDir, password = '') {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error('Указанный файл или папка не существует');
  }

  const sDir = savesDir(rootDir);
  if (!fs.existsSync(sDir)) {
    await fsp.mkdir(sDir, { recursive: true });
  }

  const stat = await fsp.stat(sourcePath);

  // ─── Case 1: Dropped a directory ──────────────────────────────────────────
  if (stat.isDirectory()) {
    // Check if level.dat is in the directory or one level down
    const directLevelDat = path.join(sourcePath, 'level.dat');
    let worldDir = sourcePath;

    if (!fs.existsSync(directLevelDat)) {
      const subs = await fsp.readdir(sourcePath, { withFileTypes: true });
      const worldSub = subs.find(s => s.isDirectory() && fs.existsSync(path.join(sourcePath, s.name, 'level.dat')));
      if (worldSub) {
        worldDir = path.join(sourcePath, worldSub.name);
      } else {
        throw new Error('В выбранной папке не найден файл сохранения "level.dat". Это не является миром Minecraft.');
      }
    }

    // Check for extraneous top-level folders (e.g. mods, config)
    const topEntries = await fsp.readdir(sourcePath, { withFileTypes: true });
    const hasMods = topEntries.some(e => ['mods', 'config', 'resourcepacks', 'shaderpacks'].includes(e.name.toLowerCase()));
    if (hasMods && worldDir !== sourcePath) {
      throw new Error('Архив/папка содержит посторонние компоненты (mods, config и др.). Лаунчер принимает только сохранения миров Minecraft.');
    }

    // Determine target world name
    const realName = await readLevelName(path.join(worldDir, 'level.dat'));
    let worldName = sanitizeWorldName(realName || path.basename(worldDir));
    let target = path.join(sDir, worldName);
    let counter = 1;
    while (fs.existsSync(target)) {
      target = path.join(sDir, `${worldName}_${counter++}`);
    }

    // Copy world directory recursively
    await fsp.cp(worldDir, target, { recursive: true });
    return { ok: true, worldName: path.basename(target), path: target };
  }

  // ─── Case 2: Dropped an archive file (.zip, .rar, .7z, etc.) ─────────────
  const ext = path.extname(sourcePath).toLowerCase();
  if (['.zip', '.mrpack', '.mcworld', '.tar', '.gz', '.rar', '.7z'].includes(ext)) {
    const zipBuf = await fsp.readFile(sourcePath);

    let zip;
    try {
      zip = await JSZip.loadAsync(zipBuf);
    } catch (err) {
      // Check if password protected or non-standard format
      if (err.message && (err.message.includes('encrypted') || err.message.includes('password'))) {
        throw new Error('Архив защищен паролем. Введите пароль для распаковки.');
      }
      throw new Error(`Не удалось прочитать архив: ${err.message}`);
    }

    // Analyze files inside the archive
    const files = Object.keys(zip.files).map(f => f.replace(/\\/g, '/'));
    const levelDatFile = files.find(f => f === 'level.dat' || f.endsWith('/level.dat'));

    if (!levelDatFile) {
      throw new Error('В архиве не найден файл сохранения "level.dat". Разрешено импортировать только карты миров Minecraft.');
    }

    // Check for extraneous forbidden folders (mods, config, etc.)
    const hasForbidden = files.some(f => {
      const p = f.toLowerCase();
      return p.startsWith('mods/') || p.startsWith('config/') || p.startsWith('shaderpacks/') || p.startsWith('bin/');
    });
    if (hasForbidden) {
      throw new Error('В архиве обнаружены посторонние файлы (mods, config и др.). Лаунчер принимает только архивы сохранений миров.');
    }

    // Determine prefix of the world folder inside the archive
    const prefix = levelDatFile === 'level.dat' ? '' : levelDatFile.substring(0, levelDatFile.lastIndexOf('level.dat'));

    // Extract level.dat temporarily in memory to get the real world name
    let realName = null;
    try {
      const ldatBuf = await zip.file(levelDatFile).async('nodebuffer');
      let uncompressed;
      try { uncompressed = zlib.gunzipSync(ldatBuf); } catch { uncompressed = ldatBuf; }
      const targetTag = Buffer.from('LevelName');
      const idx = uncompressed.indexOf(targetTag);
      if (idx !== -1) {
        const valLenIdx = idx + targetTag.length;
        const strLen = uncompressed.readUInt16BE(valLenIdx);
        if (strLen > 0) realName = uncompressed.subarray(valLenIdx + 2, valLenIdx + 2 + strLen).toString('utf8');
      }
    } catch {}

    const defaultName = path.basename(sourcePath, ext);
    let worldName = sanitizeWorldName(realName || (prefix ? prefix.split('/')[0] : defaultName));
    let target = path.join(sDir, worldName);
    let counter = 1;
    while (fs.existsSync(target)) {
      target = path.join(sDir, `${worldName}_${counter++}`);
    }

    await fsp.mkdir(target, { recursive: true });

    // Extract world files
    for (const [rawName, entry] of Object.entries(zip.files)) {
      const cleanName = rawName.replace(/\\/g, '/');
      if (cleanName.startsWith('__MACOSX/') || cleanName.includes('/.') || !cleanName.startsWith(prefix)) continue;

      const relativePath = cleanName.substring(prefix.length);
      if (!relativePath) continue;

      const dest = path.join(target, relativePath);
      if (entry.dir) {
        await fsp.mkdir(dest, { recursive: true });
      } else {
        await fsp.mkdir(path.dirname(dest), { recursive: true });
        const buf = await entry.async('nodebuffer');
        await fsp.writeFile(dest, buf);
      }
    }

    return { ok: true, worldName: path.basename(target), path: target };
  }

  throw new Error('Неподдерживаемый формат файла. Перетащите папку сохранения мира или Zip-архив карты.');
}

module.exports = {
  list,
  backup,
  listBackups,
  restore,
  deleteBackup,
  importWorld
};
