// Copy the canonical source into an already-opened Sites checkout; keep its Git
// history and hosting identity. Does not publish, create credentials or delete files.
import { cpSync, readFileSync, writeFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const root = realpathSync('.');
const target = realpathSync(process.argv[2] ?? '.sites-work');
const rel = relative(root, target);
if (!rel || rel.startsWith('..') || !existsSync(join(target, '.git'))) throw new Error('Select an existing Sites checkout inside this workspace');
const manifestPath = join(target, '.openai/hosting.json');
const hosting = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (hosting.project_id !== 'appgprj_6adffc3408608191a3ac6a3d3ccdcefc') throw new Error('Unexpected Sites project identity; do not overwrite another Site');
const paths = ['data_src', 'public', 'src', 'scripts', 'sites', 'server', 'deploy', 'docs', 'drizzle', '.env.example', '.gitignore', 'astro.config.mjs', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'LICENSE', 'README.md', 'CLAUDE.md'];
function publishableSource(source) {
  const parts = relative(root, source).split(/[\\/]/);
  if (parts.join('/') === 'data_src/workspace.json') return false;
  return !parts.some(part =>
    ['.git', '.openai', '.qa', '.sites-work', '.workspace.lock', '__pycache__', 'node_modules', '.astro', '.wrangler', 'coverage', 'test-results', 'playwright-report'].includes(part)
    || (part.startsWith('.env') && part !== '.env.example')
    || /(?:\.pyc|\.local|\.lock|\.sqlite(?:3)?(?:-wal|-shm)?|\.db(?:-wal|-shm)?|\.log|\.tmp)$/.test(part));
}
for (const path of paths) {
  if (!existsSync(resolve(root, path))) continue;
  cpSync(resolve(root, path), join(target, path), { recursive: true, filter: publishableSource });
}
delete hosting.static;
hosting.capabilities = [...new Set([...(hosting.capabilities ?? []), 'mcp'])];
writeFileSync(manifestPath, JSON.stringify(hosting, null, 2) + '\n');
console.log(`Synced canonical source to ${target}. Existing Site remains private; run the root-base build and Sites publishing workflow next.`);
