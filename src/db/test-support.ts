import { Database } from "bun:sqlite"
import { createLogger } from "@shared/logger.ts"
import { MIGRATIONS } from "./migrations/index.ts"
import { runMigrations } from "./migrator.ts"
import { applyPragmas } from "./pragmas.ts"

/**
 * A fully migrated in-memory database. Repository tests run against real SQL
 * rather than a hand-written fake, so the queries themselves are under test.
 */
export function createTestDatabase(): Database {
  const db = new Database(":memory:")
  applyPragmas(db)
  runMigrations(db, MIGRATIONS, createLogger("test", { sink: () => {} }))
  return db
}
