'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// ─── Whitelist of allowed channels for safe IPC communication ──────────────
const ALLOWED_CHANNELS = {
  // Accounts
  'accounts:list': () => ipcRenderer.invoke('accounts:list'),
  'accounts:add': (data) => ipcRenderer.invoke('accounts:add', data),
  'accounts:remove': (id) => ipcRenderer.invoke('accounts:remove', id),
  'accounts:set-active': (id) => ipcRenderer.invoke('accounts:set-active', id),
  'accounts:start-ms-oauth': () => ipcRenderer.invoke('accounts:start-ms-oauth'),
  'accounts:start-ely-oauth': () => ipcRenderer.invoke('accounts:start-ely-oauth'),
  'accounts:get-profile': (id) => ipcRenderer.invoke('accounts:get-profile', id),
  'accounts:change-skin': (payload) => ipcRenderer.invoke('accounts:change-skin', payload),
  'accounts:storage-info': () => ipcRenderer.invoke('accounts:storage-info'),
  'accounts:get-skin-base64': (url) => ipcRenderer.invoke('accounts:get-skin-base64', url),

  // Versions
  'versions:list': (filters) => ipcRenderer.invoke('versions:list', filters),
  'versions:get-installed': () => ipcRenderer.invoke('versions:get-installed'),
  'versions:install': (payload) => ipcRenderer.invoke('versions:install', payload),
  'versions:cancel': (versionId) => ipcRenderer.invoke('versions:cancel', versionId),
  'versions:repair': (payload) => ipcRenderer.invoke('versions:repair', payload),
  'versions:remove': (versionId, rootDir) => ipcRenderer.invoke('versions:remove', versionId, rootDir),
  'versions:get-loaders': (mcVersion) => ipcRenderer.invoke('versions:get-loaders', mcVersion),
  'versions:get-loader-availability': (payload) => ipcRenderer.invoke('versions:get-loader-availability', payload),
  'versions:get-storage-paths': (versionId) => ipcRenderer.invoke('versions:get-storage-paths', versionId),

  // Mods
  'mods:search': (q) => ipcRenderer.invoke('mods:search', q),
  'mods:get-by-id': (id, source) => ipcRenderer.invoke('mods:get-by-id', id, source),
  'mods:install': (mod) => ipcRenderer.invoke('mods:install', mod),
  'mods:remove': (mod) => ipcRenderer.invoke('mods:remove', mod),
  'mods:toggle': (mod) => ipcRenderer.invoke('mods:toggle', mod),
  'mods:list-installed': (rootDir) => ipcRenderer.invoke('mods:list-installed', rootDir),

  // Modpacks
  'modpacks:search': (q) => ipcRenderer.invoke('modpacks:search', q),
  'modpacks:get-details': (pack) => ipcRenderer.invoke('modpacks:get-details', pack),
  'modpacks:list-local': () => ipcRenderer.invoke('modpacks:list-local'),
  'modpacks:install': (pack) => ipcRenderer.invoke('modpacks:install', pack),
  'modpacks:import-zip': (zipPath) => ipcRenderer.invoke('modpacks:import-zip', zipPath),
  'modpacks:export': (name) => ipcRenderer.invoke('modpacks:export', name),

  // Shaders
  'shaders:list': (q) => ipcRenderer.invoke('shaders:list', q),
  'shaders:install': (sh) => ipcRenderer.invoke('shaders:install', sh),
  'shaders:list-installed': (rootDir) => ipcRenderer.invoke('shaders:list-installed', rootDir),

  // Resource Packs
  'resourcepacks:list': (q) => ipcRenderer.invoke('resourcepacks:list', q),
  'resourcepacks:install': (rp) => ipcRenderer.invoke('resourcepacks:install', rp),
  'resourcepacks:list-installed': (rootDir) => ipcRenderer.invoke('resourcepacks:list-installed', rootDir),

  // Maps
  'maps:list': (q) => ipcRenderer.invoke('maps:list', q),
  'maps:install': (map) => ipcRenderer.invoke('maps:install', map),
  'maps:list-installed': (rootDir) => ipcRenderer.invoke('maps:list-installed', rootDir),

  // Java
  'java:list-installed': () => ipcRenderer.invoke('java:list-installed'),
  'java:download': (version) => ipcRenderer.invoke('java:download', version),
  'java:detect': () => ipcRenderer.invoke('java:detect'),
  'java:pick-path': () => ipcRenderer.invoke('java:pick-path'),

  // Downloads
  'downloads:start': (item) => ipcRenderer.invoke('downloads:start', item),
  'downloads:pause': (id) => ipcRenderer.invoke('downloads:pause', id),
  'downloads:resume': (id) => ipcRenderer.invoke('downloads:resume', id),
  'downloads:cancel': (id) => ipcRenderer.invoke('downloads:cancel', id),
  'downloads:list': () => ipcRenderer.invoke('downloads:list'),
  'downloads:clear-completed': () => ipcRenderer.invoke('downloads:clear-completed'),

  // News
  'news:list': () => ipcRenderer.invoke('news:list'),

  // Settings
  'settings:get': () => ipcRenderer.invoke('settings:get'),
  'settings:set': (key, val) => ipcRenderer.invoke('settings:set', key, val),
  'settings:update': (patch) => ipcRenderer.invoke('settings:update', patch),
  'settings:reset': () => ipcRenderer.invoke('settings:reset'),
  'settings:clear-cache': () => ipcRenderer.invoke('settings:clear-cache'),
  'settings:open-logs': () => ipcRenderer.invoke('settings:open-logs'),
  'settings:get-logs': () => ipcRenderer.invoke('settings:get-logs'),

  // Launch
  'launch:start': (opts) => ipcRenderer.invoke('launch:start', opts),
  'launch:stop': () => ipcRenderer.invoke('launch:stop'),
  'launch:screenshot': () => ipcRenderer.invoke('launch:screenshot'),

  // System info
  'system:get-info': () => ipcRenderer.invoke('system:get-info'),
  'downloads:cancel-all': () => ipcRenderer.invoke('downloads:cancel-all'),

  // Instances
  'instances:list': () => ipcRenderer.invoke('instances:list'),
  'instances:get': (id) => ipcRenderer.invoke('instances:get', id),
  'instances:create': (data) => ipcRenderer.invoke('instances:create', data),
  'instances:remove': (id) => ipcRenderer.invoke('instances:remove', id),
  'instances:duplicate': (id, newName) => ipcRenderer.invoke('instances:duplicate', id, newName),
  'instances:open-folder': (id) => ipcRenderer.invoke('instances:open-folder', id),

  // Worlds
  'worlds:list': (rootDir) => ipcRenderer.invoke('worlds:list', rootDir),
  'worlds:backup': (worldName, rootDir, note) => ipcRenderer.invoke('worlds:backup', worldName, rootDir, note),
  'worlds:list-backups': (rootDir) => ipcRenderer.invoke('worlds:list-backups', rootDir),
  'worlds:restore': (backupFile, rootDir, targetName) => ipcRenderer.invoke('worlds:restore', backupFile, rootDir, targetName),
  'worlds:delete-backup': (backupFile, rootDir) => ipcRenderer.invoke('worlds:delete-backup', backupFile, rootDir),
  'worlds:import': (data) => ipcRenderer.invoke('worlds:import', data),

  // Servers
  'servers:list': () => ipcRenderer.invoke('servers:list'),
  'servers:add': (data) => ipcRenderer.invoke('servers:add', data),
  'servers:remove': (id) => ipcRenderer.invoke('servers:remove', id),
  'servers:ping': (address) => ipcRenderer.invoke('servers:ping', address)
};

