#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HTTP helpers for the paper4qi data pipeline.

Standard library only (``urllib``), so it runs unchanged on GitHub Actions and
on a bare Windows Python.

Public API
----------
get(url, params=None, retries=4, timeout=60, headers=None, raw=False)
    Generic JSON GET with UA header + exponential backoff (2s/4s/8s).
crossref_works(filter=None, query=None, rows=200, cursor="*")
    Iterator over Crossref ``message.items`` batches (cursor pagination).
openalex_works_by_doi(doi)
    Single OpenAlex work (``None`` on 404).
openalex_works_by_source(source_id, per_page=200, select=...)
    Iterator over OpenAlex ``results`` batches (cursor pagination).
inv_to_text(inverted_index)
    Rebuild plain text from an OpenAlex ``abstract_inverted_index``.
arxiv_request(**params)
    arXiv Atom API GET (non-Python UA, >= 4 s between calls), returns parsed XML.
normalize_doi(doi), atomic_write_json(path, obj)
    Small shared utilities.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

USER_AGENT = "paper4qi/1.0 (mailto:research@example.com)"

CROSSREF_BASE = "https://api.crossref.org"
OPENALEX_BASE = "https://api.openalex.org"
ARXIV_API = "https://export.arxiv.org/api/query"

#: Backoff between retries, per attempt index.
BACKOFF = (2, 4, 8)
#: Minimum pause between successful crossref/openalex batches (be polite).
BATCH_PAUSE = 0.5
#: arXiv enforces an IP-level rate limit; never hit it faster than this.
ARXIV_MIN_INTERVAL = 4.0

#: OpenAlex `select` used for the source-wide crawl (keeps payloads small).
OPENALEX_SOURCE_SELECT = ",".join([
    "doi", "title", "publication_year", "publication_date",
    "abstract_inverted_index", "cited_by_count", "authorships", "biblio",
    "primary_location", "keywords", "topics",
])

_last_arxiv_call = [0.0]


class FetchError(RuntimeError):
    """Raised when a request keeps failing after all retries."""


def normalize_doi(doi):
    """Lower-case a DOI and strip any URL/prefix decoration."""
    if not doi:
        return ""
    doi = str(doi).strip().lower()
    for prefix in ("https://doi.org/", "http://doi.org/",
                   "https://dx.doi.org/", "http://dx.doi.org/",
                   "doi:"):
        if doi.startswith(prefix):
            doi = doi[len(prefix):]
    return doi.strip()


def _sleep_for(attempt, err=None):
    """Exponential backoff; longer for 429/503, honouring Retry-After."""
    wait = BACKOFF[min(attempt, len(BACKOFF) - 1)]
    code = getattr(err, "code", None)
    if code in (429, 503):
        wait = max(wait, 10)
        retry_after = None
        try:
            retry_after = (getattr(err, "headers", None) or {}).get("Retry-After")
        except Exception:
            retry_after = None
        if retry_after:
            try:
                wait = max(wait, min(int(retry_after), 60))
            except (TypeError, ValueError):
                pass
    if wait > 0:
        time.sleep(wait)


def get(url, params=None, retries=4, timeout=60, headers=None, raw=False):
    """GET ``url`` and parse the body as JSON.

    ``params`` is urlencoded and appended (dict values may be lists).
    Retries with exponential backoff (2s/4s/8s) on any transient failure.
    404 is raised immediately (not retried) so callers can map it to ``None``.
    """
    if params:
        query = urllib.parse.urlencode(params, doseq=True)
        sep = "&" if urllib.parse.urlparse(url).query else "?"
        url = url + sep + query

    hdrs = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if headers:
        hdrs.update(headers)

    attempts = max(1, int(retries))
    last_err = None
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers=hdrs)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = resp.read()
            if raw:
                return body
            return json.loads(body.decode("utf-8"))
        except urllib.error.HTTPError as err:
            last_err = err
            if err.code == 404:
                raise
            if attempt < attempts - 1:
                _sleep_for(attempt, err)
        except Exception as err:  # URLError, timeout, JSON decode, ...
            last_err = err
            if attempt < attempts - 1:
                _sleep_for(attempt, err)

    raise FetchError("GET failed after %d attempts: %s (%s)" % (attempts, url, last_err))


# --------------------------------------------------------------------------
# Crossref
# --------------------------------------------------------------------------

