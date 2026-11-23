'use strict';

/**
 * Modpacks Repository
 *  - Search in Modrinth / CurseForge / Minecraft Inside
 *  - Import .mrpack / CurseForge ZIP
 *  - Installs the required Minecraft runtime in the pack directory
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { app } = require('electron');
const JSZip = require('jszip');
const Downloads = require('./downloads');
const Settings = require('./settings');
const { getCurseForgeApiKey, curseForgeErrorMessage, FALLBACK_CF_KEY } = require('./curseforge-auth');
const Versions = require('./versions');
const {
  MODRINTH,
  dedupeByPriority,
  searchModrinth,
  getModrinthVersions,
  searchCurseForge,
  resolveCurseForgeDownload,
  searchMinecraftInside,
  resolveMinecraftInsideDownload
} = require('./catalog');
const { sanitizeName, mavenPath, parseMavenCoordinate } = require('./shared');

const FABRIC_META = 'https://meta.fabricmc.net/v2';
const QUILT_META = 'https://meta.quiltmc.org/v3';

const baseGameDir = () => Settings.getAll().gameFolder || path.join(app.getPath('home'), '.minecraft');
const modpacksDir = () => Settings.getAll().modpacksFolder || path.join(baseGameDir(), 'modpacks');
const timeoutMs = () => Math.max(5000, Number(Settings.getAll().networkTimeout || 30) * 1000);

function safeJoin(root, rel) {
  const normalized = path.normalize(String(rel || '')).replace(/^([.][.][\\/])+/, '');
  const target = path.join(root, normalized);
  const rootResolved = path.resolve(root);
  const targetResolved = path.resolve(target);
  if (!targetResolved.startsWith(rootResolved)) throw new Error('Blocked unsafe path in modpack: ' + rel);
  return target;
}

function libraryArtifact(lib) {
  if (lib.downloads && lib.downloads.artifact && lib.downloads.artifact.url) {
    return {
      url: lib.downloads.artifact.url,
      rel: lib.downloads.artifact.path,
      size: lib.downloads.artifact.size,
      sha1: lib.downloads.artifact.sha1
    };
  }
  const rel = mavenPath(lib.name);
  if (rel && lib.url) return { url: String(lib.url).replace(/\/?$/, '/') + rel, rel, size: lib.size, sha1: lib.sha1 };
  return null;
}

async function downloadProfileLibraries(profile, rootDir) {
  for (const lib of profile.libraries || []) {
    const artifact = libraryArtifact(lib);
    if (!artifact) continue;
    await Downloads.start({
      id: `loader-lib-${lib.name}`,
      url: artifact.url,
      path: path.join(rootDir, 'libraries', artifact.rel),
      size: artifact.size,
      sha1: artifact.sha1,
      kind: 'library'
    });
  }
}

async function installFabricProfile(rootDir, minecraftVersion, loaderVersion) {
  const url = `${FABRIC_META}/versions/loader/${encodeURIComponent(minecraftVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`;
  const { data: profile } = await axios.get(url, { timeout: timeoutMs() });
  profile.id = profile.id || `fabric-loader-${loaderVersion}-${minecraftVersion}`;
  profile.inheritsFrom = profile.inheritsFrom || minecraftVersion;
  profile.jar = profile.jar || minecraftVersion;
  profile.type = profile.type || 'release';
  const dir = path.join(rootDir, 'versions', profile.id);
  await fsp.mkdir(dir, { recursive: true });
  await downloadProfileLibraries(profile, rootDir);
  await fsp.writeFile(path.join(dir, `${profile.id}.json`), JSON.stringify(profile, null, 2));
  return profile.id;
}

async function installQuiltProfile(rootDir, minecraftVersion, loaderVersion) {
  const url = `${QUILT_META}/versions/loader/${encodeURIComponent(minecraftVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`;
  const { data: profile } = await axios.get(url, { timeout: timeoutMs() });
  profile.id = profile.id || `quilt-loader-${loaderVersion}-${minecraftVersion}`;
  profile.inheritsFrom = profile.inheritsFrom || minecraftVersion;
  profile.jar = profile.jar || minecraftVersion;
  profile.type = profile.type || 'release';
  const dir = path.join(rootDir, 'versions', profile.id);
  await fsp.mkdir(dir, { recursive: true });
  await downloadProfileLibraries(profile, rootDir);
  await fsp.writeFile(path.join(dir, `${profile.id}.json`), JSON.stringify(profile, null, 2));
  return profile.id;
}

function dependenciesFromManifest(manifest, type) {
  if (type === 'mrpack') return manifest.dependencies || {};
  const deps = {};
  if (manifest.minecraft && manifest.minecraft.version) deps.minecraft = manifest.minecraft.version;
  const loaders = (manifest.minecraft && manifest.minecraft.modLoaders) || [];
  const active = loaders.find(l => l.primary) || loaders[0];
  if (active && active.id) {
    const id = String(active.id);
    if (id.startsWith('fabric-')) deps['fabric-loader'] = id.replace(/^fabric-/, '');
    if (id.startsWith('quilt-')) deps['quilt-loader'] = id.replace(/^quilt-/, '');
    if (id.startsWith('forge-')) deps.forge = id.replace(/^forge-/, '');
    if (id.startsWith('neoforge-')) deps.neoforge = id.replace(/^neoforge-/, '');
  }
  return deps;
}

async function installRuntime(rootDir, manifest, type) {
  const deps = dependenciesFromManifest(manifest, type);
  const minecraft = deps.minecraft;
  if (!minecraft) return { versionId: null, warnings: ['В манифесте не указана версия Minecraft'] };

  const loaderCandidates = [
    ['forge', deps.forge],
    ['neoforge', deps.neoforge],
    ['fabric', deps['fabric-loader']],
    ['quilt', deps['quilt-loader']]
  ].filter(([, version]) => version);

  if (loaderCandidates.length) {
    const [loader, loaderVersion] = loaderCandidates[0];
    const available = await Versions.getLoaders(minecraft);
    const exists = available.some(x => x.loader === loader);
    if (!exists) throw new Error(`${loader} недоступен для Minecraft ${minecraft}. Сборка требует ${loaderVersion}.`);
    const installed = await Versions.install(minecraft, { gameDir: rootDir, loader, loaderVersion });
    return {
      versionId: installed.versionId || installed.id,
      minecraft,
      loader,
      loaderVersion: installed.loaderVersion || loaderVersion,
      warnings: []
    };
  }

  const installed = await Versions.install(minecraft, { gameDir: rootDir, skipInstallMeta: true });
  return { versionId: installed.versionId || minecraft, minecraft, loader: 'vanilla', warnings: [] };
}

function priority(preferSource) {
  const base = ['curseforge', 'modrinth', 'minecraft-inside'];
  if (!preferSource || !base.includes(preferSource)) return base;
  return [preferSource, ...base.filter(x => x !== preferSource)];
}


function stripHtmlLocal(value) {
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

function absoluteUrl(base, href) {
  try { return new URL(href, base).toString(); } catch { return href || ''; }
}

function firstMatch(text, re) {
  const m = String(text || '').match(re);
  return m ? m[1] : '';
}

function modrinthVersionInfo(version) {
  const file = (version.files || []).find(f => f.primary && /\.mrpack$/i.test(f.filename || ''))
    || (version.files || []).find(f => /\.mrpack$/i.test(f.filename || ''))
    || (version.files || [])[0];
  return {
    id: version.id,
    source: 'modrinth',
    title: version.name || version.version_number || version.id,
    versionNumber: version.version_number || '',
    versionType: version.version_type || '',
    mcVersions: version.game_versions || [],
    loaders: version.loaders || [],
    publishedAt: version.date_published,
    downloads: version.downloads || 0,
    fileName: file && file.filename,
    fileSize: file && file.size,
    installable: Boolean(file && /\.mrpack$/i.test(file.filename || ''))
  };
}

function curseForgeLoaderName(file) {
  const indexes = file.latestFilesIndexes || [];
  const raw = Array.from(new Set(indexes.map(x => x.modLoader).filter(Boolean)));
  return raw.length ? raw.join(', ') : '';
}

function curseForgeVersionInfo(file) {
  const gameVersions = Array.from(new Set((file.gameVersions || []).filter(v => /^1\.\d+/.test(String(v)))));
  const loaders = Array.from(new Set((file.gameVersions || []).filter(v => /forge|fabric|quilt|neoforge/i.test(String(v))).map(v => String(v).toLowerCase())));
  return {
    id: file.id,
    fileId: file.id,
    source: 'curseforge',
    title: file.displayName || file.fileName || String(file.id),
    versionNumber: file.displayName || '',
    versionType: file.releaseType === 1 ? 'release' : file.releaseType === 2 ? 'beta' : file.releaseType === 3 ? 'alpha' : '',
    mcVersions: gameVersions,
    loaders,
    publishedAt: file.fileDate,
    downloads: file.downloadCount || 0,
    fileName: file.fileName,
    fileSize: file.fileLength,
    installable: true
  };
}

async function getModrinthDetails(pack) {
  const { data: project } = await axios.get(`${MODRINTH}/project/${encodeURIComponent(pack.id)}`, { timeout: timeoutMs() });
  const versions = await getModrinthVersions(pack.id);
  const mapped = versions
    .filter(v => (v.files || []).some(f => /\.mrpack$/i.test(f.filename || '')))
    .map(modrinthVersionInfo);

  return {
    id: project.id || pack.id,
    source: 'modrinth',
    slug: project.slug || pack.slug,
    title: project.title || pack.title,
    author: project.team || pack.author || '',
    icon: project.icon_url || pack.icon || '',
    url: `https://modrinth.com/modpack/${project.slug || pack.slug || pack.id}`,
    summary: project.description || pack.description || '',
    description: project.body || project.description || pack.description || '',
    categories: project.categories || [],
    mcVersions: project.game_versions || Array.from(new Set(mapped.flatMap(v => v.mcVersions))),
    loaders: project.loaders || Array.from(new Set(mapped.flatMap(v => v.loaders))),
    downloads: project.downloads || pack.downloads || 0,
    followers: project.followers || 0,
    screenshots: (project.gallery || []).map(g => g.url || g.raw_url || g.featured).filter(Boolean),
    versions: mapped
  };
}

async function getCurseForgeDetails(pack) {
  const apiKey = getCurseForgeApiKey();
  if (!apiKey) {
    return {
      ...pack,
      source: 'curseforge',
      description: pack.description || 'Для полного описания, скриншотов и списка версий CurseForge укажите CF_API_KEY. Можно создать launcher-source/.env с этой строкой.',
      screenshots: [],
      versions: [],
      error: 'Для просмотра версий CurseForge нужна переменная CF_API_KEY.'
    };
  }

  let headers = { 'x-api-key': apiKey };
  let modData, filesData;
  try {
    [{ data: modData }, { data: filesData }] = await Promise.all([
      axios.get(`https://api.curseforge.com/v1/mods/${encodeURIComponent(pack.id)}`, { headers, timeout: timeoutMs() }),
      axios.get(`https://api.curseforge.com/v1/mods/${encodeURIComponent(pack.id)}/files`, {
        headers,
        timeout: timeoutMs(),
        params: { pageSize: 50, index: 0 }
      })
    ]);
  } catch (err) {
    if ((err.response && (err.response.status === 401 || err.response.status === 403)) && apiKey !== FALLBACK_CF_KEY) {
      try {
        headers = { 'x-api-key': FALLBACK_CF_KEY };
        [{ data: modData }, { data: filesData }] = await Promise.all([
          axios.get(`https://api.curseforge.com/v1/mods/${encodeURIComponent(pack.id)}`, { headers, timeout: timeoutMs() }),
          axios.get(`https://api.curseforge.com/v1/mods/${encodeURIComponent(pack.id)}/files`, {
            headers,
            timeout: timeoutMs(),
            params: { pageSize: 50, index: 0 }
          })
        ]);
      } catch (err2) {
        return {
          ...pack,
          source: 'curseforge',
          description: curseForgeErrorMessage(err2),
          screenshots: [],
          versions: [],
          error: curseForgeErrorMessage(err2)
        };
      }
    } else {
      return {
        ...pack,
        source: 'curseforge',
        description: curseForgeErrorMessage(err),
        screenshots: [],
        versions: [],
        error: curseForgeErrorMessage(err)
      };
    }
  }

  const project = modData.data || {};
  const files = filesData.data || [];
  const mapped = files.map(file => ({
    id: String(file.id),
    title: file.displayName || file.fileName || `File ${file.id}`,
    versionNumber: file.displayName || file.fileName || `File ${file.id}`,
    fileName: file.fileName || '',
    fileId: file.id,
    fileDate: file.fileDate || '',
    fileLength: file.fileLength || 0,
    mcVersions: (file.gameVersions || []).filter(v => /^\d+\.\d+(\.\d+)?$/.test(v)),
    loaders: (file.gameVersions || []).filter(v => /forge|fabric|quilt|neo/i.test(v.toLowerCase())).map(v => v.toLowerCase()),
    versionType: file.releaseType === 1 ? 'release' : file.releaseType === 2 ? 'beta' : file.releaseType === 3 ? 'alpha' : 'release',
    downloads: file.downloadCount || 0
  }));

  return {
    ...pack,
    source: 'curseforge',
    title: project.name || pack.title,
    author: ((project.authors || [])[0] || {}).name || pack.author || '',
    icon: (project.logo || {}).thumbnailUrl || (project.logo || {}).url || pack.icon || '',
    url: project.links && project.links.websiteUrl ? project.links.websiteUrl : pack.url,
    description: project.summary || pack.description || '',
    downloads: project.downloadCount || pack.downloads || 0,
    followers: project.thumbsUpCount || 0,
    screenshots: (project.screenshots || []).map(s => s.thumbnailUrl || s.url).filter(Boolean),
    versions: mapped
  };
}

async function getMinecraftInsideDetails(pack) {
  let description = pack.description || '';
  let screenshots = [];
  let title = pack.title;
  try {
    const { data: html } = await axios.get(pack.url || pack.id, {
      timeout: timeoutMs(),
      responseType: 'text',
      headers: { 'User-Agent': 'NexusLauncher/1.1.14', Accept: 'text/html,*/*' }
    });
    title = stripHtmlLocal(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)) || title;
    const descHtml = firstMatch(html, /<div[^>]+class="[^"]*(?:full|description|text|article|content)[^"]*"[^>]*>([\s\S]{100,5000}?)<\/div>/i);
    description = stripHtmlLocal(descHtml) || description;
    const imgMatches = Array.from(String(html).matchAll(/<img[^>]+src="([^"]+)"/gi)).map(m => absoluteUrl(pack.url || pack.id, m[1]));
    screenshots = Array.from(new Set(imgMatches.filter(u => /\.(png|jpg|jpeg|webp)(\?|$)/i.test(u)))).slice(0, 10);
  } catch {}

  return {
    ...pack,
    source: 'minecraft-inside',
    title,
    description,
    screenshots,
    versions: [{
      id: pack.id,
      source: 'minecraft-inside',
      title: 'Основная версия с Minecraft Inside',
      versionNumber: '',
      mcVersions: pack.mcVersions || [],
      loaders: pack.loader ? [pack.loader] : [],
      installable: true
    }]
  };
}

