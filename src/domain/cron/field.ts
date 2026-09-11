/** The five APScheduler fields the bot exposed, in order. */
export interface FieldSpec {
  readonly name: string
  readonly min: number
  readonly max: number
  /** Lowercase names, indexed from `min`. Empty when the field takes numbers only. */
  readonly names: readonly string[]
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
/** APScheduler orders weekdays Monday-first. */
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

export const MINUTE: FieldSpec = { name: "minute", min: 0, max: 59, names: [] }
export const HOUR: FieldSpec = { name: "hour", min: 0, max: 23, names: [] }
export const DAY: FieldSpec = { name: "day", min: 1, max: 31, names: [] }
export const MONTH: FieldSpec = { name: "month", min: 1, max: 12, names: MONTHS }
export const DAY_OF_WEEK: FieldSpec = { name: "day_of_week", min: 0, max: 6, names: WEEKDAYS }

export const FIELD_SPECS: readonly FieldSpec[] = [MINUTE, HOUR, DAY, MONTH, DAY_OF_WEEK]

/**
 * Expands one comma-separated token into the concrete values it selects, or
 * null if the token is not valid for this field. Accepted shapes are the
 * wildcard, a single value, a name, a range, and any of those with a step
 * suffix -- for example "1-5", "mon", "1-5 slash 2", "5 slash 10".
 */
export function expandToken(token: string, spec: FieldSpec): number[] | null {
  const split = splitStep(token)
  if (!split) return null
  const { base, step } = split

  let start: number
  let end: number

  if (base === "*") {
    start = spec.min
    end = spec.max
  } else {
    const dash = base.indexOf("-")
    if (dash === -1) {
      const value = parseValue(base, spec)
      if (value === null) return null
      if (step === null) return [value]
      // APScheduler reads `n/step` as "every step values from n to the maximum".
      start = value
      end = spec.max
    } else {
      const from = parseValue(base.slice(0, dash), spec)
      const to = parseValue(base.slice(dash + 1), spec)
      if (from === null || to === null) return null
      // APScheduler rejects inverted ranges rather than wrapping them.
      if (from > to) return null
      start = from
      end = to
    }
  }

  const values: number[] = []
  for (let value = start; value <= end; value += step ?? 1) values.push(value)
  return values.length > 0 ? values : null
}

/**
 * Returns the first comma-separated token that is not valid for `spec`, or null
 * when the whole field is valid. APScheduler reported errors per token, not per
 * field, so the caller can quote the same fragment back to the user.
 */
export function findInvalidToken(field: string, spec: FieldSpec): string | null {
  for (const token of field.split(",")) {
    if (expandToken(token, spec) === null) return token
  }
  return null
}

function splitStep(token: string): { base: string; step: number | null } | null {
  const slash = token.indexOf("/")
  if (slash === -1) return token.length > 0 ? { base: token, step: null } : null

  const base = token.slice(0, slash)
  const rawStep = token.slice(slash + 1)
  if (base.length === 0 || !/^\d+$/.test(rawStep)) return null

  const step = Number(rawStep)
  return step >= 1 ? { base, step } : null
}

function parseValue(raw: string, spec: FieldSpec): number | null {
  if (/^\d+$/.test(raw)) {
    const value = Number(raw)
    return value >= spec.min && value <= spec.max ? value : null
  }
  const index = spec.names.indexOf(raw.toLowerCase())
  return index === -1 ? null : index + spec.min
}
