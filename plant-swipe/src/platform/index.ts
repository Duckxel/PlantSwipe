/**
 * Platform abstraction: web-first implementations with optional Capacitor fallbacks.
 * Business logic, routes, and forms stay in shared code; call into this layer from UI only.
 */
export { isNativeCapacitor, isBrowserEnvironment } from '@/platform/runtime'
export { platformStorage } from '@/platform/storage'
export { platformHapticTap, isHapticsAvailable } from '@/platform/haptics'
export {
  platformShare,
  isPlatformShareSupported,
  type PlatformSharePayload,
  type PlatformShareResult,
} from '@/platform/share'
export {
  platformGetCameraStream,
  platformEnumerateVideoDevices,
  isPlatformCameraSupported,
  platformPickCameraPhoto,
  type PlatformPhotoResult,
} from '@/platform/camera'
export { isPlatformWebPushSupported } from '@/platform/push'
