// HTML 转义与关键词命中高亮
// 算法参考 paperresearch/QCE_papers.html 内嵌 JS 的 esc / hl：
// 收集所有 term 的命中区间 → 排序（起点升序，等起点时长的优先）→ 合并重叠 → 按区间插入 <mark>，未命中原样转义。

/** HTML 转义（& < > "），所有拼进 innerHTML 的动态值都必须先过这里 */
export function esc(s: unknown): string {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * 把 s 中所有命中 terms 的区间包成 <mark>，其余部分转义后原样输出。
 * @param s 原始文本（可含任意字符）
 * @param terms 已小写化的关键词（见 parseTerms）
 */
export function hl(s: unknown, terms: readonly string[]): string {
  const str = String(s);
  if (!terms.length) return esc(str);
  const lower = str.toLowerCase();
  const hits: Array<[number, number]> = [];
  for (const term of terms) {
    if (!term) continue;
    let from = 0;
    let index = lower.indexOf(term, from);
    while (index !== -1) {
      hits.push([index, index + term.length]);
      from = index + term.length;
      index = lower.indexOf(term, from);
    }
  }
  if (!hits.length) return esc(str);
  hits.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  let out = '';
  let end = 0;
  for (const [start, stop] of hits) {
    if (stop <= end) continue; // 完全被前一个区间覆盖
    const at = Math.max(start, end); // 部分重叠则截断
    out += `${esc(str.slice(end, at))}<mark>${esc(str.slice(at, stop))}</mark>`;
    end = stop;
  }
  return out + esc(str.slice(end));
}

/** s 是否命中任一 term（用于「摘要命中时自动展开」） */
export function hasHit(s: unknown, terms: readonly string[]): boolean {
  if (!terms.length) return false;
  const lower = String(s).toLowerCase();
  return terms.some((t) => t.length > 0 && lower.includes(t));
}

/** 搜索串 → 小写词数组（空白分词，去空、去重；词间为 AND 语义） */
export function parseTerms(q: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of q.toLowerCase().split(/\s+/)) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}
