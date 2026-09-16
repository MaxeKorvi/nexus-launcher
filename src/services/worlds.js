'use strict';

/**
 * World Backup & Save Manager for Nexus Launcher
 * Allows listing, backing up, restoring, and deleting Minecraft worlds.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
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

      worlds.push({
        name: ent.name,
        displayName: ent.name,
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

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const zipFileName = `${worldSafe}_backup_${dateStr}.zip`;
  const destZipPath = path.join(destDir, zipFileName);

  const zip = new JSZip();

  // Add world files recursively
  async function addFolderToZip(currentPath, zipFolder) {
    const entries = await fsp.readdir(currentPath, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(currentPath, ent.name);
      if (ent.isDirectory()) {
        const sub = zipFolder.folder(ent.name);
        await addFolderToZip(full, sub);
      } else if (ent.isFile()) {
        // Skip session.lock or temporary lock files if locked
        if (ent.name === 'session.lock') {
          try {
            const buf = await fsp.readFile(full);
            zipFolder.file(ent.name, buf);
          } catch {}
          continue;
        }
        const buf = await fsp.readFile(full);
        zipFolder.file(ent.name, buf);
      }
    }
  }

  await addFolderToZip(src, zip);

  // Add metadata descriptor
  const meta = {
    worldName: worldSafe,
    createdAt: now.toISOString(),
    note: String(note || ''),
    launcher: 'Nexus Launcher'
  };
  zip.file('.nexus-world-meta.json', JSON.stringify(meta, null, 2));

  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  await fsp.writeFile(destZipPath, content);

  return {
    ok: true,
    fileName: zipFileName,
    path: destZipPath,
    sizeBytes: content.length,
    sizeFormatted: formatBytes(content.length),
    createdAt: now.toISOString()
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
    const filePath = path.join(dir, ent.name);
    try {
      const stat = await fsp.stat(filePath);
      let worldName = ent.name.split('_backup_')[0] || ent.name.replace(/\.zip$/i, '');

      backups.push({
        fileName: ent.name,
        filePath,
        worldName,
        createdAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
        sizeFormatted: formatBytes(stat.size)
      });
    } catch {}
  }

  return backups.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
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

module.exports = {
  list,
  backup,
  listBackups,
  restore,
  deleteBackup
};
