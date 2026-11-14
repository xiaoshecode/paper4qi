// Persistent online-workspace contract tests. SQLite models D1 transactions;
// every provider response is synthetic and no key or network access is needed.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createWorkspaceApi, matchWorkspaceResearchPaper } from '../sites/workspace-api.mjs';
import { createWorker } from '../sites/worker.mjs';

class D1 {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.db.exec(readFileSync(new URL('../drizzle/0000_workspace.sql', import.meta.url), 'utf8'));
  }
  prepare(sql) {
    const db = this.db;
    let args = [];
    const query = {
      bind(...values) { args = values; return query; },
      async first() { return db.prepare(sql).get(...args) ?? null; },
      async all() { return { results: db.prepare(sql).all(...args), success: true }; },
      async run() { return { meta: { changes: db.prepare(sql).run(...args).changes }, success: true }; },
      execute() {
        const statement = db.prepare(sql);
        if (/^\s*(?:SELECT|WITH|PRAGMA)\b/i.test(sql)) return { results: statement.all(...args), success: true };
        return { results: [], meta: { changes: statement.run(...args).changes }, success: true };
      }
    };
    return query;
  }
  async batch(queries) {
    this.db.exec('BEGIN');
    try { const results = queries.map(query => query.execute()); this.db.exec('COMMIT'); return results; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close() { this.db.close(); }
}

const origin = 'https://library.example';
const original = { id: 'qce:10.1234/original', source: 'qce', year: 2025, title: 'Quantum FPGA control', authors: ['Test Author'], abstract: 'A quantum control experiment.', zh: '原始说明', category: 'CRYO', tags: ['hardware'], doi: '10.1234/original', arxiv: null, front_matter: false };
const program = { ...original, id: 'qce26:QSYS-1', source: 'qce26', year: 2026, title: 'Quantum architecture', doi: null, arxiv: '2601.00001', abstract: null, category: 'ARCH' };
const front = { ...original, id: 'qce:10.1234/front', doi: '10.1234/front', front_matter: true };
let corpus = [original, program, front];
let snapshot = { schema_version: 1, papers: [], articles: {}, analyses: {}, venues: [{ id: 'quantum', name: 'Quantum', kind: 'journal', issn: '2521-327X', enabled: true, keywords: [] }] };
const content = (title, body = '公开研究正文') => ({ title, zh: '已审核中文说明', category: 'QEC', tags: ['decoder'], body });
const assets = {
  '/data/manifest.json': { schema_version: '1.0.0', generated: '2026-11-12T00:00:00Z', counts: { records: 3, research_records: 2 }, resources: [{ id: 'papers', url: 'papers.json', sha256: 'build-only', bytes: 10 }] },
  '/data/stats.json': { generated: '2026-11-12T00:00:00Z', totals: { all: 2 }, qce26Tracks: {} },
  '/data/quality.json': { overall: { records: 3 } },
  '/data/research-map.json': { topics: [], counts: {}, domains: [] },
  '/data/id-redirects.json': { redirects: [{ old_id: 'qce26:RETIRED-1', new_id: original.id }] }
};
const readAsset = async path => {
  if (path === '/data/papers.json') return { generated: '2026-11-12T00:00:00Z', count: corpus.length, papers: corpus };
  if (path === '/data/qce.json') return { generated: '2026-11-12T00:00:00Z', papers: corpus.filter(paper => paper.source !== 'tqe') };
  if (path === '/data/tqe.json') return { generated: '2026-11-12T00:00:00Z', papers: [] };
  if (path === '/data/workspace.json') return snapshot;
  return assets[path] ?? null;
};
let instant = new Date('2026-11-12T12:00:00Z');
let aiCalls = 0, crossrefCalls = 0, providerMode = 'ok', onAnalysis;
const draft = { category: 'ARCH', summary: '量子控制研究的中文解读。', contributions: ['摘要描述控制方法。'], limitations: ['需要核对原文。'], evidence_basis: 'title_and_abstract', confidence: 0.6, tags: ['control'] };
const fetchedPaper = (doi, title = 'Quantum compiler discovery') => ({ DOI: doi, type: 'journal-article', ISSN: ['2521-327X'], title: [title], abstract: 'Quantum software research.', 'container-title': ['Quantum'], published: { 'date-parts': [[2026, 11, 10]] }, author: [{ given: 'Synthetic', family: 'Author' }] });
let crossrefItems = [fetchedPaper(original.doi), fetchedPaper('10.22331/test-discovery')];
const fetchImpl = async (url, options) => {
  if (url.startsWith('https://api.crossref.org/')) {
    crossrefCalls++;
    assert(!options.headers.Authorization, 'No model secret sent to Crossref');
    if (providerMode === 'crossref-fail') return new Response('synthetic upstream failure', { status: 503 });
    return Response.json({ message: { items: crossrefItems, 'next-cursor': 'synthetic-cursor' } });
  }
  assert.equal(url, 'https://api.deepseek.com/chat/completions');
  aiCalls++;
  assert.equal(options.redirect, 'error');
  assert.equal(options.headers.Authorization, 'Bearer synthetic-provider-secret');
  const payload = JSON.parse(options.body);
  assert.equal(payload.max_tokens, 1800);
  const material = JSON.parse(payload.messages[1].content);
  assert.deepEqual(Object.keys(material).sort(), ['abstract', 'input_truncated', 'title']);
  assert(material.title.length + material.abstract.length <= 18000);
  if (onAnalysis) await onAnalysis();
  if (providerMode === 'ai-fail') return new Response('synthetic-provider-secret', { status: 500 });
  const value = { ...draft, evidence_basis: material.abstract ? 'title_and_abstract' : 'title_only' };
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] });
};
const db = new D1();
const env = { DB: db, PAPER4QI_EDITOR_IDS: 'editor-a,editor-b', DEEPSEEK_API_KEY: 'synthetic-provider-secret', PAPER4QI_MAX_AI_REQUESTS: '20' };
const api = createWorkspaceApi({ readAsset, fetchImpl, now: () => new Date(instant) });
async function request(route, { method = 'GET', input, actor, extraHeaders = {}, targetEnv = env } = {}) {
  const headers = { ...(method === 'GET' ? {} : { Origin: origin, 'Content-Type': 'application/json' }), ...(actor ? { 'oai-authenticated-user-id': actor } : {}), ...extraHeaders };
  const result = await api.fetch(new Request(`${origin}/api/${route}`, { method, headers, ...(input === undefined ? {} : { body: JSON.stringify(input) }) }), targetEnv);
  assert(result, route);
  return { status: result.status, body: await result.json(), headers: result.headers };
}

