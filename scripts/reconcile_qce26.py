#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Reconcile the QCE26 official schedule with the published proceedings.

Before IEEE Xplore publishes the QCE 2026 proceedings the site is driven by the
official paper schedule (``data_src/qce26/papers_data.py``, 372 entries keyed
``{TRACK}-{row}``).  Once the proceedings land in Crossref, ``data_src/qce/data_2026.json``
holds the authoritative DOI records.

This script matches the two title sets and writes
``data_src/qce/replaced_qce26.json`` = ``{"{TRACK}-{row}": "<doi>"}``.
``scripts/build_data.py`` reads that file and drops the schedule entries whose
published DOI record is already present, so nothing is double-counted.

Matching is title-only and deterministic:

* normalise (HTML-unescape, lower-case, strip punctuation, collapse whitespace);
* exact normalised match, otherwise token-set Jaccard >= ``threshold`` (0.9);
* arXiv titles already recorded in ``data_src/qce26/arxiv_matches.json`` are
  accepted as aliases of their schedule entry (published titles sometimes drift
  from the schedule PDF).

Re-running is idempotent: the same inputs always produce the same mapping.

Standalone usage::

    python scripts/reconcile_qce26.py [--year 2026] [--threshold 0.9] [--dry-run]
"""

from __future__ import annotations

import argparse
import glob
import html
import importlib.util
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import lib_fetch  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_SRC = os.path.join(REPO_ROOT, "data_src")
QCE_DIR = os.path.join(DATA_SRC, "qce")
QCE26_DIR = os.path.join(DATA_SRC, "qce26")
SCHEDULE_PY = os.path.join(QCE26_DIR, "papers_data.py")
ARXIV_MATCHES = os.path.join(QCE26_DIR, "arxiv_matches.json")
REPLACED_JSON = os.path.join(QCE_DIR, "replaced_qce26.json")

DEFAULT_YEAR = 2026
DEFAULT_THRESHOLD = 0.9
#: Below this many tokens a Jaccard score is meaningless -> exact match only.
MIN_FUZZY_TOKENS = 3

_PUNCT = re.compile(r"[^a-z0-9]+")


# --------------------------------------------------------------------------
# loading
# --------------------------------------------------------------------------

def load_schedule(path=None, arxiv_path=ARXIV_MATCHES, log=print):
    """Return ``[{key, track, row, title, aliases}, ...]`` from papers_data.py."""
    path = path or SCHEDULE_PY
    if not os.path.exists(path):
        raise FileNotFoundError("schedule file not found: %s" % path)

    spec = importlib.util.spec_from_file_location("_paper4qi_qce26_schedule", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    arxiv = lib_fetch.load_json(arxiv_path, {}) or {}

    entries = []
    for track, rows in (getattr(module, "PAPERS", {}) or {}).items():
        for row in rows:
            # entry format: [row, day, time, session, authors, title, best_rank, best_track]
            number, title = row[0], row[5]
            key = "%s-%s" % (track, number)
            aliases = [title]
            match = arxiv.get(key) or {}
            if match.get("status") == "match" and match.get("arxiv_title"):
                aliases.append(match["arxiv_title"])
            entries.append({"key": key, "track": track, "row": number,
                            "title": title, "aliases": aliases})

    log("[reconcile] schedule entries: %d (%s)" % (len(entries), os.path.basename(path)))
    return entries


def load_qce_records(year=DEFAULT_YEAR, qce_dir=None, log=print):
    """Return ``[{"doi": ..., "title": ...}, ...]`` from ``qce/data_{year}.json``."""
    path = os.path.join(qce_dir or QCE_DIR, "data_%d.json" % year)
    raw = lib_fetch.load_json(path)
    if raw is None:
        log("[reconcile] no proceedings file yet: %s" % path)
        return []
    records = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        doi = lib_fetch.normalize_doi(item.get("d") or item.get("doi"))
        title = item.get("t") or item.get("title") or ""
        if doi and title:
            records.append({"doi": doi, "title": title})
    log("[reconcile] proceedings records (%d): %d" % (year, len(records)))
    return records


# --------------------------------------------------------------------------
# matching
# --------------------------------------------------------------------------

def normalize_title(title):
    """Lower-case, HTML-unescape, drop punctuation, collapse whitespace."""
    text = html.unescape(title or "")
    text = _PUNCT.sub(" ", text.lower())
    return " ".join(text.split())


def token_set(title):
    return frozenset(normalize_title(title).split())


def jaccard(a, b):
    if not a or not b:
        return 0.0
    union = len(a | b)
    return (len(a & b) / union) if union else 0.0


def match_titles(entries, records, threshold=DEFAULT_THRESHOLD):
    """Greedily map each schedule entry to its best DOI record.

    Returns ``(matches, unmatched_entries, unmatched_records)`` where ``matches``
    is ``{key: doi}``.  Exact normalised matches always win (score 2.0); fuzzy
    matches need Jaccard >= ``threshold``.  Ties resolve to the earliest record,
    which keeps the output stable across runs.
    """
    entry_norm = []
    for entry in entries:
        norms = [normalize_title(a) for a in entry["aliases"]]
        toks = [token_set(a) for a in entry["aliases"]]
        entry_norm.append((entry, norms, toks))

    rec_norm = []
    for record in records:
        rec_norm.append((record, normalize_title(record["title"]),
                         token_set(record["title"])))

    matches = {}
    unmatched_entries = []
    used_records = set()

    for entry, norms, toks in entry_norm:
        best_score, best_index = 0.0, None
        for index, (_record, rec_norm_title, rec_toks) in enumerate(rec_norm):
            score = 0.0
            if any(n and n == rec_norm_title for n in norms):
                score = 2.0
            else:
                for alias_toks in toks:
                    if len(alias_toks) < MIN_FUZZY_TOKENS or len(rec_toks) < MIN_FUZZY_TOKENS:
                        continue
                    score = max(score, jaccard(alias_toks, rec_toks))
            if score > best_score:
                best_score, best_index = score, index
        if best_index is not None and best_score >= threshold:
            doi = records[best_index]["doi"]
            matches[entry["key"]] = doi
            used_records.add(best_index)
        else:
            unmatched_entries.append(entry)

    unmatched_records = [rec for i, rec in enumerate(records) if i not in used_records]
    return matches, unmatched_entries, unmatched_records


# --------------------------------------------------------------------------
# entry point
# --------------------------------------------------------------------------

def reconcile(year=DEFAULT_YEAR, records=None, threshold=DEFAULT_THRESHOLD,
              qce_dir=None, schedule_path=None, out_path=None,
              dry_run=False, log=print):
    """Match schedule titles against proceedings records and write the mapping.

    Returns the ``{key: doi}`` mapping (empty when the proceedings are not out yet).
    """
    qce_dir = qce_dir or QCE_DIR
    out_path = out_path or REPLACED_JSON
    if records is None:
        records = load_qce_records(year, qce_dir=qce_dir, log=log)
    if not records:
        log("[reconcile] nothing to do (no proceedings records for %d)" % year)
        return {}

    entries = load_schedule(schedule_path, log=log)
    if not entries:
        log("[reconcile] nothing to do (empty schedule)")
        return {}

    matches, unmatched_entries, unmatched_records = match_titles(entries, records,
                                                                threshold=threshold)

    log("[reconcile] matched %d/%d schedule entries to published DOIs"
        % (len(matches), len(entries)))
    log("[reconcile] proceedings records not used to replace a schedule entry: %d"
        % len(unmatched_records))

    if unmatched_entries:
        log("[reconcile] UNMATCHED schedule entries (%d) -- needs manual review:"
            % len(unmatched_entries))
        for entry in unmatched_entries:
            log("  %-12s %s" % (entry["key"], entry["title"]))

    if matches:
        ordered = {entry["key"]: matches[entry["key"]]
                   for entry in entries if entry["key"] in matches}
        if dry_run:
            log("[reconcile] dry-run: would write %d mappings to %s"
                % (len(ordered), out_path))
        else:
            lib_fetch.atomic_write_json(out_path, ordered, indent=0)
            log("[reconcile] wrote %s (%d mappings)" % (out_path, len(ordered)))
        return ordered

    if os.path.exists(out_path):
        log("[reconcile] no matches; leaving existing %s untouched" % out_path)
    else:
        log("[reconcile] no matches; not creating %s" % out_path)
    return {}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--year", type=int, default=DEFAULT_YEAR,
                        help="proceedings year to reconcile (default: %(default)s)")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD,
                        help="Jaccard threshold for fuzzy title matches (default: %(default)s)")
    parser.add_argument("--dry-run", action="store_true",
                        help="print the mapping without writing replaced_qce26.json")
    args = parser.parse_args(argv)

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    reconcile(year=args.year, threshold=args.threshold, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
