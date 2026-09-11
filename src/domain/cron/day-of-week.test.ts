import { describe, expect, test } from "bun:test"
import { translateDayOfWeek } from "./day-of-week.ts"

describe("translateDayOfWeek", () => {
  test("keeps the every-day wildcard as a wildcard", () => {
    expect(translateDayOfWeek("*")).toBe("*")
  })

  test("shifts a single day: APScheduler 0 is Monday, croner 1 is Monday", () => {
    expect(translateDayOfWeek("0")).toBe("1")
    expect(translateDayOfWeek("3")).toBe("4")
    expect(translateDayOfWeek("6")).toBe("0")
  })

  test("shifts the documented weekday range 0-4 to Mon-Fri", () => {
    expect(translateDayOfWeek("0-4")).toBe("1,2,3,4,5")
  })

  test("shifts the documented weekend list 5,6 to Sat,Sun", () => {
    expect(translateDayOfWeek("5,6")).toBe("0,6")
  })

  test("expands a step rather than shifting its endpoints", () => {
    // APScheduler */2 is Mon,Wed,Fri,Sun — NOT croner's Sun,Tue,Thu,Sat.
    expect(translateDayOfWeek("*/2")).toBe("0,1,3,5")
  })

  test("expands a stepped range", () => {
    // 0-4/2 is Mon,Wed,Fri.
    expect(translateDayOfWeek("0-4/2")).toBe("1,3,5")
  })

  test("translates three-letter names through the same shift", () => {
    expect(translateDayOfWeek("mon")).toBe("1")
    expect(translateDayOfWeek("sun")).toBe("0")
    expect(translateDayOfWeek("mon-fri")).toBe("1,2,3,4,5")
    expect(translateDayOfWeek("MON-FRI")).toBe("1,2,3,4,5")
  })

  test("deduplicates and sorts a mixed list", () => {
    expect(translateDayOfWeek("6,0,6")).toBe("0,1")
  })

  test("collapses a list covering every day back to the wildcard", () => {
    expect(translateDayOfWeek("0,1,2,3,4,5,6")).toBe("*")
    expect(translateDayOfWeek("0-6")).toBe("*")
  })

  test("rejects what APScheduler would have rejected", () => {
    expect(translateDayOfWeek("7")).toBeNull()
    expect(translateDayOfWeek("-1")).toBeNull()
    expect(translateDayOfWeek("4-2")).toBeNull()
    expect(translateDayOfWeek("xyz")).toBeNull()
    expect(translateDayOfWeek("")).toBeNull()
    expect(translateDayOfWeek("*/0")).toBeNull()
    expect(translateDayOfWeek("0,,1")).toBeNull()
  })
})
