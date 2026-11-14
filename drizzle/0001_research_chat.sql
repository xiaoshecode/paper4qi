CREATE TABLE research_chats (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  paper_id TEXT,
  paper_context_json TEXT CHECK (paper_context_json IS NULL OR json_valid(paper_context_json)),
  pending_request_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE research_chat_requests (
  id TEXT PRIMARY KEY NOT NULL,
  chat_id TEXT NOT NULL REFERENCES research_chats(id),
  input_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'complete', 'truncated', 'refused', 'failed', 'cancelled')),
  expires_at INTEGER NOT NULL,
  reserved_revision INTEGER NOT NULL,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX research_chat_requests_chat ON research_chat_requests(chat_id, created_at);
--> statement-breakpoint
CREATE TABLE research_chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  chat_id TEXT NOT NULL REFERENCES research_chats(id),
  request_id TEXT NOT NULL REFERENCES research_chat_requests(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  annotations_json TEXT NOT NULL CHECK (json_valid(annotations_json)),
  tool_events_json TEXT NOT NULL CHECK (json_valid(tool_events_json)),
  protocol_json TEXT CHECK (protocol_json IS NULL OR json_valid(protocol_json)),
  status TEXT NOT NULL CHECK (status IN ('pending', 'complete', 'truncated', 'refused', 'failed', 'cancelled')),
  created_at TEXT NOT NULL,
  UNIQUE (request_id, role)
);
--> statement-breakpoint
CREATE INDEX research_chat_messages_chat ON research_chat_messages(chat_id, created_at, id);
