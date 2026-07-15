'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const Settings = require('./settings');

function cleanKey(value) {
  return String(value || '').trim().replace(/^['"]+|['"]+$/g, '');
}

function parseEnvFile(content) {
  const out = {};
  for (const line of String(content || '').split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = cleanKey(m[2]);
  }
  return out;
}

function candidateEnvFiles() {
  const files = [];
  try { files.push(path.join(process.cwd(), '.env')); } catch {}
  try { files.push(path.join(app.getPath('userData'), '.env')); } catch {}
  try { files.push(path.join(app.getPath('home'), '.config', 'nexus-launcher', '.env')); } catch {}
  return Array.from(new Set(files.filter(Boolean)));
}

function getCurseForgeApiKey() {
  // First read .env literally. This is important because CurseForge keys may
  // contain "$"; if a shell sourced the file, the value can be corrupted.
  for (const file of candidateEnvFiles()) {
    try {
      if (!fs.existsSync(file)) continue;
      const parsed = parseEnvFile(fs.readFileSync(file, 'utf8'));
      const key = cleanKey(parsed.CF_API_KEY);
      if (key) return key;
    } catch {}
  }

  const directEnv = cleanKey(process.env.CF_API_KEY);
  if (directEnv) return directEnv;

  try {
    const s = Settings.getAll();
    const fromSettings = cleanKey(s && (s.curseForgeApiKey || (s.apiKeys && s.apiKeys.curseforge)));
    if (fromSettings) return fromSettings;
  } catch {}

  return '';
}

function maskKey(value) {
  const key = cleanKey(value);
  if (!key) return '(empty)';
  if (key.length <= 8) return '*'.repeat(key.length);
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function curseForgeErrorMessage(err) {
  const status = err && err.response && err.response.status;
  if (status === 401 || status === 403) {
    return 'CurseForge отклонил API ключ (HTTP ' + status + '). Проверьте, что ключ действителен, без лишних кавычек и подхватывается лаунчером. Можно положить его в launcher-source/.env строкой CF_API_KEY=ваш_ключ';
  }
  if (status === 429) return 'CurseForge временно ограничил запросы (HTTP 429). Подождите немного и попробуйте снова.';
  return (err && err.message) || 'Ошибка запроса к CurseForge.';
}

module.exports = { getCurseForgeApiKey, maskKey, curseForgeErrorMessage };
