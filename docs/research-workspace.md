# 研究工作台：来源追踪、Wiki 与 DeepSeek

本功能保持 GitHub Pages 的静态部署，不把 API Key 放进浏览器，也不把公开站点变成匿名可写服务。

- `/workspace/`：已发布快照的只读浏览，包括论文、Wiki 版本历史与分析草稿。
- 本地工作台：在同一地址下提供认证 API，支持编辑来源、增量抓取、Wiki 保存/恢复和 DeepSeek 分析。
- Git 是发布边界：本地保存不自动 commit、push 或 deploy。`main` 的原有部署工作流仍然存在。
- 本实现没有启用新的 GitHub 定时任务，没有自动调用收费模型，也没有改变原有 QCE/TQE 周更。

## 启动

依赖 Python ≥ 3.10、Node ≥ 20 与项目规定的 pnpm。Python 部分只用标准库。

```bash
pnpm install --frozen-lockfile
pnpm data
pnpm build
pnpm workspace
```

打开终端提供的 `http://127.0.0.1:8765/paper4qi/workspace/`，将终端的临时会话令牌输入“本地会话令牌”。它不是 DeepSeek API Key，仅存在于服务器内存和当前页面内存，刷新页面需重新输入，服务器重启会更换令牌。

端口可通过 `python scripts/serve_workspace.py --port 8766` 改变。根路径构建使用 `astro build --base /`，对应服务器参数 `--base /`。服务器固定绑定 `127.0.0.1`，不是公网/团队协作后端。不要通过反向代理把它暴露到公网。

### 配置 DeepSeek

若密钥曾被发到聊天、日志或公开文件，先在 DeepSeek 控制台撤销，再生成新密钥。**不要复用暴露过的密钥。**

由操作系统、密码管理工具或部署平台将新密钥注入服务器进程的 `DEEPSEEK_API_KEY` 环境变量。`.env.example` 只是变量说明；服务不会自动加载 `.env`。`.env*`（除示例）已经被 Git 忽略，但这不代表可以随意在磁盘保存秘密。

可选变量：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 无 | 服务端运行时密钥；不配置仍可抓取与编辑 Wiki |
| `DEEPSEEK_MODEL` | `deepseek-flash` | 可用模型名称以账户和 DeepSeek 当前官方文档为准 |
| `PAPER4QI_MAX_AI_REQUESTS` | `20` | 每次服务器会话的 AI 请求上限，0 禁用，最高 100；缓存命中与失败也计入 |

服务只向 `https://api.deepseek.com/chat/completions` 发请求，禁止重定向携带凭据。浏览器没有模型密钥输入框，也不支持自定义代理 URL。该功能不支持绕过服务商地区/账户访问限制。

点击“发送标题与摘要给 DeepSeek，生成草稿”才发送当前已保存论文的标题和可用摘要。未保存的正文、修订历史和其他论文不会一起发送。若标题被编辑过，发送的是已保存的编辑后标题；请勿把私人资料填入公开研究记录。

DeepSeek 按 token 收费。每次最多 18,000 输入字符、1,800 输出 token，默认超时 30 秒，只进行一次付费请求，避免超时后自动重试造成重复计费。服务限制 6 次/分钟，并设置上述会话总次数上限。**次数/token 限制不等于金额上限**，请同时在服务商账户设置适当预算和余额限制。缓存由输入内容与模型确定；手动重复请求不会自动再次计费，但仍消耗本地请求额度。

## 关注来源和自动追踪

默认关注仓库已有的 IEEE TQE（ISSN `2689-1808`）和 IEEE QCE。可在工作台新增/修改来源，也可在首次启动前编辑 `data_src/followed_venues.json`。

```json
{
  "id": "quantum-journal",
  "name": "Quantum",
  "kind": "journal",
  "issn": "2521-327X",
  "enabled": true,
  "keywords": ["compiler", "error correction"]
}
```

