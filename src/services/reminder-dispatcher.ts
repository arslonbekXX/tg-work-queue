import type { ReminderRepository } from "@db/reminder.repository.ts"
import type { TaskRepository } from "@db/task.repository.ts"
import type { Task } from "@domain/task.ts"
import type { ReminderScheduler } from "@scheduler/scheduler.port.ts"
import type { Logger } from "@shared/logger.ts"
import { ChatGoneError, type Notifier } from "@telegram/notifier.port.ts"

/**
 * Renders the reminder body. Injected as a function so the service layer does
 * not have to reach into the presentation layer; the composition root supplies
 * the real view.
 */
export type ReminderRenderer = (tasks: readonly Task[]) => string

export interface ReminderDispatcherDeps {
  readonly tasks: TaskRepository
  readonly reminders: ReminderRepository
  readonly scheduler: ReminderScheduler
  readonly notifier: Notifier
  readonly render: ReminderRenderer
  readonly logger: Logger
}

/** What one cron tick does. */
export class ReminderDispatcher {
  readonly #deps: ReminderDispatcherDeps

  constructor(deps: ReminderDispatcherDeps) {
    this.#deps = deps
  }

  /**
   * An arrow field, not a method: this is handed straight to croner as a
   * callback and a plain method would lose its receiver.
   */
  readonly dispatch = async (chatId: number): Promise<void> => {
    const { tasks, reminders, scheduler, notifier, render, logger } = this.#deps

    const pending = tasks.listByChat(chatId)
    if (pending.length === 0) {
      logger.info(`No pending tasks for chat ${chatId}, skipping reminder`)
      return
    }

    try {
      await notifier.sendHtml(chatId, render(pending))
      logger.info(`Sent reminder to chat ${chatId} with ${pending.length} task(s)`)
    } catch (error) {
      if (error instanceof ChatGoneError) {
        // Retrying will never work, so stop rather than failing every tick.
        reminders.setEnabled(chatId, false)
        scheduler.cancel(chatId)
        logger.warning(`Chat ${chatId} is unreachable (${error.reason}); reminder disabled`)
        return
      }
      logger.error(`Error sending reminder to chat ${chatId}`, error)
    }
  }
}
