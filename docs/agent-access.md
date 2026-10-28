# Agent 数据接入

入口：`<站点根路径>/llms.txt` → `data/manifest.json` → `data/papers.json`。
GitHub Pages 根路径是 `https://xiaoshecode.github.io/paper4qi/`；镜像可部署在域名根路径。所有 manifest 资源地址相对于 **manifest URL** 解析，例如 Python 的 `urllib.parse.urljoin(manifest_url, resource['url'])`。

## 文件与兼容性

| 文件 | 用途 |
| --- | --- |
| `manifest.json` | `schema_version`、资源目录、SHA-256、来源、覆盖、时间语义 |
| `papers.json` | 合并的 `{schema_version, source, generated, count, papers[]}` |
| `qce.json` / `tqe.json` | 原有浏览器数据，字段保持兼容 |
| `paper.schema.json` | **单条 Paper** 的 JSON Schema 2020-12 |
| `quality.json` | 按来源的字段覆盖和限制 |
| `categories.json` | 13 个分类 key 与中文标签 |
| `id-redirects.json` | `{old_id, new_id}` 日程记录替换关系 |
| `research-map.json` | 子主题、来源、研究问题与可复现的多标签文献关联 |
| `guides.json` | Astro 构建期从网页同一来源导出的 CS4Q、期刊会议和 OpenQASM；有独立的来源核验日期 |

1.x 版本只作兼容扩展；忽略未知字段并容忍可空字段。`id` 保持原来源 ID，不按标题重新生成。日程条目在论文集收录后可能由 DOI 记录替换，见 `id-redirects.json`。通过 manifest 的 SHA-256 判断内容是否变化；下载一份 corpus 后在本地检索，不要每条记录重复请求。

## 调研口径

- `source=qce`：已导入的会议论文集元数据。
- `source=tqe`：已导入的期刊元数据，年份按期刊卷号归一。
- `source=qce26`：会议日程快照；不表示已核实最终 DOI / 论文集出版。arXiv 是标题匹配线索，核对作者、题名、版本后引用。
- `front_matter=true`：封面、目录等，不计入研究论文统计。`stats.totals.all` 排除了前置页，但包含日程条目。
- `zh`：编辑 / AI 辅助中文说明或日程标签；`待补充` 是占位。分类是检索线索，不是人工逐条学术评审。
- `abstract`：摘要，不是全文。`null` 表示缺失，`cited_by=null` 不等于零引用。
- `best`：导入日程中保存的整数名次或 `null`，引用奖项结论前应核对官方来源。

先按来源、年份、类别缩小集合，再对 `title / abstract / tags / zh` 做关键词匹配。读取原文后才能给出研究结论。输出证据表保留 `id, source, title, authors, year, doi, arxiv` 与快照时间。将日程线索、预印本、论文集和期刊记录明确区分；该库是选定来源集合，不代表完整系统综述检索。

## 按子主题调研

先读取 `research-map.json` 的 `domains` 与 `topics`，选定 `topic.key`，再将 `matched_papers[].id` 与 `papers.json` 关联。匹配基于英文标题、摘要与标签；中文 AI 辅助说明不参与自动归类。每个匹配保留 `matched_terms` 和规则分数，分数不是相关性概率。多标签允许跨层归属，主题计数不可直接相加。

Sites 中可先调用 `get_research_map` 获取总览，再以 `topic` 参数读取专题；用 `search_papers` 的 `subtopic`、`source`、`year` 等参数继续筛选。精选来源、编辑研究假设与自动关联分别存储，不应混作同一证据等级。

## 时间与权限

`generated` / `freshness.build_generated_at` 是本次构建时间。`freshness.updater_last_completed_run` 读取 `data_src/.update_state.json`，仅代表更新管线记录的运行日期，不代表每条记录或每项上游请求已重新核验。逐条核验时间未知时使用 `null`，不使用文件修改时间推断。CS4Q、OpenQASM 和投稿指南是独立的策展网页，不因数据构建而自动更新。

GitHub Pages 数据通过静态 HTTP GET 下载。启用 MCP 的私有 Sites 版本可在此数据契约上提供 6 个只读工具：`search_papers`、`get_paper`、`get_library_overview`、`get_research_statistics`、`get_research_map` 与 `read_research_guide`。其他 agent 需先完成该站点插件的安装与授权；仅知道网站 URL 不等于已连接 MCP。私有镜像需要用户已有的访问权限，GitHub Pages 本身不提供上述工具。资料权限和来源版权保持各自规则；不要把仓库许可证解释为上游摘要的统一再授权。

`guides.json` 直接导出 `src/data/cs4q.ts` 和 `src/data/venues.ts` 的结构化数据，并嵌入 `src/content/openqasm-research.md` 原文。它在 Astro 阶段生成，故列在 manifest 的 `guides` 而非 Python 阶段带哈希的 `resources`。`declared_source_review_date` 仅转录既有来源中记录的核验日期，不是本次导出的重新验证结果。会议 `status` 是旧快照，不能当成当前是否开放投稿的结论。

## 构建与校验

```powershell
$env:PYTHONIOENCODING = 'utf-8'
python scripts/build_data.py
python scripts/validate_agent_data.py
pnpm build
python scripts/validate_agent_data.py --site-dir dist
```

`build_data.py` 调用 `build_agent_data.py`，只从 `data_src/` 生成 `public/data/`，保持现有数据源为事实源。导出文件是构建产物，不手改、不另建第二套文献数据。校验脚本验证组合数据、ID、真实字段类型、文件哈希和计数，不固定论文数量，允许每周新增。
