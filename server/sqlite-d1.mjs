import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Synchronous SQLite statements expose the same async surface as Cloudflare D1.
// A batch commits atomically, including the existing immutable-history triggers.
export class SQLiteD1 {
  constructor(filename, migrations) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    this.database = new DatabaseSync(filename);
    this.database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
    this.database.exec('CREATE TABLE IF NOT EXISTS standalone_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TEXT NOT NULL)');
    for (const name of readdirSync(migrations).filter(name => /^\d.*\.sql$/.test(name)).sort()) {
      const source = readFileSync(join(migrations, name), 'utf8');
      const digest = createHash('sha256').update(source).digest('hex');
      const prior = this.database.prepare('SELECT sha256 FROM standalone_migrations WHERE name = ?').get(name);
      if (prior) {
        if (prior.sha256 !== digest) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      this.database.exec('BEGIN IMMEDIATE');
      try {
        this.database.exec(source);
        this.database.prepare('INSERT INTO standalone_migrations VALUES (?, ?, ?)').run(name, digest, new Date().toISOString());
        this.database.exec('COMMIT');
      } catch (error) { this.database.exec('ROLLBACK'); throw error; }
    }
    this.database.exec(`CREATE TABLE IF NOT EXISTS standalone_sessions (
      token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS standalone_login_limits (
      bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start INTEGER NOT NULL);`);
    if (filename !== ':memory:') chmodSync(filename, 0o600);
  }
  prepare(query) {
    const database = this.database;
    let values = [];
    const statement = {
      bind(...args) { values = args; return statement; },
      async first(column) { const result = database.prepare(query).get(...values) ?? null; return column && result ? result[column] : result; },
      async all() { return { results: database.prepare(query).all(...values), success: true }; },
      async run() { return statement.execute(); },
      execute() {
        const compiled = database.prepare(query);
        if (/^\s*(SELECT|WITH|PRAGMA)\b/i.test(query)) return { results: compiled.all(...values), success: true };
        const result = compiled.run(...values);
        return { results: [], success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
      }
    };
    return statement;
  }
  async batch(statements) {
    this.database.exec('BEGIN IMMEDIATE');
    try { const results = statements.map(statement => statement.execute()); this.database.exec('COMMIT'); return results; }
    catch (error) { this.database.exec('ROLLBACK'); throw error; }
  }
  close() { this.database.close(); }
}
