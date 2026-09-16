'use strict';

/**
 * Mods Repository
 *  - Supports Modrinth, CurseForge and Minecraft Inside.
 *  - Filters by Minecraft version and loader.
 *  - Installs mods into the selected instance's mods/ folder when gameDir/rootDir is provided.
 */

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { app } = require('electron');
const Downloads = require('./downloads');
const InstallState = require('./install-state');
const Settings = require('./settings');
const {
  normalizeLoader,
  dedupeByPriority,
  searchModrinth,
  getModrinthVersions,
  searchCurseForge,
  resolveCurseForgeDownload,
  searchMinecraftInside,
  resolveMinecraftInsideDownload
} = require('./catalog');

const defaultRoot = () => Settings.getAll().gameFolder || path.join(app.getPath('home'), '.minecraft');
const modsDir = (rootDir) => path.join(rootDir || defaultRoot(), 'mods');

function resultPriority(preferSource) {
  const base = ['curseforge', 'modrinth', 'minecraft-inside'];
  if (!preferSource || !base.includes(preferSource)) return base;
  return [preferSource, ...base.filter(x => x !== preferSource)];
}

async function search({ query = '', source = 'all', sources = [], preferSource = 'curseforge', mcVersion = '', loader = '', page = 0, pageSize = 60 } = {}) {
  const requested = Array.from(new Set((sources && sources.length ? sources : (source === 'all' ? ['curseforge', 'modrinth', 'minecraft-inside'] : [source])).filter(Boolean)));
  const jobs = [];
  if (requested.includes('modrinth')) jobs.push(searchModrinth({ query, projectType: 'mod', mcVersion, loader, page, pageSize }));
  if (requested.includes('curseforge')) jobs.push(searchCurseForge({ query, type: 'mod', mcVersion, loader, page, pageSize }));
  if (requested.includes('minecraft-inside')) jobs.push(searchMinecraftInside({ section: 'mods', query, mcVersion, loader, page, pageSize }));

  const responses = await Promise.allSettled(jobs);
  const merged = [];
  const errors = [];
  for (const item of responses) {
    if (item.status === 'fulfilled') {
      if (item.value.error) errors.push(item.value.error);
      merged.push(...(item.value.hits || []));
    } else {
      errors.push(item.reason && item.reason.message ? item.reason.message : String(item.reason || 'unknown error'));
    }
  }

  const deduped = dedupeByPriority(merged, resultPriority(preferSource));
  deduped.sort((a, b) => {
    const av = (a.mcVersions && a.mcVersions[0]) || '';
    const bv = (b.mcVersions && b.mcVersions[0]) || '';
    if (mcVersion) {
      const am = a.mcVersions && a.mcVersions.includes(mcVersion) ? 1 : 0;
      const bm = b.mcVersions && b.mcVersions.includes(mcVersion) ? 1 : 0;
      if (bm !== am) return bm - am;
    }
    if (loader) {
      const al = !a.loader || a.loader === normalizeLoader(loader) ? 1 : 0;
      const bl = !b.loader || b.loader === normalizeLoader(loader) ? 1 : 0;
      if (bl !== al) return bl - al;
    }
    if (bv !== av) return bv.localeCompare(av, undefined, { numeric: true });
    return (b.downloads || 0) - (a.downloads || 0);
  });

  return {
    source: requested.length === 1 ? requested[0] : 'all',
    total: deduped.length,
    hits: deduped.slice(0, pageSize),
    errors
  };
}

async function getById(id, source) {
  if (source === 'modrinth') {
    const versions = await getModrinthVersions(id);
    return { source, versions };
  }
  return { source, id };
}

