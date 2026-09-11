/**
 * Python distinguished a duplicate task from a real failure by catching
 * `sqlite3.IntegrityError`. bun:sqlite reports the same thing through the
 * `code` property of the thrown error.
 */
export function isConstraintViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const { code } = error as { code?: unknown }
  return typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT")
}
