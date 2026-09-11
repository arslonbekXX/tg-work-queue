/**
 * Every way a command can fail, as a tag rather than a message. The exact
 * user-facing strings live in `bot/views/errors.view.ts`; keeping them apart
 * means a `switch` over these tags is exhaustive under `strict`, so adding a
 * failure without giving it a legacy string fails the build.
 */

/** The branches of Python's `validate_wadd_args`. */
export type WaddFailure =
  | { readonly kind: "missing-url" }
  | { readonly kind: "username-before-url" }
  | { readonly kind: "url-scheme-with-example" }
  | { readonly kind: "url-scheme" }
  | { readonly kind: "unsupported-url" }
  | { readonly kind: "invalid-username"; readonly got: string }
  | { readonly kind: "invalid-format" }

/** Failures raised once a well-formed `!wadd` reaches the service. */
export type AddTaskFailure =
  | { readonly kind: "unsupported-link" }
  | { readonly kind: "duplicate"; readonly taskId: string }

/** `!wdone` and `!wassign` both fail the same single way. */
export type TaskLookupFailure = { readonly kind: "not-found"; readonly ref: string }

/** `!wreminder-off` and `!wreminder-remove` when nothing is configured. */
export type NoReminderFailure = { readonly kind: "no-reminder" }
