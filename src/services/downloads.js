'use strict';

/**
 * Downloads Service
 *  - Shared queue with configurable concurrency
 *  - Robust retries for transient network failures (ECONNRESET/socket hang up)
 *  - Writes to .part files and atomically renames on success
 *  - Emits compact progress events for the renderer download center
 */

const axios = require('axios');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { BrowserWindow } = require('electron');
const crypto = require('crypto');

const http = require('http');
const Settings = require('./settings');
const { createHttpsAgent, sleep } = require('./shared');

const sharedHttpsAgent = createHttpsAgent({
  keepAlive: true,
  insecure: process.env.NEXUS_INSECURE_TLS === '1'
});
const sharedHttpAgent = new http.Agent({ keepAlive: true, timeout: 60000 });

function isUserFacing(item) {
  if (!item) return false;
  if (item.internal) return false;
  const kind = String(item.kind || '').toLowerCase();
  return !['asset', 'library', 'asset-index', 'loader', 'client', 'natives'].includes(kind);
}

function maxConcurrency() {
  // Keep the queue responsive. Huge parallel asset downloads can freeze Electron
  // renderers and trigger ECONNRESET on Mojang/CDN endpoints.
  try { return Math.max(1, Math.min(32, Number(Settings.getAll().downloadThreads) || 16)); } catch { return 16; }
}
function networkTimeoutMs() {
  try { return Math.max(10000, Number(Settings.getAll().networkTimeout || 60) * 1000); } catch { return 60000; }
}
function retryCount() {
  try { return Math.max(2, Math.min(8, Number(Settings.getAll().downloadRetries) || 5)); } catch { return 5; }
}

const queue = [];
const active = new Map();
const pausedItems = new Map();
const cancelledItems = new Set();
const waiters = new Map(); // id -> [{resolve,reject}]
const completed = [];
let snapshotTimer = null;

function emit(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    try { win.webContents.send(channel, payload); } catch {}
  }
}

function emitSnapshotSoon() {
  if (snapshotTimer) return;
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null;
    emit('downloads:snapshot', list());
  }, 180);
}

async function ensureDir(filePath) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
}

async function moveFileSafe(src, dest) {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fsp.rename(src, dest);
  } catch (err) {
    if (err && err.code === 'EXDEV') {
      await fsp.copyFile(src, dest);
      await fsp.unlink(src).catch(() => {});
      return;
    }
    throw err;
  }
}

async function sha1File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function isTransientNetworkError(err) {
  const code = err && (err.code || (err.cause && err.cause.code));
  const msg = String((err && err.message) || '').toLowerCase();
  return ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'ERR_BAD_RESPONSE'].includes(code)
    || msg.includes('socket hang up')
    || msg.includes('network')
    || msg.includes('timeout')
    || msg.includes('aborted');
}

function compactDownloadError(err, item, url) {
  const status = err && err.response && err.response.status;
  const code = err && (err.code || (err.cause && err.cause.code));
  let source = '';
  try {
    const parsed = new URL(url || item.url);
    source = `${parsed.hostname}${parsed.pathname}`;
  } catch {}
  const file = path.basename(item.path || '') || prettyId(item);

  if (status === 404) return new Error(`Файл не найден на сервере (HTTP 404): ${file}${source ? ` — ${source}` : ''}`);
  if (status === 403) return new Error(`Сервер запретил скачивание (HTTP 403): ${file}`);
  if (status === 429) return new Error(`Сервер временно ограничил загрузки (HTTP 429): ${file}`);
  if (status) return new Error(`Ошибка сервера HTTP ${status} при скачивании ${file}`);
  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') return new Error(`Истекло время ожидания при скачивании ${file}`);
  if (code === 'EAI_AGAIN' || code === 'ENOTFOUND') return new Error(`Не удалось найти сервер при скачивании ${file}`);
  if (code === 'ECONNRESET' || String(err && err.message).toLowerCase().includes('socket hang up')) return new Error(`Соединение было сброшено при скачивании ${file}`);
  return new Error(`Не удалось скачать ${file}: ${String((err && err.message) || 'неизвестная ошибка').slice(0, 300)}`);
}

function prettyId(item) {
  if (item.label) return item.label;
  if (item.kind === 'asset') return 'Игровой ресурс';
  if (item.kind === 'library') return 'Библиотека';
  if (item.kind === 'mod') return path.basename(item.path || item.id || 'Мод');
  if (item.kind === 'modpack') return 'Сборка';
  if (item.kind === 'client') return 'Клиент Minecraft';
  return item.id;
}

