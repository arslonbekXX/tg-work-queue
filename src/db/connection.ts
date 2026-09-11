import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { applyPragmas } from "./pragmas.ts"

export const DATABASE_FILENAME = "workqueue.db"

/** Python resolved the file the same way: `DATA_DIR` joined with the filename. */
export function databasePath(dataDir: string): string {
  return join(dataDir, DATABASE_FILENAME)
}

/**
 * Opens the one connection the process uses for its whole life. Python opened a
 * fresh connection per query and never closed any of them.
 */
export function openDatabase(path: string): Database {
  mkdirSync(dirname(path) || ".", { recursive: true })
  const db = new Database(path, { create: true })
  applyPragmas(db)
  return db
}
