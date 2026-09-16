'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { spawn } = require('child_process');

let win;
const defaultDir = () => path.join(process.env.LOCALAPPDATA || app.getPath('home'), 'Programs', 'Nexus Launcher');
const psQuote = value => `'${String(value).replace(/'/g, "''")}'`;

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(stderr.trim() || `PowerShell завершился с кодом ${code}`)));
  });
}

async function install(target, desktopShortcut) {
  const destination = path.resolve(String(target || defaultDir()));
  const payload = app.isPackaged
    ? path.join(process.resourcesPath, 'payload', 'NexusLauncher.zip')
    : path.join(__dirname, 'payload', 'NexusLauncher.zip');
  if (!fs.existsSync(payload)) throw new Error('В установщике отсутствует архив приложения.');
  await fsp.mkdir(destination, { recursive: true });
  win.webContents.send('install:progress', { percent: 10, text: 'Подготовка каталога…' });
  await runPowerShell(`Expand-Archive -LiteralPath ${psQuote(payload)} -DestinationPath ${psQuote(destination)} -Force`);
  win.webContents.send('install:progress', { percent: 78, text: 'Создание ярлыков…' });
  const exe = path.join(destination, 'Nexus Launcher.exe');
  if (!fs.existsSync(exe)) throw new Error('После распаковки не найден Nexus Launcher.exe.');
  const startMenu = path.join(process.env.APPDATA || app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Nexus Launcher.lnk');
  const shortcuts = [startMenu];
  if (desktopShortcut) shortcuts.push(path.join(app.getPath('desktop'), 'Nexus Launcher.lnk'));
  for (const shortcut of shortcuts) {
    await fsp.mkdir(path.dirname(shortcut), { recursive: true });
    await runPowerShell(`$w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut(${psQuote(shortcut)}); $s.TargetPath=${psQuote(exe)}; $s.WorkingDirectory=${psQuote(destination)}; $s.IconLocation=${psQuote(exe)}; $s.Save()`);
  }
  await fsp.writeFile(path.join(destination, 'install-location.json'), JSON.stringify({ installedAt: new Date().toISOString(), version: '2026.1.1' }, null, 2));
  win.webContents.send('install:progress', { percent: 100, text: 'Nexus Launcher установлен' });
  return { ok: true, exe, destination };
}

function createWindow() {
  win = new BrowserWindow({
    width: 1120, height: 700, minWidth: 940, minHeight: 620,
    frame: false, backgroundColor: '#050505', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
ipcMain.handle('window:minimize', () => win.minimize());
ipcMain.handle('window:close', () => win.close());
ipcMain.handle('install:default-dir', () => defaultDir());
ipcMain.handle('install:choose-dir', async () => (await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], defaultPath: defaultDir() })).filePaths[0] || null);
ipcMain.handle('install:start', (_e, opts) => install(opts && opts.target, opts && opts.desktopShortcut));
ipcMain.handle('install:launch', async (_e, exe) => {
  const error = await shell.openPath(path.resolve(String(exe)));
  if (error) throw new Error(error);
  // The launcher is now an independent process; the installer has finished.
  setTimeout(() => app.quit(), 150);
  return true;
});