function uniqueDownloadUrls(urls) {
  return Array.from(new Set((urls || []).filter(Boolean).map(u => String(u).replace(/^http:\/\//i, 'https://'))));
}

function relFromMavenUrl(url) {
  try {
    const parsed = new URL(url);
    const clean = parsed.pathname.replace(/^\/+/, '');
    const patterns = [
      /^maven2\/(.+)$/i,
      /^maven\/(.+)$/i,
      /^releases\/(.+)$/i,
      /^repository\/release\/(.+)$/i
    ];
    for (const re of patterns) {
      const m = clean.match(re);
      if (m) return m[1];
    }
    if (/libraries\.minecraft\.net$/i.test(parsed.hostname)) return clean;
  } catch {}
  return '';
}

function relFromLibraryPath(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const marker = '/libraries/';
  const idx = normalized.lastIndexOf(marker);
  if (idx >= 0) return normalized.slice(idx + marker.length);
  return '';
}


const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const ARCHIVE_KINDS = new Set(['mod', 'modpack', 'resourcepack', 'world']);

function archiveLikeDownload(item = {}) {
  const ext = path.extname(String(item.path || '')).toLowerCase();
  return ARCHIVE_KINDS.has(item.kind) || ['.zip', '.jar', '.mrpack', '.rar', '.7z', '.tar', '.gz', '.tgz'].includes(ext);
}

function detectArchiveFormat(buf) {
  if (!buf || buf.length < 4) return '';
  // ZIP, JAR and MRPACK all use the ZIP container.
  if (buf[0] === 0x50 && buf[1] === 0x4B && [0x03, 0x05, 0x07].includes(buf[2]) && [0x04, 0x06, 0x08].includes(buf[3])) return 'zip';
  // RAR4 / RAR5: 52 61 72 21 1A 07 00 / 01 00
  if (buf.length >= 7 && buf[0] === 0x52 && buf[1] === 0x61 && buf[2] === 0x72 && buf[3] === 0x21 && buf[4] === 0x1A && buf[5] === 0x07) return 'rar';
  // 7z: 37 7A BC AF 27 1C
  if (buf.length >= 6 && buf[0] === 0x37 && buf[1] === 0x7A && buf[2] === 0xBC && buf[3] === 0xAF && buf[4] === 0x27 && buf[5] === 0x1C) return '7z';
  // gzip / tar.gz
  if (buf[0] === 0x1F && buf[1] === 0x8B && buf[2] === 0x08) return 'gzip';
  // uncompressed tar: magic at offset 257
  if (buf.length >= 265 && Buffer.from(buf).slice(257, 262).toString('ascii') === 'ustar') return 'tar';
  return '';
}

function isZipHeader(buf) {
  return detectArchiveFormat(buf) === 'zip';
}

function allowedArchiveFormats(item = {}) {
  const kind = String(item.kind || '').toLowerCase();
  if (kind === 'world') return new Set(['zip', 'rar', '7z', 'gzip', 'tar']);
  if (kind === 'modpack') return new Set(['zip']);
  if (kind === 'resourcepack') return new Set(['zip']);
  if (kind === 'mod') return new Set(['zip']);
  return new Set(['zip', 'rar', '7z', 'gzip', 'tar']);
}

function isHtmlHead(buf) {
  const text = Buffer.from(buf || []).slice(0, 512).toString('utf8').trim().toLowerCase();
  return text.startsWith('<!doctype html') || text.startsWith('<html') || text.includes('<title') || text.includes('<body');
}

function contentType(resp) {
  return String(resp && resp.headers && resp.headers['content-type'] || '').toLowerCase();
}

function htmlSnippet(buf) {
  return Buffer.from(buf || [])
    .slice(0, 800)
    .toString('utf8')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

async function readHead(filePath, length = 1024) {
  const fd = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await fd.read(buf, 0, length, 0);
    return buf.slice(0, bytesRead);
  } finally {
    await fd.close();
  }
}

async function validateDownloadedPayload(filePath, item, resp, url) {
  const stat = await fsp.stat(filePath).catch(() => null);
  if (!stat || stat.size <= 0) throw new Error(`Скачанный файл пустой: ${prettyId(item)}`);

  if (!archiveLikeDownload(item)) return;

  const head = await readHead(filePath, 1024);
  const ct = contentType(resp);
  const format = detectArchiveFormat(head);
  if (format && allowedArchiveFormats(item).has(format) && !ct.includes('text/html')) return;

  const host = (() => { try { return new URL(url || item.url).hostname; } catch { return ''; } })();
  if (ct.includes('text/html') || isHtmlHead(head)) {
    const preview = htmlSnippet(head);
    throw new Error(`Вместо архива скачалась HTML-страница${host ? ` с ${host}` : ''}. ${preview ? `Фрагмент: ${preview}. ` : ''}Ссылка требует подтверждение/куки или недоступна.`);
  }

  const sig = Array.from(head.slice(0, 8)).map(x => x.toString(16).padStart(2, '0')).join(' ');
  if (format) {
    throw new Error(`Скачался архив ${format.toUpperCase()}, но этот тип нельзя установить как ${prettyId(item)}${host ? ` (${host})` : ''}.`);
  }
  throw new Error(`Скачанный файл не похож на поддерживаемый архив${host ? ` (${host})` : ''}. Первые байты: ${sig || 'нет данных'}.`);
}

function mergeCookies(current, setCookieHeaders) {
  const jar = { ...(current || {}) };
  for (const raw of setCookieHeaders || []) {
    const first = String(raw || '').split(';')[0];
    const idx = first.indexOf('=');
    if (idx > 0) jar[first.slice(0, idx).trim()] = first.slice(idx + 1).trim();
  }
  return jar;
}

function cookieHeader(cookies) {
  return Object.entries(cookies || {}).map(([k, v]) => `${k}=${v}`).join('; ');
}

function decodePossiblyWrappedUrl(value) {
  let out = decodeHtmlAttr(String(value || '').trim());
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(out);
      if (decoded === out) break;
      out = decoded;
    } catch { break; }
  }
  return out;
}

function extractGoogleDriveId(url) {
  const raw = decodePossiblyWrappedUrl(url);
  const values = [raw];
  try {
    const parsed = new URL(raw);
    for (const key of ['id', 'fileId']) {
      const value = parsed.searchParams.get(key);
      if (value) values.push(value);
    }
    for (const key of ['url', 'u', 'q', 'target']) {
      const nested = parsed.searchParams.get(key);
      if (nested && /drive\.google\.com|docs\.google\.com|drive\.usercontent\.google\.com/i.test(nested)) {
        const nestedId = extractGoogleDriveId(nested);
        if (nestedId) return nestedId;
      }
    }
  } catch {}
  for (const value of values) {
    const text = decodePossiblyWrappedUrl(value);
    const patterns = [
      /\/file\/d\/([A-Za-z0-9_-]{10,})/i,
      /\/d\/([A-Za-z0-9_-]{10,})/i,
      /[?&](?:id|fileId)=([A-Za-z0-9_-]{10,})/i,
      /(?:^|[^A-Za-z0-9_-])([A-Za-z0-9_-]{25,})(?:[^A-Za-z0-9_-]|$)/
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) return m[1];
    }
  }
  return '';
}

function isGoogleDriveUrl(url) {
  return /drive\.google\.com|docs\.google\.com|drive\.usercontent\.google\.com/i.test(String(url || ''));
}

function isYandexDiskUrl(url) {
  return /disk\.yandex\.|yadi\.sk/i.test(String(url || ''));
}

function decodeHtmlAttr(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function streamToString(stream, limit = 2 * 1024 * 1024) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    stream.on('data', chunk => {
      total += chunk.length;
      if (total <= limit) chunks.push(Buffer.from(chunk));
      if (total > limit) {
        try { stream.destroy(); } catch {}
        reject(new Error('HTML-страница подтверждения слишком большая.'));
      }
    });
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

async function streamResponseToFile(resp, partPath, item, state) {
  const writer = fs.createWriteStream(partPath, { flags: 'w' });
  state.total = resp.headers['content-length'] ? parseInt(resp.headers['content-length'], 10) : (item.size || 0);
  state.received = 0;
  state.startedAt = Date.now();
  resp.data.on('data', chunk => {
    state.received += chunk.length;
    const now = Date.now();
    const elapsed = Math.max(0.001, (now - state.startedAt) / 1000);
    emit('downloads:progress', {
      id: item.id, label: prettyId(item), kind: item.kind,
      received: state.received, total: state.total,
      speed: state.received / elapsed,
      eta: state.total > 0 ? Math.max(0, (state.total - state.received) / Math.max(state.received / elapsed, 1)) : 0,
      path: item.path
    });
  });
  resp.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
    resp.data.on('error', reject);
  });
}

