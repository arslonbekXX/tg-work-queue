import { describe, expect, test } from "bun:test"
import { loadEnv, MissingEnvError } from "./env.ts"

describe("loadEnv", () => {
  test("requires a bot token, like Python's explicit ValueError", () => {
    expect(() => loadEnv({})).toThrow(MissingEnvError)
    expect(() => loadEnv({ TELEGRAM_BOT_TOKEN: "   " })).toThrow(MissingEnvError)
  })

  test("defaults DATA_DIR to the working directory", () => {
    expect(loadEnv({ TELEGRAM_BOT_TOKEN: "t" }).dataDir).toBe(".")
  })

  test("reads the Docker values", () => {
    const env = loadEnv({ TELEGRAM_BOT_TOKEN: "t", DATA_DIR: "/app/data" })
    expect(env.dataDir).toBe("/app/data")
    expect(env.heartbeatPath).toBe("/tmp/heartbeat")
  })

  test("falls back to INFO for an unknown log level", () => {
    expect(loadEnv({ TELEGRAM_BOT_TOKEN: "t", LOG_LEVEL: "chatty" }).logLevel).toBe("INFO")
    expect(loadEnv({ TELEGRAM_BOT_TOKEN: "t", LOG_LEVEL: "debug" }).logLevel).toBe("DEBUG")
  })
})
