import { parseWaddCommand } from "@domain/wadd-input.ts"
import { type CommandSpec, WORD_BOUNDARY } from "../command.ts"
import * as errors from "../views/errors.view.ts"
import * as views from "../views/task.view.ts"
import type { CommandDeps } from "./deps.ts"

export function waddCommand({ tasks, logger }: CommandDeps): CommandSpec {
  return {
    name: "wadd",
    claim: new RegExp(`^!wadd${WORD_BOUNDARY}`, "iu"),
    handle(context) {
      const parsed = parseWaddCommand(context.text)
      if (!parsed.ok) return errors.waddFailure(parsed.error)

      const { url, assignees } = parsed.value
      const added = tasks.add({ chatId: context.chatId, url, assignees, createdBy: context.author })

      if (!added.ok) {
        switch (added.error.kind) {
          case "unsupported-link":
            return errors.unsupportedLink()
          case "duplicate":
            return views.taskAlreadyQueued(added.error.taskId)
        }
      }

      const log = assignees.length > 0 ? assignees.join(", ") : "unassigned"
      logger.info(`Added task ${added.value.taskId} in chat ${context.chatId}: ${url} -> ${log}`)

      return views.taskAdded(added.value.seqNum, url, added.value.taskId, assignees)
    },
  }
}