function parseGoogleDriveConfirmation(html, currentUrl, fileId, cookies) {
  const cookieToken = Object.entries(cookies || {}).find(([name]) => /^download_warning/i.test(name));
  if (cookieToken && cookieToken[1]) {
    return `https://drive.google.com/uc?export=download&confirm=${encodeURIComponent(cookieToken[1])}&id=${encodeURIComponent(fileId)}`;
  }

  const hrefMatch = String(html || '').match(/href="([^"]*(?:uc\?|drive\.usercontent\.google\.com\/download)[^"]+)"/i);
  if (hrefMatch) return new URL(decodeHtmlAttr(hrefMatch[1]), currentUrl).toString();

  const formMatch = String(html || '').match(/<form\b[^>]*id="download-form"[^>]*action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/i)
    || String(html || '').match(/<form\b[^>]*action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/i);
  if (formMatch) {
    const action = decodeHtmlAttr(formMatch[1]);
    const body = formMatch[2] || '';
    const params = new URLSearchParams();
    const inputRe = /<input\b[^>]*name="([^"]+)"[^>]*value="([^"]*)"[^>]*>/gi;
    let m;
    while ((m = inputRe.exec(body))) params.set(decodeHtmlAttr(m[1]), decodeHtmlAttr(m[2]));
    if (!params.get('id') && fileId) params.set('id', fileId);
    const u = new URL(action, currentUrl);
    for (const [k, v] of params.entries()) u.searchParams.set(k, v);
    return u.toString();
  }

  const confirmMatch = String(html || '').match(/[?&]confirm=([0-9A-Za-z_\-]+)/);
  if (confirmMatch) {
    return `https://drive.google.com/uc?export=download&confirm=${encodeURIComponent(confirmMatch[1])}&id=${encodeURIComponent(fileId)}`;
  }

  return '';
}

