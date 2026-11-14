CREATE TABLE workspace_runtime (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE workspace_articles (
  id TEXT PRIMARY KEY NOT NULL,
  canonical_id TEXT NOT NULL UNIQUE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  updated_at TEXT NOT NULL,
  edit_summary TEXT NOT NULL,
  editor_id TEXT NOT NULL,
  write_token TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE workspace_revisions (
  article_id TEXT NOT NULL REFERENCES workspace_articles(id),
  revision INTEGER NOT NULL CHECK (revision > 0),
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  created_at TEXT NOT NULL,
  edit_summary TEXT NOT NULL,
  editor_id TEXT NOT NULL,
  PRIMARY KEY (article_id, revision)
);
--> statement-breakpoint
CREATE TRIGGER workspace_article_insert_history AFTER INSERT ON workspace_articles
BEGIN
  INSERT INTO workspace_revisions (article_id, revision, content_json, created_at, edit_summary, editor_id)
  VALUES (NEW.id, NEW.revision, NEW.content_json, NEW.updated_at, NEW.edit_summary, NEW.editor_id);
  INSERT INTO workspace_runtime (id, revision, updated_at) VALUES (1, 1, NEW.updated_at)
  ON CONFLICT(id) DO UPDATE SET revision = revision + 1, updated_at = excluded.updated_at;
END;
--> statement-breakpoint
CREATE TRIGGER workspace_article_guard_update BEFORE UPDATE ON workspace_articles
WHEN NEW.id != OLD.id OR NEW.revision != OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'Article versions must increase by one');
END;
--> statement-breakpoint
CREATE TRIGGER workspace_article_update_history AFTER UPDATE ON workspace_articles
BEGIN
  INSERT INTO workspace_revisions (article_id, revision, content_json, created_at, edit_summary, editor_id)
  VALUES (NEW.id, NEW.revision, NEW.content_json, NEW.updated_at, NEW.edit_summary, NEW.editor_id);
  INSERT INTO workspace_runtime (id, revision, updated_at) VALUES (1, 1, NEW.updated_at)
  ON CONFLICT(id) DO UPDATE SET revision = revision + 1, updated_at = excluded.updated_at;
END;
--> statement-breakpoint
CREATE TRIGGER workspace_revision_no_update BEFORE UPDATE ON workspace_revisions
BEGIN
  SELECT RAISE(ABORT, 'Revision history is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER workspace_revision_no_delete BEFORE DELETE ON workspace_revisions
BEGIN
  SELECT RAISE(ABORT, 'Revision history is immutable');
END;
--> statement-breakpoint
CREATE TABLE workspace_discoveries (
  id TEXT PRIMARY KEY NOT NULL,
  doi TEXT NOT NULL UNIQUE,
  paper_json TEXT NOT NULL CHECK (json_valid(paper_json)),
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER workspace_discovery_insert_revision AFTER INSERT ON workspace_discoveries
BEGIN
  INSERT INTO workspace_runtime (id, revision, updated_at) VALUES (1, 1, NEW.updated_at)
  ON CONFLICT(id) DO UPDATE SET revision = revision + 1, updated_at = excluded.updated_at;
END;
--> statement-breakpoint
CREATE TRIGGER workspace_discovery_update_revision AFTER UPDATE ON workspace_discoveries
BEGIN
  INSERT INTO workspace_runtime (id, revision, updated_at) VALUES (1, 1, NEW.updated_at)
  ON CONFLICT(id) DO UPDATE SET revision = revision + 1, updated_at = excluded.updated_at;
END;
--> statement-breakpoint
CREATE TABLE workspace_settings (
  name TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER workspace_setting_insert_revision AFTER INSERT ON workspace_settings
BEGIN
  INSERT INTO workspace_runtime (id, revision, updated_at) VALUES (1, 1, NEW.updated_at)
  ON CONFLICT(id) DO UPDATE SET revision = revision + 1, updated_at = excluded.updated_at;
END;
--> statement-breakpoint
CREATE TRIGGER workspace_setting_update_revision AFTER UPDATE ON workspace_settings
BEGIN
  INSERT INTO workspace_runtime (id, revision, updated_at) VALUES (1, 1, NEW.updated_at)
  ON CONFLICT(id) DO UPDATE SET revision = revision + 1, updated_at = excluded.updated_at;
END;
--> statement-breakpoint
CREATE TABLE workspace_checkpoints (
  venue_id TEXT PRIMARY KEY NOT NULL,
  configuration_hash TEXT NOT NULL,
  checkpoint TEXT,
  pending_json TEXT CHECK (pending_json IS NULL OR json_valid(pending_json)),
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE workspace_analyses (
  paper_id TEXT PRIMARY KEY NOT NULL,
  input_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  analysis_json TEXT NOT NULL CHECK (json_valid(analysis_json)),
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER workspace_analysis_insert_revision AFTER INSERT ON workspace_analyses
BEGIN
  INSERT INTO workspace_runtime (id, revision, updated_at) VALUES (1, 1, NEW.updated_at)
  ON CONFLICT(id) DO UPDATE SET revision = revision + 1, updated_at = excluded.updated_at;
END;
--> statement-breakpoint
CREATE TRIGGER workspace_analysis_update_revision AFTER UPDATE ON workspace_analyses
BEGIN
  INSERT INTO workspace_runtime (id, revision, updated_at) VALUES (1, 1, NEW.updated_at)
  ON CONFLICT(id) DO UPDATE SET revision = revision + 1, updated_at = excluded.updated_at;
END;
--> statement-breakpoint
CREATE TABLE workspace_analysis_history (
  id TEXT PRIMARY KEY NOT NULL,
  paper_id TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  analysis_json TEXT NOT NULL CHECK (json_valid(analysis_json)),
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER workspace_analysis_history_no_update BEFORE UPDATE ON workspace_analysis_history
BEGIN
  SELECT RAISE(ABORT, 'Analysis history is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER workspace_analysis_history_no_delete BEFORE DELETE ON workspace_analysis_history
BEGIN
  SELECT RAISE(ABORT, 'Analysis history is immutable');
END;
--> statement-breakpoint
CREATE TABLE workspace_jobs (
  name TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('running', 'done', 'failed')),
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE workspace_ai_usage (
  period TEXT PRIMARY KEY NOT NULL,
  requests INTEGER NOT NULL CHECK (requests >= 0),
  minute TEXT NOT NULL,
  minute_requests INTEGER NOT NULL CHECK (minute_requests >= 0),
  updated_at TEXT NOT NULL
);
