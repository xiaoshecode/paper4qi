# -*- coding: utf-8 -*-
"""Build refined searchable HTML + editable Markdown for IEEE QCE 2020–2026.
v3: abstract-based expanded innovation summaries (zh2_*.json) for 2020–2025,
    cleaner refined UI, QCE26 official schedule kept."""
import html
import json
import os
import re
import sys

BASE = "C:/work/paper/ISCAS2027/paperresearch/qce_data/"
OUT_HTML = "C:/work/paper/ISCAS2027/paperresearch/QCE_papers.html"
OUT_MD = "C:/work/paper/ISCAS2027/paperresearch/QCE_papers.md"
YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"]
META = {
    "2020": {"ord": "第 1 届", "loc": "线上举办（原定美国科罗拉多州丹佛）", "date": "2020 年 10 月 12–16 日"},
    "2021": {"ord": "第 2 届", "loc": "线上举办", "date": "2021 年 10 月 17–22 日"},
    "2022": {"ord": "第 3 届", "loc": "美国科罗拉多州布鲁姆菲尔德（Broomfield）", "date": "2022 年 9 月 18–23 日"},
    "2023": {"ord": "第 4 届", "loc": "美国华盛顿州贝尔维尤（Bellevue）", "date": "2023 年 9 月 17–22 日"},
    "2024": {"ord": "第 5 届", "loc": "加拿大蒙特利尔（Montreal）", "date": "2024 年 9 月 15–20 日"},
    "2025": {"ord": "第 6 届", "loc": "美国新墨西哥州阿尔伯克基（Albuquerque）", "date": "2025 年 8 月 31 日–9 月 5 日"},
    "2026": {"ord": "第 7 届（日程）", "loc": "加拿大多伦多（Toronto）", "date": "2026 年 9 月 13–18 日"},
}
TRACK_ORDER = ["QALG", "QSYS", "QNET", "QECS", "QPHO", "QML", "QTEM", "QGDD", "QAPP"]
TRACK_ZH = {
    "QALG": "量子算法", "QSYS": "量子系统软件", "QNET": "量子网络与通信",
    "QECS": "端到端量子—经典混合案例", "QPHO": "量子光子学", "QML": "量子机器学习",
    "QTEM": "量子技术与系统工程", "QGDD": "量子与生成式 AI 协同设计与发现",
    "QAPP": "量子应用",
}
DAY_ZH = {"SUN": "9 月 13 日 周日", "MON": "9 月 14 日 周一", "TUE": "9 月 15 日 周二", "WED": "9 月 16 日 周三", "THU": "9 月 17 日 周四", "FRI": "9 月 18 日 周五"}


def clean(value):
    value = html.unescape(value or "")
    value = re.sub(r"<[^>]+>", "", value)
    return re.sub(r"\s+", " ", value).strip()


entries = []
stats = {}
seen_dois = set()
for year in YEARS[:-1]:
    with open(BASE + f"data_{year}.json", encoding="utf-8") as handle:
        data = json.load(handle)
    with open(BASE + f"zh2_{year}.json", encoding="utf-8") as handle:
        zh = json.load(handle)
    if len(data) != len(zh):
        raise ValueError(f"{year}: record and Chinese note counts differ")
    front_matter = 0
    for number, record in enumerate(data, 1):
        summary = clean(zh[str(number)])
        is_front = summary.startswith("【")
        front_matter += is_front
        doi = clean(record.get("d", "")).lower()
        if not doi or doi in seen_dois:
            raise ValueError(f"Missing or duplicate DOI: {year} entry {number}, {doi}")
        seen_dois.add(doi)
        entries.append({
            "y": int(year), "n": number, "t": clean(record.get("t", "")),
            "a": [clean(author) for author in record.get("a", [])],
            "p": clean(record.get("p", "")), "d": doi,
            "z": summary, "fm": bool(is_front),
        })
    stats[year] = {"total": len(data), "papers": len(data) - front_matter, "fm": front_matter}

TOOLS = os.path.dirname(BASE.rstrip("/")) + "/tools"
sys.path.insert(0, TOOLS)
from papers_data import PAPERS as PROGRAM_PAPERS, TRACK_NAMES

with open(os.path.join(TOOLS, "arxiv_matches.json"), encoding="utf-8") as handle:
    arxiv_matches = json.load(handle)
