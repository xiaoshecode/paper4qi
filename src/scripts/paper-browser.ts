// 文献浏览器核心（vanilla TS，无框架）
// 挂载约定：<div id="browser" data-source="qce|tqe"> + 一组静态工具条节点（见 PaperBrowser.astro）
// 职责：fetch 数据 → 叠加筛选（关键词 / 年份 / 方向 / 只看论文）→ 分批渲染 + 命中高亮 → URL hash 同步 → CSV 导出
import { CATEGORIES, CAT_ZH } from '../data/meta';
import { esc, hasHit, hl, parseTerms } from './highlight';
import type { BrowserState, DataFile, Paper } from './types';

const BATCH = 60; // 每批渲染条数
const DEBOUNCE = 100; // 搜索输入防抖（ms）

/** Paper → 检索用小写 haystack 的懒构建缓存（不污染数据对象本身） */
const HAY = new WeakMap<Paper, string>();
/** 类别色板合法 key，非法 category 回落到 OTHER */
const CAT_KEYS = new Set(CATEGORIES.map((c) => c.key));

function must<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`[paper-browser] 缺少 DOM 节点 #${id}`);
  return el as T;
}

/** 标题链接：DOI 优先，其次 arXiv abs，都没有则纯文本 */
function paperUrl(p: Paper): string | null {
  const doi = p.doi?.trim();
  if (doi) return `https://doi.org/${doi}`;
  const ax = p.arxiv?.trim();
  if (ax) return ax.startsWith('http') ? ax : `https://arxiv.org/abs/${ax}`;
  return null;
}

/** 检索用文本：title+authors+zh+abstract+doi+arxiv+tags+venue+session，小写拼接后缓存 */
function haystack(p: Paper): string {
  const cached = HAY.get(p);
  if (cached !== undefined) return cached;
  const text = [
    p.title,
    p.authors.join(' '),
    p.zh,
    p.abstract ?? '',
    p.doi ?? '',
    p.arxiv ?? '',
    p.tags.join(' '),
    p.venue,
    p.session ?? '',
  ]
    .join(' ')
    .toLowerCase();
  HAY.set(p, text);
  return text;
}

