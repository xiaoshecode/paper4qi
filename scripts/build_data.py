# -*- coding: utf-8 -*-
"""Build the static-site datasets for paper4qi.

Inputs (read-only, under data_src/):
  qce/data_20xx.json     2020-2025 IEEE Xplore records      {d,t,a[],p}
  qce/zh2_20xx.json      Chinese notes, keyed by 1-based index (【 = front matter)
  qce/abs_20xx.json      English abstracts, keyed by 1-based index
  qce/cats.json          {year: {index: [Chinese label, ...]}}
  qce/replaced_qce26.json  optional {"TRACK-row": "doi"} -> schedule row superseded
  qce26/papers_data.py   PAPERS = {track: [[row, day, time, session, authors, title, best, best_track]]}
  qce26/arxiv_matches.json  {"TRACK-row": {status, arxiv_short, abstract, ...}}
  tqe/tqe_merged.json    465 merged Crossref/OpenAlex records (already categorised)
  tqe/zh_20*.json        Chinese notes, keyed by global index of tqe_merged.json
  overrides/zh_new.json  optional {paper_id: text} overriding zh

Outputs: public/data/{qce,tqe,stats}.json

Run:  PYTHONIOENCODING=utf-8 python scripts/build_data.py
"""
import glob
import importlib.util
import json
import os
import re
import sys
from collections import Counter, OrderedDict, defaultdict
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "data_src")
OUT_DIR = os.path.join(ROOT, "public", "data")

sys.path.insert(0, HERE)
from lib_taxonomy import (  # noqa: E402
    CAT_NAMES, CAT_ORDER, CAT_RANK, QCE26_TRACK_ORDER, TRACK_MAP, TRACK_ZH,
    categorize_qce, categorize_tqe, clean, split_authors,
)

QCE_YEARS = sorted(
    re.findall(r"data_(\d{4})\.json", " ".join(os.listdir(os.path.join(SRC, "qce"))))
)
PLACEHOLDER_ZH = "【待补充】"

# Baseline counts as of the initial import (2026-09-24). Count drift versus
# these numbers is reported as a WARNING, never fatal: the weekly updater adds
# records, and a hard failure here would break the deploy pipeline.
EXPECT = {
    "qce_records": 1674,
    "qce_front": 151,
    "qce_papers": 1523,
    "qce26": 372,
    "tqe_records": 465,
    "tqe_front": 22,
    "tqe_papers": 443,
    "front": 173,
    "qce_json": 2046,
    "tqe_json": 465,
}


def warn_count(what, actual, baseline):
    """Report count drift vs the import baseline without failing the build."""
    if actual != baseline:
        print(f"[warn] {what}: {actual} (baseline {baseline}, +{actual - baseline})")


def load_json(path, default=None):
    """Load a JSON file; return `default` when the file is absent."""
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(path)


def paper(paper_id, source, source_id, year, title, authors, doi=None, arxiv=None,
          abstract=None, zh=None, category="OTHER", tags=None, venue="", pages=None,
          cited_by=None, front_matter=False, **extra):
    """One Paper record, field order fixed by the output schema."""
    record = OrderedDict()
    record["id"] = paper_id
    record["source"] = source
    record["source_id"] = source_id
    record["year"] = year
    record["title"] = title
    record["authors"] = authors
    record["doi"] = doi
    record["arxiv"] = arxiv
    record["abstract"] = abstract
    record["zh"] = zh or PLACEHOLDER_ZH
    record["category"] = category
    record["tags"] = tags or []
    record["venue"] = venue
    record["pages"] = pages
    record["cited_by"] = cited_by
    record["front_matter"] = bool(front_matter)
    for key in ("track", "session", "day", "time", "best"):
        if key in extra:
            record[key] = extra[key]
    return record


# --------------------------------------------------------------------------
# 1. QCE 2020-2025 (IEEE Xplore records)
# --------------------------------------------------------------------------
qce_cats = load_json(os.path.join(SRC, "qce", "cats.json"), {}) or {}
seen_qce_dois = {}
qce_papers = []
qce_year_stats = {}
qce_front_count = 0

