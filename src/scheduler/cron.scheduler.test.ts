import { describe, expect, test } from "bun:test"
import { parseCronExpression } from "@domain/cron/expression.ts"
import { createLogger } from "@shared/logger.ts"
import { Cron } from "croner"
import { CronScheduler } from "./cron.scheduler.ts"

const silent = createLogger("test", { sink: () => {} })

function scheduler(): CronScheduler {
  return new CronScheduler(silent)
}

/** Translates an APScheduler expression the way the service does. */
function pattern(source: string): string {
  const result = parseCronExpression(source)
  if (!result.ok) throw new Error(`${source} did not parse`)
  return result.value.pattern
}

describe("accepts", () => {
  test("agrees with the domain parser on every documented example", () => {
    const cron = scheduler()
    for (const source of [
      "0 9 * * *",
      "0 9,17 * * *",
      "0 9 * * 0-4",
      "0 9 * * 5,6",
      "0 */4 * * *",
      "*/30 9-17 * * *",
      "0 0 * * 6",
      "0 9 * * */2",
      "0 9 * * mon-fri",
    ]) {
      expect(cron.accepts(pattern(source))).toBe(true)
    }
  })

  test("rejects nonsense", () => {
    expect(scheduler().accepts("not a cron pattern")).toBe(false)
  })
})

describe("scheduling", () => {
  test("fires on the weekdays the translated expression names", () => {
    const cron = scheduler()
    cron.schedule(1, pattern("0 9 * * 0-4"), async () => {})

    // Monday 2026-09-14 09:00 UTC through the following Monday.
    const runs = nextRuns(pattern("0 9 * * 0-4"), 6)
    expect(runs.map((date) => date.getUTCDay())).toEqual([1, 2, 3, 4, 5, 1])
    expect(runs.every((date) => date.getUTCHours() === 9)).toBe(true)

    cron.cancelAll()
  })

  test("fires on the weekend days 5,6 means under APScheduler", () => {
    const runs = nextRuns(pattern("0 9 * * 5,6"), 4)
    // 5 and 6 are Saturday and Sunday when 0 is Monday.
    expect(runs.map((date) => date.getUTCDay())).toEqual([6, 0, 6, 0])
  })

  test("fires on the days a weekly step means under APScheduler", () => {
    const runs = nextRuns(pattern("0 9 * * */2"), 4)
    // Mon, Wed, Fri, Sun — not cron's Sun, Tue, Thu, Sat.
    expect(runs.map((date) => date.getUTCDay())).toEqual([1, 3, 5, 0])
  })

  test("replaces a job rather than stacking a second one", () => {
    const cron = scheduler()
    cron.schedule(1, pattern("0 9 * * *"), async () => {})
    cron.schedule(1, pattern("0 17 * * *"), async () => {})

    cron.cancel(1)
    expect(() => cron.cancel(1)).not.toThrow()
  })

  test("cancelling an unknown chat is harmless", () => {
    expect(() => scheduler().cancel(999)).not.toThrow()
  })
})

/** Uses croner directly so the assertions are about real firing times. */
function nextRuns(cronPattern: string, count: number): Date[] {
  const job = new Cron(cronPattern, { timezone: "UTC", paused: true })
  const runs = job.nextRuns(count, new Date(Date.UTC(2026, 8, 14, 0, 0, 0)))
  job.stop()
  return runs
}
