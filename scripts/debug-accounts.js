const { app } = require('electron');
const path = require('path');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.whenReady().then(async () => {
  try {
    const Accounts = require('../src/services/accounts');
    const Settings = require('../src/services/settings');
    console.log('UserData:', app.getPath('userData'));
    console.log('Accounts:', await Accounts.list());
    console.log('Settings:', Settings.getAll ? Settings.getAll() : 'no getAll');
  } catch (e) {
    console.error('Error:', e);
  }
  app.quit();
  process.exit(0);
});