会议使用 `kind: "conference"` 和 `container_title`，先核对 Crossref 的实际会议出版物名称。只用一个准确名称，不能使用自由搜索词来冒充来源标识。默认 QCE 已知系列在服务端以多个精确 container-title 的 OR 条件检索：无年份名称，以及 2020 年至检查窗口年份下一年的年度名称；随后仍严格核对来源。其他会议只查询配置的精确名称，需要年度名称或不同 proceedings 系列时请分别添加来源。改名、workshop、未提交 Crossref 的论文集以及范围之外的卷不保证覆盖。

抓取规则：

1. Crossref 公开元数据 API，期刊按 ISSN、会议按检索后严格核对的 container-title；区分 journal-article 与 proceedings-article。
2. 初次检查最近 30 天的 **indexed 日期**，后续完成窗口重叠两天。indexed 是元数据索引时间，不是论文发表日期。
3. 发表日期另存为 `published` 和 `published_precision`。只有年份/月的记录补齐日期用于排序，但精度字段保留原始含义。
4. 必须匹配量子计算/基础设施关键词；配置的 `keywords` 再进行 OR 筛选。规则筛选可能漏掉无摘要且题名不含相关词的论文，不是完整领域检索。
5. DOI 规范化去重。已有 QCE/TQE DOI 不再进入发现列表；原有来源更新仍由现有 `update_data.py` 负责。新来源记录保存在独立研究收件箱，不改变历史主库统计口径。
6. 交互抓取每来源通常最多 100 条原始记录。达到上限会保存日期窗口和临时游标，四分钟内可续传。Crossref 游标会过期，之后自动改为重扫更小的日期窗口，仍以 DOI 去重；单日密集数据按需扩大有界批量，最高 10,000 条。只有完整成功的子窗口推进检查点，未完成日期保留待抓队列。失败保留旧数据与检查点；结果区明确显示失败/部分完成。
7. Crossref 的 429/503 最多尝试三次，最多等待 30 秒的 Retry-After；其他失败不隐瞒成“检查完成”。不下载/镜像全文 PDF。

手动完成一个有界抓取任务：

```bash
pnpm research:refresh
# 首次回溯 90 天，每来源每次最多 5000 条；不调用 AI
python scripts/refresh_workspace.py --lookback 90 --max-items 5000
```

可显式启动本地自动追踪，每 24 小时执行一次；程序退出后停止，不安装系统任务：

```bash
python scripts/refresh_workspace.py --every-hours 24
```

这些命令只抓元数据，不请求 DeepSeek、不发布结果。部分/失败的一次性任务返回退出码 1，可再次运行续传。递归运行期间如遇来源错误会在下一周期重试。单写者锁防止两个进程覆盖同一文件；CLI 与编辑服务器不可同时写入。若需要系统级无人值守调度，另行配置可信调度器并安排在编辑服务器停止时执行。本实现没有替用户启用任何外部自动化。

Crossref 不保证涵盖所有会议/期刊；元数据重建、延迟、游标失效均可能影响检索。游标失效会在后续抓取中恢复，不会错误推进检查点；单一日期超过 10,000 条仍可能需要在短时间内反复抓取以完成游标续传，结果始终标为未完成，不能当作完整覆盖。可修改来源配置以重置其窗口。

## Wiki 编辑和人工采纳

- 选择原有论文或发现记录，编辑标题、中文摘要、13 类方向、标签与 Markdown 正文。
- 每次保存必须附修改说明，生成递增版本。历史快照不可被“恢复”覆盖，恢复会追加一个新版本。
- 保存时携带读取时的版本号。其他页面已更新时返回 409，保留本地草稿，用户核对合并后再保存。
- DeepSeek 输出严格校验分类、字段、中文摘要、数组长度、置信度及依据范围。无摘要时清空“贡献”并明确标为仅题名解读；生成内容不能视为论文结论已核实。
- AI 草稿独立保存，不直接覆盖 Wiki。先“载入编辑器”，再核对并保存新版本。论文题名/摘要等分析输入变化后旧草稿不再提供采纳或导出，需重新生成。
- AI 置信度是模型自评，不是校准后的正确概率。摘要解读不等于全文审读、复现或研究新颖性判断。
- Markdown 采用安全纯文本预览，不渲染嵌入 HTML。
- 标题/分类/摘要/标签的已保存修订在下次 `pnpm data` 时覆盖原有主库展示；正文和历史在 `/workspace/` 阅读。DOI、来源、原始摘要和原始源文件不被 Wiki 改写。

