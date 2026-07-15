'use strict';

/**
 * News Service
 *  - Parses the official Minecraft news page, not fake/local launcher news.
 *  - Enriches cards from article pages to get real title, date, description and image.
 *  - Keeps a small disk cache so the home screen stays fast and usable offline.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { app } = require('electron');

const BASE_URL = 'https://www.minecraft.net';
const NEWS_URL = `${BASE_URL}/en-us/article`;
const NEWS_URLS = [NEWS_URL, `${BASE_URL}/en-us/articles`];
const CACHE_TTL_MS = 1000 * 60 * 60 * 3; // 3 hours
const MAX_ITEMS = 12;
const ARTICLE_ENRICH_LIMIT = 10;

const UPDATE_KEYWORDS = [
  'minecraft java edition',
  'java edition',
  'bedrock edition',
  'snapshot',
  'pre-release',
  'pre release',
  'release candidate',
  'changelog',
  'hotfix',
  'game drop',
  'update',
  'patch',
  'minecraft live'
];

function cachePath() {
  const base = app && app.getPath ? app.getPath('userData') : process.cwd();
  return path.join(base, 'news-cache.json');
}

async function list() {
  const cached = readCache();

  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS && cached.items && cached.items.length) {
    // Fast startup: return cache first if it is fresh. It was created from the
    // real website, so this avoids making the launcher feel frozen on startup.
    refreshCacheInBackground().catch(() => {});
    return { source: 'minecraft.net-cache', items: cached.items };
  }

  try {
    const items = await fetchOfficialMinecraftNews();
    if (items.length) {
      writeCache(items);
      return { source: 'minecraft.net', items };
    }
  } catch (error) {
    // Fall through to cache/fallback.
  }

  if (cached && cached.items && cached.items.length) {
    return { source: 'minecraft.net-cache', items: cached.items };
  }

  return {
    source: 'offline',
    items: [
      {
        title: 'Официальные новости Minecraft временно недоступны',
        link: NEWS_URL,
        pubDate: new Date().toISOString(),
        description: 'Лаунчер не смог получить новости с minecraft.net. Проверьте интернет и нажмите кнопку обновления.',
        image: null,
        category: 'News'
      }
    ]
  };
}

async function refreshCacheInBackground() {
  const items = await fetchOfficialMinecraftNews();
  if (items.length) writeCache(items);
}

async function fetchOfficialMinecraftNews() {
  let html = '';
  let lastError = null;
  for (const url of NEWS_URLS) {
    try {
      html = await fetchText(url, 12000);
      if (html.length > 1000) break;
    } catch (error) { lastError = error; }
  }
  if (!html) throw lastError || new Error('Пустой ответ minecraft.net');
  const candidates = extractArticleCandidates(html).slice(0, ARTICLE_ENRICH_LIMIT);

  const enriched = [];
  for (const candidate of candidates) {
    try {
      const article = await enrichArticle(candidate);
      if (article && article.title && article.link) enriched.push(article);
    } catch {
      if (candidate.title) enriched.push(candidate);
    }
  }

  const items = normalizeItems(enriched.length ? enriched : parseRssLikeFallback(html));
  return prioritizeUpdateNews(items).slice(0, MAX_ITEMS);
}

async function enrichArticle(candidate) {
  const html = await fetchText(candidate.link, 5000);
  const title = cleanText(
    getMeta(html, 'og:title') ||
    getMeta(html, 'twitter:title') ||
    extractTagText(html, 'h1') ||
    candidate.title
  ).replace(/\s*\|\s*Minecraft\s*$/i, '').trim();

  const description = cleanText(
    getMeta(html, 'og:description') ||
    getMeta(html, 'description') ||
    getMeta(html, 'twitter:description') ||
    candidate.description ||
    extractFirstParagraph(html)
  ).slice(0, 240);

  const image = absolutize(
    getMeta(html, 'og:image') ||
    getMeta(html, 'twitter:image') ||
    candidate.image ||
    extractFirstImage(html),
    candidate.link
  );

  const pubDate = normalizeDate(
    getMeta(html, 'article:published_time') ||
    getMeta(html, 'date') ||
    getMeta(html, 'publishdate') ||
    extractDatetime(html) ||
    candidate.pubDate
  );

  return {
    title,
    link: candidate.link,
    pubDate,
    description,
    image,
    category: cleanText(getMeta(html, 'article:section') || candidate.category || 'News')
  };
}

async function fetchText(url, timeout) {
  const { data } = await axios.get(url, {
    timeout,
    responseType: 'text',
    decompress: true,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36 NexusLauncher/1.1.11',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Connection': 'close'
    },
    validateStatus: status => status >= 200 && status < 400
  });
  return String(data || '');
}

function extractArticleCandidates(html) {
  const candidates = [];
  const seen = new Set();
  const hrefRe = /href=["']([^"']*\/article\/[^"'#?]+)[^"']*["']/gi;
  let match;

  while ((match = hrefRe.exec(html))) {
    const link = normalizeMinecraftArticleUrl(match[1]);
    if (!link || seen.has(link)) continue;
    seen.add(link);

    const start = Math.max(0, match.index - 1800);
    const end = Math.min(html.length, match.index + 2600);
    const context = html.slice(start, end);

    const title = cleanText(
      extractNearbyHeading(context) ||
      extractAttrNear(context, 'aria-label') ||
      extractAttrNear(context, 'title') ||
      slugToTitle(link)
    );
    const description = cleanText(extractNearbyParagraph(context)).slice(0, 240);
    const image = absolutize(extractBestImage(context), NEWS_URL);

    // Avoid menu/footer duplicates that are not article cards.
    if (!title || /^news$/i.test(title) || /featured news/i.test(title)) continue;

    candidates.push({ title, link, pubDate: '', description, image, category: 'News' });
  }

  return candidates;
}

function normalizeMinecraftArticleUrl(raw) {
  if (!raw) return null;
  const url = absolutize(raw, BASE_URL);
  try {
    const u = new URL(url);
    if (u.hostname !== 'www.minecraft.net' && u.hostname !== 'minecraft.net') return null;
    if (!/\/article\//.test(u.pathname)) return null;
    if (/\/article\/?$/i.test(u.pathname)) return null;
    u.hash = '';
    u.search = '';
    return u.toString();
  } catch {
    return null;
  }
}

function parseRssLikeFallback(html) {
  const items = [];
  const articleBlocks = html.match(/<article[\s\S]*?<\/article>/gi) || [];
  for (const block of articleBlocks) {
    const href = (block.match(/href=["']([^"']+)["']/i) || [])[1];
    const link = normalizeMinecraftArticleUrl(href);
    if (!link) continue;
    items.push({
      title: cleanText(extractNearbyHeading(block) || slugToTitle(link)),
      link,
      pubDate: normalizeDate(extractDatetime(block)),
      description: cleanText(extractNearbyParagraph(block)).slice(0, 240),
      image: absolutize(extractBestImage(block), NEWS_URL),
      category: 'News'
    });
  }
  return items;
}

function normalizeItems(items) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    if (!item || !item.link || seen.has(item.link)) continue;
    seen.add(item.link);
    out.push({
      title: cleanText(item.title || slugToTitle(item.link)),
      link: item.link,
      pubDate: normalizeDate(item.pubDate),
      description: cleanText(item.description || '').slice(0, 240),
      image: item.image ? absolutize(item.image, item.link) : null,
      category: item.category || 'News'
    });
  }
  return out.filter(item => item.title && item.link);
}

function prioritizeUpdateNews(items) {
  return items
    .map(item => ({ ...item, _score: scoreNews(item) }))
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return new Date(b.pubDate || 0) - new Date(a.pubDate || 0);
    })
    .map(({ _score, ...item }) => item);
}

function scoreNews(item) {
  const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
  let score = 0;
  for (const kw of UPDATE_KEYWORDS) {
    if (text.includes(kw)) score += 10;
  }
  if (/marketplace|realms|dungeons|movie|shop/i.test(text)) score -= 2;
  if (item.image) score += 1;
  if (item.pubDate) score += Math.max(0, 4 - Math.floor((Date.now() - new Date(item.pubDate).getTime()) / 86400000 / 30));
  return score;
}

function getMeta(html, name) {
  const escaped = escapeRegex(name);
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeHtml(m[1]);
  }
  return '';
}

function extractNearbyHeading(html) {
  const h = html.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
  return h ? cleanText(h[1]) : '';
}

function extractNearbyParagraph(html) {
  const p = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  return p ? cleanText(p[1]) : '';
}

function extractFirstParagraph(html) {
  const blocks = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  for (const block of blocks) {
    const text = cleanText(block);
    if (text.length > 50) return text;
  }
  return '';
}

function extractAttrNear(html, attr) {
  const re = new RegExp(`${attr}=["']([^"']+)["']`, 'i');
  const m = html.match(re);
  return m ? decodeHtml(m[1]) : '';
}

function extractDatetime(html) {
  return (
    (html.match(/<time[^>]+datetime=["']([^"']+)["']/i) || [])[1] ||
    (html.match(/datetime=["']([^"']+)["']/i) || [])[1] ||
    ''
  );
}

function extractFirstImage(html) {
  return extractBestImage(html);
}

function extractBestImage(html) {
  const og = getMeta(html, 'og:image') || getMeta(html, 'twitter:image');
  if (og) return og;

  const source = html.match(/<source[^>]+srcset=["']([^"']+)["']/i);
  if (source) return pickFromSrcSet(source[1]);

  const img = html.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/i);
  if (img) return pickFromSrcSet(img[1]);

  const dataImage = html.match(/(?:image|thumbnail|src)["']?\s*:\s*["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/i);
  if (dataImage) return dataImage[1];

  return null;
}

function pickFromSrcSet(value) {
  if (!value) return null;
  const first = String(value).split(',')[0].trim().split(/\s+/)[0];
  return first || null;
}

function extractTagText(html, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i');
  const m = html.match(re);
  return m ? cleanText(m[1]) : '';
}

function slugToTitle(link) {
  try {
    const slug = new URL(link).pathname.split('/').filter(Boolean).pop() || '';
    return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  } catch {
    return '';
  }
}

function normalizeDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function cleanText(value) {
  return decodeHtml(String(value || ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

function absolutize(raw, base) {
  if (!raw) return null;
  try {
    const fixed = String(raw).trim().replace(/^\/\//, 'https://');
    return new URL(fixed, base || BASE_URL).toString();
  } catch {
    return null;
  }
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readCache() {
  try {
    const file = cachePath();
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(items) {
  try {
    const file = cachePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ savedAt: Date.now(), items }, null, 2));
  } catch {
    // Cache is optional.
  }
}

module.exports = { list, fetchOfficialMinecraftNews, extractArticleCandidates };
