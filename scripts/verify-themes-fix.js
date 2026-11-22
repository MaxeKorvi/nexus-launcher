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
        webPreferences: {
            preload: path.join(__dirname, '../src/main/preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    await win.loadFile(path.join(__dirname, '../src/renderer/index.html'));
    await new Promise(r => setTimeout(r, 2000));

    // Test 1: Open themes view
    const test1 = await win.webContents.executeJavaScript(`
        (async function() {
            window.App.navigate('themes');
            await new Promise(r => setTimeout(r, 600));
            // Switch to bg tab
            const bgTab = document.querySelector('.st-tab-btn[data-tab="bg"]');
            if (bgTab) bgTab.click();
            await new Promise(r => setTimeout(r, 400));

            // Click desert background card
            const desertCard = document.querySelector('[data-bg-img*="desert"]');
            if (!desertCard) return { ok: false, msg: 'Desert card not found' };
            desertCard.click();
            await new Promise(r => setTimeout(r, 500));

            const accent = document.documentElement.style.getPropertyValue('--accent').trim();
            const toasts = document.querySelectorAll('.toast');

            return {
                ok: true,
                accent,
                toastCount: toasts.length
            };
        })()
    `);

    console.log('[Test 1: Select Desert Background]:', test1);

    // Test 2: Custom Accent Color Swatch Click
    const test2 = await win.webContents.executeJavaScript(`
        (async function() {
            // Click Cyan swatch (#06B6D4)
            const cyanSwatch = document.querySelector('[data-color="#06b6d4"]');
            if (!cyanSwatch) return { ok: false, msg: 'Cyan swatch not found' };
            cyanSwatch.click();
            await new Promise(r => setTimeout(r, 500));

            const accent = document.documentElement.style.getPropertyValue('--accent').trim();
            const toasts = document.querySelectorAll('.toast');

            return {
                ok: true,
                accent,
                toastCount: toasts.length
            };
        })()
    `);

    console.log('[Test 2: Select Custom Cyan Swatch]:', test2);

    // Test 3: Check border-radius values in DOM
    const test3 = await win.webContents.executeJavaScript(`
        (function() {
            const navItem = document.querySelector('.nav-item');
            const playBtn = document.querySelector('#btn-play');
            const singleCard = document.querySelector('.settings-single-card');
            const swatch = document.querySelector('.tm-swatch-circle');

            return {
                navItemRadius: navItem ? getComputedStyle(navItem).borderRadius : null,
                playBtnRadius: playBtn ? getComputedStyle(playBtn).borderRadius : null,
                singleCardRadius: singleCard ? getComputedStyle(singleCard).borderRadius : null,
                swatchRadius: swatch ? getComputedStyle(swatch).borderRadius : null
            };
        })()
    `);

    console.log('[Test 3: Border Radius Values]:', test3);

    app.quit();
    process.exit(0);
});
