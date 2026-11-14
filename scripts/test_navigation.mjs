import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { inlineApiClient } from './lib_api_client_test.mjs';
const require = createRequire(import.meta.url);
const ts = createRequire(require.resolve('astro/package.json'))('typescript');
const source = readFileSync(new URL('../src/data/navigation.ts', import.meta.url), 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, context);
const { navigation, matchesDestination: match } = context.exports;
assert.equal(navigation.length, 5);
assert.equal(navigation.filter(n => n.children).length, 3);
const links = navigation.flatMap(n => n.children || [n]);
const expected = ['', 'workspace/', 'qce/', 'tqe/', 'venues/', 'stats/', 'research/', 'cs4q/', 'openqasm/', 'agents/', 'about/'];
assert.equal(new Set(links.map(l => l.path)).size, 11);
assert.deepEqual([...links.map(l => l.path)].sort(), [...expected].sort());
for (const base of ['/paper4qi/', '/']) {
  for (const path of expected) {
    assert.ok(match(base + path, base, path));
    assert.equal(links.filter(l => match(base + path, base, l.path)).length, 1);
  }
  assert.ok(match(base + 'research/control/', base, 'research/'));
  assert.ok(!match(base + 'research-other/', base, 'research/'));
  assert.ok(!match(base + 'stats-old/', base, 'stats/'));
  assert.ok(!match(base + 'qce/', base, ''));
}
if (process.argv.includes('--built')) {
  for (const path of expected) {
    const file = new URL('../dist/' + path + 'index.html', import.meta.url);
    assert.ok(existsSync(file), `Built destination exists: ${path}`);
    const header = readFileSync(file, 'utf8').match(/<header\b[\s\S]*?<\/header>/)[0];
    for (const target of expected) assert.ok(header.includes(`href="/paper4qi/${target}"`));
    assert.equal((header.match(/aria-current="page"/g) || []).length, 1, path);
    assert.ok(header.includes('class="navigation-shell" open'));
    assert.equal((header.match(/class="nav-group(?: is-current)?"/g) || []).length, 3);
  }
}
console.log('PASS: five navigation groups, all 11 preserved destinations, path-boundary matching and optional built-page checks.');

// Live statistics/research rendering keeps static Pages fallback and uses safe DOM.
const liveSource = readFileSync(new URL('../src/scripts/live-library.ts', import.meta.url), 'utf8')
  .replace("import { CATEGORIES } from '../data/meta';", "const CATEGORIES = [{key:'ARCH',zh:'编译',en:'Compilation'},{key:'QEC',zh:'纠错',en:'Error correction'}];")
  .replace("import type { Paper } from './types';", '');
