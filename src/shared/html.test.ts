import { describe, expect, test } from "bun:test"
import { escapeHtml } from "./html.ts"

describe("escapeHtml", () => {
  test("escapes all five characters Python's html.escape(quote=True) does", () => {
    expect(escapeHtml("&")).toBe("&amp;")
    expect(escapeHtml("<")).toBe("&lt;")
    expect(escapeHtml(">")).toBe("&gt;")
    expect(escapeHtml('"')).toBe("&quot;")
    expect(escapeHtml("'")).toBe("&#x27;")
  })

  test("escapes the ampersand first so entities are not double-escaped", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;")
  })

  test("leaves ordinary text alone", () => {
    expect(escapeHtml("@alice")).toBe("@alice")
    expect(escapeHtml("monorepo/120")).toBe("monorepo/120")
    expect(escapeHtml("")).toBe("")
  })

  test("escapes a hostile username in full", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#x27;")
  })
})
