import { Composer, type Context } from "grammy"
import type { CommandSpec } from "./command.ts"
import { toCommandContext } from "./context-adapter.ts"
import type { Reply } from "./views/reply.ts"

/**
 * One handler, a first-match-wins scan — the shape of Python's if/elif chain.
 * Text nothing claims is ignored in silence, as before.
 */
export function createRouter(commands: readonly CommandSpec[]): Composer<Context> {
  const composer = new Composer<Context>()

  composer.on("message:text", async (ctx) => {
    const context = toCommandContext(ctx)
    if (context === null) return

    const spec = commands.find((command) => command.claim.test(context.text))
    if (spec === undefined) return

    const reply = spec.handle(context)
    if (reply === null) return

    await ctx.reply(reply.text, toSendOptions(reply))
  })

  return composer
}

/** Which command, if any, owns this text. Exported for the routing table test. */
export function claimFor(commands: readonly CommandSpec[], text: string): string | null {
  return commands.find((command) => command.claim.test(text))?.name ?? null
}

function toSendOptions(reply: Reply) {
  return {
    ...(reply.parseMode === null ? {} : { parse_mode: reply.parseMode }),
    ...(reply.disableLinkPreview ? { link_preview_options: { is_disabled: true } } : {}),
  }
}
