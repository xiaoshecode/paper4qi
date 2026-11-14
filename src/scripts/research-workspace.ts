import { CATEGORIES } from '../data/meta';
import { parseTerms } from './highlight';
import { apiFetch, getApiURL, getDataURL, setApiToken, clearApiToken } from './api-client';
type Paper = { first_seen_at?: string; published?: string; id: string; title: string; source?: string; doi?: string; arxiv?: string; abstract?: string; venue?: string; year?: number; category?: string; zh?: string; tags?: string[]; front_matter?: boolean; has_notes?: boolean; wiki_revision?: number };
type Content = { title: string; zh: string; category: string; tags: string[]; body: string };
type Article = Content & { revision: number; updated_at?: string; history: { revision: number; at: string; summary: string; content: Content }[] };
type Venue = { id: string; name: string; kind: 'journal' | 'conference'; enabled: boolean; issn?: string; container_title?: string; keywords: string[] };
type Analysis = { summary?: string; category?: string; tags?: string[]; contributions?: string[]; limitations?: string[]; evidence_basis?: string; confidence?: number; model?: string; generated_at?: string; [key: string]: unknown };
type ArticleResult = { paper: Paper; article: Article; analysis: Analysis | null; analysis_history?: Analysis[] };
type PaperResult = { papers: Paper[]; discoveries?: Paper[]; articles?: Record<string, { revision: number }> };
type Snapshot = { articles?: Record<string, Article>; analyses?: Record<string, Analysis>; analysis_history?: Record<string, Analysis[]>; venues?: Venue[]; papers?: Paper[] };
const root = document.querySelector<HTMLElement>('#research-workspace');
if (root) {
  const base = root.dataset.base!;
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(`rw-${id}`) as T;
  const field = (id: string) => el<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(id);
  let token = '', connected = false, local = false, online = false, ai = false, busy = false, dirty = false, venueDirty = false, venueFormDirty = false, passwordAuth = false;
  let papers: Paper[] = [], venues: Venue[] = [], venueRevision = 0, selected: Paper | null = null, article: Article | null = null, analysis: Analysis | null = null;
  let snapshot: Snapshot = {}, analysisHistory: Analysis[] = [];
  let limit = 60, pendingHash: string | undefined;
  const notice = (text: string, error = false) => { el('status').textContent = text; el('status').classList.toggle('rw-error', error); };
  const sortPapers = () => papers.sort((a, b) => Number(b.id.startsWith('discovery:')) - Number(a.id.startsWith('discovery:')) || (b.first_seen_at || b.published || String(b.year || '')).localeCompare(a.first_seen_at || a.published || String(a.year || '')) || a.title.localeCompare(b.title));
  const split = (value: string) => value.split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
  const node = (tag: string, text: string, cls?: string) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
  const isDirty = () => dirty || venueDirty || venueFormDirty;
  const discard = () => !isDirty() || window.confirm('有尚未保存的修改，确定放弃吗？');
  const canReadAPI = () => online || connected;
  const sourceOf = (p: Paper) => p.source || (p.id.startsWith('discovery:') ? 'crossref' : p.id.split(':')[0]);
  const hasNotes = (p: Paper) => p.has_notes === true || (p.wiki_revision || snapshot.articles?.[p.id]?.revision || 0) > 0;
  const recordKind = (p: Paper) => p.front_matter ? '前置页' : sourceOf(p) === 'qce26' ? '日程条目 · 非发表证明' : p.id.startsWith('discovery:') ? '新发现' : '论文';
  let lastWorkspaceMode = '';
  const emitWorkspaceEvent = (name: string, detail: unknown) => { if (typeof CustomEvent !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new CustomEvent(name, { detail })); };
  function controls() {
    el<HTMLFieldSetElement>('venue-fields').disabled = !connected || busy;
    el<HTMLFieldSetElement>('editor-fields').disabled = !connected || busy || !selected;
    for (const id of ['save-venues', 'refresh', 'reload-venues']) el<HTMLButtonElement>(id).disabled = !connected || busy;
    field('venues-json').disabled = !connected || busy;
    el<HTMLButtonElement>('reload-article').disabled = busy || !selected;
    el<HTMLButtonElement>('analyze').disabled = !connected || busy || !selected || !ai;
    el<HTMLButtonElement>('adopt').disabled = !connected || busy || !analysis?.summary || analysis.stale === true;
    el<HTMLButtonElement>('disconnect').disabled = busy;
    el<HTMLButtonElement>('disconnect').hidden = online || !connected;
    el<HTMLFormElement>('connect').querySelector('button')!.disabled = busy || !local;
    field('token').disabled = busy || !local;
    root!.querySelectorAll<HTMLButtonElement>('[data-venue-toggle], [data-venue-edit], [data-restore]').forEach(b => b.disabled = !connected || busy);
    root!.dataset.connected = String(connected);
    el('connect').hidden = online || !local;
    el('setup-link').hidden = online || local;
    el('login-link').hidden = passwordAuth || !online || connected;
    el('password-login').hidden = !passwordAuth;
    el<HTMLInputElement>('password').disabled = busy || connected;
    el<HTMLFormElement>('password-login').querySelector('button')!.disabled = busy || connected;
    el('password-logout').hidden = !connected || !passwordAuth;
    el<HTMLButtonElement>('password-logout').disabled = busy;
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    el<HTMLAnchorElement>('login-link').href = `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : `${base}workspace/`)}`;
    el('readonly-note').hidden = connected;
    el('mode-badge').textContent = online ? connected ? '在线可编辑' : '在线公开只读' : connected ? '本地已连接' : local ? '本地待连接' : '公开只读';
    el('dirty').textContent = dirty ? '有未保存修改' : '未修改';
    el('mode').textContent = online ? connected ? '在线编辑权限已验证 · 审阅保存后更新正式内容，公开保留全部历史与 AI 草稿' : '公开阅读正文、版本历史与 AI 草稿 · 登录后由服务端验证编辑权限' : connected ? '本地可编辑 · 会话令牌仅保存在本页内存' : local ? '本地服务已就绪 · 输入会话令牌解锁编辑' : '公开只读快照 · 在线服务或本地服务提供保存、手动抓取与 AI 生成';
    const mode = { mode: online ? 'online' : local ? 'local' : 'static', can_edit: connected, deepseek_configured: ai, auth_mode: passwordAuth ? 'password' : 'sites' };
    if (JSON.stringify(mode) !== lastWorkspaceMode) { lastWorkspaceMode = JSON.stringify(mode); emitWorkspaceEvent('p4q:workspace-mode', mode); }
  }
  async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    if (method !== 'GET' && method !== 'HEAD' && !connected) throw new Error('当前没有编辑权限。请登录或连接本地会话后重试。');
    let response: Response;
    try { response = await apiFetch(getApiURL(path, base), { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' }, !online ? token : undefined); }
    catch { throw new Error(method === 'GET' ? '无法连接工作台服务，请稍后重试。' : '连接中断，操作结果尚不确定。本地编辑已保留；请先重新加载服务端记录核对，避免重复提交或重复计费。'); }
    const data = await response.json().catch(() => ({ error: '服务返回了非 JSON 响应' }));
    if (!response.ok) { if (response.status === 401 || response.status === 403) { connected = false; token = ''; if (passwordAuth) clearApiToken(); controls(); } throw new Error(response.status === 409 ? '版本冲突：服务器已有更新。本地修改已保留，请复制需要保留的内容，再重新加载最新版本后合并。' : `${response.status} · ${data.error || '请求失败'}`); }
    return data as T;
  }
  async function run(label: string, task: () => Promise<void>) {
    if (busy) return; busy = true; controls(); notice(label);
    try { await task(); } catch (e) { notice(e instanceof Error ? e.message : String(e), true); }
    finally { busy = false; controls(); if (pendingHash !== undefined) { const identifier = pendingHash; pendingHash = undefined; void followHash(identifier); } }
  }
  function renderYears() {
    const current = field('filter-year').value;
    const select = el<HTMLSelectElement>('filter-year');
    const all = node('option', '全部年份') as HTMLOptionElement; all.value = '';
    select.replaceChildren(all);
    for (const year of [...new Set(papers.map(p => p.year).filter((y): y is number => Number.isFinite(y)))].sort((a, b) => b - a)) {
      const option = node('option', String(year)) as HTMLOptionElement; option.value = String(year); select.append(option);
    }
    select.value = current;
  }
  function renderPapers() {
    sortPapers();
    const q = field('search').value.trim(), terms = parseTerms(q);
    const category = field('filter-category').value;
    const source = field('filter-source').value, year = field('filter-year').value, view = field('view').value || 'all';
    const showFront = el<HTMLInputElement>('show-front').checked;
    const found = papers.filter(p => (showFront || !p.front_matter) && (!category || (p.category || 'OTHER') === category) && (!source || sourceOf(p) === source) && (!year || String(p.year) === year) && (view !== 'new' || p.id.startsWith('discovery:')) && (view !== 'notes' || hasNotes(p)) && terms.every(term => [p.title, p.abstract, p.zh, p.doi, p.arxiv, p.venue, ...(p.tags || [])].join(' ').toLowerCase().includes(term)));
    if (field('sort').value === 'title') found.sort((a, b) => a.title.localeCompare(b.title));
    el('paper-count').textContent = String(found.length);
    const scheduleCount = found.filter(p => sourceOf(p) === 'qce26' && !p.front_matter).length, frontCount = found.filter(p => p.front_matter).length;
    el('results-label').textContent = `${found.length.toLocaleString()} 条研究记录 · ${found.length - scheduleCount - frontCount} 篇论文${scheduleCount ? ` · ${scheduleCount} 条日程` : ''}${frontCount ? ` · ${frontCount} 条前置页` : ''} · 已显示 ${Math.min(limit, found.length)}`;
    el('clear').hidden = !q && !category && !source && !year && view === 'all' && !showFront;
    el('paper-list').setAttribute('aria-busy', 'false');
    el('paper-list').replaceChildren();
    for (const p of found.slice(0, limit)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'rw-paper'; button.setAttribute('aria-pressed', String(selected?.id === p.id));
      button.append(node('span', `${recordKind(p)} · ${p.year || '年份待补'} · ${p.venue || '来源待补'}${hasNotes(p) ? ' · 已保存 Wiki' : ''}`, 'rw-paper-meta'), node('strong', p.title), node('span', p.zh || (p.tags || []).slice(0, 3).join(' · ') || '选择论文，开始阅读与整理', 'rw-paper-summary'));
      button.addEventListener('click', () => { if (!busy && (!dirty || window.confirm('当前论文有未保存的修改，确定切换吗？'))) void run('正在读取论文…', async () => { await selectPaper(p); focusEditor(); notice(connected ? '论文已载入，可以审阅并保存。' : online ? '正在阅读公开正文、版本历史和 AI 草稿。' : '正在查看公开只读快照。'); }); });
      el('paper-list').append(button);
    }
    if (!found.length) el('paper-list').append(node('p', '没有找到匹配论文。试试更短的关键词，或清除方向筛选。', 'rw-empty'));
    el('more').hidden = found.length <= limit;
  }
  function renderVenues() {
    el('venue-count').textContent = `${venues.filter(v => v.enabled).length} 个已启用`;
    el('venue-list').replaceChildren();
    for (const v of venues) {
      const row = node('div', '', 'rw-venue'); const description = node('div', ''); description.append(node('strong', v.name), node('small', `${v.kind === 'journal' ? '期刊' : '会议'} · ${v.issn || v.container_title || ''} · ${v.keywords.join(', ') || '所有关键词'}`));
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.dataset.venueToggle = v.id; toggle.setAttribute('aria-pressed', String(v.enabled)); toggle.textContent = v.enabled ? '已关注 ✓' : '关注';
      toggle.addEventListener('click', () => { if (!connected) return; void run('保存来源…', async () => { if (venueDirty && !window.confirm('JSON 中有未保存修改，继续将放弃这些修改，确定吗？')) return; await saveVenues(venues.map(x => x.id === v.id ? { ...x, enabled: !x.enabled } : x)); }); });
      const edit = document.createElement('button'); edit.type = 'button'; edit.dataset.venueEdit = v.id; edit.textContent = '填入编辑表'; edit.addEventListener('click', () => { if (venueFormDirty && !window.confirm('来源编辑表中有未保存修改，确定替换吗？')) return; venueFormDirty = false; el<HTMLDetailsElement>('source-editor').open = true; const form = el<HTMLFormElement>('venue-form'); for (const [key, value] of Object.entries({ id: v.id, name: v.name, kind: v.kind, identifier: v.issn || v.container_title || '', keywords: v.keywords.join(', ') })) (form.elements.namedItem(key) as HTMLInputElement).value = value; });
      row.append(description, toggle, edit); el('venue-list').append(row);
    }
    field('venues-json').value = JSON.stringify(venues, null, 2); venueDirty = false; controls();
  }
  async function saveVenues(next: Venue[]) {
    const result = await request<{ venues: Venue[]; revision: number }>('venues', 'PUT', { venues: next, expected_revision: venueRevision });
    venues = result.venues; venueRevision = result.revision; renderVenues(); notice('关注来源已保存。');
  }
  function draft(p: Paper): Article { return { title: p.title, zh: p.zh || '', category: p.category || 'OTHER', tags: p.tags || [], body: '', revision: 0, history: [] }; }
  function focusEditor() {
    el('editor-title').focus({ preventScroll: true });
    if (window.matchMedia?.('(max-width: 800px)').matches) el('editor').scrollIntoView({ block: 'start' });
  }
  function showPaperMetadata() {
    if (!selected) return;
    el('paper-meta').textContent = `${recordKind(selected)} · ${selected.venue || ''} · ${selected.year || ''}${selected.doi ? ` · DOI: ${selected.doi}` : ''}`;
    const link = el<HTMLAnchorElement>('source-link');
    const arxiv = selected.arxiv?.replace(/^https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf)\//, '').replace(/\.pdf$/, '');
    link.hidden = !selected.doi && !arxiv;
    if (selected.doi) { link.href = `https://doi.org/${encodeURIComponent(selected.doi)}`; link.textContent = '阅读原文 DOI ↗'; }
    else if (arxiv) { link.href = `https://arxiv.org/abs/${encodeURIComponent(arxiv)}`; link.textContent = '阅读 arXiv 预印本 ↗'; }
    else link.removeAttribute('href');
    el('abstract').textContent = selected.abstract || '此记录暂无摘要。仅凭标题生成的分析不能替代阅读全文。';
  }
  async function fetchArticle(p: Paper): Promise<ArticleResult> {
    return canReadAPI() ? request(`article?id=${encodeURIComponent(p.id)}`) : { paper: p, article: snapshot.articles?.[p.id] || draft(p), analysis: snapshot.analyses?.[p.id] || null, analysis_history: snapshot.analysis_history?.[p.id] || [] };
  }
  function showArticle(next: ArticleResult, fallback: Paper) {
    selected = next.paper || fallback; article = next.article; analysis = next.analysis; analysisHistory = next.analysis_history || []; dirty = false;
    if (article.revision > 0) {
      selected = { ...selected, has_notes: true, wiki_revision: article.revision };
      papers = papers.map(p => p.id === selected!.id ? { ...p, has_notes: true, wiki_revision: article!.revision } : p);
    }
    el('empty').hidden = true; el('detail').hidden = false; fill(article); renderHistory(); renderAnalysis(); renderPapers(); showPaperMetadata(); controls();
    emitWorkspaceEvent('p4q:paperselected', { id: selected.id, title: article.title });
  }
  async function selectPaper(p: Paper) {
    const next = await fetchArticle(p);
    showArticle(next, p);
    history.replaceState(null, '', `${location.pathname}${location.search}#id=${encodeURIComponent(selected!.id)}`);
  }
  function syncSavedMetadata() {
    if (!selected || !article) return;
    if (selected.title !== article.title) { analysis = null; renderAnalysis(); }
    selected = { ...selected, title: article.title, zh: article.zh, category: article.category, tags: [...article.tags], has_notes: article.revision > 0, wiki_revision: article.revision };
    papers = papers.map(p => p.id === selected!.id ? selected! : p); renderPapers();
    emitWorkspaceEvent('p4q:paperselected', { id: selected.id, title: article.title });
  }
  function fill(content: Content) {
    el('selected-title').textContent = content.title;
    field('title').value = content.title; field('zh').value = content.zh; field('category').value = CATEGORIES.some(c => c.key === content.category) ? content.category : 'OTHER'; field('tags').value = content.tags.join(', '); field('body').value = content.body; field('edit-summary').value = ''; el('preview').textContent = content.body || '暂无正文。'; el('public-body').textContent = content.body || '此记录尚未保存 Wiki 正文。'; el('revision').textContent = `v${article?.revision || 0}`;
  }
  function renderAnalysis() {
    el('analysis-text').textContent = analysis ? JSON.stringify(analysis, null, 2) : '暂无分析草稿。';
    const readable = el('analysis-readable'); readable.replaceChildren();
    if (!analysis) readable.append(node('p', '尚无分析草稿。可先阅读原文，记录自己的理解。', 'rw-hint'));
    else {
      if (analysis.stale === true) readable.append(node('p', '此草稿依据的论文信息或模型已变化，保留供回溯。请重新生成后再采纳。', 'rw-hint'));
      if (typeof analysis.summary === 'string') readable.append(node('p', analysis.summary));
      for (const [title, items] of [['主要贡献', analysis.contributions], ['局限与待核验', analysis.limitations]] as const) {
        if (!Array.isArray(items) || !items.length) continue;
        const list = document.createElement('ul');
        for (const item of items) if (typeof item === 'string') list.append(node('li', item));
        readable.append(node('h4', title), list);
      }
      const basis = analysis.evidence_basis === 'title_only' ? '仅依据标题，结论需重点核验' : analysis.evidence_basis === 'title_and_abstract' ? '依据标题与摘要，不包含全文' : '请核对分析依据与原文';
      readable.append(node('p', `${basis}${analysis.model ? ` · ${analysis.model}` : ''}`, 'rw-analysis-basis'));
    }
    const past = el('analysis-history'); past.replaceChildren();
    for (const entry of [...analysisHistory].reverse()) {
      const detail = document.createElement('details');
      detail.append(node('summary', `${entry.generated_at || '时间未记录'} · ${entry.model || 'DeepSeek'} · AI 草稿`), node('pre', JSON.stringify(entry, null, 2), 'rw-text'));
      past.append(detail);
    }
    if (!analysisHistory.length) past.append(node('p', '暂无更早的公开 AI 草稿。', 'rw-hint'));
    controls();
  }
  function renderHistory() {
    el('history').replaceChildren();
    for (const h of [...(article?.history || [])].reverse()) {
      const detail = document.createElement('details'); detail.append(node('summary', `v${h.revision} · ${h.at} · ${h.summary}`)); detail.append(node('pre', JSON.stringify(h.content, null, 2), 'rw-text'));
      const button = document.createElement('button'); button.type = 'button'; button.dataset.restore = String(h.revision); button.textContent = `恢复此版本为新版本`;
      button.addEventListener('click', () => { if (!connected || busy || !selected || !article || !window.confirm(`恢复 v${h.revision} 为新的公开当前版本？${dirty ? '未保存修改将被替换。' : ''}`)) return; void run('正在恢复版本…', async () => { const result = await request<{ article: Article }>('restore', 'POST', { id: selected!.id, expected_revision: article!.revision, revision: h.revision, summary: `恢复至版本 ${h.revision}` }); article = result.article; dirty = false; fill(article); syncSavedMetadata(); renderHistory(); notice('历史版本已恢复，并创建了新版本。'); }); });
      button.disabled = !connected || busy;
      detail.append(button); el('history').append(detail);
    }
    if (!article?.history?.length) el('history').append(node('p', '尚无公开的已保存版本。', 'rw-hint'));
  }
  function paperRows(result: PaperResult) {
    return [...new Map([...result.papers, ...(result.discoveries || [])].map(p => [p.id, { ...p, ...(result.articles?.[p.id]?.revision ? { has_notes: true, wiki_revision: result.articles[p.id].revision } : {}) }])).values()];
  }
  async function loadAPI(reselect = false) {
    const [p, v, next] = await Promise.all([request<PaperResult>('papers'), request<{ venues: Venue[]; revision: number }>('venues'), reselect && selected ? request<ArticleResult>(`article?id=${encodeURIComponent(selected.id)}`) : Promise.resolve(null)]);
    papers = paperRows(p); venues = v.venues; venueRevision = v.revision; renderYears(); renderPapers(); renderVenues();
    if (next && selected) showArticle(next, selected);
  }
  function clearWorkspace() {
    papers = []; venues = []; snapshot = {}; selected = null; article = null; analysis = null; analysisHistory = [];
    dirty = false; venueDirty = false; venueFormDirty = false;
    el('detail').hidden = true; el('empty').hidden = false; el('revision').textContent = '未选择';
    for (const id of ['title', 'zh', 'tags', 'body', 'edit-summary', 'venues-json']) field(id).value = '';
    for (const id of ['paper-list', 'venue-list', 'history', 'analysis-history', 'analysis-readable']) el(id).replaceChildren();
    for (const id of ['public-body', 'preview', 'abstract', 'selected-title', 'paper-meta', 'analysis-text', 'source-results']) el(id).textContent = '';
    el('source-results').hidden = true; renderYears(); renderPapers(); renderVenues();
    el<HTMLFormElement>('venue-form').reset(); venueFormDirty = false;
    emitWorkspaceEvent('p4q:paperselected', { id: null, title: '' });
  }
  el('connect').addEventListener('submit', event => { event.preventDefault(); if (online || busy || !discard()) return; void run('正在连接本地工作空间…', async () => { const previousToken = token; token = field('token').value.trim(); field('token').value = ''; if (!token) throw new Error('请输入终端显示的本地会话令牌。'); try { await loadAPI(true); connected = true; dirty = false; renderHistory(); notice('本地工作空间已连接。'); } catch (error) { token = previousToken; throw error; } }); });
  el('disconnect').addEventListener('click', () => { if (online || busy || !discard()) return; token = ''; connected = false; clearWorkspace(); void run('正在切换公开快照…', loadSnapshot); });
  el('password-login').addEventListener('submit', event => { event.preventDefault(); if (!passwordAuth || busy) return; void run('正在验证编辑身份…', async () => { const password = field('password').value; field('password').value = ''; const response = await apiFetch(getApiURL('auth/login', base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }), cache: 'no-store' }); const result = await response.json(); if (!response.ok || typeof result.token !== 'string') throw new Error('登录失败，请核对所有者密码。'); setApiToken(result.token, result.expires_at); await detectService(); controls(); notice('已登录编辑。未保存的正文保留，其他设备可读取公开研究内容。'); }); });
  el('password-logout').addEventListener('click', () => { if (!passwordAuth || busy) return; void run('正在退出编辑…', async () => { try { await apiFetch(getApiURL('auth/logout', base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store' }); } finally { connected = false; clearApiToken(); controls(); notice('已退出编辑。公开内容仍可阅读，未保存的正文保留在本页。'); } }); });
  el('venue-form').addEventListener('input', () => { venueFormDirty = true; });
  el('venue-form').addEventListener('submit', event => { event.preventDefault(); if (!connected || busy) return; const data = new FormData(el<HTMLFormElement>('venue-form')); void run('正在保存来源…', async () => { if (venueDirty && !window.confirm('JSON 中有未保存修改，继续将放弃这些修改，确定吗？')) return; const kind = String(data.get('kind')) as Venue['kind']; const item: Venue = { id: String(data.get('id')).trim(), name: String(data.get('name')).trim(), kind, enabled: true, keywords: split(String(data.get('keywords'))), ...(kind === 'journal' ? { issn: String(data.get('identifier')).trim() } : { container_title: String(data.get('identifier')).trim() }) }; await saveVenues([...venues.filter(v => v.id !== item.id), item]); venueFormDirty = false; }); });
  field('venues-json').addEventListener('input', () => { venueDirty = true; });
  el('save-venues').addEventListener('click', () => { if (connected) void run('保存来源配置…', async () => { const data = JSON.parse(field('venues-json').value); if (!Array.isArray(data)) throw new Error('来源 JSON 必须是数组。'); await saveVenues(data); }); });
  el('reload-venues').addEventListener('click', () => { if (venueDirty && !window.confirm('放弃未保存的来源 JSON 修改？')) return; void run('重新加载来源…', async () => { const data = await request<{ venues: Venue[]; revision: number }>('venues'); venues = data.venues; venueRevision = data.revision; renderVenues(); notice('已载入最新来源配置。'); }); });
  el('refresh').addEventListener('click', () => { if (!connected) return; void run('正在检索关注来源，请稍候…', async () => { const result = await request<{ added: number; updated: number; sources: { id: string; status: string; complete?: boolean; count?: number; scanned?: number }[] }>('refresh', 'POST', {}); el('source-results').hidden = false; el('source-results').textContent = result.sources.map(source => `${venues.find(v => v.id === source.id)?.name || source.id}：${source.status === 'ok' ? '本轮窗口完成' : source.status === 'error' ? '来源请求失败，旧数据和检查点已保留' : source.status === 'overflow' ? '单日数据较多，请尽快继续抓取' : '尚有数据待抓取，再次点击可续传'} · 扫描 ${source.scanned ?? '—'} 条 · 入库/更新 ${source.count ?? 0} 条`).join('\n\n'); papers = paperRows(await request<PaperResult>('papers'));
    if (selected) {
      const refreshed = papers.find(p => p.id === selected!.id);
      if (refreshed) {
        const inputKeys = ['title', 'abstract', 'doi', 'arxiv', 'venue', 'year'] as const;
        if (inputKeys.some(key => selected![key] !== refreshed[key])) { analysis = null; renderAnalysis(); }
        selected = refreshed;
        showPaperMetadata();
        // Keep the editor, dirty flag and revision intact, even if metadata changed.
      }
    }
    renderYears(); renderPapers(); const failed = result.sources.filter(s => s.status === 'error').length; const pending = result.sources.filter(s => s.status !== 'ok' && s.status !== 'error').length; notice(`本轮新增 ${result.added} 篇，更新 ${result.updated} 篇。${failed ? `${failed} 个来源失败，旧数据保留。` : ''}${pending ? `${pending} 个来源尚未完成，请继续抓取。` : failed ? '' : '所有启用来源的当前窗口已完成。'}`, failed > 0); }); });
  const resetResults = () => { limit = 60; renderPapers(); el('paper-list').scrollTop = 0; };
  field('search').addEventListener('input', resetResults);
  for (const id of ['filter-category', 'filter-source', 'filter-year', 'view']) field(id).addEventListener('change', resetResults);
  el('show-front').addEventListener('change', resetResults);
  field('sort').addEventListener('change', resetResults);
  el('clear').addEventListener('click', () => { for (const id of ['search', 'filter-category', 'filter-source', 'filter-year']) field(id).value = ''; field('view').value = 'all'; el<HTMLInputElement>('show-front').checked = false; resetResults(); field('search').focus(); });
  el('more').addEventListener('click', () => { limit += 60; renderPapers(); });
  el('back-to-list').addEventListener('click', () => { el('inbox').scrollIntoView({ block: 'start' }); field('search').focus({ preventScroll: true }); });
  window.addEventListener('keydown', event => {
    const target = event.target as HTMLElement | null;
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !target?.closest('input,textarea,select,[contenteditable="true"]')) {
      event.preventDefault(); field('search').focus();
    }
  });
  el('editor-form').addEventListener('input', () => { dirty = true; el('preview').textContent = field('body').value; controls(); });
  el('editor-form').addEventListener('submit', event => { event.preventDefault(); if (!connected || !selected || !article) return; void run('正在保存 Wiki 新版本…', async () => { const content: Content = { title: field('title').value, zh: field('zh').value, category: field('category').value, tags: split(field('tags').value), body: field('body').value }; const result = await request<Article | { article: Article }>('article', 'PUT', { id: selected!.id, expected_revision: article!.revision, summary: field('edit-summary').value, content }); article = 'article' in result ? result.article : result; dirty = false; fill(article); syncSavedMetadata(); renderHistory(); notice(`已保存为 v${article.revision}，正文、修改说明和历史版本公开保留。`); }); });
  el('reload-article').addEventListener('click', () => { if (selected && (!dirty || window.confirm('放弃当前未保存的修改并载入最新版本？'))) void run('重新加载论文…', async () => { await selectPaper(selected!); notice('已载入最新版本。'); }); });
  el('analyze').addEventListener('click', () => { if (!connected || !ai || !selected) return; void run('正在请求 DeepSeek 分析，当前编辑内容将保留…', async () => { const result = await request<{ analysis: Analysis; analysis_history?: Analysis[] }>('analyze', 'POST', { id: selected!.id }); analysis = result.analysis; analysisHistory = result.analysis_history || [...analysisHistory, result.analysis]; renderAnalysis(); notice('公开 AI 草稿已生成，正式内容未改变。请审阅后决定是否载入编辑器并保存。'); }); });
  el('adopt').addEventListener('click', () => { if (!analysis?.summary || analysis.stale === true || !connected || busy) return; if (!window.confirm('将分析草稿载入中文摘要、方向、标签和正文？现有编辑内容将被替换，但不会自动保存。')) return; const body = [`## 主要贡献`, ...(analysis.contributions || []).map(s => `- ${s}`), '', '## 局限与待核验', ...(analysis.limitations || []).map(s => `- ${s}`), '', `分析依据：${analysis.evidence_basis === 'title_only' ? '仅标题，结论需重点核验' : '标题与摘要，不包含全文'}`, `模型：${analysis.model || 'DeepSeek'} · ${analysis.generated_at || ''}`].join('\n'); field('zh').value = analysis.summary; field('category').value = CATEGORIES.some(c => c.key === analysis!.category) ? analysis.category! : 'OTHER'; field('tags').value = (analysis.tags || []).join(', '); field('body').value = body; field('edit-summary').value = '审阅并采纳 DeepSeek 分析草稿'; dirty = true; el('preview').textContent = body; controls(); notice('草稿已载入。请核对与修改后点击“保存新版本”。'); });
  window.addEventListener('beforeunload', event => { if (isDirty() || busy) { event.preventDefault(); event.returnValue = ''; } });
  async function followHash(requested?: string) {
    const identifier = requested ?? new URLSearchParams(location.hash.slice(1)).get('id');
    if (busy) { pendingHash = identifier || ''; return; }
    if (!identifier || identifier === selected?.id) return;
    if (dirty && !window.confirm('当前论文有未保存的修改，确定打开链接中的论文吗？')) {
      if (selected) history.replaceState(null, '', `${location.pathname}${location.search}#id=${encodeURIComponent(selected.id)}`);
      return;
    }
    const found = papers.find(p => p.id === identifier);
    if (!found && !canReadAPI()) { notice('当前快照中没有此记录，请核对链接或使用在线服务。', true); return; }
    await run('正在打开论文链接…', async () => { await selectPaper(found || { id: identifier, title: '' }); focusEditor(); notice('论文链接已打开。'); });
  }
  window.addEventListener('hashchange', () => void followHash());
  async function loadSnapshot() {
    const read = async (path: string) => { const response = await apiFetch(getDataURL(path, base)); if (!response.ok) throw new Error('快照资源不可用'); return response.json(); };
    const [paperResult, workspaceResult] = await Promise.allSettled([read('papers.json'), read('workspace.json')]);
    const pdata = paperResult.status === 'fulfilled' ? paperResult.value : { papers: [] };
    snapshot = workspaceResult.status === 'fulfilled' ? workspaceResult.value : {};
    papers = [...new Map([...(Array.isArray(pdata) ? pdata : pdata.papers || []), ...(snapshot.papers || [])].map((p: Paper) => [p.id, p])).values()]; venues = snapshot.venues || [];
    renderYears(); renderPapers(); renderVenues();
    if (paperResult.status === 'rejected' && workspaceResult.status === 'rejected') throw new Error('公开快照暂不可用。在线服务检测不受影响，请检查数据构建或稍后刷新。');
    notice(workspaceResult.status === 'fulfilled' ? '公开快照已载入。研究正文、修改说明、版本历史和 AI 草稿可公开阅读。' : '文献库已载入，工作台快照暂不可用。');
  }
  async function detectService() {
    try {
      const response = await apiFetch(getApiURL('status', base), { cache: 'no-store', signal: AbortSignal.timeout(4000) });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return;
      const status = await response.json();
      passwordAuth = status.auth_mode === 'password';
      online = (status.mode === 'online' || passwordAuth) && status.ready === true;
      local = !online && status.ready === true;
      connected = online && status.can_edit === true;
      ai = status.deepseek_configured === true;
      el('ai-info').textContent = ai ? `服务端模型已配置：${status.model || 'DeepSeek'}。生成的 AI 草稿公开，需审阅保存才覆盖正式内容。` : '服务端尚未配置 DeepSeek；公开阅读和获授权的 Wiki 编辑不受影响。';
    } catch { /* A static snapshot remains readable without a live API. */ }
  }
  window.addEventListener('p4q:authchange', () => { void detectService().then(controls); });
  void run('正在加载工作空间…', async () => {
    const [snapshotResult] = await Promise.allSettled([loadSnapshot(), detectService()]);
    if (online) { await loadAPI(); notice(connected ? '在线工作台已连接，可以跨设备审阅并保存研究内容。' : '在线公开内容已载入，可阅读正文、历史版本和 AI 草稿。'); }
    else if (snapshotResult.status === 'rejected') notice(snapshotResult.reason instanceof Error ? snapshotResult.reason.message : '公开快照暂不可用。', true);
    const hashId = new URLSearchParams(location.hash.slice(1)).get('id');
    const initial = hashId ? papers.find(p => p.id === hashId) : null;
    if (initial || hashId && canReadAPI()) await selectPaper(initial || { id: hashId!, title: '' });
    controls();
  });
}
