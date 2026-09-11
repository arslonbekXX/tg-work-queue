import type { Database } from "bun:sqlite"
import type { CommandSpec } from "@bot/command.ts"
import { createCommands } from "@bot/commands/index.ts"
import { reminderList } from "@bot/views/task-list.view.ts"
import { ReminderRepository } from "@db/reminder.repository.ts"
import { TaskRepository } from "@db/task.repository.ts"
import type { ReminderScheduler } from "@scheduler/scheduler.port.ts"
import { ReminderService } from "@services/reminder.service.ts"
import { ReminderDispatcher } from "@services/reminder-dispatcher.ts"
import { TaskService } from "@services/task.service.ts"
import type { Logger } from "@shared/logger.ts"
import type { Notifier } from "@telegram/notifier.port.ts"

export interface ContainerDeps {
  readonly db: Database
  readonly notifier: Notifier
  readonly scheduler: ReminderScheduler
  readonly logger: Logger
}

export interface Container {
  readonly tasks: TaskService
  readonly reminders: ReminderService
  readonly commands: CommandSpec[]
}

/**
 * The composition root: the one place that knows every layer. It is pure
 * wiring, with no I/O, so a test can build the entire application around an
 * in-memory database and a fake network.
 *
 * Nothing in src/ holds module-level mutable state, so the global `db` and
 * `_scheduler` the Python version relied on have no counterpart here.
 */
export function createContainer({ db, notifier, scheduler, logger }: ContainerDeps): Container {
  const taskRepository = new TaskRepository(db)
  const reminderRepository = new ReminderRepository(db)

  const dispatcher = new ReminderDispatcher({
    tasks: taskRepository,
    reminders: reminderRepository,
    scheduler,
    notifier,
    // The view is handed in here so the service layer never reaches into the
    // presentation layer.
    render: (tasks) => reminderList(tasks).text,
    logger: logger.child("scheduler"),
  })

  const tasks = new TaskService(taskRepository)
  const reminders = new ReminderService({
    reminders: reminderRepository,
    scheduler,
    dispatcher,
    logger: logger.child("scheduler"),
  })

  return {
    tasks,
    reminders,
    commands: createCommands({ tasks, reminders, logger: logger.child("bot") }),
  }
}