program_index = 0
for track in TRACK_ORDER:
    for row, day, time, session, authors, title, best, best_track in PROGRAM_PAPERS[track]:
        program_index += 1
        match = arxiv_matches.get(f"{track}-{row}", {})
        arxiv_id = match.get("arxiv_short") or ""
        entries.append({
            "y": 2026, "n": program_index, "t": clean(title),
            "a": [clean(author) for author in re.split(r", | and ", authors) if clean(author)],
            "p": "", "d": "", "fm": False, "program": True,
            "track": track, "track_name": TRACK_NAMES[track], "track_zh": TRACK_ZH[track],
            "session": clean(session), "day": DAY_ZH.get(day, day), "time": time,
            "arxiv": arxiv_id, "abstract": clean(match.get("abstract", "")),
            "best": best,
            "z": f"QCE26 官方日程 · {TRACK_ZH[track]} 方向（Track {track}，{clean(session)}）。" + ("本届 Best Paper。" if best else ""),
        })
if program_index != 372:
    raise ValueError(f"QCE 2026 official schedule count changed: expected 372, got {program_index}")
stats["2026"] = {"total": program_index, "papers": program_index, "fm": 0, "source": "official schedule"}

PUBLISHED_TOTAL = len(entries) - program_index
PROGRAM26 = program_index
TOTAL = len(entries)
PAPERS = sum(item["papers"] for item in stats.values())
FM = sum(item["fm"] for item in stats.values())
PUBLISHED_PAPERS = PAPERS - PROGRAM26

# ---------------- Markdown ----------------
md = [
    "# IEEE QCE 历年论文清单（2020–2026）\n",
    "> **IEEE International Conference on Quantum Computing and Engineering**（IEEE 量子计算与工程国际会议，IEEE Quantum Week）  ",
    f"> 收录 QCE 2020–2025 IEEE Xplore 论文集 **{PUBLISHED_TOTAL} 条出版记录**（正式论文/报告 **{PUBLISHED_PAPERS} 篇**，前置/附录 **{FM} 条**），并单列 QCE26 官方技术论文日程 **{PROGRAM26} 篇**。两种来源分别计数。\n",
    "**说明**",
    "- QCE 2020–2025 清单依据 IEEE Xplore 论文集 DOI 元数据整理；每个出版条目保留唯一 DOI，并按原始目录编号列出。",
    "- 中文概要依据各论文摘要撰写，覆盖研究问题、方法/创新点与主要结果（每条 2–4 句），便于快速定位创新内容；「【前置材料】/【附录】」条目为非论文内容，可忽略。",
    "- QCE26 已于 2026 年 9 月 13–18 日在多伦多举行。372 篇会议技术论文来自 [IEEE 官方技术论文日程](https://qce.quantum.ieee.org/2026/wp-content/uploads/sites/13/2026/08/QCE26-Technical-Papers-Schedule-V123.pdf)，按日程编号、Track、Session 收录；匹配到 arXiv 的条目附预印本链接。",
    "- 生成日期：2026-09-23。同目录 `QCE_papers.html` 为可搜索版本，支持关键词、年份筛选、隐藏附录和导出 CSV。\n",
    "## 各届概况\n",
    "| 年份 | 届次 / 口径 | 举办地 | 会议时间 | Xplore 正式论文/报告 | 前置/附录 | 官方日程论文 |",
    "|---|---|---|---|---:|---:|---:|",
]
for year in YEARS[:-1]:
    meta, stat = META[year], stats[year]
    md.append(f"| [QCE {year}](#qce-{year}) | {meta['ord']} | {meta['loc']} | {meta['date']} | {stat['papers']} | {stat['fm']} | — |")
meta = META["2026"]
md.append(f"| [QCE 2026](#qce-2026) | {meta['ord']} | {meta['loc']} | {meta['date']} | — | — | {PROGRAM26} |")
md.append(f"| **合计** |  |  |  | **{PUBLISHED_PAPERS}** | **{FM}** | **{PROGRAM26}** |\n")