async function invokeBackend(channel, ...payload) {
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_CHANNELS, channel)) {
    throw new Error(`Blocked unsafe IPC channel invocation: ${channel}`);
  }
  try {
    return await ALLOWED_CHANNELS[channel](...payload);
  } catch (err) {
    const raw = String((err && err.message) || err || 'Неизвестная ошибка');
    const message = raw
      .replace(/^Error invoking remote method '[^']+':\s*/i, '')
      .replace(/^Error:\s*/i, '')
      .trim();
    const clean = new Error(message || 'Операция не выполнена');
    clean.name = (err && err.name) || 'Error';
    throw clean;
  }
}

// Safe bridge between renderer (HTML/JS) and main process (Node.js backend)
contextBridge.exposeInMainWorld('api', {
  // Window controls
  win: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    toggleFullscreen: () => ipcRenderer.send('window:toggle-fullscreen'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onReady: (cb) => ipcRenderer.on('window:ready', (_e, info) => cb(info))
  },
  // Clipboard
  clipboard: {
    write: (t) => ipcRenderer.invoke('clipboard:write', t),
    read: () => ipcRenderer.invoke('clipboard:read')
  },
  // Shell
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
    openPath: (p) => ipcRenderer.invoke('shell:open-path', p),
    showInFolder: (p) => ipcRenderer.invoke('shell:show-in-folder', p)
  },
  // File dialogs
  dialog: {
    openFile: (opts) => ipcRenderer.invoke('dialog:open-file', opts),
    saveFile: (opts) => ipcRenderer.invoke('dialog:save-file', opts)
  },
  // Backend service whitelisted invocations
  invoke: (channel, ...payload) => invokeBackend(channel, ...payload),
  // Event subscriptions (downloads progress, console output, notifications)
  on: (channel, cb) => {
    const wrapped = (_e, ...args) => cb(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  }
});
