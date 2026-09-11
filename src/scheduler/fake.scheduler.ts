import type { ReminderJob, ReminderScheduler } from "./scheduler.port.ts"

/**
 * Runs jobs on demand rather than on a clock, so service tests can assert what
 * a tick does without any waiting.
 */
export class FakeScheduler implements ReminderScheduler {
  readonly jobs = new Map<number, { pattern: string; job: ReminderJob }>()
  /** Patterns to reject, standing in for croner disagreeing with the parser. */
  readonly rejects = new Set<string>()

  accepts(pattern: string): boolean {
    return !this.rejects.has(pattern)
  }

  schedule(chatId: number, pattern: string, job: ReminderJob): void {
    this.jobs.set(chatId, { pattern, job })
  }

  cancel(chatId: number): void {
    this.jobs.delete(chatId)
  }

  cancelAll(): void {
    this.jobs.clear()
  }

  patternFor(chatId: number): string | undefined {
    return this.jobs.get(chatId)?.pattern
  }

  /** Fires the chat's job as the cron tick would. */
  async trigger(chatId: number): Promise<void> {
    const entry = this.jobs.get(chatId)
    if (!entry) throw new Error(`No reminder scheduled for chat ${chatId}`)
    await entry.job()
  }
}
