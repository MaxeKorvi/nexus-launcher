'use strict';

process.noAsar = true;

const path = require('path');
const fs = require('fs');
const builder = require('electron-builder');
const { ensureZstdPrebuild } = require('./ensure-zstd-prebuild');

async function buildWin() {
  console.log('[Build Win] Packaging Windows x64...');
  ensureZstdPrebuild('win32');
  try {
    const result = await builder.build({
      targets: builder.Platform.WINDOWS.createTarget(['portable', 'nsis']),
      config: {
        appId: 'app.nexus.launcher',
        productName: 'Nexus Launcher',
        directories: { output: 'dist' },
        files: ['src/**/*', 'package.json'],
        extraResources: ['build/installer-assets/**'],
        win: {
          target: ['portable', 'nsis'],
          icon: 'src/renderer/assets/nexus-logo.png'
        },
        portable: {
          artifactName: 'Nexus-Launcher-${version}.exe'
        },
        nsis: {
          oneClick: false,
          perMachine: false,
          allowToChangeInstallationDirectory: true,
          installerIcon: 'build/installer-assets/installer.ico',
          uninstallerIcon: 'build/installer-assets/installer.ico',
          installerHeader: 'build/installer-assets/installer-header.bmp',
          installerSidebar: 'build/installer-assets/installer-sidebar.bmp',
          uninstallerSidebar: 'build/installer-assets/installer-sidebar.bmp',
          license: 'LICENSE.txt',
          createDesktopShortcut: true,
          createStartMenuShortcut: true,
          shortcutName: 'Nexus Launcher',
          include: 'build/installer.nsh',
          language: '1049',
          unicode: true,
          warningsAsErrors: false,
          runAfterFinish: true,
          installerLanguages: ['ru_RU', 'en_US'],
          deleteAppDataOnUninstall: false,
          artifactName: 'Nexus-Launcher-Setup-${version}.exe'
        }
      }
    });

    console.log('[Build Win] Success! Artifacts:');
    result.forEach(f => console.log(' -', f));
  } finally {
    ensureZstdPrebuild(process.platform === 'win32' ? 'win32' : 'linux');
  }
}

buildWin().catch(err => {
  console.error('[Build Win Error]', err);
  process.exit(1);
});