for year in QCE_YEARS:
    data = load_json(os.path.join(SRC, "qce", f"data_{year}.json"))
    notes = load_json(os.path.join(SRC, "qce", f"zh2_{year}.json"))
    abstracts = load_json(os.path.join(SRC, "qce", f"abs_{year}.json"), {}) or {}
    if len(data) != len(notes):
        raise ValueError(f"QCE {year}: {len(data)} records vs {len(notes)} Chinese notes")
    labels_by_index = qce_cats.get(year, {})
    year_front = 0
    for number, record in enumerate(data, 1):
        key = str(number)
        title = clean(record.get("t", ""))
        summary = clean(notes[key])
        is_front = summary.startswith("【")
        doi = clean(record.get("d", "")).lower()
        if not doi:
            raise ValueError(f"QCE {year} entry {number}: empty DOI")
        if doi in seen_qce_dois:
            raise ValueError(f"QCE {year} entry {number}: duplicate DOI {doi} "
                             f"(also in {seen_qce_dois[doi]})")
        seen_qce_dois[doi] = year
        labels = list(labels_by_index.get(key, []))
        abstract = clean(abstracts.get(key, "")) or None
        category = categorize_qce(title, labels, abstract or "", front=is_front)
        qce_papers.append(paper(
            paper_id=f"qce:{doi}", source="qce", source_id=doi, year=int(year),
            title=title, authors=[clean(a) for a in record.get("a", [])],
            doi=doi, abstract=abstract, zh=summary, category=category, tags=labels,
            venue=f"IEEE QCE {year}", pages=clean(record.get("p", "")) or None,
            front_matter=is_front,
        ))
        year_front += int(is_front)
    qce_front_count += year_front
    qce_year_stats[year] = {"total": len(data), "papers": len(data) - year_front, "front": year_front}
    print(f"QCE {year}: {len(data)} records ({len(data) - year_front} papers, {year_front} front)")

if qce_front_count != EXPECT["qce_front"]:
    print(f"[warn] QCE front matter: {qce_front_count} (baseline {EXPECT['qce_front']})")
if len(qce_papers) != EXPECT["qce_records"]:
    print(f"[warn] QCE records: {len(qce_papers)} (baseline {EXPECT['qce_records']})")

# --------------------------------------------------------------------------
# 2. QCE 2026 (official schedule) merged into the qce dataset
# --------------------------------------------------------------------------
program_path = os.path.join(SRC, "qce26", "papers_data.py")
spec = importlib.util.spec_from_file_location("qce26_papers_data", program_path)
program = importlib.util.module_from_spec(spec)
spec.loader.exec_module(program)
PAPERS = program.PAPERS
TRACK_NAMES = program.TRACK_NAMES
if set(TRACK_NAMES) != set(QCE26_TRACK_ORDER):
    raise ValueError(f"QCE26 tracks changed: {sorted(TRACK_NAMES)}")
arxiv_matches = load_json(os.path.join(SRC, "qce26", "arxiv_matches.json"), {}) or {}

# {"TRACK-row": "doi"} written by the future update script once QCE26 proceedings
# are published: those schedule rows are already present as DOI records.
replaced = load_json(os.path.join(SRC, "qce", "replaced_qce26.json"), {}) or {}

schedule_total = sum(len(PAPERS[track]) for track in QCE26_TRACK_ORDER)
if schedule_total != EXPECT["qce26"]:
    print(f"[warn] QCE26 schedule rows: {schedule_total} (baseline {EXPECT['qce26']}; "
          f"reduction usually means entries were reconciled to DOI records)")

qce26_papers = []
qce26_skipped = []
qce26_tracks = Counter()
for track in QCE26_TRACK_ORDER:
    for row, day, time, session, authors, title, best, _best_track in sorted(PAPERS[track], key=lambda r: r[0]):
        source_id = f"{track}-{row}"
        if source_id in replaced:
            qce26_skipped.append(source_id)
            continue
        match = arxiv_matches.get(source_id, {})
        is_match = match.get("status") == "match"
        arxiv = clean(match.get("arxiv_short", "")) if is_match else ""
        abstract = clean(match.get("abstract", "")) if is_match else ""
        session_clean = clean(session)
        summary = f"QCE26 官方日程 · {TRACK_ZH[track]}（{session_clean}）"
        if best:
            summary += f" · 本届 Best Paper（第 {best} 名）"
        qce26_papers.append(paper(
            paper_id=f"qce26:{source_id}", source="qce26", source_id=source_id, year=2026,
            title=clean(title), authors=split_authors(authors), arxiv=arxiv or None,
            abstract=abstract or None, zh=summary, category=TRACK_MAP[track],
            tags=[track], venue="IEEE QCE 2026",
            track=track, session=session_clean, day=day, time=time, best=best,
        ))
        qce26_tracks[track] += 1

if qce26_skipped:
    print(f"QCE26: skipped {len(qce26_skipped)} replaced schedule rows: {', '.join(qce26_skipped)}")
print(f"QCE26: {len(qce26_papers)} schedule papers, {sum(1 for p in qce26_papers if p['arxiv'])} with arXiv match")

# --------------------------------------------------------------------------
# 3. TQE (journal records, pre-categorised)
# --------------------------------------------------------------------------
merged = load_json(os.path.join(SRC, "tqe", "tqe_merged.json"))
zh_notes = {}
for path in sorted(glob.glob(os.path.join(SRC, "tqe", "zh_20*.json"))):
    for key, value in (load_json(path) or {}).items():
        if key in zh_notes:
            raise ValueError(f"duplicate zh key {key} in {os.path.basename(path)}")
        zh_notes[key] = clean(value)

