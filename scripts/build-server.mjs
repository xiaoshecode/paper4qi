// Build an allowlisted standalone Node 24 artifact after Astro --base /.
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync, cpSync } from 'node:fs';
import { resolve, relative, extname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const dist = resolve('dist'), output = resolve(process.argv[2] || 'dist/standalone');
if (output === dist) throw new Error('Standalone output must not overwrite the Astro dist root');
if (readFileSync(join(dist, 'index.html'), 'utf8').includes('href="/paper4qi/')) throw new Error('Build Astro with --base / before packaging standalone server');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon' };
const assets = {};
function add(path, bytes, type) { assets[path] = { type, sha256: createHash('sha256').update(bytes).digest('hex'), body: gzipSync(bytes).toString('base64') }; }
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['server', 'standalone', 'node_modules'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (path === output) continue;
    if (entry.isSymbolicLink()) throw new Error('Symlink assets are not accepted');
    if (entry.isDirectory()) walk(path); else add('/' + relative(dist, path).replaceAll('\\', '/'), readFileSync(path), types[extname(path)] || 'application/octet-stream');
  }
}
walk(dist);
for (const [path, source] of [['/guides/openqasm.md', 'src/content/openqasm-research.md'], ['/guides/agents.md', 'docs/agent-access.md']]) if (existsSync(source)) add(path, readFileSync(source), 'text/markdown; charset=utf-8');
for (const path of ['/data/papers.json', '/data/workspace.json', '/data/manifest.json']) if (!assets[path]) throw new Error(`Missing asset ${path}`);
mkdirSync(output, { recursive: true });
for (const filename of ['app.mjs', 'sqlite-d1.mjs']) cpSync(join('server', filename), join(output, filename));
cpSync('drizzle', join(output, 'drizzle'), { recursive: true });
for (const filename of ['worker.mjs', 'workspace-api.mjs', 'chat-api.mjs']) cpSync(join('sites', filename), join(output, filename));
const runtime = readFileSync(join(output, 'worker.mjs'), 'utf8');
writeFileSync(join(output, 'worker.mjs'), runtime + `\nexport default createWorker(${JSON.stringify(assets)});\n`);
console.log(`Standalone server: ${Object.keys(assets).length} assets; Node 24 runtime, SQLite migrations, no Sites identity metadata.`);
