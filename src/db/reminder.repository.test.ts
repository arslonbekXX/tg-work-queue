import { beforeEach, describe, expect, test } from "bun:test"
import { ReminderRepository } from "./reminder.repository.ts"
import { createTestDatabase } from "./test-support.ts"

const CHAT = -1001
const OTHER_CHAT = -1002

let reminders: ReminderRepository

beforeEach(() => {
  reminders = new ReminderRepository(createTestDatabase())
})

describe("get", () => {
  test("is null until something is configured", () => {
    expect(reminders.get(CHAT)).toBeNull()
  })

  test("returns the stored schedule with SQLite's raw timestamps", () => {
    reminders.upsert(CHAT, "0 9 * * *")

    const reminder = reminders.get(CHAT)
    expect(reminder?.chatId).toBe(CHAT)
    expect(reminder?.cronExpression).toBe("0 9 * * *")
    expect(reminder?.enabled).toBe(true)
    expect(reminder?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })
})

describe("upsert", () => {
  test("replaces the schedule on a second call", () => {
    reminders.upsert(CHAT, "0 9 * * *")
    reminders.upsert(CHAT, "0 17 * * 0-4")

    expect(reminders.get(CHAT)?.cronExpression).toBe("0 17 * * 0-4")
  })

  test("re-enables a disabled reminder, as set_reminder always did", () => {
    reminders.upsert(CHAT, "0 9 * * *")
    reminders.setEnabled(CHAT, false)

    expect(reminders.upsert(CHAT, "0 9 * * *").enabled).toBe(true)
  })

  test("keeps each chat independent", () => {
    reminders.upsert(CHAT, "0 9 * * *")
    reminders.upsert(OTHER_CHAT, "0 17 * * *")

    expect(reminders.get(CHAT)?.cronExpression).toBe("0 9 * * *")
    expect(reminders.get(OTHER_CHAT)?.cronExpression).toBe("0 17 * * *")
  })
})

describe("listEnabled", () => {
  test("is what the scheduler reloads on boot", () => {
    reminders.upsert(CHAT, "0 9 * * *")
    reminders.upsert(OTHER_CHAT, "0 17 * * *")
    reminders.setEnabled(OTHER_CHAT, false)

    expect(reminders.listEnabled().map((reminder) => reminder.chatId)).toEqual([CHAT])
  })

  test("is empty when nothing is configured", () => {
    expect(reminders.listEnabled()).toEqual([])
  })
})

describe("setEnabled", () => {
  test("disables without discarding the configuration", () => {
    reminders.upsert(CHAT, "0 9 * * *")

    expect(reminders.setEnabled(CHAT, false)).toBe(true)
    expect(reminders.get(CHAT)?.enabled).toBe(false)
    expect(reminders.get(CHAT)?.cronExpression).toBe("0 9 * * *")
  })

  test("reports that there was nothing to disable", () => {
    expect(reminders.setEnabled(CHAT, false)).toBe(false)
  })
})

describe("remove", () => {
  test("deletes the configuration", () => {
    reminders.upsert(CHAT, "0 9 * * *")

    expect(reminders.remove(CHAT)).toBe(true)
    expect(reminders.get(CHAT)).toBeNull()
  })

  test("reports that there was nothing to delete", () => {
    expect(reminders.remove(CHAT)).toBe(false)
  })
})