**公开内容提醒：** `data_src/workspace.json` 是可提交数据，包含编辑正文、所有修订历史和 AI 草稿。构建会将这些导出到 `public/data/workspace.json`，公开部署后任何人都可以读取。不要输入密码、私人笔记或不适合公开的内容；删除当前正文不能删除旧修订中的文本，发布前必须审查完整 diff。出版商摘要和许可保留来源，不能据此假定拥有全文再分发权。

## 数据与 API

- `data_src/followed_venues.json`：初始关注配置。
- `data_src/workspace.json`：原子写入的发现记录、覆盖配置、检查点、分页状态、Wiki 历史与 AI 草稿。首次变更时创建。
- `.workspace.lock`：仅用于单写者锁，不提交；进程退出自动释放，不需删除锁文件。
- `public/data/workspace.json`：构建期公开导出，不含运行时凭据和检查点。和主库 `papers.json` 一起供工作台读取。

API 基路径为 `${BASE_URL}api/`。`GET status` 只显示服务就绪/模型配置；其他端点需要 `Authorization: Bearer <临时会话令牌>`，修改请求需 `Content-Type: application/json`。

| 方法 | 路径 | 功能 |
| --- | --- | --- |
| GET | `papers` | 原有主库与发现记录 |
| GET / PUT | `venues` | 关注来源；PUT 要求 `expected_revision` |
| POST | `refresh` | 有界元数据刷新；空 JSON 对象 |
| GET | `article?id=...` | 论文、Wiki 版本与 AI 草稿 |
| PUT | `article` | `id`, `expected_revision`, `summary`, `content` |
| POST | `restore` | `id`, `expected_revision`, `revision`, `summary` |
| POST | `analyze` | `id`；发送标题/摘要给 DeepSeek |

错误码：400 输入错误，401 缺认证，403 非本机/跨域请求，409 版本冲突/任务占用，429 请求限额，502 上游失败，503 缺模型配置。服务拒绝跨域 Origin、异常 Host、跨站请求和大于 64 KiB 的输入；不记录认证、请求 URL、正文或上游错误原文。断线后先读取状态，不盲目重复修改或付费请求。

## 验证与发布

```bash
python -m compileall -q scripts
pnpm test
pnpm data
python scripts/validate_agent_data.py
pnpm build
python scripts/validate_agent_data.py --site-dir dist
```

测试使用临时目录、模拟 Crossref/DeepSeek，不需要密钥或网络。覆盖权限、Origin/Host、路径穿越、版本冲突/恢复、原子写失败、去重、分页续传、来源失败保留检查点、AI 缓存/竞态及输入验证。浏览器端还应检查移动布局、暗色、连接/断开、切换论文时未保存草稿、409 冲突与中断后重载。

发布前审核 `git diff`，重新生成数据与构建。GitHub Pages/Sites 仍为只读，不会运行 Python 后端。若将来需要在线多人编辑，需要独立持久化后端、正式身份验证、用户权限、审计、限额与备份，不能直接公开此本地开发服务。

## 官方资料

- [DeepSeek API 与模型](https://api-docs.deepseek.com/)
- [DeepSeek JSON 输出](https://api-docs.deepseek.com/guides/json_mode/)
- [DeepSeek 计费](https://api-docs.deepseek.com/quick_start/pricing/)
- [Crossref API 访问与限额](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/)
- [Crossref 过滤器](https://www.crossref.org/documentation/retrieve-metadata/rest-api/rest-api-filters/)

接口与模型默认值核查于 2026-11-11；价格、模型和服务条款可能变化。
