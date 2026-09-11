import type { Migration } from "../migrator.ts"
import type { CountRow } from "../rows.ts"

/**
 * Port of `Database._migrate_assignees`, which moved the single `assigned_to`
 * value onto the `task_assignees` junction table.
 *
 * The "is task_assignees still empty" guard is kept even though the version
 * stamp would already prevent a re-run: a baselined production database starts
 * at version 1, so this migration does run against it, and the guard is what
 * makes that a no-op when the backfill already happened under Python.
 *
 * Migration 002 prunes orphan rows first, so the guard sees only rows that
 * really belong to a task.
 */
export const backfillAssignees: Migration = {
  version: 3,
  name: "backfill-assignees",
  up(db) {
    const existing = db.query<CountRow, []>("SELECT COUNT(*) AS count FROM task_assignees").get()
    if ((existing?.count ?? 0) > 0) return

    db.run(`
      INSERT OR IGNORE INTO task_assignees (task_id, assignee)
      SELECT id, assigned_to FROM tasks
      WHERE assigned_to != 'unassigned' AND assigned_to != ''
    `)
  },
}
