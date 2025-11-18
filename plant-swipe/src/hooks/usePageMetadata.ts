import React from 'react'
import {
  SEO_DEFAULT_DESCRIPTION,
  SEO_DEFAULT_TITLE,
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

type Snapshot = {
  element: HTMLMetaElement
  previousContent: string | null
  created: boolean
}

export type PageMetadata = {
  title?: string | null
  description?: string | null
}

export function usePageMetadata({ title, description }: PageMetadata) {
  React.useEffect(() => {
    if (typeof document === 'undefined') return

    const resolvedTitle = normalizeTitle(title)
    const resolvedDescription = normalizeDescription(description)
    const previousTitle = document.title
    const snapshots = new Map<string, Snapshot>()

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
    }
  }, [title, description])
}
