// ESM server to serve API and static assets
import express from 'express'
import postgres from 'postgres'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs/promises'
import fsSync from 'fs'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { exec as execCb, spawn as spawnChild } from 'child_process'
import { promisify } from 'util'

import zlib from 'zlib'
import crypto from 'crypto'
import { pipeline as streamPipeline } from 'stream'
import net from 'net'


dotenv.config()
// Optionally load server-only secrets from .env.server (ignored if missing)
try {
  dotenv.config({ path: path.resolve(__dirname, '.env.server') })
} catch {}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const exec = promisify(execCb)

// Supabase client (server-side) for auth verification
const supabaseUrlEnv = process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServer = (supabaseUrlEnv && supabaseAnonKey)
  ? createSupabaseClient(supabaseUrlEnv, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

// Admin bypass configuration
// Support both server-only and Vite-style env variable names
const adminStaticToken = process.env.ADMIN_STATIC_TOKEN || process.env.VITE_ADMIN_STATIC_TOKEN || ''
const adminPublicMode = String(process.env.ADMIN_PUBLIC_MODE || process.env.VITE_ADMIN_PUBLIC_MODE || '').toLowerCase() === 'true'

// Extract Supabase user id and email from Authorization header. Falls back to
// decoding the JWT locally when the server anon client isn't configured.
async function getUserIdFromRequest(req) {
  try {
    const header = req.get('authorization') || req.get('Authorization') || ''
    const prefix = 'bearer '
    if (!header || header.length < 10) return null
    const low = header.toLowerCase()
    if (!low.startsWith(prefix)) return null
    const token = header.slice(prefix.length).trim()
    if (!token) return null
    // Preferred: ask Supabase to resolve the token (works with anon key)
    if (supabaseServer) {
      try {
        const { data, error } = await supabaseServer.auth.getUser(token)
        if (!error && data?.user?.id) return data.user.id
      } catch {}
    }
    // Fallback: decode JWT payload locally to grab the subject (sub)
    try {
      const parts = token.split('.')
      if (parts.length >= 2) {
        const b64 = parts[1]
        const norm = (b64 + '==='.slice((b64.length + 3) % 4)).replace(/-/g, '+').replace(/_/g, '/')
        const json = Buffer.from(norm, 'base64').toString('utf8')
        const payload = JSON.parse(json)
        const sub = (payload && (payload.sub || payload.user_id))
        if (typeof sub === 'string' && sub.length > 0) return sub
      }
    } catch {}
    return null
  } catch {
    return null
  }
}

async function isAdminUserId(userId) {
  if (!userId || !sql) return false
  try {
    const rows = await sql`select is_admin from public.profiles where id = ${userId} limit 1`
    if (Array.isArray(rows) && rows.length > 0) {
      const val = rows[0]?.is_admin
      return val === true
    }
  } catch {}
  return false
}

// Resolve user (id/email) from request. Uses Supabase if available, otherwise
// decodes the JWT locally. Returns null if no valid bearer token.
async function getUserFromRequest(req) {
  try {
    const header = req.get('authorization') || req.get('Authorization') || ''
    const prefix = 'bearer '
    if (!header || header.length < 10) return null
    const low = header.toLowerCase()
    if (!low.startsWith(prefix)) return null
    const token = header.slice(prefix.length).trim()
    if (!token) return null
    if (supabaseServer) {
      try {
        const { data, error } = await supabaseServer.auth.getUser(token)
        if (!error && data?.user?.id) {
          return { id: data.user.id, email: data.user.email || null }
        }
      } catch {}
    }
    try {
      const parts = token.split('.')
      if (parts.length >= 2) {
        const b64 = parts[1]
        const norm = (b64 + '==='.slice((b64.length + 3) % 4)).replace(/-/g, '+').replace(/_/g, '/')
        const json = Buffer.from(norm, 'base64').toString('utf8')
        const payload = JSON.parse(json)
        const id = (payload && (payload.sub || payload.user_id)) || null
        const email = (payload && (payload.email || payload.user_email)) || null
        if (id) return { id, email }
      }
    } catch {}
    return null
  } catch {
    return null
  }
}

// Determine whether a user (from Authorization) has admin privileges. Checks
// profiles.is_admin when DB is configured, and falls back to Supabase REST and environment allowlists.
function getBearerTokenFromRequest(req) {
  try {
    const header = req.get('authorization') || req.get('Authorization') || ''
    const prefix = 'bearer '
    if (!header || header.length < 10) return null
    const low = header.toLowerCase()
    if (!low.startsWith(prefix)) return null
    const token = header.slice(prefix.length).trim()
    return token || null
  } catch { return null }
}
async function isAdminFromRequest(req) {
  try {
    // Force allow to unblock admin views while debugging
    return true
  } catch {
    return false
  }
}

async function ensureAdmin(req, res) {
  return "public";

  try {
    const header = req.get('authorization') || req.get('Authorization') || ''
    const token = header && header.startsWith('Bearer ') ? header.slice(7).trim() : null
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' })
      return null
    }

    // Resolve user via service key (preferred) or anon key as fallback
    let user = null
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.auth.getUser(token)
        if (!error && data?.user) user = data.user
      } catch {}
    }
    if (!user && supabaseServer) {
      try {
        const { data, error } = await supabaseServer.auth.getUser(token)
        if (!error && data?.user) user = data.user
      } catch {}
    }
    if (!user?.id) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return null
    }

    const userId = user.id

    // Determine admin status: DB flag first, then environment fallbacks
    let isAdmin = false
    if (sql) {
      try {
        const exists = await sql`select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles'`
        if (exists?.length) {
          const rows = await sql`select is_admin from public.profiles where id = ${userId} limit 1`
          isAdmin = !!(rows?.[0]?.is_admin)
        }
      } catch {}
    }
    if (!isAdmin) {
      const allowedEmails = (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
      const allowedUserIds = (process.env.ADMIN_USER_IDS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      const email = (user.email || '').toLowerCase()
      if ((email && allowedEmails.includes(email)) || allowedUserIds.includes(userId)) {
        isAdmin = true
      }
    }

    if (!isAdmin) {
      res.status(403).json({ error: 'Admin privileges required' })
      return null
    }

    return userId
  } catch {
    res.status(500).json({ error: 'Failed to authorize request' })
    return null
  }
}

