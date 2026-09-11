export type ReminderJob = () => Promise<void>

/**
 * The clock edge. Services depend on this rather than on croner so reminder
 * behaviour can be tested by triggering a job directly instead of waiting.
 */
export interface ReminderScheduler {
  /** Last line of defence: the domain parser and croner must agree on a pattern. */
  accepts(pattern: string): boolean
  /** Replaces any job already registered for the chat. */
  schedule(chatId: number, pattern: string, job: ReminderJob): void
  cancel(chatId: number): void
  cancelAll(): void
}
