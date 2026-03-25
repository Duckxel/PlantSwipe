#!/usr/bin/env node
/**
 * Single source of truth: plant-swipe/package.json "version" (same as PWA / VITE_APP_VERSION).
 * Run automatically before `npx cap sync` via `bun run sync:cap` / `bun run build:cap` and `cap:ci:sync`.
 * - Android: versionName + versionCode in android/app/build.gradle
 * - iOS: CFBundleShortVersionString + CFBundleVersion in App Info.plist
 *
 * versionCode / CFBundleVersion (build number):
 *   NATIVE_BUILD_NUMBER env (integer) if set — use for CI monotonic builds (e.g. GITHUB_RUN_NUMBER).
 *   Else deterministic from semver: major*1_000_000 + minor*1_000 + patch (caps each segment at 999).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkgPath = join(root, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const versionName = String(pkg.version || '0.0.0').trim()

function semverToVersionCode(semver) {
  const m = semver.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) return 1
  const maj = Math.min(999, parseInt(m[1], 10) || 0)
  const min = Math.min(999, parseInt(m[2], 10) || 0)
  const pat = Math.min(999, parseInt(m[3], 10) || 0)
  return maj * 1_000_000 + min * 1_000 + pat
}

const envBuild = process.env.NATIVE_BUILD_NUMBER?.trim()
let versionCode
if (envBuild && /^\d+$/.test(envBuild)) {
  versionCode = parseInt(envBuild, 10)
} else {
  versionCode = semverToVersionCode(versionName)
}

const gradlePath =
  process.env.CAP_ANDROID_APP_BUILD_GRADLE?.trim() || join(root, 'android', 'app', 'build.gradle')
const plistCandidates = [
  process.env.CAP_IOS_INFO_PLIST?.trim(),
  join(root, 'ios', 'App', 'App', 'Info.plist'),
  join(root, 'ios', 'App', 'Info.plist'),
].filter(Boolean)

function patchGradle(content) {
  const escaped = versionName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  let c = content
  if (/versionCode\s+\d+/.test(c)) {
    c = c.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  }
  if (/versionName\s+"[^"]*"/.test(c)) {
    c = c.replace(/versionName\s+"[^"]*"/, `versionName "${escaped}"`)
  } else if (/versionName\s+'[^']*'/.test(c)) {
    c = c.replace(/versionName\s+'[^']*'/, `versionName '${versionName.replace(/'/g, "\\'")}'`)
  }
  const hasVc = /versionCode\s+\d+/.test(c)
  const hasVn = /versionName\s+/.test(c)
  if (!hasVc && !hasVn) {
    c = c.replace(/\bdefaultConfig\s*\{/, (m) => `${m}\n        versionCode ${versionCode}\n        versionName "${escaped}"\n`)
  } else if (!hasVc) {
    c = c.replace(/\bdefaultConfig\s*\{/, (m) => `${m}\n        versionCode ${versionCode}\n`)
  } else if (!hasVn) {
    c = c.replace(/\bdefaultConfig\s*\{/, (m) => `${m}\n        versionName "${escaped}"\n`)
  }
  return c
}

function patchPlistXml(xml) {
  let s = xml
  s = s.replace(
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${versionName.replace(/&/g, '&amp;').replace(/</g, '&lt;')}$2`,
  )
  s = s.replace(
    /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${String(versionCode)}$2`,
  )
  return s
}

const capJsonPath = join(root, 'capacitor.config.json')

/** Keep Capacitor config JSON aligned with package.json version (CLI loads JSON reliably with "type": "module"). */
function syncCapacitorConfigJson() {
  const base = {
    appId: 'app.aphylia.mobile',
    appName: 'Aphylia',
    webDir: 'dist',
  }
  let cap = { ...base }
  if (existsSync(capJsonPath)) {
    try {
      const existing = JSON.parse(readFileSync(capJsonPath, 'utf8'))
      if (existing && typeof existing === 'object') {
        cap = { ...existing, ...base }
      }
    } catch {
      /* overwrite below */
    }
  }
  cap.version = versionName
  if (cap.server && typeof cap.server === 'object' && cap.server.url) {
    delete cap.server.url
    if (Object.keys(cap.server).length === 0) delete cap.server
  }
  const nextStr = `${JSON.stringify(cap, null, '\t')}\n`
  const prevStr = existsSync(capJsonPath) ? readFileSync(capJsonPath, 'utf8') : ''
  if (prevStr !== nextStr) {
    writeFileSync(capJsonPath, nextStr, 'utf8')
  }
}

syncCapacitorConfigJson()

let androidOk = false
let iosOk = false

if (existsSync(gradlePath)) {
  const before = readFileSync(gradlePath, 'utf8')
  const after = patchGradle(before)
  if (after !== before) {
    writeFileSync(gradlePath, after, 'utf8')
  }
  androidOk = true
}

for (const plistPath of plistCandidates) {
  if (!plistPath || !existsSync(plistPath)) continue
  const before = readFileSync(plistPath, 'utf8')
  if (!before.includes('CFBundleShortVersionString')) continue
  const after = patchPlistXml(before)
  if (after !== before) {
    writeFileSync(plistPath, after, 'utf8')
  }
  iosOk = true
  break
}

// eslint-disable-next-line no-console -- CLI feedback
console.log(
  `[sync-native-version] versionName=${versionName} versionCode=${versionCode} capacitor.config.json=ok` +
    (androidOk ? ' android=patched' : ' android=skip') +
    (iosOk ? ' ios=patched' : ' ios=skip'),
)
