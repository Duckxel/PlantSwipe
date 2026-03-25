export type PlatformCameraConstraints = MediaStreamConstraints

/**
 * Camera: MediaDevices / getUserMedia (works in browsers and many Capacitor WebViews).
 * Keep capture UI unchanged; add a native picker plugin here only if we later need a non-WebView path.
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
