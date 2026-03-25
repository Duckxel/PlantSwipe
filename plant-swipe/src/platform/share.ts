import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
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
 * Share sheet: Web Share API first; Capacitor Share on native when web fails or is absent; clipboard last.
 */
export async function platformShare(payload: PlatformSharePayload): Promise<PlatformShareResult> {
  const { title, text, url, files } = payload

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

  if (isNativeCapacitor() && (url || title || text)) {
    try {
      await Share.share({
        title,
        text: text ?? undefined,
        url,
        dialogTitle: title,
      })
      return 'shared'
    } catch {
      /* clipboard below */
    }
  }

  const clip = url ?? text
  if (clip && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
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
  if (hasWebShare()) return true
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function')
    return true
  return Capacitor.isNativePlatform()
}