async function getDetails(pack = {}) {
  if (!pack || !pack.id || !pack.source) throw new Error('Не выбрана сборка.');
  if (pack.source === 'modrinth') return getModrinthDetails(pack);
  if (pack.source === 'curseforge') return getCurseForgeDetails(pack);
  if (pack.source === 'minecraft-inside') return getMinecraftInsideDetails(pack);
  throw new Error('Неизвестный источник сборки.');
}


function getCuratedFallbackModpacks({ query = '', mcVersion = '', loader = '' } = {}) {
  const packs = [
    {
      id: 925200,
      slug: 'all-the-mods-10',
      title: 'All the Mods 10 - ATM10',
      description: 'Флагманская сборка 2026 года на NeoForge с более чем 500 модами, квестами и сбалансированным эндгеймом.',
      author: 'ATMTeam',
      downloads: 23213599,
      icon: 'https://media.forgecdn.net/avatars/1182/438/638755918649288941.png',
      banner: 'https://media.forgecdn.net/attachments/980/939/2024-10-02_23.png',
      mcVersions: ['1.21.1'],
      loader: 'neoforge',
      loaders: ['neoforge'],
      dateCreated: '2024-07-01T00:00:00Z',
      source: 'curseforge',
      badge: '★ Хит'
    },
    {
      id: 284144,
      slug: 'pixelmon-modpack',
      title: 'Pixelmon Modpack',
      description: 'Легендарная вселенная покемонов в Minecraft: исследование мира, тренировки, битвы тренеров и гимы.',
      author: 'PixelmonMod',
      downloads: 14820100,
      icon: 'https://media.forgecdn.net/avatars/98/626/636287950529887713.png',
      banner: 'https://media.forgecdn.net/attachments/thumbnails/983/80/310/172/2024-10-05_14.png',
      mcVersions: ['1.16.5', '1.12.2'],
      loader: 'forge',
      loaders: ['forge'],
      dateCreated: '2016-04-12T00:00:00Z',
      source: 'curseforge',
      badge: '★ Классика'
    },
    {
      id: 452013,
      slug: 'better-mc-forge',
      title: 'Better MC [FORGE] - BMC4',
      description: 'Полная переработка выживания: новые измерения, боссы, сотни данжей и улучшенная генерация мира.',
      author: 'SHXRKIE',
      downloads: 18512300,
      icon: 'https://media.forgecdn.net/avatars/535/512/637862900741870635.png',
      banner: 'https://media.forgecdn.net/attachments/983/79/310/172/2024-10-03_12.png',
      mcVersions: ['1.20.1'],
      loader: 'forge',
      loaders: ['forge'],
      dateCreated: '2021-03-10T00:00:00Z',
      source: 'curseforge',
      badge: '🔥 Топ'
    },
    {
      id: 452014,
      slug: 'better-mc-fabric',
      title: 'Better MC [FABRIC] - BMC4',
      description: 'Максимальная оптимизация на Fabric, встроенные шейдеры, переработанное ванильное приключение.',
      author: 'SHXRKIE',
      downloads: 12340500,
      icon: 'https://media.forgecdn.net/avatars/612/820/637996530663471018.png',
      banner: 'https://media.forgecdn.net/attachments/980/938/310/172/image-1.png',
      mcVersions: ['1.21.1', '1.20.1'],
      loader: 'fabric',
      loaders: ['fabric'],
      dateCreated: '2021-05-15T00:00:00Z',
      source: 'curseforge',
      badge: '★ Популярная'
    },
    {
      id: 285109,
      slug: 'rlcraft',
      title: 'RLCraft',
      description: 'Ультра-хардкорное выживание с жаждой, температурой, драконами и глубоким реализмом.',
      author: 'Shivaxi',
      downloads: 28914000,
      icon: 'https://media.forgecdn.net/avatars/209/781/636973307524949511.png',
      banner: 'https://media.forgecdn.net/attachments/980/942/310/172/2024-10-03_12.png',
      mcVersions: ['1.12.2'],
      loader: 'forge',
      loaders: ['forge'],
      dateCreated: '2018-09-02T00:00:00Z',
      source: 'curseforge',
      badge: '★ Легендарная'
    },
    {
      id: 843102,
      slug: 'create-perfect-world',
      title: 'Create: Perfect World',
      description: 'Эстетичная индустриальная сборка вокруг Create: железные дороги, кинематика и автоматизация.',
      author: 'MrBeardstone',
      downloads: 8421000,
      icon: 'https://media.forgecdn.net/avatars/878/321/638309123847291823.png',
      banner: 'https://media.forgecdn.net/attachments/983/81/310/172/2024-10-05_14.png',
      mcVersions: ['1.20.1'],
      loader: 'forge',
      loaders: ['forge'],
      dateCreated: '2023-04-18T00:00:00Z',
      source: 'curseforge',
      badge: '★ Выбор игроков'
    }
  ];

  let filtered = packs;
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }
  if (mcVersion) {
    filtered = filtered.filter(p => p.mcVersions.includes(mcVersion));
  }
  if (loader) {
    filtered = filtered.filter(p => p.loader === loader || p.loaders.includes(loader));
  }
  return filtered;
}