tqe_papers = []
tqe_front_count = 0
for index, record in enumerate(merged):
    source_cat = record.get("cat") or categorize_tqe(record)[0]
    is_front = source_cat == "FRONT"
    # FRONT is not one of the 13 report categories: journal cover/index pages are
    # reported as OTHER (like QCE front matter), flagged by front_matter instead.
    category = "OTHER" if is_front else source_cat
    volume, issue = record.get("volume"), record.get("issue")
    venue = "IEEE TQE"
    if volume:
        venue += f" Vol.{volume}"
    if issue:
        venue += f" No.{issue}"
    doi = clean(record.get("doi", "")).lower() or None
    tqe_papers.append((index, source_cat, paper(
        paper_id=f"tqe:{doi}", source="tqe", source_id=doi,
        year=record.get("year_norm") or record.get("year"),
        title=clean(record.get("title", "")),
        authors=[clean(a) for a in record.get("authors", [])],
        doi=doi, abstract=clean(record.get("abstract", "")) or None,
        zh=zh_notes.get(str(index)), category=category,
        tags=[clean(k) for k in (record.get("keywords") or [])[:6]],
        venue=venue, pages=clean(record.get("pages", "")) or None,
        cited_by=record.get("cited_by"), front_matter=is_front,
    )))
    tqe_front_count += int(is_front)

if tqe_front_count != EXPECT["tqe_front"]:
    print(f"[warn] TQE front matter: {tqe_front_count} (baseline {EXPECT['tqe_front']})")
if len(tqe_papers) != EXPECT["tqe_records"]:
    print(f"[warn] TQE records: {len(tqe_papers)} (baseline {EXPECT['tqe_records']})")

tqe_dois = [p["doi"] for _, _, p in tqe_papers if p["doi"]]
duplicate_tqe = [doi for doi, n in Counter(tqe_dois).items() if n > 1]
if duplicate_tqe:
    raise ValueError(f"duplicate TQE DOIs: {duplicate_tqe[:5]}")
if len(tqe_dois) != len(tqe_papers):
    raise ValueError("TQE record without a DOI")

# ordering: year_norm, category priority (source cat, so FRONT stays last),
# art_no, title
tqe_papers.sort(key=lambda item: (
    item[2]["year"], CAT_RANK.get(item[1], 99),
    clean(merged[item[0]].get("art_no") or ""), item[2]["title"],
))
tqe_papers = [p for _, _, p in tqe_papers]

# --------------------------------------------------------------------------
# 4. zh overrides (applies to every source, last step)
# --------------------------------------------------------------------------
overrides = load_json(os.path.join(SRC, "overrides", "zh_new.json"), {}) or {}
if overrides:
    by_id = {p["id"]: p for p in qce_papers + qce26_papers + tqe_papers}
    applied, unknown = 0, []
    for paper_id, text in overrides.items():
        target = by_id.get(paper_id)
        if target is None:
            unknown.append(paper_id)
            continue
        target["zh"] = clean(text) or PLACEHOLDER_ZH
        applied += 1
    print(f"overrides: applied {applied}/{len(overrides)}" + (f", unknown ids: {unknown[:5]}" if unknown else ""))

# --------------------------------------------------------------------------
# 5. write qce.json / tqe.json
# --------------------------------------------------------------------------
generated = datetime.now().astimezone().isoformat(timespec="seconds")
os.makedirs(OUT_DIR, exist_ok=True)

qce_payload = OrderedDict([
    ("source", "qce"), ("generated", generated),
    ("count", len(qce_papers) + len(qce26_papers)),
    ("papers", qce_papers + qce26_papers),
])
tqe_payload = OrderedDict([
    ("source", "tqe"), ("generated", generated),
    ("count", len(tqe_papers)), ("papers", tqe_papers),
])
qce_size = write_json(os.path.join(OUT_DIR, "qce.json"), qce_payload)
tqe_size = write_json(os.path.join(OUT_DIR, "tqe.json"), tqe_payload)

# --------------------------------------------------------------------------
# 6. stats.json
# --------------------------------------------------------------------------
all_papers = qce_papers + qce26_papers + tqe_papers
papers_only = [p for p in all_papers if not p["front_matter"]]
front_total = len(all_papers) - len(papers_only)

matrix = {"qce": defaultdict(Counter), "tqe": defaultdict(Counter), "combined": defaultdict(Counter)}
for p in papers_only:
    year, cat = p["year"], p["category"]
    bucket = "tqe" if p["source"] == "tqe" else "qce"
    matrix[bucket][year][cat] += 1
    matrix["combined"][year][cat] += 1


