'use strict';
const $ = id => document.getElementById(id);
let installedExe = '';
window.addEventListener('DOMContentLoaded', async () => {
  $('target').value = await window.installer.defaultDir();
  $('min').onclick = () => window.installer.minimize();
  $('close').onclick = $('cancel').onclick = () => window.installer.close();
  $('browse').onclick = async () => { const value = await window.installer.chooseDir(); if (value) $('target').value = value; };
  window.installer.onProgress(({ percent, text }) => {
    $('progress-wrap').classList.remove('hidden'); $('progress-bar').style.width = `${percent}%`; $('progress-value').textContent = `${percent}%`; $('progress-text').textContent = text;
  });
  $('install').onclick = async () => {
    if (installedExe) return window.installer.launch(installedExe);
    $('install').disabled = true; $('error').classList.add('hidden'); $('progress-wrap').classList.remove('hidden');
    try {
      const result = await window.installer.install({ target: $('target').value, desktopShortcut: $('desktop').checked });
      installedExe = result.exe; $('install').disabled = false; $('install').querySelector('span').textContent = 'ЗАПУСТИТЬ'; document.querySelectorAll('.step').forEach(x => x.classList.add('active'));
    } catch (error) {
      $('install').disabled = false; $('error').textContent = error.message || String(error); $('error').classList.remove('hidden');
    }
  };
});
