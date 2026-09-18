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

  console.log('2. Copying updated src/ directory...');
  const srcSource = path.join(__dirname, 'src');
  const srcTarget = path.join(tempExtract, 'src');
  fs.cpSync(srcSource, srcTarget, { recursive: true, force: true });

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
