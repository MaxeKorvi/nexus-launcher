'use strict';

const axios = require('axios');
const { getCurseForgeApiKey, curseForgeErrorMessage } = require('./curseforge-auth');
const { createHttpsAgent } = require('./shared');

const MODRINTH = 'https://api.modrinth.com/v2';
const CURSEFORGE = 'https://api.curseforge.com/v1';
const USER_AGENT = 'NexusLauncher/1.1.12';

let insideCookies = '';

const apiCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function cachedApiCall(key, factory) {
  const hit = apiCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value;
  const promise = factory().then(result => {
    apiCache.set(key, { at: Date.now(), value: Promise.resolve(result) });
    return result;
  }).catch(err => {
    apiCache.delete(key);
    throw err;
  });
  apiCache.set(key, { at: Date.now(), value: promise });
  return promise;
}

function clearApiCache() {
  apiCache.clear();
}

function timeoutMs() { return 60000; }
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function client(headers = {}) {
  const inst = axios.create({
    timeout: timeoutMs(),
    httpsAgent: createHttpsAgent({ insecure: process.env.NEXUS_INSECURE_TLS === '1' }),
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/html;q=0.9, */*;q=0.8', ...headers }
  });
  inst.interceptors.response.use(r => r, async err => {
    const cfg = err.config || {};
    cfg.__nexusRetry = cfg.__nexusRetry || 0;
    const status = err && err.response && err.response.status;
    const retryable = !status || status === 429 || status >= 500 || ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND', 'EAI_AGAIN'].includes(err.code);
    if (retryable && cfg.__nexusRetry < 2) {
      cfg.__nexusRetry += 1;
      await sleep(400 * cfg.__nexusRetry);
      return inst.request(cfg);
    }
    throw err;
  });
  return inst;
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value) {
  return stripHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLoader(loader) {
  const v = String(loader || '').toLowerCase();
  if (!v || v === 'any' || v === 'all' || v === 'vanilla' || v === 'none') return '';
  return v;
}

function versionParts(v) {
  return String(v || '').split(/[^0-9]+/).filter(Boolean).map(Number);
}

function compareVersionDesc(a, b) {
  const aa = versionParts(a);
  const bb = versionParts(b);
  const max = Math.max(aa.length, bb.length);
  for (let i = 0; i < max; i++) {
    const diff = (bb[i] || 0) - (aa[i] || 0);
    if (diff) return diff;
  }
  return String(b || '').localeCompare(String(a || ''));
}

function extractVersions(value) {
  const matches = String(value || '').match(/\b1\.\d+(?:\.\d+)?\b/g);
  return Array.from(new Set(matches || [])).sort(compareVersionDesc);
}

function detectLoader(text) {
  const x = normalizeText(text);
  if (x.includes('neoforge')) return 'neoforge';
  if (x.includes('forge')) return 'forge';
  if (x.includes('quilt')) return 'quilt';
  if (x.includes('fabric')) return 'fabric';
  return '';
}

function absoluteUrl(base, href) {
  try { return new URL(href, base).toString(); } catch { return href || ''; }
}

function firstMatch(text, re) {
  const m = String(text || '').match(re);
  return m ? m[1] : '';
}

function decodeHtmlAttr(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
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
    for (const key of ['id', 'fileId', 'resourcekey']) {
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

function dedupeByPriority(items, priority = ['curseforge', 'modrinth', 'minecraft-inside']) {
  const rank = new Map(priority.map((name, idx) => [name, idx]));
  const map = new Map();
  for (const item of items || []) {
    const key = `${normalizeText(item.title || item.name || item.slug)}|${(item.mcVersions || []).join(',')}|${item.loader || ''}`;
    if (!map.has(key)) {
      map.set(key, item);
      continue;
    }
    const prev = map.get(key);
    const prevRank = rank.has(prev.source) ? rank.get(prev.source) : 999;
    const newRank = rank.has(item.source) ? rank.get(item.source) : 999;
    if (newRank < prevRank) map.set(key, item);
  }
  return Array.from(map.values());
}

async function searchModrinth({ query = '', projectType, mcVersion = '', loader = '', page = 0, pageSize = 60, index = 'relevance' }) {
  const facets = [[`project_type:${projectType}`]];
  if (mcVersion) facets.push([`versions:${mcVersion}`]);
  loader = normalizeLoader(loader);
  if (loader) facets.push([`categories:${loader}`]);
  const request = (requestFacets) => client().get(`${MODRINTH}/search`, {
    params: {
      query,
      facets: JSON.stringify(requestFacets),
      limit: Math.min(100, pageSize),
      offset: page * Math.min(100, pageSize),
      index
    }
  });
  let { data } = await request(facets);
  // Some projects do not tag every supported game version/loader in search.
  // Retry broadly so the catalog never looks completely broken; file selection
  // still prefers a compatible version during installation.
  if (!(data.hits || []).length && (mcVersion || loader)) {
    ({ data } = await request([[`project_type:${projectType}`]]));
  }
  return {
    source: 'modrinth',
    total: data.total_hits,
    hits: (data.hits || []).map(h => ({
      id: h.project_id,
      slug: h.slug,
      title: h.title,
      description: h.description,
      author: h.author,
      downloads: h.downloads,
      follows: h.follows,
      icon: h.icon_url,
      latest: h.latest_version,
      mcVersions: h.versions || [],
      versions: h.versions || [],
      loader: loader || detectLoader((h.categories || []).join(' ')),
      source: 'modrinth',
      url: `https://modrinth.com/${projectType === 'modpack' ? 'modpack' : projectType}/${h.slug}`
    }))
  };
}

async function getModrinthVersions(projectId) {
  const { data } = await client().get(`${MODRINTH}/project/${projectId}/version`);
  return Array.isArray(data) ? data : [];
}

function curseForgeClassForType(type) {
  if (type === 'mod') return 6;
  if (type === 'modpack') return 4471;
  if (type === 'shader') return 6552;
  if (type === 'resourcepack') return 12;
  if (type === 'world') return 17;
  return 6;
}

function curseForgeLoaderType(loader) {
  loader = normalizeLoader(loader);
  if (loader === 'forge') return 1;
  if (loader === 'fabric') return 4;
  if (loader === 'quilt') return 5;
  if (loader === 'neoforge') return 6;
  return undefined;
}

async function searchCurseForge({ query = '', type = 'mod', mcVersion = '', loader = '', page = 0, pageSize = 60 }) {
  const apiKey = getCurseForgeApiKey();
  if (!apiKey) {
    return { source: 'curseforge', total: 0, hits: [], error: 'Для CurseForge добавьте переменную окружения CF_API_KEY.' };
  }
  const params = {
    gameId: 432,
    classId: curseForgeClassForType(type),
    searchFilter: query || undefined,
    pageSize: Math.min(50, pageSize),
    index: page * Math.min(50, pageSize),
    sortField: 2,
    sortOrder: 'desc'
  };
  if (mcVersion) params.gameVersion = mcVersion;
  const modLoaderType = curseForgeLoaderType(loader);
  if (modLoaderType) params.modLoaderType = modLoaderType;
  let data;
  try {
    ({ data } = await client({ 'x-api-key': apiKey }).get(`${CURSEFORGE}/mods/search`, { params }));
  } catch (err) {
    return { source: 'curseforge', total: 0, hits: [], error: curseForgeErrorMessage(err) };
  }
  const hits = (data.data || []).map(m => ({
    id: m.id,
    slug: m.slug,
    title: m.name,
    description: m.summary,
    author: (m.authors && m.authors[0] && m.authors[0].name) || '',
    downloads: m.downloadCount,
    icon: m.logo && m.logo.url,
    url: m.websiteUrl,
    mcVersions: Array.from(new Set((m.latestFilesIndexes || []).map(x => x.gameVersion).filter(Boolean))),
    loader: loader || '',
    source: 'curseforge'
  }));
  return { source: 'curseforge', total: data.pagination ? data.pagination.totalCount : hits.length, hits };
}

async function resolveCurseForgeDownload({ projectId, fileId, mcVersion = '', loader = '', type = 'mod' }) {
  const apiKey = getCurseForgeApiKey();
  if (!apiKey) throw new Error('Для установки из CurseForge нужна переменная CF_API_KEY. Можно создать launcher-source/.env с этой строкой.');
  let target = fileId ? null : null;
  try {
    if (!fileId) {
      const { data } = await client({ 'x-api-key': apiKey }).get(`${CURSEFORGE}/mods/${projectId}/files`, {
        params: { gameVersion: mcVersion || undefined, modLoaderType: curseForgeLoaderType(loader) || undefined, pageSize: 50 }
      });
      const files = data.data || [];
      target = files.find(f => f.isAvailable && f.downloadUrl)
        || files.find(f => f.isAvailable && /(release|stable)/i.test(String(f.releaseType)))
        || files.find(f => f.isAvailable)
        || files[0];
    } else {
      const { data } = await client({ 'x-api-key': apiKey }).get(`${CURSEFORGE}/mods/${projectId}/files/${fileId}`);
      target = data.data;
    }
  } catch (err) {
    throw new Error(curseForgeErrorMessage(err));
  }
  if (!target || !target.downloadUrl) throw new Error('Не удалось получить файл CurseForge для установки.');
  return {
    url: target.downloadUrl,
    fileName: target.fileName || `${projectId}.jar`,
    fileSize: target.fileLength || 0,
    fileId: target.id
  };
}

async function fetchHtml(url) {
  const isInside = String(url).includes('minecraft-inside.ru');
  const headers = {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
  if (isInside) {
    headers['Referer'] = 'https://minecraft-inside.ru/';
    if (insideCookies) {
      headers['Cookie'] = insideCookies;
    }
  }
  const res = await client(headers).get(url, { responseType: 'text' });
  
  if (isInside && res.headers && res.headers['set-cookie']) {
    const cookies = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
    insideCookies = cookies;
  }
  
  return res.data;
}

function pushInsideCard(cards, item) {
  if (!item || !item.url || !item.title) return;
  if (!item.url.includes('minecraft-inside.ru')) return;
  if (cards.some(x => x.url === item.url)) return;
  const joined = `${item.title} ${item.description || ''}`;
  cards.push({
    id: item.url,
    title: item.title,
    description: item.description || '',
    author: item.author || '',
    icon: item.icon || '',
    url: item.url,
    source: 'minecraft-inside',
    mcVersions: extractVersions(joined),
    loader: detectLoader(joined),
    section: item.section || 'mods'
  });
}

function parseInsideCards(html, baseUrl, section = 'mods') {
  const cards = [];

  // Old layout: the whole card is wrapped by an anchor with a catalog/material class.
  const cardRe = /<a[^>]+href="([^"]+)"[^>]*class="[^"]*(?:news|post|material|catalog|item)[^"]*"[\s\S]*?<\/a>/gi;
  let m;
  while ((m = cardRe.exec(html)) && cards.length < 100) {
    const block = m[0];
    const href = absoluteUrl(baseUrl, m[1]);
    const title = stripHtml(firstMatch(block, /title="([^"]+)"/i) || firstMatch(block, /<h[23][^>]*>([\s\S]*?)<\/h[23]>/i));
    const desc = stripHtml(firstMatch(block, /<p[^>]*>([\s\S]*?)<\/p>/i));
    const icon = absoluteUrl(baseUrl, firstMatch(block, /<img[^>]+src="([^"]+)"/i));
    pushInsideCard(cards, { url: href, title, description: desc, icon, section });
  }

  // Current Minecraft Inside layout: a page is a list of h2 links followed by text,
  // author, image, category and "Подробнее". This parser keeps the maps catalog
  // alive even when class names change.
  const titleRe = /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/gi;
  const matches = [];
  while ((m = titleRe.exec(html)) && matches.length < 140) {
    matches.push({ index: m.index, end: titleRe.lastIndex, href: m[1], title: stripHtml(m[2]) });
  }

  for (let i = 0; i < matches.length && cards.length < 100; i++) {
    const current = matches[i];
    const next = matches[i + 1] ? matches[i + 1].index : html.length;
    const block = html.slice(current.end, next);
    const href = absoluteUrl(baseUrl, current.href);
    
    // Prevent category clashing on global search
    if (href.includes('/maps/') && section !== 'maps') continue;
    if (href.includes('/modpacks/') && section !== 'modpacks') continue;
    if (href.includes('/shaders/') && section !== 'shaders') continue;
    if (href.includes('/texture-packs/') && section !== 'texture-packs') continue;
    if (section === 'mods' && !href.includes('/mods/')) continue;
    if (section !== 'mods' && !href.includes(`/${section}/`)) continue;
    const author = stripHtml(firstMatch(block, /Автор:\s*(?:<[^>]+>)*\s*([\s\S]{0,160}?)(?:<\/a>|<br|<\/div|<img)/i));
    const icon = absoluteUrl(baseUrl, firstMatch(block, /<img[^>]+(?:data-src|src)="([^"]+)"/i));
    let descBlock = block
      .replace(/Автор:[\s\S]{0,300}?(?:<\/a>|<br|<\/div>)/i, ' ')
      .replace(/<img[\s\S]*?>/gi, ' ')
      .replace(/Категория:[\s\S]*$/i, ' ');
    const desc = stripHtml(descBlock).slice(0, 500);
    pushInsideCard(cards, { url: href, title: current.title, description: desc, author, icon, section });
  }

  // Last fallback: collect links that look like items from this section.
  if (!cards.length) {
    const linkRe = new RegExp(`<a[^>]+href="([^"]*\\/${section}\\/[^"]+)"[^>]*>([\\s\\S]{2,160}?)<\\/a>`, 'gi');
    while ((m = linkRe.exec(html)) && cards.length < 100) {
      const href = absoluteUrl(baseUrl, m[1]);
      const title = stripHtml(m[2]);
      if (!title || /^(подробнее|вперед|назад|все|по дате)$/i.test(title)) continue;
      pushInsideCard(cards, { url: href, title, description: '', icon: '', section });
    }
  }

  return cards;
}

async function searchMinecraftInside({ section = 'mods', query = '', mcVersion = '', loader = '', page = 0, pageSize = 60 }) {
  const baseUrl = `https://minecraft-inside.ru/${section}`;
  const pagesPerRequest = Math.max(1, Math.min(8, Math.ceil((pageSize || 60) / 10)));
  const startPage = Math.max(0, page) * pagesPerRequest;
  const urls = [];

  function pageUrl(pageIndex) {
    if (query) {
      return `https://minecraft-inside.ru/search/?q=${encodeURIComponent(query)}${pageIndex ? `&page=${pageIndex + 1}` : ''}`;
    }
    if (mcVersion) {
      return pageIndex > 0
        ? `${baseUrl}/${encodeURIComponent(mcVersion)}/page/${pageIndex + 1}/`
        : `${baseUrl}/${encodeURIComponent(mcVersion)}/`;
    }
    return pageIndex > 0 ? `${baseUrl}/page/${pageIndex + 1}/` : `${baseUrl}/`;
  }

  for (let i = 0; i < pagesPerRequest; i++) urls.push(pageUrl(startPage + i));

  // Important: keep catalog limited by selected Minecraft version, but do not rely
  // only on /section/<version>/ pages. Minecraft Inside often has incomplete
  // version pages, while the normal catalog pages still contain titles like
  // "[1.12.2]" or descriptions with the selected version.
  if (mcVersion || query) {
    for (let i = 0; i < pagesPerRequest; i++) {
      const pageIndex = startPage + i;
      urls.push(pageIndex > 0 ? `${baseUrl}/page/${pageIndex + 1}/` : `${baseUrl}/`);
    }
  }

  const all = [];
  const seen = new Set();
  const uniqueUrls = Array.from(new Set(urls));
  await Promise.allSettled(uniqueUrls.map(async (url) => {
    const html = await fetchHtml(url);
    const isVersionUrl = mcVersion && url.includes(`/${mcVersion}`);
    for (const card of parseInsideCards(html, baseUrl, section)) {
      if (isVersionUrl && mcVersion && !card.mcVersions.includes(mcVersion)) {
        card.mcVersions.push(mcVersion);
      }
      const key = card.url || `${card.title}-${card.source}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      all.push(card);
    }
  }));

  const loaderNorm = normalizeLoader(loader);
  const qNorm = normalizeText(query);

  function versionMatches(cardVersions, targetVersion) {
    if (!targetVersion) return true;
    if (!cardVersions || !cardVersions.length) return false;
    if (cardVersions.includes(targetVersion)) return true;
    const targetParts = targetVersion.split('.');
    if (targetParts.length >= 2) {
      const targetMajorMinor = `${targetParts[0]}.${targetParts[1]}`;
      for (const v of cardVersions) {
        if (v === targetMajorMinor) return true;
        if (v === `${targetMajorMinor}.x`) return true;
        const parts = v.split('.');
        if (parts.length >= 2 && `${parts[0]}.${parts[1]}` === targetMajorMinor) {
          return true;
        }
      }
    }
    return false;
  }

  const baseFilter = (item, allowUnknownVersion = false) => {
    const itemVersions = item.mcVersions || [];
    const okVersion = !mcVersion || versionMatches(itemVersions, mcVersion) || (allowUnknownVersion && !itemVersions.length);
    const okLoader = !loaderNorm || !item.loader || item.loader === loaderNorm;
    const okQuery = !qNorm || normalizeText(`${item.title} ${item.description}`).includes(qNorm);
    return okVersion && okLoader && okQuery;
  };

  let hits = all.filter(item => baseFilter(item, false));
  if (!hits.length && mcVersion) hits = all.filter(item => baseFilter(item, true));

  hits.sort((a, b) => {
    const av = (a.mcVersions || []).includes(mcVersion) ? 1 : 0;
    const bv = (b.mcVersions || []).includes(mcVersion) ? 1 : 0;
    if (bv !== av) return bv - av;
    return (b.downloads || 0) - (a.downloads || 0);
  });
  return { source: 'minecraft-inside', total: hits.length + (hits.length >= pageSize ? pageSize : 0), hits: hits.slice(0, pageSize || 60) };
}

function extensionForInsideSection(section = '') {
  const s = String(section || '').toLowerCase();
  if (s.includes('modpack')) return 'zip';
  if (s.includes('mod')) return 'jar';
  return 'zip';
}

function safeInsideFileName(entry, url = '') {
  const cleanUrlName = decodePossiblyWrappedUrl(String(url || '').split('/').filter(Boolean).pop() || '').split('?')[0];
  if (/\.(zip|jar|mrpack|rar|7z|tar|tar\.gz|tgz)$/i.test(cleanUrlName)) return cleanUrlName;

  const ext = extensionForInsideSection(entry && entry.section);
  const base = normalizeText((entry && entry.title) || 'minecraft-inside-file')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9а-яё_.-]+/gi, '')
    .slice(0, 70) || 'minecraft-inside-file';
  return `${base}.${ext}`;
}

function collectInsideDownloadCandidates(html, baseUrl, entry = {}) {
  const out = [];
  const targetVersion = String(entry.mcVersion || '').trim();

  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(html))) {
    const attrs = m[1] || '';
    const rawHref = firstMatch(attrs, /\bhref\s*=\s*"([^"]+)"/i) || firstMatch(attrs, /\bhref\s*=\s*'([^']+)'/i);
    if (!rawHref || /^#|javascript:/i.test(rawHref)) continue;

    const href = absoluteUrl(baseUrl, rawHref);
    const text = stripHtml(m[2] || '');
    const context = stripHtml(html.slice(Math.max(0, m.index - 260), Math.min(html.length, anchorRe.lastIndex + 260)));
    const hay = `${href} ${text} ${context}`.toLowerCase();

    let score = 0;
    if (/\/download\/\d+\/?/i.test(href)) score += 100;
    if (/\.(zip|jar|mrpack|rar|7z|tar|tar\.gz|tgz)(\?|#|$)/i.test(href)) score += 120;
    if (/скачать|download|для\s+1\.|for\s+1\./i.test(`${text} ${context}`)) score += 30;
    if (targetVersion && context.includes(targetVersion)) score += 80;
    if (targetVersion && text.includes(targetVersion)) score += 100;
    // External file hosting links (Yandex Disk, Google Drive, etc.)
    if (/disk\.yandex\.|yadi\.sk/i.test(href)) score += 70;
    if (/drive\.google\.com|docs\.google\.com|drive\.usercontent\.google\.com/i.test(href)) score += 70;
    if (/dropbox\.com|mediafire\.com|mega\.nz/i.test(href)) score += 50;
    if (/login|register|forum|vk\.com|t\.me|youtube|youtu\.be/i.test(href)) score -= 100;

    if (score > 0) out.push({ href, text, context, score });
  }

  // Raw URL fallback, because Minecraft Inside sometimes writes the download URL as text.
  const rawRe = /https?:\/\/minecraft-inside\.ru\/download\/\d+\/?/gi;
  while ((m = rawRe.exec(html))) {
    const href = m[0];
    const context = stripHtml(html.slice(Math.max(0, m.index - 260), Math.min(html.length, m.index + 260)));
    let score = 90;
    if (targetVersion && context.includes(targetVersion)) score += 100;
    out.push({ href, text: href, context, score });
  }

  const rawExternalRe = /https?:\/\/(?:disk\.yandex\.[^\s"'<>]+|yadi\.sk\/[^\s"'<>]+|drive\.google\.com\/[^\s"'<>]+|docs\.google\.com\/[^\s"'<>]+|drive\.usercontent\.google\.com\/[^\s"'<>]+)/gi;
  while ((m = rawExternalRe.exec(html))) {
    const href = absoluteUrl(baseUrl, m[0].replace(/&amp;/g, '&'));
    const context = stripHtml(html.slice(Math.max(0, m.index - 260), Math.min(html.length, m.index + 260)));
    let score = 80;
    if (/drive\.google\.com|docs\.google\.com/i.test(href)) score += 20;
    if (/disk\.yandex\.|yadi\.sk/i.test(href)) score += 20;
    if (targetVersion && context.includes(targetVersion)) score += 100;
    out.push({ href, text: href, context, score });
  }

  const seen = new Set();
  const unique = [];
  for (const item of out.sort((a, b) => b.score - a.score)) {
    const key = item.href.replace(/[?#].*$/, '').toLowerCase() + '|' + item.score;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

async function resolveRedirectWithBrowser(url, pageUrl) {
  const { BrowserWindow } = require('electron');
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    let resolved = false;
    const ses = win.webContents.session;

    const downloadHandler = (event, item, webContents) => {
      if (webContents === win.webContents) {
        event.preventDefault();
        const finalUrl = item.getURL();
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          ses.removeListener('will-download', downloadHandler);
          resolve(finalUrl);
          win.destroy();
        }
      }
    };

    ses.on('will-download', downloadHandler);

    win.webContents.on('did-start-navigation', (e, navigationUrl) => {
      if (navigationUrl.includes('disk.yandex') || navigationUrl.includes('drive.google.com') || navigationUrl.includes('yadi.sk')) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          ses.removeListener('will-download', downloadHandler);
          resolve(navigationUrl);
          win.destroy();
        }
      }
    });

    win.webContents.on('did-finish-load', () => {
      const currentUrl = win.webContents.getURL();
      if (currentUrl.includes('disk.yandex') || currentUrl.includes('drive.google.com') || currentUrl.includes('yadi.sk')) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          ses.removeListener('will-download', downloadHandler);
          resolve(currentUrl);
          win.destroy();
        }
      }
    });

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ses.removeListener('will-download', downloadHandler);
        reject(new Error('Превышено время ожидания перехода по ссылке скачивания.'));
        win.destroy();
      }
    }, 15000);

    win.loadURL(url).catch(() => {});
  });
}

async function resolveRedirectWithChromium(url, pageUrl) {
  try {
    const electron = require('electron');
    if (electron && electron.BrowserWindow) {
      return await resolveRedirectWithBrowser(url, pageUrl);
    }
  } catch (err) {
    console.warn('[catalog] BrowserWindow redirect resolution failed/unavailable, falling back to Axios:', err.message);
  }
  
  try {
    const res = await client({
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': pageUrl
    }).get(url, { 
      responseType: 'stream',
      maxRedirects: 8
    });
    const finalUrl = res.request && res.request.res && res.request.res.responseUrl ? res.request.res.responseUrl : url;
    res.data.destroy();
    return finalUrl;
  } catch (e) {
    console.warn('[catalog] Axios redirect resolution fallback failed:', e.message);
  }
  return url;
}

/**
 * Resolve a Yandex Disk public link to a direct download URL via their public API.
 */
async function resolveYandexDiskUrl(publicUrl) {
  const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(publicUrl)}`;
  const res = await client({}).get(apiUrl, { timeout: 15000 });
  if (res.data && res.data.href) return res.data.href;
  throw new Error('Yandex Disk API не вернул ссылку скачивания.');
}

/**
 * Resolve a Google Drive share link to a direct download URL.
 * Handles /file/d/ID/... and ?id=ID formats.
 */
function resolveGoogleDriveUrl(shareUrl) {
  const cleanUrl = decodePossiblyWrappedUrl(shareUrl);
  const fileId = extractGoogleDriveId(cleanUrl);
  if (fileId) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  if (/drive\.usercontent\.google\.com/i.test(cleanUrl)) return cleanUrl;
  if (/\/folders\//i.test(cleanUrl)) throw new Error('Ссылка Google Drive ведёт на папку, а не на конкретный файл.');
  throw new Error('Не удалось извлечь ID файла из ссылки Google Drive.');
}

function isYandexDiskUrl(url) {
  return /disk\.yandex\.|yadi\.sk/i.test(url);
}

function isGoogleDriveUrl(url) {
  return /drive\.google\.com|docs\.google\.com|drive\.usercontent\.google\.com/i.test(url);
}

function isExternalHosting(url) {
  return isYandexDiskUrl(url) || isGoogleDriveUrl(url) || /mega\.nz|mediafire\.com|dropbox\.com/i.test(url);
}

async function resolveMinecraftInsideDownload(entry) {
  const pageUrl = entry.url || entry.id;
  const html = await fetchHtml(pageUrl);
  const baseUrl = pageUrl || 'https://minecraft-inside.ru/';
  const candidates = collectInsideDownloadCandidates(html, baseUrl, entry);

  if (!candidates.length) {
    throw new Error('Не удалось найти ссылку скачивания на Minecraft Inside. Откройте «Подробнее» — возможно, автор убрал файл или ссылка доступна только на странице сайта.');
  }

  const directCandidates = candidates.filter(c => /minecraft-inside\.ru\/download\/\d+/i.test(c.href));
  const externalCandidates = candidates.filter(c => isExternalHosting(c.href));
  const urls = [];
  const addUrl = (url) => {
    if (!url) return;
    const normalized = String(url).replace(/^http:\/\//i, 'https://');
    if (!urls.some(x => x.replace(/^http:\/\//i, 'https://') === normalized)) urls.push(url);
  };

  // 1) Minecraft Inside direct download links first. They sometimes return
  // HTTP 500, so downloads.js will fall back to the other URLs below.
  for (const c of directCandidates) addUrl(c.href);

  // 2) Resolve Yandex Disk public links into direct hrefs when possible.
  for (const c of externalCandidates.filter(c => isYandexDiskUrl(c.href))) {
    try {
      addUrl(await resolveYandexDiskUrl(c.href));
    } catch (e) {
      console.warn('[catalog] Yandex Disk resolution failed:', e.message);
      addUrl(c.href);
    }
  }

  // 3) Convert Google Drive share links to uc/download links when possible.
  for (const c of externalCandidates.filter(c => isGoogleDriveUrl(c.href))) {
    try {
      addUrl(resolveGoogleDriveUrl(c.href));
    } catch (e) {
      console.warn('[catalog] Google Drive resolution failed:', e.message);
      // Keep drive.usercontent links even without extracting an id; they are
      // already direct-ish and downloads.js knows how to validate the payload.
      if (/drive\.usercontent\.google\.com/i.test(c.href)) addUrl(c.href);
    }
  }

  // 4) Last fallback: other candidate URLs. This lets the downloader surface a
  // real HTTP/HTML/archive error instead of pretending there is no link.
  for (const c of candidates) addUrl(c.href);

  if (!urls.length) {
    const host = externalCandidates[0] ? new URL(externalCandidates[0].href).hostname : 'неизвестный хостинг';
    throw new Error(`Файл размещён на внешнем хостинге (${host}). Откройте «Подробнее» и скачайте файл вручную.`);
  }

  const picked = urls[0];
  const fileName = safeInsideFileName(entry, picked);
  return { url: picked, urls, fileName, fileSize: 0, external: externalCandidates.length > 0 };
}

module.exports = {
  MODRINTH,
  normalizeLoader,
  compareVersionDesc,
  extractVersions,
  detectLoader,
  dedupeByPriority,
  searchModrinth: (params) => {
    const key = `search:modrinth:${JSON.stringify(params)}`;
    return cachedApiCall(key, () => searchModrinth(params));
  },
  getModrinthVersions: (projectId) => {
    const key = `modrinth-versions:${projectId}`;
    return cachedApiCall(key, () => getModrinthVersions(projectId));
  },
  searchCurseForge: (params) => {
    const key = `search:curseforge:${JSON.stringify(params)}`;
    return cachedApiCall(key, () => searchCurseForge(params));
  },
  resolveCurseForgeDownload: (params) => {
    const key = `cf-download:${JSON.stringify(params)}`;
    return cachedApiCall(key, () => resolveCurseForgeDownload(params));
  },
  searchMinecraftInside,
  resolveMinecraftInsideDownload,
  clearApiCache
};
