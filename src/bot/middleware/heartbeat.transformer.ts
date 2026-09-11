import { writeFileSync } from "node:fs"
import type { Logger } from "@shared/logger.ts"
import type { Transformer } from "grammy"

/**
 * Touches a file after every successful `getUpdates`, so the Docker
 * healthcheck can tell a bot that is merely idle from one that has stopped
 * talking to Telegram.
 *
 * It has to hang off the API call rather than off middleware: middleware only
 * runs when an update arrives, so a quiet night would look like a dead bot.
 * Long polling returns roughly every 30 seconds even with nothing to report.
 */
export function heartbeatTransformer(path: string, logger: Logger): Transformer {
  let warned = false

  return async (prev, method, payload, signal) => {
    const result = await prev(method, payload, signal)

    if (method === "getUpdates" && result.ok) {
      try {
        writeFileSync(path, `${Date.now()}\n`)
      } catch (error) {
        // A failing heartbeat must never take the bot down with it.
        if (!warned) {
          warned = true
          logger.error(`Cannot write the heartbeat file at ${path}`, error)
        }
      }
    }

    return result
  }
}