async function googleDriveStreamDownload(url, partPath, item, state, cancelSource) {
  const fileId = extractGoogleDriveId(url);
  if (!fileId && !/drive\.usercontent\.google\.com/i.test(String(url || ''))) {
    throw new Error('Не удалось извлечь ID файла Google Drive.');
  }

  let cookies = {};
  const startUrl = fileId
    ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
    : url;

  const requestStream = async (requestUrl, referer) => {
    const headers = {
      'User-Agent': BROWSER_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Connection': 'close'
    };
    if (referer) headers.Referer = referer;
    const cookie = cookieHeader(cookies);
    if (cookie) headers.Cookie = cookie;
    const resp = await axios({
      method: 'get',
      url: requestUrl,
      responseType: 'stream',
      cancelToken: cancelSource && cancelSource.token,
      timeout: networkTimeoutMs(),
      maxRedirects: 5,
      httpsAgent: createHttpsAgent({ keepAlive: false, insecure: process.env.NEXUS_INSECURE_TLS === '1' }),
      headers,
      decompress: true,
      validateStatus: status => status >= 200 && status < 300
    });
    cookies = mergeCookies(cookies, resp.headers['set-cookie']);
    return resp;
  };

  let resp = await requestStream(startUrl, 'https://drive.google.com/');
  if (!contentType(resp).includes('text/html')) {
    await streamResponseToFile(resp, partPath, item, state);
    await validateDownloadedPayload(partPath, item, resp, startUrl);
    return;
  }

  const html = await streamToString(resp.data);
  const nextUrl = parseGoogleDriveConfirmation(html, startUrl, fileId, cookies);
  if (!nextUrl) {
    const lower = html.toLowerCase();
    if (lower.includes('quota') || lower.includes('too many users')) throw new Error('Google Drive временно ограничил скачивание файла по квоте.');
    if (lower.includes('access denied') || lower.includes('permission')) throw new Error('Нет доступа к файлу Google Drive. Проверьте, что ссылка публичная.');
    throw new Error('Google Drive отдал страницу подтверждения, но ссылка на скачивание не найдена.');
  }

  resp = await requestStream(nextUrl, startUrl);
  if (contentType(resp).includes('text/html')) {
    const html2 = await streamToString(resp.data).catch(() => '');
    const snippet = htmlSnippet(Buffer.from(html2));
    throw new Error(`Google Drive снова отдал HTML вместо файла.${snippet ? ` Фрагмент: ${snippet}` : ''}`);
  }
  await streamResponseToFile(resp, partPath, item, state);
  await validateDownloadedPayload(partPath, item, resp, nextUrl);
}

async function yandexDiskStreamDownload(url, partPath, item, state, cancelSource) {
  let directUrl = url;
  if (isYandexDiskUrl(url)) {
    const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(url)}`;
    const apiRes = await axios.get(apiUrl, {
      timeout: 15000,
      cancelToken: cancelSource && cancelSource.token,
      httpsAgent: createHttpsAgent({ insecure: process.env.NEXUS_INSECURE_TLS === '1' }),
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json,*/*' }
    });
    if (!apiRes.data || !apiRes.data.href) throw new Error('Yandex Disk API не вернул прямую ссылку скачивания.');
    directUrl = apiRes.data.href;
  }
  await axiosStreamDownload(directUrl, partPath, item, state, cancelSource);
}

function expandDownloadUrls(item) {
  const original = uniqueDownloadUrls([...(Array.isArray(item.urls) ? item.urls : []), item.url]);
  const rels = new Set();
  for (const url of original) {
    const rel = relFromMavenUrl(url);
    if (rel) rels.add(rel);
  }
  const fromPath = relFromLibraryPath(item.path);
  if (fromPath) rels.add(fromPath);

  if (!rels.size || item.kind === 'asset' || item.kind === 'client') return original;

  const mirrors = [];
  for (const rel of rels) {
    // Mojang keeps legacy Minecraft libraries such as LWJGL/JInput here.
    mirrors.push(`https://libraries.minecraft.net/${rel}`);

    // Forge keeps old modloader dependencies and installer libraries here.
    mirrors.push(`https://maven.minecraftforge.net/${rel}`);

    // Modern loaders.
    mirrors.push(`https://maven.fabricmc.net/${rel}`);
    mirrors.push(`https://maven.neoforged.net/releases/${rel}`);
    mirrors.push(`https://maven.quiltmc.org/repository/release/${rel}`);

    // Maven Central last, because legacy LWJGL/JInput platform artifacts often 404 there.
    mirrors.push(`https://repo1.maven.org/maven2/${rel}`);
  }

  // The repository declared by the profile is authoritative. Trying every
  // unrelated Maven host first made Fabric/Quilt installs wait for multiple
  // timeouts before reaching their real repository (and could make all loader
  // downloads look frozen). Keep mirrors strictly as fallbacks. Legacy Forge
  // still reaches its mirrors after an immediate 404 from an obsolete URL.
  return uniqueDownloadUrls([...original, ...mirrors]);
}

