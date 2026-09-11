import type { CommandSpec } from "../command.ts"
import { help } from "../views/help.view.ts"

export function whelpCommand(): CommandSpec {
  return {
    name: "whelp",
    claim: /^!whelp$/i,
    handle: () => help(),
  }
}
