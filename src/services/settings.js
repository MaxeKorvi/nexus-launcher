'use strict';

/**
 * Settings Repository (spec §3.7 — 14 sections)
 *  - Java: path, version, min/max heap, JVM args
 *  - Memory
 *  - JVM args
 *  - Resolution + fullscreen
 *  - FPS limit
 *  - Theme (dark AMOLED default)
 *  - Language (ru/en)
 *  - Proxy
 *  - Game folder
 *  - Auto-updates
 *  - Clear cache
 *  - Logs / debug
 *  - Experimental
 *  - About (version, license GPL-3)
 */

const Store = require('electron-store');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const { app, shell } = require('electron');

const store = new Store({ name: 'settings' });

const DEFAULTS = {
  java: {
    path: null,         // null = auto-detect
    version: 17,
    minHeap: 512,
    maxHeap: 4096,
    jvmArgs: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
    jvmPreset: 'g1gc'   // default | g1gc | zgc
  },
  resolution: { width: 1280, height: 720, fullscreen: false, auto: false },
  fps: { limit: 60, vsync: true },
  theme: 'amoled',      // amoled | light | system
  language: 'ru',       // ru | en
  proxy: { enabled: false, host: '', port: 8080, type: 'http' },
  gameFolder: path.join(app.getPath('home'), '.minecraft'),
  modpacksFolder: path.join(app.getPath('home'), '.minecraft', 'modpacks'),
  autoUpdates: true,
  verifyOnLaunch: true,
  downloadThreads: 8,
  networkTimeout: 30,
  downloadRetries: 5,
  animations: true,
  startWithSystem: false,
  minimizeToTray: true,
  telemetry: false,
  debugMode: false,
  curseForgeApiKey: '',
  skinSystem: 'tlskincape',
  experimental: { cuda: false, nito: false }
};

function deepMerge(base, patch) {
  const out = { ...base, ...(patch || {}) };
  for (const [key, value] of Object.entries(base)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = { ...value, ...((patch && patch[key]) || {}) };
    }
  }
  return out;
}

function getAll() {
  const settings = deepMerge(DEFAULTS, store.store);
  // Телеметрия в этой сборке не отправляется: нет подключённого сервера сбора.
  // Даже если в старых настройках осталось true, интерфейс и backend считают её отключённой.
  settings.telemetry = false;
  return settings;
}

function set(key, val) {
  // Не даём старому renderer/API включить несуществующую отправку статистики.
  if (key === 'telemetry') {
    store.set(key, false);
    return true;
  }
  store.set(key, val);
  if (key === 'startWithSystem') {
    try { app.setLoginItemSettings({ openAtLogin: Boolean(val) }); } catch {}
  }
  return true;
}

function reset() {
  store.clear();
  return getAll();
}

async function clearCache() {
  const targets = [
    path.join(app.getPath('userData'), 'Cache'),
    path.join(app.getPath('userData'), 'Code Cache'),
    path.join(app.getPath('userData'), 'GPUCache'),
    path.join(getAll().gameFolder, 'assets', 'objects_temp')
  ];
  const cleared = [];
  for (const t of targets) {
    if (fs.existsSync(t)) {
      await fsp.rm(t, { recursive: true, force: true });
      cleared.push(t);
    }
  }
  try { require('./catalog').clearApiCache(); } catch {}
  return { ok: true, cleared };
}

async function openLogs() {
  const logPath = path.join(app.getPath('userData'), 'launcher.log');
  if (!fs.existsSync(logPath)) await fsp.writeFile(logPath, '');
  shell.openPath(logPath);
  return logPath;
}

async function getLogs() {
  const logPath = path.join(app.getPath('userData'), 'launcher.log');
  if (!fs.existsSync(logPath)) return '';
  const content = await fsp.readFile(logPath, 'utf8');
  return content.split('\n').slice(-500).join('\n');
}

module.exports = { getAll, set, reset, clearCache, openLogs, getLogs, DEFAULTS };
