import type { Logger } from "@shared/logger.ts"
import type { BotError, Context } from "grammy"
import { unexpectedError } from "../views/errors.view.ts"

/**
 * Python had no boundary: an exception inside a handler was logged by the
 * framework and the user was left staring at silence.
 */
export function createErrorBoundary(logger: Logger) {
  return async (error: BotError<Context>): Promise<void> => {
    const updateId = error.ctx.update.update_id
    logger.error(`Error while handling update ${updateId}`, error.error)

    try {
      const reply = unexpectedError()
      await error.ctx.reply(reply.text)
    } catch (replyError) {
      // The chat may be exactly what is broken; do not recurse.
      logger.error(`Could not report the failure of update ${updateId}`, replyError)
    }
  }
}
