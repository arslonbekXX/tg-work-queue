import type { TaskRef } from "./task.ts"

/**
 * Python stripped the `#` prefix but then looked the task up by the *unstripped*
 * value on the task-id branch, so `!wdone #repo/123` never matched. Stripping
 * once, here, fixes that for both branches.
 */
export function parseTaskRef(raw: string): TaskRef {
  const cleaned = raw.replace(/^#+/, "")
  if (/^\d+$/.test(cleaned)) return { kind: "seq", seqNum: Number(cleaned) }
  return { kind: "taskId", taskId: cleaned }
}
