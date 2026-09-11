import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { createLogger } from "@shared/logger.ts"
import { MIGRATIONS } from "./migrations/index.ts"
import { readVersion, runMigrations } from "./migrator.ts"
import { applyPragmas } from "./pragmas.ts"

/**
 * The schema as the Python version actually created it, dumped from a database
 * built by running `database.py` itself. Used to stand up a realistic
 * pre-migration database.
 */
const LEGACY_SCHEMA: readonly string[] = [
  `CREATE TABLE tasks (
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
  `CREATE TABLE task_assignees (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER NOT NULL,
                    assignee TEXT NOT NULL,
                    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                    UNIQUE(task_id, assignee)
                )`,
  `CREATE TABLE seq_counters (
                    chat_id INTEGER PRIMARY KEY,
                    next_num INTEGER DEFAULT 1
                )`,
  `CREATE TABLE reminders (
                    chat_id INTEGER PRIMARY KEY,
                    cron_expression TEXT NOT NULL,
                    enabled BOOLEAN NOT NULL DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
]

const silent = createLogger("test", { sink: () => {} })

function freshDatabase(): Database {
  const db = new Database(":memory:")
  applyPragmas(db)
  return db
}

/**
 * A database as it would look on the server today, mid-flight.
 *
 * Seeded with foreign keys off, because that is the state Python left the file
 * in: without `PRAGMA foreign_keys = ON` the orphan row below was insertable.
 * The pragma goes on afterwards, exactly as reopening the file under the new
 * code does.
 */
function legacyDatabase(): Database {
  const db = new Database(":memory:")
  for (const statement of LEGACY_SCHEMA) db.run(statement)

  db.run(
    `INSERT INTO tasks (id, chat_id, seq_num, task_id, url, assigned_to, created_by, created_at)
     VALUES (1, -100, 1, 'monorepo/120', 'http://gitlab/x/-/merge_requests/120', '@alice', '@dave', '2026-01-01 09:00:00'),
            (2, -100, 2, 'backend/45', 'http://gitlab/y/-/merge_requests/45', 'unassigned', '@dave', '2026-01-02 09:00:00'),
            (3, -100, 3, 'web/7', 'http://gitlab/z/-/merge_requests/7', '', '@dave', '2026-01-03 09:00:00')`,
  )
  db.run("INSERT INTO seq_counters (chat_id, next_num) VALUES (-100, 4)")
  db.run(
    "INSERT INTO reminders (chat_id, cron_expression, enabled) VALUES (-100, '0 9 * * 0-4', 1)",
  )

  // Left behind by a !wdone under the old code: foreign_keys was never on, so
  // ON DELETE CASCADE never fired and task 99 is long gone.
  db.run("INSERT INTO task_assignees (task_id, assignee) VALUES (99, '@ghost')")

  applyPragmas(db)
  return db
}

function schemaOf(db: Database): Array<{ name: string; sql: string | null }> {
  return db
    .query<{ name: string; sql: string | null }, []>(
      "SELECT name, sql FROM sqlite_master ORDER BY name",
    )
    .all()
}

describe("runMigrations on a fresh database", () => {
  test("creates the schema and records the latest version", () => {
    const db = freshDatabase()
    runMigrations(db, MIGRATIONS, silent)

    expect(readVersion(db)).toBe(3)
    const tables = schemaOf(db)
      .map((row) => row.name)
      .filter((name) => !name.startsWith("sqlite_"))
    expect(tables.sort()).toEqual(["reminders", "seq_counters", "task_assignees", "tasks"])
  })

  test("produces a schema byte-identical to the one Python created", () => {
    const migrated = freshDatabase()
    runMigrations(migrated, MIGRATIONS, silent)

    const legacy = legacyDatabase()

    expect(schemaOf(migrated)).toEqual(schemaOf(legacy))
  })
})

describe("runMigrations on an existing production database", () => {
  test("leaves every CREATE statement exactly as it was", () => {
    const db = legacyDatabase()
    const before = schemaOf(db)

    runMigrations(db, MIGRATIONS, silent)

    expect(schemaOf(db)).toEqual(before)
  })

  test("baselines it rather than replaying the schema migration", () => {
    const db = legacyDatabase()
    expect(readVersion(db)).toBe(0)

    runMigrations(db, MIGRATIONS, silent)

    expect(readVersion(db)).toBe(3)
  })

  test("removes the orphaned assignee rows the missing pragma allowed", () => {
    const db = legacyDatabase()
    runMigrations(db, MIGRATIONS, silent)

    const orphans = db
      .query<{ count: number }, []>(
        "SELECT COUNT(*) AS count FROM task_assignees WHERE task_id NOT IN (SELECT id FROM tasks)",
      )
      .get()
    expect(orphans?.count).toBe(0)
  })

  test("backfills assigned_to, skipping the unassigned and empty markers", () => {
    const db = legacyDatabase()
    runMigrations(db, MIGRATIONS, silent)

    const rows = db
      .query<{ task_id: number; assignee: string }, []>(
        "SELECT task_id, assignee FROM task_assignees ORDER BY task_id",
      )
      .all()
    expect(rows).toEqual([{ task_id: 1, assignee: "@alice" }])
  })

  test("keeps the task and reminder rows untouched", () => {
    const db = legacyDatabase()
    runMigrations(db, MIGRATIONS, silent)

    const tasks = db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM tasks").get()
    expect(tasks?.count).toBe(3)

    const reminder = db
      .query<{ cron_expression: string }, []>("SELECT cron_expression FROM reminders")
      .get()
    expect(reminder?.cron_expression).toBe("0 9 * * 0-4")
  })

  test("does not re-run the backfill when Python already did it", () => {
    const db = legacyDatabase()
    db.run("DELETE FROM task_assignees")
    db.run("INSERT INTO task_assignees (task_id, assignee) VALUES (1, '@alice'), (1, '@bob')")

    runMigrations(db, MIGRATIONS, silent)

    const rows = db
      .query<{ task_id: number; assignee: string }, []>(
        "SELECT task_id, assignee FROM task_assignees ORDER BY assignee",
      )
      .all()
    expect(rows).toEqual([
      { task_id: 1, assignee: "@alice" },
      { task_id: 1, assignee: "@bob" },
    ])
  })

  test("is a no-op the second time it runs", () => {
    const db = legacyDatabase()
    runMigrations(db, MIGRATIONS, silent)
    const after = schemaOf(db)
    const assignees = db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM task_assignees")
      .get()

    runMigrations(db, MIGRATIONS, silent)

    expect(schemaOf(db)).toEqual(after)
    expect(readVersion(db)).toBe(3)
    expect(
      db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM task_assignees").get(),
    ).toEqual(assignees)
  })
})
