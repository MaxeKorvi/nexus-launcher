'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const isWayland = process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY;
if (isWayland) app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('disable-dev-shm-usage');

app.whenReady().then(async () => {
    try {
        require('../src/main/ipc-handlers');
    } catch (e) {
        console.error('IPC init warning:', e.message);
    }
    
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        show: true,
        frame: false,
        backgroundColor: '#0a0d14',
        webPreferences: {
            preload: path.join(__dirname, '../src/main/preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    await win.loadFile(path.join(__dirname, '../src/renderer/index.html'));
    
    // Wait for initial load and splash/animations to finish
    await new Promise(r => setTimeout(r, 2500));

    const outDir = path.join(__dirname, '../скрины');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const views = [
        { id: 'home', name: '01_Главная_Home.png' },
        { id: 'library', name: '02_Библиотека_Library.png' },
        { id: 'modpacks', name: '03_Модпаки_Modpacks.png' },
        { id: 'mods', name: '04_Моды_Mods.png' },
        { id: 'versions', name: '05_Версии_Versions.png' },
        { id: 'instances', name: '06_Инстансы_Instances.png' },
        { id: 'resourcepacks', name: '07_Ресурспаки_Resourcepacks.png' },
        { id: 'shaders', name: '08_Шейдеры_Shaders.png' },
        { id: 'worlds', name: '09_Миры_Worlds.png' },
        { id: 'servers', name: '10_Серверы_Servers.png' },
        { id: 'radmin', name: '10_Сетевая_игра_LAN.png' },
        { id: 'skins', name: '11_Скины_Skins.png' },
        { id: 'themes', name: '12_Темы_Themes.png' },
        { id: 'accounts', name: '13_Аккаунты_Accounts.png' },
        { id: 'settings', name: '14_Настройки_Settings.png' },
        { id: 'console', name: '15_Консоль_Console.png' },
        { id: 'downloads', name: '16_Загрузки_Downloads.png' },
        { id: 'about', name: '17_О_лаунчере_About.png' }
    ];

    for (const v of views) {
        process.stdout.write(`Capturing ${v.id}... `);
        await win.webContents.executeJavaScript(`
            (function() {
                try {
                    const tc = document.getElementById('toast-container');
                    if (tc) tc.innerHTML = '';
                    if (window.App && window.App.navigate) {
                        window.App.navigate('${v.id}');
                    } else if (window.Views && window.Views['${v.id}']) {
                        window.Views['${v.id}'].render();
                    }
                } catch (e) {
                    console.error(e);
                }
            })()
        `);
        // Wait for rendering
        await new Promise(r => setTimeout(r, 1000));
        await win.webContents.executeJavaScript(`
            (function() {
                const tc = document.getElementById('toast-container');
                if (tc) tc.innerHTML = '';
            })()
        `);
        const image = await win.webContents.capturePage();
        const filePath = path.join(outDir, v.name);
        fs.writeFileSync(filePath, image.toPNG());
        console.log(`Saved -> ${v.name}`);
    }

    console.log('ALL_SCREENSHOTS_DONE');
    setTimeout(() => {
        app.quit();
        process.exit(0);
    }, 500);
});
