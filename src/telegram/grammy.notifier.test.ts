import { describe, expect, test } from "bun:test"
import { describesGoneChat } from "./grammy.notifier.ts"

describe("describesGoneChat", () => {
  test("treats every 403 as permanent", () => {
    expect(
      describesGoneChat({
        error_code: 403,
        description: "Forbidden: bot was kicked from the group chat",
      }),
    ).toBe(true)
    expect(
      describesGoneChat({ error_code: 403, description: "Forbidden: bot was blocked by the user" }),
    ).toBe(true)
  })

  test("treats a missing chat as permanent", () => {
    expect(describesGoneChat({ error_code: 400, description: "Bad Request: chat not found" })).toBe(
      true,
    )
  })

  test("leaves other 400s alone — those are our own mistakes", () => {
    expect(
      describesGoneChat({ error_code: 400, description: "Bad Request: can't parse entities" }),
    ).toBe(false)
    expect(
      describesGoneChat({ error_code: 400, description: "Bad Request: message is too long" }),
    ).toBe(false)
  })

  test("leaves rate limits and server errors alone", () => {
    expect(describesGoneChat({ error_code: 429, description: "Too Many Requests" })).toBe(false)
    expect(describesGoneChat({ error_code: 500, description: "Internal Server Error" })).toBe(false)
  })
})
