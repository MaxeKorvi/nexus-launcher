'use strict';

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

const FILE = '.nexus-installed.json';

function dbPath(rootDir) {
  if (!rootDir) throw new Error('Не выбрана установленная версия Minecraft.');
  return path.join(rootDir, FILE);
}

async function read(rootDir) {
  try {
    return JSON.parse(await fsp.readFile(dbPath(rootDir), 'utf8'));
  } catch {
    return { mods: [], maps: [], shaders: [], resourcepacks: [] };
  }
}

async function write(rootDir, data) {
  await fsp.mkdir(rootDir, { recursive: true });
  await fsp.writeFile(dbPath(rootDir), JSON.stringify(data, null, 2));
}

function sameEntry(a, b) {
  if (!a || !b) return false;
  if (a.source && b.source && String(a.source) === String(b.source) && a.id && b.id && String(a.id) === String(b.id)) return true;
  if (a.fileName && b.fileName && String(a.fileName).toLowerCase() === String(b.fileName).toLowerCase()) return true;
  return false;
}

async function add(rootDir, type, item = {}, extra = {}) {
  if (!rootDir) throw new Error('Не выбрана установленная версия Minecraft.');
  const data = await read(rootDir);
  data[type] = Array.isArray(data[type]) ? data[type] : [];
  const entry = {
    id: item.id || extra.id || '',
    source: item.source || extra.source || '',
    title: item.title || item.name || extra.title || extra.fileName || '',
    slug: item.slug || extra.slug || '',
    fileName: extra.fileName || item.fileName || '',
    path: extra.path || '',
    mcVersion: item.mcVersion || extra.mcVersion || '',
    loader: item.loader || extra.loader || '',
    installedAt: new Date().toISOString()
  };
  data[type] = data[type].filter(x => !sameEntry(x, entry));
  data[type].unshift(entry);
  await write(rootDir, data);
  return entry;
}

async function list(rootDir, type) {
  if (!rootDir) return [];
  const data = await read(rootDir);
  return Array.isArray(data[type]) ? data[type] : [];
}

async function remove(rootDir, type, fileName) {
  const data = await read(rootDir);
  data[type] = (data[type] || []).filter(x => String(x.fileName || '') !== String(fileName || ''));
  await write(rootDir, data);
}

function isInstalled(installed, item = {}) {
  return (installed || []).some(x => {
    if (x.source && item.source && String(x.source) === String(item.source) && x.id && item.id && String(x.id) === String(item.id)) return true;
    if (x.slug && item.slug && String(x.slug) === String(item.slug)) return true;
    if (x.title && item.title && String(x.title).trim().toLowerCase() === String(item.title).trim().toLowerCase()) return true;
    return false;
  });
}

module.exports = { read, write, add, list, remove, isInstalled };
