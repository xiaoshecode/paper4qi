// Real SQLite/D1 transactions and synthetic provider SSE; no network or API key.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createWorkspaceApi } from '../sites/workspace-api.mjs';

class D1 {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    for (const file of ['0000_workspace.sql', '0001_research_chat.sql']) this.db.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
  }
  prepare(query) {
    const db = this.db; let args = [];
    const statement = {
      bind(...values) { args = values; return statement; },
      async first() { return db.prepare(query).get(...args) ?? null; },
      async all() { return { results: db.prepare(query).all(...args), success: true }; },
      async run() { return { meta: { changes: db.prepare(query).run(...args).changes }, success: true }; },
      execute() {
        const prepared = db.prepare(query);
        return /^\s*(SELECT|WITH|PRAGMA)\b/i.test(query) ? { results: prepared.all(...args), success: true }
          : { results: [], meta: { changes: prepared.run(...args).changes }, success: true };
      }
    };
    return statement;
  }
  async batch(statements) {
    this.db.exec('BEGIN');
    try { const results = statements.map(statement => statement.execute()); this.db.exec('COMMIT'); return results; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close() { this.db.close(); }
}
const origin = 'https://library.example';
const paper = { id: 'qce:10.1234/chat', source: 'qce', source_id: '10.1234/chat', doi: '10.1234/chat', year: 2026, title: 'Quantum research context', authors: ['Synthetic Author'], abstract: 'An abstract to discuss.', zh: '已审核的中文笔记', category: 'ARCH', tags: [], front_matter: false };
const readAsset = async path => path === '/data/papers.json' ? { papers: [paper], generated: '2026-11-13T00:00:00Z' }
  : path === '/data/workspace.json' ? { papers: [], articles: {}, analyses: {}, venues: [{ id: 'test', name: 'Quantum', kind: 'journal', issn: '2521-327X', enabled: true, keywords: [] }] }
    : path === '/data/id-redirects.json' ? { redirects: [] } : null;
const encode = new TextEncoder();
const event = data => 'data: ' + (typeof data === 'string' ? data : JSON.stringify(data)) + '\n\n';
const chunk = (delta, finish_reason = null, extra = {}) => ({ choices: [{ index: 0, delta, finish_reason, ...extra }] });
const finalTools = [{ index: 0, reasoning_content: '先查来源', calls: [{ index: 0, id: 'srvtoolu-synthetic', type: 'deepseek_read_url', kind: 'read_link', action: { type: 'read_link', url: 'https://example.org/paper' }, status: 'completed', page: { url: 'https://example.org/paper', title: 'Synthetic source', published_at: null }, signature: 'synthetic-encrypted-signature' }] }];
const annotations = [{ type: 'url_citation', url_citation: { url: 'https://example.org/paper', title: 'Synthetic source', start_index: 1, end_index: 3 } }];
const toolStart = { type: 'call_started', step: 0, call: { id: 'srvtoolu-synthetic', type: 'deepseek_read_url', kind: 'read_link', action: { type: 'read_link', url: 'https://example.org/paper' } } };
const toolComplete = { type: 'call_completed', step: 0, call: { ...toolStart.call, status: 'completed', page: { url: 'https://example.org/paper', title: 'Synthetic source' } } };
const happy = () => ': provider heartbeat\n\n' + event(chunk({ reasoning_content: '先查来源' }))
  + event(chunk({}, null, { server_tool_event: { type: 'step_reasoning_done', step: 0 } }))
  + event(chunk({}, null, { server_tool_event: toolStart })) + event(chunk({}, null, { server_tool_event: toolComplete }))
  + event(chunk({ reasoning_content: '资料足够' })) + event(chunk({ content: '🙂量子研究回答' }))
  + event(chunk({ server_tool_calls: finalTools, annotations, title: '量子论文讨论' }, 'stop')) + event('[DONE]');
function streamed(raw, split = 7) {
  const bytes = encode.encode(raw); let cursor = 0;
  return new Response(new ReadableStream({ pull(controller) {
    if (cursor >= bytes.length) return controller.close();
    controller.enqueue(bytes.slice(cursor, cursor += split));
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
}
const TERMINALS = ['complete', 'truncated', 'refused', 'failed', 'cancelled'];
const db = new D1();
const env = { DB: db, DEEPSEEK_API_KEY: 'synthetic-secret-never-public', DEEPSEEK_MODEL: 'deepseek-flash', PAPER4QI_EDITOR_IDS: 'editor-a,editor-b', PAPER4QI_MAX_AI_REQUESTS: '100' };
let instant = new Date('2026-11-13T01:00:00Z');
let mode = 'happy', calls = 0, providerPayloads = [], beforeProvider;
const longSignature = 'opaque-provider-signature-'.repeat(600);
const fetchImpl = async (url, options) => {
  assert.equal(url, 'https://api.deepseek.com/chat/completions');
  assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, 'Bearer ' + env.DEEPSEEK_API_KEY);
  const body = JSON.parse(options.body);
  assert.equal(body.stream, true); assert.equal(body.model, 'deepseek-flash');
  assert(!('safety_check' in body), 'Enhanced model safety is disabled at the user’s request');
  assert(body.max_tokens > 0 && body.max_tokens <= 2400);
  providerPayloads.push(body); calls++;
  if (beforeProvider) await beforeProvider();
  if (mode === 'http-error') return new Response(env.DEEPSEEK_API_KEY, { status: 500 });
  if (mode === 'error-chunk') return streamed(event(chunk({ content: '回答的一部分' })) + event({ choices: [], error: { message: env.DEEPSEEK_API_KEY } }));
  if (mode === 'no-done') return streamed(event(chunk({ content: '部分' }, 'stop')));
  if (mode === 'no-finish') return streamed(event(chunk({ content: '部分' })) + event('[DONE]'));
  if (mode === 'truncated') return streamed(event(chunk({ content: '达到长度限制的回答' }, 'length')) + event('[DONE]'));
  if (mode === 'refused') return streamed(event(chunk({ reasoning_content: '不应留存的推理', content: '不应留存的正文' })) + event(chunk({ server_tool_calls: finalTools, annotations }, 'content_filter')) + event('[DONE]'));
  if (mode === 'crlf') return streamed(happy().replaceAll('\n', '\r\n'), 1);
  if (mode === 'cancel') return new Response(new ReadableStream({ start(controller) {
    controller.enqueue(encode.encode(event(chunk({ content: '停止前的一部分' }))));
    options.signal.addEventListener('abort', () => controller.error(new Error('Synthetic aborted stream')), { once: true });
  }, cancel() {} }), { headers: { 'Content-Type': 'text/event-stream' } });
  if (mode === 'secret-chunks') return streamed(event(chunk({ content: env.DEEPSEEK_API_KEY.slice(0, 10) })) + event(chunk({ content: env.DEEPSEEK_API_KEY.slice(10) }, 'stop')) + event('[DONE]'));
  if (mode === 'context-bound') {
    const preservedTools = structuredClone(finalTools);
    preservedTools[0].calls[0].signature = longSignature;
    return streamed(event(chunk({ content: '量子研究'.repeat(7500) }))
      + event(chunk({ server_tool_calls: preservedTools }, 'stop')) + event('[DONE]'), 4096);
  }
  return streamed(happy());
};
const api = createWorkspaceApi({ readAsset, fetchImpl, now: () => new Date(instant) });
let waits = [];
const ctx = { waitUntil(promise) { waits.push(promise); } };
async function http(path, method = 'GET', body, { actor = method === 'GET' ? null : 'editor-a', headers = {}, targetEnv = env } = {}) {
  return api.fetch(new Request(origin + '/api/' + path, { method,
    headers: { ...(actor ? { 'oai-authenticated-user-id': actor } : {}), ...(method === 'GET' ? {} : { Origin: origin, 'Content-Type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), targetEnv, ctx);
}
async function settle() { const jobs = waits; waits = []; await Promise.all(jobs); }
async function json(response, status = 200) { assert.equal(response.status, status, (await response.clone().text()).slice(0, 1200)); return response.json(); }
async function newChat(paper_id) { return (await json(await http('chats', 'POST', paper_id ? { paper_id } : {}), 201)).chat; }
async function getChat(id) { return json(await http('chat?id=' + id)); }
function submission(chat, content = '请解释这项量子研究', request_id = crypto.randomUUID()) {
  return { chat_id: chat.id, expected_revision: chat.revision, request_id, content, thinking: true, web_search: true, read_url: true };
}
function parseEvents(raw) {
  return raw.split(/\r?\n\r?\n/).filter(Boolean).map(frame => {
    const name = frame.match(/^event: ([^\n]+)/m)?.[1];
    const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
    return { event: name, data: data ? JSON.parse(data) : null };
  });
}
async function send(value, expectedStatus = 'complete') {
  const result = await http('chat', 'POST', value);
  assert.equal(result.status, 200, (await result.clone().text()).slice(0, 1200));
  assert.match(result.headers.get('Content-Type'), /text\/event-stream/);
  const raw = await result.text(); await settle();
  const events = parseEvents(raw);
  const end = events.findLast(event => ['complete', 'error'].includes(event.event));
  assert.equal(end?.data.status, expectedStatus, `Unexpected stream status ${end?.data.status ?? 'missing'}; events=${events.map(item => item.event).join(',')}; preview=${raw.slice(0, 1200)}`);
  assert(!raw.includes(env.DEEPSEEK_API_KEY));
  return events;
}

try {
  assert.equal((await http('chats', 'POST', {}, { actor: null })).status, 403);
  assert.equal((await http('chats', 'POST', {}, { actor: 'visitor' })).status, 403);
  assert.equal((await http('chats', 'POST', {}, { headers: { Origin: 'https://other.example' } })).status, 403);
  assert.equal((await http('chats', 'POST', { key: 'not-allowed' })).status, 400);
  assert.equal((await http('chats', 'POST', { title: '' })).status, 400);
  assert.equal((await http('chats?limit=51')).status, 400);
  const chat = await newChat(paper.id);
  assert.equal(chat.revision, 0); assert.equal(chat.paper_context.title, paper.title);
  const first = submission(chat);
  const events = await send(first);
  assert(events.some(item => item.event === 'reasoning')); assert(events.some(item => item.event === 'tool'));
  assert(events.some(item => item.event === 'citations')); assert(events.some(item => item.event === 'title'));
  assert.equal(events.filter(item => item.event === 'text').map(item => item.data.delta).join(''), '🙂量子研究回答');
  const complete = events.find(item => item.event === 'complete').data;
  assert.equal(complete.revision, 2); assert.equal(complete.message.content, '🙂量子研究回答');
  let stored = await getChat(chat.id);
  assert.equal(stored.chat.title, '量子论文讨论'); assert.equal(stored.messages.length, 2); assert.equal(stored.pending, null);
  assert(!JSON.stringify(stored).includes('signature')); assert(!JSON.stringify(stored).includes('editor-a'));
  assert.equal(stored.messages[0].role, 'user'); assert.equal(stored.messages[1].role, 'assistant');
  assert.equal(stored.messages[1].annotations[0].start_index, 1);
  assert(providerPayloads[0].messages[0].content.includes(paper.title));
  assert.deepEqual(providerPayloads[0].tools.map(item => item.type), ['deepseek_web_search', 'deepseek_read_url']);
  assert.equal(providerPayloads[0].title.enabled, true);
  const beforeReplay = calls;
  const replay = await json(await http('chat', 'POST', first));
  assert.equal(replay.idempotent, true); assert.equal(replay.request.status, 'complete'); assert.equal(calls, beforeReplay);
  assert.equal((await http('chat', 'POST', { ...first, content: 'different content' })).status, 409);
  assert.equal((await http('chat', 'POST', { ...first, request_id: crypto.randomUUID() })).status, 409);
  const second = submission(stored.chat, '继续解释它的评价指标');
  await send(second);
  assert.equal(providerPayloads[1].messages[2].role, 'assistant');
  assert.deepEqual(providerPayloads[1].messages[2].server_tool_calls, finalTools, 'Exact provider signatures are replayed from D1');
  assert.equal(providerPayloads[1].messages[2].reasoning_content, '资料足够', 'Only final-step reasoning is replayed as message reasoning');
  assert(!('title' in providerPayloads[1]));
  stored = await getChat(chat.id);
  assert.deepEqual(stored.messages.map(message => message.role), ['user', 'assistant', 'user', 'assistant'], 'Message order follows turn revision even with identical timestamps');
  const third = submission(stored.chat, '第三轮'); await send(third);
  assert.deepEqual(providerPayloads[2].messages.slice(1).map(message => message.role), ['user', 'assistant', 'user', 'assistant', 'user']);
  assert.equal((await http('chat', 'POST', { ...third, request_id: crypto.randomUUID(), expected_revision: 6, content: 'x'.repeat(6001) })).status, 400);
  instant = new Date(instant.getTime() + 61000);
  mode = 'crlf'; await send(submission(await newChat()));
  mode = 'truncated'; await send(submission(await newChat()), 'truncated');
  mode = 'refused';
  const refusedChat = await newChat(); const refusedEvents = await send(submission(refusedChat), 'refused');
  assert(refusedEvents.some(item => item.event === 'reset'));
  const refused = (await getChat(refusedChat.id)).messages[1];
  assert(!refused.content.includes('不应留存')); assert.equal(refused.reasoning, ''); assert.deepEqual(refused.annotations, []);
  const refusedProtocol = JSON.parse(db.db.prepare("SELECT protocol_json FROM research_chat_messages WHERE chat_id=? AND role='assistant'").get(refusedChat.id).protocol_json);
  assert.equal(refusedProtocol.content, '');
  assert.equal(refusedProtocol.server_tool_calls[0].calls[0].signature, finalTools[0].calls[0].signature);
  assert.equal(refusedProtocol.server_tool_calls[0].reasoning_content, '');
  instant = new Date(instant.getTime() + 61000);
  for (const providerMode of ['error-chunk', 'no-done', 'no-finish', 'http-error']) {
    mode = providerMode;
    const failedChat = await newChat(); const request = submission(failedChat);
    await send(request, 'failed');
    const outcome = await json(await http('chat-status?request_id=' + request.request_id));
    assert.equal(outcome.request.status, 'failed');
    const previousCalls = calls; await json(await http('chat', 'POST', request)); assert.equal(calls, previousCalls);
  }
  assert.equal((await json(await http('chats?limit=2'))).chats.length, 2);
  assert((await json(await http('chats?limit=2'))).next_offset > 0);
  const quotaChat = await newChat();
  const quotaRequest = submission(quotaChat);
  assert.equal((await http('chat', 'POST', quotaRequest, { targetEnv: { ...env, PAPER4QI_MAX_AI_REQUESTS: '0' } })).status, 429);
  assert.equal((await getChat(quotaChat.id)).pending, null);
  assert.equal((await json(await http('chats', 'GET', undefined, { targetEnv: {} }))).ready, false);
  assert.equal((await http('chat', 'POST', submission(await newChat()), { targetEnv: { ...env, DEEPSEEK_API_KEY: '' } })).status, 503);
  console.log('PASS: public multi-device conversations, identity, streaming UTF-8/CRLF, citations/tools, exact history replay, request idempotence, refusal reset, truncated/failed states and shared AI limits; safety_check omitted.');
  instant = new Date(instant.getTime() + 61000);
  mode = 'secret-chunks';
  const secretChat = await newChat(); await send(submission(secretChat), 'failed');
  assert(!JSON.stringify(await getChat(secretChat.id)).includes(env.DEEPSEEK_API_KEY));

  // Pause an empty request-id lookup while another device completes that ID.
  const racingChat = await newChat(); const racingRequest = submission(racingChat);
  const oldPrepare = db.prepare.bind(db);
  let pauseRead = true, reachedRead, releaseRead;
  const reached = new Promise(resolve => { reachedRead = resolve; });
  const release = new Promise(resolve => { releaseRead = resolve; });
  db.prepare = query => {
    const statement = oldPrepare(query);
    if (query === 'SELECT * FROM research_chat_requests WHERE id = ?') {
      const first = statement.first.bind(statement);
      statement.first = async () => { const value = await first(); if (pauseRead && value == null) { pauseRead = false; reachedRead(); await release; } return value; };
    }
    return statement;
  };
  mode = 'happy';
  const beforeRace = calls;
  try {
    const pendingReplay = http('chat', 'POST', racingRequest);
    await reached;
    await send(racingRequest);
    releaseRead();
    const completedReplay = await json(await pendingReplay);
    assert.equal(completedReplay.idempotent, true); assert.equal(completedReplay.request.status, 'complete');
    assert.equal(calls - beforeRace, 1, 'An overlapping duplicate does not make a second paid request');
  } finally { releaseRead(); db.prepare = oldPrepare; }

  // Different requests at the same revision compete atomically across devices.
  const casChat = await newChat(); const revision = casChat.revision;
  const contenders = await Promise.all(['editor-a', 'editor-b'].map(actor => http('chat', 'POST', { ...submission(casChat), expected_revision: revision }, { actor })));
  assert.deepEqual(contenders.map(result => result.status).sort(), [200, 409]);
  await Promise.all(contenders.map(result => result.text())); await settle();
  assert.equal((await getChat(casChat.id)).messages.length, 2);

  instant = new Date(instant.getTime() + 61000);
  const cancelledChat = await newChat(); mode = 'cancel';
  const cancelledRequest = submission(cancelledChat);
  const cancelledResponse = await http('chat', 'POST', cancelledRequest);
  const cancelledReader = cancelledResponse.body.getReader();
  await cancelledReader.read(); await cancelledReader.cancel(); await settle();
  const afterCancel = await getChat(cancelledChat.id);
  assert.equal(afterCancel.pending, null); assert.equal(afterCancel.messages.at(-1).status, 'cancelled');
  const cancelCalls = calls; const replayCancel = await json(await http('chat', 'POST', cancelledRequest));
  assert.equal(replayCancel.request.status, 'cancelled'); assert.equal(calls, cancelCalls);
  const abortChat = await newChat();
  const abortController = new AbortController(); abortController.abort();
  const aborted = await api.fetch(new Request(origin + '/api/chat', { method: 'POST', signal: abortController.signal,
    headers: { Origin: origin, 'Content-Type': 'application/json', 'oai-authenticated-user-id': 'editor-a' }, body: JSON.stringify(submission(abortChat)) }), env, ctx);
  assert.equal(aborted.status, 409); assert.equal(calls, cancelCalls);
  console.log('PASS: concurrent request IDs and revisions call the provider once; cancellation/pre-abort and cross-delta secret handling persist safe terminal results.');

  // Context limits reject the next turn before charging, rather than corrupting
  // the encrypted web signature or silently dropping prior research history.
  instant = new Date(instant.getTime() + 61000);
  mode = 'context-bound';
  const boundedChat = await newChat(); const boundedRequest = submission(boundedChat);
  await send(boundedRequest);
  const storedProtocolBefore = db.db.prepare("SELECT protocol_json FROM research_chat_messages WHERE request_id=? AND role='assistant'").get(boundedRequest.request_id).protocol_json;
  assert.equal(JSON.parse(storedProtocolBefore).server_tool_calls[0].calls[0].signature, longSignature);
  const boundedDetail = await getChat(boundedChat.id);
  const beforeBoundCalls = calls;
  const beforeBoundQuota = db.db.prepare('SELECT SUM(requests) AS requests FROM workspace_ai_usage').get().requests;
  const overflow = await http('chat', 'POST', submission(boundedDetail.chat, '继续讨论，不截断已读网页'));
  await json(overflow, 413);
  assert.equal(calls, beforeBoundCalls);
  assert.equal(db.db.prepare('SELECT SUM(requests) AS requests FROM workspace_ai_usage').get().requests, beforeBoundQuota);
  assert.equal(db.db.prepare("SELECT protocol_json FROM research_chat_messages WHERE request_id=? AND role='assistant'").get(boundedRequest.request_id).protocol_json, storedProtocolBefore);
  assert.equal((await getChat(boundedChat.id)).messages.length, 2);

  // A stalled paid request can outlive its response connection. Recovery via
  // GET expires its durable reservation, and neither replay nor late cancellation
  // may call the provider again or replace the already recorded failure.
  instant = new Date(instant.getTime() + 61000);
  mode = 'cancel';
  const expiredChat = await newChat(); const expiredRequest = submission(expiredChat);
  const expiredResponse = await http('chat', 'POST', expiredRequest);
  const expiredReader = expiredResponse.body.getReader();
  await expiredReader.read();
  const pendingDetail = await getChat(expiredChat.id);
  assert.equal(pendingDetail.pending.request_id, expiredRequest.request_id);
  instant = new Date(instant.getTime() + 155000);
  const expiredDetail = await getChat(expiredChat.id);
  assert.equal(expiredDetail.pending, null); assert.equal(expiredDetail.chat.revision, 2);
  assert.deepEqual(expiredDetail.messages.map(message => [message.role, message.status]), [['user', 'failed'], ['assistant', 'failed']]);
  const beforeExpiredReplay = calls;
  const expiredReplay = await json(await http('chat', 'POST', expiredRequest));
  assert.equal(expiredReplay.idempotent, true); assert.equal(expiredReplay.request.status, 'failed');
  assert.equal(calls, beforeExpiredReplay);
  await expiredReader.cancel(); await settle();
  const expiredAfterCancel = await getChat(expiredChat.id);
  assert.equal(expiredAfterCancel.chat.revision, expiredDetail.chat.revision);
  assert.deepEqual(expiredAfterCancel.messages, expiredDetail.messages);
  console.log('PASS: UTF-8 context overflow rejects before charging without truncating tool signatures; expired durable requests cannot revive or charge again.');
} finally { await settle(); db.close(); }
