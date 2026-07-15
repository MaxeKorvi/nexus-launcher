'use strict';

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { app } = require('electron');
const Downloads = require('./downloads');
const InstallState = require('./install-state');
const Settings = require('./settings');
const {
  dedupeByPriority,
  searchModrinth,
  searchCurseForge,
  resolveCurseForgeDownload,
  searchMinecraftInside,
  resolveMinecraftInsideDownload
} = require('./catalog');

const dir = (rootDir) => path.join(rootDir || Settings.getAll().gameFolder || path.join(app.getPath('home'), '.minecraft'), 'shaderpacks');

async function list({ query = '', source = 'all', sources = [], preferSource = 'curseforge', mcVersion = '', loader = '', page = 0, pageSize = 60 } = {}) {
  const requested = Array.from(new Set((sources && sources.length ? sources : (source === 'all' ? ['curseforge', 'modrinth', 'minecraft-inside'] : [source])).filter(Boolean)));
  const jobs = [];
  if (requested.includes('modrinth')) jobs.push(searchModrinth({ query, projectType: 'shader', mcVersion, loader, page, pageSize }));
  if (requested.includes('curseforge')) jobs.push(searchCurseForge({ query, type: 'shader', mcVersion, loader, page, pageSize }));
  if (requested.includes('minecraft-inside')) jobs.push(searchMinecraftInside({ section: 'shaders', query, mcVersion, loader, page, pageSize }));
  const results = await Promise.allSettled(jobs);
  const hits = [];
  const errors = [];
  for (const res of results) {
    if (res.status === 'fulfilled') {
      if (res.value.error) errors.push(res.value.error);
      hits.push(...(res.value.hits || []));
    } else errors.push(res.reason && res.reason.message ? res.reason.message : String(res.reason || 'unknown error'));
  }
  const ordered = dedupeByPriority(hits, [preferSource, 'curseforge', 'modrinth', 'minecraft-inside'].filter((x, i, arr) => x && arr.indexOf(x) === i));
  return { source: requested.length === 1 ? requested[0] : 'all', total: ordered.length, hits: ordered.slice(0, pageSize), errors };
}

async function install(shader) {
  const rootDir = shader && (shader.gameDir || shader.rootDir);
  if (!rootDir) throw new Error('Выберите установленную версию Minecraft. Шейдер должен ставиться в выбранную установку.');
  let file;
  if (shader.source === 'modrinth') {
    const axios = require('axios');
    const { data: versions } = await axios.get(`https://api.modrinth.com/v2/project/${shader.id}/version`, { timeout: 30000 });
    const loader = shader.loader || '';
    const compatible = (versions || []).filter(v => {
      const okMc = !shader.mcVersion || (v.game_versions || []).includes(shader.mcVersion);
      const okLoader = !loader || !(v.loaders || []).length || (v.loaders || []).includes(loader);
      return okMc && okLoader && (v.files || []).length;
    });
    const v = compatible[0] || (versions || []).find(x => (x.files || []).length);
    if (!v) throw new Error('Не найден совместимый файл шейдера.');
    const f = (v.files || []).find(x => x.primary) || v.files[0];
    file = { url: f.url, fileName: f.filename, fileSize: f.size };
  } else if (shader.source === 'curseforge') {
    file = await resolveCurseForgeDownload({ projectId: shader.id, fileId: shader.fileId, mcVersion: shader.mcVersion, loader: shader.loader, type: 'shader' });
  } else {
    file = await resolveMinecraftInsideDownload(shader);
  }
  const targetDir = dir(rootDir);
  const outPath = path.join(targetDir, file.fileName);
  await fsp.mkdir(targetDir, { recursive: true });
  await Downloads.start({
    id: `shader-${shader.source}-${shader.id}`,
    label: shader.title || file.fileName,
    url: file.url,
    urls: file.urls,
    path: outPath,
    size: file.fileSize,
    kind: 'shader'
  });
  await InstallState.add(rootDir, 'shaders', shader, { fileName: file.fileName, path: outPath, mcVersion: shader.mcVersion, loader: shader.loader });
  return { ok: true, fileName: file.fileName, path: outPath, rootDir };
}

async function listInstalled(rootDir) {
  const targetDir = dir(rootDir);
  const registry = await InstallState.list(rootDir, 'shaders');
  if (!fs.existsSync(targetDir)) return registry;
  const files = await fsp.readdir(targetDir);
  const physical = files.filter(f => f.endsWith('.zip') || f.endsWith('.jar')).map(f => {
    const found = registry.find(x => String(x.fileName || '').toLowerCase() === f.toLowerCase()) || {};
    return { ...found, fileName: f, path: path.join(targetDir, f), rootDir };
  });
  const extras = registry.filter(x => !physical.some(p => String(p.fileName || '').toLowerCase() === String(x.fileName || '').toLowerCase()));
  return [...physical, ...extras];
}

module.exports = { list, install, listInstalled };