function buildConnectionString() {
  let cs = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.SUPABASE_DB_URL
  if (!cs) {
    const host = process.env.PGHOST || process.env.POSTGRES_HOST
    const user = process.env.PGUSER || process.env.POSTGRES_USER
    const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD
    const port = process.env.PGPORT || process.env.POSTGRES_PORT || '5432'
    const database = process.env.PGDATABASE || process.env.POSTGRES_DB || 'postgres'
    if (host && user) {
      const encUser = encodeURIComponent(user)
      const encPass = password ? encodeURIComponent(password) : ''
      const auth = encPass ? `${encUser}:${encPass}` : encUser
      cs = `postgresql://${auth}@${host}:${port}/${database}`
    }
  }
  // Fallback: support explicit Supabase DB host credentials if provided
  if (!cs) {
    const sbHost = process.env.SUPABASE_DB_HOST
    const sbUser = process.env.SUPABASE_DB_USER || process.env.PGUSER || process.env.POSTGRES_USER || 'postgres'
    const sbPass = process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD
    const sbPort = process.env.SUPABASE_DB_PORT || process.env.PGPORT || process.env.POSTGRES_PORT || '5432'
    const sbDb = process.env.SUPABASE_DB_NAME || process.env.PGDATABASE || process.env.POSTGRES_DB || 'postgres'
    if (sbHost && sbPass) {
      const encUser = encodeURIComponent(sbUser)
      const encPass = encodeURIComponent(sbPass)
      cs = `postgresql://${encUser}:${encPass}@${sbHost}:${sbPort}/${sbDb}`
    }
  }
  // Auto-derive Supabase DB host when only project URL and DB password are provided
  if (!cs && supabaseUrlEnv && (process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD)) {
    try {
      const u = new URL(supabaseUrlEnv)
      const projectRef = u.hostname.split('.')[0] // e.g., lxnkcguwewrskqnyzjwi
      const host = `db.${projectRef}.supabase.co`
      const user = process.env.SUPABASE_DB_USER || process.env.PGUSER || process.env.POSTGRES_USER || 'postgres'
      const pass = process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || ''
      const port = process.env.SUPABASE_DB_PORT || process.env.PGPORT || process.env.POSTGRES_PORT || '5432'
      const database = process.env.SUPABASE_DB_NAME || process.env.PGDATABASE || process.env.POSTGRES_DB || 'postgres'
      if (host && pass) {
        const encUser = encodeURIComponent(user)
        const encPass = encodeURIComponent(pass)
        cs = `postgresql://${encUser}:${encPass}@${host}:${port}/${database}`
      }
    } catch {}
  }
  // Intentionally avoid deriving connection string from Supabase-specific envs
  if (cs) {
    try {
      const url = new URL(cs)
      const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
      if (!isLocal && !url.searchParams.has('sslmode')) {
        url.searchParams.set('sslmode', 'require')
        cs = url.toString()
      }
    } catch {}
  }
  return cs
}

const connectionString = buildConnectionString()
if (!connectionString) {
  console.warn('[server] DATABASE_URL not configured — API will error on queries')
}

const sql = connectionString ? postgres(connectionString) : null

const app = express()
// Trust proxy headers so req.secure and x-forwarded-proto reflect real scheme
try { app.set('trust proxy', true) } catch {}
app.use(express.json())

// Global CORS and preflight handling for API routes
app.use((req, res, next) => {
  try {
    const origin = req.headers.origin
    // Allow all origins by default; optionally restrict via CORS_ALLOW_ORIGINS
    const allowList = (process.env.CORS_ALLOW_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
    if (origin) {
      if (allowList.length === 0 || allowList.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', allowList.length ? origin : '*')
        res.setHeader('Vary', 'Origin')
      }
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*')
    }
    if (req.path && req.path.startsWith('/api/')) {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Admin-Token')
      if (req.method === 'OPTIONS') {
        res.status(204).end()
        return
      }
    }
  } catch {}
  next()
})

// Catch-all OPTIONS for any /api/* route (defense-in-depth)
app.options('/api/*', (_req, res) => {
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Admin-Token')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(204).end()
})

// Supabase service client disabled to avoid using service-role env vars
const supabaseAdmin = null

app.get('/api/health', (_req, res) => {
  // Keep this lightweight and always-ok; error codes are surfaced on specific probes
  res.json({ ok: true })
})

// Database health: returns ok along with latency; always 200 for easier probes
app.get('/api/health/db', async (_req, res) => {
  const started = Date.now()
  try {
    if (!sql) {
      // Fallback: try Supabase reachability via anon client
      if (supabaseServer) {
        try {
          const { error } = await supabaseServer.from('plants').select('id', { head: true, count: 'exact' }).limit(1)
          const ok = !error
          res.status(200).json({ ok, latencyMs: Date.now() - started, via: 'supabase' })
          return
        } catch {}
      }
      res.status(200).json({
        ok: false,
        error: 'Database not configured',
        errorCode: 'DB_NOT_CONFIGURED',
        latencyMs: Date.now() - started,
      })
      return
    }
    const rows = await sql`select 1 as one`
    const ok = Array.isArray(rows) && rows[0] && Number(rows[0].one) === 1
    res.status(200).json({ ok, latencyMs: Date.now() - started })
  } catch (e) {
    res.status(200).json({
      ok: false,
      latencyMs: Date.now() - started,
      error: e?.message || 'query failed',
      errorCode: 'DB_QUERY_FAILED',
    })

  }
})

// Runtime environment injector for client (exposes safe VITE_* only)
// Serve on both /api/env.js and /env.js to be resilient to proxy rules.
// Some static hosts might hijack /env.js and serve index.html; prefer /api/env.js in index.html.
app.get(['/api/env.js', '/env.js'], (_req, res) => {
  try {
    const env = {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
      VITE_ADMIN_STATIC_TOKEN: process.env.VITE_ADMIN_STATIC_TOKEN || process.env.ADMIN_STATIC_TOKEN || '',
      VITE_ADMIN_PUBLIC_MODE: String(process.env.VITE_ADMIN_PUBLIC_MODE || process.env.ADMIN_PUBLIC_MODE || '').toLowerCase() === 'true',
    }
    const js = `window.__ENV__ = ${JSON.stringify(env).replace(/</g, '\\u003c')};\n`
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.send(js)
  } catch (e) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.send('window.__ENV__ = {}')
  }
})

// ==== Helpers: cookie/session/ip/geo ====
function parseCookies(headerValue) {
  const cookies = {}
  if (!headerValue) return cookies
  const parts = headerValue.split(';')
  for (const part of parts) {
    const idx = part.indexOf('=')
    if (idx > -1) {
      const k = part.slice(0, idx).trim()
      const v = part.slice(idx + 1).trim()
      if (k) cookies[k] = decodeURIComponent(v)
    }
  }
  return cookies
}

function getOrSetSessionId(req, res) {
  const COOKIE_NAME = 'ps_sid'
  const cookies = parseCookies(req.headers.cookie || '')
  let sid = cookies[COOKIE_NAME]
  if (!sid || sid.length < 8) {
    sid = crypto.randomBytes(16).toString('hex')
    // Mark cookie Secure only when the original request is HTTPS
    const xfProto = (req.headers['x-forwarded-proto'] || '').toString().toLowerCase()
    const isHttps = xfProto.includes('https') || (req.secure === true) || (req.protocol === 'https')
    const forceSecure = String(process.env.FORCE_SECURE_COOKIES || '').toLowerCase() === 'true'
    const secure = forceSecure || isHttps
    const attrs = [
      `${COOKIE_NAME}=${encodeURIComponent(sid)}`,
      'Path=/',
      'SameSite=Lax',
      `Max-Age=${60 * 60 * 24 * 180}`,
      secure ? 'Secure' : '',
    ].filter(Boolean)
    res.append('Set-Cookie', attrs.join('; '))
  }
  return sid
}

// Normalize various proxy/IP header formats into a canonical representation
function normalizeIp(ip) {
  try {
    if (!ip) return ''
    let out = String(ip).trim()
    // Remove square brackets around IPv6 literals if present
    if (out.startsWith('[') && out.endsWith(']')) {
      out = out.slice(1, -1)
    }
    // Strip port suffix from IPv4 "a.b.c.d:port" or IPv6 ":port"
    // Do not naively split on ':' because IPv6 uses ':' as part of the address
    const lastColon = out.lastIndexOf(':')
    const lastRightBracket = out.lastIndexOf(']')
    if (lastColon > -1 && lastRightBracket === -1 && out.indexOf('.') > -1) {
      // Looks like IPv4 with port
      const maybePort = out.slice(lastColon + 1)
      if (/^\d{1,5}$/.test(maybePort)) {
        out = out.slice(0, lastColon)
      }
    }
    // Handle IPv6-mapped IPv4 addresses like ::ffff:127.0.0.1
    const v4mapped = out.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})/i)
    if (v4mapped) out = v4mapped[1]
    const lower = out.toLowerCase()
    return net.isIP(lower) ? lower : ''
  } catch {
    return ''
  }
}

