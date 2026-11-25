'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { Transform, pipeline } = require('stream');
const { promisify } = require('util');
const axios = require('axios');
const tar = require('tar-stream');
const zstd = require('@mongodb-js/zstd');

const pipe = promisify(pipeline);
const IO_CHUNK_BYTES = 256 * 1024; // 256 KB buffer for optimal disk & stream throughput

function safeJoin(root, rel) {
  const normalized = path.normalize(String(rel || '')).replace(/^([.][.][\\/])+/, '');
  const target = path.join(root, normalized);
  const rootResolved = path.resolve(root);
  const targetResolved = path.resolve(target);
  if (targetResolved !== rootResolved && !targetResolved.startsWith(rootResolved + path.sep)) {
    throw new Error('Blocked unsafe path in archive: ' + rel);
  }
  return target;
}

function createZstdDecompressTransform() {
  if (typeof zstd.DecompressStream === 'function') {
    return new zstd.DecompressStream();
  }
  const chunks = [];
  return new Transform({
    highWaterMark: IO_CHUNK_BYTES,
    transform(chunk, _enc, cb) {
      chunks.push(chunk);
      cb();
    },
    async flush(cb) {
      try {
        const out = await zstd.decompress(Buffer.concat(chunks));
        this.push(out);
        cb();
      } catch (e) {
        cb(e);
      }
    }
  });
}

/**
 * Streams a .tar.zst archive directly from HTTP into targetDir without temp files.
 * Verifies SHA-256 on the fly and cleans up created files if network/hash fails.
 */
async function streamDownloadAndExtract({
  url,
  targetDir,
  expectedSha256 = null,
  headers = {},
  timeoutMs = 60000,
  signal = null,
  onProgress = null
}) {
  await fsp.mkdir(targetDir, { recursive: true });
  const createdFiles = [];
  const hash = crypto.createHash('sha256');
  const startTime = Date.now();

  let receivedBytes = 0;
  let totalBytes = 0;
  let currentFile = '';
  let lastEmit = 0;

  const emitProgress = (force = false) => {
    if (!onProgress) return;
    const now = Date.now();
    if (!force && now - lastEmit < 150) return;
    lastEmit = now;
    const elapsedSec = Math.max(0.1, (now - startTime) / 1000);
    const speedBps = Math.round(receivedBytes / elapsedSec);
    const percent = totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : 0;
    onProgress({ received: receivedBytes, total: totalBytes, percent, speedBps, currentFile });
  };

  const resp = await axios.get(url, {
    responseType: 'stream',
    timeout: timeoutMs,
    signal,
    headers,
    maxRedirects: 5
  });

  totalBytes = Number(resp.headers['content-length'] || 0);

  const meterAndHash = new Transform({
    highWaterMark: IO_CHUNK_BYTES,
    transform(chunk, _enc, cb) {
      receivedBytes += chunk.length;
      hash.update(chunk);
      emitProgress(false);
      cb(null, chunk);
    }
  });

  const zstdDecompress = createZstdDecompressTransform();
  const extract = tar.extract({ allowUnknownFormat: false });
  const pendingWrites = new Set();

  extract.on('entry', (header, stream, next) => {
    const rel = String(header.name || '').replace(/^\/+/, '');
    if (!rel || rel === '.') {
      stream.resume();
      return next();
    }

    let destPath;
    try {
      destPath = safeJoin(targetDir, rel);
    } catch (err) {
      stream.destroy(err);
      return next(err);
    }

    currentFile = rel;
    emitProgress(false);

    if (header.type === 'directory') {
      fsp.mkdir(destPath, { recursive: true })
        .then(() => { stream.resume(); next(); })
        .catch(next);
      return;
    }

    if (header.type !== 'file') {
      stream.resume();
      return next();
    }

    fsp.mkdir(path.dirname(destPath), { recursive: true })
      .then(() => {
        createdFiles.push(destPath);
        const ws = fs.createWriteStream(destPath, { highWaterMark: IO_CHUNK_BYTES });
        const job = pipe(stream, ws).finally(() => pendingWrites.delete(job));
        pendingWrites.add(job);
        if (pendingWrites.size >= 8) {
          job.then(() => next(), next);
        } else {
          job.catch(() => {});
          next();
        }
      })
      .catch(next);
  });

  try {
    await pipe(resp.data, meterAndHash, zstdDecompress, extract);
    await Promise.all(Array.from(pendingWrites));

    const actualSha256 = hash.digest('hex');
    if (expectedSha256 && actualSha256.toLowerCase() !== String(expectedSha256).toLowerCase()) {
      throw new Error(`Ошибка целостности SHA-256: ожидался ${expectedSha256}, получен ${actualSha256}`);
    }

    emitProgress(true);
    return { ok: true, sha256: actualSha256, bytes: receivedBytes };
  } catch (err) {
    for (const file of createdFiles) {
      await fsp.unlink(file).catch(() => {});
    }
    throw err;
  }
}

module.exports = { streamDownloadAndExtract, safeJoin };