for year in YEARS:
    meta, stat = META[year], stats[year]
    if year == "2026":
        md.extend([
            "---\n",
            f"## QCE 2026（{meta['ord']}，官方会议技术论文日程）\n",
            f"- **时间**：{meta['date']}  ",
            f"- **收录**：官方日程列出的 {PROGRAM26} 篇技术论文；按日程收录，单独于 IEEE Xplore DOI 记录统计。  ",
            "- **来源**：[QCE26 Technical Papers Schedule（V123）](https://qce.quantum.ieee.org/2026/wp-content/uploads/sites/13/2026/08/QCE26-Technical-Papers-Schedule-V123.pdf)\n",
            "| # | Track / Session | 论文标题 | 作者 | 时间 | 预印本 | 中文说明 |",
            "|---:|---|---|---|---|---|---|",
        ])
        for entry in entries:
            if not entry.get("program"):
                continue
            title = entry["t"].replace("|", "\\|")
            if entry["arxiv"]:
                title = f"[{title}](https://arxiv.org/abs/{entry['arxiv']})"
                arxiv_link = f"[arXiv:{entry['arxiv']}](https://arxiv.org/abs/{entry['arxiv']})"
            else:
                arxiv_link = "—"
            authors = (", ".join(entry["a"]) if entry["a"] else "—").replace("|", "\\|")
            where = f"{entry['track']} · {entry['session']}".replace("|", "\\|")
            when = f"{entry['day']} {entry['time']}"
            summary = entry["z"].replace("|", "\\|")
            md.append(f"| {entry['n']} | {where} | {title} | {authors} | {when} | {arxiv_link} | {summary} |")
        md.append("")
        continue
    md.extend([
        "---\n",
        f"## QCE {year}（{meta['ord']}，{meta['loc']}）\n",
        f"- **时间**：{meta['date']}  ",
        f"- **收录**：{stat['total']} 条（正式论文 {stat['papers']} 篇，前置/附录材料 {stat['fm']} 条）\n",
    ])
    for entry in entries:
        if entry["y"] != int(year):
            continue
        title = f"[{entry['t']}](https://doi.org/{entry['d']})"
        authors = ", ".join(entry["a"]) if entry["a"] else "—"
        md.append(f"**[{entry['n']}] {title}**  ")
        md.append(f"*{authors} · pp. {entry['p'] or '—'}*  ")
        md.append(f"{entry['z']}\n")

with open(OUT_MD, "w", encoding="utf-8", newline="\n") as handle:
    handle.write("\n".join(md))

