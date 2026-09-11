import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createLogger } from "@shared/logger.ts"
import { heartbeatTransformer } from "./heartbeat.transformer.ts"

const silent = createLogger("test", { sink: () => {} })
const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function heartbeatPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "heartbeat-"))
  dirs.push(dir)
  return join(dir, "heartbeat")
}

/**
 * grammY types a Transformer against every Bot API method at once, which is
 * more than this test needs. Calling it through a loosened signature keeps the
 * stubs readable without weakening the transformer's own types.
 */
type LooseTransform = (
  prev: () => Promise<unknown>,
  method: string,
  payload: unknown,
  signal?: AbortSignal,
) => Promise<unknown>

function transformer(path: string): LooseTransform {
  return heartbeatTransformer(path, silent) as unknown as LooseTransform
}

/** Stands in for the next transformer in the chain. */
function apiReturning(response: unknown) {
  return async () => response
}

describe("heartbeatTransformer", () => {
  test("touches the file after a successful getUpdates", async () => {
    const path = heartbeatPath()
    const transform = transformer(path)

    await transform(apiReturning({ ok: true }), "getUpdates", {}, undefined)

    expect(existsSync(path)).toBe(true)
    expect(Date.now() - statSync(path).mtimeMs).toBeLessThan(5_000)
  })

  test("touches it even when the poll returned no updates", async () => {
    const path = heartbeatPath()
    const transform = transformer(path)

    // An empty result is still contact with Telegram — this is the whole point,
    // since a quiet chat must not look like a dead bot.
    await transform(apiReturning({ ok: true, result: [] }), "getUpdates", {}, undefined)

    expect(existsSync(path)).toBe(true)
  })

  test("does not touch it when getUpdates failed", async () => {
    const path = heartbeatPath()
    const transform = transformer(path)

    await transform(apiReturning({ ok: false }), "getUpdates", {}, undefined)

    expect(existsSync(path)).toBe(false)
  })

  test("ignores other API calls, so sending a message is not a heartbeat", async () => {
    const path = heartbeatPath()
    const transform = transformer(path)

    await transform(apiReturning({ ok: true }), "sendMessage", {}, undefined)

    expect(existsSync(path)).toBe(false)
  })

  test("passes the response through untouched", async () => {
    const transform = transformer(heartbeatPath())
    const response = { ok: true, result: [{ update_id: 1 }] }

    expect(await transform(apiReturning(response), "getUpdates", {}, undefined)).toBe(response)
  })

  test("survives an unwritable path rather than taking the bot down", async () => {
    const transform = transformer("/nonexistent-directory/heartbeat")

    expect(await transform(apiReturning({ ok: true }), "getUpdates", {}, undefined)).toEqual({
      ok: true,
    })
  })
})
