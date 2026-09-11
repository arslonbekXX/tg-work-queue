import type { Migration } from "../migrator.ts"

/**
 * The schema exactly as `Database._init_db` created it, down to the indentation.
 *
 * SQLite stores the text of a CREATE statement verbatim in `sqlite_master.sql`,
 * so keeping the original whitespace means a database this migration creates is
 * byte-identical to one the Python version created. That is what lets
 * `migrator.test.ts` compare a fresh database against a legacy one directly.
 *
 * These statements were extracted from a database built by the original
 * `database.py`, not retyped. Do not reformat them.
 */
const STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chat_id INTEGER NOT NULL,
                    seq_num INTEGER NOT NULL,
                    task_id TEXT NOT NULL,
                    url TEXT NOT NULL,
                    assigned_to TEXT NOT NULL,
                    created_by TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(chat_id, task_id),
                    UNIQUE(chat_id, seq_num)
                )`,
  `CREATE TABLE IF NOT EXISTS task_assignees (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER NOT NULL,
                    assignee TEXT NOT NULL,
                    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                    UNIQUE(task_id, assignee)
                )`,
  `CREATE TABLE IF NOT EXISTS seq_counters (
                    chat_id INTEGER PRIMARY KEY,
                    next_num INTEGER DEFAULT 1
                )`,
  `CREATE TABLE IF NOT EXISTS reminders (
                    chat_id INTEGER PRIMARY KEY,
                    cron_expression TEXT NOT NULL,
                    enabled BOOLEAN NOT NULL DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
]

export const baseline: Migration = {
  version: 1,
  name: "baseline",
  up(db) {
    for (const statement of STATEMENTS) db.run(statement)
  },
}