# ---------------- HTML ----------------
data_js = json.dumps(entries, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
html_template = r"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="IEEE QCE 2020–2025 论文集全目录与 QCE26 官方日程，附中文创新概要，可检索。">
<title>IEEE QCE 论文目录 · 2020–2026</title>
<style>
:root{
  --bg:#fafafb; --card:#ffffff; --ink:#1a1d24; --sub:#5d6572; --faint:#98a0ad;
  --line:#e9eaef; --line2:#f1f2f6;
  --accent:#4f46e5; --accent-ink:#4338ca; --accent-soft:#eef0ff; --accent-line:#c7cbf7;
  --mark:#fde68a; --gold:#b8860b;
  --radius:12px; --shadow:0 1px 2px rgba(26,29,36,.04),0 2px 8px rgba(26,29,36,.05);
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:"Inter","PingFang SC","Microsoft YaHei","Source Han Sans SC",system-ui,-apple-system,sans-serif;
  font-size:14.5px;line-height:1.75;-webkit-font-smoothing:antialiased}
header{background:var(--card);border-bottom:1px solid var(--line)}
.hd{max-width:1120px;margin:0 auto;padding:36px 24px 26px}
.kicker{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:9px}
.hd h1{margin:0 0 7px;font-size:clamp(24px,3.6vw,31px);font-weight:720;letter-spacing:-.022em;line-height:1.22}
.hd .sub{margin:0;color:var(--sub);font-size:13.5px}
.hd .sub a{color:var(--sub);text-decoration:none;border-bottom:1px solid #cfd3e0}
.hd .sub a:hover{color:var(--accent-ink);border-color:var(--accent-line)}
.stats{display:flex;gap:30px;margin-top:18px;flex-wrap:wrap}
.stat b{display:block;font-size:21px;line-height:1.15;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.stat span{display:block;color:var(--faint);font-size:11.5px;margin-top:3px}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
.bar{position:sticky;top:0;z-index:50;background:rgba(250,250,251,.87);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--line);padding:12px 0}
.bar .wrap{display:flex;gap:10px;align-items:center}
.search{flex:1;position:relative;min-width:200px}
.search svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:var(--faint);pointer-events:none}
.search input{width:100%;padding:9.5px 15px 9.5px 37px;border:1px solid var(--line);border-radius:999px;background:#fff;font:inherit;font-size:13.5px;color:var(--ink);outline:none;transition:.15s}
.search input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.search input::placeholder{color:var(--faint)}
.chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;cursor:pointer;font-size:12.5px;color:var(--sub);transition:.15s;white-space:nowrap}
.chip:hover{border-color:var(--accent-line);color:var(--accent-ink)}
.chip.on{background:var(--accent-soft);border-color:var(--accent-line);color:var(--accent-ink);font-weight:650}
.tgl{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--sub);cursor:pointer;white-space:nowrap;user-select:none}
.tgl input{accent-color:var(--accent)}
.btn{border:1px solid var(--line);background:#fff;color:var(--sub);border-radius:999px;padding:8px 15px;font:inherit;font-size:12.5px;cursor:pointer;transition:.15s;white-space:nowrap}
.btn:hover{border-color:var(--accent);color:var(--accent-ink)}
.main{padding-top:16px;padding-bottom:8px}
.meta-line{display:flex;justify-content:space-between;align-items:baseline;margin:4px 2px 12px;font-size:12.5px;color:var(--sub)}
.meta-line b{color:var(--ink)}
.list{display:flex;flex-direction:column;gap:9px}
.item{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:13px 17px;box-shadow:var(--shadow);transition:border-color .15s,transform .15s}
.item:hover{border-color:#d8dbf0}
.item.fm{opacity:.66}
.item.program{border-left:3px solid var(--accent)}
.top{display:flex;gap:9px;align-items:baseline;flex-wrap:wrap}
.idx{font-size:11.5px;color:var(--faint);font-variant-numeric:tabular-nums;min-width:36px}
.yr{flex:none;font-size:10.5px;color:var(--accent-ink);background:var(--accent-soft);border-radius:5px;padding:1px 7px;font-weight:650}
.tk{flex:none;font-size:10.5px;color:#6b5d10;background:#faf3d9;border-radius:5px;padding:1px 7px;font-weight:600}
.tt{font-size:14.5px;font-weight:640;line-height:1.5;letter-spacing:-.005em}
.tt a{color:var(--ink);text-decoration:none;border-bottom:1px solid #e3e5ee;transition:.15s}
.tt a:hover{color:var(--accent-ink);border-bottom-color:var(--accent-ink)}
.badge{flex:none;font-size:10px;color:var(--faint);background:#f0f1f5;border-radius:5px;padding:1.5px 6px;font-weight:600}
.badge.best{color:#7a5b00;background:#fdf3d0}
.au{margin-top:4px;font-size:12px;color:var(--faint);line-height:1.55}
.au .pg{color:#b3b9c4}
.zz{margin-top:7px;font-size:13.5px;color:#3f4652;line-height:1.82}
.item.fm .zz{color:var(--sub)}
.abs{margin-top:8px;font-size:12px;color:var(--sub)}
.abs summary{cursor:pointer;color:var(--accent-ink);font-weight:550}
.abs p{margin:6px 0 0;line-height:1.7;border-left:2px solid var(--line);padding-left:10px}
.meta2{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:11px;color:var(--faint)}
.meta2 a{color:#7c8492;text-decoration:none}
.meta2 a:hover{color:var(--accent-ink)}
mark{background:var(--mark);padding:0 1.5px;border-radius:3px;color:inherit}
.notes{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:18px 22px;margin:22px 0 10px;font-size:12.5px;color:var(--sub);line-height:1.9;box-shadow:var(--shadow)}
.notes b{color:var(--ink)}
.notes p{margin:4px 0}
.empty{text-align:center;padding:56px 16px;color:var(--faint);background:var(--card);border:1px dashed var(--line);border-radius:var(--radius)}
footer{text-align:center;color:var(--faint);font-size:11.5px;padding:22px 0 30px}
@media(max-width:680px){.wrap{padding:0 14px}.hd{padding:26px 14px 20px}.bar .wrap{flex-wrap:wrap}.stats{gap:18px}.item{padding:12px 13px}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;scroll-behavior:auto!important}}
</style>
</head>
<body>
<header><div class="hd">
 <div class="kicker">IEEE Quantum Week · QCE 2020–2026</div>
 <h1>IEEE QCE 论文目录</h1>
 <p class="sub">量子计算与工程国际会议 · 2020–2025 论文集全收录，附「问题 → 方法 / 创新点 → 结果」中文概要 · <a href="https://ieeexplore.ieee.org/xpl/conhome/1838864/all-proceedings" target="_blank" rel="noopener">IEEE Xplore 论文集</a></p>
 <div class="stats">
  <div class="stat"><b>__TOTAL__</b><span>2020–2025 出版记录</span></div>
  <div class="stat"><b>__PAPERS__</b><span>正式论文 / 报告</span></div>
  <div class="stat"><b>__FM__</b><span>前置材料与附录</span></div>
  <div class="stat"><b>__PROGRAM__</b><span>QCE26 官方日程论文</span></div>
 </div>
</div></header>

<div class="bar"><div class="wrap">
 <div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
  <input id="q" type="search" placeholder="搜索标题 / 作者 / 概要 / DOI / Track（空格分隔多词，按 / 聚焦）" autocomplete="off"></div>
 <div class="chips" id="chips"></div>
 <label class="tgl"><input type="checkbox" id="fmf"> 只看论文</label>
 <button class="btn" id="csv">导出 CSV</button>
</div></div>

<main class="wrap main">
 <div class="meta-line"><span id="stat" aria-live="polite"></span><span id="hint"></span></div>
 <section class="list" id="list" aria-live="polite"></section>
 <div class="notes"><b>数据与使用说明</b>
  <p>2020–2025 条目依据 IEEE Xplore 各届论文集 DOI 元数据（Crossref 注册）整理，经 OpenAlex 交叉核对无遗漏，按原始目录编号与页码排序；2020–2025 标题点击跳转 IEEE Xplore。中文概要依据各论文摘要撰写，突出创新点与主要结果。</p>
  <p>QCE26 的 372 条记录来自 <a href="https://qce.quantum.ieee.org/2026/wp-content/uploads/sites/13/2026/08/QCE26-Technical-Papers-Schedule-V123.pdf" target="_blank" rel="noopener">IEEE 官方技术论文日程</a>，与出版 DOI 记录分开统计，标注 Track / Session / 时间；匹配到 arXiv 的条目可展开英文摘要。可编辑版为同目录 <code>QCE_papers.md</code>，数据与概要文件在 <code>qce_data/</code>（改后重跑 <code>build.py</code> 再生成）。</p>
 </div>
</main>
<footer>更新于 2026-09-23 · QCE26 论文集出版后可将日程记录替换为 DOI 条目 · 按 / 聚焦搜索</footer>
<script>
const DATA=__DATA__;
const YEARS=__YEARDATA__;
const listEl=document.getElementById('list'),q=document.getElementById('q'),chips=document.getElementById('chips'),
statEl=document.getElementById('stat'),hintEl=document.getElementById('hint');
let year='all',hideFM=false;
function esc(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function hl(s,terms){if(!terms.length)return esc(s);const lower=String(s).toLowerCase(),hits=[];for(const term of terms){let from=0,index;while((index=lower.indexOf(term,from))!==-1){hits.push([index,index+term.length]);from=index+term.length}}hits.sort((a,b)=>a[0]-b[0]||b[1]-a[1]);let out='',end=0;for(const [start,stop] of hits){if(stop<=end)continue;const at=Math.max(start,end);out+=esc(String(s).slice(end,at))+'<mark>'+esc(String(s).slice(at,stop))+'</mark>';end=stop}return out+esc(String(s).slice(end))}
function pass(e,terms){
 if(year!=='all'&&e.y!==Number(year))return false;
 if(hideFM&&e.fm)return false;
 if(!terms.length)return true;
 const hay=(e.t+' '+e.a.join(' ')+' '+e.z+' '+e.d+' '+e.p+' '+(e.track||'')+' '+(e.track_zh||'')+' '+(e.session||'')+' '+(e.arxiv||'')+' '+(e.abstract||'')).toLowerCase();
 return terms.every(t=>hay.includes(t));
}
function renderChips(){
 let h='<button class="chip'+(year==='all'?' on':'')+'" data-y="all">全部 '+DATA.length+'</button>';
 for(const y of Object.keys(YEARS).sort()){
  const s=YEARS[y];
  h+='<button class="chip'+(year===y?' on':'')+'" data-y="'+y+'">QCE '+y+' · '+(y==='2026'?s.total:s.papers)+'</button>';
 }
 chips.innerHTML=h;
 chips.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{year=c.dataset.y;renderChips();render()});
}
function render(){
 const terms=q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
 let h='',cnt=0,pap=0;
 for(const e of DATA){
  if(!pass(e,terms))continue;
  cnt++;if(!e.fm)pap++;
  const au=e.a.length?e.a.map(x=>hl(x,terms)).join('; '):'';
  if(e.program){
   const arxiv=e.arxiv?'https://arxiv.org/abs/'+encodeURIComponent(e.arxiv):'';
   const title=arxiv?'<a href="'+arxiv+'" target="_blank" rel="noopener">'+hl(e.t,terms)+'</a>':hl(e.t,terms);
   const abstract=e.abstract?'<details class="abs"><summary>英文摘要（arXiv）</summary><p>'+hl(e.abstract,terms)+'</p></details>':'';
   h+='<article class="item program"><div class="top"><span class="idx">#'+e.n+'</span><span class="yr">QCE26</span><span class="tk">'+hl(e.track_zh,terms)+'</span>'+(e.best?'<span class="badge best">Best Paper</span>':'')+'<span class="tt">'+title+'</span></div>'
    +(au?'<div class="au">'+au+'</div>':'')
    +'<div class="zz">'+hl(e.z,terms)+'</div>'
    +'<div class="meta2"><span>'+hl(e.session,terms)+'</span><span>'+hl(e.day,terms)+' '+hl(e.time,terms)+'</span>'+(e.arxiv?'<span><a href="'+arxiv+'" target="_blank" rel="noopener">arXiv:'+hl(e.arxiv,terms)+'</a></span>':'<span>无预印本匹配</span>')+'</div>'
    +abstract+'</article>';
   continue;
  }
  const doi='https://doi.org/'+encodeURIComponent(e.d);
  h+='<article class="item'+(e.fm?' fm':'')+'"><div class="top"><span class="idx">#'+e.n+'</span><span class="yr">'+e.y+'</span><span class="tt"><a href="'+doi+'" target="_blank" rel="noopener">'+hl(e.t,terms)+'</a></span>'+(e.fm?'<span class="badge">附录</span>':'')+'</div>'
   +(au||e.p?'<div class="au">'+au+(e.p?' <span class="pg">· pp. '+esc(e.p)+'</span>':'')+'</div>':'')
   +'<div class="zz">'+hl(e.z,terms)+'</div></article>';
 }
 listEl.innerHTML=h||'<div class="empty">没有找到匹配论文，试试减少关键词或切换年份。</div>';
 statEl.innerHTML='显示 <b>'+cnt+'</b> 条（论文 '+pap+' 篇）'+(year!=='all'?' · QCE '+year:'')+(hideFM?' · 已隐藏附录':'');
 hintEl.textContent=terms.length?'关键词：'+terms.join(' '):'';
}
let deb;q.oninput=()=>{clearTimeout(deb);deb=setTimeout(render,100)};
q.addEventListener('keydown',e=>{if(e.key==='Escape'){q.value='';render()}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement!==q){e.preventDefault();q.focus()}});
document.getElementById('fmf').onchange=e=>{hideFM=e.target.checked;render()};
document.getElementById('csv').onclick=()=>{
 const terms=q.value.trim().toLowerCase().split(/\s+/).filter(Boolean),rows=[];
 for(const e of DATA)if(pass(e,terms))rows.push(e);
 const csv='﻿Year,Index,Title,Authors,Track,Session,Pages,DOI_or_arXiv,Summary'+String.fromCharCode(10)+rows.map(e=>[e.y,e.n,e.t,e.a.join('; '),e.track||'',e.session||'',e.p,e.d||(e.arxiv?'arXiv:'+e.arxiv:'QCE26 schedule'),e.z].map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join(String.fromCharCode(10));
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='QCE_papers_filtered.csv';a.click();URL.revokeObjectURL(a.href);
};
renderChips();render();
</script>
</body>
</html>"""
html_doc = (html_template.replace("__DATA__", data_js)
            .replace("__YEARDATA__", json.dumps(stats, ensure_ascii=False))
            .replace("__TOTAL__", f"{PUBLISHED_TOTAL:,}")
            .replace("__PAPERS__", f"{PUBLISHED_PAPERS:,}")
            .replace("__FM__", f"{FM:,}")
            .replace("__PROGRAM__", f"{PROGRAM26:,}"))
with open(OUT_HTML, "w", encoding="utf-8", newline="\n") as handle:
    handle.write(html_doc)

print(f"entries: {TOTAL}; formal papers/reports: {PAPERS}; front matter/appendices: {FM}")
for year in YEARS:
    print(f"{year}: {stats[year]}")
print(f"wrote: {OUT_HTML}")
print(f"wrote: {OUT_MD}")
