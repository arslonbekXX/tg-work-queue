import type { Database } from "bun:sqlite"

/**
 * Per-connection settings; nothing here is written to the database file.
 *
 * `foreign_keys` is the important one: Python never enabled it, so the
 * `ON DELETE CASCADE` on `task_assignees` never fired and deleting a task left
 * its assignee rows behind. Migration 003 clears out the ones already there.
 *
 * `journal_mode` is deliberately left alone — switching to WAL would rewrite
 * the file header and add sidecar files to the mounted volume.
 */
export function applyPragmas(db: Database): void {
  db.run("PRAGMA busy_timeout = 5000")
  db.run("PRAGMA foreign_keys = ON")
}
