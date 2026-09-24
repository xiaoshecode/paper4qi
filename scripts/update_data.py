#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Weekly incremental data update for paper4qi (standard library only).

Sources
-------
TQE (IEEE Transactions on Quantum Engineering, ISSN 2689-1808)
    Crossref (metadata) + OpenAlex (abstract / cited_by / keywords / topics).
    New records are appended to ``data_src/tqe/tqe_merged.json``; ``cited_by`` of
    every existing record is refreshed from a full OpenAlex source crawl.
QCE (IEEE Quantum Week proceedings)
    New conference years are detected on Crossref via the ``container-title``
    filter.  When a year yields >= 50 records it becomes
    ``data_src/qce/data_{Y}.json`` (+ ``zh2_{Y}.json`` placeholders and an empty
    ``abs_{Y}.json``).  For the QCE26 schedule year the published DOI records are
    reconciled against ``data_src/qce26/papers_data.py`` -- see
    ``reconcile_qce26.py``.

Design rules
------------
* Every source runs inside its own try/except; a hard failure emits
  ``::warning::`` and the process still exits 0 so the CI job stays green and
  the previous data is kept.
* Nothing is written until the fresh payload has been fetched and validated, and
  every write is atomic -- a network outage can never truncate the data files.
* ``data_src/.update_state.json`` records the last successful run per source;
  the next fetch window starts at ``last_run - 2 days`` so a late-indexed DOI is
  still picked up.

Usage::

    python scripts/update_data.py
