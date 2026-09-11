import type { Logger } from "@shared/logger.ts"
import { Bot, type Context } from "grammy"
import type { CommandSpec } from "./command.ts"
import { createErrorBoundary } from "./middleware/error-boundary.ts"
import { heartbeatTransformer } from "./middleware/heartbeat.transformer.ts"
import { createRouter } from "./router.ts"

export interface BotDeps {
  readonly token: string
  readonly commands: readonly CommandSpec[]
  readonly heartbeatPath: string
  readonly logger: Logger
}

/** Wires grammY together. The framework is confined to this file and the adapter. */
export function createBot({ token, commands, heartbeatPath, logger }: BotDeps): Bot<Context> {
  const bot = new Bot(token)

  bot.api.config.use(heartbeatTransformer(heartbeatPath, logger))
  bot.use(createRouter(commands))
  bot.catch(createErrorBoundary(logger))

  return bot
}
