#!/usr/bin/env node
/**
 * Sync brand assets from plant-swipe/assets/ into plant-swipe/public/.
 *
 * Why this exists: the Vite build (and `bun run dev`) reads from public/, but
 * the source of truth for shared brand artwork is plant-swipe/assets/. To avoid
 * checking the same image bytes into git twice, the public/ copies are
 * gitignored and regenerated on every `dev` / `build` via the predev / prebuild
 * hooks in package.json. Production deploys do the same thing in setup.sh.
 *
 * The destination list MUST match `copy_brand_asset` in /setup.sh — keep them
 * in sync. If the asset isn't present in assets/, it's quietly skipped (so
 * fresh checkouts that haven't pulled the assets folder yet still build).
 */

import { promises as fs, createReadStream } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoAppDir = path.resolve(__dirname, '..')
const assetsDir = path.join(repoAppDir, 'assets')
const publicDir = path.join(repoAppDir, 'public')

// src -> dst (relative to assetsDir / publicDir respectively)
const ASSET_MAP = [
  // Brand SVG: referenced from index.html, manifest.webmanifest, and the SSR
  // template in server.js by the legacy filename.
  ['icon.svg',      'icons/plant-swipe-icon-outline.svg'],
  // Canonical PNG. Existing icon-192/512 PNGs are *not* overwritten because
  // they advertise specific dimensions in the manifest.
  ['icon.png',      'icons/icon.png'],
  // Direct-hit favicon. /favicon.ico has an Express alias as a safety net,
  // but a real file at this path is preferred.
  ['favicon.ico',   'favicon.ico'],
  // White-silhouette badge for push notifications. Source is logo-dark.png
  // (already used by the Capacitor pipeline). Renamed on copy so the SW URL
  // is self-describing.
  ['logo-dark.png', 'icons/notification-badge.png'],
]

async function sha1(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1')
    createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject)
  })
}

async function fileExists(p) {
  try { await fs.access(p); return true } catch { return false }
}

async function syncOne(srcRel, dstRel) {
  const src = path.join(assetsDir, srcRel)
  const dst = path.join(publicDir, dstRel)

  if (!(await fileExists(src))) {
    console.log(`  [SKIP]    ${srcRel} not found in assets/`)
    return
  }
  await fs.mkdir(path.dirname(dst), { recursive: true })

  let action = 'created'
  if (await fileExists(dst)) {
    const [srcHash, dstHash] = await Promise.all([sha1(src), sha1(dst)])
    if (srcHash === dstHash) {
      console.log(`  unchanged ${dstRel}`)
      return
    }
    action = 'updated'
    // Force overwrite — `copyFile` already truncates, but if someone made the
    // file read-only we want to win.
    try { await fs.chmod(dst, 0o644) } catch {}
  }
  await fs.copyFile(src, dst)
  await fs.chmod(dst, 0o644)
  const { size } = await fs.stat(dst)
  console.log(`  ${action.padEnd(9)} ${dstRel}  (${size} bytes)`)
}

async function main() {
  if (!(await fileExists(assetsDir))) {
    console.log(`[brand-assets] No ${assetsDir} directory; skipping.`)
    return
  }
  console.log(`[brand-assets] Syncing ${path.relative(repoAppDir, assetsDir)} → ${path.relative(repoAppDir, publicDir)} …`)
  for (const [srcRel, dstRel] of ASSET_MAP) {
    await syncOne(srcRel, dstRel)
  }
}

main().catch((err) => {
  console.error('[brand-assets] failed:', err)
  process.exit(1)
})
