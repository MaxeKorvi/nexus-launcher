'use strict';

/**
 * Launcher Service
 *  - Builds a Mojang-compatible Java command for modern and legacy versions.
 *  - Uses real Microsoft tokens when an online Microsoft account is active.
 *  - Never writes access tokens to launcher.log.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const axios = require('axios');
const { app, BrowserWindow } = require('electron');
const Settings = require('./settings');
const Accounts = require('./accounts');
const Java = require('./java');
const Versions = require('./versions');
const Downloads = require('./downloads');
const { osName, archBits, parseMavenCoordinate, ruleMatches, isAllowed, versionTuple, minecraftVersionFromMeta, isLegacyForge, libraryIdentity } = require('./shared');

let childProc = null;

function emit(channel, payload) {
  for (const w of BrowserWindow.getAllWindows()) {
    try { w.webContents.send(channel, payload); } catch {}
  }
}

function appendLog(line) {
  const logPath = path.join(app.getPath('userData'), 'launcher.log');
  fs.appendFileSync(logPath, line + '\n');
  emit('launcher:console', line);
}

function splitJvmArgs(value) {
  if (!value) return [];
  const matches = String(value).match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  return matches.map(v => v.replace(/^(['"])(.*)\1$/, '$2'));
}

async function ensureAuthlibInjector() {
  const dir = path.join(app.getPath('userData'), 'agents');
  const jar = path.join(dir, 'authlib-injector.jar');
  if (fs.existsSync(jar)) return jar;
  await fsp.mkdir(dir, { recursive: true });
  const { data } = await axios.get('https://api.github.com/repos/yushijinhun/authlib-injector/releases/latest', {
    timeout: 20000,
    headers: { 'User-Agent': 'NexusLauncher/1.1.6' }
  });
  const asset = (data.assets || []).find(a => /authlib-injector.*\.jar$/i.test(a.name));
  if (!asset || !asset.browser_download_url) throw new Error('Не удалось найти authlib-injector.jar для Ely.by.');
  await Downloads.start({
    id: 'authlib-injector',
    label: 'Ely.by Authlib Injector',
    url: asset.browser_download_url,
    path: jar,
    size: asset.size,
    kind: 'library'
  });
  return jar;
}

async function resolveGameDir(versionId, optsGameDir) {
  if (optsGameDir) return optsGameDir;
  const installed = await Versions.getInstalled();
  const found = installed.find(x => x.id === versionId || x.profileId === versionId || x.versionId === versionId);
  return (found && found.rootDir) || (found && found.path) || Settings.getAll().gameFolder;
}

function libraryAllowed(lib) {
  return isAllowed(lib.rules || []);
}

function getLibraryPath(lib, rootDir) {
  if (lib.downloads && lib.downloads.artifact && lib.downloads.artifact.path) {
    return path.join(rootDir, 'libraries', lib.downloads.artifact.path);
  }

  // Native-only legacy libraries must be extracted to versions/<id>/natives and
  // must not be placed on the Java classpath as non-classified jars.
  if (lib.natives && lib.natives[osName()]) return null;

  const parsed = parseMavenCoordinate(lib.name);
  return parsed ? path.join(rootDir, 'libraries', parsed.rel) : null;
}

function mergeVersionMeta(parent, child) {
  const merged = { ...parent, ...child };
  // A child profile may replace a parent's library with another version.
  // Keep parent order for unrelated libraries, but remove overridden artifacts.
  const childLibraries = child.libraries || [];
  const childKeys = new Set(childLibraries.map(libraryIdentity));
  merged.libraries = [
    ...(parent.libraries || []).filter(lib => !childKeys.has(libraryIdentity(lib))),
    ...childLibraries
  ];
  if (parent.arguments || child.arguments) {
    merged.arguments = {
      jvm: [...((parent.arguments && parent.arguments.jvm) || []), ...((child.arguments && child.arguments.jvm) || [])],
      game: [...((parent.arguments && parent.arguments.game) || []), ...((child.arguments && child.arguments.game) || [])]
    };
  }
  if (!merged.minecraftArguments && parent.minecraftArguments) merged.minecraftArguments = parent.minecraftArguments;
  if (!merged.downloads && parent.downloads) merged.downloads = parent.downloads;
  if (!merged.assetIndex && parent.assetIndex) merged.assetIndex = parent.assetIndex;
  if (!merged.assets && parent.assets) merged.assets = parent.assets;
  if (!merged.javaVersion && parent.javaVersion) merged.javaVersion = parent.javaVersion;
  merged.jar = child.jar || child.inheritsFrom || parent.jar || parent.id;
  merged.resolvedFrom = child.id;
  return merged;
}

async function loadVersionMeta(rootDir, versionId, seen = new Set()) {
  if (seen.has(versionId)) throw new Error(`Цикл наследования версий: ${versionId}`);
  seen.add(versionId);
  const file = path.join(rootDir, 'versions', versionId, `${versionId}.json`);
  if (!fs.existsSync(file)) throw new Error('Версия не установлена: ' + versionId);
  const meta = JSON.parse(await fsp.readFile(file, 'utf8'));
  if (!meta.inheritsFrom) return meta;
  const parent = await loadVersionMeta(rootDir, meta.inheritsFrom, seen);
  return mergeVersionMeta(parent, meta);
}

function resolveMainClass(vmeta, versionId) {
  if (vmeta && vmeta.mainClass) return vmeta.mainClass;
  if (isLegacyForge(vmeta, versionId)) return 'net.minecraft.launchwrapper.Launch';
  return 'net.minecraft.client.main.Main';
}


function buildClasspath(vmeta, versionId, versionDir, rootDir) {
  const entries = [];
  for (const lib of vmeta.libraries || []) {
    if (!libraryAllowed(lib)) continue;
    const file = getLibraryPath(lib, rootDir);
    if (file) entries.push(file);
  }
  const jarVersion = vmeta.jar || versionId;
  entries.push(path.join(rootDir, 'versions', jarVersion, `${jarVersion}.jar`));
  return [...new Set(entries)].join(path.delimiter);
}

function replacePlaceholders(input, vars) {
  return String(input).replace(/\$\{([^}]+)\}/g, (_m, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) return vars[key];
    return '';
  });
}

function resolveMojangArgs(defs, vars, features) {
  const out = [];
  for (const entry of defs || []) {
    if (typeof entry === 'string') {
      out.push(replacePlaceholders(entry, vars));
      continue;
    }
    if (!entry || !isAllowed(entry.rules || [], features)) continue;
    const values = Array.isArray(entry.value) ? entry.value : [entry.value];
    for (const value of values) out.push(replacePlaceholders(value, vars));
  }
  return out.filter(v => v !== '');
}


function preflightLaunch(vmeta, versionId, rootDir) {
  const issues = [];
  const jarVersion = vmeta.jar || versionId;
  const clientJar = path.join(rootDir, 'versions', jarVersion, `${jarVersion}.jar`);
  if (!fileNonEmpty(clientJar)) issues.push(`Отсутствует или повреждён client JAR: ${clientJar}`);
  const libraries = [];
  for (const lib of vmeta.libraries || []) {
    if (!libraryAllowed(lib)) continue;
    const file = getLibraryPath(lib, rootDir);
    if (file) libraries.push(file);
  }
  const missingLibs = libraries.filter(file => !fileNonEmpty(file));
  if (missingLibs.length) {
    issues.push(`Отсутствуют библиотеки: ${missingLibs.slice(0, 8).join(', ')}${missingLibs.length > 8 ? ' …' : ''}`);
  }
  if (isLegacyForge(vmeta, versionId)) {
    const hasLaunchwrapper = (vmeta.libraries || []).some(lib => String(lib.name || '').includes('launchwrapper'));
    if (!hasLaunchwrapper) {
      issues.push('Forge старой версии: в JSON отсутствует net.minecraft:launchwrapper');
    }
  }
  const assetIndex = vmeta.assetIndex && vmeta.assetIndex.id
    ? path.join(rootDir, 'assets', 'indexes', `${vmeta.assetIndex.id}.json`)
    : null;
  if (assetIndex && !fileNonEmpty(assetIndex)) issues.push(`Отсутствует индекс ресурсов: ${assetIndex}`);

  const nativesDir = path.join(rootDir, 'versions', jarVersion, 'natives');
  const needsNatives = (vmeta.libraries || []).some(lib => libraryAllowed(lib) && lib.natives && lib.natives[osName()]);
  if (needsNatives && !directoryHasFiles(nativesDir)) issues.push(`Не распакованы natives: ${nativesDir}`);
  return issues;
}

function fileNonEmpty(file) {
  try { return fs.statSync(file).isFile() && fs.statSync(file).size > 0; } catch { return false; }
}

function directoryHasFiles(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).some(entry => entry.isFile()); } catch { return false; }
}

function sanitizeArgs(args) {
  const out = [];
  let maskNext = false;
  for (const arg of args) {
    if (maskNext) {
      out.push('<hidden>');
      maskNext = false;
      continue;
    }
    out.push(arg);
    if (arg === '--accessToken' || arg === '--clientId') maskNext = true;
  }
  return out;
}

function createCleanEnv() {
  const clean = { ...process.env };
  const removeKeys = [
    'ELECTRON_RUN_AS_NODE', 'ELECTRON_NO_ATTACH_CONSOLE',
    'NEXUS_SECRET', 'NEXUS_TOKEN', 'NEXUS_INSECURE_TLS',
    'ELECTRON_IS_DEV', 'GOOGLE_API_KEY'
  ];
  for (const key of removeKeys) {
    delete clean[key];
  }
  return clean;
}

function javaRequirement(vmeta, versionId) {
  const mcVersion = minecraftVersionFromMeta(vmeta, versionId);
  const tuple = versionTuple(mcVersion);
  if (isLegacyForge(vmeta, versionId)) return { major: 8, exact: true, mcVersion, reason: 'старый Forge' };

  const declared = Number(vmeta && vmeta.javaVersion && vmeta.javaVersion.majorVersion);
  if (declared) {
    return { major: declared, exact: true, mcVersion, reason: 'метаданные версии' };
  }

  if (!tuple) return { major: 17, exact: false, mcVersion, reason: 'без метаданных' };
  const minor = tuple[1];
  const patch = tuple[2];
  if (minor <= 16) return { major: 8, exact: true, mcVersion, reason: 'Minecraft 1.16 и старее' };
  if (minor === 17) return { major: 16, exact: true, mcVersion, reason: 'Minecraft 1.17' };
  if (minor > 20 || (minor === 20 && patch >= 5)) return { major: 21, exact: true, mcVersion, reason: 'Minecraft 1.20.5+' };
  return { major: 17, exact: true, mcVersion, reason: 'Minecraft 1.18–1.20.4' };
}

async function chooseJava(settings, vmeta, versionId) {
  const requirement = javaRequirement(vmeta, versionId);
  const preferredPath = settings.java && settings.java.path;
  if (preferredPath) {
    const preferred = Java.inspectExecutable(preferredPath);
    const compatible = preferred && (requirement.exact ? preferred.version === requirement.major : preferred.version >= requirement.major);
    if (compatible) return { ...preferred, requirement };
    if (preferred) appendLog(`[launcher] Java из настроек (${preferred.version}) несовместима: нужна ${requirement.exact ? 'строго ' : ''}Java ${requirement.major}. Включено автоматическое переключение.`);
    else appendLog('[launcher] Java из настроек не запускается. Включено автоматическое определение.');
  }

  appendLog(`[launcher] Подбор Java: ${requirement.exact ? 'строго ' : ''}${requirement.major}+ (${requirement.reason}).`);
  const selected = await Java.ensureVersion(requirement.major, {
    exact: requirement.exact,
    preferredPath
  });
  if (!selected || !selected.path) throw new Error(`Не удалось подобрать Java ${requirement.major}.`);
  return { ...selected, requirement };
}

function sanitizeJvmArgsForJava(args, javaMajor) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (javaMajor <= 8 && ['--add-opens', '--add-exports', '--add-modules', '--enable-preview'].includes(arg)) {
      if (arg !== '--enable-preview') i += 1;
      continue;
    }
    if (javaMajor <= 8 && /^(--add-opens=|--add-exports=|--add-modules=)/.test(arg)) continue;
    if (javaMajor >= 9 && /^-XX:(?:MaxPermSize|PermSize)=/i.test(arg)) continue;
    if (javaMajor >= 14 && /^-XX:\+UseConcMarkSweepGC$/i.test(arg)) continue;
    out.push(arg);
  }
  return out;
}

function normalizeSkinSystem(system) {
  const s = String(system || 'tlskincape').toLowerCase();
  if (['ely', 'ely.by', 'elyby'].includes(s)) return 'ely';
  if (['none', 'off', 'disabled', 'nothing', 'ничего'].includes(s)) return 'none';
  return 'tlskincape';
}

async function resolveAccount(accountId) {
  let playerNick = 'Player';
  let playerUuid = '00000000000000000000000000000000';
  let accessToken = '0';
  let userType = 'legacy';
  let type = 'local';

  if (!accountId) return { playerNick, playerUuid, accessToken, userType, type };
  const accs = await Accounts.list();
  const acc = accs.find(a => a.id === accountId);
  if (!acc) return { playerNick, playerUuid, accessToken, userType, type };

  playerNick = acc.nickname || playerNick;
  playerUuid = (acc.uuid || playerUuid).replace(/-/g, '');
  type = acc.type === 'tlauncher' ? 'local' : (acc.type || type);

  if (acc.type === 'microsoft') {
    const realToken = await Accounts.getAccessToken(acc.id);
    if (realToken) {
      accessToken = realToken;
      userType = 'msa';
    } else {
      // Allow the owned installation to start offline when Microsoft's refresh
      // token has expired. Online servers still require signing in again.
      accessToken = '0';
      userType = 'legacy';
      type = 'local';
      appendLog('[launcher] Microsoft-сессия истекла. Запуск в офлайн-режиме; для лицензионных серверов войдите заново.');
    }
  } else if (acc.type === 'ely') {
    const realToken = await Accounts.getAccessToken(acc.id);
    if (!realToken) throw new Error('Ely.by-токен истёк или недоступен. Войдите в Ely.by заново.');
    accessToken = realToken;
    userType = 'mojang';
  } else {
    userType = 'legacy';
  }

  return { playerNick, playerUuid, accessToken, userType, type };
}

function buildLaunchArgs({ settings, vmeta, versionId, gameDir, versionDir, account, skinAgent, javaMajor }) {
  const jarVersion = vmeta.jar || versionId;
  const nativesDir = path.join(gameDir, 'versions', jarVersion, 'natives');
  const classpath = buildClasspath(vmeta, versionId, versionDir, gameDir);
  const assetsIndex = vmeta.assetIndex ? vmeta.assetIndex.id : (vmeta.assets || versionId);
  const features = {
    is_demo_user: false,
    has_custom_resolution: !settings.resolution.fullscreen,
    has_quick_plays_support: false,
    is_quick_play_singleplayer: false,
    is_quick_play_multiplayer: false,
    is_quick_play_realms: false
  };
  const vars = {
    natives_directory: nativesDir,
    launcher_name: 'NexusLauncher',
    launcher_version: app.getVersion ? app.getVersion() : '1.0.0',
    classpath,
    classpath_separator: path.delimiter,
    library_directory: path.join(gameDir, 'libraries'),
    version_name: versionId,
    auth_player_name: account.playerNick,
    auth_uuid: account.playerUuid,
    auth_access_token: account.accessToken,
    clientid: '',
    auth_xuid: '',
    user_type: account.userType,
    version_type: vmeta.type || 'release',
    game_directory: gameDir,
    assets_root: path.join(gameDir, 'assets'),
    assets_index_name: assetsIndex,
    user_properties: '{}',
    resolution_width: String(settings.resolution.width),
    resolution_height: String(settings.resolution.height)
  };

  const memoryArgs = [`-Xms${settings.java.minHeap}M`, `-Xmx${settings.java.maxHeap}M`];
  let presetArgs = [];
  const preset = settings.java.jvmPreset || 'default';
  if (preset === 'g1gc') {
    presetArgs = [
      '-XX:+UseG1GC',
      '-XX:+ParallelRefProcEnabled',
      '-XX:MaxGCPauseMillis=200',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC',
      '-XX:+AlwaysPreTouch',
      '-XX:G1NewSizePercent=30',
      '-XX:G1MaxNewSizePercent=40',
      '-XX:G1ReservePercent=20',
      '-XX:G1HeapRegionSize=32M',
      '-XX:G1MixedGCCountTarget=8',
      '-XX:InitiatingHeapOccupancyPercent=15',
      '-XX:G1MixedGCLiveThresholdPercent=90',
      '-XX:G1RSetUpdatingPauseTimePercent=5',
      '-XX:SurvivorRatio=32',
      '-XX:+PerfDisableSharedMem',
      '-XX:MaxTenuringThreshold=1'
    ];
  } else if (preset === 'zgc') {
    if (javaMajor >= 15) {
      presetArgs = [
        '-XX:+UseZGC',
        '-XX:+UnlockExperimentalVMOptions',
        '-XX:+AlwaysPreTouch'
      ];
    } else {
      presetArgs = [
        '-XX:+UseG1GC',
        '-XX:+ParallelRefProcEnabled',
        '-XX:MaxGCPauseMillis=200',
        '-XX:+UnlockExperimentalVMOptions',
        '-XX:+DisableExplicitGC',
        '-XX:+AlwaysPreTouch'
      ];
    }
  }

  const customJvmArgs = sanitizeJvmArgsForJava(splitJvmArgs(settings.java.jvmArgs), javaMajor);
  const skinJvmArgs = skinAgent ? [skinAgent] : [];

  if (vmeta.arguments) {
    // Modern Forge uses ${version_name}.jar in -DignoreList. The actual client
    // JAR belongs to the inherited vanilla version, not to the Forge profile.
    // Keeping the profile id here makes SecureJarHandler load vanilla twice
    // (minecraft + _1._xx_x modules) and fail with ResolutionException.
    const jvmVars = { ...vars, version_name: jarVersion };
    const jvm = sanitizeJvmArgsForJava(resolveMojangArgs(vmeta.arguments.jvm || [], jvmVars, features), javaMajor);
    const game = resolveMojangArgs(vmeta.arguments.game || [], vars, features);
    if (settings.resolution.fullscreen && !game.includes('--fullscreen')) game.push('--fullscreen');
    return [...memoryArgs, ...presetArgs, ...customJvmArgs, ...skinJvmArgs, ...jvm, resolveMainClass(vmeta, versionId), ...game];
  }

  const legacyGameArgs = vmeta.minecraftArguments
    ? splitJvmArgs(replacePlaceholders(vmeta.minecraftArguments, vars))
    : [
      '--username', account.playerNick,
      '--version', versionId,
      '--gameDir', gameDir,
      '--assetsDir', path.join(gameDir, 'assets'),
      '--assetIndex', assetsIndex,
      '--uuid', account.playerUuid,
      '--accessToken', account.accessToken,
      '--userType', account.userType,
      '--versionType', vmeta.type || 'release',
      '--width', String(settings.resolution.width),
      '--height', String(settings.resolution.height)
    ];
  if (settings.resolution.fullscreen) legacyGameArgs.push('--fullscreen');

  return [
    ...memoryArgs,
    ...presetArgs,
    ...customJvmArgs,
    ...skinJvmArgs,
    `-Djava.library.path=${nativesDir}`,
    '-cp', classpath,
    resolveMainClass(vmeta, versionId),
    ...legacyGameArgs
  ];
}

async function start({ versionId, accountId, modpackPath }) {
  if (childProc) {
    appendLog('[launcher] Already running.');
    return { ok: false, error: 'already_running' };
  }

  const settings = Settings.getAll();
  const gameDir = await resolveGameDir(versionId, modpackPath);
  appendLog('');
  appendLog(`[launcher] ===== Запуск ${versionId} =====`);

  let vmeta = null;
  let loadError = null;
  try { vmeta = await loadVersionMeta(gameDir, versionId); }
  catch (error) { loadError = error; }
  let issues = vmeta ? preflightLaunch(vmeta, versionId, gameDir) : [];

  if (settings.verifyOnLaunch || loadError || issues.length) {
    appendLog(`[launcher] Полная проверка клиента, библиотек и загрузчика ${versionId}...`);
    const repaired = await Versions.repair(versionId, { gameDir });
    if (repaired && repaired.versionId && repaired.versionId !== versionId) versionId = repaired.versionId;
    vmeta = await loadVersionMeta(gameDir, versionId);
    issues = preflightLaunch(vmeta, versionId, gameDir);
  }
  if (!vmeta) throw loadError || new Error('Версия не установлена: ' + versionId);
  if (issues.length) {
    for (const issue of issues) appendLog('[launcher] PRECHECK: ' + issue);
    throw new Error(`Версия установлена не полностью: ${issues[0]}`);
  }
  const versionDir = path.join(gameDir, 'versions', versionId);
  const selectedJava = await chooseJava(settings, vmeta, versionId);
  const javaPath = selectedJava.path;
  const account = await resolveAccount(accountId);
  const skinSystem = normalizeSkinSystem(settings.skinSystem);
  await Versions.applySkinSystem(gameDir, skinSystem);
  let skinAgent = null;
  if (skinSystem === 'ely') {
    const jar = await ensureAuthlibInjector();
    skinAgent = `-javaagent:${jar}=ely.by`;
    appendLog('[launcher] Система скинов: Ely.by. Authlib-injector включён.');
  } else if (skinSystem === 'tlskincape') {
    appendLog('[launcher] Система скинов: TLSkinCape. Мод TLSkinCape включён, CustomSkinLoader отключён.');
  } else {
    appendLog('[launcher] Система скинов: отключена. Скин-моды отключены.');
  }
  const effectiveSettings = JSON.parse(JSON.stringify(settings));
  if (selectedJava.arch && /(?:x86|i[3-6]86)$/.test(selectedJava.arch) && Number(effectiveSettings.java.maxHeap) > 1536) {
    effectiveSettings.java.maxHeap = 1536;
    appendLog('[launcher] Для 32-битной Java память ограничена до 1536 MB.');
  }
  const args = buildLaunchArgs({ settings: effectiveSettings, vmeta, versionId, gameDir, versionDir, account, skinAgent, javaMajor: selectedJava.version });

  appendLog(`[launcher] Using Java ${selectedJava.version}: ${javaPath}`);
  appendLog('[launcher] Spawning: ' + javaPath + ' ' + sanitizeArgs(args).join(' '));

  const recentStdErr = [];
  childProc = spawn(javaPath, args, { cwd: gameDir, env: createCleanEnv() });

  childProc.stdout.on('data', (d) => appendLog(d.toString().trim()));
  childProc.stderr.on('data', (d) => {
    const line = d.toString().trim();
    if (!line) return;
    recentStdErr.push(line);
    if (recentStdErr.length > 20) recentStdErr.shift();
    appendLog('[stderr] ' + line);
  });
  childProc.on('exit', (code) => {
    appendLog(`[launcher] Process exited with code ${code}`);
    let error;
    if (Number(code) === 1) {
      const details = recentStdErr.join(' | ');
      if (/URLClassLoader/i.test(details) && /launchwrapper/i.test(details)) {
        error = 'Старый Forge был запущен на Java 9+. Для него требуется Java 8. Лаунчер попробует автоматически переключить Java при следующем запуске.';
      } else if (/UnsupportedClassVersionError/i.test(details)) {
        error = 'Выбрана слишком старая Java для этой версии Minecraft. Выполните «Проверить файлы» и запустите снова.';
      } else if (/ClassNotFoundException|Could not find or load main class/i.test(details)) {
        error = 'Не найдена библиотека загрузчика. Нажмите «Проверить файлы», чтобы полностью восстановить профиль.';
      } else {
        error = details || 'Minecraft завершился с кодом 1 без текста ошибки. Откройте консоль для полной диагностики.';
      }
      if (!recentStdErr.length) appendLog('[launcher] HINT: Код 1 без вывода. Проверьте Java, библиотеки загрузчика и совместимость модов.');
    }
    childProc = null;
    emit('launcher:stopped', { code, error });
  });
  childProc.on('error', (err) => {
    appendLog('[launcher] ERROR: ' + err.message);
    childProc = null;
    emit('launcher:stopped', { code: -1, error: err.message });
  });

  return { ok: true, pid: childProc.pid, versionId, javaVersion: selectedJava.version, javaPath };
}

async function stop() {
  if (!childProc) return { ok: false, error: 'not_running' };
  childProc.kill('SIGTERM');
  setTimeout(() => childProc && childProc.kill('SIGKILL'), 3000);
  return { ok: true };
}

async function screenshot() {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return { ok: false };
  const img = await win.capturePage();
  const dir = path.join(app.getPath('pictures'), 'launcher-screenshots');
  await fsp.mkdir(dir, { recursive: true });
  const file = path.join(dir, `shot-${Date.now()}.png`);
  await fsp.writeFile(file, img.toPNG());
  return { ok: true, path: file };
}

module.exports = { start, stop, screenshot };
if (process.env.NODE_ENV === 'test') {
  module.exports.__testing = { javaRequirement, sanitizeJvmArgsForJava, resolveMainClass, preflightLaunch, mergeVersionMeta, buildLaunchArgs };
}
