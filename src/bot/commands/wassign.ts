import { parseAssignees } from "@domain/assignees.ts"
import { type CommandSpec, WORD_BOUNDARY } from "../command.ts"
import { wassignUsage } from "../views/errors.view.ts"
import { taskAssigned, taskNotFound } from "../views/task.view.ts"
import type { CommandDeps } from "./deps.ts"

/** Non-greedy reference, then one or more mentions — as in bot.py. */
const WITH_ASSIGNEES = /^!wassign\s+(.+?)\s+((?:@[\p{L}\p{N}_]+\s*)+)$/iu

export function wassignCommand({ tasks, logger }: CommandDeps): CommandSpec {
  return {
    name: "wassign",
    claim: new RegExp(`^!wassign${WORD_BOUNDARY}`, "iu"),
    handle(context) {
      const match = WITH_ASSIGNEES.exec(context.text)
      if (!match?.[1]) return wassignUsage()

      const reference = match[1].trim()
      const assignees = parseAssignees(match[2] ?? "")

      const updated = tasks.assign(context.chatId, reference, assignees)
      if (!updated.ok) return taskNotFound(updated.error.ref)

      const log = assignees.length > 0 ? assignees.join(", ") : "unassigned"
      logger.info(
        `Assigned task #${updated.value.seqNum} (${updated.value.taskId}) to ${log} in chat ${context.chatId}`,
      )
      return taskAssigned(updated.value, assignees)
    },
  }
}
