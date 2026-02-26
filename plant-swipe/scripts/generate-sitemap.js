#!/usr/bin/env node

import path from 'node:path'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const appRoot = path.resolve(__dirname, '..')

// Load env files before accessing Sentry DSN
loadEnvFiles(appRoot)

// Sentry error monitoring for sitemap generation
const SENTRY_DSN = process.env.SENTRY_DSN

// Server identification: Set PLANTSWIPE_SERVER_NAME to 'DEV' or 'MAIN' on each server
const SERVER_NAME = process.env.PLANTSWIPE_SERVER_NAME || process.env.SERVER_NAME || 'unknown'

let Sentry = null
try {
  // Try to import Sentry (may not be available in all environments)
  const sentryModule = await import('@sentry/node').catch(() => null)
  if (sentryModule && SENTRY_DSN) {
    Sentry = sentryModule
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      // Server identification
      serverName: SERVER_NAME,
      // Send structured logs to Sentry
      _experiments: {
        enableLogs: true,
      },
      // Tracing - capture 100% of transactions
      tracesSampleRate: 1.0,
      // Add server tag to all events
      initialScope: {
        tags: {
          server: SERVER_NAME,
          app: 'plant-swipe-sitemap',
        },
      },
    })
    console.log(`[sitemap] Sentry initialized for server: ${SERVER_NAME}`)
  }
} catch {
  // Sentry not available, continue without it
  console.log('[sitemap] Sentry not available, continuing without error tracking')
}

const startedAt = Date.now()

const publicDir = path.join(appRoot, 'public')
const sitemapPath = path.join(publicDir, 'sitemap.xml')

const shouldSkip = parseBoolean(process.env.SKIP_SITEMAP_GENERATION)
if (shouldSkip) {
  console.log('[sitemap] SKIP_SITEMAP_GENERATION is set — skipping sitemap generation.')
  process.exit(0)
}

const defaultSiteUrl = 'https://aphylia.app'
const rawSiteUrl = (process.env.PLANTSWIPE_SITE_URL || process.env.SITE_URL || process.env.VITE_SITE_URL || defaultSiteUrl).trim()

let siteUrlBase
try {
  const parsed = new URL(rawSiteUrl)
  const normalizedPath = parsed.pathname.replace(/\/+$/, '')
  siteUrlBase = `${parsed.origin}${normalizedPath}`
} catch (error) {
  console.error(`[sitemap] Invalid PLANTSWIPE_SITE_URL "${rawSiteUrl}". Provide a fully-qualified URL such as https://aphylia.app.`)
  process.exit(1)
}
const siteUrlWithSlash = siteUrlBase.endsWith('/') ? siteUrlBase : `${siteUrlBase}/`

const basePath = normalizeBasePath(process.env.VITE_APP_BASE_PATH)
const defaultLanguage = (process.env.SITEMAP_DEFAULT_LANGUAGE || 'en').trim() || 'en'

const STATIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/discovery', changefreq: 'daily', priority: 0.9 },
  { path: '/blog', changefreq: 'daily', priority: 0.9 },
  { path: '/search', changefreq: 'daily', priority: 0.9 },
  { path: '/gardens', changefreq: 'weekly', priority: 0.8 },
  { path: '/contact', changefreq: 'monthly', priority: 0.8 },
  { path: '/pricing', changefreq: 'monthly', priority: 0.8 },
  { path: '/download', changefreq: 'monthly', priority: 0.7 },
  { path: '/about', changefreq: 'monthly', priority: 0.6 },
  { path: '/contact/business', changefreq: 'monthly', priority: 0.6 },
  { path: '/terms', changefreq: 'yearly', priority: 0.4 },
]

