import { isNativeCapacitor } from '@/platform/runtime'

export type PlatformCameraConstraints = MediaStreamConstraints

/**
 * Live camera preview stream (messaging capture UI).
 */
export async function platformGetCameraStream(constraints: PlatformCameraConstraints): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('camera_not_supported')
  }
  return navigator.mediaDevices.getUserMedia(constraints)
}

export async function platformEnumerateVideoDevices(): Promise<MediaDeviceInfo[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return []
  }
  try {
    return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
  } catch {
    return []
  }
}

export function isPlatformCameraSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
}

export type PlatformPhotoResult = { file: File; dataUrl?: string }

export type PlatformPhotoOutcome =
  | { kind: 'ok'; result: PlatformPhotoResult }
  | { kind: 'cancelled' }
  | { kind: 'denied'; canOpenSettings: boolean }
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string }

/**
 * Full outcome of a native camera request, so callers can show a rationale
 * when the user has denied the permission (and open the OS settings for them).
 */
export async function platformPickCameraPhotoWithOutcome(): Promise<PlatformPhotoOutcome> {
  if (isNativeCapacitor()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
      const perm = await Camera.checkPermissions().catch(() => null)
      if (perm?.camera === 'denied') {
        return { kind: 'denied', canOpenSettings: true }
      }
      if (perm?.camera === 'prompt' || perm?.camera === 'prompt-with-rationale') {
        const req = await Camera.requestPermissions({ permissions: ['camera'] }).catch(() => null)
        if (req?.camera === 'denied') return { kind: 'denied', canOpenSettings: true }
      }
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      })
      const path = photo.webPath
      if (!path) return { kind: 'cancelled' }
      const res = await fetch(path)
      const blob = await res.blob()
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' })
      return { kind: 'ok', result: { file, dataUrl: photo.webPath } }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/cancel|dismiss|User cancelled/i.test(msg)) return { kind: 'cancelled' }
      if (/denied|permission/i.test(msg)) return { kind: 'denied', canOpenSettings: true }
      return { kind: 'error', message: msg }
    }
  }

  if (typeof document === 'undefined') return { kind: 'unsupported' }

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.style.display = 'none'
    input.onchange = () => {
      const f = input.files?.[0]
      document.body.removeChild(input)
      resolve(f ? { kind: 'ok', result: { file: f } } : { kind: 'cancelled' })
    }
    input.oncancel = () => {
      document.body.removeChild(input)
      resolve({ kind: 'cancelled' })
    }
    document.body.appendChild(input)
    input.click()
  })
}

/**
 * Backwards-compatible helper — returns null on cancel / denial / error.
 * Prefer `platformPickCameraPhotoWithOutcome` for new callers that want to
 * surface a permission-denied CTA.
 */
export async function platformPickCameraPhoto(): Promise<PlatformPhotoResult | null> {
  const outcome = await platformPickCameraPhotoWithOutcome()
  return outcome.kind === 'ok' ? outcome.result : null
}

/**
 * Opens the iOS/Android app settings screen so the user can grant a denied
 * permission. No-op on web. Requires a native plugin that is not part of the
 * base Capacitor set, so we dynamic-import it and return false if unavailable.
 */
export async function openNativeAppSettings(): Promise<boolean> {
  if (!isNativeCapacitor()) return false
  try {
    // Some projects ship @capacitor/app-launcher or @capawesome/capacitor-app-settings.
    // We try both; if neither is installed we return false so the UI can
    // fall back to plain copy ("go to Settings → Aphylia → Camera").
    const candidates = ['@capawesome/capacitor-app-settings', '@capacitor/app-launcher'] as const
    for (const mod of candidates) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m = (await import(/* @vite-ignore */ mod)) as any
        if (mod === '@capawesome/capacitor-app-settings' && m?.AppSettings?.openAppSettings) {
          await m.AppSettings.openAppSettings()
          return true
        }
        if (mod === '@capacitor/app-launcher' && m?.AppLauncher?.openUrl) {
          await m.AppLauncher.openUrl({ url: 'app-settings:' })
          return true
        }
      } catch {
        /* try next */
      }
    }
  } catch {
    /* ignore */
  }
  return false
}
