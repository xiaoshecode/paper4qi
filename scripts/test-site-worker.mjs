// Contract checks for the read-only Sites service; uses the standard Node runtime.
// Optionally pass a built dist/server/index.js to smoke-test the actual bundle.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createWorker } from '../sites/worker.mjs';

const papers = [
  { id: 'qce:10.test/decoder', source: 'qce', year: 2025, title: 'Fast FPGA decoder', authors: ['Ada Example'], abstract: 'A real-time control experiment.', zh: '译码与反馈', category: 'QEC', tags: ['hardware'], doi: '10.test/decoder', arxiv: null, front_matter: false },
  { id: 'qce26:QSYS-1', source: 'qce26', year: 2026, title: 'Quantum compilation', authors: ['Ben Example'], abstract: null, zh: '日程条目', category: 'ARCH', tags: ['QSYS'], doi: null, arxiv: '2601.00001', front_matter: false },
  { id: 'tqe:10.test/feedback', source: 'tqe', year: 2024, title: 'Feedback with FPGA systems', authors: ['Cara Example'], abstract: 'Decoder performance.', zh: '控制器', category: 'QEC', tags: [], doi: '10.test/feedback', arxiv: null, front_matter: false },
  { id: 'qce:10.test/front', source: 'qce', year: 2026, title: 'Front matter FPGA', authors: [], abstract: null, zh: '封面', category: 'OTHER', tags: [], doi: '10.test/front', arxiv: null, front_matter: true },
];
const assets = {};
function add(path, body, type = 'application/json') {
  const bytes = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  assets[path] = { type, sha256: createHash('sha256').update(bytes).digest('hex'), body: gzipSync(bytes).toString('base64') };
}
add('/index.html', '<!doctype html><title>paper4qi</title>', 'text/html');
add('/agents/index.html', '<!doctype html><title>Agent guide</title>', 'text/html');
add('/data/papers.json', { papers });
add('/data/manifest.json', { schema_version: '1.0.0', counts: { records: 4 } });
add('/data/quality.json', { overall: { records: 4 } });
add('/data/stats.json', { totals: { all: 3 } });
add('/data/research-map.json', { generated:'2026-10-28T00:00:00Z', counts:{topics:1}, domains:[{key:'test',topics:['fpga-control']}], method:{matching:'keyword leads'}, limitations:['Not manually reviewed'], topics:[{key:'fpga-control',title_zh:'FPGA 测控',title_en:'FPGA control',sources:[{title:'Test original',url:'https://example.org/'}],matched_papers:[{id:papers[0].id,score:3,matched_terms:['FPGA']}]}] });
add('/data/guides.json', { generated: '2026-10-28T00:00:00Z', limitations: ['Verify original sources.'], guides: { cs4q: { entries: [{ id: 'P01', title: 'A control paper' }] }, venues: { journals: [{ name: 'Test journal' }], conferences: [], conference_deadlines: [] } } });
add('/data/id-redirects.json', { schema_version: '1.0.0', redirects: [{ old_id: 'qce26:RETIRED-1', new_id: 'qce:10.test/decoder' }] });
add('/guides/openqasm.md', '# OpenQASM\nDated editorial guide.', 'text/markdown');
add('/guides/agents.md', '# Agent access\nCite primary sources.', 'text/markdown');
const worker = createWorker(assets);
async function rpc(service, method, params = {}) {
  const response = await service.fetch(new Request('https://library.example/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }));
  assert.equal(response.status, 200);
  return response.json();
}
async function tool(service, name, args = {}, expectError = false) {
  const response = await rpc(service, 'tools/call', { name, arguments: args });
  assert.equal(response.result.isError, expectError, JSON.stringify(response));
  return expectError ? response.result.content[0].text : JSON.parse(response.result.content[0].text);
}

assert.deepEqual((await rpc(worker, 'server/discover')).result.supportedVersions, ['2026-07-28']);
assert.equal((await rpc(worker, 'initialize', { protocolVersion: '2025-06-18' })).result.protocolVersion, '2025-06-18');
const tools = (await rpc(worker, 'tools/list')).result.tools;
assert.equal(tools.length, 6);
assert(tools.every(item => item.annotations.readOnlyHint && item.inputSchema.additionalProperties === false));
assert.equal((await rpc(worker, 'not-a-method')).error.code, -32601);

const all = await tool(worker, 'search_papers');
assert.equal(all.total, 3, 'Front matter must be excluded by default');
assert.deepEqual(all.results.map(p => p.year), [2026, 2025, 2024]);
assert.equal(all.next_offset, null);
assert.equal((await tool(worker, 'search_papers', { include_front_matter: true })).total, 4);
assert.equal((await tool(worker, 'search_papers', { query: 'ＦＰＧＡ decoder' })).total, 2, 'Normalize text and apply AND across searchable fields');
assert.equal((await tool(worker, 'search_papers', { query: 'Ada 译码' })).total, 1);
assert.equal((await tool(worker, 'search_papers', { source: 'qce26', year: 2026, category: 'ARCH' })).total, 1);
assert.equal((await tool(worker, 'search_papers', { query: 'missing' })).total, 0);
assert.equal((await tool(worker, 'search_papers', { subtopic: 'fpga-control' })).total, 1);
assert.equal((await tool(worker, 'search_papers', { subtopic: 'fpga-control', source: 'tqe' })).total, 0);
assert.equal((await tool(worker, 'get_research_map')).counts.topics, 1);
assert.equal((await tool(worker, 'get_research_map', {topic:'fpga-control'})).topic.matched_papers[0].id, papers[0].id);
await tool(worker, 'get_research_map', {topic:'missing'}, true);
await tool(worker, 'search_papers', {subtopic:'missing'}, true);
const first = await tool(worker, 'search_papers', { limit: 1 });
const second = await tool(worker, 'search_papers', { limit: 1, offset: first.next_offset });
assert.notEqual(first.results[0].id, second.results[0].id);
assert.equal(second.next_offset, 2);
assert.equal((await tool(worker, 'search_papers', { offset: 100 })).next_offset, null);
for (const args of [{ limit: 0 }, { limit: 51 }, { year: 2026.5 }, { offset: -1 }, { include_front_matter: 'yes' }, { source: 'other' }, { query: 'x'.repeat(301) }, { unexpected: true }, { category: 'UNKNOWN' }]) {
  await tool(worker, 'search_papers', args, true);
}
await tool(worker, 'get_paper', {}, true);
await tool(worker, 'get_paper', { id: 'missing' }, true);
await tool(worker, 'unknown', {}, true);
const detail = await tool(worker, 'get_paper', { id: papers[0].id });
assert.deepEqual(detail.paper, papers[0]);
assert.equal(detail.links.doi, 'https://doi.org/10.test/decoder');
assert.equal(detail.record_kind, 'proceedings_metadata');
const retired = await tool(worker, 'get_paper', { id: 'qce26:RETIRED-1' });
assert.equal(retired.requested_id, 'qce26:RETIRED-1');
assert.equal(retired.paper.id, 'qce:10.test/decoder');
const program = await tool(worker, 'get_paper', { id: 'qce26:QSYS-1' });
assert.equal(program.record_kind, 'program_entry');
assert.equal(program.links.arxiv, 'https://arxiv.org/abs/2601.00001');
assert.equal((await tool(worker, 'get_library_overview')).manifest.counts.records, 4);
assert.equal((await tool(worker, 'get_research_statistics')).statistics.totals.all, 3);
assert.match((await tool(worker, 'read_research_guide', { guide: 'openqasm' })).text, /OpenQASM/);
assert.match((await tool(worker, 'read_research_guide', { guide: 'agents' })).text, /primary sources/);
const cs4q = await tool(worker, 'read_research_guide', { guide: 'cs4q' });
assert.equal(cs4q.data.entries[0].id, 'P01');
assert.deepEqual(cs4q.limitations, ['Verify original sources.']);
assert.equal(cs4q.generated, '2026-10-28T00:00:00Z');
assert.equal((await tool(worker, 'read_research_guide', { guide: 'venues' })).data.journals[0].name, 'Test journal');
await tool(worker, 'read_research_guide', { guide: '../secrets' }, true);

const page = await worker.fetch(new Request('https://library.example/'));
assert.equal(page.status, 200);
assert.equal(await page.text(), '<!doctype html><title>paper4qi</title>');
const cached = await worker.fetch(new Request('https://library.example/', { headers: { 'If-None-Match': page.headers.get('ETag') } }));
assert.equal(cached.status, 304);
assert.equal(await cached.text(), '');
assert.equal(await (await worker.fetch(new Request('https://library.example/', { method: 'HEAD' }))).text(), '');
assert.equal((await worker.fetch(new Request('https://library.example/missing'))).status, 404);
assert.equal((await worker.fetch(new Request('https://library.example/', { method: 'POST' }))).status, 405);
assert.equal((await worker.fetch(new Request('https://library.example/mcp'))).status, 405);
const canonical = await worker.fetch(new Request('https://library.example/agents?q=fpga'));
assert.equal(canonical.headers.get('Location'), 'https://library.example/agents/?q=fpga');
const legacy = await worker.fetch(new Request('https://library.example/paper4qi/agents/?q=fpga'));
assert.equal(legacy.headers.get('Location'), 'https://library.example/agents/?q=fpga');
const encoded = await worker.fetch(new Request('https://library.example/paper4qi/%2Fevil.example'));
assert.equal(new URL(encoded.headers.get('Location')).origin, 'https://library.example');
const malformed = await worker.fetch(new Request('https://library.example/mcp', { method: 'POST', body: '{' }));
assert.equal(malformed.status, 400);
assert.equal((await malformed.json()).error.code, -32700);
const notification = await worker.fetch(new Request('https://library.example/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) }));
assert.equal(notification.status, 202);
assert.equal((await worker.fetch(new Request('https://library.example/mcp', { method: 'POST', body: 'x'.repeat(65537) }))).status, 413);
console.log('Sites Worker contract: discovery, 6 tools, subtopics, filters, pagination, ID redirects, invalid input, assets and redirects passed.');

if (process.argv[2]) {
  const { default: built } = await import(pathToFileURL(resolve(process.argv[2])).href);
  assert(built && typeof built.fetch === 'function');
  const overview = await tool(built, 'get_library_overview');
  const result = await tool(built, 'search_papers', { limit: 1 });
  assert(result.total > 0);
  assert.equal(result.total, overview.manifest.counts.research_records);
  assert.equal((await tool(built, 'get_paper', { id: result.results[0].id })).paper.id, result.results[0].id);
  const map = await tool(built, 'get_research_map');
  assert(map.topics.length > 0);
  const topic = (await tool(built, 'get_research_map', {topic:map.topics[0].key})).topic;
  assert.equal((await tool(built, 'search_papers', {subtopic:topic.key})).total, topic.matched_count);
  for (const guide of ['openqasm', 'agents']) assert((await tool(built, 'read_research_guide', { guide })).text.length > 100);
  assert((await tool(built, 'read_research_guide', { guide: 'cs4q' })).data.entries.length > 0);
  assert((await tool(built, 'read_research_guide', { guide: 'venues' })).data.journals.length > 0);
  for (const path of ['/', '/agents/', '/qce/', '/tqe/', '/stats/', '/about/', '/openqasm/', '/llms.txt', '/data/papers.json', '/data/guides.json']) {
    const response = await built.fetch(new Request('https://library.example' + path));
    assert.equal(response.status, 200, path);
  }
  console.log(`Built Sites Worker smoke test passed: ${result.total} research records, ${overview.manifest.counts.records} total records.`);
}
