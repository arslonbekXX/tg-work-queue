import { DAY_OF_WEEK, expandToken } from "./field.ts"

const DAYS_IN_WEEK = 7

/**
 * APScheduler numbers weekdays 0=Monday..6=Sunday; croner, like standard cron,
 * uses 0=Sunday..6=Saturday.
 *
 * Shifting the endpoints of a range would be wrong as soon as a step is
 * involved: a step of two over the whole week selects Mon,Wed,Fri,Sun under
 * APScheduler but Sun,Tue,Thu,Sat under cron. So every token is expanded to
 * the concrete days it selects, and each day is shifted individually.
 *
 * Three-letter names go through the same expansion, since "mon" is
 * APScheduler day 0 and must also come out as croner day 1.
 *
 * Returns null when the field is not a valid APScheduler day_of_week.
 */
export function translateDayOfWeek(field: string): string | null {
  const days = new Set<number>()

  for (const token of field.split(",")) {
    const expanded = expandToken(token, DAY_OF_WEEK)
    if (!expanded) return null
    for (const day of expanded) days.add((day + 1) % DAYS_IN_WEEK)
  }

  if (days.size === 0) return null
  if (days.size === DAYS_IN_WEEK) return "*"

  return [...days].sort((a, b) => a - b).join(",")
}
