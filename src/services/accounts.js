'use strict';

/**
 * Accounts Repository
 *
 * Security model:
 *  - Microsoft accounts use the official OAuth device-code flow. The launcher
 *    never asks for, sees, or stores a password.
 *  - Tokens are stored in the OS keyring through keytar when available.
 *  - Fallback storage uses Electron safeStorage (libsecret/KWallet/OS crypto)
 *    or AES-256-GCM with a locally generated 256-bit key if safeStorage is not
 *    available. Plaintext tokens are never written to disk.
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const os = require('os');
const { app, shell, Notification, safeStorage, BrowserWindow } = require('electron');

const Store = require('electron-store');
const store = new Store({ name: 'accounts' });

let keytar;
try { keytar = require('keytar'); } catch { keytar = null; }

const KEYTAR_SERVICE = 'nexus-launcher';
const MS_CLIENT_ID = '00000000402b5328'; // public Minecraft launcher client id
const MS_SCOPE = 'XboxLive.signin offline_access';
const MS_TOKEN_URL = 'https://login.live.com/oauth20_token.srf';
const MS_DEVICE_URL = 'https://login.live.com/oauth20_connect.srf';
const MS_XBOX_URL = 'https://user.auth.xboxlive.com/user/authenticate';
const MS_XSTS_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize';
const MC_AUTH_URL = 'https://api.minecraftservices.com/authentication/login_with_xbox';
const MC_PROFILE_URL = 'https://api.minecraftservices.com/minecraft/profile';
const MC_ENTITLEMENTS_URL = 'https://api.minecraftservices.com/entitlements/mcstore';
const ELY_AUTH_URL = 'https://authserver.ely.by/auth';
const ELY_PROFILE_API = 'https://authserver.ely.by/api/users/profiles/minecraft';

const secureDir = () => path.join(app.getPath('userData'), 'secure');

function getAllAccounts() {
  return store.get('accounts', []);
}

function saveAllAccounts(list) {
  store.set('accounts', list);
}

function normaliseUuid(uuid) {
  if (!uuid) return null;
  const clean = String(uuid).replace(/-/g, '');
  if (clean.length !== 32) return uuid;
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}

function offlinePlayerUuid(nickname) {
  const md5 = crypto.createHash('md5').update('OfflinePlayer:' + nickname, 'utf8').digest();
  md5[6] = (md5[6] & 0x0f) | 0x30;
  md5[8] = (md5[8] & 0x3f) | 0x80;
  const hex = md5.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function validateNickname(nickname) {
  const value = String(nickname || '').trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(value)) {
    throw new Error('Ник должен содержать 3–16 символов: латиница, цифры и подчёркивание.');
  }
  return value;
}

function tokenAccountName(accountId, type) {
  return `${type}:${accountId}`;
}

async function ensureSecureDir() {
  await fsp.mkdir(secureDir(), { recursive: true, mode: 0o700 });
}

async function getFallbackMasterKey() {
  await ensureSecureDir();
  const keyPath = path.join(secureDir(), 'master.key');
  if (fs.existsSync(keyPath)) return fsp.readFile(keyPath);
  const key = crypto.randomBytes(32);
  await fsp.writeFile(keyPath, key, { mode: 0o600 });
  return key;
}

function legacyMachineKey() {
  return crypto.createHash('sha256').update(os.hostname() + os.userInfo().username).digest();
}

async function encryptTokenPayload(payload) {
  const raw = JSON.stringify(payload);
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    return Buffer.concat([
      Buffer.from('SS01'),
      safeStorage.encryptString(raw)
    ]);
  }

  const key = await getFallbackMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from('AG01'), iv, tag, enc]);
}

async function decryptTokenPayload(buf) {
  const magic = buf.subarray(0, 4).toString('utf8');
  if (magic === 'SS01' && safeStorage) {
    return JSON.parse(safeStorage.decryptString(buf.subarray(4)));
  }
  if (magic === 'AG01') {
    const key = await getFallbackMasterKey();
    const iv = buf.subarray(4, 16);
    const tag = buf.subarray(16, 32);
    const enc = buf.subarray(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8'));
  }

  // Backward compatibility with the previous fallback format: iv + tag + enc
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', legacyMachineKey(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8'));
}

async function saveToken(accountId, type, token) {
  const raw = JSON.stringify(token);
  if (keytar) {
    try {
      await keytar.setPassword(KEYTAR_SERVICE, tokenAccountName(accountId, type), raw);
      return;
    } catch (e) {
      console.warn('[accounts] keytar failed, falling back to encrypted file:', e.message);
    }
  }

  await ensureSecureDir();
  const file = path.join(secureDir(), `${type}_${accountId}.bin`);
  await fsp.writeFile(file, await encryptTokenPayload(token), { mode: 0o600 });
}

async function loadToken(accountId, type) {
  if (keytar) {
    try {
      const raw = await keytar.getPassword(KEYTAR_SERVICE, tokenAccountName(accountId, type));
      if (raw) return JSON.parse(raw);
    } catch {}
  }

  const file = path.join(secureDir(), `${type}_${accountId}.bin`);
  if (!fs.existsSync(file)) return null;
  return decryptTokenPayload(await fsp.readFile(file));
}

async function deleteToken(accountId, type) {
  if (keytar) {
    try { await keytar.deletePassword(KEYTAR_SERVICE, tokenAccountName(accountId, type)); } catch {}
    // cleanup legacy incorrect key used in older builds
    try { await keytar.deletePassword(KEYTAR_SERVICE, accountId); } catch {}
  }
  const file = path.join(secureDir(), `${type}_${accountId}.bin`);
  try { await fsp.rm(file, { force: true }); } catch {}
}

async function startMicrosoftOAuth() {
  const { data } = await axios.post(MS_DEVICE_URL, new URLSearchParams({
    client_id: MS_CLIENT_ID,
    scope: MS_SCOPE,
    response_type: 'device_code'
  }).toString(), {
    timeout: 15000,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  const verificationUri = data.verification_uri || data.verification_url || 'https://www.microsoft.com/link';
  await shell.openExternal(verificationUri);

  return {
    status: 'pending_device_code',
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri,
    expiresIn: data.expires_in,
    interval: data.interval || 5,
    message: data.message || `Откройте ${verificationUri} и введите код ${data.user_code}`
  };
}

async function pollMicrosoftDeviceToken(deviceCode, opts = {}) {
  const startedAt = Date.now();
  let interval = Math.max(Number(opts.interval || 5), 1);
  const expiresIn = Number(opts.expiresIn || 900);

  while ((Date.now() - startedAt) / 1000 < expiresIn) {
    try {
      const { data } = await axios.post(MS_TOKEN_URL, new URLSearchParams({
        client_id: MS_CLIENT_ID,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode
      }).toString(), {
        timeout: 15000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      return data;
    } catch (error) {
      const code = error.response && error.response.data && error.response.data.error;
      if (code === 'authorization_pending') {
        await new Promise(r => setTimeout(r, interval * 1000));
        continue;
      }
      if (code === 'slow_down') {
        interval += 5;
        await new Promise(r => setTimeout(r, interval * 1000));
        continue;
      }
      if (code === 'authorization_declined') throw new Error('Вход отменён пользователем.');
      if (code === 'expired_token') throw new Error('Код входа истёк. Запустите вход заново.');
      throw new Error((error.response && error.response.data && error.response.data.error_description) || error.message);
    }
  }
  throw new Error('Код входа истёк. Запустите вход заново.');
}

async function refreshMicrosoftOAuth(refreshToken) {
  const { data } = await axios.post(MS_TOKEN_URL, new URLSearchParams({
    client_id: MS_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: MS_SCOPE
  }).toString(), {
    timeout: 15000,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return data;
}

async function loginMinecraftWithMicrosoftAccessToken(msAccessToken) {
  const xboxRes = await axios.post(MS_XBOX_URL, {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: 'user.auth.xboxlive.com',
      RpsTicket: `d=${msAccessToken}`
    },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT'
  }, { timeout: 15000, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });

  const xboxToken = xboxRes.data.Token;

  const xstsRes = await axios.post(MS_XSTS_URL, {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xboxToken] },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT'
  }, { timeout: 15000, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });

  const xstsToken = xstsRes.data.Token;
  const xstsUhs = xstsRes.data.DisplayClaims.xui[0].uhs;

  const mcRes = await axios.post(MC_AUTH_URL, {
    identityToken: `XBL3.0 x=${xstsUhs};${xstsToken}`
  }, { timeout: 15000, headers: { 'Content-Type': 'application/json' } });

  const mcToken = mcRes.data.access_token;
  const expiresIn = Number(mcRes.data.expires_in || 86400);

  const [profileRes, entitlementsRes] = await Promise.all([
    axios.get(MC_PROFILE_URL, { timeout: 15000, headers: { Authorization: `Bearer ${mcToken}` } }),
    axios.get(MC_ENTITLEMENTS_URL, { timeout: 15000, headers: { Authorization: `Bearer ${mcToken}` } }).catch(() => ({ data: { items: [] } }))
  ]);

  const entitlements = entitlementsRes.data && Array.isArray(entitlementsRes.data.items)
    ? entitlementsRes.data.items
    : [];

  if (!profileRes.data || !profileRes.data.id || !profileRes.data.name) {
    throw new Error('У Microsoft-аккаунта не найден купленный Minecraft: Java Edition.');
  }

  return {
    accessToken: mcToken,
    expiresAt: Date.now() + Math.max(expiresIn - 300, 60) * 1000,
    profile: profileRes.data,
    entitlements
  };
}

async function completeMicrosoftLogin(deviceCode, opts = {}) {
  const msTokens = await pollMicrosoftDeviceToken(deviceCode, opts);
  const minecraft = await loginMinecraftWithMicrosoftAccessToken(msTokens.access_token);
  return {
    accessToken: minecraft.accessToken,
    expiresAt: minecraft.expiresAt,
    refreshToken: msTokens.refresh_token,
    profile: minecraft.profile,
    entitlements: minecraft.entitlements
  };
}


async function authenticateEly({ username, password, totp }) {
  const login = String(username || '').trim();
  const pass = String(password || '');
  if (!login || !pass) throw new Error('Введите логин и пароль Ely.by.');
  const clientToken = crypto.randomUUID();
  const finalPassword = totp ? `${pass}:${String(totp).trim()}` : pass;
  try {
    const { data } = await axios.post(`${ELY_AUTH_URL}/authenticate`, {
      username: login,
      password: finalPassword,
      clientToken,
      requestUser: true
    }, { timeout: 20000, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });
    const profile = data.selectedProfile || (data.availableProfiles && data.availableProfiles[0]);
    if (!profile || !profile.id || !profile.name) throw new Error('Ely.by не вернул Minecraft-профиль.');
    return {
      accessToken: data.accessToken,
      clientToken: data.clientToken || clientToken,
      profile: { id: normaliseUuid(profile.id), name: profile.name },
      user: data.user || null
    };
  } catch (error) {
    const message = error.response && error.response.data && (error.response.data.errorMessage || error.response.data.error);
    if (message && /two factor/i.test(message)) throw new Error('Для Ely.by включена 2FA. Введите пароль и одноразовый код через двоеточие или повторите вход с TOTP.');
    throw new Error(message || error.message || 'Ely.by авторизация не выполнена.');
  }
}

async function loginElyWeb() {
  return new Promise((resolve, reject) => {
    let completed = false;
    let pollInterval = null;

    const authWin = new BrowserWindow({
      width: 540,
      height: 720,
      title: 'Вход через сайт Ely.by',
      autoHideMenuBar: true,
      backgroundColor: '#0c0d10',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: false,
        partition: 'persist:ely_web_session'
      }
    });

    const cleanup = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const injectHook = async () => {
      if (completed || authWin.isDestroyed()) return;
      try {
        await authWin.webContents.executeJavaScript(`
          (() => {
            if (window.__nexus_ely_hooked) return;
            window.__nexus_ely_hooked = true;

            function handlePayload(obj) {
              if (!obj || typeof obj !== 'object') return;
              if (obj.user && obj.user.username) {
                window.__nexus_ely_user = {
                  username: obj.user.username,
                  id: obj.user.id,
                  email: obj.user.email || null,
                  token: obj.token || null
                };
              } else if (obj.username && (obj.id || obj.uuid)) {
                window.__nexus_ely_user = {
                  username: obj.username,
                  id: obj.id || obj.uuid,
                  email: obj.email || null,
                  token: obj.token || null
                };
              }
            }

            const _origFetch = window.fetch;
            if (_origFetch) {
              window.fetch = async function(...args) {
                const res = await _origFetch.apply(this, args);
                try {
                  const clone = res.clone();
                  clone.json().then(handlePayload).catch(() => {});
                } catch (e) {}
                return res;
              };
            }

            const _origOpen = XMLHttpRequest.prototype.open;
            const _origSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.open = function(m, u) {
              this.__reqUrl = u;
              return _origOpen.apply(this, arguments);
            };
            XMLHttpRequest.prototype.send = function() {
              this.addEventListener('load', function() {
                try {
                  const text = this.responseText;
                  if (text && text.trim().startsWith('{')) {
                    const parsed = JSON.parse(text);
                    handlePayload(parsed);
                  }
                } catch (e) {}
              });
              return _origSend.apply(this, arguments);
            };
          })();
        `);
      } catch (e) {}
    };

    const checkUserInfo = async () => {
      if (completed || authWin.isDestroyed()) return;
      try {
        await injectHook();

        const info = await authWin.webContents.executeJavaScript(`
          (() => {
            if (window.__nexus_ely_user && window.__nexus_ely_user.username) {
              return window.__nexus_ely_user;
            }

            // 1. Check known Ely.by React/Redux class selectors for username
            const selectors = [
              '._3GIXK',
              '._3q00-',
              '[class*="activeAccountUsername"]',
              '[class*="accountUsername"]',
              '[class*="userName"]'
            ];
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              if (el && el.textContent && el.textContent.trim()) {
                const u = el.textContent.trim();
                if (/^[a-zA-Z0-9_]{3,16}$/.test(u)) {
                  return { username: u };
                }
              }
            }

            // 2. If page is navigated away from /login, inspect DOM for username
            const path = window.location.pathname || '';
            if (path !== '/login' && path !== '/login/' && !path.includes('/login')) {
              // Try finding text in elements that represent user or profile
              const candidates = document.querySelectorAll('span, a, div, b, strong');
              const commonWords = new Set(['login', 'account', 'ely', 'minecraft', 'profile', 'settings', 'email', 'password', 'exit', 'logout', 'help', 'news', 'ru', 'en', 'skin', 'cloaks']);
              for (const el of candidates) {
                if (el.children.length === 0 && el.textContent) {
                  const txt = el.textContent.trim();
                  if (/^[a-zA-Z0-9_]{3,16}$/.test(txt) && !commonWords.has(txt.toLowerCase())) {
                    const cls = String(el.className || '') + ' ' + String(el.parentElement ? el.parentElement.className : '');
                    if (/user|account|profile|nick|name/i.test(cls)) {
                      return { username: txt };
                    }
                  }
                }
              }
            }

            return null;
          })()
        `);

        if (info && info.username) {
          completed = true;
          cleanup();
          try { authWin.close(); } catch {}

          const elyProfile = await getElyProfileByName(info.username);
          const uuid = elyProfile ? elyProfile.id : offlinePlayerUuid(info.username);

          let skinUrl = `http://skinsystem.ely.by/skins/${encodeURIComponent(info.username)}.png`;
          let capeUrl = `http://skinsystem.ely.by/cloaks/${encodeURIComponent(info.username)}.png`;

          try {
            const textures = await fetchElyProfileTextures(uuid);
            if (textures && textures.skinUrl) skinUrl = textures.skinUrl;
            if (textures && textures.capeUrl) capeUrl = textures.capeUrl;
          } catch {}

          const account = accountFromProfile('ely', {
            nickname: info.username,
            email: info.email || null,
            uuid,
            skin: skinUrl,
            cape: capeUrl
          }, {
            onlineMode: true,
            status: 'connected',
            skinSystem: 'ely',
            authServer: 'ely.by'
          });

          await saveToken(account.id, 'ely', {
            type: 'web_session',
            user: { id: info.id || uuid, username: info.username, email: info.email }
          });

          const accounts = getAllAccounts().map(a => ({ ...a, active: false }));
          account.active = true;
          const existingIdx = accounts.findIndex(a => a.nickname.toLowerCase() === info.username.toLowerCase() && a.type === 'ely');
          if (existingIdx >= 0) {
            accounts[existingIdx] = { ...accounts[existingIdx], ...account, id: accounts[existingIdx].id };
            saveAllAccounts(accounts);
            try { await authWin.loadURL('https://ely.by/skin'); } catch {}
            return resolve(publicAccount(accounts[existingIdx]));
          } else {
            accounts.unshift(account);
            saveAllAccounts(accounts);
            try { await authWin.loadURL('https://ely.by/skin'); } catch {}
            return resolve(publicAccount(account));
          }
        }
      } catch (err) {
        // Continue polling
      }
    };

    authWin.loadURL('https://account.ely.by/login');

    pollInterval = setInterval(checkUserInfo, 1000);

    authWin.webContents.on('did-finish-load', () => {
      injectHook();
      checkUserInfo();
    });

    authWin.webContents.on('did-navigate', () => {
      injectHook();
      checkUserInfo();
    });

    authWin.webContents.on('did-navigate-in-page', () => {
      injectHook();
      checkUserInfo();
    });

    authWin.on('closed', () => {
      cleanup();
      if (!completed) {
        reject(new Error('Окно авторизации Ely.by закрыто до завершения входа.'));
      }
    });
  });
}

async function refreshElyToken(tok) {
  const { data } = await axios.post(`${ELY_AUTH_URL}/refresh`, {
    accessToken: tok.accessToken,
    clientToken: tok.clientToken,
    requestUser: true
  }, { timeout: 20000, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });
  return {
    ...tok,
    accessToken: data.accessToken || tok.accessToken,
    clientToken: data.clientToken || tok.clientToken,
    profile: data.selectedProfile || tok.profile,
    user: data.user || tok.user || null
  };
}

async function getElyProfileByName(name) {
  try {
    const { data, status } = await axios.get(`${ELY_PROFILE_API}/${encodeURIComponent(name)}`, { timeout: 12000, validateStatus: s => s === 200 || s === 204 });
    if (status === 204 || !data) return null;
    return { id: normaliseUuid(data.id), name: data.name };
  } catch { return null; }
}

function accountFromProfile(type, profile, extra = {}) {
  const id = 'acc_' + crypto.randomBytes(6).toString('hex');
  return {
    id,
    type,
    nickname: profile.nickname || profile.name || 'Player',
    email: profile.email || null,
    uuid: normaliseUuid(profile.uuid || profile.id),
    skin: profile.skin || (profile.skins && profile.skins[0] && profile.skins[0].url) || null,
    cape: profile.cape || (profile.capes && profile.capes[0] && profile.capes[0].url) || null,
    provider: type,
    status: extra.status || 'connected',
    onlineMode: extra.onlineMode !== false,
    skinSystem: extra.skinSystem || null,
    authServer: extra.authServer || (type === 'ely' ? 'ely.by' : null),
    createdAt: Date.now()
  };
}

function publicAccount(a) {
  return { ...a, token: undefined };
}

async function fetchElyProfileTextures(uuid) {
  try {
    const cleanUuid = String(uuid || '').replace(/-/g, '');
    if (!cleanUuid) return null;
    const url = `https://authserver.ely.by/session/profile/${encodeURIComponent(cleanUuid)}`;
    const res = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' }
    });
    const props = res.data && res.data.properties;
    if (Array.isArray(props)) {
      const texProp = props.find(p => p.name === 'textures');
      if (texProp && texProp.value) {
        const decoded = JSON.parse(Buffer.from(texProp.value, 'base64').toString('utf8'));
        const skinUrl = decoded && decoded.textures && decoded.textures.SKIN && decoded.textures.SKIN.url;
        const capeUrl = decoded && decoded.textures && decoded.textures.CAPE && decoded.textures.CAPE.url;
        return {
          skin: skinUrl ? skinUrl.replace(/^http:\/\//, 'https://') : null,
          cape: capeUrl ? capeUrl.replace(/^http:\/\//, 'https://') : null
        };
      }
    }
  } catch (e) {
    console.warn('[accounts] fetchElyProfileTextures failed:', e.message);
  }
  return null;
}

async function list() {
  const all = getAllAccounts();
  for (const acc of all) {
    if (acc.type === 'ely' && !acc.skin && acc.uuid) {
      fetchElyProfileTextures(acc.uuid).then(tex => {
        if (tex && (tex.skin || tex.cape)) {
          acc.skin = tex.skin || acc.skin;
          acc.cape = tex.cape || acc.cape;
          saveAllAccounts(getAllAccounts().map(a => a.id === acc.id ? { ...a, skin: acc.skin, cape: acc.cape } : a));
        }
      }).catch(() => {});
    }
  }
  return all.map(publicAccount);
}

async function add({ type, code, deviceCode, interval, expiresIn, nickname, email, username, password, totp }) {
  let account;
  let token = null;

  if (type === 'microsoft') {
    let result;
    if (deviceCode) {
      result = await completeMicrosoftLogin(deviceCode, { interval, expiresIn });
    } else if (code) {
      // Kept for backward compatibility with older UI builds.
      const { data } = await axios.post(MS_TOKEN_URL, new URLSearchParams({
        client_id: MS_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://login.live.com/oauth20_desktop.srf',
        scope: MS_SCOPE
      }).toString(), { timeout: 15000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      const minecraft = await loginMinecraftWithMicrosoftAccessToken(data.access_token);
      result = { accessToken: minecraft.accessToken, expiresAt: minecraft.expiresAt, refreshToken: data.refresh_token, profile: minecraft.profile, entitlements: minecraft.entitlements };
    } else {
      throw new Error('Не передан код авторизации Microsoft.');
    }

    account = accountFromProfile('microsoft', result.profile, { onlineMode: true, status: 'connected' });
    token = {
      type: 'microsoft',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      entitlements: result.entitlements || []
    };
  } else if (type === 'ely') {
    const result = await authenticateEly({ username, password, totp });
    let skin = null;
    let cape = null;
    if (result.profile && result.profile.id) {
      const tex = await fetchElyProfileTextures(result.profile.id);
      if (tex) { skin = tex.skin; cape = tex.cape; }
    }
    account = accountFromProfile('ely', { ...result.profile, skin, cape }, { onlineMode: true, status: 'connected' });
    token = {
      type: 'ely',
      accessToken: result.accessToken,
      clientToken: result.clientToken,
      profile: result.profile,
      user: result.user,
      authServer: 'ely.by'
    };
  } else if (type === 'tlauncher') {
    const nick = validateNickname(nickname || username);
    const skinUrl = `https://skin.tlauncher.org/skin/${encodeURIComponent(nick)}.png`;
    const capeUrl = `https://skin.tlauncher.org/cape/${encodeURIComponent(nick)}.png`;
    let skin = null;
    let cape = null;
    try {
      const sRes = await axios.head(skinUrl, { timeout: 4000, validateStatus: s => s === 200 });
      if (sRes.status === 200) skin = skinUrl;
    } catch {}
    try {
      const cRes = await axios.head(capeUrl, { timeout: 4000, validateStatus: s => s === 200 });
      if (cRes.status === 200) cape = capeUrl;
    } catch {}
    account = accountFromProfile('tlauncher', {
      nickname: nick,
      uuid: offlinePlayerUuid(nick),
      skin,
      cape
    }, { onlineMode: false, status: 'offline', skinSystem: 'tlauncher' });
    token = { type: 'tlauncher', accessToken: '0' };
  } else if (type === 'local') {
    const nick = validateNickname(nickname);
    account = accountFromProfile('local', {
      nickname: nick,
      uuid: offlinePlayerUuid(nick)
    }, { onlineMode: false, status: 'offline' });
    token = { type: 'local', accessToken: '0' };
  } else {
    throw new Error('Неизвестный тип аккаунта.');
  }

  const all = getAllAccounts();
  if (all.some(a => a.type === account.type && a.uuid && account.uuid && a.uuid.replace(/-/g, '') === account.uuid.replace(/-/g, ''))) {
    throw new Error('Этот аккаунт уже добавлен.');
  }
  account.active = all.length === 0;
  all.push(account);
  saveAllAccounts(all);
  if (token) await saveToken(account.id, account.type, token);

  try {
    new Notification({ title: 'Аккаунт добавлен', body: `${account.nickname} (${account.type})` }).show();
  } catch {}
  return account;
}

async function remove(id) {
  const all = getAllAccounts();
  const acc = all.find(a => a.id === id);
  const remaining = all.filter(a => a.id !== id);
  if (acc && acc.active && remaining.length && !remaining.some(a => a.active)) {
    remaining[0] = { ...remaining[0], active: true };
  }
  saveAllAccounts(remaining);
  if (acc) await deleteToken(id, acc.type);
  return true;
}

async function setActive(id) {
  const all = getAllAccounts().map(a => ({ ...a, active: a.id === id }));
  saveAllAccounts(all);
  return true;
}

async function getProfile(id) {
  const all = getAllAccounts();
  const acc = all.find(a => a.id === id);
  if (!acc) return null;

  if (acc.type === 'microsoft') {
    try {
      const token = await getAccessToken(id);
      if (token) {
        const r = await axios.get(MC_PROFILE_URL, { timeout: 15000, headers: { Authorization: `Bearer ${token}` } });
        acc.nickname = r.data.name;
        acc.uuid = normaliseUuid(r.data.id);
        acc.skin = r.data.skins && r.data.skins[0] && r.data.skins[0].url;
        acc.cape = r.data.capes && r.data.capes[0] && r.data.capes[0].url;
        acc.status = 'connected';
        saveAllAccounts(all.map(a => a.id === id ? acc : a));
      }
    } catch (e) {
      acc.status = 'expired';
      saveAllAccounts(all.map(a => a.id === id ? acc : a));
    }
  } else if (acc.type === 'ely') {
    try {
      const tok = await loadToken(id, 'ely');
      if (tok && tok.profile) {
        acc.nickname = tok.profile.name || acc.nickname;
        acc.uuid = normaliseUuid(tok.profile.id || acc.uuid);
        if (acc.uuid) {
          const tex = await fetchElyProfileTextures(acc.uuid);
          if (tex) {
            acc.skin = tex.skin || acc.skin;
            acc.cape = tex.cape || acc.cape;
          }
        }
        acc.status = 'connected';
        saveAllAccounts(all.map(a => a.id === id ? acc : a));
      }
    } catch (e) {
      acc.status = 'expired';
      saveAllAccounts(all.map(a => a.id === id ? acc : a));
    }
  }
  return { ...acc, token: undefined };
}

async function getAccessToken(id) {
  const all = getAllAccounts();
  const acc = all.find(a => a.id === id);
  if (!acc) return null;
  if (acc.type === 'ely') {
    const tok = await loadToken(id, 'ely');
    if (!tok || !tok.accessToken) return null;
    try {
      const refreshed = await refreshElyToken(tok);
      await saveToken(id, 'ely', refreshed);
      return refreshed.accessToken;
    } catch {
      return tok.accessToken;
    }
  }
  if (acc.type !== 'microsoft') return '0';

  const tok = await loadToken(id, 'microsoft');
  if (!tok) return null;
  if (tok.accessToken && tok.expiresAt && tok.expiresAt > Date.now() + 5 * 60 * 1000) {
    return tok.accessToken;
  }
  if (!tok.refreshToken) return null;

  try {
    const refreshed = await refreshMicrosoftOAuth(tok.refreshToken);
    const minecraft = await loginMinecraftWithMicrosoftAccessToken(refreshed.access_token);
    const nextToken = {
      type: 'microsoft',
      accessToken: minecraft.accessToken,
      refreshToken: refreshed.refresh_token || tok.refreshToken,
      expiresAt: minecraft.expiresAt,
      entitlements: minecraft.entitlements || tok.entitlements || []
    };
    await saveToken(id, 'microsoft', nextToken);

    const updated = all.map(a => a.id === id ? {
      ...a,
      nickname: minecraft.profile.name,
      uuid: normaliseUuid(minecraft.profile.id),
      skin: minecraft.profile.skins && minecraft.profile.skins[0] && minecraft.profile.skins[0].url,
      cape: minecraft.profile.capes && minecraft.profile.capes[0] && minecraft.profile.capes[0].url,
      status: 'connected'
    } : a);
    saveAllAccounts(updated);
    return nextToken.accessToken;
  } catch (e) {
    saveAllAccounts(all.map(a => a.id === id ? { ...a, status: 'expired' } : a));
    return null;
  }
}

function getStorageInfo() {
  return {
    keytar: !!keytar,
    safeStorage: !!(safeStorage && safeStorage.isEncryptionAvailable()),
    fallback: !(keytar || (safeStorage && safeStorage.isEncryptionAvailable()))
  };
}

async function startElyOAuth() {
  return { status: 'manual_yggdrasil', authServer: 'https://authserver.ely.by', message: 'Введите логин Ely.by. Пароль не сохраняется; хранится только зашифрованный токен.' };
}

async function uploadSkinToElyWeb(buf, variant) {
  return new Promise((resolve) => {
    let win = null;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (win) {
        try { win.destroy(); } catch {}
        win = null;
      }
      resolve(result);
    };

    try {
      win = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: {
          partition: 'persist:ely_web_session',
          contextIsolation: false
        }
      });

      const timer = setTimeout(() => {
        finish({ ok: false, error: 'timeout', message: 'Сайт Ely.by не ответил вовремя. Скин сохранён локально.' });
      }, 30000);

      win.loadURL('https://ely.by/skin').catch(err => {
        clearTimeout(timer);
        finish({ ok: false, error: err.message, message: 'Не удалось загрузить страницу Ely.by.' });
      });

      win.webContents.on('did-finish-load', async () => {
        try {
          const b64 = buf.toString('base64');
          const res = await win.webContents.executeJavaScript(`
            (async () => {
              try {
                const user = (window.alight && window.alight.service && window.alight.service.currentUser) ||
                             (window.app && window.app.user);
                if (!user || !user.id) {
                  return { ok: false, error: 'not_logged_in', message: 'Сессия Ely.by на сайте не активна. Войдите через «Вход через сайт Ely.by» для синхронизации.' };
                }

                const byteCharacters = atob('${b64}');
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/png' });

                const formData = new FormData();
                formData.append('file', blob, 'skin.png');

                const uploadResp = await fetch('/skins/upload', {
                  method: 'POST',
                  body: formData,
                  headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });

                const data = await uploadResp.json();
                if (data.error && !data.error.includes('success')) {
                  return { ok: false, error: data.error, message: data.text || 'Ошибка загрузки скина на сайт Ely.by' };
                }

                const skinId = data.extra && data.extra.id;
                if (skinId) {
                  await fetch('/skins/wear', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/x-www-form-urlencoded',
                      'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: 'skinId=' + encodeURIComponent(skinId)
                  }).catch(() => {});
                }

                return { ok: true, message: data.text || 'Скин успешно обновлён на сайте Ely.by!' };
              } catch (err) {
                return { ok: false, error: err.message };
              }
            })()
          `);
          clearTimeout(timer);
          finish(res);
        } catch (e) {
          clearTimeout(timer);
          finish({ ok: false, error: e.message });
        }
      });
    } catch (err) {
      finish({ ok: false, error: err.message });
    }
  });
}

async function changeSkin(accountId, { imageBuffer, variant = 'classic', skinUrl = null }) {
  const all = getAllAccounts();
  const acc = all.find(a => a.id === accountId);
  if (!acc) throw new Error('Аккаунт не найден.');

  if (acc.type === 'microsoft') {
    const token = await getAccessToken(accountId);
    if (!token) throw new Error('Microsoft-сессия истекла. Войдите заново.');

    if (imageBuffer) {
      const buf = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);
      const boundary = '----NexusSkinUpload' + Date.now().toString(16);
      const varVal = variant === 'slim' ? 'slim' : 'classic';
      
      const pre = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="variant"\r\n\r\n` +
        `${varVal}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="skin.png"\r\n` +
        `Content-Type: image/png\r\n\r\n`
      );
      const post = Buffer.from(`\r\n--${boundary}--\r\n`);
      const payload = Buffer.concat([pre, buf, post]);

      await axios.put(MC_PROFILE_URL + '/skins', payload, {
        timeout: 25000,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        }
      });
    } else if (skinUrl) {
      await axios.post(MC_PROFILE_URL + '/skins', {
        variant: variant === 'slim' ? 'slim' : 'classic',
        url: skinUrl
      }, {
        timeout: 25000,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    }
    await getProfile(accountId);
    return { ok: true, message: 'Скин успешно установлен в Minecraft (Mojang)!' };
  }

  if (acc.type === 'ely' || acc.type === 'tlauncher' || acc.type === 'local') {
    if (imageBuffer) {
      const buf = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);
      const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;

      // Save skin file locally for offline / in-game rendering
      const skinDir = path.join(app.getPath('userData'), 'skins');
      try { await fs.promises.mkdir(skinDir, { recursive: true }); } catch {}
      const skinFilePath = path.join(skinDir, `${acc.id}_skin.png`);
      await fs.promises.writeFile(skinFilePath, buf);

      const allAccounts = getAllAccounts();
      const updated = allAccounts.map(a => {
        if (a.id === accountId) {
          return {
            ...a,
            skin: dataUrl,
            skinFile: skinFilePath,
            skinCustom: true,
            skinVariant: variant === 'slim' ? 'slim' : 'classic'
          };
        }
        return a;
      });
      saveAllAccounts(updated);

      if (acc.type === 'ely') {
        const elyWebRes = await uploadSkinToElyWeb(buf, variant);
        if (elyWebRes && elyWebRes.ok) {
          return {
            ok: true,
            message: 'Скин успешно установлен в лаунчере и на сайте Ely.by!'
          };
        } else if (elyWebRes && elyWebRes.message) {
          return {
            ok: true,
            message: `Скин сохранён в лаунчере. (${elyWebRes.message})`
          };
        }
        return {
          ok: true,
          message: 'Скин успешно установлен в лаунчере!'
        };
      }

      return {
        ok: true,
        message: 'Скин успешно обновлён!'
      };
    }
    return { ok: true, message: 'Скин сохранён.' };
  }

  throw new Error('Смена скина не поддерживается для данного типа аккаунта.');
}

module.exports = {
  list,
  add,
  remove,
  setActive,
  getProfile,
  changeSkin,
  startMicrosoftOAuth,
  startElyOAuth: loginElyWeb,
  loginElyWeb,
  getAccessToken,
  getStorageInfo
};
