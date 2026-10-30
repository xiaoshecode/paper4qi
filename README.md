# paper4qi · Paper for Quantum Infra

[在线维护文档](https://xiaoshecode.github.io/xiaoshecode/repos/paper4qi/) · [2026-10-30 检查记录](docs/maintenance-2026-10-30.md)

[![在线访问](https://img.shields.io/badge/online-xiaoshecode.github.io%2Fpaper4qi-4f46e5?style=flat-square)](https://xiaoshecode.github.io/paper4qi/)

量子计算与工程文献库：当前仓库快照汇总 **IEEE QCE 会议（2020–2026）** 与 **IEEE TQE 期刊（2020–2026, Vol. 1–7）** 的 **2338 条**研究条目（另有 173 条封面/索引等前置页），统一为 13 类研究方向，提供已有的中文说明与英文摘要，支持检索/筛选/CSV 导出，亮暗双主题，每周自动增量更新。条目包含会议日程记录，部分字段缺失；该库是选定来源集合，不是完整量子领域文献检索。

- 在线站点：<https://xiaoshecode.github.io/paper4qi/>
- 私有资料站：<https://paper4qi-library.xiaoshe111.chatgpt.site/>（独立发布快照）
- 机器可读入口：[Agent 数据说明](https://xiaoshecode.github.io/paper4qi/agents/) → [数据清单](https://xiaoshecode.github.io/paper4qi/data/manifest.json)。已发布快照的数量、文件校验值与更新管线运行日期以该清单为准；构建时间和管线运行日期不代表逐条来源重新核验，日程条目不等同于已发表论文。

## Agent 调研与资料空间

研究地图 `/research/` 将原始资料、研究问题与库内线索按子主题组织，覆盖软件与架构、测控与纠错、硬件平台与网络等选定方向。策展定义位于 `data_src/research/*.json`，`build_data.py` 调用 `build_research_data.py` 生成可复现的多标签关联索引 `research-map.json`；`get_research_map` MCP 工具读取主题，`search_papers` 的 `subtopic` 参数继续筛选。匹配只基于英文标题、摘要、标签，保留命中词与规则分数；中文 AI 辅助说明不参与归类，命中是未经逐篇审阅的线索，主题数量不可直接相加。

来源核查记录保留在 `docs/research-*-sources.md`。本轮核对的是题名、元数据及可取得的摘要或相关正文，并非逐篇全文审读、实验复现或穷尽检索。“研究空白”与下一步建议是编辑综合提出的问题，不是对研究新颖性或尚无相关工作的证明。

`public/llms.txt` 提供发现入口；原有 `qce.json` / `tqe.json` 字段保持兼容。主要资源均位于站点的 `data/` 路径：

| 资源 | 用途与生成阶段 |
| --- | --- |
| `manifest.json` | 资源目录、快照数量、来源与时间语义；Python 阶段的 `resources` 带 SHA-256 |
| `papers.json`、`qce.json`、`tqe.json`、`stats.json` | 合并文献库、分来源数据与统计；Python 构建生成 |
| `paper.schema.json`、`categories.json` | 单条 `Paper` 的 JSON Schema 2020-12 与 13 类分类表 |
| `quality.json`、`id-redirects.json` | 字段覆盖与限制、日程 ID 到论文集 DOI 记录的替换映射 |
| `research-map.json` | 策展主题、原始来源、研究问题及关联文献 ID；Python 构建生成 |
| `guides.json` | 从网页同一来源导出的 CS4Q、期刊会议和 OpenQASM 内容；Astro 构建生成 |

manifest 中的资源 URL 相对于 **manifest URL** 解析，以兼容 `/paper4qi/` 与域名根路径。`guides.json` 列在 manifest 的 `guides`，不在 Python 阶段带哈希的 `resources`；其中 `declared_source_review_date` 只转录原有策展核验日期，导出不代表重新核验。完整协议与检索示例见 [docs/agent-access.md](docs/agent-access.md)。

资料空间的私有站点使用同一套 Astro 页面和数据快照，附带 `POST /mcp` 的 **6 个只读工具**：`search_papers`、`get_paper`、`get_library_overview`、`get_research_statistics`、`get_research_map`、`read_research_guide`。最后一个工具支持 `openqasm`、`agents`、`cs4q`、`venues` 四种导读。Sites 负责身份验证和访问控制，其他 agent 需安装并授权站点插件后才能调用；GitHub Pages 提供静态 JSON。源站更新不会自动同步到 Sites，重新发布时使用下述同步流程。

1. 通过 Sites 工作流打开现有项目 `appgprj_6adffc3408608191a3ac6a3d3ccdcefc` 到 `.sites-work/`，保留其源码历史和私有访问范围。
2. 在主仓库完成数据生成与检查后，运行 `node scripts/sync-sites-source.mjs`。该脚本复制明确列出的源文件，保留目标 Git 与站点 ID，启用 MCP；不发布、不处理凭据。
3. 在该 checkout 中构建：`astro build --base / --site https://paper4qi-library.xiaoshe111.chatgpt.site`，然后运行 `node scripts/build-site-worker.mjs`。它将同一构建的静态资源压缩嵌入 Worker，避免数据接口与网页版本不一致。
4. 用 `node scripts/test-site-worker.mjs dist/server/index.js` 验证实际产物，再按 Sites 的源码同步、打包与私有发布工作流保存并部署。凭据只经 stdin 传入工具，不写入仓库。

GitHub 部署前依次运行 `python scripts/build_data.py`、`python scripts/test_research_data.py`、`python scripts/validate_agent_data.py`、`node scripts/test-site-worker.mjs`、`pnpm build`、`python scripts/validate_agent_data.py --site-dir dist`。最后一步也检查 Astro 导出的策展数据与文献快照一致。`astro build` 是构建检查，不等同于完整 TypeScript 类型检查。

## 功能特性

- **OpenQASM 专题**：`/openqasm/`，涵盖 2/3/3.1 规范、时序与 OpenPulse、7 类平台/工具支持、13 篇代表文献及 Bell 接入建议。正文源为 `src/content/openqasm-research.md`（由专题页面直接引用），2026-10-27 人工核查，不属于周更数据管线的自动核验范围。
- **研究地图**：`/research/` 与子主题页组织策展来源、待研究问题和可追溯的关键词匹配；提供 `research-map.json` 与 MCP 查询，方便 agent 继续筛选和读取原文。

- **统一 schema**：QCE 论文集（DOI 口径）、QCE26 官方日程（Track/Session 口径）、TQE 期刊三来源归一为同一 `Paper` 结构，前端只需一套渲染逻辑（`src/scripts/types.ts`）。
- **检索**：空格分词 AND 语义，匹配标题 / 作者 / 中文说明 / 摘要 / DOI / arXiv / 标签 / 会议名；命中处 `<mark>` 高亮，`/` 聚焦搜索框、`Esc` 清空。
- **筛选**：年份 × 13 类方向 chips 可任意叠加，chip 上实时显示计数；「只看论文」开关可显示封面、版权页、索引等前置页。
- **CSV 导出**：导出当前筛选结果为 22 列 CSV（含中文说明与摘要），带 UTF-8 BOM，Excel 直接可读。
- **URL hash 分享**：筛选状态写入地址栏 `#q=ldpc&y=2024,2025&c=QEC,ALG&fm=0`，复制链接即还原视图。
- **暗色模式**：`auto / light / dark` 三态，跟随 `prefers-color-scheme`，首屏内联脚本注入主题避免闪烁。
- **统计页**：年 × 类堆叠柱状图、两源逐年论文数折线、TQE 被引 Top 20（OpenAlex）、QCE26 Track 分布，图表为纯 SVG 组件，无图表库。
- **周更管线**：Crossref 增量抓取 + OpenAlex 补摘要/被引 + arXiv 标题匹配；单个数据源失败只发 warning，保留旧数据、任务不红。
- **QCE26 日程过渡**：导入论文集后按标题（精确 + Jaccard 模糊）匹配，用 DOI 记录替换日程记录，避免双计；ID 替换关系见 `data/id-redirects.json`，当前流程不会自动把 Track / Session / 奖项字段迁移到 DOI 条目。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 站点框架 | Astro 5（`output: 'static'`，构建期 SSG） |
| 语言 | TypeScript（`astro/tsconfigs/strict`，`tsconfig.json` 继承） |
| 交互 | 零 UI 框架；vanilla TS（`src/scripts/paper-browser.ts`、`highlight.ts`）+ 纯 SVG 组件 |
| 样式 | 唯一来源 `src/styles/global.css`，CSS 变量双主题，无预处理器、无 Tailwind |
| 数据管线 | Python 纯标准库（`urllib`），不依赖第三方包，Windows 裸解释器与 Actions 均可运行 |

## 快速开始

### 前置要求

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 20（建议 24） | CI 使用 24 |
| pnpm | ≥ 10（建议 11） | CI 使用 11；`pnpm-lock.yaml` 已锁定 |
| Python | ≥ 3.10（建议 3.13） | CI 使用 3.13；仅需标准库 |

### 本地运行

```bash
git clone https://github.com/xiaoshecode/paper4qi.git
cd paper4qi
pnpm install --frozen-lockfile

# 1) 生成数据（public/data/*.json，已被 .gitignore 忽略）
PYTHONIOENCODING=utf-8 python scripts/build_data.py   # 等价于 pnpm data

# 2) 开发服务器：http://localhost:4321/paper4qi/
pnpm dev

# 3) 生产构建 + 本地预览（同样在 4321，注意 URL 必须带 /paper4qi/）
pnpm build && pnpm preview
```

### 常见坑点

1. **必须先跑 `build_data.py`**：`public/data/` 不进版本库，而 `src/pages/index.astro` 与 `stats.astro` 在构建期直接 `readFileSync('public/data/stats.json')` —— 数据缺失时 `pnpm build` 会直接失败，不是页面空白。
2. **pnpm 11 的构建脚本白名单**：`pnpm-workspace.yaml` 中的 `allowBuilds: {esbuild: true, sharp: true}` 是必需的，否则 esbuild/sharp 的 postinstall 不执行，`pnpm build` 报二进制缺失。升级 pnpm 后如遇 `Ignored build scripts` 提示，检查该文件。
3. **Windows 控制台编码**：GBK 环境下 Python 打印非 ASCII 会抛 `UnicodeEncodeError`，所有 Python 命令前置 `PYTHONIOENCODING=utf-8`（脚本内部也有 `sys.stdout.reconfigure` 兜底）。
4. **`base` 是 `/paper4qi`**：本地必须访问 `http://localhost:4321/paper4qi/`；所有站内链接/资源在源码中都经 `import.meta.env.BASE_URL` 拼接，新增页面时不要漏。

## 目录结构

```
paper4qi/
├─ astro.config.mjs        site / base=/paper4qi / trailingSlash: always
├─ pnpm-workspace.yaml     allowBuilds（esbuild、sharp 的 postinstall 白名单）
├─ data_src/               构建所用源数据快照（随 git 提交，科学结论仍须核对原文）
│  ├─ qce/                 QCE 2020–2025 论文集：data_20xx.json + zh2_20xx.json
│  │                       （中文说明，按 1-based 序号）+ abs_20xx.json + cats.json
│  │                       （主题标签）；replaced_qce26.json 由 reconcile 生成
│  ├─ qce26/               QCE26 官方日程 papers_data.py（372 条，9 Track）
│  │                       + arxiv_matches.json（arXiv 标题匹配与摘要）
│  ├─ tqe/                 TQE 期刊：tqe_merged.json（465 条，已分类）
│  │                       + zh_20xx.json（中文说明，按全局序号）
│  ├─ overrides/           zh_new.json：中文说明覆盖层（对三来源统一生效）
│  ├─ research/            软件、测控纠错、硬件网络等研究领域与子主题策展定义
│  └─ .update_state.json   周更状态：各源管线记录的上次运行日期（非逐条核验日期）
├─ scripts/                Python 数据管线（纯标准库）与 Node Sites 工具
│  ├─ build_data.py        data_src → public/data/（原有数据 + Agent 导出，本地与 CI 共用）
│  ├─ build_agent_data.py  合并库、单条 schema、质量报告、ID 替换、manifest 与校验值
│  ├─ build_research_data.py    子主题定义 → research-map.json，多标签关联不改原有 category
│  ├─ validate_agent_data.py   校验导出契约；--site-dir dist 同时检查 Astro 导读导出
│  ├─ test_research_data.py / test-site-worker.mjs    匹配规则与只读 MCP 行为检查
│  ├─ sync-sites-source.mjs / build-site-worker.mjs  同步 Sites 源码与打包 Worker
│  ├─ update_data.py       每周增量：TQE 按 ISSN diff DOI、OpenAlex 补摘要/被引、QCE 新年度探测
│  ├─ reconcile_qce26.py   日程 ↔ 论文集标题匹配，写 replaced_qce26.json
│  ├─ lib_taxonomy.py      13 类分类法（关键词表、FORCE 规则、QCE 标签映射、QCE26 Track 映射）
│  └─ lib_fetch.py         HTTP 封装（UA、指数退避、Crossref/OpenAlex 游标分页、arXiv 限速）
├─ public/data/            构建产物（gitignored，由 build_data.py 生成）
├─ public/llms.txt         Agent 发现入口（随源码维护）
├─ docs/                   agent-access.md 与 research-*-sources.md 核查记录
├─ sites/worker.mjs        静态资源服务与 6 个只读 MCP 工具
├─ src/
│  ├─ data/meta.ts         站点常量：SITE、CATEGORIES（13 类）、SOURCES
│  ├─ data/cs4q.ts         CS4Q 导读数据（33 条，手工策展，不在周更范围）
│  ├─ data/venues.ts       期刊会议投稿指南数据（49 刊 + 27 会 + CFP 截止日期，
│  │                       2026-10-08 手工核验，不在周更范围）
│  ├─ layouts/BaseLayout.astro    HTML 骨架、主题首屏脚本、页脚
│  ├─ components/          SiteHeader（导航）/ PaperBrowser（浏览器壳）/
│  │                       CategoryBar / StackedBars / LineChart / Timeline / ThemeToggle
│  ├─ pages/               index（总览）、qce、tqe、cs4q（导读）、venues（投稿指南）、
│  │                       research（研究地图与子主题）、openqasm、agents、stats、about
│  ├─ pages/data/guides.json.ts   构建期导出 CS4Q、投稿指南和 OpenQASM
│  ├─ scripts/             paper-browser.ts（检索/筛选/渲染/CSV/hash）、highlight.ts、types.ts
│  ├─ styles/global.css    唯一样式来源（CSS 变量双主题）
│  └─ content/             openqasm-research.md（网页引用）；trajectory-{qce,tqe}.md（文案参考）
└─ .github/workflows/      deploy.yml（push main / workflow_dispatch）+ update.yml（每周更新并显式派发部署）
```

## 数据管线

### build_data.py（`data_src/` → `public/data/`）

```bash
PYTHONIOENCODING=utf-8 python scripts/build_data.py
```

处理顺序与输出：

1. **QCE 2020–2025**：逐年读取 `data_20xx.json`（`{d,t,a[],p}`）与按序号对齐的 `zh2_20xx.json`、`abs_20xx.json`，用 `cats.json` 标签 + 关键词回退打分得到 13 类之一，产出 `qce:` 前缀条目（1674 条 → 1523 论文 + 151 前置页）。
2. **QCE 2026**：动态 import `qce26/papers_data.py`，按 9 个 Track 展开 372 条日程记录，叠加 arXiv 标题匹配的摘要与预印本号，中文说明自动生成为「QCE26 官方日程 · {Track 中文}（{Session}）」，产出 `qce26:` 前缀条目；引用前仍需核对原始日程及对应预印本版本。
3. **TQE 2020–2026**：读 `tqe_merged.json` 与 `zh_20*.json`，`FRONT` 类（封面/索引）归入 `OTHER` 并置 `front_matter: true`，按 年 → 类优先级 → 文章号 → 标题 排序。
4. **中文覆盖层**：最后应用 `overrides/zh_new.json`（`{"paper_id": "中文说明"}`）；未命中的 id 只打印提示，不报错。
5. **原有输出**：`public/data/qce.json`、`tqe.json`、`stats.json`（年 × 类矩阵、两源逐年增长、被引 Top 20、QCE26 Track 分布、总计），同时打印年×类矩阵与分类分布报告；数量随源快照变化。
6. **Agent 与研究地图输出**：调用 `build_agent_data.py` 和 `build_research_data.py`，生成合并库 `papers.json`、`paper.schema.json`、`categories.json`、`quality.json`、`id-redirects.json`、`research-map.json` 及 `manifest.json`。manifest 哈希覆盖该次 Python 构建的 9 个资源；随后 Astro 构建另行生成 `dist/data/guides.json`，使用同一文献快照的 `generated` 时间。

**断言基线**：脚本顶部 `EXPECT` 记录了初次导入时的数量基线。数量漂移（新增论文、新年度）**只 warn 不 fail** —— 周更会持续追加论文，硬失败会卡死部署管线；请不要改回 `raise`。真正会 `raise` 的是数据一致性问题：QCE 记录数与中文说明数不匹配、DOI 为空或重复、TQE DOI 重复或缺失、QCE26 Track 集合变化、中文说明 key 重复。

### update_data.py（每周增量，`data_src/` 原地更新）

```bash
PYTHONIOENCODING=utf-8 python scripts/update_data.py
```

- **TQE**：按 ISSN `2689-1808` + `from-pub-date`（上次运行日 − 2 天，默认回溯 14 天）从 Crossref 拉取新 DOI，与 `tqe_merged.json` 现有 DOI 求差集，逐条用 OpenAlex 补摘要/被引/关键词后追加；随后做一次 OpenAlex 源全量爬取（source `S4210182817`）刷新所有记录的 `cited_by`（同一 DOI 多条记录取最大值）。非 `10.1109/tqe.` 前缀的 DOI 会被跳过并 warning。
- **QCE 新年度探测**：用 `container-title:<年> IEEE International Conference on Quantum Computing and Engineering (QCE)` 过滤 Crossref，记录数 ≥ 50 才认定该年度已出版，写出 `data_{Y}.json` + `zh2_{Y}.json`（占位「待补充」，**不能以「【」开头**）+ 空 `abs_{Y}.json`。
- **QCE26 reconcile**：调用 `reconcile_qce26.reconcile()`，幂等；论文集未出版时不做任何事。
- **容错设计**：每个数据源包裹在独立 try/except 中，失败发 `::warning::` 并以退出码 0 结束；所有写入走临时文件 + `os.replace` 原子替换；刷新窗口与上次运行重叠 2 天，避免漏抓边界 DOI。

### reconcile_qce26.py（日程 → DOI 替换）

```bash
python scripts/reconcile_qce26.py --dry-run        # 预览匹配结果，不写盘
python scripts/reconcile_qce26.py --year 2026
```

标题归一化（HTML 反转义、小写、去标点）后先做精确匹配，再做 token Jaccard ≥ 0.9 的模糊匹配；arXiv 标题作为别名参与匹配（已发表标题可能与日程 PDF 有出入）。产出 `data_src/qce/replaced_qce26.json` = `{"{TRACK}-{row}": "<doi>"}`，`build_data.py` 读取后丢弃已匹配的日程条目，减少重复计数；标题规则仍可能漏配或错配，不构成逐篇人工核验。

## 部署

- 推送到 `main` 或显式 `workflow_dispatch` 触发 `.github/workflows/deploy.yml`，三个 job 串行：

  1. **data**：Python 3.13 跑 `build_data.py`，执行 `test_research_data.py` 与 `validate_agent_data.py`，再校验原有数据存在且非空，上传整个 `public/data/` 为 `site-data` artifact。
  2. **build**：Node 24 + pnpm 11 安装锁定依赖并执行 `test-site-worker.mjs`，下载数据 artifact 到 `public/data/`，运行 `pnpm build`。随后用 Python 3.13 执行 `validate_agent_data.py --site-dir dist`，检查发布数据与策展导出；确认总览、Agent 说明页和文献数据存在后上传 Pages artifact。
  3. **deploy**：`actions/deploy-pages` 发布到 GitHub Pages。

- 站点地址：<https://xiaoshecode.github.io/paper4qi/>；Pages 的 Source 已设为 **GitHub Actions（workflow 模式）**，不是 `gh-pages` 分支。换仓库/首次开通时执行：

  ```bash
  gh api repos/xiaoshecode/paper4qi/pages -X POST -f build_type=workflow
  ```

- `concurrency: pages` 且 `cancel-in-progress: true`：连续 push 只保留最后一次部署。

## 自动更新

`.github/workflows/update.yml`：**每周一 03:14 UTC** cron + 支持手动 `Run workflow`。

1. Python 3.13 执行 `update_data.py`（`timeout-minutes: 25`，`PYTHONIOENCODING=utf-8`）。
2. 若 `data_src/` 有变更，以 `github-actions[bot]` 身份提交 `data: weekly update <日期>` 并 push；无变更则结束，不产生空提交。
3. push 成功后，使用 `gh workflow run deploy.yml --repo "$GITHUB_REPOSITORY" --ref main` 显式派发 `workflow_dispatch` 重新构建站点。更新工作流具备 `contents: write` 和 `actions: write`，且仅在 `main` 上运行。`GITHUB_TOKEN` 发出的 push 不会触发另一个 push 工作流；`workflow_dispatch` 是允许的例外，详见 [GitHub 官方说明](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)。

**新论文的中文说明补全流程**：自动抓取的新条目可能含「待补充」占位说明，在 `data_src/overrides/zh_new.json` 中按 `{"论文id": "中文说明"}` 补写（论文 id 形如 `tqe:10.1109/tqe.2026.xxxxxxx`，可从 CSV 导出的 `id` 列直接取），提交后下次构建自动覆盖；id 未命中只打印提示，不会中断构建。

## 贡献指南

- **加数据源**：在 `scripts/lib_taxonomy.py` 补分类关键词/映射，在 `build_data.py` 加一段读取 + `paper(...)` 组装 + 统计并入（`stats.json` 的 `matrix` / `growth` / `totals`），必要时在 `lib_fetch.py` 加取数函数。
- **加/改分类**：改 `lib_taxonomy.py` 的 `CAT_ORDER` / `CATS` / `CAT_NAMES`，同时改 `src/data/meta.ts` 的 `CATEGORIES`（顺序必须与 `CAT_ORDER` 一致）与 `src/styles/global.css` 的 `--c-{KEY}`（亮暗两套），否则 chips 与图例会掉色。
- **加/改研究子主题**：编辑 `data_src/research/*.json`，记录原始来源、核查范围、问题与匹配关键词，并在 `docs/research-*-sources.md` 留下来源说明。重新运行数据构建、匹配测试和契约校验，抽查关联条目；不要把自动命中或编辑研究判断写成已核实的论文结论。
- **加页面**：在 `src/pages/` 新建 `.astro`，用 `BaseLayout` 包裹，并在 `src/components/SiteHeader.astro` 的 `links` 中登记导航（注意 `import.meta.env.BASE_URL` 前缀）。
- **改主题色/间距**：只改 `src/styles/global.css` 的 CSS 变量（`--bg/--surface/--ink/--muted/--line/--accent/--c-*`），亮暗两套都要改；组件里不要写死色值。
- **提交前自检**：数据构建 → `python scripts/test_research_data.py` → `python scripts/validate_agent_data.py` → `node scripts/test-site-worker.mjs` → `pnpm build` → `python scripts/validate_agent_data.py --site-dir dist` → 亮/暗两主题目视确认关键页面无 404。Windows Python 命令先设置 `$env:PYTHONIOENCODING='utf-8'`。
