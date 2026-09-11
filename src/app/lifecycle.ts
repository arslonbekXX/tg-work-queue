import type { Database } from "bun:sqlite"
import type { ReminderScheduler } from "@scheduler/scheduler.port.ts"
import type { Logger } from "@shared/logger.ts"
import type { Bot, Context } from "grammy"

export interface LifecycleDeps {
  readonly bot: Bot<Context>
  readonly db: Database
  readonly scheduler: ReminderScheduler
  readonly logger: Logger
}

/** Long polling can take a moment to wind down; do not wait forever. */
const SHUTDOWN_TIMEOUT_MS = 10_000

/**
 * Python had none of this: the container was killed mid-poll and the database
 * connection was closed by the process exiting.
 */
export function installLifecycle({ bot, db, scheduler, logger }: LifecycleDeps): void {
  let stopping = false

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (stopping) return
    stopping = true
    logger.info(`Received ${signal}, shutting down`)

    try {
      await Promise.race([bot.stop(), timeout(SHUTDOWN_TIMEOUT_MS)])
    } catch (error) {
      logger.error("Error while stopping the bot", error)
    }

    scheduler.cancelAll()
    db.close()
    logger.info("Shutdown complete")
    process.exit(0)
  }

  process.on("SIGTERM", (signal) => void shutdown(signal))
  process.on("SIGINT", (signal) => void shutdown(signal))
}

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
