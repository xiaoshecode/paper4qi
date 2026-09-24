# -*- coding: utf-8 -*-
"""Patch QSYS-57 (true match 2508.21287) and QAPP-19 (related preprint 2509.09289) into matches."""
import json, os, sys, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from match_arxiv import load_matches, save_matches

NS = {"a": "http://www.w3.org/2005/Atom"}
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_entry(aid):
    url = f"http://export.arxiv.org/api/query?id_list={aid}"
    req = urllib.request.Request(url, headers={"User-Agent": "QCE26/1.0"})
    root = ET.fromstring(urllib.request.urlopen(req, timeout=30).read())
    e = root.find("a:entry", NS)
    return {
        "title": " ".join(e.findtext("a:title", "", NS).split()),
        "abstract": " ".join(e.findtext("a:summary", "", NS).split()),
        "published": (e.findtext("a:published", "", NS) or "")[:10],
        "authors": [a.findtext("a:name", "", NS) for a in e.findall("a:author", NS)],
        "categories": [c.get("term") for c in e.findall("a:category", NS)],
    }

matches = load_matches()

# QSYS-57: true match (Delta vs Δ in title)
en = get_entry("2508.21287")
matches["QSYS-57"] = {
    "status": "match", "score": 0.97,
    "qce_title": "Delta-Motif: Parallel Subgraph Isomorphism via Tabular Operations for Scalable Layout Selection",
    "arxiv_id": "2508.21287v4", "arxiv_short": "2508.21287",
    "arxiv_title": en["title"], "abstract": en["abstract"],
    "arxiv_authors": en["authors"], "published": en["published"],
    "categories": en["categories"], "pdf": "pdfs/arxiv/2508.21287.pdf",
    "note": "manual match: arXiv title uses Δ symbol",
}
print("QSYS-57 patched ->", en["title"][:70])

# QAPP-19: related earlier paper by same team (title differs)
rec = matches.get("QAPP-19", {"status": "no_match", "score": 0.0,
    "qce_title": "Experimental Insights of Pauli Correlation Encoding for Currency Arbitrage on NISQ Hardware"})
en2 = get_entry("2509.09289")
rec["top_candidate"] = {"title": en2["title"], "id": "https://arxiv.org/abs/2509.09289",
                        "score": 0.52, "pdf": "pdfs/arxiv/2509.09289.pdf",
                        "note": "same core authors (Rana/Roy/Chandra), likely related earlier version"}
matches["QAPP-19"] = rec
print("QAPP-19 candidate attached ->", en2["title"][:70])

save_matches(matches)
m = sum(1 for v in matches.values() if v.get("status") == "match")
p = sum(1 for v in matches.values() if v.get("pdf"))
print(f"match={m} pdf={p}")
