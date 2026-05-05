import React from 'react'
import {
  SEO_DEFAULT_DESCRIPTION,
  SEO_DEFAULT_TITLE,
  SEO_DEFAULT_IMAGE,
  SEO_DEFAULT_URL,
  SEO_MAX_DESCRIPTION_LENGTH,
  SEO_TITLE_SEPARATOR,
} from '@/constants/seo'

type MetaTarget = {
  attr: 'name' | 'property'
  key: string
}

const DESCRIPTION_TARGETS: MetaTarget[] = [
  { attr: 'name', key: 'description' },
  { attr: 'property', key: 'og:description' },
  { attr: 'name', key: 'twitter:description' },
]

const TITLE_TARGETS: MetaTarget[] = [
  { attr: 'property', key: 'og:title' },
  { attr: 'name', key: 'twitter:title' },
]

const IMAGE_TARGETS: MetaTarget[] = [
  { attr: 'property', key: 'og:image' },
  { attr: 'name', key: 'twitter:image' },
]

const URL_TARGETS: MetaTarget[] = [
  { attr: 'property', key: 'og:url' },
  { attr: 'name', key: 'twitter:url' },
]

const TYPE_TARGETS: MetaTarget[] = [
  { attr: 'property', key: 'og:type' },
]

const ROBOTS_TARGET: MetaTarget = { attr: 'name', key: 'robots' }

const JSON_LD_MARKER_ATTR = 'data-aphylia-jsonld'

/**
 * Compute the canonical URL for the current page
 * This removes language prefixes if they exist (e.g., /fr/plants/123 -> /plants/123)
 * to ensure a single canonical URL regardless of language
 */
const computeCanonicalUrl = (url?: string | null): string => {
  if (!url) {
    // Use current path from window.location
    if (typeof window === 'undefined') return SEO_DEFAULT_URL
    const path = window.location.pathname
    return normalizeCanonicalPath(path)
  }
  
  // If it's a full URL, extract the path
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url)
      return normalizeCanonicalPath(parsed.pathname)
    } catch {
      return SEO_DEFAULT_URL
    }
  }
  
  // It's a path
  return normalizeCanonicalPath(url)
}

/**
 * Normalize a path to create a canonical URL:
 * - Remove language prefix (/en/, /fr/) to get the base path
 * - Ensure proper trailing slash handling
 * - Prepend the site URL
 */
const normalizeCanonicalPath = (path: string): string => {
  let normalizedPath = path
  
  // Remove language prefixes (e.g., /en, /fr, /de)
  // Match 2-letter language codes at the start of the path
  const langPrefixMatch = normalizedPath.match(/^\/([a-z]{2})(\/|$)/)
  if (langPrefixMatch) {
    normalizedPath = normalizedPath.slice(langPrefixMatch[0].length - 1) || '/'
  }
  
  // Ensure path starts with /
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath
  }
  
  // Remove trailing slash for non-root paths
  if (normalizedPath !== '/' && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1)
  }
  
  // Remove query parameters and hash for canonical
  const queryIndex = normalizedPath.indexOf('?')
  if (queryIndex !== -1) {
    normalizedPath = normalizedPath.slice(0, queryIndex)
  }
  const hashIndex = normalizedPath.indexOf('#')
  if (hashIndex !== -1) {
    normalizedPath = normalizedPath.slice(0, hashIndex)
  }
  
  return `${SEO_DEFAULT_URL}${normalizedPath}`
}

const collapseWhitespace = (value?: string | null) => {
  if (!value) return ''
  return value.replace(/\s+/g, ' ').trim()
}

const normalizeDescription = (value?: string | null) => {
  const collapsed = collapseWhitespace(value)
  if (!collapsed) return SEO_DEFAULT_DESCRIPTION
  if (collapsed.length <= SEO_MAX_DESCRIPTION_LENGTH) return collapsed
  return `${collapsed.slice(0, SEO_MAX_DESCRIPTION_LENGTH - 1).trim()}…`
}

const normalizeTitle = (value?: string | null) => {
  const trimmed = collapseWhitespace(value)
  if (!trimmed) return SEO_DEFAULT_TITLE
  if (trimmed.includes(SEO_DEFAULT_TITLE)) return trimmed
  return `${trimmed}${SEO_TITLE_SEPARATOR}${SEO_DEFAULT_TITLE}`
}

const normalizeImage = (value?: string | null) => {
  if (!value) return SEO_DEFAULT_IMAGE
  // Ensure the image URL is absolute
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('//')) return `https:${value}`
  if (value.startsWith('/')) return `${SEO_DEFAULT_URL}${value}`
  return `${SEO_DEFAULT_URL}/${value}`
}

