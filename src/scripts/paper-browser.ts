// 文献浏览器核心（vanilla TS，无框架）
// 挂载约定：<div id="browser" data-source="qce|tqe"> + 一组静态工具条节点（见 PaperBrowser.astro）
// 职责：fetch 数据 → 叠加筛选（关键词 / 年份 / 方向 / 只看论文）→ 分批渲染 + 命中高亮 → URL hash 同步 → CSV 导出
// 双语：当前语言取 <html data-lang>，切换时由 SiteHeader 派发 window 事件 'p4q:langchange'（detail = 'zh' | 'en'）
import { CATEGORIES, CAT_ZH } from '../data/meta';
import { esc, hasHit, hl, parseTerms } from './highlight';
import type { BrowserState, DataFile, Paper } from './types';

const BATCH = 60; // 每批渲染条数
const DEBOUNCE = 100; // 搜索输入防抖（ms）

/** qce26 条目中文说明的固定前缀；en 模式下展示时替换为 T.en.qce26Prefix */
const QCE26_ZH_PREFIX = 'QCE26 官方日程';

type Lang = 'zh' | 'en';

interface Dict {
  /** 搜索框 placeholder / aria-label（属性无法用 span 承载，由 JS 设置） */
  searchPh: string;
  searchAria: string;
  yearsAria: string;
  catsAria: string;
  csvTitle: string;
  /** chips */
  all: string;
  allCats: string;
  /** 统计行（模板：{n} / {m}） */
  showCount: string;
  hiddenFM: string;
  keyword: string;
  filterLabel: string;
  yearLabel: string;
  catLabel: string;
  catJoin: string;
  /** 卡片 */
  fmBadge: string;
  cited: string;
  absEn: string;
  summaryZh: string;
  qce26Prefix: string;
  /** 状态提示 */
  empty: string;
  loading: string;
  loadingMeta: string;
  loadFail: string;
  metaUnavailable: string;
  /** CSV 表头（列顺序与数据行严格一致，仅列名本地化） */
  csvHead: string[];
}

/** 双语字符串字典：所有界面文案集中在此，新增语言只需补一份 */
const T: Record<Lang, Dict> = {
  zh: {
    searchPh: '搜索标题 / 作者 / 中文说明 / 摘要 / DOI…（空格分隔多词，按 / 聚焦）',
    searchAria: '搜索文献（标题 / 作者 / 中文说明 / 摘要 / DOI / arXiv / 标签 / 会议）',
    yearsAria: '按年份筛选',
    catsAria: '按研究方向筛选',
    csvTitle: '导出当前筛选结果为 CSV',
    all: '全部',
    allCats: '全部类别',
    showCount: '显示 <b>{n}</b> 条（论文 <b>{m}</b> 篇）',
    hiddenFM: '已隐藏前置页 <b>{n}</b> 条',
    keyword: '关键词：<b>{v}</b>',
    filterLabel: '筛选：<b>{v}</b>',
    yearLabel: '年份 {v}',
    catLabel: '方向 {v}',
    catJoin: '、',
    fmBadge: '前置页',
    cited: '被引 {n}',
    absEn: '英文摘要',
    summaryZh: '中文说明',
    qce26Prefix: QCE26_ZH_PREFIX,
    empty: '没有匹配的文献 · 试试减少关键词或取消部分筛选条件',
    loading: '正在加载文献数据…',
    loadingMeta: '正在加载…',
    loadFail: '数据加载失败：{msg} · 请稍后刷新重试',
    metaUnavailable: '数据不可用',
    csvHead: [
      '序号', '来源', '来源编号', '年份', '标题', '作者', 'DOI', 'arXiv',
      '类别', '类别中文名', '标签', '会议期刊', '页码', '被引',
      '前置页', 'Track', 'Session', '日期', '时间', '获奖', '中文说明', '摘要',
    ],
  },
  en: {
    searchPh: 'Search title / authors / summary / abstract / DOI… (space-separated, press / to focus)',
    searchAria: 'Search papers (title / authors / summary / abstract / DOI / arXiv / tags / venue)',
    yearsAria: 'Filter by year',
    catsAria: 'Filter by category',
    csvTitle: 'Export current results as CSV',
    all: 'All',
    allCats: 'All categories',
    showCount: 'Showing <b>{n}</b> records (<b>{m}</b> papers)',
    hiddenFM: '<b>{n}</b> front-matter records hidden',
    keyword: 'Keyword: <b>{v}</b>',
    filterLabel: 'Filters: <b>{v}</b>',
    yearLabel: 'Year {v}',
    catLabel: 'Category {v}',
    catJoin: ', ',
    fmBadge: 'Front matter',
    cited: 'Cited {n}',
    absEn: 'English abstract',
    summaryZh: 'Chinese summary',
    qce26Prefix: 'QCE26 schedule',
    empty: 'No matching papers · try fewer keywords or clear some filters',
    loading: 'Loading papers…',
    loadingMeta: 'Loading…',
    loadFail: 'Failed to load data: {msg} · please refresh and retry',
    metaUnavailable: 'Data unavailable',
    csvHead: [
      'Index', 'Source', 'Source ID', 'Year', 'Title', 'Authors', 'DOI', 'arXiv',
      'Category', 'Category (zh)', 'Tags', 'Venue', 'Pages', 'Cited',
      'Front matter', 'Track', 'Session', 'Day', 'Time', 'Award',
      'Chinese summary', 'Abstract',
    ],
  },
};

