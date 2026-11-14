CREATE TABLE IF NOT EXISTS research_chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  paper_id TEXT,
  paper_context_json TEXT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  pending_request_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS research_chat_requests (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES research_chats(id),
  input_hash TEXT NOT NULL,
  reserved_revision INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','complete','truncated','refused','failed','cancelled')),
  expires_at INTEGER NOT NULL,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS research_chat_requests_order ON research_chat_requests(chat_id, reserved_revision);
CREATE TABLE IF NOT EXISTS research_chat_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES research_chats(id),
  request_id TEXT NOT NULL REFERENCES research_chat_requests(id),
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL DEFAULT '',
  reasoning TEXT NOT NULL DEFAULT '',
  annotations_json TEXT NOT NULL DEFAULT '[]',
  tool_events_json TEXT NOT NULL DEFAULT '[]',
  protocol_json TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending','complete','truncated','refused','failed','cancelled')),
  created_at TEXT NOT NULL,
  UNIQUE(request_id, role)
);
CREATE INDEX IF NOT EXISTS research_chat_messages_order ON research_chat_messages(chat_id, created_at, id);
CREATE INDEX IF NOT EXISTS research_chats_updated ON research_chats(updated_at DESC, id);