"""

from __future__ import annotations

import datetime
import glob
import os
import re
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import lib_fetch  # noqa: E402

try:  # optional: colleague-maintained taxonomy module
    import reconcile_qce26 as reco  # noqa: E402
except Exception:  # pragma: no cover - reconcile is required, keep import hard
    reco = None

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_SRC = os.path.join(REPO_ROOT, "data_src")
TQE_DIR = os.path.join(DATA_SRC, "tqe")
QCE_DIR = os.path.join(DATA_SRC, "qce")
QCE26_DIR = os.path.join(DATA_SRC, "qce26")

TQE_MERGED = os.path.join(TQE_DIR, "tqe_merged.json")
STATE_PATH = os.path.join(DATA_SRC, ".update_state.json")

TQE_ISSN = "2689-1808"
TQE_DOI_PREFIX = "10.1109/tqe."
#: OpenAlex source id for IEEE Transactions on Quantum Engineering.
TQE_OPENALEX_SOURCE = "S4210182817"

DEFAULT_LOOKBACK_DAYS = 14
OVERLAP_DAYS = 2

#: A QCE year needs at least this many Crossref records to count as published.
QCE_MIN_RECORDS = 50
#: NB: the literal "container-title:" prefix is required -- Crossref rejects the
#: bare title as an invalid filter pair.
QCE_CONTAINER_TMPL = ("container-title:%s IEEE International Conference on "
                      "Quantum Computing and Engineering (QCE)")

#: Crossref `select` field lists (kept small; the API rejects unknown fields, so
#: every call site falls back to an unrestricted request on failure).
CROSSREF_SELECT_TQE = "DOI,title,type,issued,volume,issue,page,article-number,author,container-title"
CROSSREF_SELECT_QCE = "DOI,title,author,page"

#: Category code -> Chinese display name, as used in tqe_merged.json.
CAT_NAMES = {
    "REV": "综述与路线图",
    "QEC": "量子纠错与容错计算",
    "COMM": "量子通信与网络",
    "QML": "量子机器学习",
    "SUP": "超导量子硬件",
    "PLAT": "自旋/离子阱/中性原子等硬件平台",
    "PHOT": "量子光子学与光学器件",
    "SENS": "量子传感与计量",
    "CRYO": "低温电子学与量子测控",
    "MAT": "量子材料与器件工艺",
    "ARCH": "量子体系结构、编译与基准测试",
    "ALG": "量子算法与应用",
    "FRONT": "期刊前置页",
}

#: Ordered fallback rules used when ``lib_taxonomy`` is unavailable.
#: First match wins; searched against the title, then keywords + topics.
CATEGORIZE_RULES = [
    ("REV", ("review", "survey")),
    ("QEC", ("error correction", "error-correcting", "surface code", "decoder",
             "decoding", "gkp", "stabilizer", "fault-tolerant", "fault tolerant",
             "quantum ldpc", "syndrome", "logical qubit")),
    # "quantum network" rather than a bare "network": COMM is checked before QML,
    # so a bare "network" would swallow "neural network" papers.
    ("COMM", ("qkd", "quantum key distribution", "quantum network", "repeater",
              "teleportation", "entanglement distribution", "cryptograph",
              "quantum internet", "entanglement swapping")),
    ("QML", ("machine learning", "neural", "classifier", "classification",
             "quantum kernel", "generative model")),
    ("SUP", ("superconducting", "transmon", "josephson", "squid", "fluxonium",
             "circuit qed")),
    ("PLAT", ("trapped ion", "ion trap", "neutral atom", "spin", "qubit dot",
              "quantum dot", "nv", "nitrogen-vacancy")),
    ("PHOT", ("photonic", "single-photon", "single photon", "spdc", "optical")),
    # "atomic clock" rather than a bare "clock", which would catch clock-cycle/architecture work
    ("SENS", ("magnetomet", "atomic clock", "gravimeter", "quantum sensing",
              "quantum sensor", "sensing")),
    ("CRYO", ("cryo-cmos", "cryo cmos", "sfq", "readout", "cryogenic")),
    ("MAT", ("material", "fabrication", "film", "niobium", "tantalum")),
    ("ARCH", ("compiler", "compilation", "benchmark", "simulat", "scheduling",
              "transpil", "architecture", "circuit optimization", "resource estimation")),
]
DEFAULT_CAT = "ALG"

_TAXONOMY = ["unset"]


# --------------------------------------------------------------------------
# logging helpers
# --------------------------------------------------------------------------

def log(message):
    print(message, flush=True)


def warn(message):
    """Emit a GitHub Actions warning annotation (a plain line outside CI)."""
    print("::warning::%s" % message, flush=True)


# --------------------------------------------------------------------------
# state file
# --------------------------------------------------------------------------

def _today():
    return datetime.date.today()


def _parse_date(value):
    try:
        return datetime.date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def default_since(days=DEFAULT_LOOKBACK_DAYS):
    return (_today() - datetime.timedelta(days=days)).isoformat()


def load_state(path=None):
    """Load ``.update_state.json``; missing/invalid fields fall back to today-14d."""
    state = {"last_tqe_run": default_since(), "last_qce_run": default_since()}
    raw = lib_fetch.load_json(path or STATE_PATH, {})
    if isinstance(raw, dict):
        for key in ("last_tqe_run", "last_qce_run"):
            parsed = _parse_date(raw.get(key))
            if parsed:
                state[key] = parsed.isoformat()
    return state


def save_state(state, path=None):
    lib_fetch.atomic_write_json(path or STATE_PATH, state, indent=2)


def window_start(last_run):
    """Fetch window start = ``last_run - OVERLAP_DAYS`` (overlap guards late indexing)."""
    run = _parse_date(last_run) or _parse_date(default_since())
    return (run - datetime.timedelta(days=OVERLAP_DAYS)).isoformat()


# --------------------------------------------------------------------------
# Crossref iteration with a select-field fallback
# --------------------------------------------------------------------------

def iter_crossref(filter_str, select=None, log_fn=log):
    """Yield Crossref item batches, retrying without ``select`` if rejected.

    Duplicates are possible after a mid-stream fallback, so callers must dedupe.
    """
    if select:
        try:
            for batch in lib_fetch.crossref_works(filter=filter_str, rows=200, select=select):
                yield batch
            return
        except Exception as err:
            warn("Crossref select=%s failed (%s); retrying without select" % (select, err))
    for batch in lib_fetch.crossref_works(filter=filter_str, rows=200):
        yield batch


# --------------------------------------------------------------------------
# TQE: categorisation
# --------------------------------------------------------------------------

def _kw_hit(text, keyword):
    """Word-start match so short codes ('gkp', 'nv') do not match inside words."""
    return re.search(r"\b" + re.escape(keyword), text) is not None


def _categorize_fallback(record):
    """Simplified keyword categoriser (used when lib_taxonomy is unavailable)."""
    title = (record.get("title") or "").lower()
    extra = " ".join(
        [str(x).lower() for x in (record.get("keywords") or [])]
        + [str(x).lower() for x in (record.get("topics") or [])]
    )
    for code, keywords in CATEGORIZE_RULES:
        if any(_kw_hit(title, kw) for kw in keywords):
            return code
    for code, keywords in CATEGORIZE_RULES:
        if any(_kw_hit(extra, kw) for kw in keywords):
            return code
    return DEFAULT_CAT


def _coerce_cat(result):
    """Normalise whatever ``lib_taxonomy.categorize_tqe`` returns."""
    if result is None:
        return None
    if isinstance(result, str):
        code = result.strip()
        return (code, CAT_NAMES.get(code, code)) if code else None
    if isinstance(result, dict):
        code = result.get("cat") or result.get("code")
        name = result.get("cat_name") or result.get("name") or CAT_NAMES.get(code, code)
        return (code, name) if code else None
    if isinstance(result, (tuple, list)):
        if len(result) >= 2:
            return (result[0], result[1])
        if len(result) == 1:
            return _coerce_cat(result[0])
    return None


def categorize(record):
    """Return ``(cat, cat_name)``, preferring ``lib_taxonomy.categorize_tqe``."""
    if _TAXONOMY[0] == "unset":
        try:
            import lib_taxonomy  # noqa: F401
            _TAXONOMY[0] = lib_taxonomy
        except Exception:
            _TAXONOMY[0] = None
            log("  (lib_taxonomy not found -- using built-in keyword fallback)")
    module = _TAXONOMY[0]
    if module is not None:
        fn = getattr(module, "categorize_tqe", None)
        if fn is not None:
            try:
                coerced = _coerce_cat(fn(record))
            except Exception as err:
                warn("lib_taxonomy.categorize_tqe failed (%s); using fallback" % err)
                coerced = None
            if coerced:
                return coerced
    code = _categorize_fallback(record)
    return code, CAT_NAMES.get(code, code)


# --------------------------------------------------------------------------
# TQE: record construction
# --------------------------------------------------------------------------

def compute_year_norm(volume, year):
    """TQE volume 1 == 2020, so ``year_norm = 2019 + volume`` (issue year fallback)."""
    if volume:
        match = re.match(r"^\s*(\d+)", str(volume))
        if match:
            return 2019 + int(match.group(1))
    return year


def build_tqe_record(item, oa):
    """Map a Crossref item (+ optional OpenAlex work) onto the tqe_merged schema."""
    doi = lib_fetch.normalize_doi(item.get("DOI"))

    titles = item.get("title") or []
    title = (titles[0] or "").strip() if titles else ""

    issued = item.get("issued") or item.get("published") or {}
    date_parts = (issued or {}).get("date-parts") or [[None]]
    crossref_year = date_parts[0][0] if date_parts and date_parts[0] else None

    authors, affils = [], []
    for author in item.get("author") or []:
        given = (author.get("given") or "").strip()
        family = (author.get("family") or "").strip()
        name = ("%s %s" % (given, family)).strip()
        if name:
            authors.append(name)
        affiliations = author.get("affiliation") or []
        if affiliations:
            affil = (affiliations[0] or {}).get("name")
            if affil:
                affils.append(affil)

    oa = oa or {}
    record = {
        "doi": doi,
        "title": title,
        "type": item.get("type"),
        "pub_date": oa.get("publication_date"),
        "year": oa.get("publication_year") or crossref_year,
        "volume": item.get("volume"),
        "issue": item.get("issue"),
        "pages": item.get("page"),
        "art_no": item.get("article-number"),
        "authors": authors,
        "affils": affils,
        "abstract": lib_fetch.inv_to_text(oa.get("abstract_inverted_index")),
        "keywords": [k.get("display_name") for k in (oa.get("keywords") or [])[:12]
                     if k.get("display_name")],
        "topics": [t.get("display_name") for t in (oa.get("topics") or [])[:6]
                   if t.get("display_name")],
        "concepts": [c.get("display_name") for c in (oa.get("concepts") or [])[:8]
                     if (c.get("level") or 9) <= 2 and c.get("display_name")],
        "cited_by": oa.get("cited_by_count"),
        "url": "https://doi.org/" + doi,
    }
    record["year_norm"] = compute_year_norm(record["volume"], record["year"])
    cat, cat_name = categorize(record)
    record["cat"] = cat
    record["cat_name"] = cat_name
    return record


# --------------------------------------------------------------------------
# TQE: update
# --------------------------------------------------------------------------

def refresh_tqe_cited_by(merged, log_fn=log):
    """Refresh ``cited_by`` in place from one full OpenAlex source crawl.

    OpenAlex returns a handful of duplicate records per DOI (a real entity plus a
    citation-less stub), and the stub can arrive last, so the *maximum* count per
    DOI is kept -- that matches the reference dataset and never lets a stub
    clobber a real value.
    """
    counts = {}
    duplicates = 0
    for batch in lib_fetch.openalex_works_by_source(TQE_OPENALEX_SOURCE):
        for work in batch:
            doi = lib_fetch.normalize_doi(work.get("doi"))
            if not doi:
                continue
            value = work.get("cited_by_count")
            if value is None:
                continue
            if doi in counts:
                duplicates += 1
                counts[doi] = max(counts[doi], value)
            else:
                counts[doi] = value
    log_fn("[tqe] openalex crawl: cited_by for %d works (%d duplicate records collapsed)"
           % (len(counts), duplicates))

    refreshed = 0
    for record in merged:
        doi = lib_fetch.normalize_doi(record.get("doi"))
        value = counts.get(doi)
        if value is not None and value != record.get("cited_by"):
            record["cited_by"] = value
            refreshed += 1
    return refreshed


def update_tqe(since=None, log_fn=log):
    """Append newly indexed TQE articles and refresh ``cited_by``."""
    merged = lib_fetch.load_json(TQE_MERGED)
    if not isinstance(merged, list) or not merged:
        raise RuntimeError("tqe_merged.json is missing or empty -- refusing to update")

    original_len = len(merged)
    known = {lib_fetch.normalize_doi(r.get("doi")) for r in merged if r.get("doi")}
    log_fn("[tqe] existing records: %d" % original_len)

    since = since or default_since()
    filter_str = "issn:%s,from-pub-date:%s" % (TQE_ISSN, since)
    log_fn("[tqe] crossref filter: %s" % filter_str)

    candidates, foreign, seen = [], [], set()
    for batch in iter_crossref(filter_str, select=CROSSREF_SELECT_TQE):
        for item in batch:
            doi = lib_fetch.normalize_doi(item.get("DOI"))
            if not doi or doi in known or doi in seen:
                continue
            seen.add(doi)
            if not doi.startswith(TQE_DOI_PREFIX):
                foreign.append(doi)
                continue
            candidates.append(item)

    for doi in foreign:
        warn("TQE: skipping non-%s DOI %s (mis-attributed on the ISSN filter)"
             % (TQE_DOI_PREFIX, doi))

    added = 0
    for item in candidates:
        doi = lib_fetch.normalize_doi(item.get("DOI"))
        oa = None
        try:
            oa = lib_fetch.openalex_works_by_doi(doi)
        except Exception as err:
            warn("TQE: OpenAlex lookup failed for %s (%s)" % (doi, err))
        merged.append(build_tqe_record(item, oa))
        added += 1
        log_fn("[tqe] + %s  %s" % (doi, (item.get("title") or [""])[0][:70]))

    refreshed = 0
    try:
        refreshed = refresh_tqe_cited_by(merged, log_fn=log_fn)
    except Exception as err:
        warn("TQE: cited_by refresh failed (%s); keeping existing values" % err)

    if added or refreshed:
        surviving = {lib_fetch.normalize_doi(r.get("doi")) for r in merged if r.get("doi")}
        if len(merged) < original_len or not known.issubset(surviving):
            raise RuntimeError("TQE: refusing to write -- existing records would be lost")
        lib_fetch.atomic_write_json(TQE_MERGED, merged)
        log_fn("[tqe] wrote %s (%d -> %d records)" % (TQE_MERGED, original_len, len(merged)))
    else:
        log_fn("[tqe] no changes; file untouched")

    return {
        "added": added,
        "refreshed": refreshed,
        "skipped": len(foreign),
        "total": len(merged),
        "unchanged": not (added or refreshed),
    }


# --------------------------------------------------------------------------
# QCE: new-year detection
# --------------------------------------------------------------------------

def qce_existing_years(qce_dir=QCE_DIR):
    years = []
    for path in glob.glob(os.path.join(qce_dir, "data_*.json")):
        match = re.search(r"data_(\d{4})\.json$", os.path.basename(path))
        if match:
            years.append(int(match.group(1)))
    return sorted(years)


def fetch_qce_year(year, log_fn=log):
    """Fetch every Crossref record for a QCE edition, preserving Crossref order."""
    filter_str = QCE_CONTAINER_TMPL % year
    log_fn("[qce] crossref filter: %s" % filter_str)

    records, seen = [], set()
    for batch in iter_crossref(filter_str, select=CROSSREF_SELECT_QCE):
        for item in batch:
            doi = lib_fetch.normalize_doi(item.get("DOI"))
            if not doi or doi in seen:
                continue
            seen.add(doi)
            titles = item.get("title") or []
            authors = []
            for author in item.get("author") or []:
                name = ("%s %s" % ((author.get("given") or "").strip(),
                                   (author.get("family") or "").strip())).strip()
                if name:
                    authors.append(name)
            records.append({
                "d": doi,
                "t": (titles[0] or "").strip() if titles else "",
                "a": authors,
                "p": item.get("page"),
            })
    return records


def write_qce_year(year, records):
    """Create data_{Y}.json + zh2_{Y}.json placeholders + an empty abs_{Y}.json."""
    data_path = os.path.join(QCE_DIR, "data_%d.json" % year)
    zh2_path = os.path.join(QCE_DIR, "zh2_%d.json" % year)
    abs_path = os.path.join(QCE_DIR, "abs_%d.json" % year)

    # zh2 values must NOT start with '【' -- build_data treats that prefix as
    # front/appendix material rather than a paper still awaiting a summary.
    zh2 = {str(i + 1): "待补充" for i in range(len(records))}

    lib_fetch.atomic_write_json(data_path, records, indent=0)
    lib_fetch.atomic_write_json(zh2_path, zh2, indent=0)
    lib_fetch.atomic_write_json(abs_path, {})
    return data_path, zh2_path, abs_path


def update_qce(log_fn=log):
    """Detect and ingest any newly published QCE proceedings year."""
    years = qce_existing_years()
    if not years:
        warn("QCE: no existing data_YYYY.json files; skipping year detection")
        return {"new_year": None, "count": 0}

    start = max(years) + 1
    end = max(_today().year, start)
    log_fn("[qce] existing years: %s; probing %d..%d" % (years, start, end))

    for year in range(start, end + 1):
        records = fetch_qce_year(year, log_fn=log_fn)
        log_fn("[qce] %d -> %d Crossref records" % (year, len(records)))
        if len(records) < QCE_MIN_RECORDS:
            log_fn("[qce] %d not published yet (need >= %d); no files written"
                   % (year, QCE_MIN_RECORDS))
            continue
        paths = write_qce_year(year, records)
        log_fn("[qce] new year %d: %d records -> %s"
               % (year, len(records), ", ".join(os.path.basename(p) for p in paths)))
        return {"new_year": year, "count": len(records)}

    return {"new_year": None, "count": 0}


# --------------------------------------------------------------------------
# QCE26: schedule -> DOI reconciliation
# --------------------------------------------------------------------------

def update_qce26(log_fn=log):
    """Idempotently reconcile the QCE26 schedule against published DOI records."""
    if reco is None:
        warn("reconcile_qce26 unavailable; skipping QCE26 reconciliation")
        return {"replaced": 0, "entries": 0}

    schedule_path = os.path.join(QCE26_DIR, "papers_data.py")
    if not os.path.exists(schedule_path):
        log_fn("[qce26] schedule file missing; skipping reconciliation")
        return {"replaced": 0, "entries": 0}

    replaced = reco.reconcile(year=reco.DEFAULT_YEAR, log=log_fn)
    return {"replaced": len(replaced), "entries": len(replaced)}


# --------------------------------------------------------------------------
# entry point
# --------------------------------------------------------------------------

def main(argv=None):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

    log("=== paper4qi data update (%s) ===" % _today().isoformat())

    state = load_state()
    log("[state] %s" % state)

    tqe_since = window_start(state["last_tqe_run"])
    qce_since = window_start(state["last_qce_run"])
    log("[state] TQE window since %s | QCE window since %s" % (tqe_since, qce_since))

    today = _today().isoformat()
    summary = {"tqe": None, "qce": None, "qce26": None}

    try:
        summary["tqe"] = update_tqe(tqe_since)
        state["last_tqe_run"] = today
    except Exception as err:
        warn("TQE update failed: %s" % err)
        traceback.print_exc()

    try:
        summary["qce"] = update_qce()
        state["last_qce_run"] = today
    except Exception as err:
        warn("QCE update failed: %s" % err)
        traceback.print_exc()

    try:
        summary["qce26"] = update_qce26()
    except Exception as err:
        warn("QCE26 reconciliation failed: %s" % err)
        traceback.print_exc()

    try:
        if summary["tqe"] is not None or summary["qce"] is not None:
            save_state(state)
            log("[state] wrote %s" % STATE_PATH)
    except Exception as err:
        warn("could not write state file: %s" % err)

    # ---- diff summary -----------------------------------------------------
    log("=== summary ===")
    tqe = summary["tqe"]
    if tqe is None:
        log("TQE: FAILED (existing data kept)")
    else:
        log("TQE: +%d new, %d cited_by refreshed, %d skipped (foreign DOI), %d records total"
            % (tqe["added"], tqe["refreshed"], tqe["skipped"], tqe["total"]))
        if tqe["unchanged"]:
            log("TQE: no data changes")

    qce = summary["qce"]
    if qce is None:
        log("QCE: FAILED (existing data kept)")
    elif qce["new_year"]:
        log("QCE: new year %d -> %d records" % (qce["new_year"], qce["count"]))
    else:
        log("QCE: no new year published")

    qce26 = summary["qce26"]
    if qce26 is None:
        log("QCE26: reconcile FAILED")
    else:
        log("QCE26: %d schedule entries replaced by DOI records" % qce26["replaced"])

    log("=== done ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
