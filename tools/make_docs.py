# -*- coding: utf-8 -*-
"""Generate QCE26_Papers.md (editable) + QCE26_Papers.html (searchable) from papers_data + arxiv_matches."""
import json, os, datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys_dir = os.path.join(BASE, "tools")
import sys
sys.path.insert(0, sys_dir)
from papers_data import PAPERS, TRACK_NAMES, DAY_DATES

TRACK_ORDER = ["QALG", "QSYS", "QNET", "QECS", "QPHO", "QML", "QTEM", "QGDD", "QAPP"]
DAY_FULL = {"SUN": "9/13 周日", "MON": "9/14 周一", "TUE": "9/15 周二", "WED": "9/16 周三", "THU": "9/17 周四", "FRI": "9/18 周五"}

with open(os.path.join(sys_dir, "arxiv_matches.json"), encoding="utf-8") as f:
    MATCH = json.load(f)

def esc(s):
    return (s or "").replace("|", "\\|").replace("\n", " ")

def build_records():
    recs = []
    for tr in TRACK_ORDER:
        for row, day, t, sess, auth, title, best, btrack in PAPERS[tr]:
            m = MATCH.get(f"{tr}-{row}", {})
            recs.append({
                "id": f"{tr}-{row}", "track": tr, "track_name": TRACK_NAMES[tr],
                "row": row, "day": DAY_FULL.get(day, day), "time": t, "session": sess,
                "authors": auth, "title": title,
                "best": best, "best_track": btrack,
                "status": m.get("status"), "score": m.get("score"),
                "arxiv": m.get("arxiv_short"), "arxiv_title": m.get("arxiv_title"),
                "abstract": m.get("abstract"), "published": m.get("published"),
                "pdf": m.get("pdf"),
                "cand": m.get("top_candidate"),
            })
    return recs

RECS = build_records()
N_TOTAL = len(RECS)
N_MATCH = sum(1 for r in RECS if r["status"] == "match")
N_PDF = sum(1 for r in RECS if r["pdf"])
NOW = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

# ---------------- Markdown ----------------
md = []
md.append("# IEEE QCE 2026 技术论文总目录（372 篇）\n")
md.append(f"> **会议**：IEEE Quantum Week 2026（QCE26），2026-09-13 ~ 09-18，加拿大多伦多  ")
md.append(f"> **数据来源**：官方 [Technical Papers Schedule PDF (V123)](https://qce.quantum.ieee.org/2026/wp-content/uploads/sites/13/2026/08/QCE26-Technical-Papers-Schedule-V123.pdf) 与 [Best Papers PDF](https://qce.quantum.ieee.org/2026/wp-content/uploads/sites/13/2026/08/QCE26-Best-Papers-v19.pdf)；arXiv 匹配通过 arXiv API 按标题自动完成（相似度阈值 0.82）  ")
md.append(f"> **统计**：共 {N_TOTAL} 篇 ｜ arXiv 匹配 {N_MATCH} 篇 ｜ 已下载 PDF {N_PDF} 篇 ｜ 生成时间：{NOW}\n")
md.append("**说明**：QCE26 正式版论文将由 IEEE Xplore 出版（尚未上线）；本清单中 arXiv 链接为作者自存预印本，内容与会议版可能有差异。🏆 表示该 Track Best Paper。\n")

md.append("## 目录\n")
for tr in TRACK_ORDER:
    n = len(PAPERS[tr]); h = sum(1 for r in RECS if r["track"] == tr and r["status"] == "match")
    md.append(f"- [{tr} – {TRACK_NAMES[tr]}](#{tr.lower()})（{n} 篇，arXiv 匹配 {h}）")
md.append(f"- [摘要汇编](#摘要汇编arxiv-匹配论文)（{N_MATCH} 篇）\n")

md.append("---\n")
for tr in TRACK_ORDER:
    md.append(f"\n## {tr} – {TRACK_NAMES[tr]}（{len(PAPERS[tr])} 篇）\n")
    md.append("| # | 论文标题 | 作者 | Session | 时间 | arXiv | 本地PDF |")
    md.append("|---|---|---|---|---|---|---|")
    for r in [x for x in RECS if x["track"] == tr]:
        title = r["title"] + ("  🏆#%s" % r["best"] if r["best"] else "")
        ax = f"[{r['arxiv']}](https://arxiv.org/abs/{r['arxiv']})" if r["arxiv"] else "—"
        pdf = f"[打开](../{r['pdf']})" if r["pdf"] else "—"
        md.append(f"| {r['row']} | {esc(title)} | {esc(r['authors'])} | {esc(r['session'])} | {r['day']} {r['time']} | {ax} | {pdf} |")

