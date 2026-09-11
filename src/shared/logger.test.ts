import { describe, expect, test } from "bun:test"
import { createLogger, type LogLevel } from "./logger.ts"

function recorder() {
  const lines: Array<{ level: LogLevel; line: string }> = []
  return { lines, sink: (level: LogLevel, line: string) => lines.push({ level, line }) }
}

const FIXED = new Date(2026, 8, 11, 10, 0, 0, 123)

describe("createLogger", () => {
  test("reproduces Python's basicConfig line format, including comma milliseconds", () => {
    const { lines, sink } = recorder()
    createLogger("bot", { sink, now: () => FIXED }).info("Starting bot...")
    expect(lines[0]?.line).toBe("2026-09-11 10:00:00,123 - bot - INFO - Starting bot...")
  })

  test("drops messages below the configured level, as level=INFO did", () => {
    const { lines, sink } = recorder()
    const logger = createLogger("bot", { sink, now: () => FIXED })
    logger.debug("noisy")
    logger.info("kept")
    expect(lines).toHaveLength(1)
    expect(lines[0]?.line).toContain("kept")
  })

  test("appends the stack trace, mirroring exc_info=True", () => {
    const { lines, sink } = recorder()
    const boom = new Error("boom")
    createLogger("scheduler", { sink, now: () => FIXED }).error("Error sending reminder", boom)
    expect(lines[0]?.level).toBe("ERROR")
    expect(lines[0]?.line).toContain("- scheduler - ERROR - Error sending reminder")
    expect(lines[0]?.line).toContain("Error: boom")
  })

  test("child loggers keep the options but change the name", () => {
    const { lines, sink } = recorder()
    createLogger("app", { sink, now: () => FIXED }).child("db").info("migrated")
    expect(lines[0]?.line).toBe("2026-09-11 10:00:00,123 - db - INFO - migrated")
  })
})
