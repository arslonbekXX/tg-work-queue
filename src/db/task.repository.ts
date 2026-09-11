import type { Database } from "bun:sqlite"
import type { NewTask, Task, TaskRef } from "@domain/task.ts"
import type { TaskAssigneeRow, TaskRow } from "./rows.ts"
import { isConstraintViolation } from "./sqlite-errors.ts"

const TASK_COLUMNS = "id, chat_id, seq_num, task_id, url, assigned_to, created_by, created_at"

/**
 * Owns `tasks`, `task_assignees` and `seq_counters` together, because they form
 * one consistency unit: a sequence number cannot be allocated without inserting
 * the task, and assignees are meaningless without their parent row.
 *
 * Every method here is synchronous. bun:sqlite is synchronous, and `await`
 * inside a `db.transaction` callback would commit at the wrong moment — so the
 * async boundary lives one layer up, in the services.
 */
export class TaskRepository {
  readonly #db: Database
  readonly #add: (input: NewTask) => number
  readonly #remove: (chatId: number, ref: TaskRef) => Task | null
  readonly #updateAssignees: (
    chatId: number,
    ref: TaskRef,
    assignees: readonly string[],
  ) => Task | null

  constructor(db: Database) {
    this.#db = db

    // BEGIN IMMEDIATE rather than the default deferred: the transaction reads
    // seq_counters and then writes it, and a deferred transaction takes the
    // write lock too late to upgrade cleanly.
    const add = db.transaction((input: NewTask): number => this.#addWithinTransaction(input))
    this.#add = (input) => add.immediate(input)

    const remove = db.transaction((chatId: number, ref: TaskRef): Task | null => {
      const task = this.find(chatId, ref)
      if (task === null) return null
      this.#db.run("DELETE FROM tasks WHERE id = ?", [task.id])
      return task
    })
    this.#remove = (chatId, ref) => remove.immediate(chatId, ref)

    const update = db.transaction(
      (chatId: number, ref: TaskRef, assignees: readonly string[]): Task | null => {
        const task = this.find(chatId, ref)
        if (task === null) return null
        this.#replaceAssignees(task.id, assignees)
        // assigned_to is NOT NULL and nothing reads it any more, but Python
        // wrote the first assignee there and the column has to stay populated.
        this.#db.run("UPDATE tasks SET assigned_to = ? WHERE id = ?", [
          assignees[0] ?? "unassigned",
          task.id,
        ])
        return { ...task, assignees: [...assignees] }
      },
    )
    this.#updateAssignees = (chatId, ref, assignees) => update.immediate(chatId, ref, assignees)
  }

  /** Returns the new sequence number, or null when the task is already queued. */
  add(input: NewTask): number | null {
    try {
      return this.#add(input)
    } catch (error) {
      // The whole transaction rolls back, so an allocated sequence number is
      // handed back rather than leaving a permanent gap as Python did.
      if (isConstraintViolation(error)) return null
      throw error
    }
  }

  listByChat(chatId: number): Task[] {
    const rows = this.#db
      .query<TaskRow, [number]>(
        `SELECT ${TASK_COLUMNS} FROM tasks WHERE chat_id = ? ORDER BY seq_num ASC`,
      )
      .all(chatId)

    // One extra query for the whole chat rather than one per task.
    const assigneeRows = this.#db
      .query<TaskAssigneeRow, [number]>(
        `SELECT a.task_id, a.assignee
         FROM task_assignees a
         JOIN tasks t ON t.id = a.task_id
         WHERE t.chat_id = ?
         ORDER BY a.assignee`,
      )
      .all(chatId)

    const byTask = new Map<number, string[]>()
    for (const row of assigneeRows) {
      const bucket = byTask.get(row.task_id)
      if (bucket) bucket.push(row.assignee)
      else byTask.set(row.task_id, [row.assignee])
    }

    return rows.map((row) => toTask(row, byTask.get(row.id) ?? []))
  }

  find(chatId: number, ref: TaskRef): Task | null {
    const row =
      ref.kind === "seq"
        ? this.#db
            .query<TaskRow, [number, number]>(
              `SELECT ${TASK_COLUMNS} FROM tasks WHERE chat_id = ? AND seq_num = ?`,
            )
            .get(chatId, ref.seqNum)
        : this.#db
            .query<TaskRow, [number, string]>(
              `SELECT ${TASK_COLUMNS} FROM tasks WHERE chat_id = ? AND task_id = ?`,
            )
            .get(chatId, ref.taskId)

    return row === null ? null : toTask(row, this.#loadAssignees(row.id))
  }

  /** Returns the removed task so the reply can describe it without a second read. */
  remove(chatId: number, ref: TaskRef): Task | null {
    return this.#remove(chatId, ref)
  }

  /** Replaces every assignee, as `!wassign` has always done. */
  updateAssignees(chatId: number, ref: TaskRef, assignees: readonly string[]): Task | null {
    return this.#updateAssignees(chatId, ref, assignees)
  }

  #addWithinTransaction(input: NewTask): number {
    const seqNum = this.#allocateSeqNum(input.chatId)
    const inserted = this.#db.run(
      `INSERT INTO tasks (chat_id, seq_num, task_id, url, assigned_to, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.chatId,
        seqNum,
        input.taskId,
        input.url,
        input.assignees[0] ?? "unassigned",
        input.createdBy,
      ],
    )
    this.#replaceAssignees(Number(inserted.lastInsertRowid), input.assignees)
    return seqNum
  }

  /** Port of `_get_next_seq_num`: per-chat counters that never reuse a number. */
  #allocateSeqNum(chatId: number): number {
    const row = this.#db
      .query<{ next_num: number }, [number]>("SELECT next_num FROM seq_counters WHERE chat_id = ?")
      .get(chatId)

    if (row === null) {
      this.#db.run("INSERT INTO seq_counters (chat_id, next_num) VALUES (?, 2)", [chatId])
      return 1
    }

    this.#db.run("UPDATE seq_counters SET next_num = ? WHERE chat_id = ?", [
      row.next_num + 1,
      chatId,
    ])
    return row.next_num
  }

  #loadAssignees(taskDbId: number): string[] {
    return this.#db
      .query<{ assignee: string }, [number]>(
        "SELECT assignee FROM task_assignees WHERE task_id = ? ORDER BY assignee",
      )
      .all(taskDbId)
      .map((row) => row.assignee)
  }

  #replaceAssignees(taskDbId: number, assignees: readonly string[]): void {
    this.#db.run("DELETE FROM task_assignees WHERE task_id = ?", [taskDbId])
    for (const assignee of assignees) {
      if (assignee.length === 0) continue
      this.#db.run("INSERT OR IGNORE INTO task_assignees (task_id, assignee) VALUES (?, ?)", [
        taskDbId,
        assignee,
      ])
    }
  }
}

function toTask(row: TaskRow, assignees: string[]): Task {
  return {
    id: row.id,
    chatId: row.chat_id,
    seqNum: row.seq_num,
    taskId: row.task_id,
    url: row.url,
    assignees,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}
