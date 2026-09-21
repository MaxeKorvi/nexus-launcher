'use strict';

/**
 * Server Status & Ping Monitor Service for Nexus Launcher
 * Supports TCP Server List Ping (SLP) protocol with mcstatus.io fallback.
 */

const net = require('net');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const axios = require('axios');
const { app } = require('electron');
const Settings = require('./settings');

const defaultGameDir = () => {
  try {
    const s = Settings.getAll();
    if (s && s.gameFolder) return s.gameFolder;
  } catch {}
  const home = (app && typeof app.getPath === 'function' && app.getPath('home')) || process.env.USERPROFILE || process.env.HOME || '.';
  return path.join(home, '.minecraft');
};
const serversFilePath = () => path.join(defaultGameDir(), 'nexus-servers.json');

const DEFAULT_SERVERS = [
  { id: 'hypixel', name: 'Hypixel Network', address: 'mc.hypixel.net' },
  { id: 'mineblaze', name: 'MineBlaze', address: 'play.mineblaze.ru' },
  { id: 'funtime', name: 'Funtime', address: 'mc.funtime.su' },
  { id: 'reallyworld', name: 'ReallyWorld', address: 'mc.reallyworld.ru' },
  { id: 'cubecraft', name: 'CubeCraft Games', address: 'play.cubecraft.net' },
  { id: 'workshop47', name: 'Мастерская 47', address: 'mc.workshop47.pro' }
];

function writeVarInt(value) {
  const bytes = [];
  while (true) {
    if ((value & ~0x7F) === 0) {
      bytes.push(value);
      break;
    }
    bytes.push((value & 0x7F) | 0x80);
    value >>>= 7;
  }
  return Buffer.from(bytes);
}

function readVarInt(buf, offset = 0) {
  let result = 0;
  let shift = 0;
  let bytesRead = 0;
  while (offset + bytesRead < buf.length) {
    const b = buf[offset + bytesRead++];
    result |= (b & 0x7F) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result, bytesRead };
}

function cleanMotd(desc) {
  if (!desc) return '';
  if (typeof desc === 'string') return desc.replace(/§[0-9a-fk-or]/gi, '').trim();
  if (typeof desc === 'object') {
    let out = desc.text || '';
    if (Array.isArray(desc.extra)) {
      for (const part of desc.extra) {
        if (typeof part === 'string') out += part;
        else if (part && part.text) out += part.text;
      }
    }
    return out.replace(/§[0-9a-fk-or]/gi, '').trim();
  }
  return String(desc);
}

function parseAddress(addr) {
  const parts = String(addr || '').trim().split(':');
  const host = parts[0] || 'localhost';
  const port = parts[1] ? parseInt(parts[1], 10) : 25565;
  return { host, port };
}

function pingSLP(host, port, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    let received = Buffer.alloc(0);

    socket.connect(port, host, () => {
      const hostBuf = Buffer.from(host, 'utf8');
      const handshakePayload = Buffer.concat([
        Buffer.from([0x00]),             // Packet ID 0: Handshake
        writeVarInt(765),                // Protocol 1.20.4
        writeVarInt(hostBuf.length),
        hostBuf,
        Buffer.from([(port >> 8) & 0xFF, port & 0xFF]), // Port (short)
        writeVarInt(1)                   // Next state: 1 (status)
      ]);
      const handshakePacket = Buffer.concat([writeVarInt(handshakePayload.length), handshakePayload]);

      // Status Request packet
      const statusRequest = Buffer.from([0x01, 0x00]);

      socket.write(Buffer.concat([handshakePacket, statusRequest]));
    });

    socket.on('data', (data) => {
      received = Buffer.concat([received, data]);
      try {
        const { value: packetLen, bytesRead: lenBytes } = readVarInt(received, 0);
        if (received.length >= packetLen + lenBytes) {
          const latency = Date.now() - startTime;
          const { bytesRead: idBytes } = readVarInt(received, lenBytes);
          const { value: strLen, bytesRead: strLenBytes } = readVarInt(received, lenBytes + idBytes);
          const jsonStart = lenBytes + idBytes + strLenBytes;
          const jsonStr = received.slice(jsonStart, jsonStart + strLen).toString('utf8');
          const parsed = JSON.parse(jsonStr);

          socket.destroy();
          resolve({
            online: true,
            latency,
            host,
            port,
            version: parsed.version && parsed.version.name ? parsed.version.name : 'Unknown',
            protocol: parsed.version && parsed.version.protocol,
            players: {
              online: (parsed.players && parsed.players.online) || 0,
              max: (parsed.players && parsed.players.max) || 0
            },
            motd: cleanMotd(parsed.description),
            icon: parsed.favicon || null
          });
        }
      } catch (err) {
        // Wait for more data if incomplete
      }
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('SLP Timeout'));
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(err);
    });
  });
}

async function pingHttpFallback(address) {
  const startTime = Date.now();
  const res = await axios.get(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(address)}`, {
    timeout: 3500,
    headers: { 'User-Agent': 'NexusLauncher/2026.1.2' }
  });
  const data = res.data;
  const latency = Date.now() - startTime;

  if (!data || !data.online) {
    return {
      online: false,
      address,
      latency: -1,
      motd: 'Сервер недоступен',
      players: { online: 0, max: 0 }
    };
  }

  return {
    online: true,
    latency,
    host: data.host,
    port: data.port,
    version: (data.version && data.version.name_clean) || (data.version && data.version.name_raw) || 'Unknown',
    players: {
      online: (data.players && data.players.online) || 0,
      max: (data.players && data.players.max) || 0
    },
    motd: (data.motd && data.motd.clean) || cleanMotd(data.motd && data.motd.raw) || '',
    icon: data.icon || null
  };
}

async function ping(address) {
  const { host, port } = parseAddress(address);
  try {
    return await pingSLP(host, port, 2500);
  } catch (slpErr) {
    try {
      return await pingHttpFallback(address);
    } catch (httpErr) {
      return {
        online: false,
        address,
        latency: -1,
        motd: 'Не удается подключиться',
        players: { online: 0, max: 0 },
        error: slpErr.message
      };
    }
  }
}

async function list() {
  const file = serversFilePath();
  let servers = DEFAULT_SERVERS;
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(await fsp.readFile(file, 'utf8'));
      if (Array.isArray(data) && data.length) {
        servers = data;
      }
    }
  } catch {}
  servers = servers.filter(s => s.id !== 'lololoshka' && s.id !== 'vimeworld');
  const w47 = servers.find(s => s.id === 'workshop47');
  if (w47) w47.address = 'mc.workshop47.pro';
  return servers;
}

async function saveList(servers) {
  const file = serversFilePath();
  try {
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, JSON.stringify(servers, null, 2), 'utf8');
  } catch {}
}

async function add({ name, address }) {
  if (!address) throw new Error('Адрес сервера обязателен');
  const current = await list();
  const id = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const item = {
    id,
    name: (name || address).trim(),
    address: address.trim()
  };
  current.push(item);
  await saveList(current);
  return item;
}

async function remove(id) {
  const current = await list();
  const filtered = current.filter(x => x.id !== id);
  await saveList(filtered);
  return { ok: true, id };
}

module.exports = {
  list,
  add,
  remove,
  ping
};
