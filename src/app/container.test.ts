import { describe, expect, test } from "bun:test"
import { createTestDatabase } from "@db/test-support.ts"
import { FakeScheduler } from "@scheduler/fake.scheduler.ts"
import { createLogger } from "@shared/logger.ts"
import { FakeNotifier } from "@telegram/fake.notifier.ts"
import { ChatGoneError } from "@telegram/notifier.port.ts"
import { createContainer } from "./container.ts"

/**
 * The whole application, wired as main.ts wires it, with only the network and
 * the clock faked. This is what proves the real view reaches the reminder path
 * and that commands, services and SQL agree end to end.
 */

const CHAT = -1001
const MR = "http://gitlab.example.com/group/monorepo/-/merge_requests/120"

function boot() {
  const scheduler = new FakeScheduler()
  const notifier = new FakeNotifier()
  const container = createContainer({
    db: createTestDatabase(),
    notifier,
    scheduler,
    logger: createLogger("test", { sink: () => {} }),
  })

  const send = (text: string, author = "@dave") => {
    const spec = container.commands.find((command) => command.claim.test(text))
    return spec?.handle({ chatId: CHAT, text, author }) ?? null
  }

  return { container, scheduler, notifier, send }
}

describe("the assembled application", () => {
  test("runs add, list and done end to end", () => {
    const { send } = boot()

    expect(send(`!wadd ${MR} @alice`)?.text).toBe(`[#1] <a href="${MR}">monorepo/120</a> → @alice`)
    expect(send("!w")?.text).toBe(`[#1] <a href="${MR}">monorepo/120</a> → @alice (by @dave)`)
    expect(send("!wdone 1")?.text).toStartWith("Removed [#1]")
    expect(send("!w")?.text).toBe("No tasks in the queue.")
  })

  test("sends the real reminder view when a scheduled tick fires", async () => {
    const { send, scheduler, notifier } = boot()

    send(`!wadd ${MR} @alice`)
    send("!wreminder-set 0 9 * * 0-4")

    await scheduler.trigger(CHAT)

    expect(notifier.sent).toEqual([
      {
        chatId: CHAT,
        html:
          "<b>📋 Reminder: Pending Reviews</b>\n" +
          "\n" +
          `[#1] <a href="${MR}">monorepo/120</a> → @alice (by @dave)`,
      },
    ])
  })

  test("stays silent on a tick with nothing queued", async () => {
    const { send, scheduler, notifier } = boot()

    send("!wreminder-set 0 9 * * *")
    await scheduler.trigger(CHAT)

    expect(notifier.sent).toEqual([])
  })

  test("switches the reminder off when the chat turns out to be gone", async () => {
    const { send, scheduler, notifier } = boot()

    send(`!wadd ${MR}`)
    send("!wreminder-set 0 9 * * *")
    notifier.failWith = new ChatGoneError(CHAT, "Forbidden: bot was kicked from the group chat")

    await scheduler.trigger(CHAT)

    expect(send("!wreminder")?.text).toContain("Status: ⏸ Disabled")
    expect(scheduler.jobs.size).toBe(0)
  })

  test("reloads enabled reminders on boot, translating the stored expression", () => {
    const { send, scheduler, container } = boot()

    send("!wreminder-set 0 9 * * 5,6")
    scheduler.cancelAll()

    container.reminders.restoreAll()

    expect(scheduler.patternFor(CHAT)).toBe("0 9 * * 0,6")
  })
})
