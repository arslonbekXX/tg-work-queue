#!/usr/bin/env bun
import { statSync } from "node:fs"

/**
 * Docker HEALTHCHECK entry point. A long-polling bot exposes nothing to probe,
 * so the heartbeat transformer touches a file after every successful
 * getUpdates and this checks how stale it is. Long polling returns roughly
 * every 30 seconds, so a two-minute-old heartbeat means four missed cycles.
 */
const path = Bun.env.HEARTBEAT_PATH?.trim() || "/tmp/heartbeat"
const maxAgeSeconds = Number(Bun.env.HEARTBEAT_MAX_AGE_SECONDS ?? "120")

try {
  const ageMs = Date.now() - statSync(path).mtimeMs
  if (ageMs > maxAgeSeconds * 1000) {
    console.error(`heartbeat is ${Math.round(ageMs / 1000)}s old (limit ${maxAgeSeconds}s)`)
    process.exit(1)
  }
  process.exit(0)
} catch {
  console.error(`no heartbeat at ${path}`)
  process.exit(1)
}
