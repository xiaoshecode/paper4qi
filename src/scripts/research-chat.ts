import { apiFetch, getApiURL, clearApiToken } from './api-client';
type Citation = { type?: string; url?: string; title?: string; start_index?: number; end_index?: number };
type ToolSource = { url?: string; title?: string; snippet?: string; site_name?: string; published_at?: string };
type ToolEvent = { type?: string; step?: number; call?: { name?: string; type?: string; status?: string; query?: string; url?: string; action?: { type?: string; queries?: string[]; url?: string }; sources?: ToolSource[]; page?: ToolSource | null } };
type Message = { id?: string; role: string; content: string; reasoning?: string; annotations?: Citation[]; tool_events?: ToolEvent[]; status?: string; created_at?: string; provider?: string | null; request_id?: string };
type Chat = { id: string; title: string; revision: number; updated_at?: string; paper_id?: string; paper_context?: { id?: string; title?: string } | null };
type Pending = { request_id: string; status: string; revision?: number };
type Conversation = { chat: Chat; messages: Message[]; pending: Pending | null };
type Attempt = { chat_id: string; expected_revision: number; request_id: string; content: string; thinking: boolean; web_search: boolean; read_url: boolean };

/** SSE lines may be split at any byte boundary; the streaming TextDecoder retains UTF-8 tails. */
export async function readChatEvents(body: ReadableStream<Uint8Array>, receive: (event: string, data: unknown) => void): Promise<void> {
  const reader = body.getReader(), decoder = new TextDecoder();
  let buffer = '', event = 'message', data: string[] = [];
  const line = (value: string) => {
    if (!value) { if (data.length) receive(event, JSON.parse(data.join('\n'))); event = 'message'; data = []; return; }
    if (value.startsWith(':')) return;
    const colon = value.indexOf(':'), key = colon < 0 ? value : value.slice(0, colon);
    const payload = colon < 0 ? '' : value.slice(colon + 1).replace(/^ /, '');
    if (key === 'event') event = payload;
    if (key === 'data') data.push(payload);
  };
  try {
    while (true) {
      const chunk = await reader.read();
      buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true });
      let position: number;
      while ((position = buffer.indexOf('\n')) >= 0) { line(buffer.slice(0, position).replace(/\r$/, '')); buffer = buffer.slice(position + 1); }
      if (buffer.length > 1_000_000) throw new Error('聊天流数据过大，请核对服务端记录。');
      if (chunk.done) { if (buffer || data.length) throw new Error('回答连接提前结束，请核对最新结果。'); return; }
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}

