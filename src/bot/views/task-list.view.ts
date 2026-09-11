import type { Task } from "@domain/task.ts"
import { escapeHtml } from "@shared/html.ts"
import { htmlWithoutPreview, plain, type Reply } from "./reply.ts"

/**
 * The reminder is the only task list with a heading; `!w` prints the bare
 * lines. The trailing newline is part of the heading, so a blank line falls
 * between it and the first task — exactly as `send_reminder` built it.
 */
export const REMINDER_HEADING = "<b>📋 Reminder: Pending Reviews</b>\n"

/** `!w` on an empty queue. Python sent this without a parse mode. */
export function emptyQueue(): Reply {
  return plain("No tasks in the queue.")
}

/** `!w` — the bare list, no heading. */
export function taskList(tasks: readonly Task[]): Reply {
  return htmlWithoutPreview(tasks.map(taskLine).join("\n"))
}

/** The scheduled reminder — the same lines under a heading. */
export function reminderList(tasks: readonly Task[]): Reply {
  return htmlWithoutPreview([REMINDER_HEADING, ...tasks.map(taskLine)].join("\n"))
}

function taskLine(task: Task): string {
  const link = taskLink(task.url, task.taskId)
  const by = `(by ${escapeHtml(task.createdBy)})`

  if (task.assignees.length === 0) return `[#${task.seqNum}] ${link} ${by}`
  return `[#${task.seqNum}] ${link} → ${formatAssignees(task.assignees)} ${by}`
}

export function taskLink(url: string, taskId: string): string {
  return `<a href="${escapeHtml(url)}">${escapeHtml(taskId)}</a>`
}

export function formatAssignees(assignees: readonly string[]): string {
  return assignees.map(escapeHtml).join(", ")
}
