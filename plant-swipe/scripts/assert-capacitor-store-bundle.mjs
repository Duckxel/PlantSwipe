#!/usr/bin/env node
/**
 * Store / production guard: Capacitor must load the reviewed web bundle from the app binary
 * (webDir copied at sync/build), not a remote origin via server.url.
 *
 * Set CAPACITOR_ALLOW_REMOTE_WEB=1 only for local experiments (never ship to stores).
 */
import { readFileSync, existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

if (process.env.CAPACITOR_ALLOW_REMOTE_WEB === '1' || process.env.CAPACITOR_ALLOW_REMOTE_WEB === 'true') {
  console.warn('[assert-capacitor-store-bundle] Skipped: CAPACITOR_ALLOW_REMOTE_WEB is set (not for store builds).')
  process.exit(0)
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

function configDeclaresRemoteServerUrl(src) {
  const s = stripComments(src)
  const serverIdx = s.search(/\bserver\s*:\s*\{/)
  if (serverIdx === -1) return false
  const braceStart = s.indexOf('{', serverIdx)
  let depth = 0
  for (let i = braceStart; i < s.length; i += 1) {
    const c = s[i]
    if (c === '{') depth += 1
    else if (c === '}') {
      depth -= 1
      if (depth === 0) {
        const block = s.slice(braceStart, i + 1)
        return /\burl\s*:\s*['"`]/.test(block)
      }
    }
  }
  return false
}

const jsPath = join(root, 'capacitor.config.js')
const tsPath = join(root, 'capacitor.config.ts')
const jsonPath = join(root, 'capacitor.config.json')

let failed = false
for (const p of [jsPath, tsPath]) {
  if (!existsSync(p)) continue
  const txt = readFileSync(p, 'utf8')
  if (configDeclaresRemoteServerUrl(txt)) {
    console.error(
      `[assert-capacitor-store-bundle] ${basename(p)} sets server.url — not allowed for store / production.`,
    )
    console.error(
      '  Bundle reviewed assets with the binary (bun run build:web && npx cap sync). Remote HTML/JS violates typical store review expectations.',
    )
    console.error('  Local override only: CAPACITOR_ALLOW_REMOTE_WEB=1 (never ship).')
    failed = true
  }
}
if (existsSync(jsonPath)) {
  try {
    const j = JSON.parse(readFileSync(jsonPath, 'utf8'))
    if (j.server && typeof j.server.url === 'string' && j.server.url.trim() !== '') {
      console.error('[assert-capacitor-store-bundle] capacitor.config.json has server.url — not allowed for store / production.')
      failed = true
    }
  } catch {
    console.error('[assert-capacitor-store-bundle] Could not parse capacitor.config.json')
    failed = true
  }
}

if (failed) process.exit(1)
console.log('[assert-capacitor-store-bundle] OK — no remote server.url in Capacitor config.')