function safeCitationURL(value?: string): string | null {
  try { const url = new URL(value || ''); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}

/** Provider citation offsets count Unicode code points, including astral characters. */
export function citationSegments(content: string, annotations: Citation[]) {
  const points = Array.from(content), rows = annotations.map((citation, index) => ({ ...citation, index, href: safeCitationURL(citation.url) })).filter(c => c.href);
  const inline = rows.filter(c => Number.isInteger(c.start_index) && Number.isInteger(c.end_index) && c.start_index! >= 0 && c.end_index! > c.start_index! && c.end_index! <= points.length).sort((a, b) => a.end_index! - b.end_index!);
  const segments: { text: string; citation?: typeof rows[number] }[] = [];
  let cursor = 0;
  for (const c of inline) { if (c.end_index! < cursor) continue; segments.push({ text: points.slice(cursor, c.end_index).join(''), citation: c }); cursor = c.end_index!; }
  segments.push({ text: points.slice(cursor).join('') });
  return { segments, sources: rows };
}

const root = document.querySelector<HTMLElement>('#rc-root');
if (root) {
  const base = root.dataset.base!;
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(`rc-${id}`) as T;
  const checkbox = (id: string) => el<HTMLInputElement>(id);
  let online = false, canEdit = false, configured = false, busy = false, initialized = false, passwordAuth = false;
  let chats: Chat[] = [], current: Chat | null = null, messages: Message[] = [], pending: Pending | null = null, nextOffset: number | null = null;
  let paper: { id: string; title?: string } | null = null, attempt: Attempt | null = null, checkedAttempt = false, requestConfirmed = false;
  let controller: AbortController | null = null, draft: Message | null = null;
  const node = (tag: string, text = '', className?: string) => { const n = document.createElement(tag); n.textContent = text; if (className) n.className = className; return n; };
  const status = (text: string, error = false) => { el('status').textContent = text; el('status').classList.toggle('rw-error', error); };
  const terminal = (value?: string) => !!value && ['complete', 'truncated', 'refused', 'failed', 'cancelled'].includes(value);
  function controls() {
    el<HTMLButtonElement>('new').disabled = !online || !canEdit || busy || !!attempt;
    el<HTMLButtonElement>('reload').disabled = !online || !current || busy;
    el<HTMLTextAreaElement>('input').disabled = !online || !canEdit || busy || !!attempt;
    el<HTMLButtonElement>('send').disabled = !online || !canEdit || !configured || busy || !!pending || !!attempt;
    el('stop').hidden = !controller;
    el('retry').hidden = !attempt || !canEdit || busy;
    el<HTMLButtonElement>('retry').disabled = !configured;
    el('next-turn').hidden = !attempt || !checkedAttempt || busy;
    el<HTMLButtonElement>('next-turn').disabled = !!pending;
    el('login').hidden = !online || canEdit;
    const returnTo = `${location.pathname}${location.search}#rc-root`;
    el<HTMLAnchorElement>('login').href = passwordAuth ? '#rw-password-login' : `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`;
    el('login').textContent = passwordAuth ? '登录编辑后发送 →' : '登录并检查发送权限 ↗';
    for (const id of ['thinking', 'web-search', 'read-url', 'context']) checkbox(id).disabled = busy || !!attempt || !online || !canEdit;
    el('paper-chip').textContent = paper ? `所选论文：${paper.title || paper.id}` : '尚未选择论文';
    el('messages').setAttribute('aria-busy', String(busy));
    el('more').hidden = nextOffset === null;
    el<HTMLButtonElement>('more').disabled = busy;
  }
  async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    if (method !== 'GET' && !canEdit) throw new Error('当前没有聊天编辑权限。');
    const response = await apiFetch(getApiURL(path, base), { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json();
    if (!response.ok) { if ([401, 403].includes(response.status)) { canEdit = false; if (passwordAuth) clearApiToken(); controls(); } throw new Error(response.status === 409 ? '会话已更新，请核对最新结果后继续。' : result.error || '聊天请求失败。'); }
    return result as T;
  }
  function renderMessages() {
    const container = el('messages'); container.replaceChildren();
    for (const message of [...messages, ...(draft ? [draft] : [])]) {
      const item = node('article', '', `rc-message ${message.role === 'user' ? 'rc-user' : 'rc-assistant'}`);
      item.append(node('div', `${message.role === 'user' ? '公开提问' : 'AI · DeepSeek'}${message.created_at ? ` · ${message.created_at}` : ''}${message.status && message.status !== 'complete' ? ` · ${message.status === 'streaming' ? '接收中' : message.status === 'refused' ? '拒答' : message.status === 'truncated' ? '回答已截断' : '未完整完成'}` : ''}`, 'rc-message-meta'));
      const body = node('div', '', 'rc-message-body'), citations = citationSegments(message.content || '', message.annotations || []);
      for (const segment of citations.segments) { body.append(document.createTextNode(segment.text)); if (segment.citation) { const a = node('a', `[${segment.citation.index + 1}]`, 'rc-citation') as HTMLAnchorElement; a.href = segment.citation.href!; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = segment.citation.title || '引用来源'; body.append(a); } }
      item.append(body);
      if (message.reasoning) { const detail = document.createElement('details'); detail.append(node('summary', '思考过程 · AI 生成'), node('div', message.reasoning, 'rc-reasoning')); item.append(detail); }
      if (citations.sources.length) { const detail = document.createElement('details'); detail.append(node('summary', '引用来源')); const list = document.createElement('ol'); list.className = 'rc-sources'; for (const c of citations.sources) { const li = document.createElement('li'), a = node('a', c.title || c.url || '来源') as HTMLAnchorElement; a.href = c.href!; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.append(a); list.append(li); } detail.append(list); item.append(detail); }
      if (message.tool_events?.length) {
        const detail = document.createElement('details'), list = node('ul', '', 'rc-tools'); detail.append(node('summary', '搜索与阅读记录'));
        for (const t of message.tool_events) {
          const call = t.call, row = node('li', [t.type, call?.name || call?.type || call?.action?.type, call?.status, call?.query, ...(call?.action?.queries || [])].filter(v => typeof v === 'string').join(' · '));
          const sources = [...(call?.sources || []), ...(call?.page ? [call.page] : []), ...(call?.url || call?.action?.url ? [{ url: call?.url || call?.action?.url }] : [])];
          for (const source of sources) { const href = safeCitationURL(source.url); if (!href) continue; const block = node('div'), link = node('a', source.title || source.site_name || href) as HTMLAnchorElement; link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; block.append(link); if (source.snippet) block.append(node('p', source.snippet)); if (source.published_at) block.append(node('small', source.published_at)); row.append(block); }
          list.append(row);
        }
        detail.append(list); item.append(detail);
      }
      if (message.status && ['failed', 'cancelled', 'partial'].includes(message.status)) item.append(node('p', '此回答未完整完成，请核对服务端结果；不会自动重试。', 'rc-partial'));
      container.append(item);
    }
    if (!messages.length && !draft) container.append(node('p', '会话内容公开。提出问题后，回答会流式显示。', 'rc-empty'));
    container.scrollTop = container.scrollHeight;
  }
  function renderChats() {
    const list = el('chat-list'); list.replaceChildren();
    for (const chat of chats) { const button = node('button', chat.title || '未命名研究会话', 'rc-chat-item') as HTMLButtonElement; button.type = 'button'; button.setAttribute('aria-pressed', String(chat.id === current?.id)); button.append(node('small', `${chat.updated_at || ''} · v${chat.revision}`)); button.disabled = busy || !!attempt; button.addEventListener('click', () => void run(async () => { await loadChat(chat.id); status('公开会话已载入。'); })); list.append(button); }
    if (!chats.length) list.append(node('p', '尚无公开会话。', 'rw-hint'));
  }
  function showConversation(result: Conversation) {
    current = result.chat; messages = result.messages; pending = result.pending;
    el('title').textContent = current.title || '研究会话';
    el('chat-context').textContent = current.paper_context ? `会话论文快照：${current.paper_context.title || current.paper_context.id || current.paper_id || ''}` : current.paper_id ? `会话关联论文：${current.paper_id}` : '此会话没有附带论文快照。';
    renderMessages(); renderChats(); controls();
  }
  async function loadChats(append = false) {
    const result = await api<{ chats: Chat[]; next_offset?: number | null }>(`chats?limit=20&offset=${append ? nextOffset || 0 : 0}`);
    chats = append ? [...new Map([...chats, ...result.chats].map(c => [c.id, c])).values()] : result.chats;
    nextOffset = result.next_offset ?? null; renderChats(); controls();
  }
  async function loadChat(id: string): Promise<Conversation> { const result = await api<Conversation>(`chat?id=${encodeURIComponent(id)}`); showConversation(result); return result; }
  async function createChat() { const result = await api<{ chat: Chat }>('chats', 'POST', { ...(checkbox('context').checked && paper ? { paper_id: paper.id } : {}) }); await loadChats(); await loadChat(result.chat.id); }
  async function run(task: () => Promise<void>) { if (busy) return; busy = true; controls(); renderChats(); try { await task(); } catch (error) { status(error instanceof Error ? error.message : '请求失败。', true); } finally { busy = false; controls(); renderChats(); } }
  async function inspectAttempt() {
    if (!attempt) return;
    const result = await loadChat(attempt.chat_id);
    checkedAttempt = true;
    const saved = result.messages.find(m => m.role === 'assistant' && (m.request_id === attempt!.request_id || m.id === `${attempt!.request_id}:assistant`));
    if (saved && terminal(saved.status)) { requestConfirmed = true; draft = null; renderMessages(); }
    if (!result.pending && !saved && current!.revision !== attempt.expected_revision) requestConfirmed = true;
    status(result.pending?.request_id === attempt.request_id ? '服务端仍在处理此请求，稍后核对；重试会沿用同一请求编号。' : requestConfirmed ? '服务端结果已确认，可以开始新问题。' : '已核对服务端。可重试同一请求，不会自动发起新的付费调用。');
  }
  async function transmit() {
    if (!attempt || !current || !canEdit) return;
    const outgoing = attempt;
    checkedAttempt = false; requestConfirmed = false;
    controller = new AbortController();
    draft = { role: 'assistant', content: '', reasoning: '', annotations: [], tool_events: [], status: 'streaming' };
    renderMessages(); controls(); status('正在生成公开回答…');
    let completed = false;
    try {
      const response = await apiFetch(getApiURL('chat', base), { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(outgoing), signal: controller.signal });
      if (!response.ok) { if ([401, 403].includes(response.status)) canEdit = false; const result = await response.json().catch(() => ({})); throw new Error(result.error || (response.status === 409 ? '会话已更新，请核对最新结果。' : '生成请求失败。')); }
      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        completed = terminal(result.request?.status);
        if (result.message) draft = result.message;
        await inspectAttempt();
        if (completed) { requestConfirmed = true; attempt = null; draft = null; checkedAttempt = false; el<HTMLTextAreaElement>('input').value = ''; renderMessages(); }
        status(completed ? '已读取同一请求的服务端结果，没有重复调用模型。' : '同一请求仍在处理中，请稍后核对最新结果。');
      } else {
        if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) throw new Error('服务端未返回聊天流，请核对最新结果。');
        await readChatEvents(response.body, (event, raw) => {
          const data = raw as Record<string, unknown>;
          if (!draft) return;
          if (event === 'meta' && typeof data.revision === 'number') current!.revision = data.revision;
          if (event === 'text' && typeof data.delta === 'string') draft.content += data.delta;
          if (event === 'reasoning' && typeof data.delta === 'string') draft.reasoning = (draft.reasoning || '') + data.delta;
          if (event === 'tool' && data.event) draft.tool_events = [...(draft.tool_events || []), data.event as ToolEvent];
          if (event === 'citations' && Array.isArray(data.annotations)) draft.annotations = data.annotations as Citation[];
          if (event === 'title' && typeof data.title === 'string') { current!.title = data.title; el('title').textContent = data.title; }
          if (event === 'reset') draft = { role: 'assistant', content: typeof data.content === 'string' ? data.content : '模型未提供回答。', reasoning: '', annotations: [], tool_events: [], status: 'refused' };
          if (event === 'complete') { completed = true; draft = data.message as Message || { ...draft, status: String(data.status || 'complete') }; if (typeof data.revision === 'number') current!.revision = data.revision; }
          if (event === 'error') { draft.status = String(data.status || 'failed'); throw new Error(typeof data.message === 'string' ? data.message : '回答未完成，请核对最新结果。'); }
          renderMessages();
        });
        if (!completed) throw new Error('回答连接提前结束，请核对最新结果。');
        const result = await loadChat(outgoing.chat_id);
        pending = result.pending; attempt = null; draft = null; checkedAttempt = false; requestConfirmed = false; el<HTMLTextAreaElement>('input').value = ''; renderMessages();
        await loadChats(); status('回答已保存为公开会话，未改动 Wiki。');
      }
    } catch (error) {
      if (draft && !completed) draft.status = controller?.signal.aborted ? 'cancelled' : 'partial';
      status(controller?.signal.aborted ? '已停止接收。服务端可能仍在处理；请核对最新结果后再继续，不会自动重试。' : error instanceof Error ? error.message : '回答未完成，请核对最新结果。', true);
      renderMessages();
    } finally { controller = null; controls(); }
  }
  el('composer').addEventListener('submit', event => { event.preventDefault(); if (!online || !canEdit || !configured || busy || attempt || pending) return; const content = el<HTMLTextAreaElement>('input').value.trim(); if (!content) return; void run(async () => { if (!current) await createChat(); attempt = { chat_id: current!.id, expected_revision: current!.revision, request_id: crypto.randomUUID(), content, thinking: checkbox('thinking').checked, web_search: checkbox('web-search').checked, read_url: checkbox('read-url').checked }; await transmit(); }); });
  el('stop').addEventListener('click', () => controller?.abort());
  el('retry').addEventListener('click', () => { if (!attempt || !canEdit || busy) return; void run(async () => { await inspectAttempt(); if (requestConfirmed) { status('此请求已有保存结果，请开始新问题；不会再次生成。'); return; } await transmit(); }); });
  el('next-turn').addEventListener('click', () => { if (!checkedAttempt || pending || busy) return; attempt = null; draft = null; checkedAttempt = false; requestConfirmed = false; el<HTMLTextAreaElement>('input').value = ''; renderMessages(); controls(); el('input').focus(); });
  el('reload').addEventListener('click', () => void run(async () => { if (attempt) await inspectAttempt(); else if (current) { draft = null; await loadChat(current.id); status(pending ? '会话仍有请求正在处理，请稍后核对。' : '已读取最新公开会话。'); } }));
  el('new').addEventListener('click', () => { if (!canEdit || busy || !!attempt) return; void run(async () => { await createChat(); status('公开会话已创建。'); }); });
  el('more').addEventListener('click', () => void run(() => loadChats(true)));
  window.addEventListener('p4q:paperselected', event => { const selected = (event as CustomEvent).detail; paper = selected?.id ? { id: selected.id, title: selected.title } : null; controls(); });
  const setMode = (mode: { mode?: string; can_edit?: boolean; deepseek_configured?: boolean; auth_mode?: string }) => {
    passwordAuth = mode.auth_mode === 'password'; online = mode.mode === 'online' || passwordAuth; canEdit = online && mode.can_edit === true; configured = mode.deepseek_configured === true;
    controls();
    if (!online) { status(mode.mode === 'local' ? '研究聊天由在线服务提供，本地 Wiki 模式暂不支持发送聊天。' : '当前为静态快照。在线服务提供公开会话与模型聊天。'); return; }
    if (!initialized) { initialized = true; void run(async () => { await loadChats(); if (chats.length) await loadChat(chats[0].id); status(canEdit ? configured ? '公开研究聊天已就绪。' : '可阅读和创建会话；服务端尚未配置聊天模型。' : '可以阅读公开会话；登录后检查发送权限。'); }); }
  };
  window.addEventListener('p4q:workspace-mode', event => setMode((event as CustomEvent).detail));
  window.addEventListener('beforeunload', event => { if (busy || attempt || el<HTMLTextAreaElement>('input').value.trim()) { event.preventDefault(); event.returnValue = ''; } });
  controls();
  const refreshMode = () => apiFetch(getApiURL('status', base), { cache: 'no-store', signal: AbortSignal.timeout(4000) }).then(async response => { if (response.ok && response.headers.get('content-type')?.includes('application/json')) { const mode = await response.json(); setMode({ ...mode, mode: mode.mode === 'online' || mode.auth_mode === 'password' ? 'online' : mode.ready ? 'local' : 'static' }); } else setMode({ mode: 'static' }); }).catch(() => setMode({ mode: 'static' }));
  window.addEventListener('p4q:authchange', () => { void refreshMode(); });
  void refreshMode();
}
