import { type CommandSpec, WORD_BOUNDARY } from "../command.ts"
import * as views from "../views/reminder.view.ts"
import type { CommandDeps } from "./deps.ts"

const WITH_EXPRESSION = /^!wreminder-set\s+(.+)$/i

/**
 * The four reminder commands. Each pattern is anchored exactly as bot.py had
 * it, so `!wreminder` cannot swallow `!wreminder-set`.
 */
export function reminderCommands({ reminders }: CommandDeps): CommandSpec[] {
  return [
    {
      name: "wreminder-set",
      claim: new RegExp(`^!wreminder-set${WORD_BOUNDARY}`, "iu"),
      handle(context) {
        const expression = WITH_EXPRESSION.exec(context.text)?.[1]?.trim()
        // bot.py had no prefix fallback here, so a bare !wreminder-set was
        // matched by nothing at all and the bot said nothing.
        if (expression === undefined || expression.length === 0) return null

        const result = reminders.set(context.chatId, expression)
        if (result.ok) return views.reminderSet(expression)

        switch (result.error.kind) {
          case "wrong-field-count":
          case "invalid-field":
            return views.invalidCron(result.error)
          case "rejected-by-scheduler":
            return views.cronRejected(result.error.expression)
          case "schedule-failed":
            return views.reminderSetFailed()
        }
      },
    },
    {
      name: "wreminder-off",
      claim: /^!wreminder-off$/i,
      handle: (context) =>
        reminders.disable(context.chatId).ok
          ? views.reminderDisabled()
          : views.noReminderToDisable(),
    },
    {
      name: "wreminder-remove",
      claim: /^!wreminder-remove$/i,
      handle: (context) =>
        reminders.remove(context.chatId).ok ? views.reminderRemoved() : views.noReminderToRemove(),
    },
    {
      name: "wreminder",
      claim: /^!wreminder$/i,
      handle(context) {
        const reminder = reminders.status(context.chatId)
        return reminder === null ? views.noReminderConfigured() : views.reminderStatus(reminder)
      },
    },
  ]
}