/** 当前语言：以 <html data-lang> 为准，默认 zh */
let lang: Lang = document.documentElement.dataset.lang === 'en' ? 'en' : 'zh';

/** 简单模板填充：{key} → vars[key] */
function fmt(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/** Paper → 检索用小写 haystack 的懒构建缓存（不污染数据对象本身） */
const HAY = new WeakMap<Paper, string>();
/** 类别色板合法 key，非法 category 回落到 OTHER */
const CAT_KEYS = new Set(CATEGORIES.map((c) => c.key));
/** 类别英文名（复用已 import 的 CATEGORIES，不额外增加 bundle） */
const CAT_EN: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.en]));

/** 类别名按当前语言取（zh 用 CAT_ZH，en 用 CATEGORIES 的 en 字段） */
function catName(key: string): string {
  return lang === 'en' ? (CAT_EN[key] ?? key) : (CAT_ZH[key] ?? key);
}

/** 中文说明是否为占位（空或「【待补充】」）：这类文本不作为折叠内容渲染 */
function isPlaceholderZh(z: string): boolean {
  return !z.trim() || z.includes('待补充');
}

/** 展示用中文说明：en 模式下把 qce26 的固定前缀本地化为 QCE26 schedule */
function zhText(p: Paper): string {
  const z = p.zh ?? '';
  if (lang === 'en' && z.startsWith(QCE26_ZH_PREFIX)) {
    return T.en.qce26Prefix + z.slice(QCE26_ZH_PREFIX.length);
  }
  return z;
}

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