async function install(mod) {
  const rootDir = mod && (mod.gameDir || mod.rootDir);
  if (!rootDir) {
    throw new Error('Выберите установленную версию Minecraft. Мод больше не ставится в общую .minecraft без выбранной версии.');
  }
  const targetDir = modsDir(rootDir);

  // Drag & drop of a local .jar file: { fileName, buffer }
  if (mod && mod.fileName && mod.buffer) {
    await fsp.mkdir(targetDir, { recursive: true });
    const data = Buffer.isBuffer(mod.buffer) ? mod.buffer : Buffer.from(mod.buffer);
    const outPath = path.join(targetDir, mod.fileName);
    await fsp.writeFile(outPath, data);
    await InstallState.add(rootDir, 'mods', mod, { fileName: mod.fileName, path: outPath, mcVersion: mod.mcVersion, loader: mod.loader });
    return { ok: true, fileName: mod.fileName, path: outPath, rootDir };
  }

  let fileUrl, fileUrls, fileName, fileSize = 0;
  if (mod.source === 'modrinth') {
    const versions = await getModrinthVersions(mod.id);
    const loaderNorm = normalizeLoader(mod.loader);
    const filtered = versions.filter(v => {
      const okVersion = !mod.mcVersion || (v.game_versions || []).includes(mod.mcVersion);
      const okLoader = !loaderNorm || (v.loaders || []).includes(loaderNorm);
      return okVersion && okLoader;
    });
    const version = (mod.versionId && versions.find(x => x.id === mod.versionId)) || filtered[0] || versions[0];
    if (!version) throw new Error('Для этого мода не найден совместимый файл.');
    const file = (version.files || []).find(x => x.primary) || (version.files || [])[0];
    if (!file) throw new Error('Для этого мода нет доступного файла.');
    fileUrl = file.url;
    fileName = file.filename;
    fileSize = file.size;

    // Auto-install required dependencies from Modrinth
    if (!mod._isDependency && Array.isArray(version.dependencies) && version.dependencies.length) {
      for (const dep of version.dependencies) {
        if (dep.dependency_type === 'required' && (dep.project_id || dep.version_id)) {
          try {
            await install({
              source: 'modrinth',
              id: dep.project_id,
              versionId: dep.version_id,
              mcVersion: mod.mcVersion,
              loader: mod.loader,
              gameDir: rootDir,
              _isDependency: true
            });
          } catch (depErr) {
            console.warn('[mods] Auto dependency install skipped:', depErr.message);
          }
        }
      }
    }
  } else if (mod.source === 'curseforge') {
    const resolved = await resolveCurseForgeDownload({ projectId: mod.id, fileId: mod.fileId, mcVersion: mod.mcVersion, loader: mod.loader, type: 'mod' });
    fileUrl = resolved.url;
    fileUrls = resolved.urls;
    fileName = resolved.fileName;
    fileSize = resolved.fileSize;
  } else if (mod.source === 'minecraft-inside') {
    const resolved = await resolveMinecraftInsideDownload(mod);
    fileUrl = resolved.url;
    fileUrls = resolved.urls;
    fileName = resolved.fileName;
    fileSize = resolved.fileSize;
  } else {
    throw new Error('Неизвестный источник мода.');
  }

  await fsp.mkdir(targetDir, { recursive: true });

  // Remove existing older duplicate file of the same mod if registered
  try {
    const existing = await InstallState.list(rootDir, 'mods');
    const prev = existing.find(x => x.id === mod.id || (mod.slug && x.slug === mod.slug));
    if (prev && prev.fileName && prev.fileName !== fileName) {
      const oldPath = path.join(targetDir, prev.fileName);
      if (fs.existsSync(oldPath)) await fsp.unlink(oldPath).catch(() => {});
      await InstallState.remove(rootDir, 'mods', prev.fileName);
    }
  } catch {}

  const outPath = path.join(targetDir, fileName);
  await Downloads.start({
    id: `mod-${mod.source}-${mod.id}`,
    label: mod.title || fileName,
    url: fileUrl,
    urls: fileUrls,
    path: outPath,
    size: fileSize,
    kind: 'mod'
  });

  let warning = null;
  try {
    const inspection = await inspectModJar(outPath);
    if (inspection && inspection.loader && inspection.loader !== 'unknown') {
      const targetLoader = String(mod.loader || '').trim().toLowerCase();
      const targetMc = String(mod.mcVersion || '').trim();

      if (targetLoader && targetLoader !== 'vanilla') {
        if (inspection.loader !== targetLoader && !(targetLoader === 'neoforge' && inspection.loader === 'forge')) {
          warning = `Установлен ${inspection.loader.toUpperCase()}-мод в профиль ${targetLoader.toUpperCase()}! Игра может вылететь при запуске.`;
        }
      }

      if (!warning && inspection.mcVersion && targetMc) {
        const verStr = String(inspection.mcVersion).toLowerCase();
        if (!verStr.includes(targetMc.toLowerCase())) {
          const cleanMc = targetMc.replace(/^(\d+\.\d+).*$/, '$1');
          if (!verStr.includes(cleanMc)) {
            warning = `Мод предназначен для Minecraft ${inspection.mcVersion}, а ваш профиль — ${targetMc}.`;
          }
        }
      }
    }
  } catch (err) {
    console.error('Validation error:', err);
  }

  await InstallState.add(rootDir, 'mods', mod, { fileName, path: outPath, mcVersion: mod.mcVersion, loader: mod.loader });
  return { ok: true, fileName, rootDir, path: outPath, warning };
}

