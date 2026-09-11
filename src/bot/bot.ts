import type { Logger } from "@shared/logger.ts"
import { Bot, type Context } from "grammy"
import type { CommandSpec } from "./command.ts"
import { createErrorBoundary } from "./middleware/error-boundary.ts"
import { heartbeatTransformer } from "./middleware/heartbeat.transformer.ts"
import { createRouter } from "./router.ts"

/**
 * Creates the bot with its API-level concerns only.
 *
 * Commands are attached separately because the notifier is built from
 * `bot.api`, so the bot has to exist before the container that produces the
 * commands does.
 */
export function createBot(token: string, heartbeatPath: string, logger: Logger): Bot<Context> {
  const bot = new Bot(token)
  bot.api.config.use(heartbeatTransformer(heartbeatPath, logger))
  return bot
}

/** Installs routing and the error boundary. Call once, after the container is built. */
export function installCommands(
  bot: Bot<Context>,
  commands: readonly CommandSpec[],
  logger: Logger,
): void {
  bot.use(createRouter(commands))
  bot.catch(createErrorBoundary(logger))
}
