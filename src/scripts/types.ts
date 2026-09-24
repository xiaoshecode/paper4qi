// 文献浏览器共享类型定义（供 paper-browser / stats / about 等模块复用）
// 对应运行时数据接口：${BASE_URL}data/{qce|tqe}.json

/** 记录来源：qce = 会议论文集（2020–2025），qce26 = 2026 官方日程，tqe = 期刊 */
export type PaperSource = 'qce' | 'qce26' | 'tqe';

export interface Paper {
  /** 全局唯一 id */
  id: string;
  source: PaperSource;
  /** 来源库内 id（DOI / IEEE 编号 / 日程 id 等） */
  source_id: string;
  year: number;
  title: string;
  authors: string[];
  doi: string | null;
  arxiv: string | null;
  abstract: string | null;
  /** 中文创新点说明 */
  zh: string;
  /** 13 类方向 key，见 meta.ts CATEGORIES */
  category: string;
  tags: string[];
  venue: string;
  pages: string | null;
  cited_by: number | null;
  /** 前置页（封面 / 目录 / 序言等非论文条目） */
  front_matter: boolean;
  // ---- 以下字段仅 qce26（2026 官方日程）条目存在 ----
  track?: string | null;
  session?: string | null;
  day?: string | null;
  time?: string | null;
  /** 获奖标注，如 "Best Paper"；仅 qce26 可能非空 */
  best?: string | null;
}

/** data/{source}.json 顶层结构 */
export interface DataFile {
  source: string;
  generated: string;
  count: number;
  papers: Paper[];
}

/** 浏览器可变状态 */
export interface BrowserState {
  /** 原始搜索串（空格分词，AND 语义） */
  q: string;
  /** 选中的年份集合，空集 = 全部 */
  years: Set<number>;
  /** 选中的方向 key 集合，空集 = 全部 */
  cats: Set<string>;
  /** 只看论文（隐藏前置页），默认 true */
  hideFM: boolean;
}