try {
  assert.equal((await request('status')).body.can_edit, false);
  assert.equal((await request('status', { actor: 'editor-a' })).body.can_edit, true);
  assert.equal((await request('status', { actor: 'visitor' })).body.can_edit, false);
  const emailEnv = { ...env, PAPER4QI_EDITOR_IDS: '', PAPER4QI_EDITOR_EMAILS: 'allowed@example.invalid' };
  assert.equal((await request('status', { actor: 'email-editor', extraHeaders: { 'oai-authenticated-user-email': 'Allowed@Example.Invalid' }, targetEnv: emailEnv })).body.can_edit, true);
  assert.equal((await request('status', { actor: 'visitor', extraHeaders: { 'oai-authenticated-user-email': 'other@example.invalid' }, targetEnv: emailEnv })).body.can_edit, false);
  assert.equal((await request('status', { extraHeaders: { 'oai-authenticated-user-email': 'allowed@example.invalid' }, targetEnv: emailEnv })).body.can_edit, false, 'Email alone does not establish signed-in identity');
  assert.match((await request('status')).body.login_url, /return_to=/);
  assert(!('editor_id' in (await request('status')).body));
  const firstSave = { id: original.id, expected_revision: 0, summary: '审核第一版', content: content('Reviewed quantum decoder') };
  assert.equal((await request('article', { method: 'PUT', input: firstSave })).status, 403);
  assert.equal((await request('article', { method: 'PUT', actor: 'visitor', input: firstSave })).status, 403);
  assert.equal((await request('article', { method: 'PUT', actor: 'editor-a', input: firstSave, extraHeaders: { Origin: 'https://other.example' } })).status, 403);
  assert.equal((await request('article', { method: 'PUT', actor: 'editor-a', input: firstSave, extraHeaders: { 'Content-Type': 'application/json-invalid' } })).status, 400);
  assert.equal((await request('article', { method: 'PUT', actor: 'editor-a', input: firstSave })).body.article.revision, 1);
  const raced = await Promise.all(['editor-a', 'editor-b'].map((actor, index) => request('article', { method: 'PUT', actor, input: { ...firstSave, expected_revision: 1, summary: `设备 ${index + 1} 的审核`, content: content(`Reviewed quantum device ${index + 1}`) } })));
  assert.deepEqual(raced.map(result => result.status).sort(), [200, 409], 'One winner per revision across devices');
  let article = (await request(`article?id=${encodeURIComponent(original.id)}`)).body.article;
  assert.equal(article.revision, 2); assert.equal(article.history.length, 2);
  assert(!JSON.stringify(article).includes('editor-a'));
  assert(!JSON.stringify(article).includes('editor-b'));
  assert.throws(() => db.db.exec("UPDATE workspace_revisions SET edit_summary = 'tamper'"), /immutable/);
  assert.throws(() => db.db.exec('DELETE FROM workspace_revisions'), /immutable/);
  assert.equal((await request('restore', { method: 'POST', actor: 'editor-a', input: { id: original.id, expected_revision: 2, revision: 1, summary: '恢复第一版' } })).body.article.revision, 3);
  article = (await request(`article?id=${encodeURIComponent(original.id)}`)).body.article;
  assert.equal(article.title, firstSave.content.title); assert.equal(article.history.length, 3);
  assert.equal((await request(`article?id=${encodeURIComponent('qce26:RETIRED-1')}`)).body.paper.id, original.id);
  let live = await api.readPublicResource('/data/papers.json', env);
  assert.equal(live.papers[0].title, firstSave.content.title); assert(live.papers[0].has_notes);
  const runtimeBeforeDraft = live.runtime_revision;
  const analysis = await request('analyze', { method: 'POST', actor: 'editor-a', input: { id: original.id } });
  assert.equal(analysis.status, 200); assert.equal(aiCalls, 1);
  const publicDraft = (await request(`article?id=${encodeURIComponent(original.id)}`)).body;
  assert.equal(publicDraft.analysis.summary, draft.summary); assert.equal(publicDraft.analysis_history.length, 1);
  assert.equal(publicDraft.article.revision, 3, 'Generation does not adopt or save');
  assert.equal((await request('analyze', { method: 'POST', actor: 'editor-a', input: { id: original.id } })).status, 200);
  assert.equal(aiCalls, 1, 'Same model and material uses the persisted cache');
  assert.equal((await request('analyze', { method: 'POST', actor: 'editor-a', input: { id: program.id } })).body.analysis.confidence, 0.3);
  const titleOnly = (await request(`article?id=${encodeURIComponent(program.id)}`)).body.analysis;
  assert.deepEqual(titleOnly.contributions, []); assert.match(titleOnly.summary, /缺少摘要/);
  live = await api.readPublicResource('/data/workspace.json', env);
  assert(live.runtime_revision > runtimeBeforeDraft); assert.equal(live.analysis_history[original.id].length, 1);
  assert(!JSON.stringify(live).includes(env.DEEPSEEK_API_KEY)); assert(!JSON.stringify(live).includes('editor-a'));
  const stat = await api.readPublicResource('/data/stats.json', env);
  assert.equal(stat.totals.all, 2); assert.equal(stat.totals.front, 1); assert.equal(stat.matrix.combined['2025'].QEC, 1);
  assert.equal((await request('refresh', { method: 'POST', actor: 'editor-a', input: {} })).body.added, 1);
  let listings = (await request('papers')).body;
  assert.equal(listings.discoveries.length, 1); assert.equal(listings.papers.length, 3);
  const checkpoint = db.db.prepare('SELECT checkpoint FROM workspace_checkpoints').get().checkpoint;
  assert.equal(checkpoint, '2026-11-12');
  instant = new Date(instant.getTime() + 31000);
  assert.equal((await request('refresh', { method: 'POST', actor: 'editor-a', input: {} })).body.added, 0);
  assert.equal((await request('papers')).body.discoveries.length, 1);
  const discovery = listings.discoveries[0];
  assert.equal((await request('article', { method: 'PUT', actor: 'editor-a', input: { id: discovery.id, expected_revision: 0, summary: '发现笔记', content: content('Discovered quantum note') } })).status, 200);
  corpus = [...corpus, { ...discovery, id: `tqe:${discovery.doi}`, source: 'tqe' }];
  listings = (await request('papers')).body;
  assert.equal(listings.discoveries.length, 0, 'A formal DOI leaves the inbox');
  const promoted = (await request(`article?id=${encodeURIComponent(discovery.id)}`)).body;
  assert.equal(promoted.article.revision, 1); assert.equal(promoted.paper.id, `tqe:${discovery.doi}`);
  assert.equal((await request('article', { method: 'PUT', actor: 'editor-b', input: { id: promoted.paper.id, expected_revision: 1, summary: '发表后更新', content: content('Published quantum note') } })).body.article.history.length, 2);
  instant = new Date(instant.getTime() + 61000); providerMode = 'crossref-fail';
  assert.equal((await request('refresh', { method: 'POST', actor: 'editor-a', input: {} })).body.sources[0].status, 'error');
  assert.equal(db.db.prepare('SELECT checkpoint FROM workspace_checkpoints').get().checkpoint, checkpoint);
  providerMode = 'ok';
  onAnalysis = async () => { onAnalysis = null; const saved = await request('article', { method: 'PUT', actor: 'editor-b', input: { id: promoted.paper.id, expected_revision: 2, summary: '分析期间更新', content: content('Concurrent quantum change') } }); assert.equal(saved.status, 200); };
  assert.equal((await request('analyze', { method: 'POST', actor: 'editor-a', input: { id: promoted.paper.id } })).status, 409, 'Changed input never stores a stale AI result');
  assert.equal((await request(`article?id=${encodeURIComponent(promoted.paper.id)}`)).body.analysis_history.length, 0);
  providerMode = 'ai-fail';
  const failed = await request('analyze', { method: 'POST', actor: 'editor-a', input: { id: promoted.paper.id } });
  assert.equal(failed.status, 502); assert(!JSON.stringify(failed.body).includes(env.DEEPSEEK_API_KEY));
  assert.equal((await request('analyze', { method: 'POST', actor: 'editor-a', input: { id: promoted.paper.id }, targetEnv: { ...env, PAPER4QI_MAX_AI_REQUESTS: '1' } })).status, 429);
  assert.equal((await request('status', { targetEnv: {} })).body.ready, false);
  assert.equal((await request('papers', { targetEnv: {} })).status, 200);
  assert.equal((await request('article', { method: 'PUT', actor: 'editor-a', input: firstSave, targetEnv: { PAPER4QI_EDITOR_IDS: 'editor-a' } })).status, 503);
  assert(crossrefCalls >= 3);

  const compressed = {};
  for (const path of ['/data/papers.json', '/data/qce.json', '/data/tqe.json', '/data/workspace.json', ...Object.keys(assets)]) {
    const bytes = Buffer.from(JSON.stringify(await readAsset(path)));
    compressed[path] = { type: 'application/json', sha256: createHash('sha256').update(bytes).digest('hex'), body: gzipSync(bytes).toString('base64') };
  }
  const worker = createWorker(compressed);
  const manifest = await (await worker.fetch(new Request(origin + '/data/manifest.json'), env)).json();
  assert.equal(manifest.runtime.mode, 'online'); assert(!('sha256' in manifest.resources[0]));
  const served = await worker.fetch(new Request(origin + '/data/papers.json'), env);
  assert.equal(served.headers.get('Cache-Control'), 'no-store');
  assert.equal((await served.json()).papers[0].title, firstSave.content.title);
  assert.equal((await worker.fetch(new Request(origin + '/api/status'), env)).status, 200);
  assert.equal((await worker.fetch(new Request(origin + '/paper4qi/api/status'), env)).status, 200);
  assert.equal((await worker.fetch(new Request(origin + '/api/unknown/nested'), env)).status, 404);
  const brokenDb = { prepare() { throw new Error('synthetic-private-driver-detail'); } };
  const failedTool = await worker.fetch(new Request(origin + '/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_library_overview', arguments: {} } }) }), { ...env, DB: brokenDb });
  assert(!JSON.stringify(await failedTool.json()).includes('synthetic-private-driver-detail'), 'MCP never returns database driver errors');
  console.log('PASS: D1 authorization, cross-device CAS/history, restore, aliases/DOI promotion, public drafts, bounded AI/cache/races/quotas, manual discovery/checkpoints, live resources and Worker integration.');
} finally { db.close(); }

