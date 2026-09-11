import { describe, expect, test } from "bun:test"
import { containsMention, parseAssignees } from "./assignees.ts"

describe("parseAssignees", () => {
  test("reads a single mention", () => {
    expect(parseAssignees("@alice")).toEqual(["@alice"])
  })

  test("reads several mentions separated by whitespace", () => {
    expect(parseAssignees("@alice @bob  @charlie")).toEqual(["@alice", "@bob", "@charlie"])
  })

  test("keeps underscores and digits, which Telegram usernames allow", () => {
    expect(parseAssignees("@ali_boy99")).toEqual(["@ali_boy99"])
  })

  test("keeps non-ASCII mentions, matching Python's Unicode-aware \\w", () => {
    expect(parseAssignees("@алиша")).toEqual(["@алиша"])
  })

  test("returns nothing when there is no mention", () => {
    expect(parseAssignees("alice")).toEqual([])
    expect(parseAssignees("")).toEqual([])
    expect(parseAssignees("@")).toEqual([])
  })

  test("stops at the first character that cannot be part of a username", () => {
    expect(parseAssignees("@alice,@bob")).toEqual(["@alice", "@bob"])
  })
})

describe("containsMention", () => {
  test("mirrors re.search(r'@\\w+', ...)", () => {
    expect(containsMention("@alice extra")).toBe(true)
    expect(containsMention("not a mention")).toBe(false)
    expect(containsMention("@")).toBe(false)
  })
})