const normalizeUrl = (value?: string | null) => {
  if (!value) return SEO_DEFAULT_URL
  // Ensure the URL is absolute
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('/')) return `${SEO_DEFAULT_URL}${value}`
  return `${SEO_DEFAULT_URL}/${value}`
}

const ensureMetaElement = (target: MetaTarget) => {
  if (typeof document === 'undefined') {
    return { element: null as HTMLMetaElement | null, created: false }
  }
  const selector = `meta[${target.attr}="${target.key}"]`
  let element = document.head?.querySelector(selector) as HTMLMetaElement | null
  let created = false
  if (!element && document.head) {
    element = document.createElement('meta')
    element.setAttribute(target.attr, target.key)
    document.head.appendChild(element)
    created = true
  }
  return { element, created }
}

const setMetaContent = (element: HTMLMetaElement | null, content: string) => {
  if (!element) return
  if (element.getAttribute('content') === content) return
  element.setAttribute('content', content)
}

/**
 * Ensure a canonical link element exists in the document head
 * Returns the element and whether it was created
 */
const ensureCanonicalLink = () => {
  if (typeof document === 'undefined') {
    return { element: null as HTMLLinkElement | null, created: false }
  }
  const selector = 'link[rel="canonical"]'
  let element = document.head?.querySelector(selector) as HTMLLinkElement | null
  let created = false
  if (!element && document.head) {
    element = document.createElement('link')
    element.setAttribute('rel', 'canonical')
    document.head.appendChild(element)
    created = true
  }
  return { element, created }
}

const setCanonicalHref = (element: HTMLLinkElement | null, href: string) => {
  if (!element) return
  if (element.getAttribute('href') === href) return
  element.setAttribute('href', href)
}

/**
 * Manage hreflang alternate link elements in the document head.
 * Returns created elements so they can be cleaned up on unmount.
 */
const SUPPORTED_HREFLANG = ['en', 'fr'] as const
const setHreflangLinks = (canonicalUrl: string): HTMLLinkElement[] => {
  if (typeof document === 'undefined') return []
  const siteUrl = SEO_DEFAULT_URL.replace(/\/+$/, '')
  // Extract the path from the canonical URL
  const path = canonicalUrl.startsWith(siteUrl)
    ? canonicalUrl.slice(siteUrl.length) || '/'
    : '/'

  const created: HTMLLinkElement[] = []
  for (const lang of SUPPORTED_HREFLANG) {
    const href = lang === 'en' ? `${siteUrl}${path}` : `${siteUrl}/${lang}${path}`
    const selector = `link[rel="alternate"][hreflang="${lang}"]`
    let el = document.head?.querySelector(selector) as HTMLLinkElement | null
    if (!el && document.head) {
      el = document.createElement('link')
      el.setAttribute('rel', 'alternate')
      el.setAttribute('hreflang', lang)
      document.head.appendChild(el)
      created.push(el)
    }
    if (el) el.setAttribute('href', href)
  }
  // x-default
  const xSelector = 'link[rel="alternate"][hreflang="x-default"]'
  let xEl = document.head?.querySelector(xSelector) as HTMLLinkElement | null
  if (!xEl && document.head) {
    xEl = document.createElement('link')
    xEl.setAttribute('rel', 'alternate')
    xEl.setAttribute('hreflang', 'x-default')
    document.head.appendChild(xEl)
    created.push(xEl)
  }
  if (xEl) xEl.setAttribute('href', canonicalUrl)

  return created
}

type Snapshot = {
  element: HTMLMetaElement
  previousContent: string | null
  created: boolean
}

type CanonicalSnapshot = {
  element: HTMLLinkElement
  previousHref: string | null
  created: boolean
}

export type OgType = 'website' | 'article' | 'profile' | 'product'
export type RobotsDirective = 'index,follow' | 'noindex,follow' | 'noindex,nofollow' | 'index,nofollow'

export type PageMetadata = {
  title?: string | null
  description?: string | null
  image?: string | null
  url?: string | null
  /**
   * Override canonical URL. If not provided, it's computed automatically
   * by removing the language prefix from the current URL.
   */
  canonicalUrl?: string | null
  /**
   * If true, skip setting canonical URL (useful for error pages)
   */
  noCanonical?: boolean
  /**
   * Schema.org JSON-LD. Pass a single object or array of objects; each becomes
   * its own <script type="application/ld+json"> tag. Tagged with data-aphylia-jsonld
   * so cleanup removes only what we added (the static blocks in index.html survive).
   */
  jsonLd?: object | object[] | null
  /**
   * <meta name="robots"> content. Default behaviour is whatever index.html declares
   * (no per-page robots tag) — pass 'noindex,follow' to deindex a route while still
   * letting Google follow its links.
   */
  robots?: RobotsDirective
  /**
   * og:type override. Defaults to whatever index.html ships with ("website").
   * Use 'article' for blog posts and plant pages, 'profile' for /u/:username.
   */
  type?: OgType
}

