import type { Database } from "bun:sqlite"
import type { Logger } from "@shared/logger.ts"

export interface Migration {
  readonly version: number
  readonly name: string
  up(db: Database): void
}

/**
 * Schema versioning through `PRAGMA user_version`, a four-byte integer in the
 * SQLite file header. A `schema_migrations` table would have been the more
 * conventional choice, but creating it would itself be a schema change to a
 * database this migration is supposed to leave structurally untouched.
 *
 * A brand-new file and an existing production database both report version 0,
 * so they are told apart by probing for the `tasks` table. That probe cannot
 * false-positive on a fresh file (its `sqlite_master` is empty) and cannot
 * false-negative on production (the table is there).
 */
export function runMigrations(
  db: Database,
  migrations: readonly Migration[],
  logger: Logger,
): void {
  let version = readVersion(db)

  if (version === 0 && hasLegacySchema(db)) {
    writeVersion(db, 1)
    version = 1
    logger.info("Baselined existing database at schema version 1")
  }

  for (const migration of migrations) {
    if (migration.version <= version) continue

    // Body and version stamp share one transaction, so a crash mid-migration
    // cannot leave a half-applied migration marked as done.
    db.transaction(() => {
      migration.up(db)
      writeVersion(db, migration.version)
    }).immediate()

    logger.info(`Applied migration ${migration.version} (${migration.name})`)
  }

  const damage = db.query<{ table: string }, []>("PRAGMA foreign_key_check").all()
  if (damage.length > 0) {
    logger.warning(`foreign_key_check reported ${damage.length} violation(s)`)
  }
}

export function readVersion(db: Database): number {
  return db.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version ?? 0
}

function hasLegacySchema(db: Database): boolean {
  const sql = "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'tasks'"
  return db.query<{ present: number }, []>(sql).get() !== null
}

function writeVersion(db: Database, version: number): void {
  // PRAGMA values cannot be bound. Safe only because every version is a
  // hard-coded integer from the migration list, never user input.
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new TypeError(`Refusing to write a non-integer schema version: ${version}`)
  }
  db.run(`PRAGMA user_version = ${version}`)
}