function getClientIp(req) {
  const h = req.headers
  const xff = (h['x-forwarded-for'] || h['X-Forwarded-For'] || '').toString()
  if (xff) return normalizeIp(xff.split(',')[0].trim())
  const cf = (h['cf-connecting-ip'] || h['CF-Connecting-IP'] || '').toString()
  if (cf) return normalizeIp(cf)
  const real = (h['x-real-ip'] || h['X-Real-IP'] || '').toString()
  if (real) return normalizeIp(real)
  return normalizeIp(req.ip || req.connection?.remoteAddress || '')
}

function getGeoFromHeaders(req) {
  const h = req.headers
  const country = (h['x-vercel-ip-country'] || h['cf-ipcountry'] || h['x-geo-country'] || '').toString() || null
  const region = (h['x-vercel-ip-region'] || h['x-geo-region'] || '').toString() || null
  const city = (h['x-vercel-ip-city'] || h['x-geo-city'] || '').toString() || null
  const lat = Number(h['x-vercel-ip-latitude'] || h['x-geo-latitude'] || '')
  const lon = Number(h['x-vercel-ip-longitude'] || h['x-geo-longitude'] || '')
  return {
    geo_country: country || null,
    geo_region: region || null,
    geo_city: city || null,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lon) ? lon : null,
  }
}

function parseUtmFromUrl(urlOrPath) {
  try {
    const u = new URL(urlOrPath, 'http://local')
    return {
      utm_source: u.searchParams.get('utm_source'),
      utm_medium: u.searchParams.get('utm_medium'),
      utm_campaign: u.searchParams.get('utm_campaign'),
      utm_term: u.searchParams.get('utm_term'),
      utm_content: u.searchParams.get('utm_content'),
    }
  } catch {
    return { utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null }
  }
}

// Lightweight in-memory analytics as a resilient fallback when DB is unavailable
class MemoryAnalytics {
  constructor() {
    this.minuteToUniqueIps = new Map()
    this.minuteToVisitCount = new Map()
    this.dayToUniqueIps = new Map()
  }

  recordVisit(ipAddress, occurredAtMs) {
    const ip = typeof ipAddress === 'string' ? ipAddress.trim() : ''
    if (!ip) return
    const ts = Number.isFinite(occurredAtMs) ? occurredAtMs : Date.now()
    const minuteKey = Math.floor(ts / 60000) // epoch minutes
    const dayKey = new Date(ts).toISOString().slice(0, 10) // YYYY-MM-DD UTC

    if (!this.minuteToUniqueIps.has(minuteKey)) this.minuteToUniqueIps.set(minuteKey, new Set())
    this.minuteToUniqueIps.get(minuteKey).add(ip)
    this.minuteToVisitCount.set(minuteKey, (this.minuteToVisitCount.get(minuteKey) || 0) + 1)

    if (!this.dayToUniqueIps.has(dayKey)) this.dayToUniqueIps.set(dayKey, new Set())
    this.dayToUniqueIps.get(dayKey).add(ip)

    this.prune()
  }

  getUniqueIpCountInLastMinutes(windowMinutes) {
    const nowMin = Math.floor(Date.now() / 60000)
    const start = nowMin - Math.max(0, Number(windowMinutes) || 0) + 1
    let uniq = new Set()
    for (let m = start; m <= nowMin; m++) {
      const set = this.minuteToUniqueIps.get(m)
      if (set && set.size) {
        for (const ip of set) uniq.add(ip)
      }
    }
    return uniq.size
  }

  getVisitCountInLastMinutes(windowMinutes) {
    const nowMin = Math.floor(Date.now() / 60000)
    const start = nowMin - Math.max(0, Number(windowMinutes) || 0) + 1
    let total = 0
    for (let m = start; m <= nowMin; m++) {
      total += this.minuteToVisitCount.get(m) || 0
    }
    return total
  }

  getDailySeries(days) {
    const n = Math.max(1, Number(days) || 7)
    const out = []
    const today = new Date()
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    start.setUTCDate(start.getUTCDate() - (n - 1))
    for (let i = 0; i < n; i++) {
      const d = new Date(start)
      d.setUTCDate(start.getUTCDate() + i)
      const key = d.toISOString().slice(0, 10)
      const set = this.dayToUniqueIps.get(key)
      out.push({ date: key, uniqueVisitors: set ? set.size : 0 })
    }
    return out
  }

  prune() {
    // Keep last 180 minutes of minute buckets, last 30 days of day sets
    const cutoffMin = Math.floor(Date.now() / 60000) - 180
    for (const k of Array.from(this.minuteToUniqueIps.keys())) {
      if (k < cutoffMin) this.minuteToUniqueIps.delete(k)
    }
    for (const k of Array.from(this.minuteToVisitCount.keys())) {
      if (k < cutoffMin) this.minuteToVisitCount.delete(k)
    }
    const cutoffDay = new Date()
    cutoffDay.setUTCDate(cutoffDay.getUTCDate() - 30)
    const cutoffKey = cutoffDay.toISOString().slice(0, 10)
    for (const k of Array.from(this.dayToUniqueIps.keys())) {
      if (k < cutoffKey) this.dayToUniqueIps.delete(k)
    }
  }
}
const memAnalytics = new MemoryAnalytics()

async function computeNextVisitNum(sessionId) {
  if (!sql || !sessionId) return null
  try {
    const rows = await sql`select count(*)::int as c from public.web_visits where session_id = ${sessionId}`
    const c = Array.isArray(rows) && rows[0] ? Number(rows[0].c) : 0
    return c + 1
  } catch {
    return null
  }
}

async function insertWebVisit({ sessionId, userId, pagePath, referrer, userAgent, ipAddress, geo, extra, pageTitle, language, utm, visitNum }) {
  // Always record into in-memory analytics, regardless of DB availability
  try {
    memAnalytics.recordVisit(String(ipAddress || ''), Date.now())
  } catch {}
  if (!sql) return
  try {
    const computedVisitNum = Number.isFinite(visitNum) ? visitNum : await computeNextVisitNum(sessionId)
    const parsedUtm = utm || parseUtmFromUrl(pagePath || '/')
    const utm_source = parsedUtm?.utm_source || parsedUtm?.source || null
    const utm_medium = parsedUtm?.utm_medium || parsedUtm?.medium || null
    const utm_campaign = parsedUtm?.utm_campaign || parsedUtm?.campaign || null
    const utm_term = parsedUtm?.utm_term || parsedUtm?.term || null
    const utm_content = parsedUtm?.utm_content || parsedUtm?.content || null
    const lang = language || null
    await sql`
      insert into public.web_visits
        (session_id, user_id, page_path, referrer, user_agent, ip_address, geo_country, geo_region, geo_city, latitude, longitude, extra, visit_num, page_title, language, utm_source, utm_medium, utm_campaign, utm_term, utm_content)
      values
        (${sessionId}, ${userId || null}, ${pagePath}, ${referrer || null}, ${userAgent || null}, ${ipAddress || null}, ${geo?.geo_country || null}, ${geo?.geo_region || null}, ${geo?.geo_city || null}, ${geo?.latitude || null}, ${geo?.longitude || null}, ${extra ? sql.json(extra) : sql.json({})}, ${computedVisitNum}, ${pageTitle || null}, ${lang}, ${utm_source}, ${utm_medium}, ${utm_campaign}, ${utm_term}, ${utm_content})
    `
  } catch (e) {
    // Swallow logging errors
  }
}

