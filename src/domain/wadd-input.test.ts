import { describe, expect, test } from "bun:test"
import { parseWaddCommand } from "./wadd-input.ts"

const GITLAB = "http://gitlab.example.com/group/monorepo/-/merge_requests/120"

function parsed(text: string) {
  const result = parseWaddCommand(text)
  if (!result.ok) throw new Error(`expected ${text} to parse, got ${JSON.stringify(result.error)}`)
  return result.value
}

function failure(text: string) {
  const result = parseWaddCommand(text)
  if (result.ok) throw new Error(`expected ${text} to fail`)
  return result.error
}

describe("parseWaddCommand", () => {
  test("accepts a bare URL", () => {
    expect(parsed(`!wadd ${GITLAB}`)).toEqual({ url: GITLAB, assignees: [] })
  })

  test("accepts a URL with one assignee", () => {
    expect(parsed(`!wadd ${GITLAB} @alice`)).toEqual({ url: GITLAB, assignees: ["@alice"] })
  })

  test("accepts a URL with several assignees", () => {
    expect(parsed(`!wadd ${GITLAB} @alice @bob @charlie`)).toEqual({
      url: GITLAB,
      assignees: ["@alice", "@bob", "@charlie"],
    })
  })

  test("is case-insensitive on the command itself", () => {
    expect(parsed(`!WAdd ${GITLAB}`).url).toBe(GITLAB)
  })

  test("accepts an unsupported host here — the service rejects it later", () => {
    expect(parsed("!wadd https://example.com/x").url).toBe("https://example.com/x")
  })

  test("reports a missing URL", () => {
    expect(failure("!wadd")).toEqual({ kind: "missing-url" })
  })

  test("reports a username given before the URL", () => {
    expect(failure("!wadd @alice")).toEqual({ kind: "username-before-url" })
  })

  test("reports a bad scheme, with the longer message for the two-part form", () => {
    expect(failure("!wadd garbage")).toEqual({ kind: "url-scheme-with-example" })
  })

  test("reports a bad scheme with the shorter message once a username follows", () => {
    expect(failure("!wadd garbage @alice")).toEqual({ kind: "url-scheme" })
  })

  test("quotes back whatever was given instead of a username", () => {
    expect(failure(`!wadd ${GITLAB} bob`)).toEqual({ kind: "invalid-username", got: "bob" })
  })

  test("keeps the whole trailing fragment when quoting it back", () => {
    expect(failure(`!wadd ${GITLAB} bob and friends`)).toEqual({
      kind: "invalid-username",
      got: "bob and friends",
    })
  })

  test("reports an unsupported host when a valid-looking mention follows", () => {
    expect(failure("!wadd https://example.com/x @alice extra")).toEqual({ kind: "unsupported-url" })
  })

  test("falls back to the generic format error", () => {
    expect(failure(`!wadd ${GITLAB} @alice extra`)).toEqual({ kind: "invalid-format" })
  })
})