function addCompleted(item, status, extra = {}) {
  completed.unshift({
    id: item.id,
    label: prettyId(item),
    path: item.path,
    kind: item.kind,
    status,
    at: Date.now(),
    ...extra
  });
  if (completed.length > 80) completed.splice(80);
}

function resolveWaiters(id, value) {
  const list = waiters.get(id) || [];
  waiters.delete(id);
  for (const w of list) w.resolve(value);
}
function rejectWaiters(id, err) {
  const list = waiters.get(id) || [];
  waiters.delete(id);
  for (const w of list) w.reject(err);
}

async function fileAlreadyValid(item) {
  try {
    if (!fs.existsSync(item.path)) return false;
    const st = await fsp.stat(item.path);
    if (st.size === 0) return false;
    if (item.size && st.size !== item.size) return false;
    if (item.kind === 'asset' || item.kind === 'library' || item.fastCheck) return true;
    if (item.sha1) return await sha1File(item.path) === item.sha1;
    return true;
  } catch {
    return false;
  }
}

async function finalizePartDownload(partPath, item) {
  const sizeOk = !item.size || fs.statSync(partPath).size === item.size;
  if (!sizeOk) throw new Error(`size mismatch for ${item.id}`);
  if (item.sha1) {
    const actual = await sha1File(partPath);
    if (actual !== item.sha1) throw new Error(`checksum mismatch for ${item.id}`);
  }
  await moveFileSafe(partPath, item.path);
}

function scheduleNext() {
  while (active.size < maxConcurrency() && queue.length > 0) {
    const item = queue.shift();
    runDownload(item);
  }
  emitSnapshotSoon();
}

/**
 * Download a file from a direct URL using Axios stream (for resolved external hosting URLs).
 */
async function axiosStreamDownload(url, partPath, item, state, cancelSource) {
  const resp = await axios({
    method: 'get',
    url,
    responseType: 'stream',
    cancelToken: cancelSource && cancelSource.token,
    timeout: networkTimeoutMs(),
    maxRedirects: 10,
      httpsAgent: createHttpsAgent({ keepAlive: false, insecure: process.env.NEXUS_INSECURE_TLS === '1' }),
    headers: {
      'User-Agent': BROWSER_UA,
      'Accept': archiveLikeDownload(item) ? 'application/zip,application/java-archive,application/octet-stream,*/*' : '*/*',
      'Connection': 'close'
    },
    decompress: true,
    validateStatus: s => s >= 200 && s < 300
  });
  await streamResponseToFile(resp, partPath, item, state);
  await validateDownloadedPayload(partPath, item, resp, url);
}

/**
 * Download a file using a hidden BrowserWindow.
 * Handles: Qrator JS challenges, redirects to Yandex Disk / Google Drive.
 */