function main(): void {
  const mount = document.getElementById('browser');
  if (!mount) return; // 非浏览器页面

  const source = mount.dataset.source === 'tqe' ? 'tqe' : 'qce';
  const el = {
    q: must<HTMLInputElement>('b-q'),
    fm: must<HTMLInputElement>('b-fm'),
    csv: must<HTMLButtonElement>('b-csv'),
    years: must<HTMLElement>('b-years'),
    cats: must<HTMLElement>('b-cats'),
    list: must<HTMLElement>('b-list'),
    loading: must<HTMLElement>('b-loading'),
    sentinel: must<HTMLElement>('b-sentinel'),
    metaCount: must<HTMLElement>('b-meta-count'),
    metaKw: must<HTMLElement>('b-meta-kw'),
  };

  // ---------- 状态 ----------
  const state: BrowserState = { q: '', years: new Set(), cats: new Set(), hideFM: true };
  let all: Paper[] = [];
  let results: Paper[] = [];
  let terms: string[] = [];
  let cursor = 0;
  let timer: number | undefined;
  let lastHash = '';

  // ---------- URL hash 同步 ----------
  // 形式：#q=ldpc&y=2024,2025&c=QEC,ALG&fm=0（仅写入非默认项，便于分享）
  function readHash(): void {
    const raw = location.hash.replace(/^#/, '');
    if (!raw) return;
    const sp = new URLSearchParams(raw);
    const q = sp.get('q');
    if (q) state.q = q;
    const y = sp.get('y');
    if (y) {
      const years = y
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isFinite(v));
      if (years.length) state.years = new Set(years);
    }
    const c = sp.get('c');
    if (c) {
      const cats = c
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      if (cats.length) state.cats = new Set(cats);
    }
    const fm = sp.get('fm');
    if (fm === '0') state.hideFM = false;
    else if (fm === '1') state.hideFM = true;
  }

  function syncHash(): void {
    const sp = new URLSearchParams();
    if (state.q) sp.set('q', state.q);
    if (state.years.size) sp.set('y', [...state.years].sort((a, b) => a - b).join(','));
    if (state.cats.size) {
      // 按 CATEGORIES 顺序输出，链接可读且稳定
      const ordered = CATEGORIES.filter((c) => state.cats.has(c.key)).map((c) => c.key);
      sp.set('c', ordered.length ? ordered.join(',') : [...state.cats].join(','));
    }
    if (!state.hideFM) sp.set('fm', '0');
    const qs = sp.toString().replaceAll('%2C', ','); // 逗号保持字面量，避免 %2C 噪声
    lastHash = qs ? `#${qs}` : '';
    history.replaceState(null, '', `${location.pathname}${location.search}${lastHash}`);
  }

  // ---------- 筛选 ----------
  function matches(p: Paper): boolean {
    if (state.hideFM && p.front_matter) return false;
    if (state.years.size && !state.years.has(p.year)) return false;
    if (state.cats.size && !state.cats.has(p.category)) return false;
    if (terms.length) {
      const hay = haystack(p);
      for (const t of terms) if (!hay.includes(t)) return false;
    }
    return true;
  }

  // ---------- 卡片模板 ----------
  function card(p: Paper, idx: number): string {
    const catKey = CAT_KEYS.has(p.category) ? p.category : 'OTHER';
    const catZh = CAT_ZH[catKey] ?? catKey;
    const url = paperUrl(p);
    const titleHtml = hl(p.title, terms);
    const title = url
      ? `<a href="${esc(url)}" target="_blank" rel="noopener">${titleHtml}</a>`
      : titleHtml;

    const badges = [
      p.source === 'qce26' && p.best ? `<span class="paper-badge">${esc(p.best)}</span>` : '',
      p.front_matter ? '<span class="paper-badge gray">前置页</span>' : '',
    ].join('');

    const authors = p.authors.length
      ? `<div class="paper-authors">${hl(p.authors.join(', '), terms)}</div>`
      : '';
    const zh = p.zh ? `<div class="paper-zh">${hl(p.zh, terms)}</div>` : '';

    const meta: string[] = [];
    if (p.venue) meta.push(hl(p.venue, terms));
    if (p.pages) meta.push(`pp. ${esc(p.pages)}`);
    if (p.cited_by != null) meta.push(`被引 ${p.cited_by}`);
    for (const t of p.tags.slice(0, 5)) meta.push(`#${hl(t, terms)}`);
    if (p.source === 'qce26') {
      if (p.session) meta.push(`Session: ${hl(p.session, terms)}`);
      if (p.track) meta.push(esc(p.track));
      const when = [p.day, p.time].filter((v): v is string => Boolean(v)).join(' · ');
      if (when) meta.push(esc(when));
    }
    const metaHtml = meta.length
      ? `<div class="paper-meta">${meta.map((m) => `<span>${m}</span>`).join('')}</div>`
      : '';

    const absHtml = p.abstract
      ? `<details class="paper-abs"${hasHit(p.abstract, terms) ? ' open' : ''}>` +
        `<summary>摘要</summary><p>${hl(p.abstract, terms)}</p></details>`
      : '';

    return (
      `<article class="paper-item${p.front_matter ? ' fm' : ''}">` +
      `<div class="paper-top">` +
      `<span class="paper-idx">#${idx}</span>` +
      `<span class="paper-yr">${p.year}</span>` +
      `<span class="paper-cat"><span class="dot" style="background:var(--c-${catKey})"></span>${esc(catZh)}</span>` +
      `<span class="paper-title">${title}</span>` +
      badges +
      `</div>` +
      authors +
      zh +
      metaHtml +
      absHtml +
      `</article>`
    );
  }

  // ---------- 渲染（分批 + 触底追加） ----------
  function renderMore(): void {
    if (cursor >= results.length) return;
    const start = cursor;
    const next = results.slice(start, start + BATCH);
    cursor += next.length;
    let html = '';
    for (let i = 0; i < next.length; i++) {
      const p = next[i];
      if (p) html += card(p, start + i + 1);
    }
    el.list.insertAdjacentHTML('beforeend', html);
  }

  function render(): void {
    el.list.innerHTML = '';
    cursor = 0;
    if (!results.length) {
      el.list.innerHTML =
        '<div class="empty-state">没有匹配的文献 · 试试减少关键词或取消部分筛选条件</div>';
      return;
    }
    renderMore();
  }

  // ---------- 统计行 ----------
  function updateMeta(): void {
    const total = results.length;
    let papers = 0;
    for (const p of results) if (!p.front_matter) papers++;
    el.metaCount.innerHTML = `显示 <b>${total}</b> 条（论文 <b>${papers}</b> 篇）`;

    if (state.q.trim()) {
      el.metaKw.innerHTML = `关键词：<b>${esc(state.q.trim())}</b>`;
      return;
    }
    const parts: string[] = [];
    if (state.years.size) {
      parts.push(`年份 ${[...state.years].sort((a, b) => a - b).join(' / ')}`);
    }
    if (state.cats.size) {
      parts.push(
        `方向 ${CATEGORIES.filter((c) => state.cats.has(c.key))
          .map((c) => c.zh)
          .join('、')}`,
      );
    }
    el.metaKw.innerHTML = parts.length ? `筛选：<b>${esc(parts.join(' · '))}</b>` : '';
  }

  // ---------- 筛选 chips（数据加载后构建一次，之后只切 .on） ----------
  function buildChips(): void {
    const yearCount = new Map<number, number>();
    const catCount = new Map<string, number>();
    let total = 0;
    for (const p of all) {
      if (p.front_matter) continue;
      total++;
      yearCount.set(p.year, (yearCount.get(p.year) ?? 0) + 1);
      catCount.set(p.category, (catCount.get(p.category) ?? 0) + 1);
    }

    const yButtons = [...yearCount.keys()]
      .sort((a, b) => a - b)
      .map(
        (y) =>
          `<button class="chip" type="button" data-year="${y}">${y} <span class="cnt">${yearCount.get(y)}</span></button>`,
      );
    el.years.innerHTML =
      `<button class="chip on" type="button" data-all="y">全部 <span class="cnt">${total}</span></button>` +
      yButtons.join('');

    // 13 类固定顺序全量展示（含计数 0 的类别，保持色板与 meta.ts 一致）
    const cButtons = CATEGORIES.map(
      (c) =>
        `<button class="chip" type="button" data-cat="${esc(c.key)}">` +
        `<span class="dot" style="background:var(--c-${esc(c.key)})"></span>${esc(c.zh)} ` +
        `<span class="cnt">${catCount.get(c.key) ?? 0}</span></button>`,
    );
    el.cats.innerHTML =
      `<button class="chip on" type="button" data-all="c">全部 <span class="cnt">${total}</span></button>` +
      cButtons.join('');
  }

  function syncChipUI(): void {
    for (const btn of el.years.querySelectorAll<HTMLButtonElement>('.chip')) {
      const y = btn.dataset.year;
      btn.classList.toggle('on', y ? state.years.has(Number(y)) : state.years.size === 0);
    }
    for (const btn of el.cats.querySelectorAll<HTMLButtonElement>('.chip')) {
      const c = btn.dataset.cat;
      btn.classList.toggle('on', c ? state.cats.has(c) : state.cats.size === 0);
    }
  }

  // ---------- 主流程 ----------
  function apply(): void {
    terms = parseTerms(state.q);
    results = all.filter(matches);
    render();
    syncChipUI();
    updateMeta();
    syncHash();
  }

  function schedule(delay = DEBOUNCE): void {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      state.q = el.q.value;
      apply();
    }, delay);
  }

  async function load(): Promise<void> {
    const url = `${import.meta.env.BASE_URL}data/${source}.json`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as DataFile;
      all = Array.isArray(data.papers) ? data.papers : [];
      el.loading.remove();
      buildChips();
      readHash();
      el.q.value = state.q;
      el.fm.checked = state.hideFM;
      apply();
    } catch (err) {
      el.loading.className = 'empty-state';
      el.loading.textContent = `数据加载失败：${err instanceof Error ? err.message : String(err)} · 请稍后刷新重试`;
      el.metaCount.textContent = '数据不可用';
    }
  }

  // ---------- 事件 ----------
  el.q.addEventListener('input', () => schedule());
  el.fm.addEventListener('change', () => {
    state.hideFM = el.fm.checked;
    apply();
  });

  el.years.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('.chip');
    if (!btn) return;
    if (btn.dataset.all === 'y') state.years.clear();
    else {
      const y = Number(btn.dataset.year);
      if (Number.isFinite(y)) {
        if (state.years.has(y)) state.years.delete(y);
        else state.years.add(y);
      }
    }
    apply();
  });

  el.cats.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('.chip');
    if (!btn) return;
    if (btn.dataset.all === 'c') state.cats.clear();
    else {
      const c = btn.dataset.cat;
      if (c) {
        if (state.cats.has(c)) state.cats.delete(c);
        else state.cats.add(c);
      }
    }
    apply();
  });

  // 触底追加：观察哨兵节点，提前 600px 预加载下一批
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) renderMore();
    },
    { rootMargin: '600px 0px' },
  );
  io.observe(el.sentinel);

  // 键盘：/ 聚焦搜索，Esc 清空并失焦
  document.addEventListener('keydown', (ev) => {
    const t = ev.target as HTMLElement | null;
    const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (ev.key === '/' && !typing) {
      ev.preventDefault();
      el.q.focus();
      el.q.select();
    } else if (ev.key === 'Escape' && (typing || document.activeElement === el.q)) {
      if (el.q.value) {
        el.q.value = '';
        state.q = '';
        apply();
      }
      el.q.blur();
    }
  });

  // 外部改 hash（如粘贴分享链接回车）时还原状态
  window.addEventListener('hashchange', () => {
    if (location.hash === lastHash) return;
    state.q = '';
    state.years = new Set();
    state.cats = new Set();
    state.hideFM = true;
    readHash();
    el.q.value = state.q;
    el.fm.checked = state.hideFM;
    apply();
  });

  // CSV 导出：当前筛选结果
  el.csv.addEventListener('click', () => {
    const head = [
      'id', 'source', 'source_id', 'year', 'title', 'authors', 'doi', 'arxiv',
      'category', 'category_zh', 'tags', 'venue', 'pages', 'cited_by',
      'front_matter', 'track', 'session', 'day', 'time', 'best', 'zh', 'abstract',
    ];
    const cell = (v: unknown): string => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const lines = results.map((p) =>
      [
        p.id, p.source, p.source_id, p.year, p.title, p.authors.join('; '), p.doi, p.arxiv,
        p.category, CAT_ZH[p.category] ?? p.category, p.tags.join('; '), p.venue, p.pages, p.cited_by,
        p.front_matter, p.track, p.session, p.day, p.time, p.best, p.zh, p.abstract,
      ]
        .map(cell)
        .join(','),
    );
    // BOM 前缀保证 Excel 正确识别 UTF-8
    const csv = '﻿' + [head.map(cell).join(','), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${source}_papers_filtered.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  void load();
}

main();