def crossref_works(filter=None, query=None, rows=200, cursor="*", select=None,
                   timeout=60):
    """Iterate Crossref ``/works`` result batches.

    Yields one ``message.items`` list per request until the cursor is exhausted.
    """
    rows = max(1, min(int(rows), 1000))
    while True:
        params = {"rows": rows, "cursor": cursor}
        if filter:
            params["filter"] = filter
        if query:
            params["query"] = query
        if select:
            params["select"] = select

        data = get(CROSSREF_BASE + "/works", params=params, timeout=timeout)
        message = (data or {}).get("message") or {}
        items = message.get("items") or []
        if items:
            yield items

        next_cursor = message.get("next-cursor")
        if not items or not next_cursor or next_cursor == cursor:
            return
        cursor = next_cursor
        time.sleep(BATCH_PAUSE)


def crossref_works_total(filter=None, query=None, select="DOI", timeout=60):
    """Cheap probe: return ``message.total-results`` for a filter (or ``None``)."""
    params = {"rows": 1, "select": select}
    if filter:
        params["filter"] = filter
    if query:
        params["query"] = query
    data = get(CROSSREF_BASE + "/works", params=params, timeout=timeout)
    total = ((data or {}).get("message") or {}).get("total-results")
    return total


# --------------------------------------------------------------------------
# OpenAlex
# --------------------------------------------------------------------------

def openalex_works_by_doi(doi, timeout=60):
    """Fetch a single OpenAlex work by DOI; return ``None`` when unknown (404)."""
    doi = normalize_doi(doi)
    if not doi:
        return None
    url = "%s/works/https://doi.org/%s" % (OPENALEX_BASE, urllib.parse.quote(doi, safe=""))
    try:
        return get(url, params={"mailto": "research@example.com"}, timeout=timeout)
    except urllib.error.HTTPError as err:
        if err.code == 404:
            return None
        raise


def openalex_works_by_source(source_id, per_page=200, select=OPENALEX_SOURCE_SELECT,
                             timeout=60):
    """Iterate OpenAlex ``results`` batches for ``primary_location.source.id``."""
    per_page = max(1, min(int(per_page), 200))
    cursor = "*"
    while True:
        params = {
            "filter": "primary_location.source.id:%s" % source_id,
            "per-page": per_page,
            "cursor": cursor,
        }
        if select:
            params["select"] = select

        data = get(OPENALEX_BASE + "/works", params=params, timeout=timeout)
        results = (data or {}).get("results") or []
        if results:
            yield results

        next_cursor = ((data or {}).get("meta") or {}).get("next_cursor")
        if not results or not next_cursor or next_cursor == cursor:
            return
        cursor = next_cursor
        time.sleep(BATCH_PAUSE)


_SENTINEL = ",.!?;:()[]{}\"'`-/"
_WORD_SPLIT = re.compile(r"\s+")


def inv_to_text(inv):
    """Rebuild plain text from an OpenAlex ``abstract_inverted_index``."""
    if not inv:
        return None
    n = 0
    for positions in inv.values():
        if positions:
            n = max(n, max(positions) + 1)
    if n == 0:
        return None
    words = [""] * n
    for word, positions in inv.items():
        for pos in positions or []:
            if 0 <= pos < n:
                words[pos] = word
    text = " ".join(w for w in words if w)
    return text or None


# --------------------------------------------------------------------------
# arXiv (optional; used by reconcile_qce26.py)
# --------------------------------------------------------------------------

def arxiv_request(timeout=60, retries=3, **params):
    """Call the arXiv Atom API and return the parsed XML root element.

    The API rejects the stock Python UA with HTTP 406, so the shared
    ``USER_AGENT`` is mandatory.  Calls are serialised to >= 4 s apart because
    arXiv rate limits aggressively (429/503).
    """
    global _last_arxiv_call
    pause = ARXIV_MIN_INTERVAL - (time.time() - _last_arxiv_call[0])
    if pause > 0:
        time.sleep(pause)

    query = urllib.parse.urlencode(params, doseq=True)
    url = ARXIV_API + ("?" + query if query else "")
    try:
        # arXiv returns Atom XML even on success; request bytes and parse.
        body = get(url, params=None, retries=retries, timeout=timeout, raw=True)
        return ET.fromstring(body)
    finally:
        _last_arxiv_call[0] = time.time()


# --------------------------------------------------------------------------
# Shared file helpers
# --------------------------------------------------------------------------

def atomic_write_json(path, obj, indent=None):
    """Write JSON via a temp file + ``os.replace`` so readers never see partial data."""
    directory = os.path.dirname(os.path.abspath(path)) or "."
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tmp-", suffix=".json", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(obj, handle, ensure_ascii=False, indent=indent)
            handle.write("\n")
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def load_json(path, default=None):
    """Load JSON, returning ``default`` when the file is missing or corrupt."""
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        return default
    except (ValueError, OSError):
        return default
