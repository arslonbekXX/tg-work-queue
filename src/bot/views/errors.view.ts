import type { WaddFailure } from "@domain/failures.ts"
import { escapeHtml } from "@shared/html.ts"
import { html, plain, type Reply } from "./reply.ts"

/**
 * Every user-facing failure string, transcribed from bot.py before it was
 * deleted. These are the parity surface: if a message here changes, the bot's
 * observable behaviour changes.
 */

/** `!wadd` with arguments that did not parse. Port of `validate_wadd_args`. */
export function waddFailure(failure: WaddFailure): Reply {
  switch (failure.kind) {
    case "missing-url":
      return html(
        "Missing URL.\nUsage: <code>!wadd &lt;URL&gt; [@username ...]</code>\nExamples:\n• <code>!wadd http://gitlab.example.com/group/repo/-/merge_requests/123</code>\n• <code>!wadd http://gitlab.example.com/group/repo/-/merge_requests/123 @alice</code>\n• <code>!wadd http://gitlab.example.com/group/repo/-/merge_requests/123 @alice @bob</code>",
      )
    case "username-before-url":
      return html("Missing URL. Provide a GitLab MR or GitHub PR link before the username(s).")
    case "url-scheme-with-example":
      return html(
        "Invalid URL. Must start with http:// or https://\nExample: <code>!wadd http://gitlab.example.com/group/repo/-/merge_requests/123</code>",
      )
    case "url-scheme":
      return html("Invalid URL. Must start with http:// or https://")
    case "unsupported-url":
      return html(
        "Unsupported URL format. Must be a GitLab merge request or GitHub pull request.\nSupported formats:\n• <code>http://host/group/project/-/merge_requests/N</code>\n• <code>https://github.com/owner/repo/pull/N</code>",
      )
    case "invalid-username":
      return html(
        `Invalid username format. Use <code>@username</code> for each assignee (got: ${escapeHtml(failure.got)})`,
      )
    case "invalid-format":
      return html("Invalid command format.\nUsage: <code>!wadd &lt;URL&gt; [@username ...]</code>")
  }
}

/**
 * `!wadd` parsed, but the link is not a GitLab merge request or GitHub pull
 * request. Python sent this one without a parse mode.
 */
export function unsupportedLink(): Reply {
  return plain(
    "Invalid URL. Please provide a GitLab merge request or GitHub pull request link.\nExamples:\n• http://gitlab.example.com/group/repo/-/merge_requests/123\n• https://github.com/owner/repo/pull/123",
  )
}

/** `!wdone` with no argument. */
export function wdoneUsage(): Reply {
  return html(
    "Usage: <code>!wdone &lt;N or task_id&gt;</code>\nExamples: <code>!wdone 1</code>, <code>!wdone #1</code>, or <code>!wdone repo/123</code>",
  )
}

/** `!wassign` with arguments that did not parse. */
export function wassignUsage(): Reply {
  return html(
    "Usage: <code>!wassign &lt;N or task_id&gt; @username [...]</code>\nExamples:\n• <code>!wassign 1 @alice</code>\n• <code>!wassign #1 @alice @bob</code>\n• <code>!wassign repo/123 @alice @bob @charlie</code>",
  )
}

/**
 * An unexpected failure inside a handler. New behaviour: Python logged the
 * exception and replied nothing at all.
 */
export function unexpectedError(): Reply {
  return plain("Something went wrong handling that command. Please try again.")
}
