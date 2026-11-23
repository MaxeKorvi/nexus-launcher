'use strict';

process.noAsar = true;

const path = require('path');
const fs = require('fs');
const builder = require('electron-builder');

async function buildWin() {
  console.log('[Build Win] Packaging Windows x64...');
  const result = await builder.build({
    targets: builder.Platform.WINDOWS.createTarget(['portable', 'nsis']),
    config: {
      appId: 'app.nexus.launcher',
      productName: 'Nexus Launcher',
      directories: { output: 'dist' },
      files: ['src/**/*', 'package.json'],
      win: {
        target: ['portable', 'nsis'],
        icon: 'src/renderer/assets/nexus-logo.png'
      },
      portable: {
        artifactName: 'Nexus-Launcher-${version}.exe'
      },
      nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        artifactName: 'Nexus-Launcher-Setup-${version}.exe'
      }
    }
  });

  console.log('[Build Win] Success! Artifacts:');
  result.forEach(f => console.log(' -', f));
}

buildWin().catch(err => {
  console.error('[Build Win Error]', err);
  process.exit(1);
});
