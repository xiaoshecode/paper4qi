// Offline chat UI/stream protocol regressions using the project's TypeScript.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { inlineApiClient } from './lib_api_client_test.mjs';
const require = createRequire(import.meta.url);
const ts = createRequire(require.resolve('astro/package.json'))('typescript');
const source = readFileSync(new URL('../src/scripts/research-chat.ts', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../src/pages/workspace/index.astro', import.meta.url), 'utf8');
for (const match of source.matchAll(/\bel(?:<[^>]+>)?\('([^']+)'\)/g)) assert(markup.includes(`id="rc-${match[1]}"`), `rc-${match[1]} is present`);
assert(!source.includes('innerHTML'));
assert(!source.includes('localStorage'));
assert(!source.includes('DEEPSEEK_API_KEY'));
assert(!source.includes('safety_check'));
assert(markup.includes('maxlength="6000"'));
const compiled = ts.transpileModule(inlineApiClient(source), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const empty = { exports: {}, document: { querySelector: () => null }, URL, TextDecoder, TextEncoder, ReadableStream };
vm.runInNewContext(compiled, empty);
const { readChatEvents, citationSegments } = empty.exports;
const encode = new TextEncoder();
const frame = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
function byteStream(raw, step = 1) {
  const bytes = encode.encode(raw); let cursor = 0;
  return new ReadableStream({ pull(controller) { if (cursor >= bytes.length) return controller.close(); controller.enqueue(bytes.slice(cursor, cursor += step)); } });
}
const events = [];
const raw = ': heartbeat\r\n\r\n' + (frame('text', { delta: '🙂量子回答' }) + frame('reset', { reason: 'content_filter', content: '拒答' }) + frame('complete', { status: 'refused' })).replaceAll('\n', '\r\n');
await readChatEvents(byteStream(raw), (event, data) => events.push({ event, data }));
assert.deepEqual(JSON.parse(JSON.stringify(events)), [{ event: 'text', data: { delta: '🙂量子回答' } }, { event: 'reset', data: { reason: 'content_filter', content: '拒答' } }, { event: 'complete', data: { status: 'refused' } }]);
const multi = [];
await readChatEvents(byteStream('event: text\ndata: {"delta":\ndata: "多行数据"}\n\n', 3), (event, data) => multi.push({ event, data }));
assert.equal(multi[0].data.delta, '多行数据');
await assert.rejects(readChatEvents(byteStream('event: text\ndata: {"delta":"未完成"}'), () => {}), /提前结束/);
const cited = citationSegments('🙂量子实验', [{ url: 'https://example.org/paper', title: '<b>Plain title</b>', start_index: 1, end_index: 3 }, { url: 'javascript:alert(1)', title: 'Invalid' }]);
assert.equal(cited.segments[0].text, '🙂量子');
assert.equal(cited.segments[1].text, '实验');
assert.equal(cited.sources.length, 1);
assert.equal(cited.sources[0].title, '<b>Plain title</b>');
console.log('PASS: chat SSE UTF-8/CRLF/multiline/truncated parsing, Unicode citation offsets, safe links, template IDs and no browser credential storage.');

class Element {
  constructor(tag = 'div') { this.tagName = tag; this.value = ''; this.checked = false; this.hidden = false; this.disabled = false; this.dataset = {}; this.children = []; this.listeners = {}; this.textContent = ''; this.attributes = {}; this.classList = { toggle() {} }; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, callback) { (this.listeners[name] ??= []).push(callback); }
  emit(name, event = { preventDefault() {} }) { for (const callback of this.listeners[name] ?? []) callback(event); }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.focused = true; }
}
function makeHarness({ writer = false, configured = true, online = true } = {}) {
  const ids = new Map(); const el = id => { if (!ids.has(id)) ids.set(id, new Element()); return ids.get(id); };
  const root = new Element(); root.dataset.base = '/paper4qi/';
  const window = new Element();
  const chatId = '00000000-0000-4000-8000-000000000001';
  let chat = { id: chatId, title: '公开研究会话', revision: 0, updated_at: '2026-11-13T00:00:00Z', paper_context: null };
  let messages = [], pending = null, responseMode = 'complete', chats = [chat], calls = [], controllerAbort;
  const assistant = (id, content, status = 'complete') => ({ id: `${id}:assistant`, role: 'assistant', content, reasoning: '合成思考', annotations: [{ url: 'https://example.org/paper', title: '引用来源', start_index: 0, end_index: 1 }], tool_events: [], status, created_at: '2026-11-13T00:00:00Z' });
  const asJSON = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const fetch = async (url, options = {}) => {
    assert.equal(options.credentials, 'same-origin');
    assert.equal(new Headers(options.headers).get('Authorization'), null);
    const path = url.split('/api/')[1];
    if (path === 'status') return asJSON({ mode: online ? 'online' : 'local', ready: true, can_edit: writer, deepseek_configured: configured });
    if (path.startsWith('chats?')) return asJSON({ chats, total: chats.length, next_offset: null });
    if (path.startsWith('chat?id=')) return asJSON({ chat, messages, pending });
    const input = JSON.parse(options.body || '{}'); calls.push({ path, input });
    if (!writer) return asJSON({ error: 'Forbidden' }, 403);
    if (path === 'chats') { chat = { ...chat, paper_id: input.paper_id, paper_context: input.paper_id ? { id: input.paper_id, title: '选定论文' } : null }; chats = [chat]; return asJSON({ chat, messages, pending }, 201); }
    if (path === 'chat') {
      const existing = messages.find(message => message.id === input.request_id + ':assistant');
      if (existing) return asJSON({ idempotent: true, request: { request_id: input.request_id, status: existing.status }, message: existing, chat_id: chatId });
      pending = { request_id: input.request_id, status: 'pending' }; chat = { ...chat, revision: chat.revision + 1 };
      const user = { id: input.request_id + ':user', role: 'user', content: input.content, status: 'pending' };
      messages = [...messages, user];
      if (responseMode === 'abort') {
        const body = new ReadableStream({ start(controller) {
          controller.enqueue(encode.encode(frame('meta', { request_id: input.request_id, revision: chat.revision }) + frame('text', { delta: '接收中的部分回答' })));
          controllerAbort = () => { const message = assistant(input.request_id, '接收中的部分回答', 'cancelled'); messages = messages.map(value => value.id === user.id ? { ...value, status: 'cancelled' } : value).concat(message); pending = null; chat = { ...chat, revision: chat.revision + 1 }; controller.error(new Error('aborted')); };
          options.signal.addEventListener('abort', controllerAbort, { once: true });
        } });
        return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
      }
      const status = responseMode === 'reset' ? 'refused' : responseMode === 'failed' ? 'failed' : 'complete';
      const message = assistant(input.request_id, status === 'refused' ? '本地拒答文案' : status === 'failed' ? '未完成内容' : '<img onerror=alert(1)>🙂量子回答', status);
      if (status === 'refused') { message.reasoning = ''; message.annotations = []; }
      messages = messages.map(value => value.id === user.id ? { ...value, status } : value).concat(message); pending = null; chat = { ...chat, revision: chat.revision + 1 };
      let response = frame('meta', { revision: chat.revision - 1 }) + frame('reasoning', { delta: '合成思考' }) + frame('text', { delta: '先流出的回答' });
      if (status === 'refused') response += frame('reset', { reason: 'content_filter', content: '本地拒答文案' });
      response += frame(status === 'failed' ? 'error' : 'complete', status === 'failed' ? { status, message: '请核对最新结果' } : { revision: chat.revision, status, message });
      return new Response(byteStream(response, 3), { headers: { 'Content-Type': 'text/event-stream' } });
    }
    throw new Error('Unexpected endpoint: ' + path);
  };
  const context = { exports: {}, document: { querySelector: () => root, getElementById: id => el(id.replace(/^rc-/, '')), createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }) },
    window, location: { origin: 'https://fixture.invalid', pathname: '/paper4qi/workspace/', search: '', hash: '' }, fetch, Headers, TextDecoder, TextEncoder, ReadableStream, AbortController, AbortSignal, URL, crypto,
    console };
  vm.runInNewContext(compiled, context);
  return { el, window, calls, messages: () => messages, setMode(value) { responseMode = value; }, setMessages(value) { messages = value; }, emitMode(value) { writer = value.can_edit; window.emit('p4q:workspace-mode', { detail: value }); } };
}
const settle = async () => { for (let i = 0; i < 240; i++) await new Promise(resolve => setImmediate(resolve)); };
const combinedText = element => String(element.textContent || '') + (element.children || []).map(combinedText).join('');
const anonymous = makeHarness(); await settle();
assert.equal(anonymous.el('send').disabled, true); assert.equal(anonymous.el('login').hidden, false);
assert.equal(anonymous.el('thinking').checked, false); assert.equal(anonymous.el('web-search').checked, false);
anonymous.el('input').value = '匿名不能发送'; anonymous.el('composer').emit('submit'); await settle();
assert.equal(anonymous.calls.length, 0);
const writer = makeHarness({ writer: true }); await settle();
assert.equal(writer.el('send').disabled, false);
writer.window.emit('p4q:paperselected', { detail: { id: 'qce:fixture', title: '选定论文' } });
assert(writer.el('paper-chip').textContent.includes('选定论文'));
writer.el('context').checked = true; writer.el('new').emit('click'); await settle();
assert.equal(writer.calls.at(-1).input.paper_id, 'qce:fixture');
writer.el('input').value = '请解释这篇研究'; writer.el('composer').emit('submit'); await settle();
assert(writer.calls.some(call => call.path === 'chat' && call.input.content === '请解释这篇研究'));
assert(combinedText(writer.el('messages')).replaceAll('[1]', '').includes('<img onerror=alert(1)>🙂量子回答'));
assert.equal(writer.el('messages').children.filter(element => element.className?.includes('rc-assistant')).length, 1, 'A completed streamed message is displayed once');
assert.equal(writer.el('input').value, ''); assert.equal(writer.el('send').disabled, false);
writer.setMode('reset'); writer.el('input').value = '模拟固有拒答'; writer.el('composer').emit('submit'); await settle();
assert(writer.messages().at(-1).content.includes('本地拒答')); assert.equal(writer.messages().at(-1).reasoning, '');
writer.setMode('failed'); writer.el('input').value = '模拟流式失败'; writer.el('composer').emit('submit'); await settle();
const failedCall = writer.calls.filter(call => call.path === 'chat').at(-1); const countBeforeRetry = writer.calls.filter(call => call.path === 'chat').length;
assert.equal(writer.el('retry').hidden, false); assert.equal(writer.el('input').disabled, true);
writer.el('retry').emit('click'); await settle();
assert.equal(writer.calls.filter(call => call.path === 'chat').length, countBeforeRetry, 'A confirmed failed request is not automatically regenerated');
writer.el('next-turn').emit('click'); await settle(); assert.equal(writer.el('input').disabled, false);
writer.setMode('abort'); writer.el('input').value = '模拟停止接收'; writer.el('composer').emit('submit'); await settle();
assert.equal(writer.el('stop').hidden, false);
writer.el('stop').emit('click'); await settle();
assert.equal(writer.el('retry').hidden, false); assert.equal(writer.messages().at(-1).status, 'cancelled');
const cancelledId = writer.calls.filter(call => call.path === 'chat').at(-1).input.request_id;
writer.el('retry').emit('click'); await settle();
assert.equal(writer.calls.filter(call => call.path === 'chat').at(-1).input.request_id, cancelledId);
assert.notEqual(cancelledId, failedCall.input.request_id);
console.log('PASS: public/authorized chat UI, paper context, safe streamed answer display, refusal reset, failed/cancelled recovery, and no duplicate paid regeneration.');
