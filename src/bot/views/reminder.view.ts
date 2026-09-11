import type { CronFailure } from "@domain/cron/expression.ts"
import type { Reminder } from "@domain/reminder.ts"
import { escapeHtml } from "@shared/html.ts"
import { html, type Reply } from "./reply.ts"

/** Every `!wreminder*` message, transcribed from bot.py before it was deleted. */

/** `!wreminder` with nothing configured. */
export function noReminderConfigured(): Reply {
  return html(
    "No reminder configured for this chat.\n\nUse <code>!wreminder-set &lt;cron_expression&gt;</code> to set one.\nExample: <code>!wreminder-set 0 9 * * *</code> (daily at 9 AM UTC)",
  )
}

/** `!wreminder` — the timestamps are SQLite's own strings, unescaped as before. */
export function reminderStatus(reminder: Reminder): Reply {
  const status = reminder.enabled ? "✅ Enabled" : "⏸ Disabled"
  return html(
    "<b>Reminder Configuration</b>\n\nStatus: " +
      status +
      "\nSchedule: <code>" +
      escapeHtml(reminder.cronExpression) +
      "</code>\nTimezone: UTC\nCreated: " +
      reminder.createdAt +
      "\nUpdated: " +
      reminder.updatedAt +
      "\n\nUse <code>!wreminder-off</code> to disable or <code>!wreminder-remove</code> to delete.",
  )
}

/**
 * `!wreminder-set` with an expression APScheduler would have refused.
 *
 * The wrong-field-count message is Python's verbatim. The per-field message
 * quotes APScheduler's own wording, which is what the old code interpolated
 * from the raised ValueError.
 */
export function invalidCron(failure: CronFailure): Reply {
  if (failure.kind === "wrong-field-count")
    return html(
      "❌ Invalid cron expression. Must have 5 parts: minute hour day month day_of_week\n\n<b>Format:</b> <code>* * * * *</code>\n         ↓ ↓ ↓ ↓ ↓\n         │ │ │ │ └─ Day of week (0-6, 0=Mon, 6=Sun)\n         │ │ │ └─── Month (1-12)\n         │ │ └───── Day (1-31)\n         │ └─────── Hour (0-23)\n         └───────── Minute (0-59)\n\n<b>Examples:</b>\n• <code>0 9 * * *</code> - Daily at 9 AM UTC\n• <code>0 9,17 * * *</code> - Daily at 9 AM & 5 PM UTC\n• <code>0 9 * * 0-4</code> - Weekdays at 9 AM UTC\n• <code>0 */4 * * *</code> - Every 4 hours",
    )

  const reason = `Unrecognized expression "${failure.expression}" for field "${failure.field}"`
  return html(
    "❌ Invalid cron expression: " +
      escapeHtml(reason) +
      "\n\nPlease check your expression and try again.\nExample: <code>!wreminder-set 0 9 * * *</code>",
  )
}

/** `!wreminder-set` succeeded. */
export function reminderSet(cronExpression: string): Reply {
  return html(
    "✅ Reminder set successfully!\n\nSchedule: <code>" +
      escapeHtml(cronExpression) +
      "</code>\nTimezone: UTC\n\nYou'll receive reminders when there are pending tasks.\nUse <code>!wreminder</code> to check status.",
  )
}

/** `!wreminder-set` persisted but could not be scheduled. */
export function reminderSetFailed(): Reply {
  return html("❌ Error setting reminder. Please try again later.")
}

/** `!wreminder-off` with nothing configured. */
export function noReminderToDisable(): Reply {
  return html(
    "No reminder configured for this chat.\nUse <code>!wreminder-set &lt;cron_expression&gt;</code> to set one.",
  )
}

/** `!wreminder-off` succeeded. */
export function reminderDisabled(): Reply {
  return html(
    "⏸ Reminder disabled.\n\nYour configuration is saved. Use <code>!wreminder-set &lt;cron_expression&gt;</code> to re-enable.",
  )
}

/** `!wreminder-remove` with nothing configured. */
export function noReminderToRemove(): Reply {
  return html("No reminder configured for this chat.")
}

/** `!wreminder-remove` succeeded. */
export function reminderRemoved(): Reply {
  return html(
    "🗑 Reminder configuration deleted.\n\nUse <code>!wreminder-set &lt;cron_expression&gt;</code> to create a new one.",
  )
}

/**
 * The domain parser accepted the expression but croner refused it. Python
 * wrapped APScheduler's raised error the same way.
 */
export function cronRejected(expression: string): Reply {
  return html(
    "❌ Invalid cron expression: " +
      escapeHtml(`Unrecognized expression "${expression}"`) +
      "\n\nPlease check your expression and try again.\nExample: <code>!wreminder-set 0 9 * * *</code>",
  )
}
