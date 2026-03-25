#!/usr/bin/env node
/**
 * CI step: run `npx cap sync` only if dist/ is already built (no IDE open).
 * Use after `bun run build:web` / `npm run build:web` in a prior CI job for caching.
 */
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const index = join(root, 'dist', 'index.html')
if (!existsSync(index)) {
  console.error(
    '[cap:ci:sync] Missing dist/index.html. Build the PWA first (e.g. bun run build:web), or use bun run build:cap for build + sync.',
  )
  process.exit(1)
}
try {
  execSync('node scripts/sync-native-version.mjs', { stdio: 'inherit', cwd: root, env: process.env })
  execSync('npx cap sync', { stdio: 'inherit', cwd: root, env: process.env })
} catch {
  process.exit(1)
}
