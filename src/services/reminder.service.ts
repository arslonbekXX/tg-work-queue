import type { ReminderRepository } from "@db/reminder.repository.ts"
import { type CronFailure, parseCronExpression } from "@domain/cron/expression.ts"
import type { NoReminderFailure } from "@domain/failures.ts"
import type { Reminder } from "@domain/reminder.ts"
import type { ReminderScheduler } from "@scheduler/scheduler.port.ts"
import type { Logger } from "@shared/logger.ts"
import { err, ok, type Result } from "@shared/result.ts"
import type { ReminderDispatcher } from "./reminder-dispatcher.ts"

export type SetReminderFailure =
  | CronFailure
  /** The domain parser accepted the expression but croner did not. */
  | { readonly kind: "rejected-by-scheduler"; readonly expression: string }
  /** Saved, but the job could not be registered. */
  | { readonly kind: "schedule-failed" }

export class ReminderService {
  readonly #reminders: ReminderRepository
  readonly #scheduler: ReminderScheduler
  readonly #dispatcher: ReminderDispatcher
  readonly #logger: Logger

  constructor(deps: {
    reminders: ReminderRepository
    scheduler: ReminderScheduler
    dispatcher: ReminderDispatcher
    logger: Logger
  }) {
    this.#reminders = deps.reminders
    this.#scheduler = deps.scheduler
    this.#dispatcher = deps.dispatcher
    this.#logger = deps.logger
  }

  status(chatId: number): Reminder | null {
    return this.#reminders.get(chatId)
  }

  /**
   * Validation is side-effect free and runs first, so a bad expression never
   * touches the database. Persisting before scheduling means a scheduling
   * failure is recoverable on the next boot, when `restoreAll` runs.
   */
  set(chatId: number, source: string): Result<Reminder, SetReminderFailure> {
    const parsed = parseCronExpression(source)
    if (!parsed.ok) return err(parsed.error)

    if (!this.#scheduler.accepts(parsed.value.pattern)) {
      return err({ kind: "rejected-by-scheduler", expression: source })
    }

    const saved = this.#reminders.upsert(chatId, parsed.value.source)

    try {
      this.#schedule(chatId, parsed.value.pattern)
    } catch (error) {
      this.#logger.error(`Error setting reminder for chat ${chatId}`, error)
      return err({ kind: "schedule-failed" })
    }

    this.#logger.info(`Set reminder for chat ${chatId}: ${parsed.value.source}`)
    return ok(saved)
  }

  /** Keeps the configuration, as `!wreminder-off` always did. */
  disable(chatId: number): Result<void, NoReminderFailure> {
    if (!this.#reminders.setEnabled(chatId, false)) return err({ kind: "no-reminder" })

    this.#scheduler.cancel(chatId)
    this.#logger.info(`Disabled reminder for chat ${chatId}`)
    return ok(undefined)
  }

  remove(chatId: number): Result<void, NoReminderFailure> {
    if (!this.#reminders.remove(chatId)) return err({ kind: "no-reminder" })

    this.#scheduler.cancel(chatId)
    this.#logger.info(`Removed reminder for chat ${chatId}`)
    return ok(undefined)
  }

  /**
   * Boot-time reload. A stored expression that no longer parses disables only
   * itself — the rest of the bot carries on, as `load_existing_reminders` did.
   */
  restoreAll(): void {
    const active = this.#reminders.listEnabled()

    for (const reminder of active) {
      const parsed = parseCronExpression(reminder.cronExpression)
      if (!parsed.ok) {
        this.#logger.error(
          `Failed to load reminder for chat ${reminder.chatId}: cannot parse "${reminder.cronExpression}"`,
        )
        continue
      }

      try {
        this.#schedule(reminder.chatId, parsed.value.pattern)
        this.#logger.info(`Loaded reminder for chat ${reminder.chatId}: ${reminder.cronExpression}`)
      } catch (error) {
        this.#logger.error(`Failed to load reminder for chat ${reminder.chatId}`, error)
      }
    }

    this.#logger.info(`Loaded ${active.length} active reminder(s)`)
  }

  #schedule(chatId: number, pattern: string): void {
    this.#scheduler.schedule(chatId, pattern, () => this.#dispatcher.dispatch(chatId))
  }
}
