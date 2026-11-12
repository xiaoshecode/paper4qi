"""Offline persistence/API integration tests; never contact upstream providers."""
import copy
import http.client
import json
import os
import tempfile
import threading
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from deepseek_client import DEFAULT_MODEL
from serve_workspace import WorkspaceServer
from workspace_store import (ConflictError, WorkspaceLease, WorkspaceStore,
                             apply_editorial_overlays, export_workspace, prepare_public_snapshot, read_public_snapshot)


PAPER = {"id": "tqe:10.1109/tqe.2026.1", "doi": "10.1109/tqe.2026.1", "title": "Quantum compiler",
         "abstract": "A compiler for quantum systems", "year": 2026, "venue": "IEEE TQE",
         "zh": "待补充", "category": "ARCH", "tags": [], "front_matter": False}
VENUE = {"id": "tqe", "name": "IEEE TQE", "kind": "journal", "issn": "2689-1808", "enabled": True, "keywords": []}


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for folder in ("data_src", "public/data", "dist/workspace"):
            (self.root / folder).mkdir(parents=True)
        (self.root / "public/data/papers.json").write_text(json.dumps({"papers": [PAPER]}))
        (self.root / "data_src/followed_venues.json").write_text(json.dumps({"venues": [VENUE]}))
        (self.root / "dist/workspace/index.html").write_text("<h1>workspace</h1>")
        self.store = WorkspaceStore(self.root)

    def tearDown(self):
        self.temp.cleanup()

    def content(self, **updates):
        return {"title": PAPER["title"], "zh": "人工核对摘要", "category": "ARCH", "tags": ["compiler"],
                "body": "## 我的核查\n原始资料", **updates}

    def test_revision_restore_and_persistence(self):
        original = self.store.save_article(PAPER["id"], 0, self.content(), "First edit")
        self.store.save_article(PAPER["id"], 1, self.content(body="changed"), "Second edit")
        restored = self.store.restore(PAPER["id"], 2, 1, "Restore first")
        self.assertEqual(restored["revision"], 3)
        self.assertEqual(restored["body"], original["body"])
        self.assertEqual(len(restored["history"]), 3)
        loaded = WorkspaceStore(self.root).article(PAPER["id"])
        self.assertEqual(loaded["article"], restored)

    def test_conflict_does_not_overwrite(self):
        self.store.save_article(PAPER["id"], 0, self.content(), "first")
        prior = self.store.path.read_bytes()
        with self.assertRaises(ConflictError):
            self.store.save_article(PAPER["id"], 0, self.content(body="lost"), "stale")
        self.assertEqual(self.store.path.read_bytes(), prior)

    def test_validation_and_unknown_ids(self):
        for content in (self.content(category="INVALID"), self.content(tags=["x" * 101]),
                        self.content(title=""), {**self.content(), "api_key": "not-permitted"}):
            with self.assertRaises(ValueError):
                self.store.save_article(PAPER["id"], 0, content, "bad")
        with self.assertRaises(ValueError):
            self.store.article("../../secrets")
        self.assertFalse(self.store.path.exists())

    def test_atomic_write_failure_keeps_memory_and_disk(self):
        with patch("workspace_store.atomic_write_json", side_effect=OSError("disk full")):
            with self.assertRaises(OSError):
                self.store.save_article(PAPER["id"], 0, self.content(), "failed")
        self.assertEqual(self.store.article(PAPER["id"])["article"]["revision"], 0)

    def test_venue_revision_and_reset(self):
        self.store.state["checkpoints"]["tqe"] = "2026-01-01"
        result = self.store.save_venues([{**VENUE, "keywords": ["quantum"]}], 0)
        self.assertEqual(result["revision"], 1)
        self.assertNotIn("tqe", self.store.state["checkpoints"])
        with self.assertRaises(ConflictError):
            self.store.save_venues([VENUE], 0)

    def test_source_failure_preserves_checkpoint(self):
        self.store.state["checkpoints"]["tqe"] = "2026-10-01"
        def failed(*args, **kwargs):
            raise RuntimeError("secret provider body")
        report = self.store.refresh(failed, date(2026, 11, 1))
        self.assertEqual(self.store.state["checkpoints"]["tqe"], "2026-10-01")
        self.assertNotIn("secret", json.dumps(report))

    def test_deduplication_and_completed_window(self):
        def fetched(*args, **kwargs):
            return {"papers": [PAPER, {**PAPER, "doi": "10.1234/new", "id": "discovery:10.1234/new"}],
                    "complete": True, "checked_through": "2026-11-01"}
        report = self.store.refresh(fetched, date(2026, 11, 1))
        self.assertEqual(report["added"], 1)
        self.assertEqual(len(self.store.papers()["discoveries"]), 1)
        self.assertEqual(self.store.refresh(fetched, date(2026, 11, 1))["added"], 0)
        self.assertEqual(self.store.state["checkpoints"]["tqe"], "2026-11-01")

    def test_partial_window_resumes_after_restart(self):
        def partial(venue, since, until, **kwargs):
            return {"papers": [], "complete": False, "checked_through": None, "continuation": "next-cursor"}
        self.store.refresh(partial, date(2026, 11, 1))
        self.assertNotIn("tqe", self.store.state["checkpoints"])
        def resumed(venue, since, until, **kwargs):
            self.assertEqual(until, "2026-11-01")
            self.assertEqual(kwargs["continuation"], "next-cursor")
            return {"papers": [], "complete": True, "checked_through": until}
        restarted = WorkspaceStore(self.root)
        restarted.refresh(resumed, date(2026, 11, 5))
        self.assertFalse(restarted.state["pending_windows"])
        self.assertEqual(restarted.state["checkpoints"]["tqe"], "2026-11-01")

    def test_expired_cursor_splits_durable_window_without_losing_dates(self):
        self.store.state["pending_windows"]["tqe"] = {"since": "2026-10-01", "until": "2026-10-04",
            "cursor": "expired", "cursor_at": 0, "remaining": [], "limit": 100}
        calls = []
        def fetched(venue, since, until, **kwargs):
            calls.append((since, until))
            self.assertNotIn("continuation", kwargs)
            return {"papers": [], "complete": True, "checked_through": until}
        first = self.store.refresh(fetched, date(2026, 11, 1))
        self.assertFalse(first["sources"][0]["complete"])
        second = self.store.refresh(fetched, date(2026, 11, 2))
        self.assertTrue(second["sources"][0]["complete"])
        self.assertEqual(calls, [("2026-10-01", "2026-10-02"), ("2026-10-03", "2026-10-04")])
        self.assertEqual(self.store.state["checkpoints"]["tqe"], "2026-10-04")

    def test_invalid_cursor_recovers_next_refresh(self):
        self.store.state["pending_windows"]["tqe"] = {"since": "2026-10-01", "until": "2026-10-01",
            "cursor": "invalid", "cursor_at": __import__("time").time(), "remaining": [], "limit": 100}
        def failed(*args, **kwargs):
            raise RuntimeError("Expired cursor")
        self.store.refresh(failed, date(2026, 11, 1))
        def fetched(venue, since, until, **kwargs):
            self.assertNotIn("continuation", kwargs)
            self.assertEqual(kwargs["max_items"], 200)
            return {"papers": [], "complete": True, "checked_through": until}
        self.store.refresh(fetched, date(2026, 11, 1))
        self.assertFalse(self.store.state["pending_windows"])

    def test_failed_refresh_cannot_restore_reset_source_window(self):
        self.store.state["pending_windows"]["tqe"] = {"since": "2026-10-01", "until": "2026-10-01",
            "cursor": "old-source", "cursor_at": __import__("time").time(), "remaining": [], "limit": 100}
        def changed(*args, **kwargs):
            self.store.save_venues([{**VENUE, "issn": "1234-5678"}], 0)
            raise RuntimeError("Source changed during network request")
        with self.assertRaises(ConflictError):
            self.store.refresh(changed, date(2026, 11, 1))
        self.assertFalse(self.store.state["pending_windows"])

    def test_dense_single_day_reports_actionable_overflow(self):
        self.store.state["pending_windows"]["tqe"] = {"since": "2026-10-01", "until": "2026-10-01",
            "cursor": "expired", "cursor_at": 0, "remaining": [], "limit": 10000}
        def partial(*args, **kwargs):
            return {"papers": [], "complete": False, "continuation": "live-next", "checked_through": None}
        report = self.store.refresh(partial, date(2026, 11, 1))
        self.assertEqual(report["sources"][0]["status"], "overflow")
        self.assertFalse(self.store.state["checkpoints"])

    def test_analysis_cache_and_no_automatic_adoption(self):
        calls = []
        def analyze(paper):
            calls.append(paper)
            return {"model": DEFAULT_MODEL, "summary": "AI 草稿", "category": "QEC"}
        with patch.dict(os.environ, {"DEEPSEEK_MODEL": DEFAULT_MODEL}):
            self.store.analyze(PAPER["id"], analyze)
            self.store.analyze(PAPER["id"], analyze)
            self.assertEqual(len(calls), 1)
            self.assertEqual(self.store.article(PAPER["id"])["article"]["category"], "ARCH")
            self.store.save_article(PAPER["id"], 0, self.content(title="New quantum compiler"), "Correction")
            self.assertIsNone(self.store.article(PAPER["id"])["analysis"])
            self.assertFalse(export_workspace(self.root / "data_src", self.root / "public/data", "now")["analyses"])
            self.store.analyze(PAPER["id"], analyze)
            self.assertEqual(len(calls), 2)

    def test_analysis_race_keeps_result_unpublished(self):
        def analyze(paper):
            self.store.save_article(PAPER["id"], 0, self.content(title="Changed title"), "Edit during call")
            return {"model": DEFAULT_MODEL, "summary": "过时草稿"}
        with self.assertRaises(ConflictError):
            self.store.analyze(PAPER["id"], analyze)
        self.assertIsNone(self.store.article(PAPER["id"])["analysis"])

    def test_build_export_only_applies_saved_editorial_content(self):
        self.store.save_article(PAPER["id"], 0, self.content(), "Reviewed")
        papers = [copy.deepcopy(PAPER)]
        apply_editorial_overlays(papers, self.store.state)
        self.assertEqual(papers[0]["zh"], "人工核对摘要")
        self.assertFalse(export_workspace(self.root / "data_src", self.root / "public/data", "before")["articles"])
        prepare_public_snapshot(self.root)
        output = export_workspace(self.root / "data_src", self.root / "public/data", "2026-11-01")
        self.assertEqual(output["articles"][PAPER["id"]]["revision"], 1)
        self.assertNotIn("checkpoints", output)

    def test_publication_excludes_private_history_and_drafts(self):
        self.store.save_article(PAPER["id"], 0, self.content(body="PRIVATE_OLD_BODY"), "PRIVATE_REASON")
        self.store.save_article(PAPER["id"], 1, self.content(body="Reviewed current body"), "another reason")
        self.store.analyze(PAPER["id"], lambda paper: {"model": DEFAULT_MODEL, "summary": "PRIVATE_AI_DRAFT"})
        self.store.state["checkpoints"]["secret_source"] = "PRIVATE_CHECKPOINT"
        self.store._commit(self.store.state)
        snapshot = prepare_public_snapshot(self.root)
        raw = (self.root / "data_src/workspace-public.json").read_text()
        self.assertNotIn("PRIVATE_", raw)
        self.assertEqual(snapshot["articles"][PAPER["id"]]["body"], "Reviewed current body")
        self.assertFalse(snapshot["articles"][PAPER["id"]]["history"])
        self.assertEqual(len(self.store.article(PAPER["id"])["article"]["history"]), 2)
        self.store.save_article(PAPER["id"], 2, self.content(body="PRIVATE_LATER_EDIT"), "later")
        exported = export_workspace(self.root / "data_src", self.root / "public/data", "now")
        self.assertNotIn("PRIVATE_", json.dumps(exported))
        self.assertEqual(exported["articles"][PAPER["id"]]["body"], "Reviewed current body")

    def test_fresh_checkout_continues_reviewed_snapshot(self):
        self.store.save_article(PAPER["id"], 0, self.content(body="Reviewed published body"), "private note")
        prepare_public_snapshot(self.root)
        self.store.path.unlink()
        fresh = WorkspaceStore(self.root)
        article = fresh.article(PAPER["id"])["article"]
        self.assertEqual(article["body"], "Reviewed published body")
        self.assertEqual(article["revision"], 1)
        self.assertFalse(article["history"])
        edited = fresh.save_article(PAPER["id"], 1, self.content(body="New local edit"), "new")
        self.assertEqual(edited["revision"], 2)

    def test_prepare_without_private_state_preserves_public_snapshot(self):
        self.store.save_article(PAPER["id"], 0, self.content(body="Reviewed body"), "private note")
        discovery = {**PAPER, "id": "discovery:10.1234/new", "doi": "10.1234/new",
                     "first_seen_at": "2026-11-01T00:00:00Z", "last_seen_at": "2026-11-02T00:00:00Z"}
        self.store.state["discoveries"][discovery["id"]] = discovery
        self.store._commit(self.store.state)
        first = prepare_public_snapshot(self.root)
        self.store.path.unlink()
        second = prepare_public_snapshot(self.root)
        self.assertEqual(first, second)
        self.assertEqual(second["discoveries"][discovery["id"]]["first_seen_at"], discovery["first_seen_at"])
        self.assertEqual(second["discoveries"][discovery["id"]]["last_seen_at"], discovery["last_seen_at"])
        self.assertFalse(self.store.path.exists())

    def test_prepare_refuses_newer_or_divergent_public_revision(self):
        self.store.save_article(PAPER["id"], 0, self.content(body="Local body"), "private note")
        snapshot = prepare_public_snapshot(self.root)
        path = self.root / "data_src/workspace-public.json"
        snapshot["articles"][PAPER["id"]]["body"] = "Other editor body"
        for revision in (1, 2):
            snapshot["articles"][PAPER["id"]]["revision"] = revision
            path.write_text(json.dumps(snapshot))
            prior = path.read_bytes()
            with self.assertRaises(ConflictError):
                prepare_public_snapshot(self.root)
            self.assertEqual(path.read_bytes(), prior)

    def test_prepare_preserves_public_only_records(self):
        self.store.save_article(PAPER["id"], 0, self.content(), "reviewed")
        snapshot = prepare_public_snapshot(self.root)
        self.store.state["articles"] = {}
        self.store._commit(self.store.state)
        self.assertEqual(prepare_public_snapshot(self.root)["articles"], snapshot["articles"])

    def test_publication_filters_hand_edited_snapshot(self):
        self.store.save_article(PAPER["id"], 0, self.content(), "PRIVATE_REASON")
        (self.root / "data_src/workspace-public.json").write_text(json.dumps(self.store.state))
        snapshot = read_public_snapshot(self.root / "data_src")
        self.assertNotIn("PRIVATE_REASON", json.dumps(snapshot))
        self.assertFalse(snapshot["analyses"])

    def test_exclusive_writer_lease(self):
        with WorkspaceLease(self.root):
            with self.assertRaises(RuntimeError):
                WorkspaceLease(self.root)
        with WorkspaceLease(self.root):
            pass


