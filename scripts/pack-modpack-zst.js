'use strict';

/**
 * Packs a prepared modpack directory into .tar.zst (Zstd Ultra 19-22 + MT)
 * and generates a SHA-256 manifest for streaming verification on the client.
 *
 * Usage:
 *   node scripts/pack-modpack-zst.js <sourceDir> <outFile.tar.zst> [--level=21]
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream');
const { promisify } = require('util');
const tar = require('tar-stream');
const zstd = require('@mongodb-js/zstd');

const pipe = promisify(pipeline);

async function collectFiles(dir, base = dir, acc = []) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (ent.isDirectory()) {
      acc.push({ rel, full, dir: true });
      await collectFiles(full, base, acc);
    } else if (ent.isFile()) {
      const stat = await fsp.stat(full);
      acc.push({ rel, full, dir: false, size: stat.size, mtime: stat.mtime });
    }
  }
  return acc;
}

async function packModpack(sourceDir, outFile, { level = 21 } = {}) {
  const srcResolved = path.resolve(sourceDir);
  const outResolved = path.resolve(outFile);
  await fsp.mkdir(path.dirname(outResolved), { recursive: true });

  const entries = await collectFiles(srcResolved);
  const pack = tar.pack();
  const tarChunks = [];
  pack.on('data', chunk => tarChunks.push(chunk));

  for (const item of entries) {
    if (item.dir) {
      pack.entry({ name: item.rel, type: 'directory' });
    } else {
      const entry = pack.entry({ name: item.rel, size: item.size, mtime: item.mtime });
      await pipe(fs.createReadStream(item.full, { highWaterMark: 256 * 1024 }), entry);
    }
  }
  pack.finalize();

  const tarBuffer = Buffer.concat(tarChunks);
  const compressed = await zstd.compress(tarBuffer, level);

  await fsp.writeFile(outResolved, compressed);
  const sha256 = crypto.createHash('sha256').update(compressed).digest('hex');

  const manifest = {
    file: path.basename(outResolved),
    algorithm: 'tar+zstd',
    compressionLevel: level,
    size: compressed.length,
    uncompressedSize: tarBuffer.length,
    ratio: Number((compressed.length / Math.max(1, tarBuffer.length)).toFixed(4)),
    sha256,
    createdAt: new Date().toISOString()
  };

  await fsp.writeFile(`${outResolved}.manifest.json`, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('[Pack Zstd] Готово:', manifest);
  return manifest;
}

if (require.main === module) {
  const [src, out, ...flags] = process.argv.slice(2);
  if (!src || !out) {
    console.error('Использование: node scripts/pack-modpack-zst.js <sourceDir> <outFile.tar.zst> [--level=21]');
    process.exit(1);
  }
  const levelFlag = flags.find(f => f.startsWith('--level='));
  packModpack(src, out, {
    level: levelFlag ? Number(levelFlag.split('=')[1]) : 21
  }).catch(err => {
    console.error('[Pack Zstd FATAL]', err);
    process.exit(1);
  });
}

module.exports = { packModpack };
