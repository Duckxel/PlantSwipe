/**
 * Schema.org JSON-LD helpers.
 *
 * Pure functions that return plain objects ready to hand to usePageMetadata's
 * jsonLd option. Validate any new shape with https://search.google.com/test/rich-results
 * before relying on it. The static blocks emitted from index.html (SoftwareApplication,
 * Organization, WebSite+SearchAction) are intentionally duplicated here so callers can
 * include them on routes that need to be self-describing for crawlers that don't render JS.
 */

import { SEO_DEFAULT_IMAGE, SEO_DEFAULT_URL } from '@/constants/seo'

const SITE_URL = SEO_DEFAULT_URL.replace(/\/+$/, '')

const APHYLIA_SAME_AS = [
  'https://www.instagram.com/aphylia_app/',
  'https://x.com/aphylia_app',
  'https://www.youtube.com/@aphylia_app',
  'https://discord.gg/SRt74hDESC',
] as const

function absoluteUrl(input: string): string {
  if (!input) return SITE_URL
  if (input.startsWith('http://') || input.startsWith('https://')) return input
  if (input.startsWith('/')) return `${SITE_URL}${input}`
  return `${SITE_URL}/${input}`
}

function isoDate(input: string | null | undefined): string | undefined {
  if (!input) return undefined
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

// ---- Shared / site-wide --------------------------------------------------------

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Aphylia',
    url: SITE_URL,
    logo: `${SITE_URL}/icons/icon-512x512.png`,
    email: 'support@aphylia.app',
    sameAs: [...APHYLIA_SAME_AS],
  }
}

export function softwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Aphylia',
    url: SITE_URL,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web, iOS, Android',
    description:
      'Aphylia is the plant care app that tracks every plant in your garden, sends smart watering reminders, and identifies species in seconds.',
    image: SEO_DEFAULT_IMAGE,
    screenshot: SEO_DEFAULT_IMAGE,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  }
}

export function webSiteSearchActionSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Aphylia',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
}

// ---- Breadcrumbs ---------------------------------------------------------------

export type BreadcrumbCrumb = { name: string; url: string }

export function breadcrumbSchema(crumbs: BreadcrumbCrumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.url),
    })),
  }
}

// ---- Articles ------------------------------------------------------------------

export type ArticleSchemaInput = {
  headline: string
  description?: string | null
  url: string
  image?: string | null
  datePublished?: string | null
  dateModified?: string | null
  authorName?: string | null
  inLanguage?: string
  /** Use 'BlogPosting' for blog posts, 'Article' for plant care guides. */
  articleType?: 'Article' | 'BlogPosting'
}

export function articleSchema(input: ArticleSchemaInput) {
  const out: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': input.articleType ?? 'Article',
    headline: input.headline,
    url: absoluteUrl(input.url),
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(input.url) },
    publisher: {
      '@type': 'Organization',
      name: 'Aphylia',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/icon-512x512.png` },
    },
  }
  if (input.description) out.description = input.description
  if (input.image) out.image = absoluteUrl(input.image)
  const published = isoDate(input.datePublished)
  if (published) out.datePublished = published
  const modified = isoDate(input.dateModified) || published
  if (modified) out.dateModified = modified
  if (input.authorName) {
    out.author = { '@type': 'Person', name: input.authorName }
  }
  if (input.inLanguage) out.inLanguage = input.inLanguage
  return out
}

/**
 * Plant encyclopedia entries are care guides — Article, NOT Product. The audit's
 * 9 invalid Product snippets in GSC come from misapplying Product schema here.
 */
export type PlantSchemaInput = {
  id: string
  name: string
  scientificName?: string | null
  description?: string | null
  imageUrl?: string | null
  updatedAt?: string | null
  createdAt?: string | null
  language: 'en' | 'fr'
}

export function articleSchemaForPlant(input: PlantSchemaInput) {
  const path = input.language === 'fr' ? `/fr/plants/${input.id}` : `/plants/${input.id}`
  const headline = input.scientificName
    ? `${input.name} (${input.scientificName}): care guide`
    : `${input.name}: care guide`
  return articleSchema({
    headline,
    description: input.description ?? undefined,
    url: path,
    image: input.imageUrl ?? undefined,
    datePublished: input.createdAt ?? undefined,
    dateModified: input.updatedAt ?? input.createdAt ?? undefined,
    authorName: 'Aphylia',
    inLanguage: input.language,
    articleType: 'Article',
  })
}

export type BlogPostSchemaInput = {
  slug: string
  title: string
  excerpt?: string | null
  coverImageUrl?: string | null
  publishedAt?: string | null
  updatedAt?: string | null
  authorName?: string | null
  language: 'en' | 'fr'
}

export function articleSchemaForBlogPost(input: BlogPostSchemaInput) {
  const path = input.language === 'fr' ? `/fr/blog/${input.slug}` : `/blog/${input.slug}`
  return articleSchema({
    headline: input.title,
    description: input.excerpt ?? undefined,
    url: path,
    image: input.coverImageUrl ?? undefined,
    datePublished: input.publishedAt ?? undefined,
    dateModified: input.updatedAt ?? input.publishedAt ?? undefined,
    authorName: input.authorName ?? 'Aphylia',
    inLanguage: input.language,
    articleType: 'BlogPosting',
  })
}

// ---- Lists & FAQ ---------------------------------------------------------------

export type ItemListEntry = { name: string; url: string }

export function itemListSchema(items: ItemListEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: absoluteUrl(item.url),
    })),
  }
}

export type FaqEntry = { question: string; answer: string }

export function faqSchema(faqs: FaqEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }
}

// ---- Pricing -------------------------------------------------------------------

/**
 * Pricing is the one place where Product schema *is* the right fit — Aphylia Premium
 * is a real subscription with offers. Adjust the prices below to match the live
 * pricing page when it changes.
 */
export type PricingTier = { name: string; price: string; priceCurrency: string; description?: string; url?: string }

export function productOfferSchemaForPricing(tiers: PricingTier[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Aphylia',
    description: 'Plant care companion with smart reminders, plant identification, and a personal garden journal.',
    image: SEO_DEFAULT_IMAGE,
    brand: { '@type': 'Brand', name: 'Aphylia' },
    offers: tiers.map((tier) => ({
      '@type': 'Offer',
      name: tier.name,
      price: tier.price,
      priceCurrency: tier.priceCurrency,
      ...(tier.description ? { description: tier.description } : {}),
      ...(tier.url ? { url: absoluteUrl(tier.url) } : {}),
      availability: 'https://schema.org/InStock',
    })),
  }
}
