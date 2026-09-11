import type { LogLevel } from "@shared/logger.ts"

export interface Env {
  readonly botToken: string
  /** Python used `/app/data` in Docker and the working directory otherwise. */
  readonly dataDir: string
  readonly heartbeatPath: string
  readonly logLevel: LogLevel
}

export class MissingEnvError extends Error {
  constructor(name: string) {
    super(`${name} environment variable is required`)
    this.name = "MissingEnvError"
  }
}

const LOG_LEVELS: readonly LogLevel[] = ["DEBUG", "INFO", "WARNING", "ERROR"]

/**
 * Bun reads `.env` itself, so there is no dotenv equivalent to call first.
 * The source is injectable so the test suite never touches the real process.
 */
export function loadEnv(source: Record<string, string | undefined> = Bun.env): Env {
  const botToken = source.TELEGRAM_BOT_TOKEN?.trim()
  if (!botToken) throw new MissingEnvError("TELEGRAM_BOT_TOKEN")

  const rawLevel = source.LOG_LEVEL?.trim().toUpperCase()
  const logLevel = LOG_LEVELS.find((level) => level === rawLevel) ?? "INFO"

  return {
    botToken,
    dataDir: source.DATA_DIR?.trim() || ".",
    heartbeatPath: source.HEARTBEAT_PATH?.trim() || "/tmp/heartbeat",
    logLevel,
  }
}
