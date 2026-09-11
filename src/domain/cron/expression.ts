import { err, ok, type Result } from "@shared/result.ts"
import { translateDayOfWeek } from "./day-of-week.ts"
import { DAY_OF_WEEK, expandToken, FIELD_SPECS, type FieldSpec, findInvalidToken } from "./field.ts"

export interface CronExpression {
  /** Exactly what the user typed. This is what gets stored, so `!wreminder` echoes it back. */
  readonly source: string
  /** The same schedule spelled in croner's dialect, with weekdays translated. */
  readonly pattern: string
}

export type CronFailure =
  | { readonly kind: "wrong-field-count" }
  | { readonly kind: "invalid-field"; readonly expression: string; readonly field: string }

const FIELD_COUNT = 5

/**
 * Port of the validation `!wreminder-set` ran by constructing an APScheduler
 * CronTrigger, plus the translation into croner's dialect.
 */
export function parseCronExpression(source: string): Result<CronExpression, CronFailure> {
  const fields = source
    .trim()
    .split(/\s+/)
    .filter((field) => field.length > 0)
  if (fields.length !== FIELD_COUNT) return err({ kind: "wrong-field-count" })

  const pattern: string[] = []

  for (let index = 0; index < FIELD_COUNT; index += 1) {
    const spec = FIELD_SPECS[index]
    const field = fields[index]
    if (spec === undefined || field === undefined) return err({ kind: "wrong-field-count" })

    const invalid = findInvalidToken(field, spec)
    if (invalid !== null) {
      return err({ kind: "invalid-field", expression: invalid, field: spec.name })
    }

    if (spec === DAY_OF_WEEK) {
      const translated = translateDayOfWeek(field)
      if (translated === null)
        return err({ kind: "invalid-field", expression: field, field: spec.name })
      pattern.push(translated)
    } else {
      pattern.push(normalizeField(field, spec))
    }
  }

  return ok({ source, pattern: pattern.join(" ") })
}

/**
 * APScheduler reads `5/10` as "every 10 from 5 onwards"; cron traditionally
 * requires a range there. Making the selection explicit keeps the two agreeing.
 */
function normalizeField(field: string, spec: FieldSpec): string {
  return field
    .split(",")
    .map((token) => {
      const slash = token.indexOf("/")
      if (slash === -1) return token

      const base = token.slice(0, slash)
      if (base === "*" || base.includes("-")) return token

      const values = expandToken(token, spec)
      return values === null ? token : values.join(",")
    })
    .join(",")
}
