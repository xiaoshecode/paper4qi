import { createServer } from 'node:http';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { createReadStream, existsSync, lstatSync, readdirSync, realpathSync, statfsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { resolve, dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SQLiteD1 } from './sqlite-d1.mjs';

const MAX_BODY = 65536, SESSION_SECONDS = 86400;
const COOKIE = '__Host-paper4qi_session';
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
const tokenHash = value => createHash('sha256').update(value).digest('hex');

// This command never creates a database, applies migrations, uploads, or deletes.
// A successful configuration check is not permission to migrate real files.
export async function checkStorage(env, { fetchImpl = (...args) => fetch(...args) } = {}) {
  const blockers = [], database = resolve(env.PAPER4QI_DB_PATH || '/var/lib/paper4qi/library.sqlite');
  const objects = resolve(env.PAPER4QI_LOCAL_STORAGE_ROOT || '/var/lib/paper4qi/objects');
  const report = { mode: 'read-only', ready: false, migration_ready: false,
    backend: env.PAPER4QI_STORAGE_BACKEND || 'local', database: { exists: existsSync(database) },
    local_objects: { exists: existsSync(objects), count: 0, bytes: 0, hashes_calculated: 0 },
    seafile: { configured: false, library_verified: false, directory_verified: false }, blockers };
  const inside = (root, path) => { const rel = relative(root, path); return !rel || !rel.startsWith('..') && !isAbsolute(rel); };
  function realLocation(path) {
    let ancestor = path;
    while (!existsSync(ancestor) && dirname(ancestor) !== ancestor) ancestor = dirname(ancestor);
    return resolve(realpathSync(ancestor), relative(ancestor, path));
  }
  try {
    const realDatabase = realLocation(database), realObjects = realLocation(objects);
    if (inside(realObjects, realDatabase)) blockers.push('sqlite_inside_object_storage');
    if (report.database.exists && lstatSync(database).isSymbolicLink()) blockers.push('sqlite_symlink_requires_review');
    let probe = dirname(database);
    while (!existsSync(probe) && dirname(probe) !== probe) probe = dirname(probe);
    const disk = statfsSync(probe);
    report.disk = { total_bytes: disk.blocks * disk.bsize, available_bytes: disk.bavail * disk.bsize,
      used_bytes: (disk.blocks - disk.bfree) * disk.bsize };
    // Remote/sync mounts are unsuitable for the single-host live SQLite writer.
    if ([0x6969, 0xff534d42, 0x65735546].includes(disk.type)) blockers.push('sqlite_remote_mount_requires_review');
    if (report.database.exists && !blockers.some(code => code.startsWith('sqlite_'))) {
      let connection;
      try {
        connection = new DatabaseSync(database, { readOnly: true });
        connection.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=3000;');
        report.database.integrity = Object.values(connection.prepare('PRAGMA quick_check').get())[0] === 'ok';
        report.database.foreign_keys = connection.prepare('PRAGMA foreign_key_check').all().length === 0;
        if (!report.database.integrity || !report.database.foreign_keys) blockers.push('sqlite_integrity_failed');
      } catch { blockers.push('sqlite_read_check_failed'); }
      finally { connection?.close(); }
    }
    if (report.local_objects.exists) {
      const manifest = createHash('sha256');
      async function inventory(path) {
        const info = lstatSync(path);
        if (info.isSymbolicLink() || !info.isDirectory() && !info.isFile()) throw new Error('unsupported_object');
        if (info.isDirectory()) {
          for (const name of readdirSync(path).sort()) await inventory(join(path, name));
          return;
        }
        if (/\.(?:sqlite(?:3)?|db)(?:-wal|-shm)?$/i.test(path) || realpathSync(path) === realDatabase) throw new Error('database_object');
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(path)) hash.update(chunk);
        const after = lstatSync(path);
        if (info.size !== after.size || info.mtimeMs !== after.mtimeMs || info.ino !== after.ino) throw new Error('changed_object');
        report.local_objects.count++; report.local_objects.bytes += info.size; report.local_objects.hashes_calculated++;
        manifest.update(JSON.stringify([relative(objects, path), info.size, hash.digest('hex')]) + '\n');
      }
      await inventory(objects);
      report.local_objects.inventory_sha256 = manifest.digest('hex');
    }
  } catch { blockers.push('local_storage_inspection_failed'); }
  if (!['local', 'seafile'].includes(report.backend)) blockers.push('unsupported_storage_backend');
  const base = env.SEAFILE_BASE_URL?.trim(), library = env.SEAFILE_LIBRARY_ID?.trim(), token = env.SEAFILE_REPO_TOKEN?.trim();
  report.seafile.configured = !!(base && library && token);
  for (const [name, value] of [['base_url', base], ['library_id', library], ['repo_token', token]]) if (!value) blockers.push('seafile_' + name + '_missing');
  if (report.seafile.configured) {
    try {
      const url = new URL(base);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || /[\\\s]/.test(base) || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(library) || /[\r\n]/.test(token)) throw new Error('invalid_config');
      const directory = env.SEAFILE_DIRECTORY || '/paper4qi';
      if (!directory.startsWith('/paper4qi') || directory !== '/paper4qi' && !directory.startsWith('/paper4qi/') || /[\\\r\n]/.test(directory) || directory.split('/').some(part => part === '.' || part === '..')) throw new Error('invalid_directory');
      async function api(endpoint, params = '') {
        const response = await fetchImpl(`${base.replace(/\/+$/, '')}/api/v2.1/via-repo-token/${endpoint}/${params}`, {
          method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          redirect: 'error', signal: AbortSignal.timeout(15000) });
        if (!response.ok) { await response.body?.cancel(); throw new Error('read_failed'); }
        const chunks = []; let bytes = 0;
        if (!response.body) throw new Error('invalid_response');
        for await (const chunk of response.body) {
          bytes += chunk.byteLength; if (bytes > 2 * 1024 * 1024) throw new Error('response_limit'); chunks.push(chunk);
        }
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
      }
      const info = await api('repo-info');
      if (!info || info.repo_id !== library || info.encrypted === true) throw new Error('library_mismatch');
      report.seafile.library_verified = true;
      const listing = await api('dir', '?' + new URLSearchParams({ path: directory }));
      if (!Array.isArray(listing?.dirent_list) || listing.dirent_list.some(entry => !entry || !['file', 'dir'].includes(entry.type) || typeof entry.name !== 'string' || entry.type === 'file' && (!Number.isSafeInteger(entry.size) || entry.size < 0))) throw new Error('invalid_listing');
      report.seafile.directory_verified = true;
      report.seafile.direct_file_count = listing.dirent_list.filter(entry => entry.type === 'file').length;
      report.seafile.direct_file_bytes = listing.dirent_list.filter(entry => entry.type === 'file').reduce((total, entry) => total + entry.size, 0);
      report.seafile.subdirectory_count = listing.dirent_list.filter(entry => entry.type === 'dir').length;
      if (report.seafile.direct_file_count || report.seafile.subdirectory_count) blockers.push('seafile_existing_objects_require_reconciliation');
    } catch { blockers.push('seafile_read_verification_failed'); }
  }
  if (report.local_objects.count) blockers.push('local_objects_require_catalog_and_backup');
  report.ready = blockers.length === 0;
  return report;
}

