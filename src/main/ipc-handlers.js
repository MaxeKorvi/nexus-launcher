'use strict';

/**
 * Central IPC handler registration.
 * Each backend service registers its own channels here.
 * This keeps the main.js clean and the architecture modular (Repository pattern, per spec §6.2).
 */

const { ipcMain } = require('electron');

// ─── Accounts service (Microsoft OAuth, Ely.by, Local) ───────
const Accounts = require('../services/accounts');
ipcMain.handle('accounts:list', () => Accounts.list());
ipcMain.handle('accounts:add', (_e, data) => Accounts.add(data));
ipcMain.handle('accounts:remove', (_e, id) => Accounts.remove(id));
ipcMain.handle('accounts:set-active', (_e, id) => Accounts.setActive(id));
ipcMain.handle('accounts:start-ms-oauth', () => Accounts.startMicrosoftOAuth());
ipcMain.handle('accounts:start-ely-oauth', () => Accounts.startElyOAuth());
ipcMain.handle('accounts:get-profile', (_e, id) => Accounts.getProfile(id));
ipcMain.handle('accounts:storage-info', () => Accounts.getStorageInfo());

// ─── Versions service (Mojang version manifest, Forge/Fabric/Quilt/LiteLoader) ─
const Versions = require('../services/versions');
ipcMain.handle('versions:list', (_e, filters) => Versions.list(filters));
ipcMain.handle('versions:get-installed', () => Versions.getInstalled());
ipcMain.handle('versions:install', (_e, payload) => {
  if (payload && typeof payload === 'object') return Versions.install(payload.versionId, payload);
  return Versions.install(payload);
});
ipcMain.handle('versions:repair', (_e, payload) => {
  if (payload && typeof payload === 'object') return Versions.repair(payload.versionId, payload);
  return Versions.repair(payload);
});
ipcMain.handle('versions:remove', (_e, versionId, rootDir) => Versions.remove(versionId, rootDir));
ipcMain.handle('versions:get-loaders', (_e, mcVersion) => Versions.getLoaders(mcVersion));
ipcMain.handle('versions:get-loader-availability', (_e, payload) => Versions.getLoaderAvailability(payload && payload.loader, payload && payload.mcVersions));
ipcMain.handle('versions:get-storage-paths', (_e, versionId) => Versions.getStoragePaths(versionId));

// ─── Mods service (Modrinth + CurseForge) ──────────────────────────────────────
const Mods = require('../services/mods');
ipcMain.handle('mods:search', (_e, q) => Mods.search(q));
ipcMain.handle('mods:get-by-id', (_e, id, source) => Mods.getById(id, source));
ipcMain.handle('mods:install', (_e, mod) => Mods.install(mod));
ipcMain.handle('mods:remove', (_e, mod) => Mods.remove(mod));
ipcMain.handle('mods:list-installed', (_e, rootDir) => Mods.listInstalled(rootDir));

// ─── Modpacks service (CurseForge, Modrinth, FTB, ATLauncher, local import/export) ─
const Modpacks = require('../services/modpacks');
ipcMain.handle('modpacks:search', (_e, q) => Modpacks.search(q));
ipcMain.handle('modpacks:get-details', (_e, pack) => Modpacks.getDetails(pack));
ipcMain.handle('modpacks:list-local', () => Modpacks.listLocal());
ipcMain.handle('modpacks:install', (_e, pack) => Modpacks.install(pack));
ipcMain.handle('modpacks:import-zip', (_e, zipPath) => Modpacks.importZip(zipPath));
ipcMain.handle('modpacks:export', (_e, name) => Modpacks.exportPack(name));

// ─── Shaders & Resource Packs ─────────────────────────────────────────────────
const Shaders = require('../services/shaders');
ipcMain.handle('shaders:list', (_e, q) => Shaders.list(q));
ipcMain.handle('shaders:install', (_e, sh) => Shaders.install(sh));
ipcMain.handle('shaders:list-installed', (_e, rootDir) => Shaders.listInstalled(rootDir));

const ResourcePacks = require('../services/resourcepacks');
ipcMain.handle('resourcepacks:list', (_e, q) => ResourcePacks.list(q));
ipcMain.handle('resourcepacks:install', (_e, rp) => ResourcePacks.install(rp));
ipcMain.handle('resourcepacks:list-installed', (_e, rootDir) => ResourcePacks.listInstalled(rootDir));

const Maps = require('../services/maps');
ipcMain.handle('maps:list', (_e, q) => Maps.list(q));
ipcMain.handle('maps:install', (_e, map) => Maps.install(map));
ipcMain.handle('maps:list-installed', (_e, rootDir) => Maps.listInstalled(rootDir));

// ─── Java manager (auto-download Azul/AdoptOpenJDK 8/17/21/24) ─────────────────
const Java = require('../services/java');
ipcMain.handle('java:list-installed', () => Java.listInstalled());
ipcMain.handle('java:download', (_e, version) => Java.download(version));
ipcMain.handle('java:detect', () => Java.detectSystem());
ipcMain.handle('java:pick-path', () => Java.pickPath());

// ─── Downloads (pause/resume, speed, ETA) ─────────────────────────────────────
const Downloads = require('../services/downloads');
ipcMain.handle('downloads:start', (_e, item) => Downloads.start(item));
ipcMain.handle('downloads:pause', (_e, id) => Downloads.pause(id));
ipcMain.handle('downloads:resume', (_e, id) => Downloads.resume(id));
ipcMain.handle('downloads:cancel', (_e, id) => Downloads.cancel(id));
ipcMain.handle('downloads:list', () => Downloads.list());
ipcMain.handle('downloads:clear-completed', () => Downloads.clearCompleted());
// events: downloads:progress, downloads:done, downloads:error  → sent from service

// ─── News (Minecraft.net RSS) ─────────────────────────────────────────────────
const News = require('../services/news');
ipcMain.handle('news:list', () => News.list());

// ─── Settings (15 sections per spec §3.7) ──────────────────────────────────────
const Settings = require('../services/settings');
ipcMain.handle('settings:get', () => Settings.getAll());
ipcMain.handle('settings:set', (_e, key, val) => Settings.set(key, val));
ipcMain.handle('settings:reset', () => Settings.reset());
ipcMain.handle('settings:clear-cache', () => Settings.clearCache());
ipcMain.handle('settings:open-logs', () => Settings.openLogs());
ipcMain.handle('settings:get-logs', () => Settings.getLogs());

// ─── Launch (start Minecraft with selected account/version) ───────────────────
const Launcher = require('../services/launcher');
ipcMain.handle('launch:start', (_e, opts) => Launcher.start(opts));
ipcMain.handle('launch:stop', () => Launcher.stop());
ipcMain.handle('launch:screenshot', () => Launcher.screenshot());

// Console output events: launcher:console → sent from service

console.log('[IPC] All service handlers registered.');
