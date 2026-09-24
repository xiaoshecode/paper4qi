# CLAUDE.md — paper4qi 开发契约

> 给 AI 编码工具（Claude Code / Cursor 等）的项目约定。人读的完整文档见 `README.md`。

## 1. 项目一句话

Astro 5 静态文献站（`base = /paper4qi`，部署 GitHub Pages），数据由 Python 管线从 `data_src/` 三个来源（QCE 2020–2025 论文集 / QCE26 官方日程 / TQE 期刊）构建成 `public/data/{qce,tqe,stats}.json`，前端零框架、纯 vanilla TS 检索。

## 2. 关键路径速查

| 关注点 | 文件 |
| --- | --- |
| 数据真源（唯一事实源，进 git） | `data_src/{qce,qce26,tqe,overrides}/` |
| 数据构建（本地与 CI 共用） | `scripts/build_data.py` |
| 分类法 / 关键词 / Track 映射 | `scripts/lib_taxonomy.py` |
| 周更抓取（Crossref / OpenAlex / arXiv） | `scripts/update_data.py` + `scripts/lib_fetch.py` |
| QCE26 日程→DOI 替换 | `scripts/reconcile_qce26.py` |
| 检索/筛选/渲染/CSV/hash 逻辑 | `src/scripts/paper-browser.ts`（+ `highlight.ts`、`types.ts`） |
| 样式唯一来源（CSS 变量双主题） | `src/styles/global.css` |
| 站点常量（分类表、来源表、品牌） | `src/data/meta.ts` |
| 页面 | `src/pages/{index,qce/index,tqe/index,stats,about}.astro` + `src/layouts/BaseLayout.astro` |

## 3. 不可违反的约束

1. **所有站内链接与资源路径必须用 `import.meta.env.BASE_URL` 拼接**。`base = /paper4qi`，漏写前缀在线上 404（`href="/qce/"` 是错的，`href={`${base}qce/`}` 才对）。
2. **新样式一律使用 `global.css` 里的 CSS 变量**（`--bg/--surface/--ink/--muted/--faint/--line/--accent/--c-XXX`），禁止硬编码色值；亮暗两套变量都定义在 `:root` 与 `[data-theme="dark"]`，只改一处会导致暗色模式破版。
3. **新增 13 类之外的 `category` 会破坏 chips 与图例配色**：`--c-{KEY}` 变量、`meta.ts` 的 `CATEGORIES`、`lib_taxonomy.py` 的 `CAT_ORDER` 三处必须同步；`paper-browser.ts` 对未知 category 会回落到 `OTHER` 显示（`CAT_KEYS` 校验），但配色会缺。
4. **`build_data.py` 中的数量断言只 warn 不 raise，是刻意设计**：周更持续追加论文，硬失败会卡死部署。不要改回 `raise`；只保留数据一致性校验（DOI 缺失/重复、记录数与中文说明数不匹配、Track 集合变化）为硬失败。
5. **`paper-browser.ts` 的 hash 格式 `#q=..&y=..&c=..&fm=..` 已被分享链接依赖**：只能向后兼容地扩展（新增键、缺省即默认），不要重命名或改变语义。
6. **`public/data/` 是 gitignored 构建产物**：改数据必须改 `data_src/` 并用 `build_data.py` 重新生成；任何直接手改 `public/data/*.json` 的改动都会被下次构建覆盖。
7. **`src/content/*.md` 未被任何页面 import**，仅是文案素材；要靠它上线需先在页面里引用。

## 4. 常用命令

```bash
pnpm install                        # 依赖（依赖 pnpm-workspace.yaml 的 allowBuilds）
pnpm dev                            # http://localhost:4321/paper4qi/
pnpm build                          # 需先有 public/data/，否则 index/stats 页构建失败
pnpm preview                        # 预览构建产物
PYTHONIOENCODING=utf-8 python scripts/build_data.py     # 或 pnpm data
PYTHONIOENCODING=utf-8 python scripts/update_data.py    # 周更（会写 data_src/）
python scripts/reconcile_qce26.py --dry-run             # 预览日程→DOI 匹配
python -m py_compile scripts/*.py                       # 脚本语法自检
```

Windows 下所有 Python 命令都要带 `PYTHONIOENCODING=utf-8`（控制台默认 GBK 会 `UnicodeEncodeError`）。

## 5. 改动后验证清单

1. `python -m py_compile scripts/*.py` 与 `PYTHONIOENCODING=utf-8 python scripts/build_data.py` 无异常，数量漂移警告可接受。
2. `pnpm build` 通过（TypeScript strict 无报错）。
3. `/paper4qi/`、`/paper4qi/qce/`、`/paper4qi/tqe/`、`/paper4qi/stats/`、`/paper4qi/about/` 均无 404；搜一个关键词确认高亮与筛选 chip 生效。
4. 亮 / 暗两主题各目视一次（`ThemeToggle` 或 `localStorage['p4q-theme']`）。
5. 改动数据 schema 时，同步 `src/scripts/types.ts`、`paper-browser.ts` 的 CSV 表头、`about.astro` 的口径说明。

## 6. 数据 Schema

**`Paper`（`${BASE_URL}data/{qce,tqe}.json` 的 `papers[]`，定义见 `src/scripts/types.ts`）**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 全局唯一，`qce:<doi>` / `qce26:{TRACK}-{row}` / `tqe:<doi>` |
| `source` | `'qce' \| 'qce26' \| 'tqe'` | 记录来源，渲染徽标/会话信息时据此分支 |
| `source_id` | string | 来源库内 id（DOI 或日程行号） |
| `year` | number | 2020–2026；TQE 用 `year_norm`（Vol.1 = 2020） |
| `title` / `authors[]` / `venue` / `pages` | string / string[] / string / string? | 元数据 |
| `doi` / `arxiv` / `abstract` | string? | 链接优先级 DOI > arXiv |
| `zh` | string | 中文创新点说明；缺省为「【待补充】」 |
| `category` | string | 13 类 key 之一（见 `meta.ts`） |
| `tags[]` | string[] | 会议主题标签 / 期刊关键词（最多展示 5 个） |
| `cited_by` | number? | 仅 TQE 有，OpenAlex 周更刷新 |
| `front_matter` | boolean | 封面/索引等前置页，默认隐藏、可开关 |
| `track` / `session` / `day` / `time` / `best` | string? | **仅 `qce26`** 条目存在 |

顶层结构：`{ source, generated, count, papers[] }`。

**`stats.json`**

| 字段 | 说明 |
| --- | --- |
| `generated` | 构建时间（ISO，统计页 kicker 直接切片展示） |
| `years` | `[2020..2026]` |
| `cats` | 13 类 key 数组（顺序 = `CAT_ORDER`） |
| `totals` | `{ qce, qce26, tqe, front, all }`，不含前置页（`front` 单列） |
| `matrix` | `{ qce, tqe, combined } → { "年": { 类别: 数量 } }`，不含前置页 |
| `growth` | `[{ year, qce, tqe }]`，折线图数据 |
| `topCited` | `[{ id, title, year, cited_by }]`，TQE 被引 Top 20 |
| `qce26Tracks` | `{ TRACK: 数量 }`，9 个 Track |
