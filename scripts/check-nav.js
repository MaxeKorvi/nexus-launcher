const { app, BrowserWindow } = require('electron');
const path = require('path');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('no-sandbox');
app.whenReady().then(async () => {
  try {
    require('../src/main/ipc-handlers');
  } catch (e) {
    console.error('IPC error:', e.message);
  }
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../src/main/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  await win.loadFile(path.join(__dirname, '../src/renderer/index.html'));
  await new Promise(r => setTimeout(r, 2000));
  const res = await win.webContents.executeJavaScript(`
    ({
      display: window.getComputedStyle(document.getElementById('nav-skins')).display,
      classList: Array.from(document.getElementById('nav-skins').classList),
      inlineStyle: document.getElementById('nav-skins').getAttribute('style'),
      accounts: window.Store ? window.Store.get('accounts') : null,
      settings: window.Store ? window.Store.get('settings') : null
    })
  `);
  console.log('RESULT:', JSON.stringify(res, null, 2));
  app.quit();
  process.exit(0);
});
