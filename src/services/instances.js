'use strict';

/**
 * Isolated Instances & Profiles Service for Nexus Launcher
 * Provides independent instances with dedicated mods/, saves/, config/,
 * resourcepacks/, and shaderpacks/ directories.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { app, shell } = require('electron');
const Settings = require('./settings');
const Versions = require('./versions');

const defaultGameDir = () => {
  try {
    const s = Settings.getAll();
    if (s && s.gameFolder) return s.gameFolder;
  } catch {}
  const home = (app && typeof app.getPath === 'function' && app.getPath('home')) || process.env.USERPROFILE || process.env.HOME || '.';
  return path.join(home, '.minecraft');
};
const instancesRoot = () => path.join(defaultGameDir(), 'nexus-instances');

function sanitizeId(val) {
  return String(val || '').toLowerCase().replace(/[^a-z0-9_\-]/g, '_').slice(0, 48);
}

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    await fsp.mkdir(dir, { recursive: true });
  }
  return dir;
}

async function list() {
  const root = instancesRoot();
  await ensureDir(root);

  const entries = await fsp.readdir(root, { withFileTypes: true });
  const instances = [];

  for (const ent of entries.filter(e => e.isDirectory())) {
    const dir = path.join(root, ent.name);
    const metaFile = path.join(dir, 'nexus-instance.json');
    try {
      if (fs.existsSync(metaFile)) {
        const meta = JSON.parse(await fsp.readFile(metaFile, 'utf8'));
        instances.push({
          ...meta,
          id: meta.id || ent.name,
          rootDir: dir,
          path: dir
        });
      }
    } catch {}
  }

  return instances.sort((a, b) => String(b.lastPlayed || b.createdAt || '').localeCompare(String(a.lastPlayed || a.createdAt || '')));
}

async function get(id) {
  const all = await list();
  return all.find(x => x.id === id) || null;
}

async function create(data = {}) {
  const name = String(data.name || 'Новый профиль').trim();
  const mcVersion = String(data.mcVersion || data.minecraft || '1.20.4').trim();
  const loader = String(data.loader || 'vanilla').toLowerCase();
  const id = sanitizeId(data.id || `${name}_${Date.now()}`);
  const root = instancesRoot();
  const instanceDir = path.join(root, id);

  await ensureDir(instanceDir);
  await ensureDir(path.join(instanceDir, 'mods'));
  await ensureDir(path.join(instanceDir, 'saves'));
  await ensureDir(path.join(instanceDir, 'resourcepacks'));
  await ensureDir(path.join(instanceDir, 'shaderpacks'));
  await ensureDir(path.join(instanceDir, 'config'));

  const meta = {
    id,
    name,
    minecraft: mcVersion,
    mcVersion,
    loader,
    loaderVersion: data.loaderVersion || null,
    icon: data.icon || 'cube',
    createdAt: new Date().toISOString(),
    lastPlayed: null,
    javaPath: data.javaPath || null,
    maxHeap: data.maxHeap || null,
    jvmArgs: data.jvmArgs || null,
    isolated: true
  };

  const metaFile = path.join(instanceDir, 'nexus-instance.json');
  await fsp.writeFile(metaFile, JSON.stringify(meta, null, 2), 'utf8');

  // Install version and loader directly into this isolated instance
  try {
    await Versions.install(mcVersion, {
      loader,
      loaderVersion: data.loaderVersion,
      gameDir: instanceDir,
      profileId: id
    });
  } catch (err) {
    console.warn(`[instances] Pre-install warning for ${id}:`, err.message);
  }

  return { ...meta, rootDir: instanceDir, path: instanceDir };
}

async function remove(id) {
  const root = instancesRoot();
  const instanceDir = path.join(root, id);
  if (fs.existsSync(instanceDir)) {
    await fsp.rm(instanceDir, { recursive: true, force: true });
    return { ok: true, id };
  }
  return { ok: false, error: 'not_found' };
}

async function duplicate(id, newName) {
  const source = await get(id);
  if (!source) throw new Error('Исходный инстанс не найден');

  const targetName = newName || `${source.name} (Копия)`;
  const targetId = sanitizeId(`${targetName}_${Date.now()}`);
  const targetDir = path.join(instancesRoot(), targetId);

  await copyDir(source.rootDir, targetDir);

  const metaFile = path.join(targetDir, 'nexus-instance.json');
  const meta = {
    ...source,
    id: targetId,
    name: targetName,
    createdAt: new Date().toISOString(),
    lastPlayed: null
  };
  await fsp.writeFile(metaFile, JSON.stringify(meta, null, 2), 'utf8');

  return { ...meta, rootDir: targetDir, path: targetDir };
}

async function copyDir(src, dest) {
  await ensureDir(dest);
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

async function openFolder(id) {
  const inst = await get(id);
  const dir = inst ? inst.rootDir : instancesRoot();
  if (fs.existsSync(dir)) {
    await shell.openPath(dir);
    return { ok: true, path: dir };
  }
  return { ok: false, error: 'not_found' };
}

async function updateLastPlayed(id) {
  const inst = await get(id);
  if (!inst) return;
  inst.lastPlayed = new Date().toISOString();
  const metaFile = path.join(inst.rootDir, 'nexus-instance.json');
  try {
    await fsp.writeFile(metaFile, JSON.stringify(inst, null, 2), 'utf8');
  } catch {}
}

module.exports = {
  list,
  get,
  create,
  remove,
  duplicate,
  openFolder,
  updateLastPlayed,
  instancesRoot
};
