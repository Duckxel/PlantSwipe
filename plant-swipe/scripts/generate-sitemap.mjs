#!/usr/bin/env node
/**
 * Generate sitemap.xml for Aphylia/Plant Swipe.
 * - Includes core static routes in every supported language
 * - Expands dynamic plant detail pages from Supabase
 * - Emits <xhtml:link> alternates for hreflang coverage
 */

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

if (String(process.env.SKIP_SITEMAP_GENERATION || '').toLowerCase() === '1') {
  console.log('[sitemap] SKIP_SITEMAP_GENERATION=1 → skipping sitemap build.')
  process.exit(0)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const publicDir = path.resolve(projectRoot, 'public')

const envFiles = [
  path.resolve(projectRoot, '.env'),
  path.resolve(projectRoot, '.env.local'),
  path.resolve(projectRoot, '.env.production'),
  path.resolve(projectRoot, '.env.server'),
  path.resolve(projectRoot, '..', '.env'),
]
for (const envPath of envFiles) {
  try {
    dotenv.config({ path: envPath, override: false })
  } catch {}
}

const rawBaseUrl = [
  process.env.SITEMAP_BASE_URL,
  process.env.PUBLIC_SITE_URL,
  process.env.VITE_SITE_URL,
  process.env.VITE_APP_URL,
].find((value) => typeof value === 'string' && value.trim().length > 0)

if (!rawBaseUrl) {
  console.error('[sitemap] Missing SITEMAP_BASE_URL (or PUBLIC_SITE_URL / VITE_SITE_URL env).')
  process.exit(1)
}

const baseUrl = normalizeBaseUrl(rawBaseUrl)
const siteName = (process.env.SITEMAP_SITE_NAME || process.env.VITE_SITE_NAME || 'Aphylia').trim()
const nowIso = new Date().toISOString()

async function detectLanguages() {
  if (process.env.SITEMAP_LANGS) {
    return process.env.SITEMAP_LANGS.split(',').map((code) => code.trim()).filter(Boolean)
  }
  try {
    const localesPath = path.resolve(publicDir, 'locales')
    const entries = await fs.readdir(localesPath, { withFileTypes: true })
    const dirs = entries.filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name)
    return dirs.length ? dirs : ['en']
  } catch {
    return ['en']
  }
}

const languages = await detectLanguages()
const defaultLanguage = languages.includes(process.env.SITEMAP_DEFAULT_LANG || '')
  ? (process.env.SITEMAP_DEFAULT_LANG || '').trim()
  : languages[0]

const localeConfigs = languages.map((code) => ({
  code,
  prefix: code === defaultLanguage ? '' : `/${code}`,
  hreflang: process.env[`SITEMAP_HREFLANG_${code.toUpperCase()}`] || code,
}))

const staticPages = [
  { slug: '/', changefreq: 'daily', priority: 1.0, lastmod: nowIso },
  { slug: '/search', changefreq: 'daily', priority: 0.95, lastmod: nowIso },
  { slug: '/about', changefreq: 'monthly', priority: 0.7, lastmod: nowIso },
  { slug: '/contact', changefreq: 'monthly', priority: 0.6, lastmod: nowIso },
  { slug: '/contact/business', changefreq: 'monthly', priority: 0.6, lastmod: nowIso },
  { slug: '/download', changefreq: 'weekly', priority: 0.65, lastmod: nowIso },
  { slug: '/terms', changefreq: 'yearly', priority: 0.4, lastmod: nowIso },
]

const supabaseUrl =
  process.env.SUPABASE_SERVICE_URL
  || process.env.SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || null
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SERVICE_ROLE
  || process.env.SUPABASE_SERVICE_ROLE_TOKEN
  || process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || null

let supabase = null
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
} else {
  console.warn('[sitemap] Supabase credentials missing — dynamic plant pages will be skipped.')
}

