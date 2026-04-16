import { isNativeCapacitor } from '@/platform/runtime'

export type PlatformSharePayload = {
  title?: string
  text?: string
  url?: string
  files?: File[]
}

export type PlatformShareResult = 'shared' | 'copied' | 'unavailable' | 'cancelled' | 'error'

function hasWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

function canShareFiles(files: File[]): boolean {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (typeof nav.canShare !== 'function' || files.length === 0) return true
  try {
    return nav.canShare({ files })
  } catch {
    return false
  }
}

/**
 * Native Capacitor share via @capacitor/share plugin.
 * The plugin shows the native OS share sheet (ACTION_SEND on Android, UIActivityVC on iOS).
 */
async function nativeShare(payload: PlatformSharePayload): Promise<PlatformShareResult> {
  try {
    const { Share } = await import('@capacitor/share')

    // Build the share options — the plugin accepts title, text, url, dialogTitle
    const options: { title?: string; text?: string; url?: string; dialogTitle?: string } = {}
    if (payload.title) options.title = payload.title
    if (payload.text) options.text = payload.text
    if (payload.url) options.url = payload.url
    options.dialogTitle = payload.title || 'Share'

    const hasPayload = Boolean(options.title || options.text || options.url)
    if (!hasPayload) return 'unavailable'

    await Share.share(options)
    return 'shared'
  } catch (e) {
    // User cancelled the share sheet
    if (String(e).includes('cancel') || String(e).includes('dismissed')) return 'cancelled'
    console.warn('[share] Native share failed:', e)
    return 'error'
  }
}

/**
 * Share: native Capacitor Share plugin on mobile, Web Share API on browser, clipboard fallback.
 */
export async function platformShare(payload: PlatformSharePayload): Promise<PlatformShareResult> {
  const { title, text, url, files } = payload

  // On native Capacitor, use the native share sheet (no file support in core plugin)
  if (isNativeCapacitor()) {
    return nativeShare(payload)
  }

  if (hasWebShare()) {
    try {
      const data: ShareData = {}
      if (title) data.title = title
      if (text) data.text = text
      if (url) data.url = url
      if (files?.length && canShareFiles(files)) {
        data.files = files
      }
      const hasPayload =
        Boolean(data.title || data.text || data.url) || Boolean(data.files && data.files.length > 0)
      if (hasPayload) {
        await navigator.share(data)
        return 'shared'
      }
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelled'
    }
  }

  const clip = url ?? text
  if (clip && typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(clip)
      return 'copied'
    } catch {
      return 'error'
    }
  }

  if (!hasWebShare() && !clip && !(files?.length)) return 'unavailable'
  return 'error'
}

export function isPlatformShareSupported(): boolean {
  if (isNativeCapacitor()) return true
  if (hasWebShare()) return true
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function')
    return true
  return false
}
