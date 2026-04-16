import { isNativeCapacitor } from '@/platform/runtime'

type TapStyle = 'light' | 'medium' | 'heavy'

const HAPTICS_PREF_KEY = 'aphylia.haptics_enabled'

/**
 * Haptics: Web Vibration API first; Capacitor Haptics on native when available.
 */
export function isHapticsAvailable(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') return true
  return isNativeCapacitor()
}

/** Read the user's haptics preference (localStorage, defaults to true). */
export function isHapticsEnabled(): boolean {
  try {
    const v = localStorage.getItem(HAPTICS_PREF_KEY)
    return v !== 'false'
  } catch {
    return true
  }
}

/** Persist the user's haptics preference. */
export function setHapticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(HAPTICS_PREF_KEY, String(enabled))
  } catch {
    /* quota / private-mode */
  }
}

async function tryCapacitorImpact(style: TapStyle): Promise<boolean> {
  if (!isNativeCapacitor()) return false
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy } as const
    await Haptics.impact({ style: map[style] })
    return true
  } catch {
    return false
  }
}

export async function platformHapticTap(durationMs = 50): Promise<void> {
  if (!isHapticsEnabled()) return
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(durationMs)
      return
    } catch {
      /* fall through */
    }
  }
  const style: TapStyle = durationMs <= 15 ? 'light' : durationMs <= 40 ? 'medium' : 'heavy'
  await tryCapacitorImpact(style)
}
