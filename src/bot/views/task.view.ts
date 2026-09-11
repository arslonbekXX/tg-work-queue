import type { Task } from "@domain/task.ts"
import { escapeHtml } from "@shared/html.ts"
import { htmlWithoutPreview, plain, type Reply } from "./reply.ts"
import { formatAssignees, taskLink } from "./task-list.view.ts"

/**
 * `!wadd` succeeded. The assignees echoed back are the ones just given, in the
 * order they were typed — Python used the local list here, not the stored
 * (alphabetical) order.
 */
export function taskAdded(
  seqNum: number,
  url: string,
  taskId: string,
  assignees: readonly string[],
): Reply {
  const line = `[#${seqNum}] ${taskLink(url, taskId)}`
  if (assignees.length === 0) return htmlWithoutPreview(line)
  return htmlWithoutPreview(`${line} → ${formatAssignees(assignees)}`)
}

/** `!wadd` with a task already queued. Plain text, and the id is not escaped. */
export function taskAlreadyQueued(taskId: string): Reply {
  return plain(`Task ${taskId} already exists in the queue.`)
}

/** `!wdone` succeeded. */
export function taskRemoved(task: Task): Reply {
  return htmlWithoutPreview(
    `Removed [#${task.seqNum}] ${taskLink(task.url, task.taskId)} (added by ${escapeHtml(task.createdBy)})`,
  )
}

/** `!wassign` succeeded. */
export function taskAssigned(task: Task, assignees: readonly string[]): Reply {
  const line = `[#${task.seqNum}] ${taskLink(task.url, task.taskId)}`
  if (assignees.length === 0) return htmlWithoutPreview(`${line} (unassigned)`)
  return htmlWithoutPreview(`${line} → ${formatAssignees(assignees)}`)
}

/**
 * `!wdone` and `!wassign` on an unknown task. Plain text, quoting the reference
 * exactly as typed — including any `#` prefix.
 */
export function taskNotFound(reference: string): Reply {
  return plain(`Task ${reference} not found.`)
}
