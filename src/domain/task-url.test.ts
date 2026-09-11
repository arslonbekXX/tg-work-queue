import { describe, expect, test } from "bun:test"
import { extractTaskId, isSupportedUrl } from "./task-url.ts"

describe("extractTaskId", () => {
  test("reads a GitLab merge request, keeping only the project segment", () => {
    expect(extractTaskId("http://gitlab.example.com/group/monorepo/-/merge_requests/120")).toBe(
      "monorepo/120",
    )
  })

  test("handles deeply nested GitLab groups", () => {
    expect(extractTaskId("https://gitlab.example.com/a/b/c/backend/-/merge_requests/45")).toBe(
      "backend/45",
    )
  })

  test("handles a GitLab project directly under the host", () => {
    expect(extractTaskId("https://gitlab.example.com/group/repo/-/merge_requests/7")).toBe("repo/7")
  })

  test("reads a GitHub pull request", () => {
    expect(extractTaskId("https://github.com/owner/repo/pull/45")).toBe("repo/45")
  })

  test("matches only at the start of the string, like re.match", () => {
    expect(extractTaskId("see https://github.com/owner/repo/pull/45")).toBeNull()
  })

  test("ignores a trailing path, like re.match", () => {
    expect(extractTaskId("https://github.com/owner/repo/pull/45/files")).toBe("repo/45")
  })

  test("rejects unsupported hosts and shapes", () => {
    expect(extractTaskId("https://example.com/whatever")).toBeNull()
    expect(extractTaskId("https://github.com/owner/repo/issues/45")).toBeNull()
    expect(extractTaskId("https://gitlab.example.com/group/repo/-/merge_requests/abc")).toBeNull()
  })
})

describe("isSupportedUrl", () => {
  test("is the boolean form used by the !wadd validator", () => {
    expect(isSupportedUrl("https://github.com/owner/repo/pull/1")).toBe(true)
    expect(isSupportedUrl("https://example.com")).toBe(false)
  })
})
