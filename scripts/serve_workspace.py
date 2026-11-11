#!/usr/bin/env python3
"""Loopback-only authenticated API and static preview for the research workspace.

Not a production or multi-user server. No secrets in HTML, URLs, storage or logs.
Bind only 127.0.0.1; reject cross-origin requests and DNS-rebinding Host headers.
"""
from __future__ import annotations

import argparse
import hmac
import json
import os
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from mimetypes import guess_type
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from deepseek_client import DEFAULT_MODEL, analyze_paper
from workspace_store import ConflictError, WorkspaceStore, WorkspaceLease

ROOT = Path(__file__).resolve().parent.parent
MAX_BODY = 65536


class WorkspaceServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, root, port=8765, token=None, base="/paper4qi", store=None):
        self.root = Path(root)
        self.dist = self.root / "dist"
        self.base = base.rstrip("/")
        self.token = token or secrets.token_urlsafe(32)
        self.store = store or WorkspaceStore(root)
        self.rate_lock = threading.Lock()
        self.requests = {}
        self.ai_requests = 0
        self.max_ai_requests = int(os.environ.get("PAPER4QI_MAX_AI_REQUESTS", "20"))
        if not 0 <= self.max_ai_requests <= 100:
            raise ValueError("PAPER4QI_MAX_AI_REQUESTS must be 0–100 per server session")
        super().__init__(("127.0.0.1", port), WorkspaceHandler)

    def reserve(self, action):
        with self.rate_lock:
            current = time.monotonic()
            period, limit = (60, 6) if action == "analyze" else (30, 1)
            recent = [stamp for stamp in self.requests.get(action, []) if current - stamp < period]
            if len(recent) >= limit:
                return False
            if action == "analyze":
                if self.ai_requests >= self.max_ai_requests:
                    return False
                self.ai_requests += 1
            self.requests[action] = recent + [current]
            return True


