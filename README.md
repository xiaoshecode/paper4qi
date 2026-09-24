# paper4qi · 量子计算文献库

汇总 **IEEE QCE 会议（2020–2026）** 与 **IEEE TQE 期刊（2020–2026, Vol. 1–7）** 共 2500+ 条出版记录的静态文献网站：可搜索、按 13 类研究方向分类、附中文创新点说明与英文摘要、双主题（亮/暗）、每周自动增量更新。

**在线访问：<https://xiaoshecode.github.io/paper4qi/>**

## 技术栈

Astro 5（静态生成）· TypeScript · 手写 CSS 变量双主题 · 零 UI 框架（搜索/图表为 vanilla TS + 纯 SVG）· Python 数据管线（纯标准库）。

## 目录结构

```
data_src/            源数据快照（唯一事实源，提交进 git）
  qce/               QCE 2020–2025：data/zh2/abs_20xx.json + cats.json
  qce26/             QCE26 官方日程 papers_data.py + arxiv_matches.json
  tqe/               TQE 465 条 tqe_merged.json + zh_*.json
  overrides/         zh_new.json：待补充中文说明的覆盖层
scripts/
  build_data.py      data_src → public/data/{qce,tqe,stats}.json（本地与 CI 共用）
  update_data.py     每周增量抓取（Crossref/OpenAlex）
  reconcile_qce26.py QCE26 论文集出版后按标题匹配替换日程记录
  lib_*.py           分类法 / 请求封装
public/data/         构建产物（gitignore，由 build_data.py 生成）
src/                 Astro 前端（layouts/components/pages/scripts/styles）
.github/workflows/   deploy.yml（push 部署 Pages）+ update.yml（每周数据更新）
```

## 本地开发

```bash
pnpm install
python scripts/build_data.py   # 生成 public/data/*.json
pnpm dev                       # http://localhost:4321/paper4qi/
pnpm build && pnpm preview     # 构建并预览
```

## 更新数据

- 自动：GitHub Actions 每周一 03:17 UTC（`update.yml`），也可手动 Run workflow。
- 手动（本地）：`python scripts/update_data.py`，再 `python scripts/build_data.py && pnpm build`。
- 新论文的中文说明：写入 `data_src/overrides/zh_new.json`（`{"论文id": "中文说明"}`），构建时自动覆盖「待补充」。

## 数据来源

- IEEE Xplore / Crossref（DOI 元数据）、OpenAlex（摘要/被引）、arXiv（QCE26 预印本匹配）
- QCE 2026 官方 Technical Papers Schedule（论文集出版后自动切换为 DOI 口径）