async function main() {
  await fs.mkdir(publicDir, { recursive: true })

  const languages = await detectLanguages(path.join(publicDir, 'locales'), defaultLanguage)

  const dynamicRoutes = await loadPlantRoutes().catch((error) => {
    console.warn(`[sitemap] Failed to load dynamic plant routes: ${error.message || error}`)
    return []
  })

  const blogRoutes = await loadBlogRoutes().catch((error) => {
    console.warn(`[sitemap] Failed to load dynamic blog routes: ${error.message || error}`)
    return []
  })

  const profileRoutes = await loadProfileRoutes().catch((error) => {
    console.warn(`[sitemap] Failed to load dynamic profile routes: ${error.message || error}`)
    return []
  })

  const gardenRoutes = await loadGardenRoutes().catch((error) => {
    console.warn(`[sitemap] Failed to load dynamic garden routes: ${error.message || error}`)
    return []
  })

  const bookmarkRoutes = await loadBookmarkRoutes().catch((error) => {
    console.warn(`[sitemap] Failed to load dynamic bookmark routes: ${error.message || error}`)
    return []
  })

  const normalizedRoutes = mergeAndNormalizeRoutes([...STATIC_ROUTES, ...dynamicRoutes, ...blogRoutes, ...profileRoutes, ...gardenRoutes, ...bookmarkRoutes])

  const nowIso = new Date().toISOString()
  const urlEntries = []

  for (const route of normalizedRoutes) {
    const localizedByLang = new Map()
    for (const lang of languages) {
      const localizedPath = addLanguagePrefix(route.path, lang, defaultLanguage)
      const withBasePath = applyBasePath(localizedPath, basePath)
      const absoluteUrl = new URL(withBasePath, siteUrlWithSlash).href
      localizedByLang.set(lang, absoluteUrl)
    }

    if (!localizedByLang.size) continue
    const defaultHref = findDefaultHref(localizedByLang, defaultLanguage) || localizedByLang.values().next().value
    const alternates = [
      ...Array.from(localizedByLang.entries(), ([hreflang, href]) => ({ hreflang, href })),
    ]
    if (defaultHref) {
      const hasDefault = alternates.some((alt) => alt.hreflang === 'x-default')
      if (!hasDefault) {
        alternates.push({ hreflang: 'x-default', href: defaultHref })
      }
    }

    for (const [lang, href] of localizedByLang.entries()) {
      urlEntries.push({
        loc: href,
        changefreq: route.changefreq,
        priority: route.priority,
        lastmod: route.lastmod || nowIso,
        alternates,
        lang,
      })
    }
  }

  // Sort: English first, then other languages, then by URL path
  urlEntries.sort((a, b) => {
    // Default language (en) should come first
    const aIsDefault = a.lang === defaultLanguage
    const bIsDefault = b.lang === defaultLanguage
    if (aIsDefault && !bIsDefault) return -1
    if (!aIsDefault && bIsDefault) return 1
    // Then sort by language
    if (a.lang !== b.lang) return a.lang.localeCompare(b.lang)
    // Then sort by URL
    return a.loc.localeCompare(b.loc)
  })

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urlEntries.map((entry) => {
      const lines = [
        '  <url>',
        `    <loc>${escapeXml(entry.loc)}</loc>`,
      ]
      if (entry.lastmod) lines.push(`    <lastmod>${entry.lastmod}</lastmod>`)
      if (entry.changefreq) lines.push(`    <changefreq>${entry.changefreq}</changefreq>`)
      if (typeof entry.priority === 'number') lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`)
      entry.alternates?.forEach((alt) => {
        if (!alt?.href || !alt?.hreflang) return
        lines.push(`    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}" />`)
      })
      lines.push('  </url>')
      return lines.join('\n')
    }),
    '</urlset>',
    '',
  ].join('\n')

  await fs.writeFile(sitemapPath, xml, 'utf8')

  const relPath = path.relative(appRoot, sitemapPath)
  const dynamicCount = dynamicRoutes.length + blogRoutes.length + profileRoutes.length + gardenRoutes.length + bookmarkRoutes.length
  console.log(`[sitemap] Generated ${urlEntries.length} URLs (${languages.length} locales, ${dynamicCount} dynamic: ${dynamicRoutes.length} plants, ${blogRoutes.length} blogs, ${profileRoutes.length} profiles, ${gardenRoutes.length} gardens, ${bookmarkRoutes.length} bookmarks) in ${Date.now() - startedAt}ms → ${relPath}`)

  // Also regenerate llms.txt with live database stats
  await generateLlmsTxt({
    plantCount: dynamicRoutes.length,
    blogCount: blogRoutes.length,
    profileCount: profileRoutes.length,
    gardenCount: gardenRoutes.length,
    bookmarkCount: bookmarkRoutes.length,
  }).catch((error) => {
    console.warn(`[sitemap] Failed to generate llms.txt: ${error.message || error}`)
  })
}

main().catch((error) => {
  console.error('[sitemap] Generation failed:', error)
  // Report error to Sentry if available
  if (Sentry) {
    Sentry.captureException(error)
    // Give Sentry time to send the error before exiting
    setTimeout(() => process.exit(1), 2000)
  } else {
    process.exit(1)
  }
})

async function detectLanguages(localesDir, fallback) {
  try {
    const entries = await fs.readdir(localesDir, { withFileTypes: true })
    const languages = []
    const seen = new Set()
    for (const dirent of entries) {
      if (!dirent.isDirectory()) continue
      const name = dirent.name.trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      languages.push(name)
    }
    const fallbackKey = fallback.toLowerCase()
    if (!seen.has(fallbackKey)) {
      languages.unshift(fallback)
    }
    return languages.length ? languages : [fallback]
  } catch {
    return [fallback]
  }
}

