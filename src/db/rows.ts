/**
 * The snake_case shapes SQLite hands back. These never leave `db/` — the
 * repositories map them to the camelCase domain types.
 */

export interface TaskRow {
  readonly id: number
  readonly chat_id: number
  readonly seq_num: number
  readonly task_id: string
  readonly url: string
  readonly assigned_to: string
  readonly created_by: string
  readonly created_at: string
}

export interface TaskAssigneeRow {
  readonly task_id: number
  readonly assignee: string
}

export interface ReminderRow {
  readonly chat_id: number
  readonly cron_expression: string
  /** SQLite has no boolean type; this is 0 or 1. */
  readonly enabled: number
  readonly created_at: string
  readonly updated_at: string
}

export interface CountRow {
  readonly count: number
}