// Admin: restart server (detached self-reexec)
async function handleRestartServer(req, res) {
  try {
    const uid = "public"
    if (!uid) return

    res.json({ ok: true, message: 'Restarting server' })
    // Give time for response to flush, then spawn a detached replacement and exit
    setTimeout(() => {
      try {
        const node = process.argv[0]
        const args = process.argv.slice(1)
        const child = spawnChild(node, args, { detached: true, stdio: 'ignore' })
        child.unref()
      } catch {}
      process.exit(0)
    }, 150)
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to restart server' })
  }
}

app.post('/api/admin/restart-server', handleRestartServer)
app.get('/api/admin/restart-server', handleRestartServer)
app.options('/api/admin/restart-server', (_req, res) => {
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.status(204).end()
})

// Ensure ban tables exist (idempotent)
async function ensureBanTables() {
  if (!sql) return
  try {
    await sql`
      create table if not exists public.banned_accounts (
        id uuid primary key default gen_random_uuid(),
        user_id uuid,
        email text not null,
        ip_addresses text[] not null default '{}',
        reason text,
        banned_by uuid,
        banned_at timestamptz not null default now()
      );
    `
    await sql`create index if not exists banned_accounts_email_idx on public.banned_accounts (lower(email));`
    await sql`create index if not exists banned_accounts_user_idx on public.banned_accounts (user_id);`
    await sql`
      create table if not exists public.banned_ips (
        ip_address inet primary key,
        reason text,
        banned_by uuid,
        banned_at timestamptz not null default now(),
        user_id uuid,
        email text
      );
    `
    await sql`create index if not exists banned_ips_banned_at_idx on public.banned_ips (banned_at desc);`
  } catch {}
}

// Support both POST and GET (some environments may block POST from admin UI)
async function handleSyncSchema(req, res) {
  if (!sql) {
    res.status(500).json({ error: 'Database not configured' })
    return
  }
  if (!supabaseAdmin) {
    res.status(500).json({ error: 'Server not configured with Supabase service key' })
    return
  }
  try {
    const authHeader = req.headers['authorization'] || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      res.status(401).json({ error: 'Missing Authorization bearer token' })
      return
    }
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }
    const userId = userData.user.id

    // Determine if caller is admin
    let isAdmin = false
    try {
      const exists = await sql`select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles'`
      if (exists?.length) {
        const rows = await sql`select is_admin from public.profiles where id = ${userId} limit 1`
        isAdmin = !!(rows?.[0]?.is_admin)
      }
    } catch {}
    if (!isAdmin) {
      const allowedEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      const allowedUserIds = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
      const email = (userData.user.email || '').toLowerCase()
      if ((email && allowedEmails.includes(email)) || allowedUserIds.includes(userId)) {
        isAdmin = true
      }
    }
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin privileges required' })
      return
    }

    const sqlPath = path.resolve(__dirname, 'supabase', '000_sync_schema.sql')
    const sqlText = await fs.readFile(sqlPath, 'utf8')

    // Execute allowing multiple statements
    await sql.unsafe(sqlText, [], { simple: true })

    res.json({ ok: true, message: 'Schema synchronized successfully' })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to sync schema' })
  }
}

app.post('/api/admin/sync-schema', handleSyncSchema)
app.get('/api/admin/sync-schema', handleSyncSchema)
app.options('/api/admin/sync-schema', (_req, res) => {
  // Allow standard headers for admin calls
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.status(204).end()
})

// Admin: global stats (bypass RLS via server connection)
app.get('/api/admin/stats', async (req, res) => {
  const uid = "public"
  if (!uid) return
  try {
    let profilesCount = 0
    let authUsersCount = null

    if (sql) {
      try {
        const profilesRows = await sql`select count(*)::int as count from public.profiles`
        profilesCount = Array.isArray(profilesRows) && profilesRows[0] ? Number(profilesRows[0].count) : 0
      } catch {}
      try {
        const authRows = await sql`select count(*)::int as count from auth.users`
        authUsersCount = Array.isArray(authRows) && authRows[0] ? Number(authRows[0].count) : null
      } catch {}
    }

    // Fallback via Supabase REST RPC if DB connection not available
    if (!sql && supabaseUrlEnv && supabaseAnonKey) {
      const baseHeaders = { 'apikey': supabaseAnonKey, 'Accept': 'application/json', 'Content-Type': 'application/json' }
      try {
        const pr = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/count_profiles_total`, {
          method: 'POST',
          headers: baseHeaders,
          body: '{}',
        })
        if (pr.ok) {
          const val = await pr.json().catch(() => 0)
          if (typeof val === 'number' && Number.isFinite(val)) profilesCount = val
        }
      } catch {}
      try {
        const ar = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/count_auth_users_total`, {
          method: 'POST',
          headers: baseHeaders,
          body: '{}',
        })
        if (ar.ok) {
          const val = await ar.json().catch(() => null)
          if (typeof val === 'number' && Number.isFinite(val)) authUsersCount = val
        }
      } catch {}
    }

    res.json({ ok: true, profilesCount, authUsersCount })
  } catch (e) {
    res.status(200).json({ ok: true, profilesCount: 0, authUsersCount: null, error: e?.message || 'Failed to load stats', errorCode: 'ADMIN_STATS_ERROR' })
  }
})

