export type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR"

const SEVERITY: Record<LogLevel, number> = { DEBUG: 10, INFO: 20, WARNING: 30, ERROR: 40 }

export interface Logger {
  debug(message: string): void
  info(message: string): void
  warning(message: string): void
  error(message: string, cause?: unknown): void
  child(name: string): Logger
}

export interface LoggerOptions {
  /** Messages below this level are dropped. Python configured `level=INFO`. */
  minLevel?: LogLevel
  /** Injected for tests; defaults to stdout/stderr. */
  sink?: (level: LogLevel, line: string) => void
  /** Injected for tests. */
  now?: () => Date
}

/**
 * Reproduces Python's `logging.basicConfig` output so `docker compose logs`
 * stays familiar: `2026-09-11 10:00:00,123 - bot - INFO - message`.
 */
export function createLogger(name: string, options: LoggerOptions = {}): Logger {
  const minLevel = options.minLevel ?? "INFO"
  const now = options.now ?? (() => new Date())
  const sink = options.sink ?? defaultSink
  const threshold = SEVERITY[minLevel]

  function emit(level: LogLevel, message: string, cause?: unknown): void {
    if (SEVERITY[level] < threshold) return
    let line = `${formatTimestamp(now())} - ${name} - ${level} - ${message}`
    if (cause !== undefined) line += `\n${formatCause(cause)}`
    sink(level, line)
  }

  return {
    debug: (message) => emit("DEBUG", message),
    info: (message) => emit("INFO", message),
    warning: (message) => emit("WARNING", message),
    error: (message, cause) => emit("ERROR", message, cause),
    child: (childName) => createLogger(childName, options),
  }
}

function defaultSink(level: LogLevel, line: string): void {
  if (level === "ERROR") console.error(line)
  else console.log(line)
}

/** Python's `default_msec_format` is `%s,%03d` — a comma, not a dot. */
function formatTimestamp(date: Date): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, "0")
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  return `${day} ${time},${pad(date.getMilliseconds(), 3)}`
}

/** Mirrors Python's `exc_info=True`: the traceback follows the message. */
function formatCause(cause: unknown): string {
  if (cause instanceof Error) return cause.stack ?? `${cause.name}: ${cause.message}`
  return String(cause)
}
