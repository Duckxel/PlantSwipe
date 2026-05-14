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

// ---- Plant FAQ -----------------------------------------------------------------
// Generates FAQPage JSON-LD from structured plant care data. Only questions with
// meaningful data are included; returns null when fewer than 2 Q&As can be built
// (Google requires at least 2 for the rich-result to be eligible).

export type PlantFaqInput = {
  name: string
  sunlight?: string[] | null
  wateringFrequencyWarm?: number | null
  wateringFrequencyCold?: number | null
  temperatureMin?: number | null
  temperatureMax?: number | null
  temperatureIdeal?: number | null
  careLevel?: string[] | null
  toxicityHuman?: string | null
  toxicityPets?: string | null
  livingSpace?: string[] | null
  pests?: string[] | null
  diseases?: string[] | null
}

const SUNLIGHT_LABELS: Record<string, string> = {
  full_sun: 'full sun (6 or more hours of direct sunlight per day)',
  partial_sun: 'partial sun (3–6 hours of direct sunlight per day)',
  partial_shade: 'partial shade (2–4 hours of direct sunlight)',
  light_shade: 'light shade with bright ambient light',
  deep_shade: 'deep shade — tolerates very low light',
  direct_light: 'direct sunlight',
  bright_indirect_light: 'bright indirect light, away from direct sun',
  medium_light: 'medium indirect light',
  low_light: 'low light — tolerates limited natural light',
}

const TOXICITY_LABELS: Record<string, string> = {
  non_toxic: 'non-toxic',
  slightly_toxic: 'slightly toxic (mild irritant)',
  very_toxic: 'toxic',
  deadly: 'highly toxic',
  undetermined: 'of undetermined toxicity',
}

const LIVING_SPACE_LABELS: Record<string, string> = {
  indoor: 'indoors',
  outdoor: 'outdoors',
  terrarium: 'in a terrarium',
  greenhouse: 'in a greenhouse',
}

function toCelsiusFahrenheit(c: number): string {
  return `${c}°C (${Math.round(c * 9 / 5 + 32)}°F)`
}