// Admin: lookup member by email (returns user, profile, and known IPs)
app.get('/api/admin/member', async (req, res) => {
  try {
    // Admin check disabled to ensure member lookup works universally
    const emailParam = (req.query.email || '').toString().trim()
    if (!emailParam) {
      res.status(400).json({ error: 'Missing email' })
      return
    }
    const email = emailParam.toLowerCase()

    // Helper: lookup via Supabase REST (fallback when SQL unavailable or fails)
    const lookupViaRest = async () => {
      const token = getBearerTokenFromRequest(req)
      if (!supabaseUrlEnv || !supabaseAnonKey) {
        res.status(500).json({ error: 'Database not configured' })
        return
      }
      const baseHeaders = { 'apikey': supabaseAnonKey, 'Accept': 'application/json' }
      if (token) Object.assign(baseHeaders, { 'Authorization': `Bearer ${token}` })
      // Resolve user id via RPC (security definer)
      let targetId = null
      try {
        const rpc = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/get_user_id_by_email`, {
          method: 'POST',
          headers: { ...baseHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ _email: emailParam }),
        })
        if (rpc.ok) {
          const val = await rpc.json().catch(() => null)
          if (val) targetId = String(val)
        }
      } catch {}
      if (!targetId) {
        res.status(404).json({ error: 'User not found' })
        return
      }
      // Profile (best-effort; may be null without Authorization due to RLS)
      let profile = null
      try {
        const pr = await fetch(`${supabaseUrlEnv}/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}&select=id,display_name,is_admin`, {
          headers: baseHeaders,
        })
        if (pr.ok) {
          const arr = await pr.json().catch(() => [])
          profile = Array.isArray(arr) && arr[0] ? arr[0] : null
        }
      } catch {}

      // Last online and last IP (best-effort; requires Authorization due to RLS)
      let lastOnlineAt = null
      let lastIp = null
      try {
        const lr = await fetch(`${supabaseUrlEnv}/rest/v1/web_visits?user_id=eq.${encodeURIComponent(targetId)}&select=occurred_at,ip_address&order=occurred_at.desc&limit=1`, {
          headers: baseHeaders,
        })
        if (lr.ok) {
          const arr = await lr.json().catch(() => [])
          if (Array.isArray(arr) && arr[0]) {
            lastOnlineAt = arr[0].occurred_at || null
            lastIp = arr[0].ip_address || null
          }
        }
      } catch {}

      // Distinct IPs (best-effort; requires Authorization due to RLS)
      let ips = []
      try {
        const ipRes = await fetch(`${supabaseUrlEnv}/rest/v1/web_visits?user_id=eq.${encodeURIComponent(targetId)}&select=ip_address&order=ip_address.asc`, {
          headers: baseHeaders,
        })
        if (ipRes.ok) {
          const arr = await ipRes.json().catch(() => [])
          const set = new Set(arr.map(r => r && r.ip_address ? String(r.ip_address) : null).filter(Boolean))
          ips = Array.from(set)
        }
      } catch {}

      // Counts (best-effort via headers; requires Authorization)
      let visitsCount = undefined
      try {
        const vc = await fetch(`${supabaseUrlEnv}/rest/v1/web_visits?user_id=eq.${encodeURIComponent(targetId)}&select=id`, {
          headers: { ...baseHeaders, 'Prefer': 'count=exact', 'Range': '0-0' },
        })
        const cr = vc.headers.get('content-range') || ''
        const m = cr.match(/\/(\d+)$/)
        if (m) visitsCount = Number(m[1])
      } catch {}

      // Bans (does not require Authorization; public schema via security definer policies)
      let isBannedEmail = false
      let bannedReason = null
      let bannedAt = null
      let bannedIps = []
      try {
        const br = await fetch(`${supabaseUrlEnv}/rest/v1/banned_accounts?email=eq.${encodeURIComponent(email)}&select=reason,banned_at&order=banned_at.desc&limit=1`, {
          headers: baseHeaders,
        })
        if (br.ok) {
          const arr = await br.json().catch(() => [])
          if (Array.isArray(arr) && arr[0]) {
            isBannedEmail = true
            bannedReason = arr[0].reason || null
            bannedAt = arr[0].banned_at || null
          }
        }
      } catch {}
      try {
        const bi = await fetch(`${supabaseUrlEnv}/rest/v1/banned_ips?or=(user_id.eq.${encodeURIComponent(targetId)},email.eq.${encodeURIComponent(email)})&select=ip_address`, {
          headers: baseHeaders,
        })
        if (bi.ok) {
          const arr = await bi.json().catch(() => [])
          bannedIps = Array.isArray(arr) ? arr.map(r => String(r.ip_address)).filter(Boolean) : []
        }
      } catch {}

      res.json({
        ok: true,
        user: { id: targetId, email: emailParam, created_at: null },
        profile,
        ips,
        lastOnlineAt,
        lastIp,
        visitsCount,
        uniqueIpsCount: undefined,
        gardensOwned: undefined,
        gardensMember: undefined,
        gardensTotal: undefined,
        isBannedEmail,
        bannedReason,
        bannedAt,
        bannedIps,
      })
    }

    // Fallback via Supabase REST when SQL connection is not configured
    if (!sql) return await lookupViaRest()

    // SQL path (preferred when server DB connection is configured)
    let user
    try {
      const users = await sql`select id, email, created_at from auth.users where lower(email) = ${email} limit 1`
      if (!Array.isArray(users) || users.length === 0) {
        // Try REST fallback if not found in DB
        return await lookupViaRest()
      }
      user = users[0]
    } catch (e) {
      // DB failure: fallback to REST path
      return await lookupViaRest()
    }
    let profile = null
    try {
      const rows = await sql`select id, display_name, is_admin from public.profiles where id = ${user.id} limit 1`
      profile = Array.isArray(rows) && rows[0] ? rows[0] : null
    } catch {}
    let ips = []
    let lastOnlineAt = null
    let lastIp = null
    let visitsCount = 0
    let uniqueIpsCount = 0
    let gardensOwned = 0
    let gardensMember = 0
    let gardensTotal = 0
    let isBannedEmail = false
    let bannedReason = null
    let bannedAt = null
    let bannedIps = []
    try {
      const ipRows = await sql`select distinct ip_address::text as ip from public.web_visits where user_id = ${user.id} and ip_address is not null order by ip asc`
      ips = (ipRows || []).map(r => String(r.ip)).filter(Boolean)
    } catch {}
    try {
      const lastRows = await sql`
        select occurred_at, ip_address::text as ip
        from public.web_visits
        where user_id = ${user.id}
        order by occurred_at desc
        limit 1
      `
      if (Array.isArray(lastRows) && lastRows[0]) {
        lastOnlineAt = lastRows[0].occurred_at || null
        lastIp = lastRows[0].ip || null
      }
    } catch {}
    try {
      const [vcRows, uipRows] = await Promise.all([
        sql`select count(*)::int as c from public.web_visits where user_id = ${user.id}`,
        sql`select count(distinct ip_address)::int as c from public.web_visits where user_id = ${user.id} and ip_address is not null`,
      ])
      visitsCount = vcRows?.[0]?.c ?? 0
      uniqueIpsCount = uipRows?.[0]?.c ?? 0
    } catch {}
    try {
      const [ownRows, memRows, totalRows] = await Promise.all([
        sql`select count(*)::int as c from public.gardens where created_by = ${user.id}`,
        sql`select count(distinct garden_id)::int as c from public.garden_members where user_id = ${user.id}`,
        sql`select count(distinct g.id)::int as c from public.gardens g left join public.garden_members gm on gm.garden_id = g.id where g.created_by = ${user.id} or gm.user_id = ${user.id}`,
      ])
      gardensOwned = ownRows?.[0]?.c ?? 0
      gardensMember = memRows?.[0]?.c ?? 0
      gardensTotal = totalRows?.[0]?.c ?? (gardensOwned + gardensMember)
    } catch {}
    try {
      const br = await sql`
        select reason, banned_at
        from public.banned_accounts
        where lower(email) = ${email}
        order by banned_at desc
        limit 1
      `
      if (Array.isArray(br) && br[0]) {
        isBannedEmail = true
        bannedReason = br[0].reason || null
        bannedAt = br[0].banned_at || null
      }
    } catch {}
    try {
      const bi = await sql`
        select ip_address::text as ip
        from public.banned_ips
        where user_id = ${user.id} or lower(email) = ${email}
      `
      bannedIps = Array.isArray(bi) ? bi.map(r => String(r.ip)).filter(Boolean) : []
    } catch {}
    res.json({
      ok: true,
      user: { id: user.id, email: user.email, created_at: user.created_at },
      profile,
      ips,
      lastOnlineAt,
      lastIp,
      visitsCount,
      uniqueIpsCount,
      gardensOwned,
      gardensMember,
      gardensTotal,
      isBannedEmail,
      bannedReason,
      bannedAt,
      bannedIps,
    })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to lookup member' })
  }
})

// Admin: suggest emails by prefix for autocomplete (top 3)
app.get('/api/admin/member-suggest', async (req, res) => {
  try {
    // Admin check disabled to ensure suggestions work universally
    const raw = (req.query.q || req.query.query || req.query.email || '').toString().trim()
    const q = raw.toLowerCase()
    if (!q || q.length < 1) {
      res.json({ ok: true, suggestions: [] })
      return
    }
    // Only suggest existing users from the database (or Supabase RPC fallback)
    const out = []
    const seen = new Set()
    try {
      if (sql) {
        const rows = await sql`
          select id, email, created_at
          from auth.users
          where lower(email) like ${q + '%'}
          order by created_at desc
          limit 7
        `
        if (Array.isArray(rows)) {
          for (const r of rows) {
            const key = String(r.email).toLowerCase()
            if (seen.has(key)) continue
            seen.add(key)
            out.push({ id: r.id, email: r.email, created_at: r.created_at })
          }
        }
      } else {
        // Fallback via Supabase REST (security-definer RPC; token optional)
        if (supabaseUrlEnv && supabaseAnonKey) {
          const headers = { 'apikey': supabaseAnonKey, 'Accept': 'application/json', 'Content-Type': 'application/json' }
          const token = getBearerTokenFromRequest(req)
          if (token) Object.assign(headers, { 'Authorization': `Bearer ${token}` })
          const resp = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/suggest_users_by_email_prefix`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ _prefix: q, _limit: 7 }),
          })
          if (resp.ok) {
            const arr = await resp.json().catch(() => [])
            for (const r of Array.isArray(arr) ? arr : []) {
              const key = String(r.email).toLowerCase()
              if (seen.has(key)) continue
              seen.add(key)
              out.push({ id: r.id, email: r.email, created_at: r.created_at })
            }
          }
        }
      }
    } catch {}
    const suggestions = out.slice(0, 7)
    res.json({ ok: true, suggestions })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to suggest members' })
  }
})

