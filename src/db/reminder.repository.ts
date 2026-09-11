import type { Database } from "bun:sqlite"
import type { Reminder } from "@domain/reminder.ts"
import type { ReminderRow } from "./rows.ts"

const REMINDER_COLUMNS = "chat_id, cron_expression, enabled, created_at, updated_at"

export class ReminderRepository {
  readonly #db: Database

  constructor(db: Database) {
    this.#db = db
  }

  get(chatId: number): Reminder | null {
    const row = this.#db
      .query<ReminderRow, [number]>(`SELECT ${REMINDER_COLUMNS} FROM reminders WHERE chat_id = ?`)
      .get(chatId)
    return row === null ? null : toReminder(row)
  }

  /** Port of `set_reminder`, which upserted and always re-enabled. */
  upsert(chatId: number, cronExpression: string): Reminder {
    this.#db.run(
      `INSERT INTO reminders (chat_id, cron_expression, enabled, created_at, updated_at)
       VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(chat_id) DO UPDATE SET
         cron_expression = excluded.cron_expression,
         enabled = excluded.enabled,
         updated_at = CURRENT_TIMESTAMP`,
      [chatId, cronExpression],
    )

    const saved = this.get(chatId)
    if (saved === null)
      throw new Error(`Reminder for chat ${chatId} vanished immediately after upsert`)
    return saved
  }

  listEnabled(): Reminder[] {
    return this.#db
      .query<ReminderRow, []>(`SELECT ${REMINDER_COLUMNS} FROM reminders WHERE enabled = 1`)
      .all()
      .map(toReminder)
  }

  /** Returns false when there was no reminder to change, as Python's rowcount did. */
  setEnabled(chatId: number, enabled: boolean): boolean {
    const result = this.#db.run(
      "UPDATE reminders SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?",
      [enabled ? 1 : 0, chatId],
    )
    return result.changes > 0
  }

  remove(chatId: number): boolean {
    return this.#db.run("DELETE FROM reminders WHERE chat_id = ?", [chatId]).changes > 0
  }
}

function toReminder(row: ReminderRow): Reminder {
  return {
    chatId: row.chat_id,
    cronExpression: row.cron_expression,
    enabled: row.enabled !== 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