class WorkspaceHandler(BaseHTTPRequestHandler):
    server_version = "paper4qi-workspace"

    def setup(self):
        super().setup()
        self.connection.settimeout(15)

    def log_message(self, fmt, *args):
        # Request URLs, authorization and user content must never be logged.
        pass

    def _headers(self, status, content_type, length):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "frame-ancestors 'none'; object-src 'none'")
        self.end_headers()

    def _json(self, value, status=200):
        raw = json.dumps(value, ensure_ascii=False).encode()
        self._headers(status, "application/json; charset=utf-8", len(raw))
        if self.command != "HEAD":
            self.wfile.write(raw)

    def _trusted_request(self):
        host = self.headers.get("Host", "")
        allowed = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
        origin = self.headers.get("Origin")
        if host not in allowed or (origin is not None and origin != f"http://{host}"):
            self._json({"error": "Only same-origin loopback requests are allowed"}, 403)
            return False
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            self._json({"error": "Cross-site requests are not allowed"}, 403)
            return False
        return True

    def _authorized(self):
        value = self.headers.get("Authorization", "")
        if not hmac.compare_digest(value.encode(), ("Bearer " + self.server.token).encode()):
            self._json({"error": "Enter the session token printed by the local workspace server"}, 401)
            return False
        return True

    def _body(self):
        if self.headers.get("Transfer-Encoding"):
            raise ValueError("Chunked request bodies are not supported")
        if self.headers.get("Content-Type", "").split(";", 1)[0].strip() != "application/json":
            raise ValueError("Content-Type must be application/json")
        length = int(self.headers.get("Content-Length", "0"))
        if not 0 < length <= MAX_BODY:
            raise ValueError("Request body must be 1–65536 bytes")
        value = json.loads(self.rfile.read(length))
        if not isinstance(value, dict):
            raise ValueError("Request body must be a JSON object")
        return value

    def do_GET(self):
        self._dispatch()

    def do_HEAD(self):
        self._dispatch()

    def do_POST(self):
        self._dispatch()

    def do_PUT(self):
        self._dispatch()

    def do_OPTIONS(self):
        self._json({"error": "Cross-origin API access is disabled"}, 405)

    def _dispatch(self):
        if not self._trusted_request():
            return
        parsed = urlsplit(self.path)
        prefix = self.server.base + "/api/"
        if not parsed.path.startswith(prefix):
            if self.command not in ("GET", "HEAD"):
                return self._json({"error": "Method not allowed"}, 405)
            return self._static(parsed.path)
        route = parsed.path[len(prefix):]
        if route == "status" and self.command == "GET":
            return self._json({"ready": True, "deepseek_configured": bool(os.environ.get("DEEPSEEK_API_KEY")),
                               "model": os.environ.get("DEEPSEEK_MODEL", DEFAULT_MODEL),
                               "max_ai_requests": self.server.max_ai_requests})
        if not self._authorized():
            return
        try:
            store = self.server.store
            if self.command == "GET":
                if route == "papers":
                    return self._json(store.papers())
                if route == "venues":
                    return self._json(store.venues())
                if route == "article":
                    return self._json(store.article(parse_qs(parsed.query).get("id", [""])[0]))
            elif self.command in ("POST", "PUT"):
                body = self._body()
                if route == "venues" and self.command == "PUT":
                    return self._json(store.save_venues(body["venues"], body["expected_revision"]))
                if route == "article" and self.command == "PUT":
                    article = store.save_article(body["id"], body["expected_revision"], body["content"], body["summary"])
                    return self._json({"article": article})
                if route == "restore" and self.command == "POST":
                    article = store.restore(body["id"], body["expected_revision"], body["revision"], body["summary"])
                    return self._json({"article": article})
                if route == "refresh" and self.command == "POST":
                    if not self.server.reserve("refresh"):
                        return self._json({"error": "Refresh is limited to once every 30 seconds"}, 429)
                    return self._json(store.refresh())
                if route == "analyze" and self.command == "POST":
                    if not os.environ.get("DEEPSEEK_API_KEY"):
                        return self._json({"error": "Configure a newly generated DEEPSEEK_API_KEY in the server environment"}, 503)
                    if not self.server.reserve("analyze"):
                        return self._json({"error": "AI request limit reached (6/minute and configured session cap)"}, 429)
                    analysis = store.analyze(body["id"], analyzer=lambda paper: analyze_paper(paper, allow_paid=True))
                    return self._json({"analysis": analysis})
            self._json({"error": "Unknown API route or method"}, 404)
        except ConflictError as error:
            self._json({"error": str(error)}, 409)
        except (ValueError, KeyError, TypeError):
            self._json({"error": "Invalid request. Check fields, lengths, category and revision; no change was saved."}, 400)
        except RuntimeError:
            self._json({"error": "Upstream request failed or returned invalid data. No automatic paid retry was made."}, 502)
        except Exception:
            self._json({"error": "Workspace operation failed. Check local file access and retry only after inspecting state."}, 500)

    def _static(self, url_path):
        base = self.server.base
        if url_path == "/" and base:
            self.send_response(302)
            self.send_header("Location", base + "/workspace/")
            self.end_headers()
            return
        if not url_path.startswith(base + "/"):
            return self._json({"error": "Page not found"}, 404)
        relative = unquote(url_path[len(base):]).lstrip("/")
        path = (self.server.dist / relative).resolve()
        if not path.is_relative_to(self.server.dist.resolve()):
            return self._json({"error": "Page not found"}, 404)
        if path.is_dir():
            path /= "index.html"
        if not path.is_file():
            return self._json({"error": "Build the site first: pnpm data && pnpm build"}, 404)
        raw = path.read_bytes()
        content_type = guess_type(str(path))[0] or "application/octet-stream"
        if content_type.startswith("text/"):
            content_type += "; charset=utf-8"
        self._headers(200, content_type, len(raw))
        if self.command != "HEAD":
            self.wfile.write(raw)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--base", default="/paper4qi", choices=("/paper4qi", "/"))
    args = parser.parse_args()
    if not (ROOT / "dist/workspace/index.html").exists():
        parser.error("Run pnpm data && pnpm build first")
    lease = WorkspaceLease(ROOT)
    server = WorkspaceServer(ROOT, args.port, base=args.base)
    print(f"Local workspace: http://127.0.0.1:{server.server_port}{server.base}/workspace/")
    print(f"Session token (paste into local workspace only): {server.token}")
    print("Do not share this token. It is not saved; restarting generates a new token.")
    print("Only one writer per checkout. Wiki content and AI drafts may become public when committed/published.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        lease.close()


if __name__ == "__main__":
    main()
