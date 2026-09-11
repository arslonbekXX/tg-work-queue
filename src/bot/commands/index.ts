import type { CommandSpec } from "../command.ts"
import type { CommandDeps } from "./deps.ts"
import { reminderCommands } from "./reminder.ts"
import { wCommand } from "./w.ts"
import { waddCommand } from "./wadd.ts"
import { wassignCommand } from "./wassign.ts"
import { wdoneCommand } from "./wdone.ts"
import { whelpCommand } from "./whelp.ts"

/**
 * Listed in the order `handle_message` tested its patterns. Every claim is
 * either anchored or followed by a word boundary, so no two can match the same
 * text and the order is documentation rather than load-bearing logic — keeping
 * it makes the two versions readable side by side.
 */
export function createCommands(deps: CommandDeps): CommandSpec[] {
  return [
    waddCommand(deps),
    wCommand(deps),
    wdoneCommand(deps),
    whelpCommand(),
    ...reminderCommands(deps),
    wassignCommand(deps),
  ]
}

export type { CommandDeps }
