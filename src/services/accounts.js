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
const { app, shell, Notification, safeStorage } = require('electron');

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
  const out = { ...a, token: undefined };
  if (out.type === 'tlauncher') {
    out.type = 'local';
    out.provider = 'local';
    out.skinSystem = null;
    out.onlineMode = false;
    out.status = out.status || 'offline';
  }
  return out;
}

async function list() {
  return getAllAccounts().map(publicAccount);
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
    account = accountFromProfile('ely', result.profile, { onlineMode: true, status: 'connected' });
    token = {
      type: 'ely',
      accessToken: result.accessToken,
      clientToken: result.clientToken,
      profile: result.profile,
      user: result.user,
      authServer: 'ely.by'
    };
  } else if (type === 'tlauncher') {
    // Backward compatibility only: TLauncher authorization is removed.
    // Old UI payloads are converted to a normal local offline profile.
    const nick = validateNickname(nickname || username);
    account = accountFromProfile('local', {
      nickname: nick,
      uuid: crypto.randomUUID()
    }, { onlineMode: false, status: 'offline' });
    token = { type: 'local', accessToken: '0' };
  } else if (type === 'local') {
    const nick = validateNickname(nickname);
    account = accountFromProfile('local', {
      nickname: nick,
      uuid: crypto.randomUUID()
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

module.exports = {
  list,
  add,
  remove,
  setActive,
  getProfile,
  startMicrosoftOAuth,
  startElyOAuth,
  getAccessToken,
  getStorageInfo
};