async function electronDownload(url, destPath, item, state, cancelSource) {
  await ensureDir(destPath);
  const partPath = `${destPath}.part`;
  try { if (fs.existsSync(partPath)) await fsp.unlink(partPath); } catch {}

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => { try { win.destroy(); } catch {} };
    const fail = (err) => { if (settled) return; settled = true; clearTimeout(timer); cleanup(); reject(err); };
    const succeed = () => { if (settled) return; settled = true; clearTimeout(timer); cleanup(); resolve(); };

    const win = new BrowserWindow({
      show: false, width: 800, height: 600,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
    });
    const ses = win.webContents.session;

    // 1. Intercept direct file downloads (Content-Disposition: attachment)
    ses.on('will-download', (event, downloadItem) => {
      if (settled) return;
      downloadItem.setSavePath(partPath);
      state.total = downloadItem.getTotalBytes() || 0;
      state.received = 0;
      state.startedAt = Date.now();

      downloadItem.on('updated', (_ev, dlState) => {
        if (dlState === 'interrupted') { downloadItem.resume(); return; }
        state.received = downloadItem.getReceivedBytes();
        state.total = downloadItem.getTotalBytes() || state.total;
        const elapsed = Math.max(0.001, (Date.now() - state.startedAt) / 1000);
        emit('downloads:progress', {
          id: item.id, label: prettyId(item), kind: item.kind,
          received: state.received, total: state.total,
          speed: state.received / elapsed,
          eta: state.total > 0 ? Math.max(0, (state.total - state.received) / Math.max(state.received / elapsed, 1)) : 0,
          path: item.path
        });
      });

      downloadItem.once('done', async (_ev, dlState) => {
        if (settled) return;
        if (dlState === 'completed') {
          try {
            const fd = await fsp.open(partPath, 'r');
            const hdr = Buffer.alloc(1024);
            const { bytesRead } = await fd.read(hdr, 0, 1024, 0);
            await fd.close();
            const format = detectArchiveFormat(hdr.slice(0, bytesRead));
            if (!format || !allowedArchiveFormats(item).has(format)) {
              await fsp.unlink(partPath).catch(() => {});
              fail(new Error(format
                ? `Скачался архив ${format.toUpperCase()}, но этот тип нельзя установить как ${prettyId(item)}.`
                : 'Скачанный файл не является поддерживаемым архивом. Попробуйте скачать вручную через «Подробнее».'));
              return;
            }
            await moveFileSafe(partPath, destPath);
            succeed();
          } catch (err) { fail(err); }
        } else {
          fail(new Error(`Загрузка прервана: ${dlState}`));
        }
      });

      if (cancelSource && cancelSource.token) {
        cancelSource.token.promise.then(() => { if (!settled) { downloadItem.cancel(); fail(new Error('Загрузка отменена')); } }).catch(() => {});
      }
    });

    // 2. Detect navigation to external hosting and resolve via APIs
    win.webContents.on('did-navigate', async (_ev, navUrl) => {
      if (settled) return;

      // Yandex Disk — resolve via public API
      if (/disk\.yandex\.|yadi\.sk/i.test(navUrl)) {
        try {
          const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(navUrl)}`;
          const apiRes = await axios.get(apiUrl, { timeout: 15000, httpsAgent: createHttpsAgent({ insecure: process.env.NEXUS_INSECURE_TLS === '1' }) });
          if (apiRes.data && apiRes.data.href) {
            await axiosStreamDownload(apiRes.data.href, partPath, item, state, cancelSource);
            await moveFileSafe(partPath, destPath);
            succeed();
            return;
          }
        } catch (e) {
          fail(new Error(`Не удалось скачать с Яндекс.Диска: ${e.message}. Попробуйте скачать вручную через «Подробнее».`));
          return;
        }
      }

      // Google Drive — construct direct URL
      if (/drive\.google\.com|drive\.usercontent\.google\.com/i.test(navUrl)) {
        const fileId = extractGoogleDriveId(navUrl);
        if (fileId || /drive\.usercontent\.google\.com/i.test(navUrl)) {
          try {
            const directUrl = fileId ? `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}` : navUrl;
            await googleDriveStreamDownload(directUrl, partPath, item, state, cancelSource);
            await moveFileSafe(partPath, destPath);
            succeed();
            return;
          } catch (e) {
            fail(new Error(`Не удалось скачать с Google Drive: ${e.message}. Попробуйте скачать вручную через «Подробнее».`));
            return;
          }
        }
      }

      // Other external hosting
      if (/mega\.nz|mediafire\.com|dropbox\.com/i.test(navUrl)) {
        const host = new URL(navUrl).hostname;
        fail(new Error(`Файл на внешнем хостинге (${host}). Скачайте вручную через «Подробнее».`));
      }
    });

    const timer = setTimeout(() => {
      fail(new Error('Превышено время ожидания (60 сек). Попробуйте скачать вручную через «Подробнее».'));
    }, 60000);

    win.loadURL(url).catch(() => {});
  });
}

async function singleAttempt(item, attempt, totalAttempts, cancelSource, state, urlOverride = null) {
  const url = urlOverride || item.url;
  // Only use BrowserWindow download for minecraft-inside.ru /download/ URLs
  // External hosting (Yandex CDN, Google Drive, etc.) goes through normal Axios
  const isInsideDownload = /minecraft-inside\.ru\/download\/\d+/i.test(url);

  // For minecraft-inside.ru /download/ URLs, use Electron BrowserWindow to bypass Qrator
  if (isInsideDownload) {
    emit('downloads:progress', {
      id: item.id,
      label: prettyId(item),
      kind: item.kind,
      url,
      attempt,
      attempts: totalAttempts,
      received: 0,
      total: item.size || 0,
      path: item.path
    });
    await electronDownload(url, item.path, item, state, cancelSource);
    return;
  }

  await ensureDir(item.path);
  const partPath = `${item.path}.part`;
  try { if (fs.existsSync(partPath)) await fsp.unlink(partPath); } catch {}

  if (isUserFacing(item)) {
    emit('downloads:progress', {
      id: item.id,
      label: prettyId(item),
      kind: item.kind,
      url,
      attempt,
      attempts: totalAttempts,
      received: 0,
      total: item.size || 0,
      path: item.path
    });
  }

  if (isGoogleDriveUrl(url)) {
    await googleDriveStreamDownload(url, partPath, item, state, cancelSource);
    await finalizePartDownload(partPath, item);
    return;
  }

  if (isYandexDiskUrl(url)) {
    await yandexDiskStreamDownload(url, partPath, item, state, cancelSource);
    await finalizePartDownload(partPath, item);
    return;
  }

  const writer = fs.createWriteStream(partPath, { flags: 'w' });

  const headers = {
    'User-Agent': BROWSER_UA,
    'Accept': archiveLikeDownload(item) ? 'application/zip,application/java-archive,application/octet-stream,*/*' : '*/*',
    'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
    'Connection': 'keep-alive'
  };

  const isHttps = String(url).startsWith('https');
  const resp = await axios({
    method: 'get',
    url,
    responseType: 'stream',
    cancelToken: cancelSource.token,
    timeout: networkTimeoutMs(),
    maxRedirects: 10,
    httpsAgent: isHttps ? sharedHttpsAgent : undefined,
    httpAgent: !isHttps ? sharedHttpAgent : undefined,
    headers,
    decompress: true,
    validateStatus: status => status >= 200 && status < 300
  });

  state.received = 0;
  state.total = item.size || (resp.headers['content-length'] ? parseInt(resp.headers['content-length'], 10) : 0);
  state.startedAt = Date.now();
  state.attempt = attempt;
  state.attempts = totalAttempts;

  let lastEmit = 0;
  resp.data.on('data', chunk => {
    state.received += chunk.length;
    if (isUserFacing(item)) {
      const now = Date.now();
      if (now - lastEmit > 250) {
        lastEmit = now;
        const elapsed = Math.max(0.001, (now - state.startedAt) / 1000);
        const speed = state.received / elapsed;
        const eta = state.total > 0 ? Math.max(0, (state.total - state.received) / Math.max(speed, 1)) : 0;
        emit('downloads:progress', {
          id: item.id,
          label: prettyId(item),
          kind: item.kind,
          attempt,
          attempts: totalAttempts,
          received: state.received,
          total: state.total,
          speed,
          eta,
          path: item.path
        });
      }
    }
  });

  resp.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
    resp.data.on('error', reject);
  });

  await validateDownloadedPayload(partPath, item, resp, url);
  await finalizePartDownload(partPath, item);
}

async function runDownload(item) {
  if (active.has(item.id)) return;

  const cancelSource = axios.CancelToken.source();
  const state = {
    item,
    received: 0,
    total: item.size || 0,
    startedAt: Date.now(),
    paused: false,
    cancelSource,
    attempt: 1,
    attempts: retryCount(),
    status: 'preparing'
  };

  // Reserve the active slot synchronously BEFORE any await. Without this,
  // scheduleNext() could drain hundreds/thousands of assets at once because
  // active.size stayed 0 while fileAlreadyValid() was still awaiting SHA checks.
  active.set(item.id, state);
  emitSnapshotSoon();

  try {
    if (await fileAlreadyValid(item)) {
      active.delete(item.id);
      addCompleted(item, 'skipped');
      if (isUserFacing(item)) {
        emit('downloads:done', { id: item.id, label: prettyId(item), path: item.path, skipped: true });
      }
      resolveWaiters(item.id, { ok: true, path: item.path, skipped: true });
      scheduleNext();
      return;
    }
  } catch {}

  const attempts = retryCount();
  state.attempts = attempts;
  let lastErr = null;
  try {
    const urls = expandDownloadUrls(item);
    let globalAttempt = 0;
    for (const url of urls) {
      state.currentUrl = url;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        globalAttempt += 1;
        state.attempt = attempt;
        state.status = 'downloading';
        try {
          await singleAttempt(item, attempt, attempts, cancelSource, state, url);
          active.delete(item.id);
          addCompleted(item, 'done');
          if (isUserFacing(item)) {
            emit('downloads:done', { id: item.id, label: prettyId(item), path: item.path });
          }
          resolveWaiters(item.id, { ok: true, path: item.path });
          scheduleNext();
          return;
        } catch (err) {
          lastErr = err;
          try { await fsp.unlink(`${item.path}.part`); } catch {}
          if (axios.isCancel(err)) throw err;
          const status = err && err.response && err.response.status;
          const hasNextMirror = urls.indexOf(url) < urls.length - 1;
          if (hasNextMirror && (status === 404 || status === 403 || status === 410 || !isTransientNetworkError(err))) {
            state.status = 'mirror';
            emit('downloads:retry', { id: item.id, label: prettyId(item), attempt, attempts, error: `mirror fallback: ${err.message}` });
            break;
          }
          if (attempt >= attempts || !isTransientNetworkError(err)) break;
          state.status = 'retry';
          emit('downloads:retry', { id: item.id, label: prettyId(item), attempt, attempts, error: err.message });
          await sleep(Math.min(15000, 800 * Math.pow(1.8, attempt - 1)));
        }
      }
    }
    throw compactDownloadError(lastErr || new Error('download failed'), item, state.currentUrl || item.url);
  } catch (err) {
    active.delete(item.id);
    if (axios.isCancel(err)) {
      if (cancelledItems.delete(item.id)) {
        emit('downloads:cancelled', { id: item.id, label: prettyId(item) });
        rejectWaiters(item.id, new Error('Загрузка отменена'));
      } else if (pausedItems.has(item.id)) {
        // Keep original waiters alive. resume() will continue the same logical
        // download and resolve them after the file is complete.
        emit('downloads:paused', { id: item.id, label: prettyId(item) });
      } else {
        emit('downloads:cancelled', { id: item.id, label: prettyId(item) });
        rejectWaiters(item.id, new Error('Загрузка прервана'));
      }
    } else {
      addCompleted(item, 'error', { error: err.message });
      emit('downloads:error', { id: item.id, label: prettyId(item), error: err.message });
      rejectWaiters(item.id, err);
    }
    try { await fsp.unlink(`${item.path}.part`); } catch {}
    try { if (fs.existsSync(item.path) && item.sha1 && await sha1File(item.path) !== item.sha1) await fsp.unlink(item.path); } catch {}
    scheduleNext();
  }
}

function start(item, opts = {}) {
  if (!item || !item.id || !(item.url || (Array.isArray(item.urls) && item.urls.length)) || !item.path) return Promise.reject(new Error('Invalid download item'));
  if (!item.url && Array.isArray(item.urls)) item.url = item.urls[0];
  item.kind = item.kind || 'file';
  item.label = item.label || prettyId(item);

  if (opts.wait === false) {
    if (!active.has(item.id) && !queue.find(q => q.id === item.id)) queue.push(item);
    scheduleNext();
    return Promise.resolve({ ok: true, queued: true });
  }

  return new Promise((resolve, reject) => {
    const arr = waiters.get(item.id) || [];
    arr.push({ resolve, reject });
    waiters.set(item.id, arr);
    if (!active.has(item.id) && !queue.find(q => q.id === item.id)) queue.push(item);
    scheduleNext();
  });
}

async function pause(id) {
  const s = active.get(id);
  if (s) {
    pausedItems.set(id, s.item);
    s.cancelSource.cancel('paused');
    active.delete(id);
  }
  const idx = queue.findIndex(q => q.id === id);
  if (idx >= 0) {
    pausedItems.set(id, queue[idx]);
    queue.splice(idx, 1);
  }
  emit('downloads:paused', { id });
  scheduleNext();
  return true;
}

async function resume(id) {
  const item = pausedItems.get(id);
  if (!item) return { ok: false, error: 'not_paused' };
  pausedItems.delete(id);
  start(item, { wait: false });
  emit('downloads:resumed', { id });
  return { ok: true };
}

async function cancel(id) {
  cancelledItems.add(id);
  pausedItems.delete(id);
  const s = active.get(id);
  if (s) {
    try { s.cancelSource.cancel('cancelled'); } catch {}
    active.delete(id);
  }
  const idx = queue.findIndex(q => q.id === id);
  if (idx >= 0) {
    const [item] = queue.splice(idx, 1);
    cancelledItems.delete(id);
    rejectWaiters(id, new Error('Загрузка отменена'));
    try { await fsp.unlink(`${item.path}.part`); } catch {}
    emit('downloads:cancelled', { id, label: prettyId(item) });
  }
  scheduleNext();
  return { ok: true };
}

async function cancelAll() {
  const ids = Array.from(new Set([
    ...Array.from(active.keys()),
    ...queue.map(q => q.id),
    ...Array.from(pausedItems.keys())
  ]));
  for (const id of ids) {
    try { await cancel(id); } catch {}
  }
  return { ok: true, cancelled: ids.length };
}

async function cancelGroup(predicate) {
  const idsToCancel = [];
  for (const [id, s] of active.entries()) {
    if (predicate(s.item, id)) idsToCancel.push(id);
  }
  for (const q of queue) {
    if (predicate(q, q.id)) idsToCancel.push(q.id);
  }
  for (const [id, item] of pausedItems.entries()) {
    if (predicate(item, id)) idsToCancel.push(id);
  }
  for (const id of idsToCancel) {
    try { await cancel(id); } catch {}
  }
  return { ok: true, cancelled: idsToCancel.length };
}

function list(opts = {}) {
  const allowInternal = opts && opts.all === true;
  const qList = allowInternal ? queue : queue.filter(isUserFacing);
  const aList = allowInternal ? Array.from(active.entries()) : Array.from(active.entries()).filter(([_, s]) => isUserFacing(s.item));
  const cList = allowInternal ? completed : completed.filter(c => isUserFacing(c.item));
  const pList = allowInternal ? Array.from(pausedItems.values()) : Array.from(pausedItems.values()).filter(isUserFacing);

  return {
    queue: qList.map(q => ({ id: q.id, label: prettyId(q), url: q.url, path: q.path, size: q.size, sha1: q.sha1, kind: q.kind })),
    active: aList.map(([id, s]) => ({
      id,
      label: prettyId(s.item),
      kind: s.item.kind,
      path: s.item.path,
      received: s.received,
      total: s.total,
      startedAt: s.startedAt,
      paused: s.paused,
      status: s.status || 'downloading',
      attempt: s.attempt,
      attempts: s.attempts
    })),
    completed: cList.slice(0, 30),
    paused: pList.map(q => ({ id: q.id, label: prettyId(q), path: q.path, size: q.size, kind: q.kind }))
  };
}

function clearCompleted() {
  completed.length = 0;
  emitSnapshotSoon();
  return true;
}

function setWindow() {}

module.exports = { start, pause, resume, cancel, cancelAll, cancelGroup, list, clearCompleted, setWindow };
if (process.env.NODE_ENV === 'test') {
  module.exports.__testing = { detectArchiveFormat, isHtmlHead, extractGoogleDriveId, expandDownloadUrls };
}