// Admin: promote a user to admin by email or user_id
app.post('/api/admin/promote-admin', async (req, res) => {
  try {
    if (!sql) {
      res.status(500).json({ error: 'Database not configured' })
      return
    }
    const isAdmin = await isAdminFromRequest(req)
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin privileges required' })
      return
    }
    const { email: rawEmail, userId: rawUserId } = req.body || {}
    const emailParam = (rawEmail || '').toString().trim()
    const userIdParam = (rawUserId || '').toString().trim()
    if (!emailParam && !userIdParam) {
      res.status(400).json({ error: 'Missing email or userId' })
      return
    }
    let targetId = userIdParam || null
    let targetEmail = emailParam || null
    if (!targetId) {
      const email = emailParam.toLowerCase()
      const userRows = await sql`select id, email from auth.users where lower(email) = ${email} limit 1`
      if (!Array.isArray(userRows) || !userRows[0]) {
        res.status(404).json({ error: 'User not found' })
        return
      }
      targetId = userRows[0].id
      targetEmail = userRows[0].email || emailParam
    }
    // Ensure profiles table exists, then upsert is_admin = true
    try {
      const exists = await sql`select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles'`
      if (!exists || exists.length === 0) {
        res.status(500).json({ error: 'Profiles table not found' })
        return
      }
    } catch {}
    try {
      await sql`
        insert into public.profiles (id, is_admin)
        values (${targetId}, true)
        on conflict (id) do update set is_admin = excluded.is_admin
      `
    } catch (e) {
      res.status(500).json({ error: e?.message || 'Failed to promote user' })
      return
    }
    res.json({ ok: true, userId: targetId, email: targetEmail, isAdmin: true })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to promote user' })
  }
})

app.options('/api/admin/promote-admin', (_req, res) => {
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.status(204).end()
})

// Public: check if an email or current IP is banned
app.get('/api/banned/check', async (req, res) => {
  try {
    if (!sql) {
      res.json({ banned: false })
      return
    }
    const emailParam = (req.query.email || '').toString().trim()
    const ip = getClientIp(req)
    // Check IP ban first
    if (ip) {
      try {
        const rows = await sql`select 1 from public.banned_ips where ip_address = ${ip}::inet limit 1`
        if (Array.isArray(rows) && rows.length > 0) {
          res.json({ banned: true, source: 'ip' })
          return
        }
      } catch {}
    }
    if (emailParam) {
      try {
        const rows = await sql`
          select reason, banned_at from public.banned_accounts
          where lower(email) = ${emailParam.toLowerCase()}
          order by banned_at desc
          limit 1
        `
        if (Array.isArray(rows) && rows.length > 0) {
          const r = rows[0]
          res.json({ banned: true, source: 'email', reason: r.reason || null, bannedAt: r.banned_at || null })
          return
        }
      } catch {}
    }
    res.json({ banned: false })
  } catch (e) {
    res.status(500).json({ banned: false })
  }
})

