'use strict';

const { app, BrowserWindow, ipcMain, shell, session, nativeTheme, Menu, Tray, clipboard, dialog, screen } = require('electron');
const path = require('path');
const url = require('url');

const fs = require('fs');
const settings = require('../services/settings');

// Detect session type: Wayland vs X11
const isWayland = process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY;
const isFlatpak = !!process.env.FLATPAK_ID;

// Let Chromium select native Wayland or XWayland based on compositor support.
// Forcing unsupported Wayland protocols causes noisy zcr_* and wl_shm warnings.
if (isWayland) app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
// Keep hardware acceleration enabled without bypassing Chromium's driver safety list.
app.commandLine.appendSwitch('enable-gpu-rasterization');
// Smooth scrolling
app.commandLine.appendSwitch('smooth-scrolling');

// Disable menu bar by default
Menu.setApplicationMenu(null);

let mainWindow = null;
let tray = null;
let manualMaximized = false;
let restoreBounds = null;
app.isQuitting = false;

function getLauncherIconPath() {
  const assetIcon = path.join(__dirname, '..', 'renderer', 'assets', 'icon.png');
  const rootIcon = path.join(__dirname, '..', '..', 'icon.png');
  try {
    if (fs.existsSync(rootIcon) && !fs.existsSync(assetIcon)) {
      fs.copyFileSync(rootIcon, assetIcon);
    }
  } catch {}
  if (fs.existsSync(assetIcon)) return assetIcon;
  if (fs.existsSync(rootIcon)) return rootIcon;
  return path.join(__dirname, '..', 'renderer', 'assets', 'nexus-logo.png');
}

function ensureTray() {
  if (tray) return tray;
  const iconPath = getLauncherIconPath();
  tray = new Tray(iconPath);
  tray.setToolTip('Nexus Launcher');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Открыть Nexus Launcher', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    { label: 'Выход', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
  tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); if (mainWindow.isMinimized()) mainWindow.restore(); } });
  tray.on('click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); if (mainWindow.isMinimized()) mainWindow.restore(); } });
  return tray;
}

function createMainWindow() {
  const { width: screenW, height: screenH } = require('electron').screen.getPrimaryDisplay().workAreaSize;
  const w = Math.min(1500, Math.max(1080, Math.floor(screenW * 0.78)));
  const h = Math.min(940, Math.max(680, Math.floor(screenH * 0.86)));

  const appIcon = getLauncherIconPath();

  // Read theme settings for dynamic splash screen color
  let themeAccent = '#00e676';
  try {
    const s = settings.get();
    const THEME_ACCENTS = {
      emerald: '#00e676',
      amethyst: '#a855f7',
      sunset: '#f97316',
      ice: '#38bdf8',
      cosmos: '#6366f1',
      minimal: '#10b981',
      amoled: '#00e676',
      neon: '#00e5ff',
      dracula: '#bd93f9',
      nord: '#88c0d0',
      cyberpunk: '#fcee0a',
      crimson: '#ff3366',
      amber: '#ffb300'
    };
    const customAccent = s.customAccentColor || (s.customTheme && s.customTheme.accent);
    themeAccent = customAccent || THEME_ACCENTS[s.theme] || '#00e676';
  } catch {}

  const splashStartTime = Date.now();
  let splashWindow = new BrowserWindow({
    width: 440,
    height: 270,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    icon: appIcon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, '..', 'renderer', 'splash.html'), {
    query: {
      accent: themeAccent,
      version: app.getVersion() || '2026.1.2'
    }
  });
  splashWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.show();
  });

  mainWindow = new BrowserWindow({
    width: w,
    height: h,
    minWidth: 1000,
    minHeight: 640,
    title: 'Nexus Launcher',
    backgroundColor: '#000000',
    frame: false,               // Custom window frame for AMOLED look
    transparent: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    show: false,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false
    }
  });

  // Dev tools in dev mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.loadURL(
    process.env.VITE_DEV_SERVER_URL ||
    url.format({
      pathname: path.join(__dirname, '..', 'renderer', 'index.html'),
      protocol: 'file:',
      slashes: true
    })
  );

  mainWindow.once('ready-to-show', () => {
    const elapsed = Date.now() - splashStartTime;
    const minSplashDuration = 1600;
    const remaining = Math.max(0, minSplashDuration - elapsed);

    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.webContents.send('window:ready', { isWayland, isFlatpak });
      }
    }, remaining);
  });

  // Open external links in browser (e.g. Minecraft.net news)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('close', (event) => {
    try {
      const Settings = require('../services/settings');
      if (!app.isQuitting && Settings.getAll().minimizeToTray) {
        event.preventDefault();
        mainWindow.hide();
        ensureTray();
      }
    } catch {}
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[renderer gone]', details);
    if (!mainWindow || mainWindow.isDestroyed()) return;
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();
    }, 600);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// IPC: window controls (custom frame)
ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (manualMaximized || mainWindow.isMaximized()) {
    manualMaximized = false;
    if (restoreBounds) {
      mainWindow.setBounds(restoreBounds);
      restoreBounds = null;
    } else {
      mainWindow.unmaximize();
    }
    return;
  }

  restoreBounds = mainWindow.getBounds();
  mainWindow.maximize();

  // Some Wayland compositors do not honor maximize for frameless windows.
  // Fallback to workArea bounds so the custom frame still becomes full-size.
  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMaximized()) return;
    const area = screen.getDisplayMatching(mainWindow.getBounds()).workArea;
    const b = mainWindow.getBounds();
    const closeEnough = Math.abs(b.width - area.width) < 20 && Math.abs(b.height - area.height) < 20;
    if (!closeEnough) {
      manualMaximized = true;
      mainWindow.setBounds(area);
    }
  }, 120);
});
ipcMain.on('window:toggle-fullscreen', () => {
  if (!mainWindow) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
});
ipcMain.on('window:close', () => mainWindow && mainWindow.close());
ipcMain.handle('window:is-maximized', () => mainWindow ? mainWindow.isMaximized() : false);