export function usePageMetadata({ title, description, image, url, canonicalUrl, noCanonical, jsonLd, robots, type }: PageMetadata) {
  // Stable JSON-LD dependency: stringify once so changing object identity
  // (without changing content) doesn't churn the effect.
  const jsonLdKey = React.useMemo(() => {
    if (!jsonLd) return ''
    try {
      return JSON.stringify(jsonLd)
    } catch {
      return ''
    }
  }, [jsonLd])

  React.useEffect(() => {
    if (typeof document === 'undefined') return

    const resolvedTitle = normalizeTitle(title)
    const resolvedDescription = normalizeDescription(description)
    const resolvedImage = normalizeImage(image)
    const resolvedUrl = normalizeUrl(url)
    const resolvedCanonical = noCanonical ? null : computeCanonicalUrl(canonicalUrl || url)
    const previousTitle = document.title
    const snapshots = new Map<string, Snapshot>()
    let canonicalSnapshot: CanonicalSnapshot | null = null

    const applyTarget = (target: MetaTarget, content: string) => {
      const id = `${target.attr}:${target.key}`
      if (!snapshots.has(id)) {
        const { element, created } = ensureMetaElement(target)
        if (element) {
          snapshots.set(id, {
            element,
            previousContent: element.getAttribute('content'),
            created,
          })
        }
        setMetaContent(element, content)
      } else {
        setMetaContent(snapshots.get(id)!.element, content)
      }
    }

    document.title = resolvedTitle
    TITLE_TARGETS.forEach((target) => applyTarget(target, resolvedTitle))
    DESCRIPTION_TARGETS.forEach((target) => applyTarget(target, resolvedDescription))
    IMAGE_TARGETS.forEach((target) => applyTarget(target, resolvedImage))
    URL_TARGETS.forEach((target) => applyTarget(target, resolvedUrl))

    // og:type override (only when caller specified one — otherwise leave the static
    // 'website' value from index.html so it isn't repeatedly snapshot/restored).
    if (type) {
      TYPE_TARGETS.forEach((target) => applyTarget(target, type))
    }

    // <meta name="robots"> directive (only when caller specified one).
    if (robots) {
      applyTarget(ROBOTS_TARGET, robots)
    }

    // Schema.org JSON-LD. Each block becomes its own script tag, marked so cleanup
    // removes only what we added (the static SoftwareApplication / Organization /
    // WebSite blocks in index.html have no marker and survive). We re-parse from
    // jsonLdKey so the effect's only JSON-LD dependency is the stringified key.
    const jsonLdElements: HTMLScriptElement[] = []
    if (jsonLdKey) {
      try {
        const parsed = JSON.parse(jsonLdKey) as unknown
        const blocks = Array.isArray(parsed) ? parsed : [parsed]
        for (const block of blocks) {
          if (!block || typeof block !== 'object') continue
          const script = document.createElement('script')
          script.type = 'application/ld+json'
          script.setAttribute(JSON_LD_MARKER_ATTR, '1')
          script.textContent = JSON.stringify(block)
          document.head.appendChild(script)
          jsonLdElements.push(script)
        }
      } catch {
        // Bad JSON in caller — drop it rather than crash the page.
      }
    }

    // Set canonical URL and hreflang alternate links
    let hreflangElements: HTMLLinkElement[] = []
    if (resolvedCanonical) {
      const { element, created } = ensureCanonicalLink()
      if (element) {
        canonicalSnapshot = {
          element,
          previousHref: element.getAttribute('href'),
          created,
        }
        setCanonicalHref(element, resolvedCanonical)
      }
      hreflangElements = setHreflangLinks(resolvedCanonical)
    }

    return () => {
      document.title = previousTitle
      snapshots.forEach(({ element, previousContent, created }) => {
        if (previousContent == null) {
          if (created) {
            element.remove()
          } else {
            element.removeAttribute('content')
          }
        } else {
          element.setAttribute('content', previousContent)
        }
      })
      // Restore canonical link
      if (canonicalSnapshot) {
        const { element, previousHref, created } = canonicalSnapshot
        if (previousHref == null) {
          if (created) {
            element.remove()
          } else {
            element.removeAttribute('href')
          }
        } else {
          element.setAttribute('href', previousHref)
        }
      }
      // Remove hreflang links we created
      hreflangElements.forEach(el => el.remove())
      // Remove JSON-LD scripts we added (static blocks in index.html stay)
      jsonLdElements.forEach(el => el.remove())
    }
  }, [title, description, image, url, canonicalUrl, noCanonical, jsonLdKey, robots, type])
}
