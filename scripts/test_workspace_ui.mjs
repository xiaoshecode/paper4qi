/** Offline interaction regression harness. No browser, network, or added dependencies.
 * The small DOM double models the APIs this controller uses, including FormData's
 * omission of disabled fieldsets. This supplements, not replaces, browser QA.
 * Run: node scripts/test_workspace_ui.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = createRequire(require.resolve('astro/package.json'))('typescript');
const source = readFileSync(new URL('../src/scripts/research-workspace.ts', import.meta.url), 'utf8').replace("import { CATEGORIES } from '../data/meta';", "const CATEGORIES = [{key:'ARCH'}, {key:'OTHER'}];");
// Catch markup/controller ID drift that a permissive DOM double cannot detect.
const markup = readFileSync(new URL('../src/pages/workspace/index.astro', import.meta.url), 'utf8');
for (const match of source.matchAll(/\b(?:el|field)(?:<[^>]+>)?\('([^']+)'\)/g)) {
  assert.ok(markup.includes(`id="rw-${match[1]}"`), `controller element rw-${match[1]} exists in the Astro template`);
}
class Element {
  constructor() { this.value = ''; this.textContent = ''; this.hidden = false; this.disabled = false; this.dataset = {}; this.children = []; this.listeners = {}; this.attributes = {}; this.classList = { toggle() {} }; }
  focus() { this.focused = true; }
  scrollIntoView() { this.scrolled = true; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name, event = { preventDefault() {} }) { for (const fn of this.listeners[name] || []) fn(event); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
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
let mobile = false; window.matchMedia = () => ({ matches: mobile });
const paper = { id: 'test:1', title: 'Original title', abstract: 'An abstract', category: 'ARCH', tags: [], zh: '原摘要' };
const extraPaper = { id: 'test:2', title: 'A second paper', year: 2020, category: 'OTHER', tags: ['survey'], zh: '另一研究' };
let article = { ...paper, body: 'Original body', revision: 0, history: [] };
const analysis = { summary: '分析草稿', category: 'ARCH', tags: [], contributions: ['贡献'], limitations: ['局限'], evidence_basis: 'title_and_abstract' };
let venues = [{ id: 'original', name: 'Original journal', kind: 'journal', issn: '1234-5678', keywords: [], enabled: true }];
let serviceReady = true;
let venueRevision = 0; const writes = []; let simulateConflict = false;
const response = (data, status = 200) => ({ ok: status === 200, status, headers: { get: () => 'application/json' }, json: async () => structuredClone(data) });
const fetch = async (url, options = {}) => {
  if (url.endsWith('data/papers.json')) return response({ papers: [paper, extraPaper] });
  if (url.endsWith('data/workspace.json')) return response({ papers: [], venues, articles: {}, analyses: {} });
  const path = url.split('api/')[1].split('?')[0];
  if (path === 'status') return response({ ready: serviceReady, deepseek_configured: true, model: 'mock' });
  assert.equal(options.headers.Authorization, 'Bearer test-token');
  const body = options.body ? JSON.parse(options.body) : null;
  if (body) writes.push({ path, body });
  if (path === 'papers') return response({ papers: [paper, extraPaper], discoveries: [] });
  if (path === 'venues') { if (body) { venues = body.venues; venueRevision++; } return response({ venues, revision: venueRevision }); }
  if (path === 'analyze') return response({ analysis });
  if (path === 'refresh') { paper.abstract = 'Updated abstract from the source'; return response({ added: 0, updated: 1, sources: [] }); }
  if (path === 'restore') { article = { ...article, title: 'Restored different title', revision: article.revision + 1 }; return response({ article }); }
  if (path === 'article') {
    if (body) {
      if (simulateConflict) return response({ error: 'Conflict' }, 409);
      article = { ...article, ...body.content, revision: article.revision + 1, history: [...article.history, { revision: article.revision + 1, content: body.content, summary: body.summary, at: '2026-11-11' }] };
      return response({ article });
    }
    return response({ paper: { ...paper, title: article.title }, article, analysis });
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
const boot = () => vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, {
  document: { querySelector: () => root, getElementById: id => get(id.replace(/^rw-/, '')), createElement: () => new Element() },
  window, fetch, FormData: FormDataDouble, URLSearchParams, AbortSignal, history: { replaceState() {} }, location: { pathname: '/paper4qi/workspace/', search: '', hash: '' }, console,
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
assert.equal(get('source-editor').open, true, 'editing a venue opens its form');
console.log('PASS: offline controller regressions (disabled FormData, independent venue drafts, edit cancellation, analysis preservation/invalidation including refreshed metadata, conflict retention, token clearing, category/search/reset/sort, keyboard focus, mobile reading navigation, structured analysis, source form disclosure).');

// Public snapshots must remain usable without showing a dead authentication form.
serviceReady = false; ids.clear(); window.listeners = {}; boot(); await flush();
assert.equal(get('connect').hidden, true); assert.equal(get('setup-link').hidden, false);
assert.equal(get('mode-badge').textContent, '公开只读');
await click(get('paper-list').children[0]);
assert.equal(get('detail').hidden, false); assert.equal(get('editor-fields').disabled, true);
assert.equal(get('readonly-note').hidden, false); assert.equal(get('analyze').disabled, true);
console.log('PASS: public snapshot mode hides connection form, explains editing, and permits read-only paper selection.');
