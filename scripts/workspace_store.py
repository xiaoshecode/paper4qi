"""Versioned local research workspace; never persist credentials.

The single JSON state is atomically replaced under an in-process lock. Run only
one workspace writer per checkout. Only an explicit reviewed snapshot is public.
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
import re
import threading
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from lib_fetch import atomic_write_json, normalize_doi
from lib_taxonomy import CAT_ORDER


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class ConflictError(ValueError):
    """The caller edited an older version; no write was performed."""


def read_json(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else copy.deepcopy(default)


def empty_state():
    return {"schema_version": 1, "venue_revision": 0, "articles": {}, "analyses": {},
            "discoveries": {}, "checkpoints": {}, "pending_windows": {}, "id_redirects": {}}


def analysis_fingerprint(paper):
    return hashlib.sha256(json.dumps({k: paper.get(k) for k in
        ("title", "abstract", "doi", "venue", "year")}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def current_analysis(paper, analysis, check_model=True):
    from deepseek_client import DEFAULT_MODEL
    if (analysis and analysis.get("workspace_input_hash") == analysis_fingerprint(paper)
            and (not check_model or analysis.get("model") == os.environ.get("DEEPSEEK_MODEL", DEFAULT_MODEL))):
        return copy.deepcopy(analysis)
    return None


class WorkspaceLease:
    """Cross-process single-writer lease; released automatically on process exit."""
    def __init__(self, root):
        self.handle = open(Path(root) / ".workspace.lock", "a+b")
        try:
            if os.name == "nt":
                import msvcrt
                self.handle.write(b"0")
                self.handle.flush()
                self.handle.seek(0)
                msvcrt.locking(self.handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self.handle.close()
            raise RuntimeError("Another workspace writer is active in this checkout; stop it first") from None

    def close(self):
        self.handle.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


def validate_content(content):
    required = {"title", "zh", "category", "tags", "body"}
    if not isinstance(content, dict) or set(content) != required:
        raise ValueError("Content must contain title, zh, category, tags and body only")
    for key, limit in (("title", 2000), ("zh", 12000), ("body", 40000)):
        if not isinstance(content[key], str) or len(content[key]) > limit:
            raise ValueError(f"Invalid {key} (maximum {limit} characters)")
    if not content["title"].strip():
        raise ValueError("Title is required")
    if content["category"] not in CAT_ORDER:
        raise ValueError("Unknown category")
    if (not isinstance(content["tags"], list) or len(content["tags"]) > 20
            or any(not isinstance(t, str) or not t.strip() or len(t) > 100 for t in content["tags"])):
        raise ValueError("Tags must be up to 20 nonempty strings, each under 100 characters")
    return copy.deepcopy(content)


def validate_venues(venues):
    if not isinstance(venues, list) or not 1 <= len(venues) <= 50:
        raise ValueError("Configure between 1 and 50 venues")
    seen = set()
    for venue in venues:
        if not isinstance(venue, dict) or set(venue) - {
                "id", "name", "kind", "issn", "container_title", "enabled", "keywords"}:
            raise ValueError("Invalid venue fields")
        identifier = venue.get("id", "")
        if not isinstance(identifier, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", identifier) or identifier in seen:
            raise ValueError("Venue IDs must be unique lowercase names")
        seen.add(identifier)
        if not isinstance(venue.get("name"), str) or not 1 <= len(venue["name"].strip()) <= 200:
            raise ValueError("Venue name is required (maximum 200 characters)")
        if not isinstance(venue.get("enabled"), bool):
            raise ValueError("Venue enabled must be a boolean")
        if venue.get("kind") == "journal":
            if not isinstance(venue.get("issn"), str) or not re.fullmatch(r"\d{4}-\d{3}[\dXx]", venue["issn"]):
                raise ValueError("Journal requires an ISSN, e.g. 2689-1808")
        elif venue.get("kind") == "conference":
            title = venue.get("container_title")
            if not isinstance(title, str) or not 1 <= len(title.strip()) <= 300:
                raise ValueError("Conference requires an exact container title")
        else:
            raise ValueError("Venue kind must be journal or conference")
        keywords = venue.get("keywords", [])
        if not isinstance(keywords, list) or len(keywords) > 30 or any(
                not isinstance(k, str) or not 1 <= len(k.strip()) <= 100 for k in keywords):
            raise ValueError("Keywords must be up to 30 nonempty strings")
    return copy.deepcopy(venues)


def apply_editorial_overlays(papers, state):
    """Human-saved revisions override annotations; AI drafts never auto-publish."""
    for paper in papers:
        article = state.get("articles", {}).get(paper["id"])
        if article:
            content = validate_content({k: article[k] for k in ("title", "zh", "category", "tags", "body")})
            paper.update({key: content[key] for key in ("title", "zh", "category", "tags")})


def public_snapshot(state, venues):
    """Explicitly reviewed research is public; runtime identity and secrets are not."""
    article_fields = ("title", "zh", "category", "tags", "body")
    articles = {}
    for identifier, article in state.get("articles", {}).items():
        content = validate_content({key: article[key] for key in article_fields})
        history = []
        for entry in article.get("history", []):
            if (type(entry.get("revision")) is not int or entry["revision"] < 1
                    or not isinstance(entry.get("summary"), str) or len(entry["summary"]) > 500
                    or not isinstance(entry.get("at"), str)):
                raise ValueError("Invalid public research revision")
            history.append({"revision": entry["revision"], "at": entry["at"],
                            "summary": entry["summary"], "content": validate_content(entry["content"])})
        if (type(article.get("revision")) is not int or article["revision"] < 0
                or len({entry["revision"] for entry in history}) != len(history)
                or any(entry["revision"] > article["revision"] for entry in history)):
            raise ValueError("Invalid public article revision history")
        if article.get("updated_at") is not None and not isinstance(article["updated_at"], str):
            raise ValueError("Invalid public article update time")
        articles[identifier] = {**content, "revision": article["revision"],
                                "updated_at": article.get("updated_at"), "history": history}
    paper_fields = ("id", "doi", "title", "authors", "abstract", "year", "venue", "source",
                    "source_id", "category", "tags", "zh", "published", "published_precision",
                    "url", "source_url", "licenses", "followed_venue_id", "indexed", "discovered_at", "first_seen_at", "last_seen_at", "front_matter")
    discoveries = {}
    for identifier, paper in state.get("discoveries", {}).items():
        record = {key: copy.deepcopy(paper[key]) for key in paper_fields if key in paper}
        if "licenses" in record:
            record["licenses"] = [{key: entry[key] for key in ("url", "content_version", "start") if key in entry}
                                  for entry in record["licenses"]]
            if any(not isinstance(value, str) for entry in record["licenses"] for value in entry.values()):
                raise ValueError("Invalid public discovery license")
        for key, value in record.items():
            if key == "licenses":
                continue
            if key in ("authors", "tags"):
                valid = isinstance(value, list) and all(isinstance(entry, str) for entry in value)
            elif key == "year":
                valid = type(value) is int
            elif key == "front_matter":
                valid = type(value) is bool
            else:
                valid = value is None or isinstance(value, str)
            if not valid:
                raise ValueError("Invalid public discovery field")
        discoveries[identifier] = record
    analysis_fields = ("category", "summary", "contributions", "limitations", "evidence_basis",
                       "confidence", "tags", "model", "generated_at", "input_hash", "workspace_input_hash")
    analyses = {identifier: {key: copy.deepcopy(analysis[key]) for key in analysis_fields if key in analysis}
                for identifier, analysis in state.get("analyses", {}).items()}
    # Generated provider data has only text/numeric/list fields, never nested identity records.
    for analysis in analyses.values():
        for key, value in analysis.items():
            if key in ("contributions", "limitations", "tags"):
                if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
                    raise ValueError("Invalid public AI draft list")
            elif key == "confidence":
                if type(value) not in (int, float) or not 0 <= value <= 1:
                    raise ValueError("Invalid public AI draft confidence")
            elif not isinstance(value, str):
                raise ValueError("Invalid public AI draft field")
    return {"schema_version": 1, "articles": articles, "analyses": analyses,
            "discoveries": discoveries, "venues": validate_venues(venues),
            "id_redirects": {key: value for key, value in state.get("id_redirects", {}).items()
                             if isinstance(key, str) and isinstance(value, str)}}


def merge_article_versions(first, second):
    """Merge one shared revision chain, refusing independently edited content."""
    fields = ("title", "zh", "category", "tags", "body")
    low, high = sorted((first, second), key=lambda article: article["revision"])
    low_content = {key: low[key] for key in fields}
    high_content = {key: high[key] for key in fields}
    history = {entry["revision"]: copy.deepcopy(entry) for entry in high.get("history", [])}
    if low["revision"] == high["revision"]:
        compatible = low_content == high_content
    else:
        compatible = low["revision"] == 0 or history.get(low["revision"], {}).get("content") == low_content
    if not compatible:
        raise ConflictError("Record IDs now refer to the same paper but their Wiki versions conflict; review and reconcile both histories before saving")
    for entry in low.get("history", []):
        existing = history.get(entry["revision"])
        if existing and existing != entry:
            raise ConflictError("Wiki revision histories diverge; neither version was overwritten")
        history[entry["revision"]] = copy.deepcopy(entry)
    return {**copy.deepcopy(high), "history": [history[key] for key in sorted(history)]}


def canonicalize_workspace(state, papers, redirects=None):
    """Retire discoveries/old program IDs without losing the shared Wiki history."""
    state = copy.deepcopy(state)
    ids = {paper["id"] for paper in papers}
    by_doi = {normalize_doi(paper.get("doi")): paper["id"] for paper in papers if paper.get("doi")}
    aliases = {**state.get("id_redirects", {}), **(redirects or {})}
    for identifier in set(state.get("discoveries", {})) | set(state.get("articles", {})) | set(state.get("analyses", {})):
        doi = normalize_doi(identifier[len("discovery:"):]) if identifier.startswith("discovery:") else ""
        if doi in by_doi:
            aliases[identifier] = by_doi[doi]
    for old, target in list(aliases.items()):
        visited = {old}
        while target in aliases and target not in visited:
            visited.add(target)
            target = aliases[target]
        if target in visited:
            raise ConflictError("Workspace ID redirect cycle; no content was changed")
        if target not in ids:
            continue
        aliases[old] = target
        if old in state.get("articles", {}):
            prior = state["articles"].pop(old)
            state["articles"][target] = (merge_article_versions(prior, state["articles"][target])
                                          if target in state["articles"] else prior)
        if old in state.get("analyses", {}):
            draft = state["analyses"].pop(old)
            if target in state["analyses"] and state["analyses"][target] != draft:
                raise ConflictError("Migrated paper has two different AI drafts; review both before resolving its ID")
            state["analyses"][target] = draft
        state.get("discoveries", {}).pop(old, None)
    state["id_redirects"] = aliases
    return state


def source_redirects(source_dir):
    replaced = read_json(Path(source_dir) / "qce/replaced_qce26.json", {})
    return {f"qce26:{key}": f"qce:{normalize_doi(doi)}" for key, doi in replaced.items()}


def read_public_snapshot(source_dir, papers=None):
    source_dir = Path(source_dir)
    defaults = read_json(source_dir / "followed_venues.json", {"venues": []})
    state = read_json(source_dir / "workspace-public.json", empty_state())
    if state.get("schema_version") != 1:
        raise ValueError("Unsupported public snapshot schema")
    # Sanitize again so even a hand-edited snapshot cannot export private fields.
    snapshot = public_snapshot(state, state.get("venues", defaults["venues"]))
    return canonicalize_workspace(snapshot, papers, source_redirects(source_dir)) if papers is not None else snapshot


def prepare_public_snapshot(root):
    """Explicit local publication preparation; does not commit, push or deploy."""
    root = Path(root)
    papers = read_json(root / "public/data/papers.json", {"papers": []})["papers"]
    published = read_public_snapshot(root / "data_src", papers)
    state = read_json(root / "data_src/workspace.json", published)
    defaults = read_json(root / "data_src/followed_venues.json", {"venues": []})
    payload = canonicalize_workspace(public_snapshot(state, state.get("venues", defaults["venues"])),
                                     papers, source_redirects(root / "data_src"))
    # A pulled public snapshot may have advanced independently of private state.
    # Keep public-only records and refuse to overwrite newer/divergent revisions.
    for identifier, article in published["articles"].items():
        local = payload["articles"].get(identifier)
        if local:
            if local["revision"] < article["revision"]:
                raise ConflictError("Public snapshot has newer or conflicting article content; reconcile it with local edits before preparing publication")
            payload["articles"][identifier] = merge_article_versions(article, local)
    payload["articles"] = {**published["articles"], **payload["articles"]}
    payload["discoveries"] = {**published["discoveries"], **payload["discoveries"]}
    payload["analyses"] = {**published["analyses"], **payload["analyses"]}
    payload["id_redirects"] = {**published["id_redirects"], **payload["id_redirects"]}
    payload = canonicalize_workspace(payload, papers, source_redirects(root / "data_src"))
    atomic_write_json(str(root / "data_src/workspace-public.json"), payload, indent=2)
    return payload


def export_workspace(source_dir, out_dir, generated, corpus=None):
    if corpus is None:
        corpus = read_json(Path(out_dir) / "papers.json", {"papers": []})["papers"]
    state = read_public_snapshot(source_dir, corpus)
    papers = list(copy.deepcopy(state["discoveries"]).values())
    apply_editorial_overlays(papers, state)
    payload = {"schema_version": 1, "generated": generated, "papers": papers,
               "articles": state["articles"], "analyses": state["analyses"], "venues": state["venues"],
               "id_redirects": state["id_redirects"],
               "notice": "Explicit public research snapshot, including Wiki versions, edit summaries and unadopted AI drafts. Drafts are not reviewed claims. Runtime credentials, identities and checkpoints are excluded. Discovery inbox is separate from QCE/TQE statistics."}
    atomic_write_json(str(Path(out_dir) / "workspace.json"), payload)
    return payload


class WorkspaceStore:
    def __init__(self, root):
        self.root = Path(root)
        self.path = self.root / "data_src/workspace.json"
        self.lock = threading.RLock()
        self.refresh_lock = threading.Lock()
        self.analysis_lock = threading.Lock()
        if self.path.exists():
            self.state = read_json(self.path, empty_state())
        else:
            # A fresh checkout can continue editing its last reviewed snapshot.
            # Only explicitly published research history is restored.
            self.state = {**empty_state(), **read_public_snapshot(self.root / "data_src")}
        if self.state.get("schema_version") != 1:
            raise ValueError("Unsupported workspace schema")
        self.state.setdefault("pending_windows", {})
        self.state.setdefault("id_redirects", {})
        self.defaults = read_json(self.root / "data_src/followed_venues.json", {"venues": []})

    def _commit(self, state):
        atomic_write_json(str(self.path), state)
        self.state = state

    def corpus(self):
        papers = read_json(self.root / "public/data/papers.json", {"papers": []})["papers"]
        if not papers:
            raise ValueError("Run python scripts/build_data.py before starting the workspace")
        return papers

    def papers(self):
        with self.lock:
            papers = self.corpus()
            redirects = read_json(self.root / "public/data/id-redirects.json", {"redirects": []})["redirects"]
            aliases = {entry["old_id"]: entry["new_id"] for entry in redirects}
            canonical = canonicalize_workspace(self.state, papers, aliases)
            if canonical != self.state:
                self._commit(canonical)
            discoveries = list(copy.deepcopy(self.state["discoveries"]).values())
            apply_editorial_overlays(papers + discoveries, self.state)
            return {"papers": papers, "discoveries": discoveries}

    def _paper(self, identifier):
        if not isinstance(identifier, str) or not 1 <= len(identifier) <= 400:
            raise ValueError("Invalid paper ID")
        data = self.papers()
        identifier = self.state.get("id_redirects", {}).get(identifier, identifier)
        paper = next((p for p in data["papers"] + data["discoveries"] if p["id"] == identifier), None)
        if not paper:
            raise ValueError("Unknown paper ID")
        return paper

    def article(self, identifier):
        with self.lock:
            paper = self._paper(identifier)
            identifier = paper["id"]
            article = self.state["articles"].get(identifier) or {
                "revision": 0, "title": paper["title"], "zh": paper.get("zh") or "",
                "category": paper.get("category", "OTHER"), "tags": paper.get("tags", []),
                "body": "", "updated_at": None, "history": []}
            return copy.deepcopy({"paper": paper, "article": article,
                                  "analysis": current_analysis(paper, self.state["analyses"].get(identifier))})

    def save_article(self, identifier, expected_revision, content, summary):
        content = validate_content(content)
        if type(expected_revision) is not int or expected_revision < 0:
            raise ValueError("expected_revision must be a nonnegative integer")
        if not isinstance(summary, str) or not 1 <= len(summary.strip()) <= 500:
            raise ValueError("Describe the edit in 1–500 characters")
        with self.lock:
            selected = self.article(identifier)
            identifier = selected["paper"]["id"]
            prior = selected["article"]
            if prior["revision"] != expected_revision:
                raise ConflictError("This article changed. Reload its history before saving; your draft was not saved.")
            revision, at = expected_revision + 1, now()
            history = prior["history"] + [{"revision": revision, "at": at,
                                           "summary": summary.strip(), "content": content}]
            article = {**content, "revision": revision, "updated_at": at, "history": history}
            state = copy.deepcopy(self.state)
            state["articles"][identifier] = article
            self._commit(state)
            return copy.deepcopy(article)

    def restore(self, identifier, expected_revision, revision, summary):
        with self.lock:
            if type(revision) is not int:
                raise ValueError("Invalid restore revision")
            prior = self.article(identifier)["article"]
            entry = next((r for r in prior["history"] if r["revision"] == revision), None)
            if entry is None:
                raise ValueError("Unknown revision")
            return self.save_article(identifier, expected_revision, entry["content"], summary)

    def venues(self):
        with self.lock:
            return copy.deepcopy({"venues": self.state.get("venues", self.defaults["venues"]),
                                  "revision": self.state["venue_revision"]})

    def save_venues(self, venues, expected_revision):
        venues = validate_venues(venues)
        with self.lock:
            if type(expected_revision) is not int or self.state["venue_revision"] != expected_revision:
                raise ConflictError("Venue configuration changed; reload before saving")
            prior = {v["id"]: v for v in self.venues()["venues"]}
            state = copy.deepcopy(self.state)
            for venue in venues:
                if prior.get(venue["id"]) != venue:
                    state["checkpoints"].pop(venue["id"], None)
                    state["pending_windows"].pop(venue["id"], None)
            state["venues"] = venues
            state["venue_revision"] += 1
            self._commit(state)
            return self.venues()

    def refresh(self, fetcher=None, today=None, lookback=30, max_items=100):
        from research_sources import fetch_venue
        fetcher = fetcher or fetch_venue
        today = today or date.today()
        if not self.refresh_lock.acquire(blocking=False):
            raise ConflictError("A refresh is already running")
        try:
            config = self.venues()
            report = {"added": 0, "updated": 0, "sources": []}
            known_dois = {normalize_doi(p.get("doi")) for p in self.papers()["papers"]} - {""}
            for venue in config["venues"]:
                if not venue["enabled"]:
                    continue
                with self.lock:
                    checkpoint = self.state["checkpoints"].get(venue["id"])
                    pending = copy.deepcopy(self.state["pending_windows"].get(venue["id"]))
                since = ((date.fromisoformat(checkpoint) - timedelta(days=2)) if checkpoint
                         else today - timedelta(days=lookback))
                window_start = pending["since"] if pending else since.isoformat()
                window_end = pending["until"] if pending else today.isoformat()
                remaining = pending.get("remaining", []) if pending else []
                budget = max_items
                # Crossref cursors expire after five minutes. They are only a
                # short-lived optimization, never the durable checkpoint.
                if pending and not pending.get("fresh_window") and (not pending.get("cursor") or time.time() - pending.get("cursor_at", 0) >= 240):
                    start, end = date.fromisoformat(window_start), date.fromisoformat(window_end)
                    if start < end:
                        midpoint = start + (end - start) // 2
                        remaining = [{"since": (midpoint + timedelta(days=1)).isoformat(), "until": window_end}] + remaining
                        window_end = midpoint.isoformat()
                    else:
                        # A dense single day cannot be subdivided further. Replay
                        # with a larger bounded batch; DOI dedupe is idempotent.
                        budget = min(10000, max(max_items, pending.get("limit", max_items) * 2))
                    pending = {"since": window_start, "until": window_end, "cursor": None}
                try:
                    extra = {"continuation": pending["cursor"]} if pending and pending.get("cursor") else {}
                    result = fetcher(venue, window_start, window_end, max_items=budget, **extra)
                except Exception:
                    # Expired/invalid cursors must not trap recurring refreshes.
                    # Retry a durable window on the next pass, without advancing.
                    if pending:
                        with self.lock:
                            if self.state["venue_revision"] != config["revision"]:
                                raise ConflictError("Venues changed during refresh; retry with the current configuration")
                            state = copy.deepcopy(self.state)
                            state["pending_windows"][venue["id"]] = {
                                "since": window_start, "until": window_end, "cursor": None,
                                "cursor_at": 0, "remaining": remaining, "limit": budget}
                            self._commit(state)
                    # Provider errors may carry URLs/headers; keep response deliberately generic.
                    report["sources"].append({"id": venue["id"], "status": "error", "count": 0,
                                              "complete": False, "message": "Source unavailable; existing records and checkpoint retained"})
                    continue
                with self.lock:
                    if self.state["venue_revision"] != config["revision"]:
                        raise ConflictError("Venues changed during refresh; retry with the current configuration")
                    state = copy.deepcopy(self.state)
                    count = 0
                    for paper in result["papers"]:
                        doi = normalize_doi(paper.get("doi"))
                        if not doi or doi in known_dois:
                            continue
                        identifier = "discovery:" + doi
                        previous = state["discoveries"].get(identifier)
                        normalized = {**paper, "id": identifier, "doi": doi,
                                      "first_seen_at": previous.get("first_seen_at", now()) if previous else now()}
                        state["discoveries"][identifier] = normalized
                        if not previous:
                            report["added"] += 1
                        elif previous != normalized:
                            report["updated"] += 1
                        count += 1
                    if result["complete"]:
                        state["checkpoints"][venue["id"]] = result["checked_through"]
                        if remaining:
                            state["pending_windows"][venue["id"]] = {
                                **remaining[0], "cursor": None, "cursor_at": time.time(),
                                "remaining": remaining[1:], "limit": max_items,
                                "fresh_window": True}
                        else:
                            state["pending_windows"].pop(venue["id"], None)
                    elif result.get("continuation"):
                        state["pending_windows"][venue["id"]] = {
                            "since": window_start, "until": window_end, "cursor": result["continuation"],
                            "cursor_at": time.time(), "remaining": remaining, "limit": budget}
                    self._commit(state)
                complete = result["complete"] and not remaining
                overflow = not result["complete"] and window_start == window_end and budget >= 10000
                report["sources"].append({"id": venue["id"], "status": "overflow" if overflow else "ok" if complete else "partial",
                    "count": count, "scanned": result.get("scanned", 0), "complete": complete, "message": "This indexed day exceeds 10,000 raw records. Run another refresh within four minutes to continue the live cursor; hourly retries cannot complete this dense day. Narrow the source configuration if needed. Checkpoint not advanced."
                    if overflow else "Window completed" if complete else
                    "More data remains. Next refresh resumes a valid cursor or safely replays smaller date windows; only completed windows advance."})
            return report
        finally:
            self.refresh_lock.release()

    def analyze(self, identifier, analyzer=None):
        from deepseek_client import analyze_paper, DEFAULT_MODEL
        analyzer = analyzer or analyze_paper
        if not self.analysis_lock.acquire(blocking=False):
            raise ConflictError("An AI request is already running")
        try:
            with self.lock:
                paper = self._paper(identifier)
                identifier = paper["id"]
                # Cache key covers only information transmitted to the model.
                fingerprint = analysis_fingerprint(paper)
                cached = self.state["analyses"].get(identifier)
                model = os.environ.get("DEEPSEEK_MODEL", DEFAULT_MODEL)
                if cached and cached.get("workspace_input_hash") == fingerprint and cached.get("model") == model:
                    return copy.deepcopy(cached)
            analysis = analyzer(paper)
            analysis["workspace_input_hash"] = fingerprint
            with self.lock:
                current = self._paper(identifier)
                if any(current.get(k) != paper.get(k) for k in ("title", "abstract", "doi", "venue", "year")):
                    raise ConflictError("Paper changed during analysis. Result was not saved; retry on the current revision.")
                state = copy.deepcopy(self.state)
                state["analyses"][identifier] = analysis
                self._commit(state)
            return copy.deepcopy(analysis)
        finally:
            self.analysis_lock.release()
