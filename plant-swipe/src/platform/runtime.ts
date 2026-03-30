import { Capacitor } from '@capacitor/core'

/** True when running inside a Capacitor native shell (iOS / Android). */
export function isNativeCapacitor(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}
