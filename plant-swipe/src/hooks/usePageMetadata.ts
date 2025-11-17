import { useEffect } from 'react'

type PageMetadataOptions = {
  title?: string | null
  description?: string | null
  path?: string | null
  image?: string | null
  type?: 'website' | 'article' | 'profile' | 'product'
  structuredData?: Record<string, any> | null
}

const SITE_NAME = (import.meta.env.VITE_SITE_NAME || 'Aphylia').trim()
const RAW_BASE_URL = (import.meta.env.VITE_SITE_URL || '').trim().replace(/\/+$/, '')
const DEFAULT_DESCRIPTION = 'Discover, document, and care for meaningful plants with Aphylia.'
const DEFAULT_SOCIAL_IMAGE = (import.meta.env.VITE_SOCIAL_IMAGE || '/icons/plant-swipe-icon.svg') as string
const JSON_LD_ELEMENT_ID = 'page-schema'

export function usePageMetadata(options: PageMetadataOptions) {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const title = buildTitle(options.title)
    const description = buildDescription(options.description)
    const canonicalUrl = buildCanonicalUrl(options.path)
    const ogImage = buildAbsoluteUrl(options.image) || buildAbsoluteUrl(DEFAULT_SOCIAL_IMAGE)
    const pageType = options.type || 'website'

    document.title = title
    upsertMeta({ name: 'description', content: description })
    upsertMeta({ name: 'name', content: title })
    upsertMeta({ name: 'twitter:title', content: title })
    upsertMeta({ name: 'twitter:description', content: description })
    upsertMeta({ name: 'twitter:card', content: ogImage ? 'summary_large_image' : 'summary' })

    upsertMeta({ property: 'og:title', content: title })
    upsertMeta({ property: 'og:description', content: description })
    upsertMeta({ property: 'og:site_name', content: SITE_NAME })
    upsertMeta({ property: 'og:type', content: pageType })
    upsertMeta({ property: 'og:url', content: canonicalUrl })
    if (ogImage) {
      upsertMeta({ property: 'og:image', content: ogImage })
    }

    upsertMeta({ itemprop: 'name', content: title })
    upsertMeta({ itemprop: 'description', content: description })

    upsertLink({ rel: 'canonical', href: canonicalUrl })

    const jsonLdPayload = options.structuredData ?? buildDefaultJsonLd({ title, description, canonicalUrl, pageType, image: ogImage })
    upsertJsonLd(jsonLdPayload)
  }, [options.title, options.description, options.path, options.image, options.type, options.structuredData])
}

function buildTitle(raw?: string | null) {
  const trimmed = (raw || '').trim()
  if (!trimmed) return SITE_NAME
  const normalized = trimmed.toLowerCase()
  if (normalized.includes(SITE_NAME.toLowerCase())) {
    return trimmed
  }
  return `${trimmed} • ${SITE_NAME}`
}

function buildDescription(raw?: string | null) {
  const trimmed = (raw || '').trim()
  return trimmed || DEFAULT_DESCRIPTION
}

function buildCanonicalUrl(path?: string | null) {
  const safePath = sanitizePath(path)
  if (RAW_BASE_URL) {
    if (safePath === '/' || !safePath) return `${RAW_BASE_URL}/`
    return `${RAW_BASE_URL}${safePath.startsWith('/') ? safePath : `/${safePath}`}`
  }
  if (typeof window !== 'undefined' && window.location) {
    if (safePath) return `${window.location.origin}${safePath.startsWith('/') ? safePath : `/${safePath}`}`
    return window.location.href
  }
  return safePath || '/'
}

function buildAbsoluteUrl(path?: string | null) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const sanitized = sanitizePath(path)
  if (RAW_BASE_URL) {
    return `${RAW_BASE_URL}${sanitized.startsWith('/') ? sanitized : `/${sanitized}`}`
  }
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}${sanitized.startsWith('/') ? sanitized : `/${sanitized}`}`
  }
  return sanitized
}

function sanitizePath(path?: string | null) {
  if (!path) {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.pathname || '/'
    }
    return '/'
  }
  if (path === '/') return '/'
  return path.startsWith('/') ? path : `/${path}`
}

type MetaDefinition = {
  name?: string
  property?: string
  itemprop?: string
  content: string
}

function upsertMeta(def: MetaDefinition) {
  if (!def.content) return
  const selector = def.name ? `meta[name="${def.name}"]`
    : def.property ? `meta[property="${def.property}"]`
      : def.itemprop ? `meta[itemprop="${def.itemprop}"]`
        : null
  const head = document.head || document.getElementsByTagName('head')[0]
  if (!head || !selector) return
  let element = head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    if (def.name) element.setAttribute('name', def.name)
    if (def.property) element.setAttribute('property', def.property)
    if (def.itemprop) element.setAttribute('itemprop', def.itemprop)
    head.appendChild(element)
  }
  element.setAttribute('content', def.content)
}

function upsertLink(def: { rel: string; href: string }) {
  if (!def.rel || !def.href) return
  const head = document.head || document.getElementsByTagName('head')[0]
  if (!head) return
  let element = head.querySelector<HTMLLinkElement>(`link[rel="${def.rel}"]`)
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', def.rel)
    head.appendChild(element)
  }
  element.setAttribute('href', def.href)
}

function upsertJsonLd(payload: Record<string, any> | null) {
  const head = document.head || document.getElementsByTagName('head')[0]
  if (!head) return
  let element = head.querySelector<HTMLScriptElement>(`#${JSON_LD_ELEMENT_ID}`)
  if (!payload) {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element)
    }
    return
  }
  const serialized = JSON.stringify(payload)
  if (!element) {
    element = document.createElement('script')
    element.type = 'application/ld+json'
    element.id = JSON_LD_ELEMENT_ID
    head.appendChild(element)
  }
  if (element.textContent !== serialized) {
    element.textContent = serialized
  }
}

function buildDefaultJsonLd(opts: { title: string; description: string; canonicalUrl: string; pageType: string; image?: string }) {
  const docLang = typeof document !== 'undefined' ? document.documentElement.lang || 'en' : 'en'
  const payload: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': opts.pageType === 'article' ? 'Article' : opts.pageType === 'profile' ? 'ProfilePage' : 'WebPage',
    name: opts.title,
    description: opts.description,
    url: opts.canonicalUrl,
    inLanguage: docLang,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: RAW_BASE_URL || opts.canonicalUrl,
    },
  }
  if (opts.image) {
    payload.image = opts.image
  }
  return payload
}