async function search({ query = '', source = 'all', sources = [], preferSource = 'curseforge', mcVersion = '', loader = '', page = 0, pageSize = 60 } = {}) {
  const requested = Array.from(new Set((sources && sources.length ? sources : (source === 'all' ? ['curseforge', 'modrinth', 'minecraft-inside'] : [source])).filter(Boolean)));
  const jobs = [];
  if (requested.includes('modrinth')) jobs.push(searchModrinth({ query, projectType: 'modpack', mcVersion, loader, page, pageSize, index: query ? 'relevance' : 'downloads' }));
  if (requested.includes('curseforge')) jobs.push(searchCurseForge({ query, type: 'modpack', mcVersion, loader, page, pageSize }));
  if (requested.includes('minecraft-inside')) jobs.push(searchMinecraftInside({ section: 'modpacks', query, mcVersion, loader, page, pageSize }));

  const responses = await Promise.allSettled(jobs);
  const hits = [];
  const errors = [];
  for (const res of responses) {
    if (res.status === 'fulfilled') {
      if (res.value.error) errors.push(res.value.error);
      hits.push(...(res.value.hits || []));
    } else {
      errors.push(res.reason && res.reason.message ? res.reason.message : String(res.reason || 'unknown error'));
    }
  }

  const deduped = dedupeByPriority(hits, priority(preferSource));
  deduped.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));

  if (!deduped.length) {
    const fallbackPacks = getCuratedFallbackModpacks({ query, mcVersion, loader });
    if (fallbackPacks.length) {
      return { source: 'curated-fallback', total: fallbackPacks.length, hits: fallbackPacks.slice(0, pageSize), errors };
    }
  }

  return { source: requested.length === 1 ? requested[0] : 'all', total: deduped.length, hits: deduped.slice(0, pageSize), errors };
}

