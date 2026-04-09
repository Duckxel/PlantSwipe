import { isNativeCapacitor } from '@/platform/runtime'

type TapStyle = 'light' | 'medium' | 'heavy'

/**
 * Haptics: Web Vibration API first; Capacitor Haptics on native when available.
 */
export function isHapticsAvailable(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') return true
  return isNativeCapacitor()
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
