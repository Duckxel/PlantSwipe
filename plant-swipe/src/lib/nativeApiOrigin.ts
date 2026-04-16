const DEFAULT_NATIVE_API_ORIGIN = 'https://aphylia.app'
const HTML_PLACEHOLDER_RE = /^%[A-Z0-9_]+%$/i

type HtmlBootstrapEnv = {
  nativeBuild?: unknown
  apiOrigin?: unknown
  siteUrl?: unknown
}

type RuntimeWindow = Window & {
  __ENV__?: Record<string, unknown>
  __APHYLIA_HTML_ENV__?: HtmlBootstrapEnv
}

function getRuntimeWindow(): RuntimeWindow | null {
  if (typeof window === 'undefined') return null
  return window as RuntimeWindow
}

export function normalizeConfiguredOrigin(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed || HTML_PLACEHOLDER_RE.test(trimmed)) return null
  try {
    return new URL(trimmed).origin
  } catch {
    return null
  }
}

function readConfiguredOrigins(): Array<string | null> {
  const runtimeWindow = getRuntimeWindow()
  return [
    normalizeConfiguredOrigin(import.meta.env.VITE_API_ORIGIN),
    normalizeConfiguredOrigin(import.meta.env.VITE_SITE_URL),
    normalizeConfiguredOrigin(runtimeWindow?.__ENV__?.VITE_API_ORIGIN),
    normalizeConfiguredOrigin(runtimeWindow?.__ENV__?.VITE_SITE_URL),
    normalizeConfiguredOrigin(runtimeWindow?.__APHYLIA_HTML_ENV__?.apiOrigin),
    normalizeConfiguredOrigin(runtimeWindow?.__APHYLIA_HTML_ENV__?.siteUrl),
  ]
}

export function isNativeStoreBuild(): boolean {
  if (import.meta.env.VITE_APP_NATIVE_BUILD === '1') return true
  const runtimeWindow = getRuntimeWindow()
  const raw = runtimeWindow?.__APHYLIA_HTML_ENV__?.nativeBuild
  if (typeof raw !== 'string') return false
  const normalized = raw.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

export function getNativeApiOrigin(): string | null {
  if (!isNativeStoreBuild()) return null
  for (const candidate of readConfiguredOrigins()) {
    if (candidate) return candidate
  }
  return DEFAULT_NATIVE_API_ORIGIN
}

export function buildAbsoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).toString()
}

export function isApiOriginUrl(rawUrl: string | URL, apiOrigin: string): boolean {
  const normalizedApiOrigin = normalizeConfiguredOrigin(apiOrigin)
  if (!normalizedApiOrigin) return false
  try {
    const parsed = rawUrl instanceof URL ? rawUrl : new URL(String(rawUrl))
    return parsed.origin === normalizedApiOrigin
  } catch {
    return false
  }
}

function isLocalApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

export function rewriteLocalApiUrl(rawUrl: string, apiOrigin: string, currentOrigin?: string): string {
  const normalizedApiOrigin = normalizeConfiguredOrigin(apiOrigin)
  if (!normalizedApiOrigin || typeof rawUrl !== 'string' || !rawUrl) return rawUrl

  if (rawUrl === '/api' || rawUrl.startsWith('/api/') || rawUrl.startsWith('/api?')) {
    return buildAbsoluteUrl(normalizedApiOrigin, rawUrl)
  }

  const normalizedCurrentOrigin = normalizeConfiguredOrigin(currentOrigin)
  if (!normalizedCurrentOrigin) return rawUrl

  try {
    const parsed = new URL(rawUrl, normalizedCurrentOrigin)
    if (parsed.origin !== normalizedCurrentOrigin || !isLocalApiPath(parsed.pathname)) {
      return rawUrl
    }
    return buildAbsoluteUrl(normalizedApiOrigin, `${parsed.pathname}${parsed.search}${parsed.hash}`)
  } catch {
    return rawUrl
  }
}

export { DEFAULT_NATIVE_API_ORIGIN }
