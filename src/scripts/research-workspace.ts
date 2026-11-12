import { CATEGORIES } from '../data/meta';
type Paper = { first_seen_at?: string; published?: string; id: string; title: string; doi?: string; abstract?: string; venue?: string; year?: number; category?: string; zh?: string; tags?: string[] };
type Content = { title: string; zh: string; category: string; tags: string[]; body: string };
type Article = Content & { revision: number; updated_at?: string; history: { revision: number; at: string; summary: string; content: Content }[] };
type Venue = { id: string; name: string; kind: 'journal' | 'conference'; enabled: boolean; issn?: string; container_title?: string; keywords: string[] };
type Analysis = { summary?: string; category?: string; tags?: string[]; contributions?: string[]; limitations?: string[]; evidence_basis?: string; confidence?: number; model?: string; generated_at?: string; [key: string]: unknown };
const root = document.querySelector<HTMLElement>('#research-workspace');
if (root) {
  const base = root.dataset.base!;
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(`rw-${id}`) as T;
  const field = (id: string) => el<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(id);
  let token = '', connected = false, local = false, ai = false, busy = false, dirty = false, venueDirty = false, venueFormDirty = false;
  let papers: Paper[] = [], venues: Venue[] = [], venueRevision = 0, selected: Paper | null = null, article: Article | null = null, analysis: Analysis | null = null;
  let snapshot: { articles?: Record<string, Article>; analyses?: Record<string, Analysis>; venues?: Venue[] } = {};
  let limit = 60;
  const notice = (text: string, error = false) => { el('status').textContent = text; el('status').classList.toggle('rw-error', error); };
  const sortPapers = () => papers.sort((a, b) => Number(b.id.startsWith('discovery:')) - Number(a.id.startsWith('discovery:')) || (b.first_seen_at || b.published || String(b.year || '')).localeCompare(a.first_seen_at || a.published || String(a.year || '')) || a.title.localeCompare(b.title));
  const split = (value: string) => value.split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
  const node = (tag: string, text: string, cls?: string) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
  const isDirty = () => dirty || venueDirty || venueFormDirty;
  const discard = () => !isDirty() || window.confirm('有尚未保存的修改，确定放弃吗？');
  function controls() {
    el<HTMLFieldSetElement>('venue-fields').disabled = !connected || busy;
    el<HTMLFieldSetElement>('editor-fields').disabled = !connected || busy || !selected;
    for (const id of ['save-venues', 'refresh', 'reload-venues']) el<HTMLButtonElement>(id).disabled = !connected || busy;
    field('venues-json').disabled = !connected || busy;
    el<HTMLButtonElement>('reload-article').disabled = !connected || busy || !selected;
    el<HTMLButtonElement>('analyze').disabled = !connected || busy || !selected || !ai;
    el<HTMLButtonElement>('adopt').disabled = !connected || busy || !analysis?.summary;
    el<HTMLButtonElement>('disconnect').disabled = busy;
    el<HTMLButtonElement>('disconnect').hidden = !connected;
    el<HTMLFormElement>('connect').querySelector('button')!.disabled = busy || !local;
    field('token').disabled = busy || !local;
    root!.querySelectorAll<HTMLButtonElement>('[data-venue-toggle], [data-venue-edit], [data-restore]').forEach(b => b.disabled = !connected || busy);
    root!.dataset.connected = String(connected);
    el('connect').hidden = !local;
    el('setup-link').hidden = local;
    el('readonly-note').hidden = connected;
    el('mode-badge').textContent = connected ? '本地已连接' : local ? '本地待连接' : '公开只读';
    el('dirty').textContent = dirty ? '有未保存修改' : '未修改';
    el('mode').textContent = connected ? '本地可编辑 · 会话令牌仅保存在本页内存' : local ? '本地服务已就绪 · 输入会话令牌解锁编辑' : '公开只读模式 · 浏览已发布的内容快照；保存与抓取需本地服务';
  }
  async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    let response: Response;
    try { response = await fetch(`${base}api/${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' }); }
    catch { throw new Error(method === 'GET' ? '无法连接本地服务，请检查服务是否仍在运行。' : '连接中断，操作结果尚不确定。本地编辑已保留；请先重新加载服务端记录核对，避免重复提交或重复计费。'); }
    const data = await response.json().catch(() => ({ error: '服务返回了非 JSON 响应' }));
    if (!response.ok) { if (response.status === 401) { connected = false; token = ''; controls(); } throw new Error(response.status === 409 ? '版本冲突：服务器已有更新。本地修改已保留，请复制需要保留的内容，再重新加载最新版本后合并。' : `${response.status} · ${data.error || '请求失败'}`); }
    return data as T;
  }
  async function run(label: string, task: () => Promise<void>) {
    if (busy) return; busy = true; controls(); notice(label);
    try { await task(); } catch (e) { notice(e instanceof Error ? e.message : String(e), true); }
    finally { busy = false; controls(); }
  }
  function renderPapers() {
    sortPapers();
    const q = field('search').value.trim().toLowerCase();
    const category = field('filter-category').value;
    const found = papers.filter(p => (!category || (p.category || 'OTHER') === category) && [p.title, p.abstract, p.zh, p.doi, p.venue, ...(p.tags || [])].join(' ').toLowerCase().includes(q));
    if (field('sort').value === 'title') found.sort((a, b) => a.title.localeCompare(b.title));
    el('paper-count').textContent = String(found.length);
    el('results-label').textContent = `${found.length.toLocaleString()} 篇${q || category ? '匹配' : '论文'} · 已显示 ${Math.min(limit, found.length)}`;
    el('clear').hidden = !q && !category;
    el('paper-list').setAttribute('aria-busy', 'false');
    el('paper-list').replaceChildren();
    for (const p of found.slice(0, limit)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'rw-paper'; button.setAttribute('aria-pressed', String(selected?.id === p.id));
      button.append(node('span', `${p.id.startsWith('discovery:') ? '新发现 · ' : ''}${p.year || '年份待补'} · ${p.venue || '来源待补'}`, 'rw-paper-meta'), node('strong', p.title), node('span', p.zh || (p.tags || []).slice(0, 3).join(' · ') || '选择论文，开始阅读与整理', 'rw-paper-summary'));
      button.addEventListener('click', () => { if (!busy && (!dirty || window.confirm('当前论文有未保存的修改，确定切换吗？'))) void run('正在读取论文…', async () => { await selectPaper(p); el('editor-title').focus({ preventScroll: true }); if (window.matchMedia?.('(max-width: 800px)').matches) el('editor').scrollIntoView({ block: 'start' }); notice(connected ? '论文已载入，可以编辑。' : '正在查看公开只读快照。'); }); });
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
      toggle.addEventListener('click', () => void run('保存来源…', async () => { if (venueDirty && !window.confirm('JSON 中有未保存修改，继续将放弃这些修改，确定吗？')) return; await saveVenues(venues.map(x => x.id === v.id ? { ...x, enabled: !x.enabled } : x)); }));
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
  async function selectPaper(p: Paper) {
    let next: { paper: Paper; article: Article; analysis: Analysis | null };
    if (connected) next = await request(`article?id=${encodeURIComponent(p.id)}`);
    else next = { paper: p, article: snapshot.articles?.[p.id] || draft(p), analysis: snapshot.analyses?.[p.id] || null };
    selected = next.paper || p; article = next.article; analysis = next.analysis; dirty = false;
    el('empty').hidden = true; el('detail').hidden = false; fill(article); renderHistory(); renderAnalysis(); renderPapers(); controls();
    el('paper-meta').textContent = `${selected.venue || ''} · ${selected.year || ''}${selected.doi ? ` · DOI: ${selected.doi}` : ''}`;
    const sourceLink = el<HTMLAnchorElement>('source-link'); sourceLink.hidden = !selected.doi; if (selected.doi) sourceLink.href = `https://doi.org/${encodeURIComponent(selected.doi)}`; else sourceLink.removeAttribute('href');
    history.replaceState(null, '', `${location.pathname}${location.search}#id=${encodeURIComponent(selected.id)}`);
    el('abstract').textContent = selected.abstract || '此记录暂无摘要。仅凭标题生成的分析不能替代阅读全文。';
  }
  function syncSavedMetadata() {
    if (!selected || !article) return;
    if (selected.title !== article.title) { analysis = null; renderAnalysis(); }
    selected = { ...selected, title: article.title, zh: article.zh, category: article.category, tags: [...article.tags] };
    papers = papers.map(p => p.id === selected!.id ? selected! : p); renderPapers();
  }
  function fill(content: Content) {
    el('selected-title').textContent = content.title;
    field('title').value = content.title; field('zh').value = content.zh; field('category').value = CATEGORIES.some(c => c.key === content.category) ? content.category : 'OTHER'; field('tags').value = content.tags.join(', '); field('body').value = content.body; field('edit-summary').value = ''; el('preview').textContent = content.body || '暂无正文。'; el('revision').textContent = `v${article?.revision || 0}`;
  }
  function renderAnalysis() {
    el('analysis-text').textContent = analysis ? JSON.stringify(analysis, null, 2) : '暂无分析草稿。';
    const readable = el('analysis-readable'); readable.replaceChildren();
    if (!analysis) readable.append(node('p', '尚无分析草稿。可先阅读原文，记录自己的理解。', 'rw-hint'));
    else {
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
    controls();
  }
  function renderHistory() {
    el('history').replaceChildren();
    for (const h of [...(article?.history || [])].reverse()) {
      const detail = document.createElement('details'); detail.append(node('summary', `v${h.revision} · ${h.at} · ${h.summary}`)); detail.append(node('pre', JSON.stringify(h.content, null, 2), 'rw-text'));
      const button = document.createElement('button'); button.type = 'button'; button.dataset.restore = String(h.revision); button.textContent = `恢复此版本为新版本`;
      button.addEventListener('click', () => { if (!selected || !article || !window.confirm(`恢复 v${h.revision} 为新的当前版本？${dirty ? '未保存修改将被替换。' : ''}`)) return; void run('正在恢复版本…', async () => { const result = await request<{ article: Article }>('restore', 'POST', { id: selected!.id, expected_revision: article!.revision, revision: h.revision, summary: `恢复至版本 ${h.revision}` }); article = result.article; dirty = false; fill(article); syncSavedMetadata(); renderHistory(); notice('历史版本已恢复，并创建了新版本。'); }); });
      detail.append(button); el('history').append(detail);
    }
    if (!article?.history?.length) el('history').append(node('p', connected ? '尚无已保存版本。' : '版本历史仅在认证的本地工作台可见。', 'rw-hint'));
  }
  async function loadPrivate() {
    const [p, v] = await Promise.all([request<{ papers: Paper[]; discoveries: Paper[] }>('papers'), request<{ venues: Venue[]; revision: number }>('venues')]);
    papers = [...new Map([...p.papers, ...(p.discoveries || [])].map(x => [x.id, x])).values()]; venues = v.venues; venueRevision = v.revision; connected = true; renderPapers(); renderVenues();
  }
  el('connect').addEventListener('submit', event => { event.preventDefault(); if (!discard()) return; void run('正在连接本地工作空间…', async () => { token = field('token').value.trim(); field('token').value = ''; if (!token) throw new Error('请输入终端显示的本地会话令牌。'); await loadPrivate(); dirty = false; if (selected) await selectPaper(papers.find(p => p.id === selected!.id) || selected); notice('本地工作空间已连接。'); }); });
  el('disconnect').addEventListener('click', () => { if (!discard()) return; token = ''; connected = false; dirty = false; venueDirty = false; venueFormDirty = false; selected = null; article = null; analysis = null; el('detail').hidden = true; el('empty').hidden = false; el('revision').textContent = '未选择'; void run('正在切换公开快照…', loadSnapshot); });
  el('venue-form').addEventListener('input', () => { venueFormDirty = true; });
  el('venue-form').addEventListener('submit', event => { event.preventDefault(); if (!connected || busy) return; const data = new FormData(el<HTMLFormElement>('venue-form')); void run('正在保存来源…', async () => { if (venueDirty && !window.confirm('JSON 中有未保存修改，继续将放弃这些修改，确定吗？')) return; const kind = String(data.get('kind')) as Venue['kind']; const item: Venue = { id: String(data.get('id')).trim(), name: String(data.get('name')).trim(), kind, enabled: true, keywords: split(String(data.get('keywords'))), ...(kind === 'journal' ? { issn: String(data.get('identifier')).trim() } : { container_title: String(data.get('identifier')).trim() }) }; await saveVenues([...venues.filter(v => v.id !== item.id), item]); venueFormDirty = false; }); });
  field('venues-json').addEventListener('input', () => { venueDirty = true; });
  el('save-venues').addEventListener('click', () => void run('保存来源配置…', async () => { const data = JSON.parse(field('venues-json').value); if (!Array.isArray(data)) throw new Error('来源 JSON 必须是数组。'); await saveVenues(data); }));
  el('reload-venues').addEventListener('click', () => { if (venueDirty && !window.confirm('放弃未保存的来源 JSON 修改？')) return; void run('重新加载来源…', async () => { const data = await request<{ venues: Venue[]; revision: number }>('venues'); venues = data.venues; venueRevision = data.revision; renderVenues(); notice('已载入最新来源配置。'); }); });
  el('refresh').addEventListener('click', () => void run('正在检索关注来源，请稍候…', async () => { const result = await request<{ added: number; updated: number; sources: { id: string; status: string; complete?: boolean; count?: number; scanned?: number }[] }>('refresh', 'POST', {}); el('source-results').hidden = false; el('source-results').textContent = result.sources.map(source => `${venues.find(v => v.id === source.id)?.name || source.id}：${source.status === 'ok' ? '本轮窗口完成' : source.status === 'error' ? '来源请求失败，旧数据和检查点已保留' : source.status === 'overflow' ? '单日数据较多，请尽快继续抓取' : '尚有数据待抓取，再次点击可续传'} · 扫描 ${source.scanned ?? '—'} 条 · 入库/更新 ${source.count ?? 0} 条`).join('\n\n'); const resultPapers = await request<{ papers: Paper[]; discoveries: Paper[] }>('papers'); papers = [...new Map([...resultPapers.papers, ...resultPapers.discoveries].map(p => [p.id, p])).values()];
    if (selected) {
      const refreshed = papers.find(p => p.id === selected!.id);
      if (refreshed) {
        const inputKeys = ['title', 'abstract', 'doi', 'venue', 'year'] as const;
        if (inputKeys.some(key => selected![key] !== refreshed[key])) { analysis = null; renderAnalysis(); }
        selected = refreshed;
        el('paper-meta').textContent = `${selected.venue || ''} · ${selected.year || ''}${selected.doi ? ` · DOI: ${selected.doi}` : ''}`;
        el('abstract').textContent = selected.abstract || '此记录暂无摘要。仅凭标题生成的分析不能替代阅读全文。';
        const sourceLink = el<HTMLAnchorElement>('source-link'); sourceLink.hidden = !selected.doi;
        if (selected.doi) sourceLink.href = `https://doi.org/${encodeURIComponent(selected.doi)}`; else sourceLink.removeAttribute('href');
        // Keep the editor, dirty flag and revision intact, even if metadata changed.
      }
    }
    renderPapers(); const failed = result.sources.filter(s => s.status === 'error').length; const pending = result.sources.filter(s => s.status !== 'ok' && s.status !== 'error').length; notice(`本轮新增 ${result.added} 篇，更新 ${result.updated} 篇。${failed ? `${failed} 个来源失败，旧数据保留。` : ''}${pending ? `${pending} 个来源尚未完成，请继续抓取。` : failed ? '' : '所有启用来源的当前窗口已完成。'}`, failed > 0); }));
  const resetResults = () => { limit = 60; renderPapers(); el('paper-list').scrollTop = 0; };
  field('search').addEventListener('input', resetResults);
  field('filter-category').addEventListener('change', resetResults);
  field('sort').addEventListener('change', resetResults);
  el('clear').addEventListener('click', () => { field('search').value = ''; field('filter-category').value = ''; resetResults(); field('search').focus(); });
  el('more').addEventListener('click', () => { limit += 60; renderPapers(); });
  el('back-to-list').addEventListener('click', () => { el('inbox').scrollIntoView({ block: 'start' }); field('search').focus({ preventScroll: true }); });
  window.addEventListener('keydown', event => {
    const target = event.target as HTMLElement | null;
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !target?.closest('input,textarea,select,[contenteditable="true"]')) {
      event.preventDefault(); field('search').focus();
    }
  });
  el('editor-form').addEventListener('input', () => { dirty = true; el('preview').textContent = field('body').value; controls(); });
  el('editor-form').addEventListener('submit', event => { event.preventDefault(); if (!selected || !article) return; void run('正在保存 Wiki 新版本…', async () => { const content: Content = { title: field('title').value, zh: field('zh').value, category: field('category').value, tags: split(field('tags').value), body: field('body').value }; const result = await request<Article | { article: Article }>('article', 'PUT', { id: selected!.id, expected_revision: article!.revision, summary: field('edit-summary').value, content }); article = 'article' in result ? result.article : result; dirty = false; fill(article); syncSavedMetadata(); renderHistory(); notice(`已保存为 v${article.revision}。`); }); });
  el('reload-article').addEventListener('click', () => { if (selected && (!dirty || window.confirm('放弃当前未保存的修改并载入最新版本？'))) void run('重新加载论文…', async () => { await selectPaper(selected!); notice('已载入最新版本。'); }); });
  el('analyze').addEventListener('click', () => { if (!selected) return; void run('正在请求 DeepSeek 分析，当前编辑内容将保留…', async () => { const result = await request<{ analysis: Analysis }>('analyze', 'POST', { id: selected!.id }); analysis = result.analysis; renderAnalysis(); notice('分析草稿已生成。请审阅后决定是否载入编辑器，当前修改未改变。'); }); });
  el('adopt').addEventListener('click', () => { if (!analysis?.summary || !connected || busy) return; if (!window.confirm('将分析草稿载入中文摘要、方向、标签和正文？现有编辑内容将被替换，但不会自动保存。')) return; const body = [`## 主要贡献`, ...(analysis.contributions || []).map(s => `- ${s}`), '', '## 局限与待核验', ...(analysis.limitations || []).map(s => `- ${s}`), '', `分析依据：${analysis.evidence_basis === 'title_only' ? '仅标题，结论需重点核验' : '标题与摘要，不包含全文'}`, `模型：${analysis.model || 'DeepSeek'} · ${analysis.generated_at || ''}`].join('\n'); field('zh').value = analysis.summary; field('category').value = CATEGORIES.some(c => c.key === analysis!.category) ? analysis.category! : 'OTHER'; field('tags').value = (analysis.tags || []).join(', '); field('body').value = body; field('edit-summary').value = '审阅并采纳 DeepSeek 分析草稿'; dirty = true; el('preview').textContent = body; controls(); notice('草稿已载入。请核对与修改后点击“保存新版本”。'); });
  window.addEventListener('beforeunload', event => { if (isDirty() || busy) { event.preventDefault(); event.returnValue = ''; } });
  async function loadSnapshot() {
    const [paperResponse, snapshotResponse] = await Promise.all([fetch(`${base}data/papers.json`), fetch(`${base}data/workspace.json`)]);
    if (!paperResponse.ok) throw new Error('无法加载文献数据，请确认数据已构建。');
    const pdata = await paperResponse.json(); let extra: Paper[] = [];
    if (snapshotResponse.ok) { const s = await snapshotResponse.json(); snapshot = s; extra = s.papers || []; } else snapshot = {};
    papers = [...new Map([...(Array.isArray(pdata) ? pdata : pdata.papers || []), ...extra].map((p: Paper) => [p.id, p])).values()]; venues = snapshot.venues || []; renderPapers(); renderVenues(); notice(snapshotResponse.ok ? '公开快照已载入。连接本地服务后可抓取、分析和保存。' : '文献库已载入，暂无可用的工作台快照。');
  }
  void run('正在加载工作空间…', async () => {
    await loadSnapshot();
    try { const response = await fetch(`${base}api/status`, { cache: 'no-store', signal: AbortSignal.timeout(4000) }); if (response.ok && response.headers.get('content-type')?.includes('application/json')) { const status = await response.json(); local = status.ready === true; ai = status.deepseek_configured === true; el('ai-info').textContent = ai ? `本地模型已配置：${status.model || 'DeepSeek'}。` : '本地尚未配置 DEEPSEEK_API_KEY；可正常编辑 Wiki。'; } } catch { /* Static hosting is intentionally read-only. */ }
    const hashId = new URLSearchParams(location.hash.slice(1)).get('id');
    const initial = hashId ? papers.find(p => p.id === hashId) : null;
    if (initial) await selectPaper(initial);
    controls();
  });
}
