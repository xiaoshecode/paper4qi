CREATE TABLE workspace_articles (
  id TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  updated_at TEXT NOT NULL
);
