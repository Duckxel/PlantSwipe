import type { CapacitorConfig } from '@capacitor/cli'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Capacitor loads the compiled web bundle from `webDir` (Vite production output).
 * Run `bun run build` before `cap sync` so `dist/` contains `index.html` and assets.
 *
 * `version` mirrors `package.json` — same source as Vite `VITE_APP_VERSION` / PWA display version.
 * Native versionName / CFBundleShortVersionString are patched by `scripts/sync-native-version.mjs`
 * (run from `sync:cap` / `build:cap` and CI) so stores see the same marketing version; build numbers
 * use `NATIVE_BUILD_NUMBER` in CI or a deterministic code derived from semver locally.
 */
const rootDir = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')) as { version?: string }

const config: CapacitorConfig = {
  appId: 'app.aphylia.mobile',
  appName: 'Aphylia',
  webDir: 'dist',
  ...(pkg.version ? { version: pkg.version } : {}),
}

export default config