// IPC: clipboard
ipcMain.handle('clipboard:write', (_e, text) => clipboard.writeText(String(text)));
ipcMain.handle('clipboard:read', () => clipboard.readText());

// IPC: shell open. Never let renderer open arbitrary custom protocols.
function isSafeExternalUrl(link) {
  try {
    const parsed = new URL(String(link));
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch { return false; }
}
ipcMain.handle('shell:open-external', (_e, link) => {
  if (!isSafeExternalUrl(link)) throw new Error('Blocked unsafe external URL');
  return shell.openExternal(link);
});
function isAllowedPath(resolved) {
  const home = app.getPath('home');
  const userData = app.getPath('userData');
  const nexusRoot = path.resolve(String(process.env.SystemDrive || 'C:') + path.sep, 'NexusLauncher');
  let gameFolder = '', modpacksFolder = '';
  try {
    const s = require('../services/settings').getAll();
    gameFolder = s.gameFolder ? path.resolve(s.gameFolder) : '';
    modpacksFolder = s.modpacksFolder ? path.resolve(s.modpacksFolder) : '';
  } catch {}
  return [home, userData, nexusRoot, gameFolder, modpacksFolder]
    .filter(Boolean)
    .some(root => resolved === root || resolved.startsWith(root + path.sep));
}

ipcMain.handle('shell:open-path', (_e, p) => {
  const resolved = path.resolve(String(p));
  if (!isAllowedPath(resolved)) {
    throw new Error('Blocked unsafe path access');
  }
  return shell.openPath(resolved);
});
ipcMain.handle('shell:show-in-folder', (_e, p) => {
  const resolved = path.resolve(String(p));
  if (!isAllowedPath(resolved)) {
    throw new Error('Blocked unsafe path access');
  }
  return shell.showItemInFolder(resolved);
});

// IPC: dialog
ipcMain.handle('dialog:open-file', async (_e, opts) => {
  const r = await dialog.showOpenDialog(mainWindow, opts || {});
  return r.filePaths;
});
ipcMain.handle('dialog:save-file', async (_e, opts) => {
  const r = await dialog.showSaveDialog(mainWindow, opts || {});
  return r.filePath;
});

// Register all backend service handlers
require('./ipc-handlers');

// App lifecycle
app.whenReady().then(() => {
  // Force dark theme (AMOLED)
  nativeTheme.themeSource = 'dark';

  // Set security headers for renderer (allow only our origin)
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' data: blob: https:; img-src 'self' data: blob: https:; connect-src 'self' https:;"
        ]
      }
    });
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('before-quit', () => { app.isQuitting = true; });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Catch unhandled errors
process.on('uncaughtException', (err) => {
  console.error('[FATAL]', err);
});