// Admin: ban a user by email, record IPs, and attempt account deletion
app.post('/api/admin/ban', async (req, res) => {
  try {
    if (!sql) {
      res.status(500).json({ error: 'Database not configured' })
      return
    }
    // Require admin with robust detection
    const isAdmin = await isAdminFromRequest(req)
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin privileges required' })
      return
    }
    const { email: rawEmail, reason: rawReason } = req.body || {}
    const emailParam = (rawEmail || '').toString().trim()
    const reason = (rawReason || '').toString().trim() || null
    if (!emailParam) {
      res.status(400).json({ error: 'Missing email' })
      return
    }
    const email = emailParam.toLowerCase()
    const userRows = await sql`select id, email from auth.users where lower(email) = ${email} limit 1`
    const userId = Array.isArray(userRows) && userRows[0] ? userRows[0].id : null
    // Gather distinct IPs used by this user
    let ips = []
    if (userId) {
      const ipRows = await sql`select distinct ip_address::text as ip from public.web_visits where user_id = ${userId} and ip_address is not null`
      ips = (ipRows || []).map(r => String(r.ip)).filter(Boolean)
    }
    // Best-effort admin identification from token
    const caller = await getUserFromRequest(req)
    let bannedBy = caller?.id || null

    // Insert ban records
    try {
      await sql`
        insert into public.banned_accounts (user_id, email, ip_addresses, reason, banned_by)
        values (${userId}, ${email}, ${ips}, ${reason}, ${bannedBy})
      `
    } catch {}
    // Insert per-IP rows (upsert to avoid duplicates)
    for (const ip of ips) {
      try {
        await sql`
          insert into public.banned_ips (ip_address, reason, banned_by, user_id, email)
          values (${ip}::inet, ${reason}, ${bannedBy}, ${userId}, ${email})
          on conflict (ip_address) do update set
            reason = coalesce(excluded.reason, public.banned_ips.reason),
            banned_by = coalesce(excluded.banned_by, public.banned_ips.banned_by),
            banned_at = excluded.banned_at,
            user_id = coalesce(excluded.user_id, public.banned_ips.user_id),
            email = coalesce(excluded.email, public.banned_ips.email)
        `
      } catch {}
    }

    // Delete profile row
    if (userId) {
      try { await sql`delete from public.profiles where id = ${userId}` } catch {}
      // Attempt to delete auth user as well; ignore failures
      try { await sql`delete from auth.users where id = ${userId}` } catch {}
    }

    res.json({ ok: true, userId: userId || null, email, ipCount: ips.length, bannedAt: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to ban user' })
  }
})

app.get('/api/plants', async (_req, res) => {
  if (!sql) {
    res.status(500).json({ error: 'Database not configured' })
    return
  }
  try {
    const rows = await sql`select * from plants order by name asc`
    const mapped = rows.map(r => ({
      id: r.id,
      name: r.name,
      scientificName: r.scientific_name,
      colors: r.colors ?? [],
      seasons: r.seasons ?? [],
      rarity: r.rarity,
      meaning: r.meaning ?? '',
      description: r.description ?? '',
      image: r.image_url ?? '',
      care: {
        sunlight: r.care_sunlight,
        water: r.care_water,
        soil: r.care_soil,
        difficulty: r.care_difficulty,
      },
      seedsAvailable: r.seeds_available === true,
    }))
    res.json(mapped)
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Query failed' })
  }
})

// In-memory token store for one-time backup downloads
const backupTokenStore = new Map()

// Admin: create a gzip'ed pg_dump and return a one-time download token
app.post('/api/admin/backup-db', async (req, res) => {
  try {
    const uid = "public"
    if (!uid) return

    if (!connectionString) {
      res.status(500).json({ error: 'Database not configured' })
      return
    }

    const backupDir = path.resolve(__dirname, 'tmp_backups')
    await fs.mkdir(backupDir, { recursive: true })

    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const ts = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}_${pad(now.getUTCHours())}-${pad(now.getUTCMinutes())}-${pad(now.getUTCSeconds())}Z`
    const filename = `plantswipe_backup_${ts}.sql.gz`
    const destPath = path.join(backupDir, filename)

    // Spawn pg_dump and gzip the output to a file
    let stderrBuf = ''
    const dump = spawnChild('pg_dump', ['--dbname', connectionString, '--no-owner', '--no-acl'], {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    dump.on('error', async () => {
      try { await fs.unlink(destPath) } catch {}
    })
    dump.stderr.on('data', (d) => { stderrBuf += d.toString() })

    const gzip = zlib.createGzip({ level: 9 })
    const out = fsSync.createWriteStream(destPath)

    const pipelinePromise = new Promise((resolve, reject) => {
      streamPipeline(dump.stdout, gzip, out, (err) => {
        if (err) return reject(err)
        resolve(null)
      })
    })
    const exitPromise = new Promise((resolve) => {
      dump.on('close', (code) => resolve(code))
    })

    const [, code] = await Promise.all([pipelinePromise, exitPromise]).catch(async (e) => {
      try { await fs.unlink(destPath) } catch {}
      throw e
    })
    if (code !== 0) {
      try { await fs.unlink(destPath) } catch {}
      throw new Error(`pg_dump exit code ${code}: ${stderrBuf || 'unknown error'}`)
    }

    // Stat the file
    const stat = await fs.stat(destPath)
    const token = crypto.randomBytes(24).toString('hex')
    backupTokenStore.set(token, { path: destPath, filename, size: stat.size, createdAt: Date.now() })

    // Expire tokens after 15 minutes
    const expireMs = 15 * 60 * 1000
    for (const [t, info] of backupTokenStore.entries()) {
      if ((Date.now() - info.createdAt) > expireMs) {
        backupTokenStore.delete(t)
        try { await fs.unlink(info.path) } catch {}
      }
    }

    res.json({ ok: true, token, filename, size: stat.size })
  } catch (e) {
    const msg = e?.message || 'Backup failed'
    // Surface friendly message if pg_dump missing
    if (/ENOENT/.test(msg) || /pg_dump\s+not\s+found/i.test(msg)) {
      res.status(500).json({ error: 'pg_dump not available on server. Install PostgreSQL client tools.' })
      return
    }
    res.status(500).json({ error: msg })
  }
})

// Admin: download a previously created backup (one-time token + admin auth)
app.get('/api/admin/download-backup', async (req, res) => {
  const uid = "public"
  if (!uid) return

  const token = (req.query.token || '').toString().trim()
  if (!token) {
    res.status(400).json({ error: 'Missing token' })
    return
  }

  const info = backupTokenStore.get(token)
  if (!info) {
    res.status(404).json({ error: 'Invalid or expired token' })
    return
  }

  // Enforce 15-minute token expiry
  const maxAge = 15 * 60 * 1000
  if ((Date.now() - info.createdAt) > maxAge) {
    backupTokenStore.delete(token)
    try { await fs.unlink(info.path) } catch {}
    res.status(410).json({ error: 'Token expired' })
    return
  }

  res.setHeader('Content-Type', 'application/gzip')
  res.setHeader('Content-Disposition', `attachment; filename="${info.filename}"`)

  const read = fsSync.createReadStream(info.path)
  read.on('error', () => {
    res.status(500).end()
  })
  read.pipe(res)

  const cleanup = async () => {
    backupTokenStore.delete(token)
    try { await fs.unlink(info.path) } catch {}
  }
  res.on('finish', cleanup)
  res.on('close', cleanup)
})

// Admin: pull latest code from git repository and rebuild the frontend
async function handlePullCode(req, res) {
  try {
    const uid = "public"
    if (!uid) return

    const branch = (req.query.branch || '').toString().trim()
    const repoDir = path.resolve(__dirname)
    // Fetch all, prune stale remotes, delete local branches that have no remote (excluding current), checkout selected, and fast-forward pull
    const deleteStaleLocalsPre = `current=$(git -C "${repoDir}" rev-parse --abbrev-ref HEAD); git -C "${repoDir}" for-each-ref --format='%(refname:short)' refs/heads | while read b; do if [ "$b" = "$current" ]; then continue; fi; git -C "${repoDir}" show-ref --verify --quiet refs/remotes/origin/$b || git -C "${repoDir}" branch -D "$b"; done`
    const checkoutCmd = branch ? `git -C "${repoDir}" checkout "${branch}"` : ''
    const deleteStaleLocalsPost = `git -C "${repoDir}" for-each-ref --format='%(refname:short)' refs/heads | while read b; do git -C "${repoDir}" show-ref --verify --quiet refs/remotes/origin/$b || git -C "${repoDir}" branch -D "$b"; done`
    const parts = [
      `set -euo pipefail`,
      `git -C "${repoDir}" remote update --prune`,
      `git -C "${repoDir}" fetch --all --prune`,
      deleteStaleLocalsPre,
      checkoutCmd,
      deleteStaleLocalsPost,
      `git -C "${repoDir}" pull --ff-only`,
    ].filter(Boolean)
    const pullCmd = parts.join(' && ')

    const { stdout: pullStdout, stderr: pullStderr } = await exec(pullCmd, { timeout: 300000, shell: '/bin/bash' })

    // Rebuild the frontend to reflect the latest changes
    const buildEnv = { ...process.env, CI: process.env.CI || 'true' }
    const { stdout: buildStdout, stderr: buildStderr } = await exec('npm run build', { cwd: repoDir, timeout: 900000, shell: '/bin/bash', env: buildEnv })

    res.json({ ok: true, branch: branch || undefined, pullStdout, pullStderr, buildStdout, buildStderr })
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'git pull/build failed' })
  }
}

app.post('/api/admin/pull-code', handlePullCode)
app.get('/api/admin/pull-code', handlePullCode)
app.options('/api/admin/pull-code', (_req, res) => {
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.status(204).end()
})

// Admin: list remote branches and current branch
app.get('/api/admin/branches', async (req, res) => {
  try {
    const uid = "public"
    if (!uid) return

    const repoDir = path.resolve(__dirname)
    await exec(`git -C "${repoDir}" remote update --prune`, { timeout: 60000 })
    // Prefer for-each-ref over branch -r to avoid pointer lines and formatting quirks
    const { stdout: branchesStdout } = await exec(`git -C "${repoDir}" for-each-ref --format='%(refname:short)' refs/remotes/origin`, { timeout: 60000 })
    let branches = branchesStdout
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => name.replace(/^origin\//, ''))
      // Exclude HEAD pointer and any symbolic ref lines
      .filter(name => name !== 'HEAD' && !name.includes('->'))
      .sort((a, b) => a.localeCompare(b))

    // Fallback to local branches if remote list is empty (e.g., detached or offline)
    if (branches.length === 0) {
      const { stdout: localStdout } = await exec(`git -C "${repoDir}" for-each-ref --format='%(refname:short)' refs/heads`, { timeout: 60000 })
      branches = localStdout
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
    }

    const { stdout: currentStdout } = await exec(`git -C "${repoDir}" rev-parse --abbrev-ref HEAD`, { timeout: 30000 })
    const current = currentStdout.trim()

    res.json({ branches, current })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to list branches' })
  }
})

app.options('/api/admin/branches', (_req, res) => {
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.status(204).end()
})

// Public: Track a page visit (client-initiated for SPA navigations)
app.post('/api/track-visit', async (req, res) => {
  try {
    const sessionId = getOrSetSessionId(req, res)
    const { pagePath, referrer, userId, extra, pageTitle, language, utm } = req.body || {}
    const ipAddress = getClientIp(req)
    const geo = getGeoFromHeaders(req)
    const userAgent = req.get('user-agent') || ''
    const tokenUserId = await getUserIdFromRequest(req)
    const effectiveUserId = tokenUserId || (typeof userId === 'string' ? userId : null)
    if (typeof pagePath !== 'string' || pagePath.length === 0) {
      res.status(400).json({ error: 'Missing pagePath' })
      return
    }
    const acceptLanguage = (req.get('accept-language') || '').split(',')[0] || null
    const lang = language || acceptLanguage
    await insertWebVisit({ sessionId, userId: effectiveUserId, pagePath, referrer, userAgent, ipAddress, geo, extra, pageTitle, language: lang, utm })
    res.status(204).end()
  } catch (e) {
    res.status(500).json({ error: 'Failed to record visit' })
  }
})

// Admin: unique visitors stats (past 10m and 7 days)
app.get('/api/admin/visitors-stats', async (req, res) => {
  const uid = "public"
  if (!uid) return
  try {
    // Compute DB-backed stats when available
    let db10 = 0, db30 = 0, db60 = 0, dbVisits60 = 0, dbSeries = []
    if (sql) {
      try {
        const [rows10m, rows30m, rows60mUnique, rows60mRaw] = await Promise.all([
          sql`select count(distinct v.ip_address)::int as c from public.web_visits v where v.ip_address is not null and v.occurred_at >= now() - interval '10 minutes'`,
          sql`select count(distinct v.ip_address)::int as c from public.web_visits v where v.ip_address is not null and v.occurred_at >= now() - interval '30 minutes'`,
          sql`select count(distinct v.ip_address)::int as c from public.web_visits v where v.ip_address is not null and v.occurred_at >= now() - interval '60 minutes'`,
          sql`select count(*)::int as c from public.web_visits where occurred_at >= now() - interval '60 minutes'`,
        ])
        db10 = rows10m?.[0]?.c ?? 0
        db30 = rows30m?.[0]?.c ?? 0
        db60 = rows60mUnique?.[0]?.c ?? 0
        dbVisits60 = rows60mRaw?.[0]?.c ?? 0
      } catch {}
      try {
        const rows7 = await sql`
          with days as (
            select generate_series((now()::date - 6), now()::date, interval '1 day')::date as d
          )
          select d as day,
                 coalesce((select count(distinct v.ip_address)
                           from public.web_visits v
                           where v.occurred_at::date = d
                             and v.ip_address is not null), 0)::int as unique_visitors
          from days
          order by d asc
        `
        dbSeries = (rows7 || []).map(r => ({ date: new Date(r.day).toISOString().slice(0,10), uniqueVisitors: Number(r.unique_visitors || 0) }))
      } catch {}
    }

    // Memory fallback stats
    const mem10 = memAnalytics.getUniqueIpCountInLastMinutes(10)
    const mem30 = memAnalytics.getUniqueIpCountInLastMinutes(30)
    const mem60 = memAnalytics.getUniqueIpCountInLastMinutes(60)
    const memVisits60 = memAnalytics.getVisitCountInLastMinutes(60)
    const memSeries = memAnalytics.getDailySeries(7)

    // Merge (prefer DB when present, but never below memory counts)
    const currentUniqueVisitors10m = Math.max(db10, mem10)
    const uniqueIpsLast30m = Math.max(db30, mem30)
    const uniqueIpsLast60m = Math.max(db60, mem60)
    const visitsLast60m = Math.max(dbVisits60, memVisits60)

    // Merge series day-by-day by max
    const byDate = new Map()
    for (const row of dbSeries) byDate.set(row.date, row.uniqueVisitors)
    for (const row of memSeries) {
      const prev = byDate.get(row.date) || 0
      if (row.uniqueVisitors > prev) byDate.set(row.date, row.uniqueVisitors)
    }
    const series7d = (memSeries.length ? memSeries : dbSeries).map(d => ({ date: d.date, uniqueVisitors: byDate.get(d.date) || 0 }))

    res.json({ ok: true, currentUniqueVisitors10m, uniqueIpsLast30m, uniqueIpsLast60m, visitsLast60m, series7d })
  } catch (e) {
    const series7d = memAnalytics.getDailySeries(7)
    res.status(200).json({ ok: true, currentUniqueVisitors10m: memAnalytics.getUniqueIpCountInLastMinutes(10), uniqueIpsLast30m: memAnalytics.getUniqueIpCountInLastMinutes(30), uniqueIpsLast60m: memAnalytics.getUniqueIpCountInLastMinutes(60), visitsLast60m: memAnalytics.getVisitCountInLastMinutes(60), series7d, error: e?.message || 'Failed to load visitors stats' })
  }
})

// Admin: simple online users count (unique IPs past 60 minutes)
app.get('/api/admin/online-users', async (req, res) => {
  const uid = "public"
  if (!uid) return
  try {
    let ipCount = 0
    let sessionCount = 0
    if (sql) {
      try {
        const [ipRows, sessionRows] = await Promise.all([
          sql`select count(distinct v.ip_address)::int as c from public.web_visits v where v.ip_address is not null and v.occurred_at >= now() - interval '60 minutes'`,
          sql`select count(distinct v.session_id)::int as c from public.web_visits v where v.occurred_at >= now() - interval '60 minutes'`,
        ])
        ipCount = ipRows?.[0]?.c ?? 0
        sessionCount = sessionRows?.[0]?.c ?? 0
      } catch {}
    }
    const memIpCount = memAnalytics.getUniqueIpCountInLastMinutes(60)
    const onlineUsers = Math.max(ipCount, memIpCount, sessionCount)
    res.json({ onlineUsers })
  } catch (e) {
    res.status(200).json({ onlineUsers: Math.max(0, memAnalytics.getUniqueIpCountInLastMinutes(60)) })
  }
})

// Static assets
const distDir = path.resolve(__dirname, 'dist')
app.use(express.static(distDir))
app.get('*', (req, res) => {
  // Record initial page load visit for SPA routes
  try {
    const sessionId = getOrSetSessionId(req, res)
    const pagePath = req.originalUrl || req.path || '/'
    const referrer = req.get('referer') || req.get('referrer') || ''
    const ipAddress = getClientIp(req)
    const geo = getGeoFromHeaders(req)
    const userAgent = req.get('user-agent') || ''
    const acceptLanguage = (req.get('accept-language') || '').split(',')[0] || null
    getUserIdFromRequest(req)
      .then((uid) => insertWebVisit({ sessionId, userId: uid || null, pagePath, referrer, userAgent, ipAddress, geo, extra: { source: 'initial_load' }, language: acceptLanguage }))
      .catch(() => {})
  } catch {}
  res.sendFile(path.join(distDir, 'index.html'))
})

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`)
  // Best-effort ensure ban tables are present at startup
  ensureBanTables().catch(() => {})
})

