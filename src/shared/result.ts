/**
 * A tagged result. Expected domain outcomes are values, not exceptions:
 * the bot layer switches on `error` exhaustively, so forgetting to map a new
 * failure to its user-facing string is a compile error.
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}
