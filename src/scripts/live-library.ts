// Refresh public overview/statistics/research views from the live database.
// Static Pages responses keep the original SSG fallback, without polling.
import { CATEGORIES } from '../data/meta';
import type { Paper } from './types';
import { apiFetch, getDataURL } from './api-client';

type Live = { runtime_revision: number; live_updated_at?: string | null; generated?: string };
type Stats = Live & {
  years: number[]; cats: string[]; totals: Record<string, number>;
  matrix: { combined: Record<string, Record<string, number>> };
  growth: { year: number; qce: number; tqe: number }[];
  topCited: { id: string; title: string; year: number; cited_by: number }[];
};
type Match = { id: string; matched_terms: string[] };
type Topic = { key: string; matched_count: number; sources: unknown[]; matched_papers: Match[] };
type Research = Live & { counts: Record<string, number>; topics: Topic[] };
const category = new Map(CATEGORIES.map(value => [value.key, value]));
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
const count = (value: unknown) => number(value).toLocaleString();
const sourceNames: Record<string, string> = { qce: 'QCE 论文集', tqe: 'TQE 期刊', qce26: 'QCE26 日程线索' };
const queryAll = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(selector));
function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function bilingual(parent: Element, zh: string, en: string) {
  parent.append(node('span', 'i18n-zh', zh), node('span', 'i18n-en', en));
}
function svgNode(tag: string, attributes: Record<string, string | number>, text?: string): SVGElement {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}
function chart(height: number, label: string) {
  return svgNode('svg', { viewBox: `0 0 920 ${height}`, width: '100%', role: 'img', 'aria-label': label });
}
function ticks(svg: SVGElement, maximum: number, height: number, left: number, top: number) {
  for (const ratio of [0, .25, .5, .75, 1]) {
    const value = Math.round(maximum * ratio), y = top + height * (1 - ratio);
    svg.append(svgNode('line', { x1: left, x2: 906, y1: y, y2: y, stroke: 'var(--line)' }),
      svgNode('text', { x: left - 6, y: y + 3.5, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--faint)' }, String(value)));
  }
}
export function categoryTotals(stats: Stats): [string, number][] {
  return stats.cats.filter(key => category.has(key)).map(key => [key, stats.years.reduce((sum, year) => sum + number(stats.matrix.combined[String(year)]?.[key]), 0)] as [string, number])
    .filter(([, total]) => total > 0).sort((a, b) => b[1] - a[1]);
}
function stacked(stats: Stats) {
  const svg = chart(300, '年×研究方向堆叠条形图 / Year × Research Area stacked bar chart');
  const cats = stats.cats.filter(key => category.has(key));
  const max = Math.max(1, ...stats.years.map(year => cats.reduce((sum, key) => sum + number(stats.matrix.combined[String(year)]?.[key]), 0)));
  const maximum = Math.ceil(max / 100) * 100, plotHeight = 264;
  ticks(svg, maximum, plotHeight, 40, 10);
  const gap = 864 / Math.max(stats.years.length, 1), width = Math.min(56, gap * .62);
  stats.years.forEach((year, index) => {
    const x = 40 + gap * index + (gap - width) / 2;
    let total = 0;
    for (const key of cats) {
      const value = number(stats.matrix.combined[String(year)]?.[key]);
      if (!value) continue;
      total += value;
      const height = value / maximum * plotHeight;
      const rect = svgNode('rect', { x, y: 274 - total / maximum * plotHeight, width, height, rx: height > 3 ? 2.5 : 0, fill: `var(--c-${key})` });
      const label = category.get(key)!;
      rect.append(svgNode('title', {}, `${year} · ${label.zh} / ${label.en}: ${value}`));
      svg.append(rect);
    }
    svg.append(svgNode('text', { x: x + width / 2, y: 274 - total / maximum * plotHeight - 5, 'text-anchor': 'middle', 'font-size': 10.5, fill: 'var(--muted)' }, String(total)),
      svgNode('text', { x: x + width / 2, y: 292, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--faint)' }, String(year)));
  });
  return svg;
}
function growthChart(stats: Stats) {
  const svg = chart(260, '两源逐年论文数折线图 / Papers per Year by Source');
  const years = stats.growth.map(value => value.year);
  const maximum = Math.ceil(Math.max(1, ...stats.growth.flatMap(value => [number(value.qce), number(value.tqe)])) / 100) * 100;
  const first = Math.min(...years), span = Math.max(Math.max(...years) - first, 1);
  const x = (year: number) => 44 + (year - first) / span * 862;
  const y = (value: number) => 234 - value / maximum * 222;
  ticks(svg, maximum, 222, 44, 12);
  years.forEach(year => svg.append(svgNode('text', { x: x(year), y: 252, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--faint)' }, String(year))));
  for (const [key, color] of [['qce', 'ALG'], ['tqe', 'QEC']] as const) {
    svg.append(svgNode('polyline', { points: stats.growth.map(value => `${x(value.year)},${y(number(value[key]))}`).join(' '), fill: 'none', stroke: `var(--c-${color})`, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
    for (const value of stats.growth) {
      const group = svgNode('g', {}), amount = number(value[key]);
      group.append(svgNode('circle', { cx: x(value.year), cy: y(amount), r: 3, fill: `var(--c-${color})` }),
        svgNode('text', { x: x(value.year), y: y(amount) - 7, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--muted)' }, String(amount)),
        svgNode('title', {}, `${key.toUpperCase()} ${value.year}: ${amount}`));
      svg.append(group);
    }
  }
  return svg;
}
function legend(stats: Stats) {
  return categoryTotals(stats).map(([key, total]) => {
    const label = category.get(key)!, item = node('span', 'lg'), swatch = node('span', 'sw');
    swatch.style.background = `var(--c-${key})`;
    item.append(swatch);
    bilingual(item, `${label.zh} ${total}`, `${label.en} ${total}`);
    return item;
  });
}
function categoryBars(stats: Stats) {
  const container = node('div', 'catbar'), totals = categoryTotals(stats), maximum = Math.max(1, ...totals.map(([, amount]) => amount));
  for (const [key, amount] of totals) {
    const row = node('div', 'row'), label = node('span', 'name'), track = node('div', 'track'), fill = node('div', 'fill'), meta = category.get(key)!;
    label.title = meta.zh; bilingual(label, meta.zh, meta.en);
    fill.style.width = `${amount / maximum * 100}%`; fill.style.background = `var(--c-${key})`;
    track.append(fill); row.append(label, track, node('span', 'val', String(amount))); container.append(row);
  }
  return container;
}
function link(text: string, href: string, external = false) {
  const element = node('a', '', text); element.href = href;
  if (external) { element.target = '_blank'; element.rel = 'noopener noreferrer'; }
  return element;
}
function externalPaperLink(paper: { doi?: string | null; arxiv?: string | null }) {
  if (paper.doi) return `https://doi.org/${encodeURI(paper.doi)}`;
  if (!paper.arxiv) return null;
  if (/^https?:\/\//i.test(paper.arxiv)) {
    try { const url = new URL(paper.arxiv); return url.protocol === 'https:' && url.hostname === 'arxiv.org' ? url.href : null; } catch { return null; }
  }
  return `https://arxiv.org/abs/${encodeURIComponent(paper.arxiv)}`;
}
function updateStats(root: HTMLElement, stats: Stats) {
  root.querySelector('[data-live-stacked]')?.replaceChildren(stacked(stats));
  root.querySelector('[data-live-growth]')?.replaceChildren(growthChart(stats));
  root.querySelector('[data-live-legend]')?.replaceChildren(...legend(stats));
  root.querySelector('[data-live-category]')?.replaceChildren(categoryBars(stats));
  for (const element of queryAll<HTMLElement>('[data-live-total]', root)) element.textContent = count(stats.totals[element.dataset.liveTotal!]);
  const range = `${Math.min(...stats.years)}–${Math.max(...stats.years)}`;
  queryAll('[data-live-year-range]', root).forEach(element => { element.textContent = range; });
  root.querySelector('[data-live-home-note="zh"]')?.replaceChildren(document.createTextNode(`共 ${count(stats.totals.all)} 条研究记录，不含 ${count(stats.totals.front)} 条前置页；日程条目不等同于已发表论文。数据构建于 `));
  root.querySelector('[data-live-home-note="en"]')?.replaceChildren(document.createTextNode(`${count(stats.totals.all)} research records, excluding ${count(stats.totals.front)} front-matter entries. Program entries are not published papers. Built `));
  const top = root.querySelector('[data-live-top-cited]');
  if (top) top.replaceChildren(...stats.topCited.map(paper => {
    const item = node('li'), details = node('span', 'cn');
    item.append(link(paper.title, `https://doi.org/${encodeURI(paper.id.replace(/^tqe:/, ''))}`, true), document.createTextNode(' · '),
      link('Wiki →', `${root.dataset.base}workspace/#${new URLSearchParams({ id: paper.id })}`));
    bilingual(details, `(${paper.year} · 被引 ${paper.cited_by})`, `(${paper.year} · ${paper.cited_by} citations)`); item.append(details); return item;
  }));
}
function updateResearch(research: Research) {
  for (const element of queryAll<HTMLElement>('[data-live-research-count]')) element.textContent = count(research.counts[element.dataset.liveResearchCount!]);
  for (const element of queryAll<HTMLElement>('[data-live-topic-key]')) {
    const topic = research.topics.find(topic => topic.key === element.dataset.liveTopicKey);
    if (topic) element.querySelector('.research-topic-count')!.textContent = `${topic.matched_count} 条关联线索 · ${topic.sources.length} 个精选入口`;
  }
}
export function topicPaperMatches(topic: Topic, papers: Paper[]): (Paper & Match)[] {
  const byId = new Map(papers.map(paper => [paper.id, paper]));
  return topic.matched_papers.flatMap(match => { const paper = byId.get(match.id); return paper && !paper.front_matter ? [{ ...paper, ...match }] : []; });
}
function researchCard(paper: Paper & Match, base: string) {
  const card = node('article', 'card research-paper');
  card.append(node('div', 'research-paper-meta', `${paper.year} · ${sourceNames[paper.source] ?? paper.source} · ${paper.category}`));
  const title = node('h3'); title.append(link(paper.title, `${base}${paper.source === 'tqe' ? 'tqe' : 'qce'}/#${new URLSearchParams({ q: paper.title })}`));
  card.append(title, node('p', '', paper.authors.join(', ')));
  const meta = node('div', 'research-paper-meta', `匹配：${paper.matched_terms.join(' · ')} · `);
  meta.append(link('Wiki →', `${base}workspace/#${new URLSearchParams({ id: paper.id })}`));
  for (const [label, material] of [['DOI ↗', { doi: paper.doi }], ['arXiv ↗', { arxiv: paper.arxiv }]] as const) {
    const url = externalPaperLink(material);
    if (url) meta.append(document.createTextNode(' · '), link(label, url, true));
  }
  card.append(meta); return card;
}
function updateTopic(root: HTMLElement, topic: Topic, papers: Paper[]) {
  const matches = topicPaperMatches(topic, papers), container = root.querySelector('[data-live-topic-papers]');
  queryAll('[data-live-topic-matched]').forEach(element => { element.textContent = String(matches.length); });
  if (!container) return;
  const list = node('div', 'research-paper-list'); list.append(...matches.slice(0, 12).map(paper => researchCard(paper, root.dataset.base!)));
  const children: HTMLElement[] = [list];
  if (matches.length > 12) {
    const details = node('details', 'research-more'), summary = node('summary', '', `展开其余 ${matches.length - 12} 条文献线索`), more = node('ul');
    details.open = container.querySelector('details')?.open ?? false;
    for (const paper of matches.slice(12)) {
      const item = node('li'); item.append(node('span', '', `${paper.year} · ${sourceNames[paper.source] ?? paper.source}`),
        link(paper.title, `${root.dataset.base}${paper.source === 'tqe' ? 'tqe' : 'qce'}/#${new URLSearchParams({ q: paper.title })}`),
        link('Wiki →', `${root.dataset.base}workspace/#${new URLSearchParams({ id: paper.id })}`)); more.append(item);
    }
    details.append(summary, more); children.push(details);
  }
  if (!matches.length) children.push(node('p', 'card research-empty', '当前 QCE / TQE 数据没有命中这些关键词。请沿精选资料扩展检索；这不表示该领域没有相关工作。'));
  container.replaceChildren(...children);
}
function live(value: unknown): value is Live {
  return !!value && typeof value === 'object' && Number.isSafeInteger((value as Live).runtime_revision) && (value as Live).runtime_revision >= 0;
}
async function load<T extends Live>(base: string, filename: string): Promise<T | null> {
  const response = await apiFetch(getDataURL(`${filename}.json`, base), { cache: 'no-store', signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Live library unavailable');
  const value = await response.json(); return live(value) ? value as T : null;
}
function start() {
  const root = document.querySelector<HTMLElement>('[data-live-library]');
  if (!root) return;
  let busy = false, lastRequest = 0;
  async function refresh() {
    if (!root || busy || document.visibilityState === 'hidden' || Date.now() - lastRequest < 1000) return;
    busy = true; lastRequest = Date.now();
    try {
      const base = root.dataset.base!, page = root.dataset.liveLibrary;
      let metadata: Live | null = null;
      if (page === 'stats' || page === 'home') {
        const stats = await load<Stats>(base, 'stats');
        if (stats) { updateStats(root, stats); metadata = stats; }
      } else {
        let research = await load<Research>(base, 'research-map');
        if (research) {
          if (page === 'topic') {
            const dataset = await load<Live & { papers: Paper[] }>(base, 'papers');
            // Never join associations against a different concurrently changed snapshot.
            if (!dataset) return;
            if (dataset.runtime_revision !== research.runtime_revision) research = await load<Research>(base, 'research-map');
            if (!research || dataset.runtime_revision !== research.runtime_revision) return;
            const topic = research.topics.find(topic => topic.key === root.dataset.liveTopic);
            if (topic) updateTopic(root, topic, dataset.papers);
          } else updateResearch(research);
          metadata = research;
        }
      }
      const status = root.querySelector<HTMLElement>('[data-live-status]');
      if (status && metadata) {
        status.hidden = false; status.replaceChildren();
        bilingual(status, `已读取在线研究版本 ${metadata.runtime_revision}；版本时间不代表来源核验日期。`, `Online research revision ${metadata.runtime_revision}; revision time is not source verification.`);
      }
    } catch {
      const status = root?.querySelector<HTMLElement>('[data-live-status]');
      if (status) { status.hidden = false; status.replaceChildren(); bilingual(status, '在线数据暂时不可用，保留最近可读快照。', 'Live data unavailable; showing the last readable snapshot.'); }
    } finally { busy = false; }
  }
  void refresh();
  window.addEventListener('pageshow', () => { void refresh(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void refresh(); });
}
start();
