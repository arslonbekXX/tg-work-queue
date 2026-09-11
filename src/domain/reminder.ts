export interface Reminder {
  readonly chatId: number
  readonly cronExpression: string
  readonly enabled: boolean
  /** Raw SQLite timestamps, shown verbatim by `!wreminder` as Python did. */
  readonly createdAt: string
  readonly updatedAt: string
}
