import type { TaskRepository } from "@db/task.repository.ts"
import type { AddTaskFailure, TaskLookupFailure } from "@domain/failures.ts"
import type { Task } from "@domain/task.ts"
import { parseTaskRef } from "@domain/task-ref.ts"
import { extractTaskId } from "@domain/task-url.ts"
import { err, ok, type Result } from "@shared/result.ts"

export interface AddTaskCommand {
  readonly chatId: number
  readonly url: string
  readonly assignees: readonly string[]
  readonly createdBy: string
}

export interface AddedTask {
  readonly seqNum: number
  readonly taskId: string
  readonly url: string
  readonly assignees: readonly string[]
}

export class TaskService {
  readonly #tasks: TaskRepository

  constructor(tasks: TaskRepository) {
    this.#tasks = tasks
  }

  add(command: AddTaskCommand): Result<AddedTask, AddTaskFailure> {
    const taskId = extractTaskId(command.url)
    if (taskId === null) return err({ kind: "unsupported-link" })

    const seqNum = this.#tasks.add({
      chatId: command.chatId,
      taskId,
      url: command.url,
      assignees: command.assignees,
      createdBy: command.createdBy,
    })
    if (seqNum === null) return err({ kind: "duplicate", taskId })

    return ok({ seqNum, taskId, url: command.url, assignees: command.assignees })
  }

  list(chatId: number): Task[] {
    return this.#tasks.listByChat(chatId)
  }

  /**
   * `reference` is whatever the user typed, `#` and all; it is echoed back
   * verbatim in the not-found message, so it travels with the failure.
   */
  complete(chatId: number, reference: string): Result<Task, TaskLookupFailure> {
    const removed = this.#tasks.remove(chatId, parseTaskRef(reference))
    return removed === null ? err({ kind: "not-found", ref: reference }) : ok(removed)
  }

  /** Replaces every assignee, as `!wassign` has always done. */
  assign(
    chatId: number,
    reference: string,
    assignees: readonly string[],
  ): Result<Task, TaskLookupFailure> {
    const updated = this.#tasks.updateAssignees(chatId, parseTaskRef(reference), assignees)
    return updated === null ? err({ kind: "not-found", ref: reference }) : ok(updated)
  }
}
