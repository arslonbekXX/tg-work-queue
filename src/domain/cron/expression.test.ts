import { describe, expect, test } from "bun:test"
import { parseCronExpression } from "./expression.ts"

function pattern(source: string): string {
  const result = parseCronExpression(source)
  if (!result.ok)
    throw new Error(`expected ${source} to parse, got ${JSON.stringify(result.error)}`)
  return result.value.pattern
}

function failure(source: string) {
  const result = parseCronExpression(source)
  if (result.ok) throw new Error(`expected ${source} to fail`)
  return result.error
}

describe("parseCronExpression", () => {
  test("keeps the source verbatim so !wreminder echoes what was typed", () => {
    const result = parseCronExpression("0  9 * * *")
    expect(result.ok && result.value.source).toBe("0  9 * * *")
  })

  test("translates the README examples", () => {
    expect(pattern("0 9 * * *")).toBe("0 9 * * *")
    expect(pattern("0 9,17 * * *")).toBe("0 9,17 * * *")
    expect(pattern("0 9 * * 0-4")).toBe("0 9 * * 1,2,3,4,5")
    expect(pattern("0 9 * * 5,6")).toBe("0 9 * * 0,6")
    expect(pattern("0 0 * * 6")).toBe("0 0 * * 0")
  })

  test("leaves the non-weekday fields alone", () => {
    expect(pattern("0 */4 * * *")).toBe("0 */4 * * *")
    expect(pattern("*/30 9-17 * * *")).toBe("*/30 9-17 * * *")
    expect(pattern("0 9 1-15 jan,jul *")).toBe("0 9 1-15 jan,jul *")
  })

  test("makes APScheduler's value/step shorthand explicit for croner", () => {
    expect(pattern("5/10 * * * *")).toBe("5,15,25,35,45,55 * * * *")
  })

  test("rejects anything that is not five fields, like the length check did", () => {
    expect(failure("0 9 * *")).toEqual({ kind: "wrong-field-count" })
    expect(failure("0 9 * * * *")).toEqual({ kind: "wrong-field-count" })
    expect(failure("")).toEqual({ kind: "wrong-field-count" })
  })

  test("names the offending token and field, as APScheduler did", () => {
    expect(failure("xyz 9 * * *")).toEqual({
      kind: "invalid-field",
      expression: "xyz",
      field: "minute",
    })
    expect(failure("0 99 * * *")).toEqual({
      kind: "invalid-field",
      expression: "99",
      field: "hour",
    })
    expect(failure("0 9 32 * *")).toEqual({ kind: "invalid-field", expression: "32", field: "day" })
    expect(failure("0 9 * 13 *")).toEqual({
      kind: "invalid-field",
      expression: "13",
      field: "month",
    })
    expect(failure("0 9 * * 7")).toEqual({
      kind: "invalid-field",
      expression: "7",
      field: "day_of_week",
    })
  })

  test("rejects an inverted range, as APScheduler did", () => {
    expect(failure("0 9 * * 4-2")).toEqual({
      kind: "invalid-field",
      expression: "4-2",
      field: "day_of_week",
    })
  })
})
