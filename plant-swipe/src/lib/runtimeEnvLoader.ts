type RuntimeEnvWindow = Window & {
  __ENV__?: Record<string, unknown>
  __plantswipeEnvBootstrap__?: boolean
}

const CACHE_KEY = 'plantswipe.env.inline'
const CACHE_TTL_MS = 1000 * 60 * 60 * 6 // 6 hours

const hasWindow = typeof window !== 'undefined' && typeof document !== 'undefined'

const normalizeBase = (value?: string) => {
  if (!value || value.trim() === '' || value === '/') return '/'
  let next = value.trim()
  if (!next.startsWith('/')) next = `/${next}`
  if (!next.endsWith('/')) next = `${next}/`
  return next.replace(/\/{2,}/g, '/')
}

const resolveBasePath = () => {
  if (!hasWindow) return '/'
  const metaBase = normalizeBase((import.meta.env?.BASE_URL as string | undefined) || '/')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalBase = normalizeBase((window as any).__PLANTSWIPE_BASE_PATH__ || '/')
  return metaBase !== '/' ? metaBase : globalBase
}

const basePath = resolveBasePath()
if (hasWindow) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__PLANTSWIPE_BASE_PATH__ = basePath
}

const joinPath = (base: string, resource: string) => {
  if (/^(https?:)?\/\//.test(resource)) return resource
  const cleanBase = normalizeBase(base)
  const cleanResource = resource.replace(/^\//, '')
  if (!cleanResource) return cleanBase
  if (cleanBase === '/') return `/${cleanResource}`
  return `${cleanBase}${cleanResource}`.replace(/\/{2,}/g, '/')
}

const candidateUrls = hasWindow
  ? Array.from(
      new Set([
        joinPath(basePath, 'api/env.js'),
        '/api/env.js',
        joinPath(basePath, 'env.js'),
        '/env.js',
      ])
    )
  : []

const isProbablyHtml = (text: string) => {
  if (!text) return false
  const snippet = text.trim().slice(0, 200).toLowerCase()
  return snippet.startsWith('<!doctype') || snippet.startsWith('<html') || snippet.includes('<head') || snippet.includes('<body')
}

const injectInlineScript = (scriptText: string, label: string) => {
  if (!hasWindow) return
  const head = document.head || document.getElementsByTagName('head')[0] || document.documentElement
  const scriptEl = document.createElement('script')
  scriptEl.type = 'text/javascript'
  scriptEl.text = `${scriptText}\n//# sourceURL=${label}`
  head.appendChild(scriptEl)
  head.removeChild(scriptEl)
}

const persistCache = (scriptText: string) => {
  if (!hasWindow) return
  try {
    const payload = {
      text: scriptText,
      expires: Date.now() + CACHE_TTL_MS,
    }
    window.sessionStorage?.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota / privacy errors
  }
}

const tryApplyCachedEnv = () => {
  if (!hasWindow) return false
  try {
    const raw = window.sessionStorage?.getItem(CACHE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { text?: string; expires?: number }
    if (!parsed?.text || typeof parsed.expires !== 'number') return false
    if (parsed.expires < Date.now()) {
      window.sessionStorage?.removeItem(CACHE_KEY)
      return false
    }
    injectInlineScript(parsed.text, 'runtime-env-cache.js')
    return true
  } catch {
    return false
  }
}

const dispatchReady = (detail: { source: string; cached: boolean }) => {
  if (!hasWindow) return
  try {
    window.dispatchEvent(new CustomEvent('plantswipe:env-ready', { detail }))
  } catch {
    // noop
  }
}

const ensureEnvObject = (target: RuntimeEnvWindow) => {
  if (!target.__ENV__ || typeof target.__ENV__ !== 'object') {
    target.__ENV__ = {}
  }
}

const fetchAndApply = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' })
  if (!response.ok) throw new Error(`Bad status ${response.status}`)
  const text = await response.text()
  if (isProbablyHtml(text)) throw new Error('Unexpected HTML payload')
  injectInlineScript(text, `runtime-env:${url}`)
  persistCache(text)
  dispatchReady({ source: url, cached: false })
  return true
}

const hydrateRuntimeEnv = async () => {
  if (!hasWindow) return
  const globalScope = window as RuntimeEnvWindow
  if (globalScope.__plantswipeEnvBootstrap__) return
  globalScope.__plantswipeEnvBootstrap__ = true
  ensureEnvObject(globalScope)

  const appliedFromCache = tryApplyCachedEnv()
  if (appliedFromCache) {
    dispatchReady({ source: 'cache', cached: true })
  }

  for (const url of candidateUrls) {
    try {
      await fetchAndApply(url)
      return
    } catch {
      // continue to next candidate
    }
  }

  if (!appliedFromCache) {
    ensureEnvObject(globalScope)
    dispatchReady({ source: 'fallback', cached: false })
  }
}

if (hasWindow) {
  hydrateRuntimeEnv().catch(() => {
    if (hasWindow) {
      const globalScope = window as RuntimeEnvWindow
      ensureEnvObject(globalScope)
      dispatchReady({ source: 'error', cached: false })
    }
  })
}

export {}
