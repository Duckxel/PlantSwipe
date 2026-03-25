import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor loads the compiled web bundle from `webDir` (Vite production output).
 * Run `bun run build` before `cap sync` so `dist/` contains `index.html` and assets.
 */
const config: CapacitorConfig = {
  appId: 'app.aphylia.mobile',
  appName: 'Aphylia',
  webDir: 'dist',
}

export default config