/** 检索用文本：title+authors+zh+abstract+doi+arxiv+tags+venue+session，小写拼接后缓存
 *  注意：检索与语言无关（两种语言的全部字段都参与），保证切换语言不改变命中集合 */
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
  let loadState: 'loading' | 'ok' | 'err' = 'loading';
  let loadErr = '';

  // ---------- URL hash 同步 ----------
  // 形式：#q=ldpc&y=2024,2025&c=QEC,ALG&fm=0（仅写入非默认项，便于分享）
  // 注意：hash 格式与语言无关，切语言不重写 hash
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
  /** ignoreFM=true 时跳过「只看论文」（用于统计被折叠的前置页条数） */
  function matches(p: Paper, ignoreFM = false): boolean {
    if (!ignoreFM && state.hideFM && p.front_matter) return false;
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
    const L = T[lang];
    const catKey = CAT_KEYS.has(p.category) ? p.category : 'OTHER';
    const url = paperUrl(p);
    const titleHtml = hl(p.title, terms);
    const title = url
      ? `<a href="${esc(url)}" target="_blank" rel="noopener">${titleHtml}</a>`
      : titleHtml;

    const badges = [
      p.source === 'qce26' && p.best ? `<span class="paper-badge">${esc(p.best)}</span>` : '',
      p.front_matter ? `<span class="paper-badge gray">${esc(L.fmBadge)}</span>` : '',
    ].join('');

    const authors = p.authors.length
      ? `<div class="paper-authors">${hl(p.authors.join(', '), terms)}</div>`
      : '';

    // ---- 描述区 / 折叠区按语言互换 ----
    // zh 模式：.paper-zh = 中文说明，<details> = 英文摘要
    // en 模式：.paper-zh = 英文摘要（abstract 为空时回退中文说明），<details> = 中文说明
    // 两模式都保持「搜索命中即自动展开」；中文说明为「【待补充】」或空时不渲染 details
    let desc = '';
    let abs = '';
    if (lang === 'en') {
      const zh = zhText(p);
      if (p.abstract) {
        desc = hl(p.abstract, terms);
        if (!isPlaceholderZh(zh)) {
          // open 判定用原始 zh（与检索 haystack 同源），渲染用本地化后的 zhText
          abs =
            `<details class="paper-abs"${hasHit(p.zh, terms) ? ' open' : ''}>` +
            `<summary>${esc(L.summaryZh)}</summary><p>${hl(zh, terms)}</p></details>`;
        }
      } else if (!isPlaceholderZh(zh)) {
        desc = hl(zh, terms);
      }
    } else {
      if (p.zh) desc = hl(p.zh, terms);
      if (p.abstract) {
        abs =
          `<details class="paper-abs"${hasHit(p.abstract, terms) ? ' open' : ''}>` +
          `<summary>${esc(L.absEn)}</summary><p>${hl(p.abstract, terms)}</p></details>`;
      }
    }
    const descHtml = desc ? `<div class="paper-zh">${desc}</div>` : '';

    const meta: string[] = [];
    if (p.venue) meta.push(hl(p.venue, terms));
    if (p.pages) meta.push(`pp. ${esc(p.pages)}`);
    if (p.cited_by != null) meta.push(fmt(L.cited, { n: p.cited_by }));
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

    return (
      `<article class="paper-item${p.front_matter ? ' fm' : ''}">` +
      `<div class="paper-top">` +
      `<span class="paper-idx">#${idx}</span>` +
      `<span class="paper-yr">${p.year}</span>` +
      `<span class="paper-cat"><span class="dot" style="background:var(--c-${catKey})"></span>${esc(catName(catKey))}</span>` +
      `<span class="paper-title">${title}</span>` +
      badges +
      `</div>` +
      authors +
      descHtml +
      metaHtml +
      abs +
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
      el.list.innerHTML = `<div class="empty-state">${esc(T[lang].empty)}</div>`;
      return;
    }
    renderMore();
  }

  // ---------- 统计行 ----------
  function updateMeta(): void {
    const L = T[lang];
    const total = results.length;
    let papers = 0;
    for (const p of results) if (!p.front_matter) papers++;
    let html = fmt(L.showCount, { n: total, m: papers });
    if (state.hideFM) {
      let hidden = 0;
      for (const p of all) if (p.front_matter && matches(p, true)) hidden++;
      if (hidden) html += ` · ${fmt(L.hiddenFM, { n: hidden })}`;
    }
    el.metaCount.innerHTML = html;

    if (state.q.trim()) {
      el.metaKw.innerHTML = fmt(L.keyword, { v: esc(state.q.trim()) });
      return;
    }
    const parts: string[] = [];
    if (state.years.size) {
      parts.push(fmt(L.yearLabel, { v: [...state.years].sort((a, b) => a - b).join(' / ') }));
    }
    if (state.cats.size) {
      parts.push(
        fmt(L.catLabel, {
          v: CATEGORIES.filter((c) => state.cats.has(c.key))
            .map((c) => catName(c.key))
            .join(L.catJoin),
        }),
      );
    }
    el.metaKw.innerHTML = parts.length ? fmt(L.filterLabel, { v: esc(parts.join(' · ')) }) : '';
  }

  // ---------- 筛选 chips（数据加载后 / 切语言时构建，选中态由 syncChipUI 恢复） ----------
  function buildChips(): void {
    const L = T[lang];
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
      `<button class="chip on" type="button" data-all="y">${esc(L.all)} <span class="cnt">${total}</span></button>` +
      yButtons.join('');

    // 13 类固定顺序全量展示（含计数 0 的类别，保持色板与 meta.ts 一致）
    const cButtons = CATEGORIES.map(
      (c) =>
        `<button class="chip" type="button" data-cat="${esc(c.key)}">` +
        `<span class="dot" style="background:var(--c-${esc(c.key)})"></span>${esc(catName(c.key))} ` +
        `<span class="cnt">${catCount.get(c.key) ?? 0}</span></button>`,
    );
    el.cats.innerHTML =
      `<button class="chip on" type="button" data-all="c">${esc(L.allCats)} <span class="cnt">${total}</span></button>` +
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

  // ---------- 静态工具条文案（属性类无法用 .i18n-zh/.i18n-en span 承载） ----------
  function setStaticTexts(): void {
    const L = T[lang];
    el.q.placeholder = L.searchPh;
    el.q.setAttribute('aria-label', L.searchAria);
    el.csv.title = L.csvTitle;
    el.years.setAttribute('aria-label', L.yearsAria);
    el.cats.setAttribute('aria-label', L.catsAria);
    if (loadState === 'loading') {
      el.loading.textContent = L.loading;
      el.metaCount.textContent = L.loadingMeta;
    } else if (loadState === 'err') {
      el.loading.textContent = fmt(L.loadFail, { msg: loadErr });
      el.metaCount.textContent = L.metaUnavailable;
    }
  }

  // ---------- 主流程 ----------
  function apply(): void {
    terms = parseTerms(state.q);
    results = all.filter((p) => matches(p));
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

  /** 语言切换：重渲染 chips + 列表 + 统计行；筛选项与 hash 不变 */
  function relang(): void {
    if (all.length) {
      buildChips();
      syncChipUI();
      render();
      updateMeta();
    }
    setStaticTexts();
  }

  async function load(): Promise<void> {
    const url = `${import.meta.env.BASE_URL}data/${source}.json`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as DataFile;
      all = Array.isArray(data.papers) ? data.papers : [];
      loadState = 'ok';
      el.loading.remove();
      buildChips();
      readHash();
      el.q.value = state.q;
      el.fm.checked = state.hideFM;
      apply();
    } catch (err) {
      loadState = 'err';
      loadErr = err instanceof Error ? err.message : String(err);
      el.loading.className = 'empty-state';
      setStaticTexts();
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

  // 语言切换（SiteHeader 派发）：更新 lang 并重渲染，不改动 hash
  window.addEventListener('p4q:langchange', (ev) => {
    const detail = (ev as CustomEvent).detail;
    const next: Lang =
      detail === 'en' || detail === 'zh'
        ? detail
        : document.documentElement.dataset.lang === 'en'
          ? 'en'
          : 'zh';
    if (next === lang) return;
    lang = next;
    relang();
  });

  // CSV 导出：当前筛选结果（列名随语言，数据内容不变；文件名后缀固定）
  el.csv.addEventListener('click', () => {
    const head = T[lang].csvHead;
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

  // 初始化：先按当前语言设置属性类文案（placeholder / aria / title），再加载数据
  setStaticTexts();
  void load();
}

main();
