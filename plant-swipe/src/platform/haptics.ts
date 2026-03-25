/**
 * Haptics: Web Vibration API only. (Capacitor Haptics plugin removed to keep native surface minimal.)
 */
export function isHapticsAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/** Short vibration on supported engines; no-op where vibrate is missing. */
export async function platformHapticTap(durationMs = 50): Promise<void> {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(durationMs)
  } catch {
    /* ignore */
  }
}
