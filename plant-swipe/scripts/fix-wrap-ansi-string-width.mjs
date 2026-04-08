#!/usr/bin/env node
/**
 * Bun can leave wrap-ansi with nested ESM-only string-width@5 / ansi-styles@6.
 * wrap-ansi@6/7 use require() — Capacitor CLI then crashes during `cap sync`.
 * Replace those nested packages with hoisted CommonJS 4.x copies when present.
 */
import { cpSync, existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const nm = join(root, 'node_modules')
const wrapNm = join(nm, 'wrap-ansi', 'node_modules')

function isProblematicPackage(dir, { esmMajor }) {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    if (pkg.type === 'module') return true
    const maj = parseInt(String(pkg.version || '').split('.')[0], 10)
    return Number.isFinite(maj) && maj >= esmMajor
  } catch {
    return false
  }
}

function replaceNested(name, hoistedName, opts) {
  const hoisted = join(nm, hoistedName)
  const nested = join(wrapNm, name)
  if (!existsSync(hoisted) || !statSync(hoisted).isDirectory()) return
  if (!existsSync(nested) || !statSync(nested).isDirectory()) return
  if (!isProblematicPackage(nested, opts)) return
  rmSync(nested, { recursive: true, force: true })
  cpSync(hoisted, nested, { recursive: true })
}

try {
  if (!existsSync(wrapNm) || !statSync(wrapNm).isDirectory()) {
    process.exit(0)
  }
  replaceNested('string-width', 'string-width', { esmMajor: 5 })
  replaceNested('ansi-styles', 'ansi-styles', { esmMajor: 6 })
} catch {
  process.exit(0)
}