export function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  return `scrypt$${salt}$${scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')}`;
}
function verifyPassword(password, encoded) {
  const [scheme, salt, digest] = String(encoded).split('$');
  if (scheme !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(digest ?? '')) return false;
  const expected = Buffer.from(digest, 'hex');
  return timingSafeEqual(scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }), expected);
}
function exactOrigin(value, allowHttp) {
  const url = new URL(value);
  if (url.origin !== value || url.username || url.password || (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Configure an exact HTTPS origin');
  return url.origin;
}
export function createStandalone({ worker, db, env, now = () => Date.now() }) {
  const allowHttp = env.PAPER4QI_ALLOW_LOCAL_HTTP === '1';
  const origin = exactOrigin(env.PAPER4QI_PUBLIC_ORIGIN, allowHttp);
  const frontend = env.PAPER4QI_FRONTEND_ORIGIN ? exactOrigin(env.PAPER4QI_FRONTEND_ORIGIN, allowHttp) : origin;
  const allowed = new Set([origin, frontend]);
  const secure = origin.startsWith('https:');
  const cookieName = secure ? COOKIE : 'paper4qi_dev_session';
  if (!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(env.PAPER4QI_OWNER_PASSWORD_HASH ?? '')) throw new Error('Configure PAPER4QI_OWNER_PASSWORD_HASH using scrypt');
  const runtime = { DB: db, PAPER4QI_EDITOR_IDS: 'owner', PAPER4QI_EDITOR_EMAILS: '',
    DEEPSEEK_API_KEY: env.PAPER4QI_AI_ENABLED === '0' ? undefined : env.DEEPSEEK_API_KEY, DEEPSEEK_MODEL: env.DEEPSEEK_MODEL,
    PAPER4QI_MAX_AI_REQUESTS: env.PAPER4QI_MAX_AI_REQUESTS };
  const epoch = () => Math.floor(now() / 1000);
  function cookie(token, maxAge) { return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`; }
  function sessionToken(headers) {
    const bearer = headers.get('authorization');
    if (bearer) return /^Bearer ([a-f0-9]{64})$/.exec(bearer)?.[1] ?? null;
    return headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1) ?? null;
  }
  async function session(headers) {
    const token = sessionToken(headers);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = await db.prepare('SELECT expires_at FROM standalone_sessions WHERE token_hash = ? AND expires_at > ?').bind(tokenHash(token), epoch()).first();
    return row ? { token, expires_at: row.expires_at } : null;
  }
  async function body(request) {
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new Error('Invalid body');
    const raw = new Uint8Array(await request.arrayBuffer());
    if (raw.byteLength > MAX_BODY) throw new Error('Invalid body');
    const result = JSON.parse(new TextDecoder().decode(raw));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid body');
    return result;
  }
  async function loginAllowed(ip) {
    // Do not trust forwarding headers; use a global cap plus the TCP peer bucket.
    const instant = epoch(), window = instant - instant % 300;
    for (const bucket of ['global', tokenHash(String(ip ?? 'unknown'))]) {
      const result = await db.prepare(`INSERT INTO standalone_login_limits (bucket, attempts, window_start) VALUES (?, 1, ?)
        ON CONFLICT(bucket) DO UPDATE SET attempts = CASE WHEN window_start != excluded.window_start THEN 1 ELSE attempts + 1 END,
        window_start = excluded.window_start WHERE window_start != excluded.window_start OR attempts < ?`).bind(bucket, window, bucket === 'global' ? 20 : 10).run();
      if (result.meta.changes !== 1) return false;
    }
    return true;
  }
  async function auth(request, peer) {
    const url = new URL(request.url), active = await session(request.headers);
    if (url.pathname === '/api/auth/session' && request.method === 'GET') return json({ auth_mode: 'password', authenticated: !!active, can_edit: !!active, ...(active ? { expires_at: active.expires_at } : {}) });
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      if (!await loginAllowed(peer)) return json({ error: 'Too many login attempts; try again later.' }, 429, { 'Retry-After': '300' });
      let input;
      try { input = await body(request); } catch { return json({ error: 'Use a JSON password request.' }, 400); }
      if (Object.keys(input).join() !== 'password' || typeof input.password !== 'string' || input.password.length < 1 || input.password.length > 1024) return json({ error: 'Invalid login request.' }, 400);
      if (!verifyPassword(input.password, env.PAPER4QI_OWNER_PASSWORD_HASH)) return json({ error: 'Invalid credentials.' }, 401);
      const token = randomBytes(32).toString('hex'), expires = epoch() + SESSION_SECONDS;
      await db.prepare('DELETE FROM standalone_sessions WHERE expires_at <= ?').bind(epoch()).run();
      await db.prepare('INSERT INTO standalone_sessions VALUES (?, ?, ?)').bind(tokenHash(token), expires, epoch()).run();
      return json({ auth_mode: 'password', authenticated: true, can_edit: true, token, expires_at: expires }, 200, { 'Set-Cookie': cookie(token, SESSION_SECONDS) });
    }
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      if (active) await db.prepare('DELETE FROM standalone_sessions WHERE token_hash = ?').bind(tokenHash(active.token)).run();
      return json({ auth_mode: 'password', authenticated: false, can_edit: false }, 200, { 'Set-Cookie': cookie('', 0) });
    }
    return json({ error: 'Unknown authentication route or method.' }, 405);
  }
  async function fetchRequest(request, context = {}, peer = 'local') {
    const url = new URL(request.url), suppliedOrigin = request.headers.get('origin');
    if (url.origin !== origin || (suppliedOrigin && !allowed.has(suppliedOrigin))) return json({ error: 'Origin is not allowed.' }, 403);
    const headers = { 'Vary': 'Origin' };
    if (suppliedOrigin && allowed.has(suppliedOrigin)) Object.assign(headers, { 'Access-Control-Allow-Origin': suppliedOrigin,
      'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Max-Age': '300' });
    function cors(response) { const result = new Response(response.body, response); for (const [key, value] of Object.entries(headers)) result.headers.set(key, value); return result; }
    if (request.method === 'OPTIONS') {
      const requested = request.headers.get('access-control-request-headers')?.split(',').map(value => value.trim().toLowerCase()) ?? [];
      if (!suppliedOrigin || requested.some(value => !['authorization', 'content-type'].includes(value))) return json({ error: 'Preflight denied.' }, 403);
      return cors(new Response(null, { status: 204 }));
    }
    try {
      const readOnlyMcp = ['/mcp', '/mcp/'].includes(url.pathname) && request.method === 'POST';
      if (!['GET', 'HEAD'].includes(request.method) && !suppliedOrigin && !readOnlyMcp) return json({ error: 'A trusted browser Origin is required.' }, 403);
      if (url.pathname.startsWith('/api/auth/')) return cors(await auth(request, peer));
      if (url.pathname === '/healthz' && request.method === 'GET') return cors(json({ ready: true }));
      const clean = new Headers(request.headers);
      for (const key of [...clean.keys()]) if (key.startsWith('oai-authenticated-user-')) clean.delete(key);
      clean.delete('authorization'); clean.delete('cookie');
      const active = await session(request.headers);
      if (active) {
        clean.set('oai-authenticated-user-id', 'owner');
        if (env.PAPER4QI_OWNER_EMAIL) clean.set('oai-authenticated-user-email', env.PAPER4QI_OWNER_EMAIL);
      }
      if (suppliedOrigin) clean.set('origin', origin);
      clean.set('sec-fetch-site', 'same-origin');
      const adapted = new Request(request, { headers: clean });
      let response = await worker.fetch(adapted, runtime, context);
      if (url.pathname === '/api/status' && response.ok) {
        const status = await response.json();
        delete status.editor_id;
        response = json({ ...status, auth_mode: 'password', can_edit: !!active, authenticated: !!active, login_url: '/workspace/',
          auth_login_url: '/api/auth/login', auth_logout_url: '/api/auth/logout', auth_session_url: '/api/auth/session' });
      }
      return cors(response);
    } catch {
      // A trusted frontend can read the failure without exposing driver details
      // or mistaking a saved operation's uncertain result for a CORS failure.
      return cors(json({ error: 'Service temporarily unavailable. Reload saved state before retrying changes.' }, 503));
    }
  }
  const server = createServer(async (incoming, outgoing) => {
    let aborted = false, response, abort = new AbortController();
    incoming.once('aborted', () => { aborted = true; abort.abort(); });
    outgoing.once('close', () => { if (!outgoing.writableEnded) { aborted = true; abort.abort(); } });
    try {
      if (incoming.headers.host !== new URL(origin).host) return void outgoing.writeHead(403).end('Invalid Host');
      const chunks = []; let size = 0;
      for await (const chunk of incoming) { size += chunk.length; if (size > MAX_BODY) { outgoing.writeHead(413).end('Request too large'); incoming.destroy(); return; } chunks.push(chunk); }
      if (aborted) return;
      const headers = new Headers(); for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(',') : value);
      const request = new Request(new URL(incoming.url, origin), { method: incoming.method, headers, signal: abort.signal,
        ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) });
      const pending = [];
      response = await fetchRequest(request, { waitUntil: promise => { pending.push(Promise.resolve(promise).catch(() => {})); } }, incoming.socket.remoteAddress);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (incoming.method === 'HEAD' || !response.body) outgoing.end();
      else {
        const readable = Readable.fromWeb(response.body);
        readable.on('error', () => outgoing.destroy());
        outgoing.on('close', () => { if (!outgoing.writableEnded) readable.destroy(); });
        readable.pipe(outgoing);
      }
      void Promise.allSettled(pending);
    } catch { if (!outgoing.headersSent) outgoing.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end('{"error":"Service unavailable"}'); else outgoing.destroy(); }
  });
  server.requestTimeout = 30000; server.headersTimeout = 15000;
  server.on('clientError', (_error, socket) => { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
  return { server, fetch: fetchRequest, close: () => new Promise(resolveClose => server.close(resolveClose)) };
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--storage-check')) {
    const report = await checkStorage(process.env);
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ready ? 0 : 1);
  }
  const root = dirname(fileURLToPath(import.meta.url));
  const db = new SQLiteD1(process.env.PAPER4QI_DB_PATH || '/var/lib/paper4qi/library.sqlite', join(root, 'drizzle'));
  const worker = (await import(pathToFileURL(join(root, 'worker.mjs')).href)).default;
  const app = createStandalone({ worker, db, env: process.env });
  const bindHost = process.env.PAPER4QI_BIND_HOST || '127.0.0.1';
  app.server.listen(Number(process.env.PORT || 8787), bindHost, () => console.log('paper4qi server ready'));
  const shutdown = () => { app.server.close(() => { db.close(); process.exit(0); }); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
