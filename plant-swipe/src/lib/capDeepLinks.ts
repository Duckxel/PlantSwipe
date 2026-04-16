/**
 * Capacitor: handle universal / app links and auth return URLs.
 * Registers with React Router from inside BrowserRouter (see App.tsx).
 */
import type { NavigateFunction } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'

let navigateRef: NavigateFunction | null = null
let listenersRegistered = false

function isOurAppUrl(url: URL, appHosts: Set<string>): boolean {
  const h = url.hostname.toLowerCase()
  if (appHosts.has(h)) return true
  if (url.protocol === 'capacitor:' || url.protocol === 'ionic:') return true
  return false
}

function collectAppHosts(): Set<string> {
  const hosts = new Set<string>()
  try {
    const u = import.meta.env.VITE_APP_UNIVERSAL_LINK_ORIGIN as string | undefined
    if (u) {
      const parsed = new URL(u)
      if (parsed.hostname) hosts.add(parsed.hostname.toLowerCase())
    }
  } catch {
    /* ignore */
  }
  try {
    const su = import.meta.env.VITE_SUPABASE_URL as string | undefined
    if (su) {
      const parsed = new URL(su)
      if (parsed.hostname) hosts.add(parsed.hostname.toLowerCase())
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.location.hostname) {
    hosts.add(window.location.hostname.toLowerCase())
  }
  return hosts
}

/**
 * Open external auth / mail links.
 * On native Capacitor, uses @capacitor/browser for an in-app browser experience.
 * On web, opens a new tab.
 */
export function openExternalUrl(href: string): void {
  if (typeof window === 'undefined') return
  try {
    const u = new URL(href, window.location.origin)
    const hosts = collectAppHosts()
    if (isOurAppUrl(u, hosts)) {
      window.location.assign(href)
      return
    }
  } catch {
    /* fall through */
  }
  if (Capacitor.isNativePlatform()) {
    void import('@capacitor/browser').then(({ Browser }) => {
      Browser.open({ url: href }).catch(() => {
        // Fallback if plugin fails
        window.open(href, '_blank', 'noopener,noreferrer')
      })
    })
  } else {
    window.open(href, '_blank', 'noopener,noreferrer')
  }
}

/**
 * Apply deep link path inside the SPA (preserves query/hash for Supabase PKCE).
 */
function handleIncomingUrl(raw: string): void {
  if (!navigateRef || typeof window === 'undefined') return
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return
  }
  const hosts = collectAppHosts()
  if (!isOurAppUrl(url, hosts)) return

  const path = `${url.pathname}${url.search}${url.hash}`
  if (path && path !== window.location.pathname + window.location.search + window.location.hash) {
    navigateRef(path, { replace: true })
  }
}

export function registerCapacitorDeepLinks(navigate: NavigateFunction): void {
  navigateRef = navigate
  if (!Capacitor.isNativePlatform() || listenersRegistered) return
  listenersRegistered = true

  void import('@capacitor/app').then(({ App }) => {
    App.addListener('appUrlOpen', ({ url }) => {
      if (url) handleIncomingUrl(url)
    }).catch(() => {})
  })

  // Any anchor with target="_blank" or an http(s) URL to a different origin
  // would otherwise spawn the system browser — kicking the user out of the
  // native shell. Intercept at capture phase and route through the in-app
  // browser instead (which `openExternalUrl` already handles).
  if (typeof document !== 'undefined') {
    document.addEventListener(
      'click',
      (event) => {
        const ev = event as MouseEvent
        if (ev.defaultPrevented || ev.button !== 0) return
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return
        const target = ev.target as Element | null
        const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
        if (!anchor) return
        const href = anchor.getAttribute('href') ?? ''
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return
        // mailto: / tel: — let the OS handle natively.
        if (/^(mailto:|tel:|sms:)/i.test(href)) return
        let u: URL
        try {
          u = new URL(href, window.location.href)
        } catch {
          return
        }
        const hosts = collectAppHosts()
        const external = !isOurAppUrl(u, hosts)
        const blank = anchor.target === '_blank'
        if (!external && !blank) return
        ev.preventDefault()
        openExternalUrl(u.href)
      },
      true,
    )
  }
}
