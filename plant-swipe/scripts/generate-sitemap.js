#!/usr/bin/env node

import path from 'node:path'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const startedAt = Date.now()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const appRoot = path.resolve(__dirname, '..')
const publicDir = path.join(appRoot, 'public')
const sitemapPath = path.join(publicDir, 'sitemap.xml')

loadEnvFiles(appRoot)

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
}

main().catch((error) => {
  console.error('[sitemap] Generation failed:', error)
  process.exit(1)
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

  const maxPlants = positiveInteger(process.env.SITEMAP_MAX_PLANT_URLS, 5000)
  const batchSize = positiveInteger(process.env.SITEMAP_PLANT_BATCH_SIZE, 500)

  const results = []
  let offset = 0

  while (results.length < maxPlants) {
    const limit = Math.min(batchSize, maxPlants - results.length)
    const to = offset + limit - 1
    const { data, error } = await client
      .from('plants')
      .select('id, updated_time, created_time')
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
      const route = {
        path: `/plants/${normalizedId}`,
        changefreq: 'weekly',
        priority: 0.7,
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

  const { data, error } = await client
    .from('blog_posts')
    .select('slug, updated_at, created_at, published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false })

  if (error) {
    throw new Error(error.message || 'Supabase query failed for blog posts')
  }

  if (!data || !data.length) return []

  return data.map((post) => {
    if (!post.slug) return null
    return {
      path: `/blog/${post.slug}`,
      changefreq: 'weekly',
      priority: 0.8,
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

  const maxProfiles = positiveInteger(process.env.SITEMAP_MAX_PROFILE_URLS, 2000)
  const batchSize = positiveInteger(process.env.SITEMAP_PROFILE_BATCH_SIZE, 500)

  const results = []
  let offset = 0

  while (results.length < maxProfiles) {
    const limit = Math.min(batchSize, maxProfiles - results.length)
    const to = offset + limit - 1
    // Fetch ALL profiles (public and private) - public profiles listed first
    const { data, error } = await client
      .from('profiles')
      .select('display_name, is_private')
      .not('display_name', 'is', null)
      .order('is_private', { ascending: true }) // public (false) first, then private (true)
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
      // Public profiles get higher priority (0.5), private profiles get lower priority (0.3)
      const isPrivate = row.is_private === true
      const route = {
        path: `/u/${normalizedName}`,
        changefreq: 'weekly',
        priority: isPrivate ? 0.3 : 0.5,
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

  const maxGardens = positiveInteger(process.env.SITEMAP_MAX_GARDEN_URLS, 1000)
  const batchSize = positiveInteger(process.env.SITEMAP_GARDEN_BATCH_SIZE, 500)

  const results = []
  let offset = 0

  while (results.length < maxGardens) {
    const limit = Math.min(batchSize, maxGardens - results.length)
    const to = offset + limit - 1
    // Fetch ALL gardens (public and private) with privacy info
    const { data, error } = await client
      .from('gardens')
      .select('id, created_at, privacy')
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
      // Public gardens (privacy = 'public' or null) get higher priority (0.6)
      // Private gardens get lower priority (0.4)
      const isPrivate = row.privacy === 'private'
      const route = {
        path: `/garden/${normalizedId}`,
        changefreq: 'weekly',
        priority: isPrivate ? 0.4 : 0.6,
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

  const maxBookmarks = positiveInteger(process.env.SITEMAP_MAX_BOOKMARK_URLS, 1000)
  const batchSize = positiveInteger(process.env.SITEMAP_BOOKMARK_BATCH_SIZE, 500)

  const results = []
  let offset = 0

  while (results.length < maxBookmarks) {
    const limit = Math.min(batchSize, maxBookmarks - results.length)
    const to = offset + limit - 1
    // Fetch ALL bookmarks (public and private) with visibility info
    const { data, error } = await client
      .from('bookmarks')
      .select('id, created_at, visibility')
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
      // Public bookmarks get higher priority (0.5)
      // Private bookmarks get lower priority (0.3)
      const isPrivate = row.visibility === 'private'
      const route = {
        path: `/bookmarks/${normalizedId}`,
        changefreq: 'weekly',
        priority: isPrivate ? 0.3 : 0.5,
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