export function plantFaqSchema(input: PlantFaqInput): Record<string, unknown> | null {
  const faqs: FaqEntry[] = []
  const n = input.name

  if (input.sunlight?.length) {
    const labels = input.sunlight.map(s => SUNLIGHT_LABELS[s] ?? s).join(' or ')
    faqs.push({
      question: `How much light does ${n} need?`,
      answer: `${n} thrives in ${labels}. Position it accordingly to support healthy growth throughout the year.`,
    })
  }

  if (input.wateringFrequencyWarm || input.wateringFrequencyCold) {
    const warm = input.wateringFrequencyWarm
    const cold = input.wateringFrequencyCold
    let answer: string
    if (warm && cold) {
      answer = `Water ${n} about ${warm} time${warm !== 1 ? 's' : ''} per week during warm periods and ${cold} time${cold !== 1 ? 's' : ''} per week during cooler months. Always let the topsoil dry slightly between waterings to avoid root rot.`
    } else if (warm) {
      answer = `Water ${n} approximately ${warm} time${warm !== 1 ? 's' : ''} per week in the growing season. Reduce frequency significantly in winter when growth slows.`
    } else {
      answer = `During cooler periods, water ${n} about ${cold} time${cold! !== 1 ? 's' : ''} per week. Increase frequency in summer when temperatures rise and evaporation is faster.`
    }
    faqs.push({ question: `How often should I water ${n}?`, answer })
  }

  if (input.temperatureMin != null || input.temperatureMax != null || input.temperatureIdeal != null) {
    const parts: string[] = []
    if (input.temperatureIdeal != null) parts.push(`an ideal temperature around ${toCelsiusFahrenheit(input.temperatureIdeal)}`)
    if (input.temperatureMin != null && input.temperatureMax != null) {
      parts.push(`tolerating a range of ${toCelsiusFahrenheit(input.temperatureMin)} to ${toCelsiusFahrenheit(input.temperatureMax)}`)
    } else if (input.temperatureMin != null) {
      parts.push(`a minimum of ${toCelsiusFahrenheit(input.temperatureMin)}`)
    } else if (input.temperatureMax != null) {
      parts.push(`a maximum of ${toCelsiusFahrenheit(input.temperatureMax)}`)
    }
    faqs.push({
      question: `What temperature does ${n} prefer?`,
      answer: `${n} prefers ${parts.join(', ')}. Protect it from frost and prolonged heat waves for best results.`,
    })
  }

  if (input.careLevel?.length) {
    const level = input.careLevel[0]
    let answer: string
    if (level === 'easy') {
      answer = `${n} is easy to care for and a great choice for beginners. It tolerates occasional missed waterings and adapts well to typical home conditions.`
    } else if (level === 'moderate') {
      answer = `${n} has moderate care requirements. Regular attention to watering, light, and seasonal fertilizing will keep it thriving.`
    } else if (level === 'complex') {
      answer = `${n} requires advanced care. Close attention to humidity, precise watering, and suitable light conditions is essential for healthy growth.`
    } else {
      answer = `${n} has a care level rated as "${level}".`
    }
    faqs.push({ question: `Is ${n} easy to care for?`, answer })
  }

  if (input.toxicityHuman || input.toxicityPets) {
    const humanLabel = input.toxicityHuman ? (TOXICITY_LABELS[input.toxicityHuman] ?? input.toxicityHuman) : null
    const petLabel = input.toxicityPets ? (TOXICITY_LABELS[input.toxicityPets] ?? input.toxicityPets) : null
    let answer = ''
    if (humanLabel && petLabel) {
      answer = `${n} is considered ${humanLabel} to humans and ${petLabel} to pets. `
    } else if (humanLabel) {
      answer = `${n} is considered ${humanLabel} to humans. `
    } else if (petLabel) {
      answer = `${n} is considered ${petLabel} to pets. `
    }
    const isToxic = [input.toxicityHuman, input.toxicityPets].some(v => v && v !== 'non_toxic' && v !== 'undetermined')
    answer += isToxic
      ? 'Keep it out of reach of children and animals, and wash hands after handling.'
      : 'It is generally considered safe around the home.'
    faqs.push({ question: `Is ${n} safe for humans and pets?`, answer })
  }

  if (input.livingSpace?.length) {
    const canIndoor = input.livingSpace.includes('indoor')
    const canOutdoor = input.livingSpace.includes('outdoor')
    let answer: string
    if (canIndoor && canOutdoor) {
      answer = `${n} grows well both indoors and outdoors. As a houseplant it benefits from a bright window; outside, choose a spot that matches its sunlight needs.`
    } else if (canIndoor) {
      answer = `${n} is well suited to indoor cultivation. Place it near a bright window and ensure adequate air circulation for healthy foliage.`
    } else if (canOutdoor) {
      answer = `${n} is best grown outdoors. In cold climates, keep it in a container so you can bring it inside before the first frost.`
    } else {
      answer = `${n} grows best ${input.livingSpace.map(s => LIVING_SPACE_LABELS[s] ?? s).join(' or ')}.`
    }
    faqs.push({ question: `Can ${n} be grown indoors?`, answer })
  }

  const hasPests = (input.pests?.length ?? 0) > 0
  const hasDiseases = (input.diseases?.length ?? 0) > 0
  if (hasPests || hasDiseases) {
    let answer = `${n} can be affected by `
    if (hasPests && hasDiseases) {
      answer += `pests such as ${input.pests!.join(', ')}, and diseases including ${input.diseases!.join(', ')}.`
    } else if (hasPests) {
      answer += `common pests including ${input.pests!.join(', ')}.`
    } else {
      answer += `diseases such as ${input.diseases!.join(', ')}.`
    }
    answer += ' Inspect plants regularly and treat early to prevent spread.'
    faqs.push({ question: `What pests or diseases commonly affect ${n}?`, answer })
  }

  if (faqs.length < 2) return null
  return faqSchema(faqs)
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
