import type { Reply } from "./views/reply.ts"

/** What a handler needs from an update. Deliberately free of grammY types. */
export interface CommandContext {
  readonly chatId: number
  /** Already trimmed, as `handle_message` did before matching. */
  readonly text: string
  /** `@username`, else the first name, else "Unknown" — how Python derived it. */
  readonly author: string
}

export interface CommandSpec {
  readonly name: string
  /**
   * Decides ownership only. Arguments are parsed by the handler, so a claimed
   * message with bad arguments still produces the specific error Python sent
   * instead of falling through to silence.
   */
  readonly claim: RegExp
  /** Returns null to stay silent, as several Python branches did. */
  handle(context: CommandContext): Reply | null
}

/**
 * Python's `\b` is Unicode-aware on `str`, so `!waddx` and `!waddж` alike failed
 * to match. JavaScript's `\b` is ASCII-only and would have claimed the second.
 */
export const WORD_BOUNDARY = "(?![\\p{L}\\p{N}_])"
