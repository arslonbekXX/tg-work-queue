import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"

/**
 * The dependency rule, enforced.
 *
 * Biome's noRestrictedImports covers the package bans, which cannot be dodged
 * because a package has no relative spelling. It cannot express "this layer may
 * not import that one", and a relative path would slip past it anyway — so that
 * half is checked here, by reading the imports.
 *
 * Test files are exempt: a test legitimately reaches for a fake or a fixture
 * from another layer.
 */

const SRC = resolve(import.meta.dir)

/** Which layers each layer may import from. Its own is always allowed. */
const ALLOWED: Record<string, readonly string[]> = {
  shared: [],
  config: ["shared"],
  domain: ["shared"],
  db: ["domain", "shared"],
  telegram: ["domain", "shared"],
  scheduler: ["domain", "shared"],
  services: ["domain", "shared", "db", "telegram", "scheduler"],
  bot: ["domain", "shared", "services"],
  app: ["domain", "shared", "config", "db", "telegram", "scheduler", "services", "bot"],
  root: ["domain", "shared", "config", "db", "telegram", "scheduler", "services", "bot", "app"],
}

/** Packages each layer must not name. Mirrors the Biome overrides. */
const FORBIDDEN_PACKAGES: Record<string, readonly string[]> = {
  shared: ["grammy", "croner", "bun:sqlite"],
  config: ["grammy", "croner", "bun:sqlite"],
  domain: ["grammy", "croner", "bun:sqlite"],
  db: ["grammy", "croner"],
  telegram: ["croner", "bun:sqlite"],
  scheduler: ["grammy", "bun:sqlite"],
  services: ["grammy", "croner", "bun:sqlite"],
  bot: ["croner", "bun:sqlite"],
  app: [],
  root: [],
}

const IMPORT = /(?:^|\n)\s*(?:import|export)[^'"\n]*?from\s*["']([^"']+)["']/g

interface Edge {
  readonly from: string
  readonly fromLayer: string
  readonly specifier: string
}

function layerOf(absolutePath: string): string {
  const relativePath = relative(SRC, absolutePath)
  const slash = relativePath.indexOf("/")
  return slash === -1 ? "root" : relativePath.slice(0, slash)
}

function sourceFiles(): string[] {
  return [...new Bun.Glob("**/*.ts").scanSync({ cwd: SRC, absolute: true })]
    .filter((file) => !file.endsWith(".test.ts"))
    .sort()
}

function edges(): Edge[] {
  const found: Edge[] = []

  for (const file of sourceFiles()) {
    const source = readFileSync(file, "utf8")
    for (const match of source.matchAll(IMPORT)) {
      const specifier = match[1]
      if (specifier === undefined) continue
      found.push({ from: relative(SRC, file), fromLayer: layerOf(file), specifier })
    }
  }

  return found
}

/** The layer an import points at, or null when it points outside src/. */
function targetLayer(edge: Edge): string | null {
  if (edge.specifier.startsWith("@")) {
    return edge.specifier.slice(1, edge.specifier.indexOf("/"))
  }
  if (edge.specifier.startsWith(".")) {
    return layerOf(resolve(SRC, dirname(edge.from), edge.specifier))
  }
  return null
}

describe("the dependency rule", () => {
  test("finds the source files it is meant to be checking", () => {
    const files = sourceFiles()
    expect(files.length).toBeGreaterThan(25)
    expect(edges().length).toBeGreaterThan(40)
  })

  test("every layer is covered by the matrix", () => {
    const layers = new Set(sourceFiles().map(layerOf))
    for (const layer of layers) {
      expect(ALLOWED).toHaveProperty(layer)
      expect(FORBIDDEN_PACKAGES).toHaveProperty(layer)
    }
  })

  test("no layer imports a layer it may not", () => {
    const violations = edges()
      .filter((edge) => {
        const target = targetLayer(edge)
        if (target === null || target === edge.fromLayer) return false
        return !(ALLOWED[edge.fromLayer] ?? []).includes(target)
      })
      .map((edge) => `${edge.from} -> ${edge.specifier}`)

    expect(violations).toEqual([])
  })

  test("no layer names a package it must not", () => {
    const violations = edges()
      .filter((edge) => (FORBIDDEN_PACKAGES[edge.fromLayer] ?? []).includes(edge.specifier))
      .map((edge) => `${edge.from} -> ${edge.specifier}`)

    expect(violations).toEqual([])
  })

  test("relative imports cannot be used to escape a layer", () => {
    const escapes = edges()
      .filter((edge) => edge.specifier.startsWith("."))
      .filter((edge) => targetLayer(edge) !== edge.fromLayer && edge.fromLayer !== "root")
      .map((edge) => `${edge.from} -> ${edge.specifier}`)

    // Within a layer, relative imports are the norm; across layers, the alias
    // makes the crossing visible in review.
    expect(escapes).toEqual([])
  })
})