def freeze(source_matrix):
    out = OrderedDict()
    for year in sorted(source_matrix):
        row = source_matrix[year]
        out[str(year)] = OrderedDict((cat, row[cat]) for cat in CAT_ORDER if row.get(cat))
    return out


matrix = {key: freeze(value) for key, value in matrix.items()}

growth = []
for year in sorted(set(matrix["qce"]) | set(matrix["tqe"])):
    growth.append({
        "year": int(year),
        "qce": sum(matrix["qce"].get(year, {}).values()),
        "tqe": sum(matrix["tqe"].get(year, {}).values()),
    })

top_cited = sorted(
    (p for p in papers_only if p.get("cited_by") is not None),
    key=lambda p: (-p["cited_by"], p["year"], p["id"]),
)[:20]
top_cited = [{"id": p["id"], "title": p["title"], "year": p["year"], "cited_by": p["cited_by"]} for p in top_cited]

totals = OrderedDict([
    ("qce", len([p for p in qce_papers if not p["front_matter"]])),
    ("qce26", len(qce26_papers)),
    ("tqe", len([p for p in tqe_papers if not p["front_matter"]])),
    ("front", front_total),
])
totals["all"] = totals["qce"] + totals["qce26"] + totals["tqe"]

stats = OrderedDict([
    ("generated", generated),
    ("years", [2020, 2021, 2022, 2023, 2024, 2025, 2026]),
    ("cats", CAT_ORDER),
    ("totals", totals),
    ("matrix", matrix),
    ("growth", growth),
    ("topCited", top_cited),
    ("qce26Tracks", OrderedDict((track, qce26_tracks[track]) for track in QCE26_TRACK_ORDER)),
])
stats_size = write_json(os.path.join(OUT_DIR, "stats.json"), stats)

# --------------------------------------------------------------------------
# 7. drift warnings + human readable report (count changes warn, never fail)
# --------------------------------------------------------------------------
expected_qce_json = EXPECT["qce_json"] - len(qce26_skipped)
warn_count("qce.json count", qce_payload["count"], expected_qce_json)
warn_count("tqe.json count", tqe_payload["count"], EXPECT["tqe_json"])
warn_count("front matter total", front_total, EXPECT["front"])
warn_count("qce papers", totals["qce"], EXPECT["qce_papers"])
warn_count("tqe papers", totals["tqe"], EXPECT["tqe_papers"])
warn_count("QCE26 schedule rows", len(qce26_papers) + len(qce26_skipped), EXPECT["qce26"])

print()
print("=" * 78)
print("paper4qi data build")
print("=" * 78)
print(f"QCE years     : {', '.join(QCE_YEARS)}")
print(f"QCE 2020-2025 : {len(qce_papers)} records -> {totals['qce']} papers + {qce_front_count} front matter")
print(f"QCE 2026      : {len(qce26_papers)} schedule papers (of {schedule_total} rows)")
print(f"TQE 2020-2026 : {len(tqe_papers)} records -> {totals['tqe']} papers + {tqe_front_count} front matter")
print(f"totals        : {dict(totals)}")
print(f"front matter  : {front_total} (QCE {qce_front_count} + TQE {tqe_front_count})")

print("\nyear x category matrix (front matter excluded)")
header = [str(y) for y in sorted(matrix["combined"])]
print(f"{'source':<9}{'cat':<7}" + "".join(f"{y:>7}" for y in header) + f"{'sum':>8}")
for source in ("qce", "tqe", "combined"):
    for cat in CAT_ORDER:
        row = [matrix[source].get(y, {}).get(cat, 0) for y in header]
        if not any(row):
            continue
        print(f"{source:<9}{cat:<7}" + "".join(f"{v:>7}" for v in row) + f"{sum(row):>8}")
    print("-" * (16 + 7 * len(header) + 8))

dist = Counter()
for p in papers_only:
    dist[p["category"]] += 1
print("\n13-category distribution (all sources, front matter excluded)")
for cat in CAT_ORDER:
    print(f"  {cat:<6}{CAT_NAMES[cat]:<24}{dist[cat]:>5}")

print("\ngrowth")
for item in growth:
    print(f"  {item['year']}  qce {item['qce']:>4}   tqe {item['tqe']:>4}")

print("\ntopCited (top 3)")
for item in top_cited[:3]:
    print(f"  {item['cited_by']:>4}  {item['year']}  {item['title'][:70]}")

print("\nqce26Tracks:", dict(stats["qce26Tracks"]))

print("\nwrote:")
for name, size in (("qce.json", qce_size), ("tqe.json", tqe_size), ("stats.json", stats_size)):
    print(f"  {os.path.join(OUT_DIR, name)}  {size:,} bytes")
print("\nOK - all assertions passed.")
