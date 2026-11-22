'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('enable-gpu-rasterization');

app.whenReady().then(async () => {
    try {
        require('../src/main/ipc-handlers');
    } catch (e) {
        console.error('IPC init:', e.message);
    }

    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false,
        frame: false,
        backgroundColor: '#0a0d14',
        webPreferences: {
            preload: path.join(__dirname, '../src/main/preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    await win.loadFile(path.join(__dirname, '../src/renderer/index.html'));
    await new Promise(r => setTimeout(r, 2000));

    await win.webContents.executeJavaScript(`
        window.App.navigate('themes');
        setTimeout(() => {
            const bgTab = document.querySelector('.st-tab-btn[data-tab="bg"]');
            if (bgTab) bgTab.click();
        }, 300);
    `);

    await new Promise(r => setTimeout(r, 1200));
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, '../скрины/12_Темы_Фон_и_атмосфера.png'), img.toPNG());
    console.log('BG tab captured successfully!');
    app.quit();
    process.exit(0);
});
