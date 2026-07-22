'use strict';

const path = require('path');
const os = require('os');
const https = require('https');

/**
 * Create an HTTPS agent that respects system CA by default.
 * Caller can override rejectUnauthorized via process.env.NODE_TLS_REJECT_UNAUTHORIZED
 * or via the `insecure` option (for debugging/proxy scenarios).
 * @param {object} [opts]
 * @param {boolean} [opts.insecure]
 * @param {boolean} [opts.keepAlive]
 * @returns {https.Agent}
 */
function createHttpsAgent(opts = {}) {
  const envOverride = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  const rejectUnauthorized = envOverride !== undefined
    ? envOverride !== '0'
    : !opts.insecure;
  return new https.Agent({
    keepAlive: opts.keepAlive !== false,
    rejectUnauthorized
  });
}

/**
 * @returns {'windows'|'osx'|'linux'}
 */
function osName() {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'osx';
  return 'linux';
}

/** @returns {'64'|'32'} */
function archBits() {
  return os.arch().includes('64') ? '64' : '32';
}

/**
 * Replace filesystem-unsafe characters with underscores.
 * @param {string} name
 * @param {number} [maxLen=110]
 * @returns {string}
 */
function sanitizeName(name, maxLen = 110) {
  return String(name || 'version').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim().slice(0, maxLen) || 'version';
}

/**
 * Get network timeout in ms from settings object.
 * @param {object} [settings]
 * @returns {number}
 */
function timeoutMs(settings) {
  try { return Math.max(10000, Number((settings || {}).networkTimeout || 60) * 1000); } catch { return 60000; }
}

/**
 * Parse a Maven coordinate string like "group:artifact:version:classifier@extension"
 * @param {string} name
 * @returns {{ group: string, artifact: string, version: string, classifier: string, extension: string, rel: string } | null}
 */
function parseMavenCoordinate(name) {
  let value = String(name || '').trim();
  if (!value) return null;
  let extension = 'jar';
  const at = value.indexOf('@');
  if (at >= 0) {
    extension = value.slice(at + 1).trim() || 'jar';
    value = value.slice(0, at);
  }
  const parts = value.split(':');
  const group = parts[0];
  const artifact = parts[1];
  const version = parts[2];
  const classifier = parts[3] || '';
  if (!group || !artifact || !version) return null;
  const fileName = `${artifact}-${version}${classifier ? '-' + classifier : ''}.${extension}`;
  const rel = path.join(...group.split('.'), artifact, version, fileName).replace(/\\/g, '/');
  return { group, artifact, version, classifier, extension, rel };
}

/** @param {string} name @returns {string|null} */
function mavenPath(name) {
  const parsed = parseMavenCoordinate(name);
  return parsed ? parsed.rel : null;
}

/**
 * @param {object} rule
 * @param {object} [features]
 * @returns {boolean}
 */
function ruleMatches(rule, features) {
  if (!rule) return true;
  if (rule.os) {
    if (rule.os.name && rule.os.name !== osName()) return false;
    if (rule.os.arch && !os.arch().includes(rule.os.arch)) return false;
    if (rule.os.version) {
      try {
        const re = new RegExp(rule.os.version);
        if (!re.test(os.release())) return false;
      } catch {}
    }
  }
  if (rule.features) {
    for (const [key, value] of Object.entries(rule.features)) {
      if (Boolean(features[key]) !== Boolean(value)) return false;
    }
  }
  return true;
}

/**
 * @param {object[]} rules
 * @param {object} [features]
 * @returns {boolean}
 */
function isAllowed(rules, features) {
  if (!Array.isArray(rules) || rules.length === 0) return true;
  let allowed = false;
  for (const rule of rules) {
    if (ruleMatches(rule, features)) allowed = rule.action === 'allow';
  }
  return allowed;
}

/**
 * @param {object} lib
 * @returns {string}
 */
function libraryIdentity(lib) {
  const parsed = parseMavenCoordinate(lib && lib.name);
  if (parsed) return `${parsed.group}:${parsed.artifact}:${parsed.classifier || ''}:${parsed.extension || 'jar'}`;
  const artifactPath = lib && lib.downloads && lib.downloads.artifact && lib.downloads.artifact.path;
  return artifactPath || String(lib && lib.name || JSON.stringify(lib && lib.rules || {}));
}

/**
 * @param {string} v
 * @returns {number[]}
 */
function splitVersionParts(v) {
  return String(v || '').split(/[^0-9]+/).filter(Boolean).map(n => Number(n));
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareVersionLike(a, b) {
  const aa = splitVersionParts(a);
  const bb = splitVersionParts(b);
  const max = Math.max(aa.length, bb.length);
  for (let i = 0; i < max; i++) {
    const d = (aa[i] || 0) - (bb[i] || 0);
    if (d) return d;
  }
  return String(a).localeCompare(String(b));
}

/**
 * @param {string} mcVersion - e.g. "1.20.4"
 * @returns {number}
 */
function minecraftMinor(mcVersion) {
  const m = String(mcVersion || '').match(/^1\.(\d+)(?:\.(\d+))?/);
  return m ? Number(m[1]) : 999;
}

/**
 * @param {string} value
 * @returns {number[]|null}
 */
function versionTuple(value) {
  const match = String(value || '').match(/(?:^|[^0-9])(1)\.(\d+)(?:\.(\d+))?/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3] || 0)] : null;
}

/**
 * @param {object} vmeta
 * @param {string} versionId
 * @returns {string}
 */
function minecraftVersionFromMeta(vmeta, versionId) {
  const candidates = [vmeta && vmeta.inheritsFrom, vmeta && vmeta.id, versionId, vmeta && vmeta.jar];
  for (const value of candidates) {
    const match = String(value || '').match(/1\.\d+(?:\.\d+)?/);
    if (match) return match[0];
  }
  return '';
}

/**
 * @param {object} vmeta
 * @param {string} versionId
 * @returns {boolean}
 */
function isLegacyForge(vmeta, versionId) {
  const loaderText = `${versionId || ''} ${(vmeta && vmeta.id) || ''} ${(vmeta && vmeta.mainClass) || ''}`;
  if (!/forge/i.test(loaderText)) return false;
  const mcVersion = minecraftVersionFromMeta(vmeta, versionId);
  const tuple = versionTuple(mcVersion);
  return Boolean(tuple && tuple[0] === 1 && tuple[1] <= 12);
}

/** @param {number} ms @returns {Promise<void>} */
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = {
  createHttpsAgent,
  osName,
  archBits,
  sanitizeName,
  timeoutMs,
  parseMavenCoordinate,
  mavenPath,
  ruleMatches,
  isAllowed,
  libraryIdentity,
  splitVersionParts,
  compareVersionLike,
  minecraftMinor,
  versionTuple,
  minecraftVersionFromMeta,
  isLegacyForge,
  sleep
};
