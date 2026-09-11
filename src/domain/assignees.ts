/**
 * Python's `\w` is Unicode-aware on `str`, so `@алиша` was a valid mention even
 * though Telegram itself only issues ASCII usernames. JavaScript's `\w` is
 * ASCII-only, so the class is spelled out to keep the old behaviour.
 */
const MENTION = /@([\p{L}\p{N}_]+)/gu

/** Port of `parse_assignees`: pulls every @mention out and re-adds the `@`. */
export function parseAssignees(text: string): string[] {
  return [...text.matchAll(MENTION)].map((match) => `@${match[1]}`)
}

/** Port of the `re.search(r'@\w+', ...)` guard in `validate_wadd_args`. */
export function containsMention(text: string): boolean {
  return /@[\p{L}\p{N}_]+/u.test(text)
}
