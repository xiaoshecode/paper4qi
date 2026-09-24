# -*- coding: utf-8 -*-
"""Targeted arXiv hunt for the 7 unmatched Best Papers: keyword + author queries, relaxed threshold."""
import json, os, re, sys, time, difflib
import urllib.request, urllib.parse
import xml.etree.ElementTree as ET

NS = {"a": "http://www.w3.org/2005/Atom"}
API = "http://export.arxiv.org/api/query"

def norm(s):
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())

def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": "QCE26-hunt/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def query(q, n=8):
    url = API + "?" + urllib.parse.urlencode({"search_query": q, "max_results": str(n)})
    root = ET.fromstring(fetch(url))
    out = []
    for e in root.findall("a:entry", NS):
        t = " ".join((e.findtext("a:title", "", NS) or "").split())
        aid = (e.findtext("a:id", "", NS) or "").strip()
        au = [a.findtext("a:name", "", NS) for a in e.findall("a:author", NS)]
        pub = (e.findtext("a:published", "", NS) or "")[:10]
        if aid and t:
            out.append((t, aid.split("/abs/")[-1], au, pub))
    return out

# the 7 missing best papers: (id, title, first author last name, keyword queries)
TARGETS = [
    ("QAPP-19", "Experimental Insights of Pauli Correlation Encoding for Currency Arbitrage on NISQ Hardware", "Rana",
     ['ti:"Currency Arbitrage" AND all:"quantum"', 'all:"Pauli Correlation Encoding" AND all:"arbitrage"', 'au:Rana AND all:"Pauli Correlation"']),
    ("QECS-9", "VQ-MAR: A Variational Quantum-Classical Hybrid Framework for Managed Aquifer Recharge Site Selection", "Aseeri",
     ['all:"VQ-MAR"', 'all:"Aquifer Recharge" AND all:"quantum"', 'au:Aseeri AND all:"quantum"']),
    ("QTEM-21", "DART-Q: Deadline-Aware Real-Time Feed-Forward for Quantum Control", "Cao",
     ['all:"DART-Q"', 'all:"Deadline-Aware" AND all:"Feed-Forward" AND all:"Quantum"', 'au:Cao AND au:Kalinin AND all:"quantum control"']),
    ("QPHO-7", "Fabrication and Screening of Quantum Photonic Chip with Single Diamond Tin-Vacancy Centers towards Scalable Quantum Computing", "Kitagawa",
     ['all:"Tin-Vacancy" AND all:"photonic chip"', 'au:Kitagawa AND all:"Tin-Vacancy"', 'all:"Fabrication and Screening" AND all:"Tin-Vacancy"']),
    ("QSYS-57", "Delta-Motif: Parallel Subgraph Isomorphism via Tabular Operations for Scalable Layout Selection", "Wang",
     ['all:"Delta-Motif"', 'all:"Subgraph Isomorphism" AND all:"Tabular Operations"', 'all:"Subgraph Isomorphism" AND all:"Layout Selection" AND all:"quantum"']),
    ("QTEM-18", "Void-Free Through-Glass Vias for Multilayer Surface-Electrode Ion Traps", "Iseke",
     ['all:"Through-Glass Vias" AND all:"ion trap"', 'au:Iseke AND all:"trap"', 'all:"Void-Free" AND all:"Surface-Electrode"']),
    ("QTEM-6", "Scalable FPGA-based Decoder for Quantum Error Correction with Syndrome Subgraph Algorithm", "Wichmann",
     ['all:"Syndrome Subgraph"', 'au:Wichmann AND all:"decoder" AND all:"quantum"', 'all:"FPGA-based Decoder" AND all:"Syndrome"']),
]

def main():
    for pid, title, author, queries in TARGETS:
        print(f"\n=== {pid}: {title[:65]}", flush=True)
        best = None
        for q in queries:
            try:
                for t, aid, au, pub in query(q):
                    sc = difflib.SequenceMatcher(None, norm(title), norm(t)).ratio()
                    if best is None or sc > best[0]:
                        best = (sc, t, aid, au, pub, q)
                    if sc >= 0.55:
                        print(f"  [{sc:.2f}] {aid} ({pub}) {t[:75]}", flush=True)
                        print(f"        authors: {', '.join(au[:5])}", flush=True)
            except Exception as ex:
                print(f"  query fail {q[:40]}: {ex}", flush=True)
            time.sleep(3.0)
        if best is None:
            print("  no candidates at all")
        elif best[0] < 0.55:
            print(f"  (best candidate below 0.55: {best[0]:.2f} {best[2]} {best[1][:60]})")

if __name__ == "__main__":
    main()
