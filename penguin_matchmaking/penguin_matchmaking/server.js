const http = require('node:http');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const rooms = new Map();

function send(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function getClientIp(req) {
  // Hosted platforms such as Render put the original client IP in this header.
  const forwarded = req.headers['x-forwarded-for'];
  let ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '')
    || req.socket.remoteAddress
    || '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) code += alphabet[bytes[i] % alphabet.length];
  } while (rooms.has(code));
  return code;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 10_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  for (const [code, room] of rooms) {
    if (Date.now() - room.createdAt > ROOM_TTL_MS) rooms.delete(code);
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return send(res, 200, { ok: true, service: 'penguin-matchmaking' });
  }

  if (req.method === 'POST' && url.pathname === '/host') {
    let body;
    try { body = await readJson(req); }
    catch (err) { return send(res, 400, { error: err.message }); }

    const port = Number(body.port || 7000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return send(res, 400, { error: 'Port must be between 1 and 65535.' });
    }

    const ip = getClientIp(req);
    if (!ip) return send(res, 400, { error: 'Could not determine host IP.' });

    const code = makeCode();
    rooms.set(code, { ip, port, createdAt: Date.now() });
    return send(res, 201, { code, port, expires_in_seconds: ROOM_TTL_MS / 1000 });
  }

  const joinMatch = url.pathname.match(/^\/join\/([A-Za-z0-9-]+)$/);
  if (req.method === 'GET' && joinMatch) {
    const code = joinMatch[1].toUpperCase();
    const room = rooms.get(code);
    if (!room) return send(res, 404, { error: 'Party code not found or expired.' });
    return send(res, 200, { ip: room.ip, port: room.port });
  }

  const deleteMatch = url.pathname.match(/^\/room\/([A-Za-z0-9-]+)$/);
  if (req.method === 'DELETE' && deleteMatch) {
    const code = deleteMatch[1].toUpperCase();
    if (!rooms.has(code)) return send(res, 404, { error: 'Party code not found.' });
    rooms.delete(code);
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: 'Not found.' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Penguin matchmaking listening on port ${PORT}`);
});
