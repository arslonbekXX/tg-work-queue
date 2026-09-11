import { beforeEach, describe, expect, test } from "bun:test"
import { ReminderRepository } from "@db/reminder.repository.ts"
import { TaskRepository } from "@db/task.repository.ts"
import { createTestDatabase } from "@db/test-support.ts"
import { FakeScheduler } from "@scheduler/fake.scheduler.ts"
import { ReminderService } from "@services/reminder.service.ts"
import { ReminderDispatcher } from "@services/reminder-dispatcher.ts"
import { TaskService } from "@services/task.service.ts"
import { createLogger } from "@shared/logger.ts"
import { FakeNotifier } from "@telegram/fake.notifier.ts"
import type { CommandSpec } from "./command.ts"
import { createCommands } from "./commands/index.ts"
import { claimFor } from "./router.ts"

/**
 * The dispatch table. Python's if/elif chain decided which handler saw a
 * message; this asserts the same decisions, including the ones that must end in
 * silence.
 */

let commands: CommandSpec[]

beforeEach(() => {
  const db = createTestDatabase()
  const scheduler = new FakeScheduler()
  const reminderRepo = new ReminderRepository(db)
  const taskRepo = new TaskRepository(db)
  const logger = createLogger("test", { sink: () => {} })

  const dispatcher = new ReminderDispatcher({
    tasks: taskRepo,
    reminders: reminderRepo,
    scheduler,
    notifier: new FakeNotifier(),
    render: () => "",
    logger,
  })

  commands = createCommands({
    tasks: new TaskService(taskRepo),
    reminders: new ReminderService({ reminders: reminderRepo, scheduler, dispatcher, logger }),
    logger,
  })
})

function claim(text: string): string | null {
  return claimFor(commands, text)
}

describe("claiming", () => {
  test("routes each command to its own handler", () => {
    expect(claim("!wadd http://x/y/-/merge_requests/1")).toBe("wadd")
    expect(claim("!w")).toBe("w")
    expect(claim("!wdone 1")).toBe("wdone")
    expect(claim("!wassign 1 @alice")).toBe("wassign")
    expect(claim("!whelp")).toBe("whelp")
    expect(claim("!wreminder")).toBe("wreminder")
    expect(claim("!wreminder-set 0 9 * * *")).toBe("wreminder-set")
    expect(claim("!wreminder-off")).toBe("wreminder-off")
    expect(claim("!wreminder-remove")).toBe("wreminder-remove")
  })

  test("!w does not swallow the commands it is a prefix of", () => {
    expect(claim("!wadd x")).toBe("wadd")
    expect(claim("!whelp")).toBe("whelp")
    expect(claim("!wdone 1")).toBe("wdone")
  })

  test("bare !wreminder does not swallow its hyphenated siblings", () => {
    expect(claim("!wreminder-set 0 9 * * *")).toBe("wreminder-set")
    expect(claim("!wreminder-off")).toBe("wreminder-off")
    expect(claim("!wreminder-remove")).toBe("wreminder-remove")
  })

  test("claims a command with bad arguments so it can explain itself", () => {
    expect(claim("!wadd")).toBe("wadd")
    expect(claim("!wadd nonsense")).toBe("wadd")
    expect(claim("!wdone")).toBe("wdone")
    expect(claim("!wassign 1")).toBe("wassign")
  })

  test("is case-insensitive, as every pattern was", () => {
    expect(claim("!W")).toBe("w")
    expect(claim("!WADD http://x")).toBe("wadd")
    expect(claim("!WReminder")).toBe("wreminder")
  })

  test("ignores anything that is not one of the commands", () => {
    expect(claim("hello")).toBeNull()
    expect(claim("!wat")).toBeNull()
    expect(claim("w")).toBeNull()
    expect(claim("")).toBeNull()
    expect(claim("say !w in a sentence")).toBeNull()
  })

  test("ignores a command name with something glued to it", () => {
    expect(claim("!waddx")).toBeNull()
    expect(claim("!w x")).toBeNull()
    expect(claim("!whelp me")).toBeNull()
    expect(claim("!wreminder-offx")).toBeNull()
  })

  test("ignores a non-ASCII suffix too, as Python's Unicode word boundary did", () => {
    expect(claim("!waddж")).toBeNull()
  })

  test("ignores a trailing argument on the anchored commands", () => {
    expect(claim("!wreminder-off now")).toBeNull()
    expect(claim("!wreminder now")).toBeNull()
  })
})
