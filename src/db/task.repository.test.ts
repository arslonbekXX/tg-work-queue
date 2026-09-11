import type { Database } from "bun:sqlite"
import { beforeEach, describe, expect, test } from "bun:test"
import type { NewTask } from "@domain/task.ts"
import { parseTaskRef } from "@domain/task-ref.ts"
import { TaskRepository } from "./task.repository.ts"
import { createTestDatabase } from "./test-support.ts"

const CHAT = -1001
const OTHER_CHAT = -1002

let db: Database
let tasks: TaskRepository

beforeEach(() => {
  db = createTestDatabase()
  tasks = new TaskRepository(db)
})

function newTask(overrides: Partial<NewTask> = {}): NewTask {
  return {
    chatId: CHAT,
    taskId: "monorepo/120",
    url: "http://gitlab.example.com/group/monorepo/-/merge_requests/120",
    assignees: [],
    createdBy: "@dave",
    ...overrides,
  }
}

describe("add", () => {
  test("numbers tasks from one, per chat", () => {
    expect(tasks.add(newTask())).toBe(1)
    expect(tasks.add(newTask({ taskId: "backend/45" }))).toBe(2)
    expect(tasks.add(newTask({ chatId: OTHER_CHAT }))).toBe(1)
  })

  test("refuses a task id already queued in that chat", () => {
    expect(tasks.add(newTask())).toBe(1)
    expect(tasks.add(newTask())).toBeNull()
  })

  test("lets the same task id exist in a different chat", () => {
    expect(tasks.add(newTask())).toBe(1)
    expect(tasks.add(newTask({ chatId: OTHER_CHAT }))).toBe(1)
  })

  test("rolls the sequence number back when the insert is refused", () => {
    tasks.add(newTask())
    tasks.add(newTask())

    // Python committed the counter bump separately, so the duplicate left a
    // permanent gap and the next task would have been #3.
    expect(tasks.add(newTask({ taskId: "backend/45" }))).toBe(2)
  })

  test("stores assignees and keeps the legacy assigned_to column populated", () => {
    tasks.add(newTask({ assignees: ["@alice", "@bob"] }))

    const row = db.query<{ assigned_to: string }, []>("SELECT assigned_to FROM tasks").get()
    expect(row?.assigned_to).toBe("@alice")

    expect(tasks.listByChat(CHAT)[0]?.assignees).toEqual(["@alice", "@bob"])
  })

  test("writes the unassigned marker when nobody is named", () => {
    tasks.add(newTask())
    expect(
      db.query<{ assigned_to: string }, []>("SELECT assigned_to FROM tasks").get()?.assigned_to,
    ).toBe("unassigned")
  })
})

describe("listByChat", () => {
  test("returns tasks in sequence order, with assignees sorted", () => {
    tasks.add(newTask({ assignees: ["@bob", "@alice"] }))
    tasks.add(newTask({ taskId: "backend/45", assignees: [] }))

    const listed = tasks.listByChat(CHAT)
    expect(listed.map((task) => task.seqNum)).toEqual([1, 2])
    expect(listed[0]?.assignees).toEqual(["@alice", "@bob"])
    expect(listed[1]?.assignees).toEqual([])
  })

  test("does not leak tasks from another chat", () => {
    tasks.add(newTask())
    tasks.add(newTask({ chatId: OTHER_CHAT, taskId: "other/1" }))

    expect(tasks.listByChat(CHAT).map((task) => task.taskId)).toEqual(["monorepo/120"])
  })

  test("is empty for an unknown chat", () => {
    expect(tasks.listByChat(-999)).toEqual([])
  })
})

describe("find", () => {
  beforeEach(() => {
    tasks.add(newTask({ assignees: ["@alice"] }))
  })

  test("resolves a sequence number", () => {
    expect(tasks.find(CHAT, parseTaskRef("1"))?.taskId).toBe("monorepo/120")
  })

  test("resolves a task id", () => {
    expect(tasks.find(CHAT, parseTaskRef("monorepo/120"))?.seqNum).toBe(1)
  })

  test("resolves a task id written with a # prefix — the bug Python had", () => {
    expect(tasks.find(CHAT, parseTaskRef("#monorepo/120"))?.seqNum).toBe(1)
  })

  test("returns null for an unknown reference", () => {
    expect(tasks.find(CHAT, parseTaskRef("9"))).toBeNull()
    expect(tasks.find(CHAT, parseTaskRef("nope/1"))).toBeNull()
  })
})

describe("remove", () => {
  test("returns the removed task so the reply can describe it", () => {
    tasks.add(newTask({ assignees: ["@alice"] }))

    const removed = tasks.remove(CHAT, parseTaskRef("1"))
    expect(removed?.taskId).toBe("monorepo/120")
    expect(removed?.assignees).toEqual(["@alice"])
    expect(tasks.listByChat(CHAT)).toEqual([])
  })

  test("cascades to the assignee rows now that foreign keys are on", () => {
    tasks.add(newTask({ assignees: ["@alice", "@bob"] }))
    tasks.remove(CHAT, parseTaskRef("1"))

    const left = db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM task_assignees")
      .get()
    expect(left?.count).toBe(0)
  })

  test("returns null for an unknown reference", () => {
    expect(tasks.remove(CHAT, parseTaskRef("1"))).toBeNull()
  })

  test("does not reuse the freed sequence number", () => {
    tasks.add(newTask())
    tasks.remove(CHAT, parseTaskRef("1"))
    expect(tasks.add(newTask())).toBe(2)
  })
})

describe("updateAssignees", () => {
  beforeEach(() => {
    tasks.add(newTask({ assignees: ["@alice"] }))
  })

  test("replaces every existing assignee", () => {
    const updated = tasks.updateAssignees(CHAT, parseTaskRef("1"), ["@eve", "@frank"])
    expect(updated?.assignees).toEqual(["@eve", "@frank"])
    expect(tasks.listByChat(CHAT)[0]?.assignees).toEqual(["@eve", "@frank"])
  })

  test("reports assignees in the order given, as the reply did", () => {
    const updated = tasks.updateAssignees(CHAT, parseTaskRef("1"), ["@zoe", "@adam"])
    expect(updated?.assignees).toEqual(["@zoe", "@adam"])
    // The stored order is alphabetical; only the reply echoes the input order.
    expect(tasks.listByChat(CHAT)[0]?.assignees).toEqual(["@adam", "@zoe"])
  })

  test("keeps the legacy column in step", () => {
    tasks.updateAssignees(CHAT, parseTaskRef("1"), ["@eve", "@frank"])
    expect(
      db.query<{ assigned_to: string }, []>("SELECT assigned_to FROM tasks").get()?.assigned_to,
    ).toBe("@eve")
  })

  test("works through a task id as well as a sequence number", () => {
    expect(tasks.updateAssignees(CHAT, parseTaskRef("monorepo/120"), ["@eve"])?.assignees).toEqual([
      "@eve",
    ])
  })

  test("returns null for an unknown reference", () => {
    expect(tasks.updateAssignees(CHAT, parseTaskRef("9"), ["@eve"])).toBeNull()
  })

  test("ignores a repeated assignee", () => {
    const updated = tasks.updateAssignees(CHAT, parseTaskRef("1"), ["@eve", "@eve"])
    expect(updated?.assignees).toEqual(["@eve", "@eve"])
    expect(tasks.listByChat(CHAT)[0]?.assignees).toEqual(["@eve"])
  })
})
