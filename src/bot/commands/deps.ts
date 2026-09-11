import type { ReminderService } from "@services/reminder.service.ts"
import type { TaskService } from "@services/task.service.ts"
import type { Logger } from "@shared/logger.ts"

export interface CommandDeps {
  readonly tasks: TaskService
  readonly reminders: ReminderService
  readonly logger: Logger
}