async function listLocal() {
  const dir = modpacksDir();
  if (!fs.existsSync(dir)) return [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries.filter(x => x.isDirectory())) {
    const root = path.join(dir, e.name);
    let meta = {};
    try { meta = JSON.parse(await fsp.readFile(path.join(root, 'nexus-modpack.json'), 'utf8')); } catch {}
    out.push({ name: e.name, path: root, ...meta });
  }
  return out.sort((a, b) => String(b.installedAt || '').localeCompare(String(a.installedAt || '')));
}

async function install(pack) {
  let file = null;
  if (pack.source === 'modrinth') {
    const versions = await getModrinthVersions(pack.id);
    const filtered = versions.filter(v => (v.files || []).some(f => /\.mrpack$/i.test(f.filename || '')));
    const selectedVersion = (pack.versionId && versions.find(x => x.id === pack.versionId))
      || (pack.versionId && filtered.find(x => x.id === pack.versionId))
      || filtered.find(x => x.version_type === 'release')
      || filtered[0];
    if (!selectedVersion) throw new Error('У сборки нет .mrpack файла для установки.');
    const selectedFile = (selectedVersion.files || []).find(f => f.primary && /\.mrpack$/i.test(f.filename || '')) || (selectedVersion.files || []).find(f => /\.mrpack$/i.test(f.filename || ''));
    if (!selectedFile) throw new Error('У выбранной версии сборки нет файла .mrpack.');
    file = { url: selectedFile.url, fileName: selectedFile.filename, fileSize: selectedFile.size, sha1: selectedFile.hashes && selectedFile.hashes.sha1 };
  } else if (pack.source === 'curseforge') {
    file = await resolveCurseForgeDownload({ projectId: pack.id, fileId: pack.fileId, mcVersion: pack.mcVersion, loader: pack.loader, type: 'modpack' });
  } else if (pack.source === 'minecraft-inside') {
    file = await resolveMinecraftInsideDownload(pack);
  } else {
    throw new Error('Неизвестный источник сборки.');
  }

  const tmpPath = path.join(app.getPath('temp'), file.fileName || `pack-${Date.now()}.zip`);
  await Downloads.start({
    id: `pack-${pack.source}-${pack.id}`,
    label: pack.title || file.fileName,
    url: file.url,
    urls: file.urls,
    path: tmpPath,
    size: file.fileSize,
    sha1: file.sha1,
    kind: 'modpack'
  });
  const result = await importZip(tmpPath);
  try {
    const metaPath = path.join(result.path, 'nexus-modpack.json');
    const meta = fs.existsSync(metaPath) ? JSON.parse(await fsp.readFile(metaPath, 'utf8')) : {};
    const merged = {
      ...meta,
      catalogId: pack.id || '',
      catalogSource: pack.source || '',
      catalogSlug: pack.slug || '',
      catalogTitle: pack.title || meta.name || '',
      catalogUrl: pack.url || '',
      selectedPackVersionId: pack.versionId || pack.fileId || '',
      selectedPackFileName: file.fileName || ''
    };
    await fsp.writeFile(metaPath, JSON.stringify(merged, null, 2));
    return { ok: true, fileName: file.fileName, ...result, ...merged };
  } catch {
    return { ok: true, fileName: file.fileName, ...result, catalogId: pack.id || '', catalogSource: pack.source || '' };
  }
}

