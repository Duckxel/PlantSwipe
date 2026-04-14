#!/usr/bin/env node
/**
 * Workaround: remove @capacitor/status-bar from the iOS SPM build.
 *
 * The capacitor-swift-pm xcframework binaries (all tags) ship new Swift APIs
 * (color(argb:), removed PluginConfig.getString, removed bridge.webView/viewController)
 * that the published @capacitor/status-bar npm package hasn't been updated to use.
 * This causes iOS compilation failures.
 *
 * The plugin still works on Android. On iOS the JS import fails silently
 * (nativeStatusBarTheme.ts wraps it in try/catch). Remove this script once
 * Capacitor publishes a compatible @capacitor/status-bar release.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const packageSwift = join(root, 'ios', 'App', 'CapApp-SPM', 'Package.swift')

if (!existsSync(packageSwift)) {
  console.log('[patch-ios-spm] No Package.swift found, skipping.')
  process.exit(0)
}

let content = readFileSync(packageSwift, 'utf8')

// Remove the CapacitorStatusBar dependency line
content = content.replace(/,?\s*\.package\(name:\s*"CapacitorStatusBar"[^)]*\)/, '')

// Remove the CapacitorStatusBar product dependency from the target
content = content.replace(/,?\s*\.product\(name:\s*"CapacitorStatusBar"[^)]*\)/, '')

// Clean up any trailing commas before closing brackets
content = content.replace(/,(\s*\])/g, '$1')

writeFileSync(packageSwift, content, 'utf8')
console.log('[patch-ios-spm] Removed CapacitorStatusBar from iOS SPM build (binary API mismatch workaround).')
