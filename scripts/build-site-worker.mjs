// Run after an Astro build with base=/ in the Sites checkout.
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative, extname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = resolve('.');
const dist = resolve('dist');
const manifest = JSON.parse(readFileSync('.openai/hosting.json', 'utf8'));
if (manifest.static || !manifest.capabilities?.includes('mcp')) throw new Error('Sites Worker manifest must enable mcp and omit static');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
if (html.includes('href="/paper4qi/') || html.includes('src="/paper4qi/')) throw new Error('Build the Sites copy with --base /');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon' };
const assets = {};
function add(path, data, type) { assets[path] = { type, sha256: createHash('sha256').update(data).digest('hex'), body: gzipSync(data).toString('base64') }; }
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'server' || entry.name === '.openai') continue;
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Symlinks are not accepted as website assets');
    if (entry.isDirectory()) walk(path);
    else add('/' + relative(dist, path).replaceAll('\\', '/'), readFileSync(path), types[extname(path)] ?? 'application/octet-stream');
  }
}
walk(dist);
for (const [path, source] of [['/guides/openqasm.md', 'src/content/openqasm-research.md'], ['/guides/agents.md', 'docs/agent-access.md']]) {
  if (existsSync(source)) add(path, readFileSync(source), 'text/markdown; charset=utf-8');
}
for (const path of ['/data/papers.json', '/data/manifest.json', '/data/quality.json', '/data/research-map.json', '/data/guides.json', '/guides/openqasm.md', '/guides/agents.md']) if (!assets[path]) throw new Error(`Missing ${path}`);
mkdirSync(join(dist, 'server'), { recursive: true });
mkdirSync(join(dist, '.openai'), { recursive: true });
const runtime = readFileSync(resolve(root, 'sites/worker.mjs'), 'utf8');
writeFileSync(join(dist, 'server/index.js'), `${runtime}\nconst assets = ${JSON.stringify(assets)};\nexport default createWorker(assets);\n`);
writeFileSync(join(dist, '.openai/hosting.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Sites Worker: ${Object.keys(assets).length} assets, ${Math.round(readFileSync(join(dist, 'server/index.js')).length / 1024)} KiB source; 6 read-only MCP tools.`);