async function loadPlantRoutes() {
  const client = getSupabaseClient()
  if (!client) {
    console.warn('[sitemap] Supabase credentials missing — static routes only.')
    return []
  }

  // Increased default to 10000 to ensure all plants are included
  const maxPlants = positiveInteger(process.env.SITEMAP_MAX_PLANT_URLS, 10000)
  const batchSize = positiveInteger(process.env.SITEMAP_PLANT_BATCH_SIZE, 1000)

  const results = []
  let offset = 0

  while (results.length < maxPlants) {
    const limit = Math.min(batchSize, maxPlants - results.length)
    const to = offset + limit - 1
    const { data, error } = await client
      .from('plants')
      .select('id, updated_time, created_time, status')
      .order('updated_time', { ascending: false, nullsFirst: false })
      .range(offset, to)

    if (error) {
      throw new Error(error.message || 'Supabase query failed')
    }

    if (!data || data.length === 0) {
      break
    }

    for (const row of data) {
      if (!row?.id) continue
      const normalizedId = encodeURIComponent(String(row.id))
      // Approved plants get higher priority (0.7), other statuses get lower priority (0.4)
      const status = (row.status || '').toLowerCase().trim()
      const isApproved = status === 'approved'
      const route = {
        path: `/plants/${normalizedId}`,
        changefreq: 'weekly',
        priority: isApproved ? 0.7 : 0.4,
        lastmod: pickLastmod(row),
      }
      results.push(route)
      if (results.length >= maxPlants) break
    }

    if (data.length < limit) break
    offset += limit
  }

  return results
}

function pickLastmod(row) {
  const updated = row?.updated_time || row?.updatedTime || row?.updated_at || row?.updatedAt
  const created = row?.created_time || row?.createdTime || row?.created_at || row?.createdAt
  const published = row?.published_at || row?.publishedAt
  
  // Prefer published date for blog posts if available and updated is not significantly later? 
  // Standard sitemap practice is usually last modification time.
  // If published_at is available, it might be the initial date.
  
  const updatedIso = toIsoString(updated)
  if (updatedIso) return updatedIso
  
  const publishedIso = toIsoString(published)
  if (publishedIso) return publishedIso

  const createdIso = toIsoString(created)
  if (createdIso) return createdIso
  return null
}

function mergeAndNormalizeRoutes(routes) {
  const seen = new Map()
  const normalized = []

  for (const route of routes) {
    const normalizedRoute = normalizeRoute(route)
    if (!normalizedRoute) continue
    const existing = seen.get(normalizedRoute.path)
    if (existing) {
      existing.priority = Math.max(existing.priority, normalizedRoute.priority)
      if (!existing.lastmod && normalizedRoute.lastmod) {
        existing.lastmod = normalizedRoute.lastmod
      }
      continue
    }
    seen.set(normalizedRoute.path, normalizedRoute)
    normalized.push(normalizedRoute)
  }

  normalized.sort((a, b) => a.path.localeCompare(b.path))
  return normalized
}

function normalizeRoute(route) {
  if (!route || !route.path) return null
  let normalizedPath = route.path.trim()
  if (!normalizedPath.startsWith('/')) normalizedPath = `/${normalizedPath}`
  normalizedPath = normalizedPath.replace(/\/{2,}/g, '/')
  if (normalizedPath.length > 1) normalizedPath = normalizedPath.replace(/\/+$/, '')

  const rawPriority = typeof route.priority === 'number' ? route.priority : Number(route.priority)
  const priority = Number.isFinite(rawPriority) ? clamp(rawPriority, 0, 1) : 0.5
  const changefreq = route.changefreq || 'weekly'
  const lastmod = toIsoString(route.lastmod)

  return {
    path: normalizedPath || '/',
    priority,
    changefreq,
    lastmod,
  }
}

function addLanguagePrefix(pathname, lang, defaultLang) {
  const current = (lang || '').toLowerCase()
  const fallback = (defaultLang || '').toLowerCase()
  if (!lang || current === fallback) {
    return pathname
  }
  if (pathname === '/' || pathname === '') {
    return `/${lang}`
  }
  return `/${lang}${pathname}`
}

function applyBasePath(pathname, base) {
  if (!base || base === '/') {
    return pathname === '' ? '/' : pathname
  }
  if (pathname === '/' || pathname === '') {
    return base
  }
  const trimmed = pathname.replace(/^\/+/, '')
  return `${base}${trimmed}`.replace(/\/{2,}/g, '/')
}

