import { type CommandSpec, WORD_BOUNDARY } from "../command.ts"
import { wdoneUsage } from "../views/errors.view.ts"
import { taskNotFound, taskRemoved } from "../views/task.view.ts"
import type { CommandDeps } from "./deps.ts"

const WITH_REFERENCE = /^!wdone\s+(.+)$/i

export function wdoneCommand({ tasks, logger }: CommandDeps): CommandSpec {
  return {
    name: "wdone",
    claim: new RegExp(`^!wdone${WORD_BOUNDARY}`, "iu"),
    handle(context) {
      const reference = WITH_REFERENCE.exec(context.text)?.[1]?.trim()
      if (reference === undefined || reference.length === 0) return wdoneUsage()

      const removed = tasks.complete(context.chatId, reference)
      if (!removed.ok) return taskNotFound(removed.error.ref)

      logger.info(
        `Removed task #${removed.value.seqNum} (${removed.value.taskId}) from chat ${context.chatId}`,
      )
      return taskRemoved(removed.value)
    },
  }
}
