import type { CommandSpec } from "../command.ts"
import { emptyQueue, taskList } from "../views/task-list.view.ts"
import type { CommandDeps } from "./deps.ts"

export function wCommand({ tasks }: CommandDeps): CommandSpec {
  return {
    name: "w",
    claim: /^!w$/i,
    handle(context) {
      const pending = tasks.list(context.chatId)
      return pending.length === 0 ? emptyQueue() : taskList(pending)
    },
  }
}
