import { beforeEach, describe, expect, test } from "bun:test"
import { TaskRepository } from "@db/task.repository.ts"
import { createTestDatabase } from "@db/test-support.ts"
import { TaskService } from "./task.service.ts"

const CHAT = -1001
const MR_URL = "http://gitlab.example.com/group/monorepo/-/merge_requests/120"

let service: TaskService

beforeEach(() => {
  service = new TaskService(new TaskRepository(createTestDatabase()))
})

function add(url = MR_URL, assignees: string[] = []) {
  return service.add({ chatId: CHAT, url, assignees, createdBy: "@dave" })
}

describe("add", () => {
  test("derives the task id from the link", () => {
    const result = add()
    expect(result.ok && result.value).toEqual({
      seqNum: 1,
      taskId: "monorepo/120",
      url: MR_URL,
      assignees: [],
    })
  })

  test("rejects a link that is neither a merge request nor a pull request", () => {
    const result = add("https://example.com/whatever")
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toEqual({ kind: "unsupported-link" })
  })

  test("reports a duplicate with the id, which the message quotes", () => {
    add()
    const result = add()
    expect(!result.ok && result.error).toEqual({ kind: "duplicate", taskId: "monorepo/120" })
  })

  test("treats the same merge request under a different URL as the same task", () => {
    add()
    const result = add(`${MR_URL}/diffs`)
    expect(!result.ok && result.error).toEqual({ kind: "duplicate", taskId: "monorepo/120" })
  })
})

describe("complete", () => {
  test("removes by sequence number", () => {
    add()
    const result = service.complete(CHAT, "1")
    expect(result.ok && result.value.taskId).toBe("monorepo/120")
    expect(service.list(CHAT)).toEqual([])
  })

  test("removes by task id written with a hash — the bug Python had", () => {
    add()
    expect(service.complete(CHAT, "#monorepo/120").ok).toBe(true)
  })

  test("echoes the reference back exactly as typed", () => {
    const result = service.complete(CHAT, "#9")
    expect(!result.ok && result.error).toEqual({ kind: "not-found", ref: "#9" })
  })
})

describe("assign", () => {
  test("replaces every assignee", () => {
    add(MR_URL, ["@alice", "@bob"])
    const result = service.assign(CHAT, "1", ["@eve"])
    expect(result.ok && result.value.assignees).toEqual(["@eve"])
    expect(service.list(CHAT)[0]?.assignees).toEqual(["@eve"])
  })

  test("reports an unknown reference", () => {
    expect(service.assign(CHAT, "repo/9", ["@eve"])).toEqual({
      ok: false,
      error: { kind: "not-found", ref: "repo/9" },
    })
  })
})

describe("list", () => {
  test("is ordered by sequence number", () => {
    add()
    add("https://github.com/owner/backend/pull/45")
    expect(service.list(CHAT).map((task) => task.taskId)).toEqual(["monorepo/120", "backend/45"])
  })
})
