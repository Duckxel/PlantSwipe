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

/**
 * Single photo from native camera or file picker (settings / profile flows).
 */
export async function platformPickCameraPhoto(): Promise<PlatformPhotoResult | null> {
  if (isNativeCapacitor()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      })
      const path = photo.webPath
      if (!path) return null
      const res = await fetch(path)
      const blob = await res.blob()
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' })
      return { file, dataUrl: photo.webPath }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/cancel|dismiss|User cancelled/i.test(msg)) return null
      throw e
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.style.display = 'none'
    input.onchange = () => {
      const f = input.files?.[0]
      document.body.removeChild(input)
      resolve(f ? { file: f } : null)
    }
    input.oncancel = () => {
      document.body.removeChild(input)
      resolve(null)
    }
    document.body.appendChild(input)
    input.click()
  })
}