async function inspectModJar(filePath) {
  try {
    const JSZip = require('jszip');
    const data = await fsp.readFile(filePath);
    const zip = await JSZip.loadAsync(data);

    if (zip.file('fabric.mod.json')) {
      try {
        const text = await zip.file('fabric.mod.json').async('text');
        const meta = JSON.parse(text);
        let mcRange = '';
        if (meta.depends && meta.depends.minecraft) {
          mcRange = typeof meta.depends.minecraft === 'string' ? meta.depends.minecraft : JSON.stringify(meta.depends.minecraft);
        }
        return {
          loader: 'fabric',
          id: meta.id,
          name: meta.name || meta.id,
          version: meta.version,
          mcVersion: mcRange
        };
      } catch {}
    }

    if (zip.file('quilt.mod.json')) {
      try {
        const text = await zip.file('quilt.mod.json').async('text');
        const meta = JSON.parse(text);
        return {
          loader: 'quilt',
          id: meta.quilt_loader?.id,
          name: meta.quilt_loader?.metadata?.name || meta.quilt_loader?.id,
          version: meta.quilt_loader?.version,
          mcVersion: null
        };
      } catch {}
    }

    if (zip.file('META-INF/neoforge.mods.toml')) {
      try {
        const text = await zip.file('META-INF/neoforge.mods.toml').async('text');
        const modIdMatch = text.match(/modId\s*=\s*["']([^"']+)["']/i);
        const nameMatch = text.match(/displayName\s*=\s*["']([^"']+)["']/i);
        return {
          loader: 'neoforge',
          id: modIdMatch ? modIdMatch[1] : 'unknown',
          name: nameMatch ? nameMatch[1] : 'NeoForge Mod',
          mcVersion: null
        };
      } catch {}
    }

    if (zip.file('META-INF/mods.toml')) {
      try {
        const text = await zip.file('META-INF/mods.toml').async('text');
        const modIdMatch = text.match(/modId\s*=\s*["']([^"']+)["']/i);
        const nameMatch = text.match(/displayName\s*=\s*["']([^"']+)["']/i);
        return {
          loader: 'forge',
          id: modIdMatch ? modIdMatch[1] : 'unknown',
          name: nameMatch ? nameMatch[1] : 'Forge Mod',
          mcVersion: null
        };
      } catch {}
    }

    if (zip.file('mcmod.info')) {
      try {
        const text = await zip.file('mcmod.info').async('text');
        const cleanText = text.replace(/[\n\r]/g, ' ').trim();
        const meta = JSON.parse(cleanText);
        const mod = Array.isArray(meta) ? meta[0] : (meta.modList ? meta.modList[0] : meta);
        return {
          loader: 'forge',
          id: mod.modid,
          name: mod.name || mod.modid,
          version: mod.version,
          mcVersion: mod.mcversion
        };
      } catch {}
    }
  } catch (err) {
    // Ignore Zip read errors
  }
  return { loader: 'unknown' };
}

async function remove(mod) {
  const rootDir = mod.gameDir || mod.rootDir || defaultRoot();
  const p = path.join(modsDir(rootDir), mod.fileName);
  if (fs.existsSync(p)) await fsp.unlink(p);
  const disabledP = `${p}.disabled`;
  if (fs.existsSync(disabledP)) await fsp.unlink(disabledP).catch(() => {});
  await InstallState.remove(rootDir, 'mods', mod.fileName);
  return true;
}

async function toggle(mod) {
  const rootDir = mod.gameDir || mod.rootDir || defaultRoot();
  const dir = modsDir(rootDir);
  const fileName = mod.fileName;
  const currentPath = path.join(dir, fileName);
  if (!fs.existsSync(currentPath)) throw new Error('Файл мода не найден: ' + fileName);
  const isCurrentlyDisabled = fileName.endsWith('.disabled');
  const newName = isCurrentlyDisabled ? fileName.replace(/\.disabled$/, '') : `${fileName}.disabled`;
  const newPath = path.join(dir, newName);
  await fsp.rename(currentPath, newPath);
  return { ok: true, oldName: fileName, newName, enabled: isCurrentlyDisabled };
}

async function listInstalled(rootDir) {
  const dir = modsDir(rootDir);
  const registry = await InstallState.list(rootDir, 'mods');
  if (!fs.existsSync(dir)) return registry;
  const files = await fsp.readdir(dir);
  const physical = files.filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled')).map(f => {
    const isEnabled = !f.endsWith('.disabled');
    const cleanName = f.replace(/\.disabled$/i, '');
    const found = registry.find(x => String(x.fileName || '').toLowerCase() === cleanName.toLowerCase() || String(x.fileName || '').toLowerCase() === f.toLowerCase()) || {};
    return {
      ...found,
      fileName: f,
      cleanName,
      enabled: isEnabled,
      size: fs.statSync(path.join(dir, f)).size,
      path: path.join(dir, f),
      rootDir: rootDir || defaultRoot()
    };
  });
  const extras = registry.filter(x => !physical.some(p => String(p.fileName || '').toLowerCase() === String(x.fileName || '').toLowerCase() || String(p.cleanName || '').toLowerCase() === String(x.fileName || '').toLowerCase()));
  return [...physical, ...extras];
}

module.exports = { search, getById, install, remove, toggle, listInstalled };
