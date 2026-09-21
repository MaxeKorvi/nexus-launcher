const asar = require('@electron/asar');
const path = require('path');
const fs = require('fs');

const installedAppDir = path.join(process.env.LOCALAPPDATA, 'Programs', 'Nexus Launcher', 'resources');
const installedAsar = path.join(installedAppDir, 'app.asar');
const tempExtract = path.join(process.env.TEMP, 'nexus-asar-extract-' + Date.now());

async function run() {
  console.log('Installed asar:', installedAsar);
  if (!fs.existsSync(installedAsar)) {
    console.error('Installed app.asar not found!');
    return;
  }

  console.log('1. Extracting app.asar to', tempExtract);
  asar.extractAll(installedAsar, tempExtract);

  // Sync generated dark app icon into assets and root
  const genIcon = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\939879cb-dc8c-44b4-88df-a40b23c307e1\\nexus_app_icon_1789973535613.jpg';
  const rootIcon = path.join(__dirname, 'icon.png');
  const targetAssetIcon = path.join(__dirname, 'src', 'renderer', 'assets', 'icon.png');
  const installerAssetIcon = path.join(__dirname, 'installer-ui', 'assets', 'icon.png');
  if (fs.existsSync(genIcon)) {
    try {
      fs.copyFileSync(genIcon, rootIcon);
      fs.copyFileSync(genIcon, targetAssetIcon);
      fs.copyFileSync(genIcon, installerAssetIcon);
      console.log('Synced new dark nexus app icon to root, assets, and installer-ui');
    } catch (e) {
      console.warn('Failed to sync new app icon:', e.message);
    }
  }

  // Sync 8 custom wallpapers from 'фоны' folder into assets/backgrounds
  const fonyDir = path.join(__dirname, 'фоны');
  const targetBgDir = path.join(__dirname, 'src', 'renderer', 'assets', 'backgrounds');
  fs.mkdirSync(targetBgDir, { recursive: true });

  const wallpaperMap = [
    { src: 'ChatGPT Image 21 сент. 2026 г., 10_19_43 (1).png', dst: 'bg-valley.png' },
    { src: 'ChatGPT Image 21 сент. 2026 г., 10_19_44 (2).png', dst: 'bg-sakura.png' },
    { src: 'ChatGPT Image 21 сент. 2026 г., 10_19_44 (3).png', dst: 'bg-forge.png' },
    { src: 'ChatGPT Image 21 сент. 2026 г., 10_19_44 (4).png', dst: 'bg-aurora.png' },
    { src: 'ChatGPT Image 21 сент. 2026 г., 10_19_45 (5).png', dst: 'bg-end.png' },
    { src: 'ChatGPT Image 21 сент. 2026 г., 10_19_45 (6).png', dst: 'bg-desert.png' },
    { src: 'ChatGPT Image 21 сент. 2026 г., 10_19_45 (7).png', dst: 'bg-bastion.png' },
    { src: 'ChatGPT Image 21 сент. 2026 г., 10_19_45 (8).png', dst: 'bg-skylands.png' }
  ];

  if (fs.existsSync(fonyDir)) {
    for (const item of wallpaperMap) {
      const srcPath = path.join(fonyDir, item.src);
      const dstPath = path.join(targetBgDir, item.dst);
      if (fs.existsSync(srcPath)) {
        try {
          fs.copyFileSync(srcPath, dstPath);
          console.log(`Synced wallpaper ${item.dst}`);
        } catch (e) {
          console.warn(`Failed to copy ${item.src}:`, e.message);
        }
      }
    }

    // Also update hero panorama with valley
    const valleyPath = path.join(targetBgDir, 'bg-valley.png');
    const targetPanorama = path.join(__dirname, 'src', 'renderer', 'assets', 'minecraft-hero-panorama.jpg');
    if (fs.existsSync(valleyPath)) {
      try { fs.copyFileSync(valleyPath, targetPanorama); } catch {}
    }
  }

  console.log('2. Copying updated src/ directory and root icon...');
  const srcSource = path.join(__dirname, 'src');
  const srcTarget = path.join(tempExtract, 'src');
  fs.cpSync(srcSource, srcTarget, { recursive: true, force: true });
  if (fs.existsSync(rootIcon)) {
    try { fs.copyFileSync(rootIcon, path.join(tempExtract, 'icon.png')); } catch {}
  }

  console.log('3. Repacking app.asar...');
  // Kill running Nexus Launcher if running so file is not locked
  try {
    const { execSync } = require('child_process');
    try { execSync('taskkill /f /im "Nexus Launcher.exe"', { stdio: 'ignore' }); } catch {}
    try { execSync('taskkill /f /im "javaw.exe"', { stdio: 'ignore' }); } catch {}
  } catch {}

  await asar.createPackageWithOptions(tempExtract, installedAsar, {
    unpack: '{**/*.node,**/node_modules/keytar/**/*,**/node_modules/jszip/**/*}'
  });

  const distAsar = path.join(__dirname, 'dist', 'win-unpacked', 'resources', 'app.asar');
  if (fs.existsSync(path.dirname(distAsar))) {
    try { fs.copyFileSync(installedAsar, distAsar); } catch {}
  }

  try { fs.rmSync(tempExtract, { recursive: true, force: true }); } catch {}
  console.log('ALL DONE! app.asar successfully updated with latest fixes.');
}

run().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