md.append("\n---\n\n## 摘要汇编（arXiv 匹配论文）\n")
for r in RECS:
    if r["status"] != "match":
        continue
    md.append(f"\n### [{r['id']}] {r['title']}\n")
    bt = f"（{r['best_track']} Track Best Paper #{r['best']}）" if r["best"] else ""
    md.append(f"- **作者**：{r['authors']} {bt}")
    md.append(f"- **Session**：{r['session']} ｜ {r['day']} {r['time']} ｜ {r['track']} Track")
    md.append(f"- **arXiv**：[{r['arxiv']}](https://arxiv.org/abs/{r['arxiv']})（{r['published']}，匹配度 {r['score']}）")
    if r["pdf"]:
        md.append(f"- **本地文件**：`{r['pdf']}`")
    md.append(f"- **arXiv 标题**：{r['arxiv_title']}")
    if r["abstract"]:
        md.append(f"\n> **摘要**：{r['abstract']}")

with open(os.path.join(BASE, "QCE26_Papers.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(md))

# ---------------- HTML ----------------
data_json = json.dumps(RECS, ensure_ascii=False).replace("</", "<\\/")

html = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>IEEE QCE 2026 论文目录（372 篇）</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#1a2233;--sub:#5b6472;--line:#e3e6ea;--acc:#4338ca;--gold:#b45309}
*{box-sizing:border-box}
body{margin:0;font-family:"Segoe UI",system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--ink)}
header{background:linear-gradient(135deg,#1e1b4b,#312e81);color:#fff;padding:28px 20px 20px}
h1{margin:0 0 6px;font-size:22px}
.meta{font-size:13px;opacity:.85;line-height:1.7}
.bar{position:sticky;top:0;z-index:9;background:#fff;border-bottom:1px solid var(--line);padding:10px 20px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;box-shadow:0 1px 6px rgba(0,0,0,.05)}
#q{flex:1;min-width:220px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px;outline:none}
#q:focus{border-color:var(--acc)}
select{padding:9px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;background:#fff}
label.chk{font-size:13px;color:var(--sub);display:flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap}
#count{font-size:13px;color:var(--sub);white-space:nowrap}
main{max-width:1100px;margin:0 auto;padding:18px 20px 60px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:12px}
.t{font-size:15.5px;font-weight:600;line-height:1.45;margin:0 0 6px}
.t a{color:var(--ink);text-decoration:none}
.t a:hover{color:var(--acc)}
.badge{display:inline-block;font-size:11px;padding:1px 7px;border-radius:10px;margin-right:6px;vertical-align:2px}
.b-track{background:#eef2ff;color:#3730a3}.b-best{background:#fef3c7;color:var(--gold);font-weight:600}
.b-arx{background:#dcfce7;color:#166534}
.au{font-size:12.5px;color:var(--sub);line-height:1.55;margin:2px 0 4px}
.ss{font-size:12px;color:var(--sub)}
.ln{font-size:12.5px;margin-top:6px}
.ln a{color:var(--acc);text-decoration:none;margin-right:14px}
details{margin-top:8px}
summary{font-size:12.5px;color:var(--acc);cursor:pointer;user-select:none}
details p{font-size:13px;line-height:1.7;color:#333;background:#f8fafc;border-left:3px solid var(--acc);padding:8px 12px;margin:8px 0 0;border-radius:0 6px 6px 0}
.cand{font-size:12px;color:#92400e;margin-top:4px}
footer{max-width:1100px;margin:0 auto;padding:0 20px 40px;font-size:12px;color:var(--sub)}
mark{background:#fde047}
</style>
</head>
<body>
<header>
<h1>IEEE QCE 2026 论文目录 · 372 篇技术论文</h1>
<div class="meta">Toronto, 2026-09-13~18 ｜ arXiv 匹配 <b>__NMATCH__</b> 篇 ｜ 已下载 PDF <b>__NPDF__</b> 篇 ｜ 数据源：官方 Schedule PDF V123 + arXiv API ｜ 生成：__NOW__<br>
arXiv 链接为作者自存预印本；正式版将于 IEEE Xplore 出版。🏆 = Track Best Paper</div>
</header>
<div class="bar">
<input id="q" type="search" placeholder="搜索标题 / 作者 / session / arXiv 编号…">
<select id="trk"><option value="">全部 Track（9）</option></select>
<label class="chk"><input type="checkbox" id="cx">仅 arXiv 匹配</label>
<label class="chk"><input type="checkbox" id="cb">仅 Best Paper</label>
<span id="count"></span>
</div>
<main id="list"></main>
<footer>提示：点击标题可跳转 arXiv；「本地PDF」直接打开已下载文件（pdfs/arxiv/ 目录）。本页为静态文件，可离线使用。</footer>
<script>
const DATA = __DATA__;
const TRK = {QALG:"Quantum Algorithms",QSYS:"Quantum Systems Software",QNET:"Quantum Networking & Comm",QECS:"Hybrid Case Studies",QPHO:"Quantum Photonics",QML:"Quantum Machine Learning",QTEM:"Technologies & Systems Eng",QGDD:"GenAI Co-Design",QAPP:"Quantum Applications"};
const esc = s => (s||"").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const q = document.getElementById('q'), trk = document.getElementById('trk'),
      cx = document.getElementById('cx'), cb = document.getElementById('cb'),
      list = document.getElementById('list'), cnt = document.getElementById('count');
for (const [k,v] of Object.entries(TRK)) trk.add(new Option(k+" · "+v, k));
function hl(t, terms){ if(!terms.length) return esc(t); let s = esc(t);
  for(const w of terms){ try{ s = s.replace(new RegExp('('+w.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')+')','gi'),'<mark>$1</mark>'); }catch(e){} } return s; }
function render(){
  const terms = q.value.trim().toLowerCase().split(/\\s+/).filter(Boolean);
  const f = DATA.filter(r => {
    if (trk.value && r.track !== trk.value) return false;
    if (cx.checked && r.status !== 'match') return false;
    if (cb.checked && !r.best) return false;
    if (!terms.length) return true;
    const hay = (r.title+' '+r.authors+' '+r.session+' '+r.track+' '+(r.arxiv||'')+' '+(r.abstract||'')).toLowerCase();
    return terms.every(w => hay.includes(w));
  });
  cnt.textContent = f.length + ' / ' + DATA.length + ' 篇';
  list.innerHTML = f.map(r => {
    const best = r.best ? `<span class="badge b-best">🏆 Best #${r.best}${r.best_track!==r.track?' ('+r.best_track+')':''}</span>` : '';
    const axl = r.arxiv ? `<a href="https://arxiv.org/abs/${r.arxiv}" target="_blank">arXiv:${r.arxiv}</a>` : '';
    const pdf = r.pdf ? `<a href="${r.pdf}" target="_blank">本地PDF</a>` : '';
    const abs = r.abstract ? `<details><summary>摘要</summary><p>${hl(r.abstract, terms)}</p></details>` : '';
    const cand = (!r.arxiv && r.cand && r.cand.score >= 0.50) ? `<div class="cand">疑似相关：${esc(r.cand.title)}（score ${r.cand.score}${r.cand.note?'，'+esc(r.cand.note):''}，<a href="${r.cand.id}" target="_blank">arXiv</a>${r.cand.pdf?`，<a href="${r.cand.pdf}" target="_blank">本地PDF</a>`:''}）</div>` : '';
    return `<div class="card"><p class="t">${r.arxiv?`<a href="https://arxiv.org/abs/${r.arxiv}" target="_blank">${hl(r.title,terms)}</a>`:hl(r.title,terms)}
      <span class="badge b-track">${r.id}</span>${r.arxiv?'<span class="badge b-arx">arXiv</span>':''}${best}</p>
      <p class="au">${hl(r.authors, terms)}</p>
      <p class="ss">${r.session} ｜ ${r.day} ${r.time} ｜ ${TRK[r.track]}</p>
      <div class="ln">${axl}${pdf}</div>${abs}${cand}</div>`;
  }).join('') || '<div class="card">无匹配结果</div>';
}
[q, trk, cx, cb].forEach(e => e.addEventListener('input', render));
render();
</script>
</body>
</html>"""
html = html.replace("__DATA__", data_json).replace("__NMATCH__", str(N_MATCH)).replace("__NPDF__", str(N_PDF)).replace("__NOW__", NOW)
with open(os.path.join(BASE, "QCE26_Papers.html"), "w", encoding="utf-8") as f:
    f.write(html)

with open(os.path.join(BASE, "papers_data.json"), "w", encoding="utf-8") as f:
    json.dump(RECS, f, ensure_ascii=False, indent=1)

print(f"OK: QCE26_Papers.md ({os.path.getsize(os.path.join(BASE,'QCE26_Papers.md'))//1024} KB), QCE26_Papers.html ({os.path.getsize(os.path.join(BASE,'QCE26_Papers.html'))//1024} KB), papers_data.json")
print(f"total={N_TOTAL} match={N_MATCH} pdf={N_PDF}")
