#!/usr/bin/env node
/**
 * Substitutes build-time values into .well-known templates and writes the
 * final files next to them (without the .template suffix). Safe to run
 * repeatedly; always overwrites.
 *
 * Required env:
 *   APPLE_TEAM_ID              - 10-char Apple Team ID (e.g. "ABCDE12345")
 *   ANDROID_RELEASE_SHA256     - SHA-256 signing fingerprint (colon-separated)
 *
 * Usage: node scripts/build-well-known.mjs [--out=dist/.well-known]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const src = join(root, 'public', '.well-known')

const outArg = process.argv.find((a) => a.startsWith('--out='))
const out = outArg ? join(root, outArg.slice('--out='.length)) : src

const teamId = process.env.APPLE_TEAM_ID?.trim()
const sha = process.env.ANDROID_RELEASE_SHA256?.trim()

const errors = []
if (!teamId) errors.push('APPLE_TEAM_ID is not set')
if (!sha) errors.push('ANDROID_RELEASE_SHA256 is not set')

if (errors.length) {
  const msg = `[build-well-known] Skipping substitution: ${errors.join(', ')}`
  if (process.env.CI === 'true' && process.env.REQUIRE_WELL_KNOWN === '1') {
    console.error(msg)
    process.exit(1)
  }
  console.warn(msg)
  process.exit(0)
}

if (!existsSync(out)) mkdirSync(out, { recursive: true })

const aasaTpl = readFileSync(join(src, 'apple-app-site-association.template'), 'utf8')
const aasa = aasaTpl.replace(/TEAMID/g, teamId)
// Apple requires no extension + application/json
writeFileSync(join(out, 'apple-app-site-association'), aasa)

const alTpl = readFileSync(join(src, 'assetlinks.json.template'), 'utf8')
const al = alTpl.replace(/YOUR_RELEASE_SHA256/g, sha)
writeFileSync(join(out, 'assetlinks.json'), al)

console.log(`[build-well-known] Wrote apple-app-site-association + assetlinks.json to ${out}`)