async function extractOverrides(zip, dest, prefix = 'overrides/') {
  const files = Object.keys(zip.files).filter(p => p.startsWith(prefix));
  const limit = 12; // Bounded concurrency to avoid exceeding FD limit
  for (let i = 0; i < files.length; i += limit) {
    const chunk = files.slice(i, i + limit);
    await Promise.all(chunk.map(async (fp) => {
      const rel = fp.slice(prefix.length);
      if (!rel) return;
      const target = safeJoin(dest, rel);
      if (zip.files[fp].dir) {
        await fsp.mkdir(target, { recursive: true });
      } else {
        await fsp.mkdir(path.dirname(target), { recursive: true });
        const content = await zip.files[fp].async('nodebuffer');
        await fsp.writeFile(target, content);
      }
    }));
  }
}

async function importZip(zipPath) {
  const buf = await fsp.readFile(zipPath);
  const zip = await JSZip.loadAsync(buf);
  let manifest = null;
  let type = null;
  if (zip.file('modrinth.index.json')) {
    manifest = JSON.parse(await zip.file('modrinth.index.json').async('string'));
    type = 'mrpack';
  } else if (zip.file('manifest.json')) {
    manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    type = 'curseforge';
  } else {
    throw new Error('Неизвестный формат сборки: нет modrinth.index.json или manifest.json');
  }

  const name = sanitizeName(manifest.name || path.basename(zipPath).replace(/\.(zip|mrpack)$/i, ''));
  const dest = path.join(modpacksDir(), name);
  await fsp.mkdir(dest, { recursive: true });

  await extractOverrides(zip, dest, 'overrides/');
  if (type === 'mrpack') await extractOverrides(zip, dest, 'client-overrides/');

  const warnings = [];
  if (type === 'mrpack' && manifest.files) {
    const jobs = [];
    for (const f of manifest.files) {
      if (f.env && f.env.client === 'unsupported') continue;
      if (!f.downloads || !f.downloads[0] || !f.path) continue;
      jobs.push(Downloads.start({
        id: `mpmod-${sanitizeName(name)}-${path.basename(f.path)}`,
        label: path.basename(f.path),
        url: f.downloads[0],
        path: safeJoin(dest, f.path),
        size: f.fileSize,
        sha1: f.hashes && f.hashes.sha1,
        kind: 'mod'
      }));
    }
    await Promise.all(jobs);
  }
  if (type === 'curseforge' && Array.isArray(manifest.files) && manifest.files.length) {
    const modsFolder = path.join(dest, 'mods');
    await fsp.mkdir(modsFolder, { recursive: true });
    const cfFiles = manifest.files.filter(f => f && (f.projectID || f.projectId) && (f.fileID || f.fileId));
    const batchSize = 5;
    for (let i = 0; i < cfFiles.length; i += batchSize) {
      const chunk = cfFiles.slice(i, i + batchSize);
      await Promise.all(chunk.map(async f => {
        const pId = f.projectID || f.projectId;
        const fId = f.fileID || f.fileId;
        try {
          const resolved = await resolveCurseForgeDownload({ projectId: pId, fileId: fId, type: 'mod' });
          if (resolved && resolved.url) {
            const fileName = resolved.fileName || `cf-${pId}-${fId}.jar`;
            await Downloads.start({
              id: `cfmod-${sanitizeName(name)}-${pId}-${fId}`,
              label: fileName,
              url: resolved.url,
              urls: resolved.urls,
              path: path.join(modsFolder, fileName),
              size: resolved.fileSize || 0,
              kind: 'mod'
            });
          }
        } catch (err) {
          warnings.push(`Не удалось скачать CurseForge мод ${pId}:${fId}: ${err.message}`);
        }
      }));
    }
  }

  const runtime = await installRuntime(dest, manifest, type);
  warnings.push(...(runtime.warnings || []));

  const meta = {
    name,
    type,
    source: type === 'mrpack' ? 'Modrinth' : 'CurseForge ZIP',
    path: dest,
    versionId: runtime.versionId,
    minecraft: runtime.minecraft,
    loader: runtime.loader,
    loaderVersion: runtime.loaderVersion,
    installedAt: new Date().toISOString(),
    warnings
  };
  await fsp.writeFile(path.join(dest, 'nexus-modpack.json'), JSON.stringify(meta, null, 2));
  return { ok: true, ...meta };
}

