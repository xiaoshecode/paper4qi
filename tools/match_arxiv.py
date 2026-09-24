# -*- coding: utf-8 -*-
"""Match QCE26 papers to arXiv preprints via arXiv API, download matched PDFs.
Resumable: progress saved to tools/arxiv_matches.json after every paper.
Run:  python match_arxiv.py [start_index] [end_index]
"""
import json, os, re, sys, time, difflib
import urllib.request, urllib.parse
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from papers_data import PAPERS

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # paperresearch/
MATCHES_PATH = os.path.join(BASE, "tools", "arxiv_matches.json")
PDF_DIR = os.path.join(BASE, "pdfs", "arxiv")
API = "http://export.arxiv.org/api/query"
NS = {"a": "http://www.w3.org/2005/Atom"}
THRESH = 0.82
SLEEP_API = 3.1   # arXiv asks >=3s between requests
SLEEP_PDF = 1.6

def norm(s):
    s = s.lower()
    s = re.sub(r"[-_:\(\)\[\]\.,;'\?!/–—\"‘’“”]", " ", s)
    s = re.sub(r"[^a-z0-9一-鿿]+", " ", s)
    return " ".join(s.split())

def load_matches():
    if os.path.exists(MATCHES_PATH):
        with open(MATCHES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_matches(m):
    with open(MATCHES_PATH, "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=1)

def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": "QCE26-bibliography/1.0 (academic paper collection)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def query_arxiv(title, field="ti"):
    q = f'{field}:"{title}"'
    url = API + "?" + urllib.parse.urlencode({"search_query": q, "max_results": "6"})
    data = fetch(url)
    root = ET.fromstring(data)
    out = []
    for e in root.findall("a:entry", NS):
        aid = (e.findtext("a:id", "", NS) or "").strip()
        atitle = " ".join((e.findtext("a:title", "", NS) or "").split())
        summ = " ".join((e.findtext("a:summary", "", NS) or "").split())
        pub = (e.findtext("a:published", "", NS) or "")[:10]
        authors = [a.findtext("a:name", "", NS) for a in e.findall("a:author", NS)]
        cats = [c.get("term") for c in e.findall("a:category", NS)]
        if aid and atitle:
            out.append({"id": aid, "title": atitle, "abstract": summ,
                        "published": pub, "authors": authors, "categories": cats})
    return out

def best_match(local_title, entries):
    ln = norm(local_title)
    best, sc = None, 0.0
    for en in entries:
        r = difflib.SequenceMatcher(None, ln, norm(en["title"])).ratio()
        if r > sc:
            best, sc = en, r
    return best, sc

def download_pdf(short_id):
    fn = os.path.join(PDF_DIR, short_id.replace("/", "_") + ".pdf")
    if os.path.exists(fn) and os.path.getsize(fn) > 10000:
        return fn, True
    try:
        data = fetch(f"https://arxiv.org/pdf/{short_id}", timeout=60)
        if data[:4] != b"%PDF":
            return fn, False
        with open(fn, "wb") as f:
            f.write(data)
        return fn, len(data) > 10000
    except Exception as ex:
        print(f"      pdf-dl-fail {short_id}: {ex}", flush=True)
        return fn, False

def main():
    flat = []
    for tr in ["QALG","QSYS","QNET","QECS","QPHO","QML","QTEM","QGDD","QAPP"]:
        for row, day, t, sess, auth, title, best, btrack in PAPERS[tr]:
            flat.append((tr, row, title))
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    end = int(sys.argv[2]) if len(sys.argv) > 2 else len(flat)
    matches = load_matches()
    n_done = n_hit = n_pdf = 0
    t0 = time.time()
    for i in range(start, min(end, len(flat))):
        tr, row, title = flat[i]
        key = f"{tr}-{row}"
        if key in matches:
            continue
        if not title or title.startswith("[Title missing"):
            matches[key] = {"status": "no_title"}; save_matches(matches); continue
        rec = {"status": "no_match", "score": 0.0, "qce_title": title}
        try:
            entries = query_arxiv(title, "ti")
            if not entries:
                entries = query_arxiv(title, "all")
                time.sleep(SLEEP_API)
            en, sc = best_match(title, entries) if entries else (None, 0.0)
            if en and sc >= THRESH:
                short = en["id"].split("/abs/")[-1]
                short_nov = re.sub(r"v\d+$", "", short)
                rec = {"status": "match", "score": round(sc, 3),
                       "arxiv_id": short, "arxiv_short": short_nov,
                       "arxiv_title": en["title"], "abstract": en["abstract"],
                       "arxiv_authors": en["authors"], "published": en["published"],
                       "categories": en["categories"], "pdf": ""}
                fn, ok = download_pdf(short_nov)
                if ok:
                    rec["pdf"] = os.path.relpath(fn, BASE).replace("\\", "/")
                    n_pdf += 1
                time.sleep(SLEEP_PDF)
                n_hit += 1
            else:
                if en:
                    rec["top_candidate"] = {"title": en["title"], "id": en["id"], "score": round(sc, 3)}
        except Exception as ex:
            rec = {"status": "error", "error": str(ex)[:200], "qce_title": title}
        matches[key] = rec
        save_matches(matches)
        n_done += 1
        if n_done % 10 == 0:
            el = time.time() - t0
            print(f"[{i+1}/{len(flat)}] done={n_done} hits={n_hit} pdfs={n_pdf} elapsed={el/60:.1f}min", flush=True)
    print(f"FINISHED segment [{start}:{end}] new={n_done} hits={n_hit} pdfs={n_pdf}", flush=True)
    total_hits = sum(1 for v in matches.values() if v.get("status") == "match")
    total_pdfs = sum(1 for v in matches.values() if v.get("pdf"))
    print(f"OVERALL matches={total_hits}/{len(flat)} pdfs={total_pdfs}", flush=True)

if __name__ == "__main__":
    main()