// Import an already-reviewed static snapshot without losing earlier revisions.
const importDb = new D1();
const v1 = content('Static quantum v1'), v2 = content('Static quantum v2');
snapshot = { ...snapshot, articles: { [original.id]: { ...v2, revision: 2, updated_at: '2026-11-11T00:00:00Z', history: [{ revision: 1, at: '2026-11-10T00:00:00Z', summary: '旧第一版', content: v1 }, { revision: 2, at: '2026-11-11T00:00:00Z', summary: '旧第二版', content: v2 }] } } };
try {
  const imported = await request('article', { method: 'PUT', actor: 'editor-a', input: { id: original.id, expected_revision: 2, summary: '在线第三版', content: content('Online quantum v3') }, targetEnv: { ...env, DB: importDb } });
  assert.equal(imported.status, 200, JSON.stringify(imported.body));
  assert.equal(imported.body.article.revision, 3); assert.equal(imported.body.article.history.length, 3);
  assert.equal(imported.body.article.history[0].content.title, v1.title);
  console.log('PASS: previously published static Wiki history imports atomically before the next online revision.');
} finally { importDb.close(); }

// A request can observe an empty cache just before another device finishes.
// Re-reading after acquiring the database lease must avoid a second paid call.
snapshot = { ...snapshot, articles: {}, analyses: {} };
const cacheDb = new D1();
const cacheEnv = { ...env, DB: cacheDb };
let pauseRead = true, releaseRead, signalRead;
const readReached = new Promise(resolve => { signalRead = resolve; });
const canReturn = new Promise(resolve => { releaseRead = resolve; });
const prepare = cacheDb.prepare.bind(cacheDb);
cacheDb.prepare = sql => {
  const query = prepare(sql);
  if (/SELECT input_hash, model, analysis_json FROM workspace_analyses WHERE paper_id/.test(sql)) {
    const read = query.first.bind(query);
    query.first = async () => {
      const result = await read();
      if (pauseRead) { pauseRead = false; signalRead(); await canReturn; }
      return result;
    };
  }
  return query;
};
providerMode = 'ok';
const beforeCacheRace = aiCalls;
try {
  const pending = request('analyze', { method: 'POST', actor: 'editor-a', input: { id: original.id }, targetEnv: cacheEnv });
  await readReached;
  assert.equal((await request('analyze', { method: 'POST', actor: 'editor-b', input: { id: original.id }, targetEnv: cacheEnv })).status, 200);
  releaseRead();
  assert.equal((await pending).status, 200);
  assert.equal(aiCalls - beforeCacheRace, 1);
  assert.equal(cacheDb.db.prepare('SELECT COUNT(*) AS n FROM workspace_analysis_history').get().n, 1);
  console.log('PASS: a concurrent stale cache read is rechecked under the persistent lease without a second paid call.');
} finally { releaseRead(); cacheDb.close(); }

const topic = { keywords: ['real time', 'surface code', 'control'], exclude_keywords: [] };
assert.deepEqual(matchWorkspaceResearchPaper({ id: 'test', title: 'FPGA real-time decoder', abstract: 'A surface-code experiment.', tags: ['control'], zh: 'photon', front_matter: false }, topic), { id: 'test', score: 6, matched_terms: ['real time', 'surface code', 'control'] });
assert.equal(matchWorkspaceResearchPaper({ id: 'test', title: 'decoherence', abstract: '', tags: [], front_matter: false }, { keywords: ['deco'] }), null);
assert.equal(matchWorkspaceResearchPaper({ id: 'test', title: 'Control systems', tags: [], front_matter: true }, topic), null);
console.log('PASS: live topic matching retains field weights, normalization, word boundaries and front-matter exclusion.');
