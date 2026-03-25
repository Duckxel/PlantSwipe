import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { isNativeCapacitor } from '@/platform/runtime'

type TapStyle = 'light' | 'medium' | 'heavy'

const impactMap: Record<TapStyle, ImpactStyle> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
}

/**
 * Haptics: Web Vibration API first; Capacitor Haptics on native when vibration is unavailable.
 * Never throws — safe to call from UI handlers.
 */
export function isHapticsAvailable(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') return true
  return isNativeCapacitor()
}

async function tryCapacitorImpact(style: TapStyle): Promise<boolean> {
  if (!isNativeCapacitor()) return false
  try {
    await Haptics.impact({ style: impactMap[style] })
    return true
  } catch {
    return false
  }
}

/** Short vibration / haptic tap. Duration in ms for web `vibrate`. */
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
