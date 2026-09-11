import type { Migration } from "../migrator.ts"

/**
 * Clears the assignee rows that accumulated while `PRAGMA foreign_keys` was off
 * and `ON DELETE CASCADE` therefore never fired.
 *
 * This is a migration rather than a startup task so it runs exactly once, ever,
 * instead of scanning the table on every boot. It runs before the backfill
 * because the backfill's "is the table still empty" guard would otherwise be
 * tripped by orphans and skip work it should do.
 */
export const pruneOrphanAssignees: Migration = {
  version: 2,
  name: "prune-orphan-assignees",
  up(db) {
    db.run("DELETE FROM task_assignees WHERE task_id NOT IN (SELECT id FROM tasks)")
  },
}
