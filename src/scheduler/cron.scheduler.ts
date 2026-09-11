import type { Logger } from "@shared/logger.ts"
import { Cron } from "croner"
import type { ReminderJob, ReminderScheduler } from "./scheduler.port.ts"

/**
 * The only module that knows croner exists. Patterns arriving here are already
 * in croner's dialect — `domain/cron` has translated APScheduler's Monday-first
 * weekdays away.
 */
export class CronScheduler implements ReminderScheduler {
  readonly #jobs = new Map<number, Cron>()
  readonly #logger: Logger

  constructor(logger: Logger) {
    this.#logger = logger
  }

  accepts(pattern: string): boolean {
    try {
      new Cron(pattern, { timezone: "UTC", paused: true }).stop()
      return true
    } catch {
      return false
    }
  }

  schedule(chatId: number, pattern: string, job: ReminderJob): void {
    this.cancel(chatId)

    this.#jobs.set(
      chatId,
      new Cron(
        pattern,
        {
          name: `reminder_${chatId}`,
          timezone: "UTC",
          // A slow send must not stack up behind the next tick.
          protect: true,
          catch: (error: unknown) => {
            this.#logger.error(`Error sending reminder to chat ${chatId}`, error)
          },
        },
        job,
      ),
    )
  }

  cancel(chatId: number): void {
    const job = this.#jobs.get(chatId)
    if (!job) return
    job.stop()
    this.#jobs.delete(chatId)
  }

  cancelAll(): void {
    for (const job of this.#jobs.values()) job.stop()
    this.#jobs.clear()
  }
}
