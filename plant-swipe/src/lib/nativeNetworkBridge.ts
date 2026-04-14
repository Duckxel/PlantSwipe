import { buildAbsoluteUrl, getNativeApiOrigin, isApiOriginUrl, rewriteLocalApiUrl } from '@/lib/nativeApiOrigin'

type FetchLike = typeof fetch

type NativeWindow = Window & typeof globalThis & {
  __aphyliaNativeFetchPatched__?: boolean
  __aphyliaNativeEventSourcePatched__?: boolean
}

function getRuntimeWindow(): NativeWindow | null {
  if (typeof window === 'undefined') return null
  return window as NativeWindow
}

function currentOrigin(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return window.location.origin
}

function shouldSendCredentials(apiOrigin: string): boolean {
  if (typeof window === 'undefined') return false
  return isApiOriginUrl(window.location.origin, apiOrigin)
}

function normalizeFetchInit(url: string, init: RequestInit | undefined, apiOrigin: string): RequestInit | undefined {
  if (!init) {
    return shouldSendCredentials(apiOrigin) ? init : { credentials: 'omit' }
  }
  if (init.credentials !== undefined || shouldSendCredentials(apiOrigin) || !url.startsWith(apiOrigin)) {
    return init
  }
  return { ...init, credentials: 'omit' }
}

export function patchNativeFetch(): void {
  const runtimeWindow = getRuntimeWindow()
  const apiOrigin = getNativeApiOrigin()
  if (!runtimeWindow || !apiOrigin || runtimeWindow.__aphyliaNativeFetchPatched__) return
  const originalFetch = runtimeWindow.fetch.bind(runtimeWindow) as FetchLike

  runtimeWindow.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      const rewritten = rewriteLocalApiUrl(input, apiOrigin, currentOrigin())
      return originalFetch(rewritten, normalizeFetchInit(rewritten, init, apiOrigin))
    }

    if (input instanceof URL) {
      const rewritten = rewriteLocalApiUrl(input.toString(), apiOrigin, currentOrigin())
      return originalFetch(rewritten, normalizeFetchInit(rewritten, init, apiOrigin))
    }

    return originalFetch(input, init)
  }) as typeof fetch

  runtimeWindow.__aphyliaNativeFetchPatched__ = true
}

export function patchNativeEventSource(): void {
  const runtimeWindow = getRuntimeWindow()
  const apiOrigin = getNativeApiOrigin()
  if (!runtimeWindow || !apiOrigin || runtimeWindow.__aphyliaNativeEventSourcePatched__) return
  const resolvedApiOrigin = apiOrigin
  const NativeEventSource = runtimeWindow.EventSource
  if (typeof NativeEventSource !== 'function') return

  runtimeWindow.EventSource = class NativeApiEventSource extends NativeEventSource {
    constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
      const rawUrl = url instanceof URL ? url.toString() : String(url)
      const rewritten = rewriteLocalApiUrl(rawUrl, resolvedApiOrigin, currentOrigin())
      const normalizedInit =
        eventSourceInitDict?.withCredentials && !shouldSendCredentials(resolvedApiOrigin)
          ? { ...eventSourceInitDict, withCredentials: false }
          : eventSourceInitDict
      super(rewritten || buildAbsoluteUrl(resolvedApiOrigin, '/api'), normalizedInit)
    }
  } as typeof EventSource

  runtimeWindow.__aphyliaNativeEventSourcePatched__ = true
}

export function installNativeNetworkBridge(): void {
  patchNativeFetch()
  patchNativeEventSource()
}
