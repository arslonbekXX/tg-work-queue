export interface Task {
  readonly id: number
  readonly chatId: number
  readonly seqNum: number
  readonly taskId: string
  readonly url: string
  readonly assignees: readonly string[]
  readonly createdBy: string
  /** Surfaced as the raw SQLite string, exactly as the Python version did. */
  readonly createdAt: string
}

export interface NewTask {
  readonly chatId: number
  readonly taskId: string
  readonly url: string
  readonly assignees: readonly string[]
  readonly createdBy: string
}

/** How the user referred to a task: `1`, `#1`, or `repo/123`. */
export type TaskRef =
  | { readonly kind: "seq"; readonly seqNum: number }
  | { readonly kind: "taskId"; readonly taskId: string }
