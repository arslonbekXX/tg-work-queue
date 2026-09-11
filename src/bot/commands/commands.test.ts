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
import type { CommandSpec } from "../command.ts"
import type { Reply } from "../views/reply.ts"
import { createCommands } from "./index.ts"

/**
 * Text in, reply out, through the real services and real SQL. Only the network
 * and the clock are faked.
 */

const CHAT = -1001
const MR = "http://gitlab.example.com/group/monorepo/-/merge_requests/120"
const PR = "https://github.com/owner/backend/pull/45"

let commands: CommandSpec[]
let scheduler: FakeScheduler

beforeEach(() => {
  const db = createTestDatabase()
  scheduler = new FakeScheduler()
  const taskRepo = new TaskRepository(db)
  const reminderRepo = new ReminderRepository(db)
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

/** Runs a message the way the router would. */
function send(text: string, author = "@dave"): Reply | null {
  const trimmed = text.trim()
  const spec = commands.find((command) => command.claim.test(trimmed))
  if (spec === undefined) return null
  return spec.handle({ chatId: CHAT, text: trimmed, author })
}

function textOf(message: string): string {
  const reply = send(message)
  if (reply === null) throw new Error(`${message} produced no reply`)
  return reply.text
}

describe("!wadd", () => {
  test("adds and confirms", () => {
    expect(textOf(`!wadd ${MR}`)).toBe(`[#1] <a href="${MR}">monorepo/120</a>`)
  })

  test("adds with assignees, numbering per chat", () => {
    send(`!wadd ${MR}`)
    expect(textOf(`!wadd ${PR} @alice @bob`)).toBe(
      `[#2] <a href="${PR}">backend/45</a> → @alice, @bob`,
    )
  })

  test("refuses the same merge request twice", () => {
    send(`!wadd ${MR}`)
    expect(textOf(`!wadd ${MR}`)).toBe("Task monorepo/120 already exists in the queue.")
  })

  test("explains each bad-argument case", () => {
    expect(textOf("!wadd")).toStartWith("Missing URL.\nUsage:")
    expect(textOf("!wadd @alice")).toBe(
      "Missing URL. Provide a GitLab MR or GitHub PR link before the username(s).",
    )
    expect(textOf("!wadd nonsense")).toStartWith(
      "Invalid URL. Must start with http:// or https://\nExample:",
    )
    expect(textOf("!wadd nonsense @alice")).toBe("Invalid URL. Must start with http:// or https://")
    expect(textOf(`!wadd ${MR} bob`)).toBe(
      "Invalid username format. Use <code>@username</code> for each assignee (got: bob)",
    )
  })

  test("rejects a link that is not a merge or pull request", () => {
    expect(textOf("!wadd https://example.com/x")).toStartWith("Invalid URL. Please provide")
  })
})

describe("!w", () => {
  test("reports an empty queue", () => {
    expect(textOf("!w")).toBe("No tasks in the queue.")
  })

  test("lists what is queued, without a heading", () => {
    send(`!wadd ${MR} @bob @alice`)
    send(`!wadd ${PR}`)

    expect(textOf("!w")).toBe(
      `[#1] <a href="${MR}">monorepo/120</a> → @alice, @bob (by @dave)\n` +
        `[#2] <a href="${PR}">backend/45</a> (by @dave)`,
    )
  })

  test("credits whoever added the task", () => {
    send(`!wadd ${MR}`, "@erin")
    expect(textOf("!w")).toContain("(by @erin)")
  })
})

describe("!wdone", () => {
  beforeEach(() => {
    send(`!wadd ${MR}`)
  })

  test("removes by number", () => {
    expect(textOf("!wdone 1")).toBe(
      `Removed [#1] <a href="${MR}">monorepo/120</a> (added by @dave)`,
    )
    expect(textOf("!w")).toBe("No tasks in the queue.")
  })

  test("removes by number with a hash", () => {
    expect(textOf("!wdone #1")).toStartWith("Removed [#1]")
  })

  test("removes by task id", () => {
    expect(textOf("!wdone monorepo/120")).toStartWith("Removed [#1]")
  })

  test("removes by task id with a hash — the bug Python had", () => {
    expect(textOf("!wdone #monorepo/120")).toStartWith("Removed [#1]")
  })

  test("quotes an unknown reference exactly as typed", () => {
    expect(textOf("!wdone #9")).toBe("Task #9 not found.")
    expect(textOf("!wdone nope/1")).toBe("Task nope/1 not found.")
  })

  test("shows usage with no argument", () => {
    expect(textOf("!wdone")).toStartWith("Usage: <code>!wdone")
  })
})

describe("!wassign", () => {
  beforeEach(() => {
    send(`!wadd ${MR} @alice`)
  })

  test("replaces the assignees", () => {
    expect(textOf("!wassign 1 @eve @frank")).toBe(
      `[#1] <a href="${MR}">monorepo/120</a> → @eve, @frank`,
    )
    expect(textOf("!w")).toContain("→ @eve, @frank")
  })

  test("accepts a hash prefix and a task id", () => {
    expect(textOf("!wassign #1 @eve")).toContain("→ @eve")
    expect(textOf("!wassign monorepo/120 @gina")).toContain("→ @gina")
    expect(textOf("!wassign #monorepo/120 @hana")).toContain("→ @hana")
  })

  test("reports an unknown reference", () => {
    expect(textOf("!wassign 9 @eve")).toBe("Task 9 not found.")
  })

  test("shows usage when no assignee is given", () => {
    expect(textOf("!wassign 1")).toStartWith("Usage: <code>!wassign")
  })
})

describe("!wreminder", () => {
  test("reports nothing configured", () => {
    expect(textOf("!wreminder")).toStartWith("No reminder configured for this chat.\n\nUse")
  })

  test("sets, stores what was typed, and schedules the translated pattern", () => {
    expect(textOf("!wreminder-set 0 9 * * 0-4")).toStartWith("✅ Reminder set successfully!")
    expect(textOf("!wreminder")).toContain("Schedule: <code>0 9 * * 0-4</code>")
    expect(scheduler.patternFor(CHAT)).toBe("0 9 * * 1,2,3,4,5")
  })

  test("rejects an expression that is not five fields", () => {
    expect(textOf("!wreminder-set 0 9 * *")).toStartWith(
      "❌ Invalid cron expression. Must have 5 parts",
    )
  })

  test("names the offending field", () => {
    expect(textOf("!wreminder-set 0 9 * * 7")).toBe(
      "❌ Invalid cron expression: Unrecognized expression &quot;7&quot; for field &quot;day_of_week&quot;\n\n" +
        "Please check your expression and try again.\n" +
        "Example: <code>!wreminder-set 0 9 * * *</code>",
    )
  })

  test("says nothing to a bare !wreminder-set, as bot.py did", () => {
    expect(send("!wreminder-set")).toBeNull()
  })

  test("disables without discarding the schedule", () => {
    send("!wreminder-set 0 9 * * *")

    expect(textOf("!wreminder-off")).toStartWith("⏸ Reminder disabled.")
    expect(textOf("!wreminder")).toContain("Status: ⏸ Disabled")
    expect(textOf("!wreminder")).toContain("Schedule: <code>0 9 * * *</code>")
    expect(scheduler.jobs.size).toBe(0)
  })

  test("removes the configuration", () => {
    send("!wreminder-set 0 9 * * *")

    expect(textOf("!wreminder-remove")).toStartWith("🗑 Reminder configuration deleted.")
    expect(textOf("!wreminder")).toStartWith("No reminder configured")
  })

  test("reports when there is nothing to disable or remove", () => {
    expect(textOf("!wreminder-off")).toBe(
      "No reminder configured for this chat.\n" +
        "Use <code>!wreminder-set &lt;cron_expression&gt;</code> to set one.",
    )
    expect(textOf("!wreminder-remove")).toBe("No reminder configured for this chat.")
  })
})

describe("!whelp", () => {
  test("returns the help text", () => {
    expect(textOf("!whelp")).toStartWith("<b>Work Queue Commands</b>")
  })
})

describe("queues are isolated per chat", () => {
  test("the same merge request can be queued in two chats", () => {
    send(`!wadd ${MR}`)

    const other = commands.find((command) => command.name === "wadd")
    const reply = other?.handle({ chatId: -2002, text: `!wadd ${MR}`, author: "@dave" })
    expect(reply?.text).toBe(`[#1] <a href="${MR}">monorepo/120</a>`)
  })
})
