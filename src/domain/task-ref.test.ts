import { describe, expect, test } from "bun:test"
import { parseTaskRef } from "./task-ref.ts"

describe("parseTaskRef", () => {
  test("reads a bare sequence number", () => {
    expect(parseTaskRef("1")).toEqual({ kind: "seq", seqNum: 1 })
    expect(parseTaskRef("42")).toEqual({ kind: "seq", seqNum: 42 })
  })

  test("strips the # prefix from a sequence number, as Python did", () => {
    expect(parseTaskRef("#1")).toEqual({ kind: "seq", seqNum: 1 })
    expect(parseTaskRef("##1")).toEqual({ kind: "seq", seqNum: 1 })
  })

  test("reads a task id", () => {
    expect(parseTaskRef("repo/123")).toEqual({ kind: "taskId", taskId: "repo/123" })
  })

  test("strips the # prefix from a task id too — the bug Python had", () => {
    expect(parseTaskRef("#repo/123")).toEqual({ kind: "taskId", taskId: "repo/123" })
  })

  test("treats anything non-numeric as a task id", () => {
    expect(parseTaskRef("")).toEqual({ kind: "taskId", taskId: "" })
    expect(parseTaskRef("12a")).toEqual({ kind: "taskId", taskId: "12a" })
  })
})