class ApiTests(StoreTests):
    def setUp(self):
        super().setUp()
        self.server = WorkspaceServer(self.root, port=0, token="unit-test-only", store=self.store)
        self.worker = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.worker.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.worker.join()
        super().tearDown()

    def request(self, path, method="GET", body=None, auth=True, **headers):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        if auth:
            headers["Authorization"] = "Bearer unit-test-only"
        if body is not None:
            body = json.dumps(body)
            headers.setdefault("Content-Type", "application/json")
        connection.request(method, "/paper4qi/" + path, body=body, headers=headers)
        response = connection.getresponse()
        raw = response.read()
        connection.close()
        return response.status, raw

    def test_auth_and_public_status(self):
        self.assertEqual(self.request("api/status", auth=False)[0], 200)
        self.assertEqual(self.request("api/papers", auth=False)[0], 401)
        self.assertEqual(self.request("api/papers")[0], 200)

    def test_cross_origin_and_dns_rebinding(self):
        self.assertEqual(self.request("api/papers", Origin="https://attacker.example")[0], 403)
        self.assertEqual(self.request("api/status", Host="attacker.example")[0], 403)
        self.assertEqual(self.request("api/papers", **{"Sec-Fetch-Site": "cross-site"})[0], 403)

    def test_save_roundtrip_and_conflict(self):
        body = {"id": PAPER["id"], "expected_revision": 0, "summary": "Checked", "content": self.content()}
        status, raw = self.request("api/article", "PUT", body)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw)["article"]["revision"], 1)
        self.assertEqual(self.request("api/article", "PUT", body)[0], 409)

    def test_bad_body_missing_key_and_no_credentials(self):
        self.assertEqual(self.request("api/article", "PUT", {})[0], 400)
        self.assertEqual(self.request("api/article", "PUT", {}, **{"Content-Type": "text/plain"})[0], 400)
        with patch.dict(os.environ, {"DEEPSEEK_API_KEY": ""}):
            self.assertEqual(self.request("api/analyze", "POST", {"id": PAPER["id"]})[0], 503)

    def test_paths_and_static_preview(self):
        self.assertEqual(self.request("workspace/")[0], 200)
        self.assertEqual(self.request("%2e%2e/data_src/followed_venues.json")[0], 404)
        self.assertEqual(self.request("api/unknown")[0], 404)

    def test_request_budget(self):
        self.server.max_ai_requests = 2
        self.assertTrue(self.server.reserve("analyze"))
        self.assertTrue(self.server.reserve("analyze"))
        self.assertFalse(self.server.reserve("analyze"))
        self.assertTrue(self.server.reserve("refresh"))
        self.assertFalse(self.server.reserve("refresh"))


if __name__ == "__main__":
    unittest.main()