async function fetchPlantPages() {
  if (!supabase) return []
  const pageSize = Number(process.env.SITEMAP_BATCH_SIZE || 1000)
  let from = 0
  const pages = []
  while (true) {
    const { data, error } = await supabase
      .from('plants')
      .select('id, updated_at')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`Supabase error: ${error.message}`)
    if (!data || data.length === 0) break
    for (const row of data) {
      if (!row?.id) continue
      const slug = `/plants/${encodeURIComponent(String(row.id))}`
      pages.push({
        slug,
        changefreq: 'weekly',
        priority: 0.85,
        lastmod: row.updated_at ? new Date(row.updated_at).toISOString() : nowIso,
      })
    }
    if (data.length < pageSize) break
    from += pageSize
  }
  return pages
}

let dynamicPlantPages = []
try {
  dynamicPlantPages = await fetchPlantPages()
} catch (err) {
  console.error('[sitemap] Failed to load plant entries:', err.message || err)
  process.exit(1)
}

const allPages = [...staticPages, ...dynamicPlantPages]
const expandedEntries = []
for (const page of allPages) {
  const localized = localeConfigs.map((locale) => {
    const pathPart = buildPath(locale.prefix, page.slug)
    return {
      loc: buildAbsoluteUrl(baseUrl, pathPart),
      path: pathPart,
      hreflang: locale.hreflang,
      lang: locale.code,
      changefreq: page.changefreq,
      priority: page.priority,
      lastmod: page.lastmod,
    }
  })
  const defaultEntry = localized.find((entry) => entry.lang === defaultLanguage) || localized[0]
  localized.forEach((entry) => {
    const alternates = localized
      .filter((alt) => alt.lang !== entry.lang)
      .map((alt) => ({ hreflang: alt.hreflang, href: alt.loc }))
    if (defaultEntry && !alternates.some((alt) => alt.hreflang === 'x-default')) {
      alternates.push({ hreflang: 'x-default', href: defaultEntry.loc })
    }
    expandedEntries.push({ ...entry, alternates })
  })
}

const uniqueEntries = dedupeBy(expandedEntries, (entry) => entry.loc)
uniqueEntries.sort((a, b) => a.loc.localeCompare(b.loc))

const xmlChunks = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="https://www.w3.org/1999/xhtml">',
]
for (const entry of uniqueEntries) {
  xmlChunks.push('  <url>')
  xmlChunks.push(`    <loc>${escapeXml(entry.loc)}</loc>`)
  if (entry.lastmod) {
    xmlChunks.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`)
  }
  if (entry.changefreq) {
    xmlChunks.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`)
  }
  if (typeof entry.priority === 'number') {
    xmlChunks.push(`    <priority>${entry.priority.toFixed(2)}</priority>`)
  }
  for (const alt of entry.alternates || []) {
    xmlChunks.push(
      `    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}" />`,
    )
  }
  xmlChunks.push('  </url>')
}
xmlChunks.push('</urlset>', '')

await fs.mkdir(publicDir, { recursive: true })
const outputPath = path.resolve(publicDir, 'sitemap.xml')
await fs.writeFile(outputPath, xmlChunks.join('\n'), 'utf8')

console.log(`[sitemap] Generated ${uniqueEntries.length} URLs → ${path.relative(projectRoot, outputPath)}`)

function normalizeBaseUrl(url) {
  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('SITEMAP_BASE_URL must be an absolute URL (e.g., https://aphylia.com)')
  }
  return trimmed.replace(/\/+$/, '')
}

function buildPath(prefix, slug) {
  const normalizedSlug = slug === '/' ? '' : slug
  if (!prefix) {
    return normalizedSlug || '/'
  }
  if (!normalizedSlug) {
    return prefix
  }
  return `${prefix}${normalizedSlug}`.replace(/\/{2,}/g, '/')
}

function buildAbsoluteUrl(base, pathPart) {
  if (pathPart === '/' || pathPart === '') {
    return `${base}/`
  }
  return `${base}${pathPart.startsWith('/') ? pathPart : `/${pathPart}`}`
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function dedupeBy(items, selector) {
  const seen = new Set()
  const result = []
  for (const item of items) {
    const key = selector(item)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}