assert(!liveSource.includes('innerHTML'), 'Published titles are never interpreted as markup');
assert(!liveSource.includes('setInterval'), 'No periodic polling is installed');
const callbacks = {};
const textNode = text => ({ textContent: text });
class LiveElement {
  constructor(tag = 'div') { this.tagName = tag; this.dataset = {}; this.children = []; this.style = {}; this.textContent = ''; this.hidden = true; this.attributes = {}; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(key, value) { this.attributes[key] = value; }
  querySelector(selector) { return this.slots?.get(selector) ?? null; }
  querySelectorAll(selector) { return this.groups?.get(selector) ?? []; }
}
const liveRoot = new LiveElement(); liveRoot.dataset = { liveLibrary: 'stats', base: '/paper4qi/' };
const chartSlots = ['[data-live-stacked]', '[data-live-growth]', '[data-live-legend]', '[data-live-top-cited]', '[data-live-status]'];
liveRoot.slots = new Map(chartSlots.map(selector => [selector, new LiveElement()]));
const calls = [];
let liveRevision;
const statsFixture = () => ({ ...(liveRevision === undefined ? {} : { runtime_revision: liveRevision }), generated: '2026-11-12T00:00:00Z',
  years: [2025,2026], cats:['ARCH','QEC'], totals:{qce:1,qce26:0,tqe:2,front:0,all:3},
  matrix:{combined:{2025:{ARCH:1},2026:{QEC:2}}}, growth:[{year:2025,qce:1,tqe:0},{year:2026,qce:0,tqe:2}],
  topCited:[{id:'tqe:10.1234/x',title:'<img onerror=alert(1)> Reviewed title',year:2026,cited_by:3}] });
const liveContext = { exports: {}, URLSearchParams, URL, Headers, AbortSignal, console,
  location: { origin: 'https://fixture.invalid' },
  Date: { now: () => Date.now() + (liveRevision ?? 0) * 2000 },
  window: { addEventListener(name, fn) { callbacks[name] = fn; } },
  document: { visibilityState:'visible', querySelector: selector => selector === '[data-live-library]' ? liveRoot : null,
    querySelectorAll: () => [], createElement: tag => new LiveElement(tag), createElementNS: (_, tag) => new LiveElement(tag), createTextNode: textNode,
    addEventListener(name, fn) { callbacks[name] = fn; } },
  fetch: async url => { calls.push(url); return {ok:true,json:async()=>statsFixture()}; }
};
vm.runInNewContext(ts.transpileModule(inlineApiClient(liveSource), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, liveContext);
const settleLive = async () => { for(let index=0;index<24;index++) await Promise.resolve(); };
await settleLive();
assert.equal(liveRoot.slots.get('[data-live-stacked]').children.length, 0, 'Static Pages response retains SSG charts');
liveRevision = 1; callbacks.pageshow(); await settleLive();
assert.equal(liveRoot.slots.get('[data-live-stacked]').children[0].tagName, 'svg');
assert.equal(liveRoot.slots.get('[data-live-growth]').children[0].tagName, 'svg');
assert.equal(liveRoot.slots.get('[data-live-legend]').children.length, 2);
assert.equal(liveRoot.slots.get('[data-live-top-cited]').children[0].children[0].textContent, statsFixture().topCited[0].title);
assert.ok(liveRoot.slots.get('[data-live-top-cited]').children[0].children[2].href.startsWith('/paper4qi/workspace/#id='));
assert.equal(liveRoot.slots.get('[data-live-status]').hidden, false);
assert(calls.every(path => path === '/paper4qi/data/stats.json'), 'Statistics view fetches no entire corpus');
const paper = {id:'qce26:QSYS-1',title:'Live program title',authors:[],front_matter:false};
const matches = liveContext.exports.topicPaperMatches({matched_papers:[{id:paper.id,matched_terms:['live']},{id:'deleted',matched_terms:['old']}]}, [paper]);
assert.equal(matches.length, 1); assert.equal(matches[0].title, 'Live program title');
assert.equal(liveContext.exports.topicPaperMatches({matched_papers:[{id:paper.id,matched_terms:[]}]}, [{...paper,front_matter:true}]).length,0);
liveRoot.dataset.liveLibrary = 'home';
const totalNode = new LiveElement(); totalNode.dataset.liveTotal = 'all';
liveRoot.groups = new Map([['[data-live-total]', [totalNode]]]);
liveRoot.slots.set('[data-live-category]', new LiveElement());
liveRevision = 2; callbacks.pageshow(); await settleLive();
assert.equal(totalNode.textContent, '3');
assert.equal(liveRoot.slots.get('[data-live-category]').children[0].children.length, 2, 'Home category distribution uses live classification');
liveRoot.dataset.liveLibrary = 'topic'; liveRoot.dataset.liveTopic = 'selected';
liveRoot.slots.set('[data-live-topic-papers]', new LiveElement());
const matchedNode = new LiveElement(); liveContext.document.querySelectorAll = selector => selector === '[data-live-topic-matched]' ? [matchedNode] : [];
const livePaper = {...paper, source:'qce26',year:2026,category:'ARCH',doi:null,arxiv:'2601.00001',title:'<b>Reviewed program</b>'};
let paperRevision = 3;
liveContext.fetch = async path => { calls.push(path); return {ok:true,json:async()=>path.endsWith('/papers.json')
  ? {runtime_revision:paperRevision,papers:[livePaper]}
  : {runtime_revision:liveRevision,counts:{},topics:[{key:'selected',matched_count:1,sources:[],matched_papers:[{id:paper.id,matched_terms:['live']}]},{key:'other',matched_count:0,sources:[],matched_papers:[]}]}}; };
liveRevision = 3; callbacks.pageshow(); await settleLive();
const renderedCard = liveRoot.slots.get('[data-live-topic-papers]').children[0].children[0];
assert.equal(matchedNode.textContent, '1');
assert.equal(renderedCard.children[1].children[0].textContent, livePaper.title);
assert.equal(renderedCard.children[3].children.at(-1).href, 'https://arxiv.org/abs/2601.00001');
paperRevision = 4; liveRevision = 5; callbacks.pageshow(); await settleLive();
assert.equal(liveRoot.slots.get('[data-live-topic-papers]').children[0].children[0], renderedCard, 'Do not join different runtime snapshots');
console.log('PASS: live statistics SVG/legend/Top20, safe titles, Wiki links, static fallback, page-return refresh and current-topic joins.');
