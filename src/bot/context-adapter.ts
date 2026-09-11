import type { Context } from "grammy"
import type { CommandContext } from "./command.ts"

/**
 * The only place outside bot.ts that touches grammY's Context.
 *
 * Python's handler was registered for every message-ish update, but its first
 * line read `update.message`, which is None for channel posts and edits — so
 * despite what the README claims, only plain messages were ever acted on.
 * `message:text` matches that exactly.
 */
export function toCommandContext(ctx: Context): CommandContext | null {
  const text = ctx.message?.text
  if (text === undefined || ctx.chat === undefined) return null

  const user = ctx.from
  const author = user?.username ? `@${user.username}` : (user?.first_name ?? "Unknown")

  return { chatId: ctx.chat.id, text: text.trim(), author }
}
