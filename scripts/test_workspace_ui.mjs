/** Offline interaction regression harness. No browser, network, or added dependencies.
 * The small DOM double models the APIs this controller uses, including FormData's
 * omission of disabled fieldsets. This supplements, not replaces, browser QA.
 * Run: node scripts/test_workspace_ui.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { inlineApiClient } from './lib_api_client_test.mjs';
const require = createRequire(import.meta.url);
const ts = createRequire(require.resolve('astro/package.json'))('typescript');
const highlightSource = readFileSync(new URL('../src/scripts/highlight.ts', import.meta.url), 'utf8');
const parseTermsSource = highlightSource.slice(highlightSource.indexOf('export function parseTerms')).replace('export ', '');
const source = readFileSync(new URL('../src/scripts/research-workspace.ts', import.meta.url), 'utf8')
  .replace("import { CATEGORIES } from '../data/meta';", "const CATEGORIES = [{key:'ARCH'}, {key:'OTHER'}];")
  .replace("import { parseTerms } from './highlight';", parseTermsSource);
// Catch markup/controller ID drift that a permissive DOM double cannot detect.
const markup = readFileSync(new URL('../src/pages/workspace/index.astro', import.meta.url), 'utf8');
for (const match of source.matchAll(/\b(?:el|field)(?:<[^>]+>)?\('([^']+)'\)/g)) {
  assert.ok(markup.includes(`id="rw-${match[1]}"`), `controller element rw-${match[1]} exists in the Astro template`);
}
class Element {
  constructor() { this.value = ''; this.textContent = ''; this.hidden = false; this.disabled = false; this.checked = false; this.dataset = {}; this.children = []; this.listeners = {}; this.attributes = {}; this.classList = { toggle() {} }; }
  focus() { this.focused = true; }
  scrollIntoView() { this.scrolled = true; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name, event = { preventDefault() {} }) { for (const fn of this.listeners[name] || []) fn(event); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  reset() { this.value = ''; }
  querySelector() { return this.children[0] ||= new Element(); }
  querySelectorAll() { return []; }
}
const ids = new Map();
const get = id => { if (!ids.has(id)) ids.set(id, new Element()); return ids.get(id); };
const root = new Element(); root.dataset.base = '/paper4qi/';
const formFields = Object.fromEntries(['id', 'name', 'kind', 'identifier', 'keywords'].map(k => [k, new Element()]));
get('venue-form').elements = { namedItem: key => formFields[key] };
const confirmations = []; let confirmAnswer = true;
const window = new Element(); window.confirm = message => { confirmations.push(message); return confirmAnswer; };
window.dispatchEvent = event => { window.emit(event.type, event); return true; };
class EventDouble { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } }
let mobile = false; window.matchMedia = () => ({ matches: mobile });
const paper = { id: 'test:1', title: 'Original title', abstract: 'An abstract', category: 'ARCH', tags: [], zh: '原摘要' };
const extraPaper = { id: 'test:2', title: 'A second paper', year: 2020, category: 'OTHER', tags: ['survey'], zh: '另一研究' };
let article = { ...paper, body: 'Original body', revision: 0, history: [] };
const analysis = { summary: '分析草稿', category: 'ARCH', tags: [], contributions: ['贡献'], limitations: ['局限'], evidence_basis: 'title_and_abstract' };
let venues = [{ id: 'original', name: 'Original journal', kind: 'journal', issn: '1234-5678', keywords: [], enabled: true }];
let serviceReady = true, online = false, canEdit = false, failPaperSnapshot = false, failWorkspaceSnapshot = false, failArticleGet = false;
let passwordMode = false, passwordSession = false, rejectPasswordRequest = false;
const passwordSessionToken = 'b'.repeat(64);
let refreshSources = [], additionalPapers = [], discoveries = [], statusCalls = 0;
let venueRevision = 0; const writes = []; let simulateConflict = false;
const response = (data, status = 200) => ({ ok: status === 200, status, headers: { get: () => 'application/json' }, json: async () => structuredClone(data) });
const fetch = async (url, options = {}) => {
  if (url.endsWith('data/papers.json')) { if (failPaperSnapshot) throw new Error('snapshot unavailable'); return response({ papers: [paper, extraPaper, ...additionalPapers] }); }
  if (url.endsWith('data/workspace.json')) { if (failWorkspaceSnapshot) throw new Error('workspace snapshot unavailable'); return response({ papers: [], venues, articles: {}, analyses: {} }); }
  const path = url.split('api/')[1].split('?')[0];
  const authorization = new Headers(options.headers).get('Authorization');
  const passwordAuthorized = passwordSession && authorization === `Bearer ${passwordSessionToken}`;
  if (path === 'status') { statusCalls++; return response({ mode: online ? 'online' : 'local', ready: serviceReady, auth_mode: passwordMode ? 'password' : 'sites', can_edit: passwordMode ? passwordAuthorized : canEdit, deepseek_configured: true, model: 'mock' }); }
  const body = options.body ? JSON.parse(options.body) : null;
  if (path === 'auth/login') {
    assert.equal(options.credentials, 'same-origin');
    if (body.password !== 'fixture-owner-password') return response({ error: 'Invalid credentials' }, 401);
    passwordSession = true; return response({ token: passwordSessionToken, expires_at: Date.now() / 1000 + 3600, can_edit: true });
  }
  if (path === 'auth/logout') { assert.equal(authorization, `Bearer ${passwordSessionToken}`); passwordSession = false; return response({ can_edit: false }); }
  if (passwordMode && path === 'article' && rejectPasswordRequest) { rejectPasswordRequest = false; return response({ error: 'Session expired' }, 401); }
  if (online && !passwordMode) { assert.equal(authorization, null, 'Sites requests never use a local Bearer token'); assert.equal(options.credentials, 'same-origin'); }
  else if (passwordMode) assert.equal(options.credentials, 'same-origin');
  else assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer test-token');
  if (online && options.method !== 'GET' && !(passwordMode ? passwordAuthorized : canEdit)) return response({ error: 'No edit permission' }, 403);
  if (body) writes.push({ path, body });
  if (path === 'papers') return response({ papers: [{ ...paper, has_notes: article.revision > 0 }, extraPaper, ...additionalPapers], discoveries });
  if (path === 'venues') { if (body) { venues = body.venues; venueRevision++; } return response({ venues, revision: venueRevision }); }
  if (path === 'analyze') return response({ analysis });
  if (path === 'refresh') { paper.abstract = 'Updated abstract from the source'; return response({ added: 0, updated: 1, sources: refreshSources }); }
  if (path === 'restore') { article = { ...article, title: 'Restored different title', revision: article.revision + 1 }; return response({ article }); }
  if (path === 'article') {
    if (!body && failArticleGet) throw new Error('article request failed');
    if (body) {
      if (simulateConflict) return response({ error: 'Conflict' }, 409);
      article = { ...article, ...body.content, revision: article.revision + 1, history: [...article.history, { revision: article.revision + 1, content: body.content, summary: body.summary, at: '2026-11-11' }] };
      return response({ article });
    }
    const identifier = new URL(url, 'https://fixture.invalid').searchParams.get('id');
    const target = [...additionalPapers, ...discoveries].find(p => p.id === identifier);
    if (target) return response({ paper: target, article: { ...target, category: target.category || 'OTHER', tags: target.tags || [], zh: target.zh || '', body: 'Public fixture body', revision: 0, history: [] }, analysis: null });
    return response({ paper: { ...paper, title: article.title }, article, analysis, analysis_history: [analysis] });
  }
  throw new Error(`Unexpected endpoint ${path}`);
};
class FormDataDouble {
  constructor() {
    // HTML FormData excludes all successful controls inside a disabled fieldset.
    this.data = get('venue-fields').disabled ? {} : Object.fromEntries(Object.entries(formFields).map(([k, v]) => [k, v.value]));
  }
  get(key) { return this.data[key] ?? null; }
}
const location = { origin: 'https://fixture.invalid', pathname: '/paper4qi/workspace/', search: '', hash: '' };
const history = { replaceState(_state, _title, value) { location.hash = new URL(value, 'https://fixture.invalid').hash; } };
const boot = () => vm.runInNewContext(ts.transpileModule(inlineApiClient(source), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, {
  document: { querySelector: () => root, getElementById: id => get(id.replace(/^rw-/, '')), createElement: () => new Element() },
  window, fetch, Headers, URL, CustomEvent: EventDouble, FormData: FormDataDouble, URLSearchParams, AbortSignal, history, location, console,
});
boot();
const flush = () => new Promise(resolve => setImmediate(resolve));
const click = async element => { element.emit('click'); await flush(); };
const submit = async id => { get(id).emit('submit'); await flush(); };
const unloadPrevented = () => { let prevented = false; window.emit('beforeunload', { preventDefault() { prevented = true; } }); return prevented; };
await flush();
assert.equal(get('connect').hidden, false, 'local service exposes connection form');
assert.equal(get('mode-badge').textContent, '本地待连接');
assert.equal(get('readonly-note').hidden, false);
assert.equal(get('paper-count').textContent, '2');
get('filter-category').value = 'OTHER'; get('filter-category').emit('change');
assert.equal(get('paper-count').textContent, '1', 'category filter narrows results');
assert.equal(get('paper-list').children[0].children[1].textContent, 'A second paper');
get('search').value = 'nonexistent'; get('search').emit('input');
assert.equal(get('paper-count').textContent, '0'); assert.equal(get('more').hidden, true);
await click(get('clear'));
assert.equal(get('paper-count').textContent, '2'); assert.equal(get('search').focused, true); assert.equal(get('clear').hidden, true);
get('sort').value = 'title'; get('sort').emit('change');
assert.equal(get('paper-list').children[0].children[1].textContent, 'A second paper', 'title ordering works');
get('sort').value = 'recent'; get('sort').emit('change');
get('search').value = 'Original'; get('search').emit('input');
get('search').focused = false;
window.emit('keydown', { key: '/', target: { closest: () => true }, preventDefault() {} });
assert.equal(get('search').focused, false, 'slash does not steal focus from editable fields');
window.emit('keydown', { key: '/', target: { closest: () => false }, preventDefault() {} });
assert.equal(get('search').focused, true, 'slash focuses search outside editable fields');
get('token').value = 'test-token'; await submit('connect');
assert.equal(get('readonly-note').hidden, true); assert.equal(root.dataset.connected, 'true');
assert.equal(get('token').value, ''); assert.equal(get('venue-fields').disabled, false);
for (const [k, v] of Object.entries({ id: 'new-journal', name: 'New journal', kind: 'journal', identifier: '2222-3333', keywords: 'quantum, compiler' })) formFields[k].value = v;
get('venue-form').emit('input'); await submit('venue-form');
assert.deepEqual(writes.at(-1).body.venues.at(-1), { id: 'new-journal', name: 'New journal', kind: 'journal', enabled: true, keywords: ['quantum', 'compiler'], issn: '2222-3333' });
assert.equal(unloadPrevented(), false, 'actual form save clears form dirtiness');
formFields.name.value = 'Unsaved form draft'; get('venue-form').emit('input');
await click(get('venue-list').children[0].children[1]);
assert.equal(unloadPrevented(), true, 'toggle must not clear unrelated form dirtiness');
get('venues-json').value = JSON.stringify(venues); await click(get('save-venues'));
assert.equal(unloadPrevented(), true, 'JSON save must not clear unrelated form dirtiness');
confirmAnswer = false; await click(get('venue-list').children[0].children[2]);
assert.equal(formFields.name.value, 'Unsaved form draft', 'cancel editing a source preserves form');
confirmAnswer = true; await click(get('venue-list').children[0].children[2]);
assert.equal(formFields.name.value, 'Original journal'); assert.equal(unloadPrevented(), false);
mobile = true;
await click(get('paper-list').children[0]); assert.equal(get('adopt').disabled, false);
assert.equal(get('selected-title').textContent, 'Original title');
assert.equal(get('editor').scrolled, true); assert.equal(get('editor-title').focused, true);
assert.equal(get('analysis-readable').children[0].textContent, '分析草稿');
assert.equal(get('analysis-readable').children[2].children[0].textContent, '贡献');
await click(get('back-to-list')); assert.equal(get('inbox').scrolled, true);
mobile = false;
get('body').value = 'Unsaved notes'; get('editor-form').emit('input'); await click(get('analyze'));
assert.equal(get('body').value, 'Unsaved notes', 'analysis response does not replace edits');
get('title').value = 'Changed title'; get('edit-summary').value = 'Change title'; await submit('editor-form');
assert.equal(get('adopt').disabled, true, 'saved title change invalidates displayed analysis'); assert.equal(get('analysis-text').textContent, '暂无分析草稿。');
await click(get('analyze')); assert.equal(get('adopt').disabled, false);
await click(get('history').children[0].children[2]); assert.equal(get('adopt').disabled, true, 'restore with changed title invalidates analysis');
await click(get('analyze')); assert.equal(get('adopt').disabled, false);
paper.title = get('title').value; // Isolate abstract-only source changes in this regression.
get('body').value = 'Unsaved notes during refresh'; get('editor-form').emit('input');
await click(get('refresh'));
assert.equal(get('adopt').disabled, true, 'refresh changing selected abstract invalidates analysis');
assert.equal(get('analysis-text').textContent, '暂无分析草稿。');
assert.equal(get('abstract').textContent, 'Updated abstract from the source');
assert.equal(get('body').value, 'Unsaved notes during refresh', 'refresh must preserve unsaved editor body');
assert.equal(unloadPrevented(), true, 'refresh must preserve editor dirty state');
get('body').value = 'Preserve on conflict'; get('edit-summary').value = 'Conflict test'; get('editor-form').emit('input'); simulateConflict = true; await submit('editor-form');
assert.equal(get('body').value, 'Preserve on conflict'); assert.equal(unloadPrevented(), true);
assert.ok(get('status').textContent.includes('版本冲突'));
refreshSources = [{id:'original',status:'partial',complete:false,scanned:100,count:0}];
await click(get('refresh'));
assert.ok(get('status').textContent.includes('1 个来源尚未完成'));
assert.ok(get('source-results').textContent.includes('扫描 100 条'));
refreshSources = [{id:'original',status:'error',complete:false,count:0}];
await click(get('refresh'));
assert.ok(get('status').textContent.includes('1 个来源失败'));
assert.equal(get('source-editor').open, true, 'editing a venue opens its form');
console.log('PASS: offline controller regressions (disabled FormData, independent venue drafts, edit cancellation, analysis preservation/invalidation including refreshed metadata, conflict retention, token clearing, category/search/reset/sort, keyboard focus, mobile reading navigation, structured analysis, source form disclosure).');

// Public snapshots must remain usable without showing a dead authentication form.
serviceReady = false; location.hash = ''; ids.clear(); window.listeners = {}; boot(); await flush();
assert.equal(get('connect').hidden, true); assert.equal(get('setup-link').hidden, false);
assert.equal(get('mode-badge').textContent, '公开只读');
await click(get('paper-list').children[0]);
assert.equal(get('detail').hidden, false); assert.equal(get('editor-fields').disabled, true);
assert.equal(get('readonly-note').hidden, false); assert.equal(get('analyze').disabled, true);
console.log('PASS: public snapshot mode hides connection form, explains editing, and permits read-only paper selection.');

const restart = async () => { ids.clear(); window.listeners = {}; location.hash = ''; confirmAnswer = true; simulateConflict = false; boot(); await flush(); };
serviceReady = true; failPaperSnapshot = true; failWorkspaceSnapshot = true;
const beforeStatus = statusCalls; await restart();
assert.ok(statusCalls > beforeStatus, 'snapshot errors do not skip live status detection');
assert.equal(get('connect').hidden, false, 'local service can be connected despite both missing snapshots');
get('token').value = 'test-token'; await submit('connect');
assert.equal(get('paper-count').textContent, '2', 'local API loads without a public snapshot');
discoveries = [{ id: 'discovery:fixture', title: 'Discovery fixture', zh: 'Unpublished in this snapshot', year: 2026, tags: [] }];
get('token').value = 'test-token'; await submit('connect');
assert.ok(get('paper-list').children.some(b => b.children[1]?.textContent === 'Discovery fixture'));
await click(get('disconnect'));
assert.equal(root.dataset.connected, 'false');
assert.equal(get('paper-list').children.some(b => b.children[1]?.textContent === 'Discovery fixture'), false, 'disconnect clears API-only list before a failing snapshot load');
assert.equal(get('body').value, ''); assert.equal(get('analysis-history').children.length, 0);

failPaperSnapshot = false; failWorkspaceSnapshot = false; discoveries = [];
await restart(); get('token').value = 'test-token'; await submit('connect');
await click(get('paper-list').children[0]);
get('body').value = 'Draft survives reconnection failure'; get('editor-form').emit('input');
failArticleGet = true; get('token').value = 'test-token'; await submit('connect');
assert.equal(get('body').value, 'Draft survives reconnection failure');
assert.equal(unloadPrevented(), true, 'failed article reload keeps dirty/unload protection');
assert.equal(get('dirty').textContent, '有未保存修改'); failArticleGet = false;
console.log('PASS: independent service detection, disconnect clearing and atomic reconnection preserve recovery boundaries.');

online = true; canEdit = false; discoveries = [];
additionalPapers = [
  { id: 'qce26:fixture', source: 'qce26', title: 'Dynamic quantum schedule', year: 2026, arxiv: '2601.01234', category: 'ARCH', tags: [], zh: '' },
  { id: 'qce:front', source: 'qce', title: 'Front cover', year: 2025, front_matter: true, category: 'OTHER', tags: [], zh: '' },
];
discoveries = [{ id: 'discovery:fixture', source: 'crossref', title: 'Compiler quantum discovery', year: 2024, category: 'ARCH', tags: [], zh: '' }];
await restart();
assert.equal(get('mode-badge').textContent, '在线公开只读');
assert.equal(get('connect').hidden, true); assert.equal(get('login-link').hidden, false);
assert.ok(get('login-link').href.startsWith('/signin-with-chatgpt?return_to='));
assert.equal(get('paper-count').textContent, '4', 'front matter is hidden by default');
get('show-front').checked = true; get('show-front').emit('change'); assert.equal(get('paper-count').textContent, '5');
await click(get('clear'));
get('search').value = 'quantum compiler'; get('search').emit('input');
assert.equal(get('paper-count').textContent, '1', 'AND terms match reversed word order');
assert.equal(get('paper-list').children[0].children[1].textContent, 'Compiler quantum discovery');
await click(get('clear')); get('view').value = 'new'; get('view').emit('change');
assert.equal(get('paper-count').textContent, '1');
await click(get('clear')); get('filter-source').value = 'qce26'; get('filter-source').emit('change');
assert.equal(get('paper-count').textContent, '1');
get('filter-year').value = '2025'; get('filter-year').emit('change'); assert.equal(get('paper-count').textContent, '0');
get('filter-year').value = '2026'; get('filter-year').emit('change');
await click(get('paper-list').children[0]);
assert.ok(get('paper-meta').textContent.includes('非发表证明'));
assert.equal(get('source-link').href, 'https://arxiv.org/abs/2601.01234');
assert.equal(get('public-body').textContent, 'Public fixture body');
assert.equal(get('editor-fields').disabled, true); assert.equal(get('analyze').disabled, true); assert.equal(get('refresh').disabled, true);
const beforeAnonymousWrites = writes.length;
await submit('editor-form'); await click(get('analyze')); await click(get('refresh'));
assert.equal(writes.length, beforeAnonymousWrites, 'anonymous controls never dispatch mutating requests');
await click(get('clear')); location.hash = '#id=test%3A1'; window.emit('hashchange'); await flush();
assert.equal(get('selected-title').textContent, article.title);
assert.equal(get('history').children.length, article.history.length, 'anonymous reads public version history');
assert.equal(get('history').children[0].children[2].disabled, true, 'anonymous cannot restore an old version');
assert.equal(get('analysis-readable').children[0].textContent, '分析草稿', 'anonymous reads public AI draft');
assert.equal(get('analysis-history').children.length, 1);
assert.equal(get('public-body').textContent, article.body);
get('view').value = 'notes'; get('view').emit('change'); assert.equal(get('paper-count').textContent, '1');

canEdit = true; await restart();
assert.equal(get('mode-badge').textContent, '在线可编辑'); assert.equal(get('login-link').hidden, true);
await click(get('paper-list').children.find(b => b.children[1]?.textContent === paper.title));
get('title').value = 'Online reviewed title'; get('body').value = 'Online public notes'; get('edit-summary').value = 'Reviewed on another device'; get('editor-form').emit('input');
await click(get('analyze')); assert.equal(get('body').value, 'Online public notes', 'generating an online draft does not overwrite edited content');
analysis.stale = true;
await click(get('reload-article'));
assert.equal(get('adopt').disabled, true, 'a stale public draft cannot be adopted');
const beforeStaleAdopt = get('body').value;
await click(get('adopt'));
assert.equal(get('body').value, beforeStaleAdopt, 'stale draft history remains readable without replacing the editor');
delete analysis.stale;
await click(get('reload-article'));
get('title').value = 'Online reviewed title'; get('body').value = 'Online public notes'; get('edit-summary').value = 'Reviewed on another device'; get('editor-form').emit('input');
await submit('editor-form');
assert.equal(get('public-body').textContent, 'Online public notes');
assert.equal(get('selected-title').textContent, 'Online reviewed title');
assert.equal(writes.at(-1).body.summary, 'Reviewed on another device');
assert.ok(get('status').textContent.includes('公开保留'));
get('body').value = 'Unsaved draft while following link'; get('editor-form').emit('input');
confirmAnswer = false; location.hash = '#id=qce26%3Afixture'; window.emit('hashchange'); await flush();
assert.equal(get('body').value, 'Unsaved draft while following link', 'cancelled hash navigation retains the local draft');
assert.equal(location.hash, '#id=test%3A1');
confirmAnswer = true;
assert.ok(markup.includes('lang="zh-CN"'));
console.log('PASS: online cookie authentication, anonymous public body/history/drafts, permission-gated writes, AND/source/year/view/front-matter filtering, arXiv fallback, deep links and reviewed publication.');

passwordMode = true; passwordSession = false; canEdit = false; additionalPapers = []; discoveries = [];
await restart();
assert.equal(get('password-login').hidden, false);
assert.equal(get('login-link').hidden, true, 'Standalone password mode does not send users to Sites sign-in');
await click(get('paper-list').children[0]);
get('password').value = 'wrong-password'; await submit('password-login');
assert.equal(get('password').value, '', 'Passwords are cleared after submission');
assert.equal(root.dataset.connected, 'false');
get('password').value = 'fixture-owner-password'; await submit('password-login');
assert.equal(root.dataset.connected, 'true'); assert.equal(get('password-logout').hidden, false);
assert.equal(get('editor-fields').disabled, false);
get('body').value = 'Password-auth unsaved notes'; get('editor-form').emit('input');
rejectPasswordRequest = true; await click(get('reload-article'));
assert.equal(root.dataset.connected, 'false', 'Rejected owner sessions revoke frontend editing state');
assert.equal(get('body').value, 'Password-auth unsaved notes'); assert.equal(unloadPrevented(), true);
get('password').value = 'wrong-password'; await submit('password-login');
assert.equal(get('body').value, 'Password-auth unsaved notes'); assert.equal(unloadPrevented(), true);
get('password').value = 'fixture-owner-password'; await submit('password-login');
assert.equal(root.dataset.connected, 'true');
await click(get('password-logout'));
assert.equal(root.dataset.connected, 'false'); assert.equal(get('password-logout').hidden, true);
assert.equal(get('body').value, 'Password-auth unsaved notes', 'Logout preserves the local unsaved research draft');
console.log('PASS: standalone owner password login, memory-only session authorization, invalid-session recovery and draft-preserving logout.');