function normalizeBasePath(value) {
  if (!value || value === '/') return '/'
  let next = value.trim()
  if (!next.startsWith('/')) next = `/${next}`
  if (!next.endsWith('/')) next = `${next}/`
  return next.replace(/\/{2,}/g, '/')
}

function findDefaultHref(map, defaultLang) {
  const target = (defaultLang || '').toLowerCase()
  for (const [lang, href] of map.entries()) {
    if (String(lang).toLowerCase() === target) {
      return href
    }
  }
  return null
}

function parseBoolean(value) {
  if (value === undefined || value === null) return false
  const normalized = String(value).trim().toLowerCase()
  return ['1', 'true', 'yes', 'on', 'enable', 'enabled'].includes(normalized)
}

function positiveInteger(value, fallback) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return fallback
  return Math.floor(num)
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(value, min), max)
}

function toIsoString(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  if (!Number.isFinite(time)) return null
  return date.toISOString()
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;')
}

async function loadBlogRoutes() {
  const client = getSupabaseClient()
  if (!client) {
    console.warn('[sitemap] Supabase credentials missing — skipping blog routes.')
    return []
  }

  // Select id instead of slug - frontend blog links use /blog/{id} format
  const { data, error } = await client
    .from('blog_posts')
    .select('id, updated_at, created_at, published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false })

  if (error) {
    throw new Error(error.message || 'Supabase query failed for blog posts')
  }

  if (!data || !data.length) return []

  // Prioritize the latest blog post for better discoverability
  // The most recent post gets priority 0.95 (second only to homepage)
  // Other posts get standard priority 0.8
  return data.map((post, index) => {
    if (!post.id) return null
    const isLatestPost = index === 0
    const normalizedId = encodeURIComponent(String(post.id))
    return {
      path: `/blog/${normalizedId}`,
      changefreq: isLatestPost ? 'daily' : 'weekly',
      priority: isLatestPost ? 0.95 : 0.8,
      lastmod: pickLastmod(post),
    }
  }).filter(Boolean)
}

async function loadProfileRoutes() {
  const client = getSupabaseClient()
  if (!client) {
    console.warn('[sitemap] Supabase credentials missing — skipping profile routes.')
    return []
  }

  // Increased defaults to ensure all profiles are included
  const maxProfiles = positiveInteger(process.env.SITEMAP_MAX_PROFILE_URLS, 10000)
  const batchSize = positiveInteger(process.env.SITEMAP_PROFILE_BATCH_SIZE, 1000)

  const results = []
  let offset = 0

  while (results.length < maxProfiles) {
    const limit = Math.min(batchSize, maxProfiles - results.length)
    const to = offset + limit - 1
    // Only fetch PUBLIC profiles - private profiles should NOT be in sitemap
    // as they return 404 to crawlers and shouldn't be indexed
    const { data, error } = await client
      .from('profiles')
      .select('display_name')
      .not('display_name', 'is', null)
      .eq('is_private', false) // Only public profiles
      .order('display_name', { ascending: true })
      .range(offset, to)

    if (error) {
      throw new Error(error.message || 'Supabase query failed for profiles')
    }

    if (!data || data.length === 0) {
      break
    }

    for (const row of data) {
      if (!row?.display_name) continue
      const normalizedName = encodeURIComponent(String(row.display_name).trim())
      if (!normalizedName) continue
      const route = {
        path: `/u/${normalizedName}`,
        changefreq: 'weekly',
        priority: 0.5,
      }
      results.push(route)
      if (results.length >= maxProfiles) break
    }

    if (data.length < limit) break
    offset += limit
  }

  return results
}

async function loadGardenRoutes() {
  const client = getSupabaseClient()
  if (!client) {
    console.warn('[sitemap] Supabase credentials missing — skipping garden routes.')
    return []
  }

  // Increased defaults to ensure all gardens are included
  const maxGardens = positiveInteger(process.env.SITEMAP_MAX_GARDEN_URLS, 10000)
  const batchSize = positiveInteger(process.env.SITEMAP_GARDEN_BATCH_SIZE, 1000)

  const results = []
  let offset = 0

  while (results.length < maxGardens) {
    const limit = Math.min(batchSize, maxGardens - results.length)
    const to = offset + limit - 1
    // Only fetch PUBLIC gardens - private gardens should NOT be in sitemap
    // as they return 404 to crawlers and shouldn't be indexed
    // Include gardens where privacy is 'public' or null (default to public)
    const { data, error } = await client
      .from('gardens')
      .select('id, created_at')
      .or('privacy.eq.public,privacy.is.null')
      .order('created_at', { ascending: false })
      .range(offset, to)

    if (error) {
      throw new Error(error.message || 'Supabase query failed for gardens')
    }

    if (!data || data.length === 0) {
      break
    }

    for (const row of data) {
      if (!row?.id) continue
      const normalizedId = encodeURIComponent(String(row.id))
      const route = {
        path: `/garden/${normalizedId}`,
        changefreq: 'weekly',
        priority: 0.6,
        lastmod: toIsoString(row.created_at),
      }
      results.push(route)
      if (results.length >= maxGardens) break
    }

    if (data.length < limit) break
    offset += limit
  }

  return results
}

async function loadBookmarkRoutes() {
  const client = getSupabaseClient()
  if (!client) {
    console.warn('[sitemap] Supabase credentials missing — skipping bookmark routes.')
    return []
  }

  // Increased defaults to ensure all bookmarks are included
  const maxBookmarks = positiveInteger(process.env.SITEMAP_MAX_BOOKMARK_URLS, 10000)
  const batchSize = positiveInteger(process.env.SITEMAP_BOOKMARK_BATCH_SIZE, 1000)

  const results = []
  let offset = 0

  while (results.length < maxBookmarks) {
    const limit = Math.min(batchSize, maxBookmarks - results.length)
    const to = offset + limit - 1
    // Only fetch PUBLIC bookmarks - private bookmarks should NOT be in sitemap
    // as they return 404 to crawlers and shouldn't be indexed
    const { data, error } = await client
      .from('bookmarks')
      .select('id, created_at')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(offset, to)

    if (error) {
      throw new Error(error.message || 'Supabase query failed for bookmarks')
    }

    if (!data || data.length === 0) {
      break
    }

    for (const row of data) {
      if (!row?.id) continue
      const normalizedId = encodeURIComponent(String(row.id))
      const route = {
        path: `/bookmarks/${normalizedId}`,
        changefreq: 'weekly',
        priority: 0.5,
        lastmod: toIsoString(row.created_at),
      }
      results.push(route)
      if (results.length >= maxBookmarks) break
    }

    if (data.length < limit) break
    offset += limit
  }

  return results
}

function getSupabaseClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.REACT_APP_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL

  // Prefer service role key to bypass RLS and fetch ALL content (including private profiles/gardens/bookmarks)
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_TOKEN ||
    ''

  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.REACT_APP_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''

  // Use service role key if available (bypasses RLS), otherwise fall back to anon key
  const supabaseKey = serviceRoleKey || anonKey

  if (!supabaseUrl || !supabaseKey) {
    return null
  }

  // Log which key type is being used
  if (serviceRoleKey) {
    console.log('[sitemap] Using service role key (RLS bypassed - will include private content)')
  } else if (anonKey) {
    console.warn('[sitemap] Using anon key (subject to RLS - private content may be excluded)')
  }

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function loadEnvFiles(rootDir) {
  const candidates = [
    { file: '.env', override: false },
    { file: '.env.local', override: true },
    { file: '.env.production', override: true },
    { file: '.env.server', override: true },
  ]

  for (const candidate of candidates) {
    const fullPath = path.join(rootDir, candidate.file)
    if (fsSync.existsSync(fullPath)) {
      dotenv.config({ path: fullPath, override: candidate.override })
    }
  }
}

// ─── llms.txt generation ─────────────────────────────────────────────
// Generates a comprehensive llms.txt enriched with live database stats,
// sample plants, recent blog posts, and plant type distribution.
// Called automatically after sitemap generation.
async function generateLlmsTxt(counts) {
  const llmsPath = path.join(publicDir, 'llms.txt')
  const now = new Date().toISOString().slice(0, 10)
  const client = getSupabaseClient()

  // Fetch additional data for the llms.txt if DB is available
  let samplePlants = []
  let recentBlogPosts = []

  if (client) {
    try {
      // Get sample plants across different types for showcase
      const { data: samples } = await client
        .from('plants')
        .select('id, name, plant_type')
        .eq('status', 'approved')
        .order('name', { ascending: true })
        .limit(30)
      if (samples) samplePlants = samples
    } catch { }

    try {
      // Get English translations for sample plants (scientific names)
      if (samplePlants.length > 0) {
        const ids = samplePlants.map(p => p.id)
        const { data: translations } = await client
          .from('plant_translations')
          .select('plant_id, scientific_name')
          .in('plant_id', ids)
          .eq('language', 'en')
        if (translations) {
          const sciMap = {}
          for (const t of translations) {
            if (t.scientific_name) sciMap[t.plant_id] = t.scientific_name
          }
          samplePlants = samplePlants.map(p => ({
            ...p,
            scientific_name: sciMap[p.id] || null,
          }))
        }
      }
    } catch { }

    try {
      // Get recent blog posts
      const { data: posts } = await client
        .from('blog_posts')
        .select('id, title, published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(10)
      if (posts) recentBlogPosts = posts
    } catch { }

  }

  // Build the llms.txt content
  const lines = []

  lines.push(`# Aphylia - Plant Care & Gardening Knowledge Platform`)
  lines.push(``)
  lines.push(`> Aphylia is a free, GDPR-compliant plant care application that helps gardeners discover, identify, and care for plants. It provides comprehensive growing guides, care instructions, and gardening knowledge for thousands of plant species. Serving the European Union.`)
  lines.push(``)
  lines.push(`## About Aphylia`)
  lines.push(``)
  lines.push(`Aphylia is a web-based gardening companion application. It is free to use, available in English and French, and designed for gardeners of all experience levels.`)
  lines.push(``)
  lines.push(`### Core Features`)
  lines.push(``)
  lines.push(`- **Plant Encyclopedia**: Searchable database of thousands of plant species with detailed botanical data, care guides, growing calendars, companion planting, toxicity information, propagation methods, and high-quality photos.`)
  lines.push(`- **Plant Discovery**: Swipe-based plant matching (swipe right to save, left to skip) to build a personalized garden wishlist.`)
  lines.push(`- **Garden Management**: Create and manage multiple gardens, track plants, monitor care tasks, and log progress with streaks.`)
  lines.push(`- **Smart Care Reminders**: Automated reminders for watering, fertilizing, pruning, and seasonal tasks based on each plant's needs.`)
  lines.push(`- **Plant Identification**: AI-powered plant identification from photos using your camera.`)
  lines.push(`- **Community**: Public garden profiles, user profiles, plant bookmark collections, and a friends system.`)
  lines.push(`- **Blog**: Expert gardening advice, seasonal tips, growing techniques, and plant care articles.`)
  lines.push(`- **Progressive Web App**: Installable on mobile and desktop, works offline.`)
  lines.push(``)
  lines.push(`### Languages`)
  lines.push(``)
  lines.push(`- English (default, no URL prefix)`)
  lines.push(`- French (URL prefix \`/fr/\`)`)
  lines.push(``)

  // ── Docs ─────────────────────────────────────────────────────
  lines.push(`## Docs`)
  lines.push(``)
  lines.push(`### Plant Information Pages`)
  lines.push(``)
  lines.push(`Each plant page provides the most comprehensive publicly available data for that species:`)
  lines.push(``)
  lines.push(`- [Plant Search](${siteUrlBase}/search): Search by name, care level, light, watering, climate zone, or difficulty`)
  lines.push(`- [Plant Discovery](${siteUrlBase}/discovery): Swipe-based plant matching interface`)
  lines.push(`- URL pattern: \`${siteUrlBase}/plants/{plant-id}\``)
  lines.push(``)

  // Sample plants
  if (samplePlants.length > 0) {
    lines.push(`#### Sample Plants`)
    lines.push(``)
    for (const p of samplePlants.slice(0, 20)) {
      const sci = p.scientific_name ? ` (_${p.scientific_name}_)` : ''
      const type = p.plant_type ? ` [${p.plant_type}]` : ''
      lines.push(`- [${p.name}](${siteUrlBase}/plants/${encodeURIComponent(p.id)})${sci}${type}`)
    }
    lines.push(``)
  }

  lines.push(`#### Data Available Per Plant`)
  lines.push(``)
  lines.push(`**Identity & Classification**`)
  lines.push(`- Common name (localized), scientific name, family`)
  lines.push(`- Plant type (flower, tree, shrub, cactus, succulent, bamboo, etc.)`)
  lines.push(`- Origin countries, habitat types, conservation status`)
  lines.push(`- Color palette with hex codes`)
  lines.push(``)
  lines.push(`**Care Guide**`)
  lines.push(`- Light requirements (full sun, partial sun, shade, low light)`)
  lines.push(`- Watering type (surface, buried, hose, drip, drench)`)
  lines.push(`- Humidity percentage, temperature range (min/ideal/max in Celsius)`)
  lines.push(`- Soil types, mulching materials, fertilizer recommendations`)
  lines.push(`- Maintenance level (none, low, moderate, heavy)`)
  lines.push(`- Living space (indoor, outdoor, both)`)
  lines.push(``)
  lines.push(`**Growth & Structure**`)
  lines.push(`- Height (cm), wingspan (cm), separation distance (cm)`)
  lines.push(`- Life cycle (annual, biennial, perennial, ephemeral, monocarpic, polycarpic)`)
  lines.push(`- Foliage persistence (deciduous, evergreen, semi-evergreen, marcescent)`)
  lines.push(`- Seasons of interest, composition (flowerbed, path, hedge, ground cover, pot)`)
  lines.push(``)
  lines.push(`**Phenology (Growing Calendar)**`)
  lines.push(`- Sowing months, flowering months, fruiting months`)
  lines.push(``)
  lines.push(`**Propagation**`)
  lines.push(`- Division methods (seed, cutting, division, layering, grafting, tissue separation, bulb separation)`)
  lines.push(`- Sowing types (direct, indoor, row, hill, broadcast, seed tray, cell, pot)`)
  lines.push(`- Transplanting compatibility, tutoring needs`)
  lines.push(``)
  lines.push(`**Ecology**`)
  lines.push(`- Pollinators attracted (bee, butterfly, bird, beetle, etc.)`)
  lines.push(`- Melliferous status, natural fertilizer capability`)
  lines.push(`- Companion plants (linked to their own pages)`)
  lines.push(`- Pests and diseases`)
  lines.push(``)
  lines.push(`**Safety**`)
  lines.push(`- Human toxicity level (non-toxic, mildly irritating, highly toxic, lethally toxic)`)
  lines.push(`- Pet toxicity level, allergens list`)
  lines.push(`- Physical traits (scented, spiked, multicolor, bicolor)`)
  lines.push(``)
  lines.push(`**Usage & Benefits**`)
  lines.push(`- Utility categories (edible, ornamental, aromatic, medicinal, climbing, cereal, spice)`)
  lines.push(`- Edible parts (flower, fruit, seed, leaf, stem, root, bulb, bark)`)
  lines.push(`- Infusion and aromatherapy uses`)
  lines.push(`- Nutritional intake, recipe ideas, medicinal advice`)
  lines.push(``)
  lines.push(`**Expert Advice Sections**`)
  lines.push(`- Soil advice, mulching advice, fertilizer advice`)
  lines.push(`- Sowing advice, tutoring advice, pruning instructions`)
  lines.push(`- Medicinal use notes, infusion preparation`)
  lines.push(``)

  // ── Blog ─────────────────────────────────────────────────────
  lines.push(`### Blog`)
  lines.push(``)
  lines.push(`- [Blog listing](${siteUrlBase}/blog): All published articles`)
  lines.push(`- URL pattern: \`${siteUrlBase}/blog/{post-id}\` (UUID)`)
  lines.push(`- Content: Full article HTML with cover images, author attribution, publish dates`)
  lines.push(`- Topics: Plant care, growing techniques, seasonal gardening, beginner guides, expert tips`)
  lines.push(``)

  if (recentBlogPosts.length > 0) {
    lines.push(`#### Recent Articles`)
    lines.push(``)
    for (const post of recentBlogPosts) {
      const date = post.published_at ? new Date(post.published_at).toISOString().slice(0, 10) : ''
      lines.push(`- [${post.title}](${siteUrlBase}/blog/${encodeURIComponent(post.id)})${date ? ` (${date})` : ''}`)
    }
    lines.push(``)
  }

  // ── Other pages ──────────────────────────────────────────────
  lines.push(`### Community Gardens`)
  lines.push(``)
  lines.push(`- [Gardens listing](${siteUrlBase}/gardens): Browse public gardens`)
  lines.push(`- URL pattern: \`${siteUrlBase}/garden/{garden-id}\``)
  lines.push(`- Data: Garden name, location (city/country), plant list, member count, care streak, task progress, cover image`)
  lines.push(``)
  lines.push(`### User Profiles`)
  lines.push(``)
  lines.push(`- URL pattern: \`${siteUrlBase}/u/{username}\``)
  lines.push(`- Data: Display name, bio, country, experience level, favorite plant, garden list, plant count, streak stats, friend count`)
  lines.push(`- Privacy: Only public profiles are accessible; private profiles return limited information`)
  lines.push(``)
  lines.push(`### Plant Bookmark Collections`)
  lines.push(``)
  lines.push(`- URL pattern: \`${siteUrlBase}/bookmarks/{collection-id}\``)
  lines.push(`- Data: Collection name, curator, full plant list with names and scientific names, plant count`)
  lines.push(`- Privacy: Only public collections are accessible`)
  lines.push(``)
  lines.push(`### Static Pages`)
  lines.push(``)
  lines.push(`- [Homepage](${siteUrlBase}/): Landing page with features, stats, and popular plants`)
  lines.push(`- [About](${siteUrlBase}/about): Mission and feature overview`)
  lines.push(`- [Contact](${siteUrlBase}/contact): Support and feedback`)
  lines.push(`- [Business](${siteUrlBase}/contact/business): Partnership inquiries`)
  lines.push(`- [Pricing](${siteUrlBase}/pricing): Free tier and upcoming premium`)
  lines.push(`- [Download](${siteUrlBase}/download): PWA installation instructions`)
  lines.push(`- [Terms](${siteUrlBase}/terms): Terms of Service`)
  lines.push(`- [Privacy](${siteUrlBase}/privacy): GDPR-compliant Privacy Policy`)
  lines.push(``)

  // ── Optional / Technical ─────────────────────────────────────
  lines.push(`## Optional`)
  lines.push(``)
  lines.push(`### Full Data Export for AI`)
  lines.push(``)
  lines.push(`- [llms-full.txt](${siteUrlBase}/llms-full.txt): Dynamically generated file listing every plant in the database with key care data, all blog post titles and URLs, all public gardens and profiles. Updated in real-time from the database. Use this for comprehensive indexing.`)
  lines.push(`- [Sitemap](${siteUrlBase}/sitemap.xml): Standard XML sitemap with all crawlable URLs, updated daily.`)
  lines.push(`- [Robots.txt](${siteUrlBase}/robots.txt): Crawling rules and rate limits per bot type.`)
  lines.push(``)
  lines.push(`### Crawl Priority`)
  lines.push(``)
  lines.push(`1. **Plant pages** (\`/plants/*\`): Core botanical content, highest value`)
  lines.push(`2. **Blog posts** (\`/blog/*\`): Expert gardening knowledge`)
  lines.push(`3. **Public gardens** (\`/garden/*\`): Community content with plant lists`)
  lines.push(`4. **User profiles** (\`/u/*\`): Gardener profiles`)
  lines.push(`5. **Bookmark collections** (\`/bookmarks/*\`): Curated plant lists`)
  lines.push(`6. **Static pages**: Site information`)
  lines.push(``)
  lines.push(`### Rate Limiting`)
  lines.push(``)
  lines.push(`- Recommended crawl delay: 1-2 seconds between requests`)
  lines.push(`- See \`robots.txt\` for bot-specific policies`)
  lines.push(`- SSR-rendered pages are served to all bots with full content (no JavaScript required)`)
  lines.push(``)
  lines.push(`### Content Freshness`)
  lines.push(``)
  lines.push(`- Plant database: Daily additions and updates`)
  lines.push(`- Blog posts: Weekly new content`)
  lines.push(`- Community content: Real-time user updates`)
  lines.push(`- Sitemap & llms.txt: Regenerated on each build/deploy`)
  lines.push(`- \`llms-full.txt\`: Generated dynamically on each request (cached 1 hour)`)
  lines.push(``)
  lines.push(`### Structured Data`)
  lines.push(``)
  lines.push(`All pages include:`)
  lines.push(`- JSON-LD (Schema.org) structured data`)
  lines.push(`- Open Graph meta tags for social sharing`)
  lines.push(`- Twitter Card meta tags`)
  lines.push(`- Canonical URLs with language variants`)
  lines.push(`- Semantic HTML5 with ARIA attributes`)
  lines.push(``)
  lines.push(`### Private Pages (Do Not Crawl)`)
  lines.push(``)
  lines.push(`- \`/admin\` - Admin panel`)
  lines.push(`- \`/settings\` - User settings`)
  lines.push(`- \`/profile\` - Authenticated user profile`)
  lines.push(`- \`/messages\` - Messaging`)
  lines.push(`- \`/friends\` - Friend management`)
  lines.push(`- \`/scan\` - Plant scanning`)
  lines.push(`- \`/create\` - Content creation`)
  lines.push(`- \`/api/*\` - API endpoints`)
  lines.push(``)

  // ── Attribution ──────────────────────────────────────────────
  lines.push(`## Attribution`)
  lines.push(``)
  lines.push(`When referencing Aphylia content:`)
  lines.push(`- Attribute to "Aphylia" or "Aphylia (aphylia.app)"`)
  lines.push(`- Link to specific plant pages when citing plant data`)
  lines.push(`- Care requirements are general guidelines; local climate conditions may vary`)
  lines.push(`- Scientific names follow standard botanical nomenclature`)
  lines.push(``)

  // ── Contact ──────────────────────────────────────────────────
  lines.push(`## Contact`)
  lines.push(``)
  lines.push(`- Website: ${siteUrlBase}`)
  lines.push(`- Contact: ${siteUrlBase}/contact`)
  lines.push(`- Business: ${siteUrlBase}/contact/business`)
  lines.push(``)
  lines.push(`---`)
  lines.push(`Last generated: ${now}`)
  lines.push(``)

  await fs.writeFile(llmsPath, lines.join('\n'), 'utf8')
  const llmsRelPath = path.relative(appRoot, llmsPath)
  console.log(`[sitemap] Generated llms.txt → ${llmsRelPath}`)
}
