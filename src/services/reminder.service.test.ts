import { beforeEach, describe, expect, test } from "bun:test"
import { ReminderRepository } from "@db/reminder.repository.ts"
import { TaskRepository } from "@db/task.repository.ts"
import { createTestDatabase } from "@db/test-support.ts"
import { FakeScheduler } from "@scheduler/fake.scheduler.ts"
import { createLogger } from "@shared/logger.ts"
import { FakeNotifier } from "@telegram/fake.notifier.ts"
import { ChatGoneError } from "@telegram/notifier.port.ts"
import { ReminderService } from "./reminder.service.ts"
import { ReminderDispatcher } from "./reminder-dispatcher.ts"

const CHAT = -1001
const MR_URL = "http://gitlab.example.com/group/monorepo/-/merge_requests/120"
const silent = createLogger("test", { sink: () => {} })

let tasks: TaskRepository
let reminders: ReminderRepository
let scheduler: FakeScheduler
let notifier: FakeNotifier
let service: ReminderService

beforeEach(() => {
  const db = createTestDatabase()
  tasks = new TaskRepository(db)
  reminders = new ReminderRepository(db)
  scheduler = new FakeScheduler()
  notifier = new FakeNotifier()

  const dispatcher = new ReminderDispatcher({
    tasks,
    reminders,
    scheduler,
    notifier,
    render: (list) => `reminder:${list.map((task) => task.taskId).join(",")}`,
    logger: silent,
  })

  service = new ReminderService({ reminders, scheduler, dispatcher, logger: silent })
})

function queueTask(taskId = "monorepo/120"): void {
  tasks.add({ chatId: CHAT, taskId, url: MR_URL, assignees: [], createdBy: "@dave" })
}

describe("set", () => {
  test("stores what the user typed and schedules the translated pattern", () => {
    const result = service.set(CHAT, "0 9 * * 0-4")

    expect(result.ok && result.value.cronExpression).toBe("0 9 * * 0-4")
    expect(reminders.get(CHAT)?.cronExpression).toBe("0 9 * * 0-4")
    expect(scheduler.patternFor(CHAT)).toBe("0 9 * * 1,2,3,4,5")
  })

  test("never touches the database when the expression is bad", () => {
    expect(service.set(CHAT, "0 9 * *")).toEqual({
      ok: false,
      error: { kind: "wrong-field-count" },
    })
    expect(reminders.get(CHAT)).toBeNull()
    expect(scheduler.jobs.size).toBe(0)
  })

  test("names the offending field", () => {
    const result = service.set(CHAT, "0 9 * * 7")
    expect(!result.ok && result.error).toEqual({
      kind: "invalid-field",
      expression: "7",
      field: "day_of_week",
    })
  })

  test("reports a pattern croner refuses even though the parser accepted it", () => {
    scheduler.rejects.add("0 9 * * 1,2,3,4,5")

    const result = service.set(CHAT, "0 9 * * 0-4")
    expect(!result.ok && result.error).toEqual({
      kind: "rejected-by-scheduler",
      expression: "0 9 * * 0-4",
    })
    expect(reminders.get(CHAT)).toBeNull()
  })

  test("replaces an existing schedule rather than adding a second", () => {
    service.set(CHAT, "0 9 * * *")
    service.set(CHAT, "0 17 * * *")

    expect(scheduler.jobs.size).toBe(1)
    expect(scheduler.patternFor(CHAT)).toBe("0 17 * * *")
  })

  test("re-enables a disabled reminder", () => {
    service.set(CHAT, "0 9 * * *")
    service.disable(CHAT)

    expect(service.set(CHAT, "0 9 * * *").ok).toBe(true)
    expect(reminders.get(CHAT)?.enabled).toBe(true)
    expect(scheduler.jobs.size).toBe(1)
  })
})

describe("disable and remove", () => {
  test("disable keeps the configuration but stops the job", () => {
    service.set(CHAT, "0 9 * * *")

    expect(service.disable(CHAT).ok).toBe(true)
    expect(reminders.get(CHAT)?.cronExpression).toBe("0 9 * * *")
    expect(reminders.get(CHAT)?.enabled).toBe(false)
    expect(scheduler.jobs.size).toBe(0)
  })

  test("remove discards it", () => {
    service.set(CHAT, "0 9 * * *")

    expect(service.remove(CHAT).ok).toBe(true)
    expect(reminders.get(CHAT)).toBeNull()
    expect(scheduler.jobs.size).toBe(0)
  })

  test("both report when there is nothing configured", () => {
    expect(service.disable(CHAT)).toEqual({ ok: false, error: { kind: "no-reminder" } })
    expect(service.remove(CHAT)).toEqual({ ok: false, error: { kind: "no-reminder" } })
  })
})

describe("restoreAll", () => {
  test("schedules exactly the enabled reminders", () => {
    reminders.upsert(CHAT, "0 9 * * 0-4")
    reminders.upsert(-2, "0 17 * * *")
    reminders.setEnabled(-2, false)

    service.restoreAll()

    expect([...scheduler.jobs.keys()]).toEqual([CHAT])
    expect(scheduler.patternFor(CHAT)).toBe("0 9 * * 1,2,3,4,5")
  })

  test("skips only the reminder whose stored expression no longer parses", () => {
    reminders.upsert(CHAT, "not a cron expression")
    reminders.upsert(-2, "0 9 * * *")

    service.restoreAll()

    expect([...scheduler.jobs.keys()]).toEqual([-2])
  })
})

describe("a scheduled tick", () => {
  test("stays silent when the queue is empty", async () => {
    service.set(CHAT, "0 9 * * *")
    await scheduler.trigger(CHAT)

    expect(notifier.sent).toEqual([])
  })

  test("sends the rendered reminder when work is pending", async () => {
    queueTask()
    service.set(CHAT, "0 9 * * *")

    await scheduler.trigger(CHAT)

    expect(notifier.sent).toEqual([{ chatId: CHAT, html: "reminder:monorepo/120" }])
  })

  test("disables the reminder when the chat is gone for good", async () => {
    queueTask()
    service.set(CHAT, "0 9 * * *")
    notifier.failWith = new ChatGoneError(CHAT, "Forbidden: bot was kicked from the group chat")

    await scheduler.trigger(CHAT)

    expect(reminders.get(CHAT)?.enabled).toBe(false)
    expect(scheduler.jobs.size).toBe(0)
    // The configuration survives, so the chat can re-enable it later.
    expect(reminders.get(CHAT)?.cronExpression).toBe("0 9 * * *")
  })

  test("keeps the reminder alive after a transient failure", async () => {
    queueTask()
    service.set(CHAT, "0 9 * * *")
    notifier.failWith = new Error("socket hang up")

    await scheduler.trigger(CHAT)

    expect(reminders.get(CHAT)?.enabled).toBe(true)
    expect(scheduler.jobs.size).toBe(1)
  })
})