async function exportPack(packNameOrPath) {
  let packDir = packNameOrPath;
  if (!packDir || !path.isAbsolute(packDir)) {
    const candidate = path.join(modpacksDir(), packNameOrPath || '');
    if (fs.existsSync(candidate)) packDir = candidate;
    else packDir = baseGameDir();
  }
  let meta = {};
  const metaPath = path.join(packDir, 'nexus-modpack.json');
  const installMetaPath = path.join(packDir, 'nexus-install.json');
  if (fs.existsSync(metaPath)) {
    try { meta = JSON.parse(await fsp.readFile(metaPath, 'utf8')); } catch {}
  } else if (fs.existsSync(installMetaPath)) {
    try { meta = JSON.parse(await fsp.readFile(installMetaPath, 'utf8')); } catch {}
  }
  const mcVersion = meta.minecraft || meta.versionId || '1.20.1';
  const loader = meta.loader || 'fabric';
  const loaderVersion = meta.loaderVersion || (loader === 'fabric' ? '0.15.11' : '');

  const zip = new JSZip();
  const modsPath = path.join(packDir, 'mods');
  const files = [];
  if (fs.existsSync(modsPath)) {
    const list = await fsp.readdir(modsPath);
    for (const f of list) {
      if (f.endsWith('.jar')) {
        const buf = await fsp.readFile(path.join(modsPath, f));
        zip.file('overrides/mods/' + f, buf);
        files.push({ path: 'mods/' + f, downloads: ['local://' + f] });
      }
    }
  }
  const packName = sanitizeName(meta.name || path.basename(packDir));
  const manifest = {
    formatVersion: 1,
    game: 'minecraft',
    versionId: mcVersion,
    name: packName,
    files,
    dependencies: {
      minecraft: mcVersion,
      ...(loader && loader !== 'vanilla' ? { [`${loader}-loader`]: loaderVersion || '*' } : {})
    }
  };
  zip.file('modrinth.index.json', JSON.stringify(manifest, null, 2));
  const outDir = path.join(app.getPath('home'), 'Desktop');
  const out = path.join(outDir, `${packName}.mrpack`);
  await fsp.mkdir(path.dirname(out), { recursive: true });
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  await fsp.writeFile(out, buf);
  return { ok: true, path: out };
}

module.exports = { search, getDetails, listLocal, install, importZip, exportPack };
