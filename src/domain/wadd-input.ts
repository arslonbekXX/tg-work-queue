import { err, ok, type Result } from "@shared/result.ts"
import { containsMention, parseAssignees } from "./assignees.ts"
import type { WaddFailure } from "./failures.ts"
import { isSupportedUrl } from "./task-url.ts"

export interface WaddInput {
  readonly url: string
  readonly assignees: readonly string[]
}

const WITH_ASSIGNEES = /^!wadd\s+(https?:\/\/\S+)\s+((?:@[\p{L}\p{N}_]+\s*)+)$/iu
const WITHOUT_ASSIGNEES = /^!wadd\s+(https?:\/\/\S+)$/i

/**
 * Port of the three-way `!wadd` match in `handle_message`, with the error
 * branches of `validate_wadd_args` folded in as tags.
 */
export function parseWaddCommand(text: string): Result<WaddInput, WaddFailure> {
  const withAssignees = WITH_ASSIGNEES.exec(text)
  if (withAssignees?.[1] !== undefined) {
    return ok({ url: withAssignees[1], assignees: parseAssignees(withAssignees[2] ?? "") })
  }

  const withoutAssignees = WITHOUT_ASSIGNEES.exec(text)
  if (withoutAssignees?.[1] !== undefined) {
    return ok({ url: withoutAssignees[1], assignees: [] })
  }

  return err(classifyFailure(text))
}

function classifyFailure(text: string): WaddFailure {
  const parts = splitWhitespace(text, 3)

  if (parts.length <= 1) return { kind: "missing-url" }

  const urlPart = parts[1] ?? ""

  if (parts.length === 2) {
    if (urlPart.startsWith("@")) return { kind: "username-before-url" }
    if (!hasHttpScheme(urlPart)) return { kind: "url-scheme-with-example" }
    // Unreachable in practice: WITHOUT_ASSIGNEES would already have matched.
    return isSupportedUrl(urlPart) ? { kind: "invalid-format" } : { kind: "unsupported-url" }
  }

  const userPart = parts[2] ?? ""
  if (!hasHttpScheme(urlPart)) return { kind: "url-scheme" }
  if (!containsMention(userPart)) return { kind: "invalid-username", got: userPart }
  if (!isSupportedUrl(urlPart)) return { kind: "unsupported-url" }
  return { kind: "invalid-format" }
}

function hasHttpScheme(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://")
}

/** Equivalent of Python's `str.split(None, maxsplit)`. */
function splitWhitespace(text: string, maxParts: number): string[] {
  const parts: string[] = []
  let rest = text.trimStart()

  while (parts.length < maxParts - 1) {
    const boundary = /\s/.exec(rest)
    if (!boundary) break
    parts.push(rest.slice(0, boundary.index))
    rest = rest.slice(boundary.index).trimStart()
  }

  if (rest.length > 0) parts.push(rest)
  return parts
}
