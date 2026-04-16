/**
 * Align Capacitor status bar with web theme (solid bar, light icons on Aphylia brand colors).
 */
import { Capacitor } from '@capacitor/core'

const BAR_LIGHT = '#052e16'
const BAR_DARK = '#252526'

export async function applyNativeChromeForTheme(effectiveTheme: 'light' | 'dark'): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    const color = effectiveTheme === 'dark' ? BAR_DARK : BAR_LIGHT
    // overlay: true lets the WebView extend behind the status bar; the actual
    // spacing is handled by CSS env(safe-area-inset-top) on <body> which
    // kicks in immediately — no race-condition flash on startup.
    await StatusBar.setOverlaysWebView({ overlay: true })
    await StatusBar.setBackgroundColor({ color })
    await StatusBar.setStyle({ style: Style.Light })
  } catch {
    /* StatusBar unavailable on some WebViews */
  }
}
