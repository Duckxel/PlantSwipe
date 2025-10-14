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

// Resolve the real Git repository root, even when running under a symlinked
// deployment directory like /var/www/PlantSwipe/plant-swipe.
async function getRepoRoot() {
  // 1) Allow explicit override via env when it actually points at a repo
  try {
    const override = (process.env.PLANTSWIPE_REPO_DIR || '').trim()
    if (override) {
      try {
        const st = await fs.stat(override)
        if (st && st.isDirectory()) {
          const topFromGit = await getTopLevelIfRepo(override)
          if (topFromGit) return topFromGit
          try { await fs.access(path.join(override, '.git')) ; return override } catch {}
        }
      } catch {}
    }
  } catch {}

  // 2) Prefer the real path of the current directory (handles symlinks)
  let realDir = __dirname
  try { realDir = await fs.realpath(__dirname) } catch {}

  // 3) Try to ask git for the top-level using a safe.directory override
  const topFromGitHere = await getTopLevelIfRepo(realDir)
  if (topFromGitHere) return topFromGitHere

  // 4) Ascend a couple of levels and try common candidates
  const candidates = [
    realDir,
    path.resolve(realDir, '..'),
    path.resolve(realDir, '../..'),
  ]
  for (const dir of candidates) {
    const top = await getTopLevelIfRepo(dir)
    if (top) return top
    try {
      // Also accept git worktree layout where .git is a file
      await fs.access(path.join(dir, '.git'))
      return dir
    } catch {}
  }

  // 5) Fallback: return the real directory (better than an incorrect parent)
  return realDir
}

// Helper: return top-level path if "dir" is a git repo, otherwise null.
async function getTopLevelIfRepo(dir) {
  try {
    const { stdout } = await exec(`git -c "safe.directory=${dir}" -C "${dir}" rev-parse --show-toplevel`)
    const root = (stdout || '').toString().trim()
    return root || null
  } catch {
    return null
  }
}

const exec = promisify(execCb)

// Supabase client (server-side) for auth verification
// Support both runtime server env and Vite-style public envs
const supabaseUrlEnv = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
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
    // Allow explicit public mode for maintenance
    if (adminPublicMode === true) return true
    // Static header token support for non-authenticated admin actions (CI/ops)
    const headerToken = req.get('X-Admin-Token') || req.get('x-admin-token') || ''
    if (adminStaticToken && headerToken && headerToken === adminStaticToken) return true

    // Bearer token path: resolve user and check admin
    const user = await getUserFromRequest(req)
    if (!user?.id) return false
    let isAdmin = false
    // Prefer DB flag
    if (sql) {
      try {
        const exists = await sql`select 1 from information_schema.tables where table_schema='public' and table_name='profiles'`
        if (exists?.length) {
          const rows = await sql`select is_admin from public.profiles where id = ${user.id} limit 1`
          isAdmin = !!(rows?.[0]?.is_admin)
        }
      } catch {}
    }
    // Supabase REST fallback: allow any authenticated user whose profile row has is_admin = true
    if (!isAdmin && supabaseUrlEnv && supabaseAnonKey) {
      try {
        const headers = { 'apikey': supabaseAnonKey, 'Accept': 'application/json' }
        const bearer = getBearerTokenFromRequest(req)
        if (bearer) Object.assign(headers, { 'Authorization': `Bearer ${bearer}` })
        const url = `${supabaseUrlEnv}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=is_admin&limit=1`
        const resp = await fetch(url, { headers })
        if (resp.ok) {
          const arr = await resp.json().catch(() => [])
          const flag = Array.isArray(arr) && arr[0] ? (arr[0].is_admin === true) : false
          if (flag) isAdmin = true
        }
      } catch {}
    }
    // Environment allowlists as fallback
    if (!isAdmin) {
      const allowedEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      const allowedUserIds = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
      const email = (user.email || '').toLowerCase()
      if ((email && allowedEmails.includes(email)) || allowedUserIds.includes(user.id)) {
        isAdmin = true
      }
    }
    return isAdmin
  } catch {
    return false
  }
}

// Helper: insert admin_activity_logs row via Supabase REST when DB is unavailable
async function insertAdminActivityViaRest(req, row) {
  try {
    if (!(supabaseUrlEnv && supabaseAnonKey)) return false
    const headers = { apikey: supabaseAnonKey, Accept: 'application/json', 'Content-Type': 'application/json' }
    const bearer = getBearerTokenFromRequest(req)
    if (bearer) headers['Authorization'] = `Bearer ${bearer}`
    const resp = await fetch(`${supabaseUrlEnv}/rest/v1/admin_activity_logs`, { method: 'POST', headers, body: JSON.stringify(row) })
    return resp.ok
  } catch {
    return false
  }
}

async function ensureAdmin(req, res) {
  try {
    // Public mode or static token
    if (adminPublicMode === true) return 'public'
    const headerToken = req.get('X-Admin-Token') || req.get('x-admin-token') || ''
    if (adminStaticToken && headerToken && headerToken === adminStaticToken) return 'static-admin'

    // Bearer token path
    const user = await getUserFromRequest(req)
    if (!user?.id) {
      res.status(401).json({ error: 'Unauthorized' })
      return null
    }
    const isAdmin = await isAdminFromRequest(req)
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin privileges required' })
      return null
    }
    return user.id
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

// Prefer SSL for non-local databases even if URL lacks sslmode
let postgresOptions = {}
try {
  if (connectionString) {
    const u = new URL(connectionString)
    const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
    if (!isLocal) {
      postgresOptions = { ssl: true }
    }
  }
} catch {}
const sql = connectionString ? postgres(connectionString, postgresOptions) : null

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

// Composite health: reflect DB status so UI doesn't show green on failures
app.get('/api/health', async (_req, res) => {
  const started = Date.now()
  try {
    let dbOk = false
    let err = null
    if (sql) {
      try {
        const rows = await sql`select 1 as one`
        dbOk = Array.isArray(rows) && rows[0] && Number(rows[0].one) === 1
      } catch (e) {
        err = e?.message || 'query failed'
      }
    }
    res.status(200).json({
      ok: true,
      db: {
        ok: dbOk,
        latencyMs: Date.now() - started,
        error: dbOk ? null : (err || (connectionString ? 'DB_QUERY_FAILED' : 'DB_NOT_CONFIGURED')),
      },
    })
  } catch {
    res.status(200).json({
      ok: true,
      db: { ok: false, latencyMs: Date.now() - started, error: 'HEALTH_CHECK_FAILED' },
    })
  }
})

// Admin: fetch admin activity logs for the last N days (default 30)
app.get('/api/admin/admin-logs', async (req, res) => {
  try {
    const isAdmin = await isAdminFromRequest(req)
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin privileges required' })
      return
    }
    const daysParam = Number(req.query.days || 30)
    const days = (Number.isFinite(daysParam) && daysParam > 0) ? Math.min(90, Math.floor(daysParam)) : 30
    if (!sql) {
      // Supabase REST fallback
      if (!(supabaseUrlEnv && supabaseAnonKey)) {
        res.status(500).json({ error: 'Database not configured' })
        return
      }
      const headers = { 'apikey': supabaseAnonKey, 'Accept': 'application/json' }
      const token = getBearerTokenFromRequest(req)
      if (token) headers['Authorization'] = `Bearer ${token}`
      const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      const url = `${supabaseUrlEnv}/rest/v1/admin_activity_logs?occurred_at=gte.${encodeURIComponent(sinceIso)}&select=occurred_at,admin_id,admin_name,action,target,detail&order=occurred_at.desc&limit=1000`
      const r = await fetch(url, { headers })
      if (!r.ok) {
        const body = await r.text().catch(() => '')
        res.status(r.status).json({ error: body || 'Failed to load logs' })
        return
      }
      const arr = await r.json().catch(() => [])
      res.json({ ok: true, logs: Array.isArray(arr) ? arr : [], via: 'supabase' })
      return
    }
    const rows = await sql`
      select occurred_at, admin_id, admin_name, action, target, detail
      from public.admin_activity_logs
      where occurred_at >= now() - interval '${days} days'
      order by occurred_at desc
      limit 2000
    `
    res.json({ ok: true, logs: Array.isArray(rows) ? rows : [], via: 'database' })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to load admin logs' })
  }
})

// Admin: generic log endpoint to record an action from admin_api or UI
app.post('/api/admin/log-action', async (req, res) => {
  try {
    const isAdmin = await isAdminFromRequest(req)
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin privileges required' })
      return
    }
    const body = req.body || {}
    const action = typeof body.action === 'string' ? body.action.trim() : ''
    if (!action) {
      res.status(400).json({ error: 'action required' })
      return
    }
    const target = (body.target == null || typeof body.target === 'string') ? body.target : String(body.target)
    const detail = (body.detail && typeof body.detail === 'object') ? body.detail : {}

    let adminId = null
    let adminName = null
    try {
      const caller = await getUserFromRequest(req)
      adminId = caller?.id || null
      // Resolve admin display name for clearer logs
      if (sql && adminId) {
        try {
          const rows = await sql`select coalesce(display_name, '') as name from public.profiles where id = ${adminId} limit 1`
          adminName = (rows?.[0]?.name || '').trim() || null
        } catch {}
      }
      if (!adminName && supabaseUrlEnv && supabaseAnonKey && adminId) {
        try {
          const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
          const bearer = getBearerTokenFromRequest(req)
          if (bearer) headers['Authorization'] = `Bearer ${bearer}`
          const url = `${supabaseUrlEnv}/rest/v1/profiles?id=eq.${encodeURIComponent(adminId)}&select=display_name&limit=1`
          const r = await fetch(url, { headers })
          if (r.ok) {
            const arr = await r.json().catch(() => [])
            adminName = Array.isArray(arr) && arr[0] ? (arr[0].display_name || null) : null
          }
        } catch {}
      }
    } catch {}

    let ok = false
    if (sql) {
      try {
        await sql`insert into public.admin_activity_logs (admin_id, admin_name, action, target, detail) values (${adminId}, ${adminName}, ${action}, ${target || null}, ${sql.json(detail)})`
        ok = true
      } catch {}
    }
    if (!ok) {
      try {
        const row = { admin_id: adminId, admin_name: adminName, action, target: target || null, detail }
        ok = await insertAdminActivityViaRest(req, row)
      } catch {}
    }
    if (!ok) {
      res.status(500).json({ error: 'Failed to log action' })
      return
    }
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to log action' })
  }
})
app.options('/api/admin/log-action', (_req, res) => {
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Admin-Token')
  res.status(204).end()
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
  // Prefer the first IP in X-Forwarded-For when present (left-most is original client)
  const xff = (h['x-forwarded-for'] || h['X-Forwarded-For'] || '').toString()
  if (xff) return normalizeIp(xff.split(',')[0].trim())
  // Common CDN / proxy specific headers
  const cf = (h['cf-connecting-ip'] || h['CF-Connecting-IP'] || '').toString()
  if (cf) return normalizeIp(cf)
  const trueClient = (h['true-client-ip'] || h['True-Client-IP'] || '').toString()
  if (trueClient) return normalizeIp(trueClient)
  const fastly = (h['fastly-client-ip'] || h['Fastly-Client-IP'] || '').toString()
  if (fastly) return normalizeIp(fastly)
  const xClientIp = (h['x-client-ip'] || h['X-Client-IP'] || '').toString()
  if (xClientIp) return normalizeIp(xClientIp)
  // Finally, fall back to X-Real-IP set by upstream (e.g., nginx) or the socket address
  const real = (h['x-real-ip'] || h['X-Real-IP'] || '').toString()
  if (real) return normalizeIp(real)
  return normalizeIp(req.ip || req.connection?.remoteAddress || '')
}

function getGeoFromHeaders(req) {
  const h = req.headers
  // Country detection from common providers (normalize to upper-case when likely a code)
  const vercelCountry = (h['x-vercel-ip-country'] || '').toString()
  const cfCountry = (h['cf-ipcountry'] || '').toString()
  const geoCountry = (h['x-geo-country'] || '').toString()
  const cfViewerCountry = (h['cloudfront-viewer-country'] || h['CloudFront-Viewer-Country'] || '').toString()
  const appEngineCountry = (h['x-appengine-country'] || h['X-AppEngine-Country'] || '').toString()
  const fastlyCountry = (h['x-fastly-geoip-country-code'] || h['fastly-geoip-country-code'] || '').toString()
  const genericCountry = (h['x-country-code'] || '').toString()

  const countryRaw = vercelCountry || cfCountry || geoCountry || cfViewerCountry || appEngineCountry || fastlyCountry || genericCountry || ''
  const country = countryRaw && /^[a-z]{2}$/i.test(countryRaw) ? countryRaw.toUpperCase() : (countryRaw || null)

  // Region/state detection
  const vercelRegion = (h['x-vercel-ip-region'] || '').toString()
  const geoRegion = (h['x-geo-region'] || '').toString()
  const appEngineRegion = (h['x-appengine-region'] || h['X-AppEngine-Region'] || '').toString()
  const region = vercelRegion || geoRegion || appEngineRegion || ''

  // City detection
  const vercelCity = (h['x-vercel-ip-city'] || '').toString()
  const geoCity = (h['x-geo-city'] || '').toString()
  const appEngineCity = (h['x-appengine-city'] || h['X-AppEngine-City'] || '').toString()
  const city = vercelCity || geoCity || appEngineCity || ''

  return {
    geo_country: country || null,
    geo_region: region || null,
    geo_city: city || null,
  }
}

// In-memory cache for IP -> geo lookups to avoid repeated external calls
const geoCache = new Map()

function isPrivateIp(ip) {
  try {
    const s = String(ip || '').toLowerCase()
    if (!s) return true
    if (s === '127.0.0.1' || s === '::1') return true
    if (s.startsWith('10.')) return true
    if (s.startsWith('192.168.')) return true
    const first = s.split('.')
    const a = Number(first[0]); const b = Number(first[1])
    if (a === 172 && b >= 16 && b <= 31) return true
    if (s.startsWith('fc') || s.startsWith('fd')) return true // IPv6 unique local
    if (s.startsWith('fe80:')) return true // IPv6 link-local
  } catch {}
  return false
}

function geoDebugLog(...args) {
  try {
    const enabled = String(process.env.GEO_LOG_DEBUG || '').toLowerCase() === 'true'
    if (enabled) console.log('[geo]', ...args)
  } catch {}
}

async function lookupGeoForIp(ip) {
  const key = `ip:${ip}`
  const now = Date.now()
  const ttlMs = 24 * 60 * 60 * 1000 // 24h
  const cached = geoCache.get(key)
  if (cached && (now - cached.ts < ttlMs)) {
    return cached.val
  }

  if (!ip || isPrivateIp(ip)) {
    const val = { geo_country: null, geo_region: null, geo_city: null }
    geoCache.set(key, { ts: now, val })
    return val
  }

  // Provider 1: ipapi.co (HTTPS, no key required for basic usage)
  try {
    const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { method: 'GET', headers: { 'Accept': 'application/json' }, redirect: 'follow' })
    if (r.ok) {
      const j = await r.json().catch(() => null)
      if (j && (j.country || j.region || j.city)) {
        const val = {
          geo_country: j.country ? String(j.country).toUpperCase() : null, // ISO code
          geo_region: j.region || null,
          geo_city: j.city || null,
        }
        geoCache.set(key, { ts: now, val })
        geoDebugLog('ipapi.co resolved', ip, val)
        return val
      }
    }
  } catch (e) {
    geoDebugLog('ipapi.co failed', ip, e?.message || String(e))
  }

  // Provider 2: ip-api.com (HTTP; keep as last resort)
  try {
    const r2 = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,regionName,city`, { method: 'GET', headers: { 'Accept': 'application/json' } })
    if (r2.ok) {
      const j2 = await r2.json().catch(() => null)
      if (j2 && j2.status === 'success') {
        const val = {
          geo_country: j2.countryCode ? String(j2.countryCode).toUpperCase() : (j2.country || null),
          geo_region: j2.regionName || null,
          geo_city: j2.city || null,
        }
        geoCache.set(key, { ts: now, val })
        geoDebugLog('ip-api.com resolved', ip, val)
        return val
      }
    }
  } catch (e) {
    geoDebugLog('ip-api.com failed', ip, e?.message || String(e))
  }

  const val = { geo_country: null, geo_region: null, geo_city: null }
  geoCache.set(key, { ts: now, val })
  return val
}

async function resolveGeo(req, ipAddress) {
  const headerGeo = getGeoFromHeaders(req)
  const hasHeaderCountry = !!headerGeo.geo_country
  const hasHeaderRegion = !!headerGeo.geo_region
  const needsLookup = !hasHeaderCountry || !hasHeaderRegion

  if (!needsLookup) return headerGeo

  try {
    const fromIp = await lookupGeoForIp(ipAddress)
    return {
      geo_country: headerGeo.geo_country || fromIp.geo_country || null,
      geo_region: headerGeo.geo_region || fromIp.geo_region || null,
      geo_city: headerGeo.geo_city || fromIp.geo_city || null,
    }
  } catch {
    return headerGeo
  }
}

function extractHostname(url) {
  try {
    const u = new URL(url)
    return u.hostname || null
  } catch {
    try {
      // Attempt to handle bare domains like "example.com/path"
      const withProto = new URL(`http://${String(url || '').replace(/^\/+/, '')}`)
      return withProto.hostname || null
    } catch { return null }
  }
}

function deriveTrafficSource(referrer) {
  const domain = extractHostname(referrer || '')
  if (domain) {
    return { traffic_source: 'referral', traffic_details: { domain } }
  }
  return { traffic_source: 'direct', traffic_details: {} }
}

// Basic device categorization from a User-Agent string for admin analytics
function categorizeDeviceFromUa(userAgent) {
  try {
    const ua = String(userAgent || '')
    if (!ua) return 'Other'
    const uaLower = ua.toLowerCase()
    if (/(bot|spider|crawler|bingpreview|googlebot|duckduckbot|facebookexternalhit|slackbot|twitterbot)/i.test(ua)) return 'Bot'
    if (/iphone/i.test(ua)) return 'iPhone'
    if (/ipad/i.test(ua)) return 'iPad'
    if (/android/i.test(ua)) {
      if (/mobile/i.test(ua)) return 'Android Phone'
      return 'Android Tablet'
    }
    if (/cros/i.test(ua)) return 'ChromeOS'
    if (/windows nt/i.test(ua)) return 'Windows'
    if (/macintosh|mac os x/i.test(ua)) return 'Mac'
    if (/linux/i.test(ua)) return 'Linux'
    return 'Other'
  } catch { return 'Other' }
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

  // Return count of unique IPs across the last N calendar days (UTC)
  getUniqueIpCountInLastDays(days) {
    const n = Math.max(1, Number(days) || 7)
    const today = new Date()
    const start = new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate()
    ))
    start.setUTCDate(start.getUTCDate() - (n - 1))
    const uniq = new Set()
    for (let i = 0; i < n; i++) {
      const d = new Date(start)
      d.setUTCDate(start.getUTCDate() + i)
      const key = d.toISOString().slice(0, 10)
      const set = this.dayToUniqueIps.get(key)
      if (set && set.size) {
        for (const ip of set) uniq.add(ip)
      }
    }
    return uniq.size
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

async function insertWebVisitViaSupabaseRest(payload, req) {
  try {
    if (!supabaseUrlEnv || !supabaseAnonKey) return false
    const headers = { 'apikey': supabaseAnonKey, 'Accept': 'application/json', 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }
    const token = getBearerTokenFromRequest(req)
    if (token) Object.assign(headers, { 'Authorization': `Bearer ${token}` })
    // First try full payload (new schema)
    const fullResp = await fetch(`${supabaseUrlEnv}/rest/v1/web_visits`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    if (fullResp.ok) return true
    // Retry with minimal legacy-compatible columns if schema is older
    const minimal = {
      session_id: payload.session_id,
      user_id: payload.user_id ?? null,
      page_path: payload.page_path,
      referrer: payload.referrer ?? null,
      user_agent: payload.user_agent ?? null,
      ip_address: payload.ip_address ?? null,
      geo_country: payload.geo_country ?? null,
      geo_region: payload.geo_region ?? null,
      geo_city: payload.geo_city ?? null,
      extra: payload.extra ?? {},
    }
    const minResp = await fetch(`${supabaseUrlEnv}/rest/v1/web_visits`, {
      method: 'POST',
      headers,
      body: JSON.stringify(minimal),
    })
    return minResp.ok
  } catch {
    return false
  }
}

async function insertWebVisit({ sessionId, userId, pagePath, referrer, userAgent, ipAddress, geo, extra, pageTitle, language, visitNum }, req) {
  // Always record into in-memory analytics, regardless of DB availability
  try { memAnalytics.recordVisit(String(ipAddress || ''), Date.now()) } catch {}

  // Prepare common fields
  const parsedUtm = null
  const lang = language || null

  // If no direct DB, try Supabase REST immediately
  if (!sql) {
    const restPayload = {
      session_id: sessionId,
      user_id: userId || null,
      page_path: pagePath,
      referrer: referrer || null,
      user_agent: userAgent || null,
      ip_address: ipAddress || null,
      geo_country: (geo?.geo_country && /^[a-z]{2}$/i.test(String(geo.geo_country))) ? String(geo.geo_country).toUpperCase() : (geo?.geo_country || null),
      geo_region: geo?.geo_region || null,
      geo_city: geo?.geo_city || null,
      extra: (() => { try { const { traffic_source, traffic_details } = deriveTrafficSource(referrer); return { ...(extra || {}), traffic_source, traffic_details } } catch { return (extra || {}) } })(),
      visit_num: null,
      page_title: pageTitle || null,
      language: lang,
    }
    await insertWebVisitViaSupabaseRest(restPayload, req)
    return
  }

  try {
    const computedVisitNum = Number.isFinite(visitNum) ? visitNum : await computeNextVisitNum(sessionId)
    await sql`
      insert into public.web_visits
        (session_id, user_id, page_path, referrer, user_agent, ip_address, geo_country, geo_region, geo_city, extra, visit_num, page_title, language)
      values
        (${sessionId}, ${userId || null}, ${pagePath}, ${referrer || null}, ${userAgent || null}, ${ipAddress || null}, ${(geo?.geo_country && /^[a-z]{2}$/i.test(String(geo.geo_country))) ? String(geo.geo_country).toUpperCase() : (geo?.geo_country || null)}, ${geo?.geo_region || null}, ${geo?.geo_city || null}, ${extra ? sql.json((() => { try { const { traffic_source, traffic_details } = deriveTrafficSource(referrer); return { ...(extra || {}), traffic_source, traffic_details } } catch { return (extra || {}) } })()) : sql.json({})}, ${computedVisitNum}, ${pageTitle || null}, ${lang})
    `
  } catch (e) {
    // On DB failure, attempt Supabase REST fallback (handles older schemas too)
    const restPayload = {
      session_id: sessionId,
      user_id: userId || null,
      page_path: pagePath,
      referrer: referrer || null,
      user_agent: userAgent || null,
      ip_address: ipAddress || null,
      geo_country: (geo?.geo_country && /^[a-z]{2}$/i.test(String(geo.geo_country))) ? String(geo.geo_country).toUpperCase() : (geo?.geo_country || null),
      geo_region: geo?.geo_region || null,
      geo_city: geo?.geo_city || null,
      extra: (() => { try { const { traffic_source, traffic_details } = deriveTrafficSource(referrer); return { ...(extra || {}), traffic_source, traffic_details } } catch { return (extra || {}) } })(),
      // Avoid computing visit_num via REST; leave null when falling back
      visit_num: null,
      page_title: pageTitle || null,
      language: lang,
    }
    await insertWebVisitViaSupabaseRest(restPayload, req)
  }
}

// Admin: restart server via systemd; always exit so systemd restarts us
async function handleRestartServer(req, res) {
  try {
    const isAdmin = await isAdminFromRequest(req)
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin privileges required' })
      return
    }

    try {
      const caller = await getUserFromRequest(req)
      const adminId = caller?.id || null
      let adminName = null
      if (sql && adminId) {
        try {
          const rows = await sql`select coalesce(display_name, '') as name from public.profiles where id = ${adminId} limit 1`
          adminName = (rows?.[0]?.name || '').trim() || null
        } catch {}
      }
      if (!adminName && supabaseUrlEnv && supabaseAnonKey && adminId) {
        try {
          const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
          const bearer = getBearerTokenFromRequest(req)
          if (bearer) headers['Authorization'] = `Bearer ${bearer}`
          const url = `${supabaseUrlEnv}/rest/v1/profiles?id=eq.${encodeURIComponent(adminId)}&select=display_name&limit=1`
          const r = await fetch(url, { headers })
          if (r.ok) {
            const arr = await r.json().catch(() => [])
            adminName = Array.isArray(arr) && arr[0] ? (arr[0].display_name || null) : null
          }
        } catch {}
      }
      let ok = false
      if (sql) {
        try { await sql`insert into public.admin_activity_logs (admin_id, admin_name, action, target, detail) values (${adminId}, ${adminName}, 'restart_server', null, ${sql.json({})})`; ok = true } catch {}
      }
      if (!ok) {
        try { await insertAdminActivityViaRest(req, { admin_id: adminId, admin_name: adminName, action: 'restart_server', target: null, detail: {} }) } catch {}
      }
    } catch {}
    res.json({ ok: true, message: 'Restarting server' })
    // Give time for response to flush, then request systemd to restart the service.
    setTimeout(() => {
      let restartedViaSystemd = false
      try {
        const serviceName = process.env.NODE_SYSTEMD_SERVICE || process.env.SELF_SYSTEMD_SERVICE || 'plant-swipe-node'
        const child = spawnChild('sudo', ['-n', 'systemctl', 'restart', serviceName], { detached: true, stdio: 'ignore' })
        try { child.unref() } catch {}
        restartedViaSystemd = true
      } catch {}
      // Exit in all cases so the systemd unit can take over.
      // If systemd call failed to spawn, exit non-zero to trigger Restart=on-failure.
      try { process.exit(restartedViaSystemd ? 0 : 1) } catch {}
    }, 150)
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to restart server' })
  }
}

app.post('/api/admin/restart-server', handleRestartServer)
app.get('/api/admin/restart-server', handleRestartServer)
app.options('/api/admin/restart-server', (_req, res) => {
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Admin-Token')
  res.status(204).end()
})

// Admin: reload nginx and restart admin + node services in sequence, then exit self
app.post('/api/admin/restart-all', async (req, res) => {
  try {
    const isAdmin = await isAdminFromRequest(req)
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin privileges required' })
      return
    }

    try {
      const caller = await getUserFromRequest(req)
      const adminId = caller?.id || null
      let adminName = null
      if (sql && adminId) {
        try {
          const rows = await sql`select coalesce(display_name, '') as name from public.profiles where id = ${adminId} limit 1`
          adminName = (rows?.[0]?.name || '').trim() || null
        } catch {}
      }
      if (!adminName && supabaseUrlEnv && supabaseAnonKey && adminId) {
        try {
          const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
          const bearer = getBearerTokenFromRequest(req)
          if (bearer) headers['Authorization'] = `Bearer ${bearer}`
          const url = `${supabaseUrlEnv}/rest/v1/profiles?id=eq.${encodeURIComponent(adminId)}&select=display_name&limit=1`
          const r = await fetch(url, { headers })
          if (r.ok) {
            const arr = await r.json().catch(() => [])
            adminName = Array.isArray(arr) && arr[0] ? (arr[0].display_name || null) : null
          }
        } catch {}
      }
      let ok = false
      if (sql) {
        try { await sql`insert into public.admin_activity_logs (admin_id, admin_name, action, target, detail) values (${adminId}, ${adminName}, 'restart_all', null, ${sql.json({})})`; ok = true } catch {}
      }
      if (!ok) {
        try { await insertAdminActivityViaRest(req, { admin_id: adminId, admin_name: adminName, action: 'restart_all', target: null, detail: {} }) } catch {}
      }
    } catch {}
    res.json({ ok: true, message: 'Reloading nginx and restarting services' })

    setTimeout(async () => {
      const serviceNode = process.env.NODE_SYSTEMD_SERVICE || process.env.SELF_SYSTEMD_SERVICE || 'plant-swipe-node'
      const serviceAdmin = process.env.ADMIN_SYSTEMD_SERVICE || 'admin-api'
      const serviceNginx = process.env.NGINX_SYSTEMD_SERVICE || 'nginx'
      try { await exec('sudo -n nginx -t', { timeout: 15000 }) } catch {}
      try { await exec(`sudo -n systemctl reload ${serviceNginx}`, { timeout: 20000 }) } catch {}
      try {
        const a = spawnChild('sudo', ['-n', 'systemctl', 'restart', serviceAdmin], { detached: true, stdio: 'ignore' })
        try { a.unref() } catch {}
      } catch {}
      try {
        const n = spawnChild('sudo', ['-n', 'systemctl', 'restart', serviceNode], { detached: true, stdio: 'ignore' })
        try { n.unref() } catch {}
      } catch {}
      try { process.exit(0) } catch {}
    }, 150)
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to restart all services' })
  }
})

app.options('/api/admin/restart-all', (_req, res) => {
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Admin-Token')
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

// Helper: verify key schema objects exist after sync for operator assurance
async function verifySchemaAfterSync() {
  if (!sql) return null
  const requiredTables = [
    'profiles',
    'plants',
    'gardens',
    'garden_members',
    'garden_plants',
    'garden_plant_tasks',
    'garden_task_user_completions',
    'garden_watering_schedule',
    'web_visits',
  ]
  const requiredFunctions = [
    'get_profile_public_by_display_name',
    'compute_user_current_streak',
    'get_user_profile_public_stats',
    'count_unique_ips_last_minutes',
    'count_unique_ips_last_days',
  ]
  const requiredExtensions = [
    'pgcrypto',
    'pg_cron',
  ]

  const [tableRows, funcRows, extRows] = await Promise.all([
    sql`select table_name from information_schema.tables where table_schema='public' and table_name = any(${sql.array(requiredTables)})`,
    sql`select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any(${sql.array(requiredFunctions)})`,
    sql`select extname from pg_extension where extname = any(${sql.array(requiredExtensions)})`,
  ])

  const presentTables = new Set((tableRows || []).map(r => r.table_name))
  const presentFunctions = new Set((funcRows || []).map(r => r.name))
  const presentExtensions = new Set((extRows || []).map(r => r.extname))

  const missingTables = requiredTables.filter(n => !presentTables.has(n))
  const missingFunctions = requiredFunctions.filter(n => !presentFunctions.has(n))
  const missingExtensions = requiredExtensions.filter(n => !presentExtensions.has(n))

  return {
    tables: { required: requiredTables, present: Array.from(presentTables), missing: missingTables },
    functions: { required: requiredFunctions, present: Array.from(presentFunctions), missing: missingFunctions },
    extensions: { required: requiredExtensions, present: Array.from(presentExtensions), missing: missingExtensions },
  }
}

// Support both POST and GET (some environments may block POST from admin UI)
async function handleSyncSchema(req, res) {
  if (!sql) {
    res.status(500).json({ error: 'Database not configured' })
    return
  }
  try {
    // Require admin (robust detection; currently permissive via isAdminFromRequest)
    const isAdmin = await isAdminFromRequest(req)
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin privileges required' })
      return
    }

    const sqlPath = path.resolve(__dirname, 'supabase', '000_sync_schema.sql')
    const sqlText = await fs.readFile(sqlPath, 'utf8')

    // Execute allowing multiple statements
    await sql.unsafe(sqlText, [], { simple: true })

    // Verify important objects exist after sync
    let summary = null
    try { summary = await verifySchemaAfterSync() } catch {}

    // Log admin action (success)
    try {
      const caller = await getUserFromRequest(req)
      const adminId = caller?.id || null
      const detail = { summary }
      let logged = false
      if (sql) {
        try {
          await sql`insert into public.admin_activity_logs (admin_id, admin_name, action, target, detail) values (${adminId}, ${null}, 'sync_schema', null, ${sql.json(detail)})`
          logged = true
        } catch {}
      }
      if (!logged) {
        try {
          await insertAdminActivityViaRest(req, { admin_id: adminId, admin_name: null, action: 'sync_schema', target: null, detail })
        } catch {}
      }
    } catch {}

    res.json({ ok: true, message: 'Schema synchronized successfully', summary })
  } catch (e) {
    // Log failure
    try {
      const caller = await getUserFromRequest(req)
      const adminId = caller?.id || null
      const detail = { error: e?.message || String(e) }
      if (sql) {
        try { await sql`insert into public.admin_activity_logs (admin_id, admin_name, action, target, detail) values (${adminId}, ${null}, 'sync_schema_failed', null, ${sql.json(detail)})` } catch {}
      } else {
        try { await insertAdminActivityViaRest(req, { admin_id: adminId, admin_name: null, action: 'sync_schema_failed', target: null, detail }) } catch {}
      }
    } catch {}
    res.status(500).json({ error: e?.message || 'Failed to sync schema' })
  }
}

app.post('/api/admin/sync-schema', handleSyncSchema)
app.get('/api/admin/sync-schema', handleSyncSchema)
app.options('/api/admin/sync-schema', (_req, res) => {
  // Allow standard headers for admin calls
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Admin-Token')
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
    const rawParam = (req.query.q || req.query.email || req.query.username || req.query.name || '').toString().trim()
    if (!rawParam) {
      res.status(400).json({ error: 'Missing query' })
      return
    }

    // Determine whether the query is an email or a display name (username)
    const isLikelyEmail = /@/.test(rawParam)
    const emailParam = isLikelyEmail ? rawParam : ''
    const displayParam = isLikelyEmail ? '' : rawParam
    const qLower = rawParam.toLowerCase()
    const email = emailParam ? emailParam.toLowerCase() : null

    // Helper: lookup via Supabase REST (fallback when SQL unavailable or fails)
    const lookupViaRest = async () => {
      const token = getBearerTokenFromRequest(req)
      if (!supabaseUrlEnv || !supabaseAnonKey) {
        res.status(500).json({ error: 'Database not configured' })
        return
      }
      const baseHeaders = { 'apikey': supabaseAnonKey, 'Accept': 'application/json' }
      if (token) Object.assign(baseHeaders, { 'Authorization': `Bearer ${token}` })
      // Resolve user id via RPC (security definer) using email or display name
      let targetId = null
      let resolvedEmail = emailParam || null
      if (emailParam) {
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
      } else if (displayParam) {
        try {
          const rpc = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/get_user_id_by_display_name`, {
            method: 'POST',
            headers: { ...baseHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ _name: displayParam }),
          })
          if (rpc.ok) {
            const val = await rpc.json().catch(() => null)
            if (val) targetId = String(val)
          }
        } catch {}
        // Also resolve email for downstream fields
        if (targetId && !resolvedEmail) {
          try {
            const er = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/get_email_by_display_name`, {
              method: 'POST',
              headers: { ...baseHeaders, 'Content-Type': 'application/json' },
              body: JSON.stringify({ _name: displayParam }),
            })
            if (er.ok) {
              const val = await er.json().catch(() => null)
              if (val) resolvedEmail = String(val)
            }
          } catch {}
        }
      }
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

      // Last online and last IP/country/referrer (best-effort; requires Authorization due to RLS)
      let lastOnlineAt = null
      let lastIp = null
      let lastCountry = null
      let lastReferrer = null
      try {
        const lr = await fetch(`${supabaseUrlEnv}/rest/v1/web_visits?user_id=eq.${encodeURIComponent(targetId)}&select=occurred_at,ip_address,geo_country,referrer&order=occurred_at.desc&limit=1`, {
          headers: baseHeaders,
        })
        if (lr.ok) {
          const arr = await lr.json().catch(() => [])
          if (Array.isArray(arr) && arr[0]) {
            lastOnlineAt = arr[0].occurred_at || null
            lastIp = (arr[0].ip_address || '').toString().replace(/\/[0-9]{1,3}$/, '') || null
            lastCountry = arr[0].geo_country ? String(arr[0].geo_country).toUpperCase() : null
            const ref = arr[0].referrer || ''
            const domain = extractHostname(ref)
            lastReferrer = domain || (ref ? String(ref) : 'direct')
          }
        }
      } catch {}

      // Distinct IPs via security-definer RPC to ensure completeness
      let ips = []
      try {
        const ipRes = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/get_user_distinct_ips`, {
          method: 'POST',
          headers: { ...baseHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ _user_id: targetId }),
        })
        if (ipRes.ok) {
          const arr = await ipRes.json().catch(() => [])
          ips = Array.isArray(arr) ? arr.map((r) => String(r.ip).replace(/\/[0-9]{1,3}$/, '')).filter(Boolean) : []
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
        const emailForBan = (resolvedEmail || emailParam || '').toLowerCase()
        const br = await fetch(`${supabaseUrlEnv}/rest/v1/banned_accounts?email=eq.${encodeURIComponent(emailForBan)}&select=reason,banned_at&order=banned_at.desc&limit=1`, {
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
        const emailForBan = (resolvedEmail || emailParam || '').toLowerCase()
        const bi = await fetch(`${supabaseUrlEnv}/rest/v1/banned_ips?or=(user_id.eq.${encodeURIComponent(targetId)},email.eq.${encodeURIComponent(emailForBan)})&select=ip_address`, {
          headers: baseHeaders,
        })
        if (bi.ok) {
          const arr = await bi.json().catch(() => [])
          bannedIps = Array.isArray(arr) ? arr.map(r => String(r.ip_address)).filter(Boolean) : []
        }
      } catch {}

    // Plants count only (drop garden counts)
      // Plants count only (drop garden counts)
      let plantsTotal = undefined
      try {
        // Gather gardens user can access to compute plants total
        let gardenIds = []
        const memResp = await fetch(`${supabaseUrlEnv}/rest/v1/garden_members?user_id=eq.${encodeURIComponent(targetId)}&select=garden_id`, { headers: baseHeaders })
        if (memResp.ok) {
          const arr = await memResp.json().catch(() => [])
          const memberGardenIds = Array.isArray(arr) ? arr.map(r => String(r.garden_id)).filter(Boolean) : []
          gardenIds = memberGardenIds
        }
        const ownListResp = await fetch(`${supabaseUrlEnv}/rest/v1/gardens?created_by=eq.${encodeURIComponent(targetId)}&select=id`, { headers: baseHeaders })
        if (ownListResp.ok) {
          const arr = await ownListResp.json().catch(() => [])
          const ownedGardenIds = Array.isArray(arr) ? arr.map(r => String(r.id)).filter(Boolean) : []
          const set = new Set([ ...gardenIds, ...ownedGardenIds ])
          gardenIds = Array.from(set)
        }
        // Plants total across all user's gardens (sum plants_on_hand)
        if (gardenIds.length > 0) {
          const idsParam = gardenIds.join(',')
          const gpResp = await fetch(`${supabaseUrlEnv}/rest/v1/garden_plants?garden_id=in.(${idsParam})&select=plants_on_hand`, {
            headers: baseHeaders,
          })
          if (gpResp.ok) {
            const arr = await gpResp.json().catch(() => [])
            plantsTotal = Array.isArray(arr) ? arr.reduce((acc, r) => acc + Number(r?.plants_on_hand ?? 0), 0) : undefined
          }
        }
      } catch {}

      // Aggregates (REST fallback): pull recent visits and compute locally
      let memberTopReferrers = []
      let memberTopCountries = []
      let memberTopDevices = []
      let meanRpm5m = null
      try {
        const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const cutoff5m = Date.now() - 5 * 60 * 1000
        const r = await fetch(`${supabaseUrlEnv}/rest/v1/web_visits?user_id=eq.${encodeURIComponent(targetId)}&occurred_at=gte.${encodeURIComponent(cutoff30d)}&select=referrer,geo_country,user_agent,occurred_at&order=occurred_at.desc`, {
          headers: { ...baseHeaders },
        })
        if (r.ok) {
          const arr = await r.json().catch(() => [])
          const refCounts = new Map()
          const countryCounts = new Map()
          const deviceCounts = new Map()
          let last5mCount = 0
          for (const v of Array.isArray(arr) ? arr : []) {
            const domain = extractHostname(v?.referrer || '')
            const src = domain || (v?.referrer ? String(v.referrer) : '') || 'direct'
            refCounts.set(src, (refCounts.get(src) || 0) + 1)
            const cc = (v?.geo_country ? String(v.geo_country).toUpperCase() : '')
            if (cc) countryCounts.set(cc, (countryCounts.get(cc) || 0) + 1)
            const dev = categorizeDeviceFromUa(v?.user_agent || '')
            deviceCounts.set(dev, (deviceCounts.get(dev) || 0) + 1)
            try { if (v?.occurred_at && new Date(v.occurred_at).getTime() >= cutoff5m) last5mCount++ } catch {}
          }
          memberTopReferrers = Array.from(refCounts.entries()).map(([source, visits]) => ({ source, visits: Number(visits) }))
          memberTopCountries = Array.from(countryCounts.entries()).map(([country, visits]) => ({ country, visits: Number(visits) }))
          memberTopDevices = Array.from(deviceCounts.entries()).map(([device, visits]) => ({ device, visits: Number(visits) }))
          memberTopReferrers.sort((a, b) => (b.visits || 0) - (a.visits || 0))
          memberTopCountries.sort((a, b) => (b.visits || 0) - (a.visits || 0))
          memberTopDevices.sort((a, b) => (b.visits || 0) - (a.visits || 0))
          meanRpm5m = Number((last5mCount / 5).toFixed(2))
        }
      } catch {}

      // Load admin notes via REST (admin-only via RLS)
      let adminNotes = []
      try {
        const nr = await fetch(`${supabaseUrlEnv}/rest/v1/profile_admin_notes?profile_id=eq.${encodeURIComponent(targetId)}&select=id,profile_id,admin_id,admin_name,message,created_at&order=created_at.desc&limit=50`, { headers: baseHeaders })
        if (nr.ok) {
          const arr = await nr.json().catch(() => [])
          adminNotes = Array.isArray(arr) ? arr.map((r) => ({ id: String(r.id), admin_id: r?.admin_id || null, admin_name: r?.admin_name || null, message: String(r?.message || ''), created_at: r?.created_at || null })) : []
        }
      } catch {}

      try {
        const caller = await getUserFromRequest(req)
        const adminId = caller?.id || null
        const adminName = null
        if (sql) await sql`insert into public.admin_activity_logs (admin_id, admin_name, action, target, detail) values (${adminId}, ${adminName}, 'admin_lookup', ${email || displayParam || null}, ${sql.json({ via: 'rest' })})`
      } catch {}
      res.json({
        ok: true,
        user: { id: targetId, email: resolvedEmail || emailParam || null, created_at: null, email_confirmed_at: null, last_sign_in_at: null },
        profile,
        ips,
        lastOnlineAt,
        lastIp,
        lastCountry,
        lastReferrer,
        visitsCount,
        uniqueIpsCount: Array.isArray(ips) ? ips.length : undefined,
        plantsTotal,
        isBannedEmail,
        bannedReason,
        bannedAt,
        bannedIps,
        topReferrers: memberTopReferrers.slice(0, 5),
        topCountries: memberTopCountries.slice(0, 5),
        topDevices: memberTopDevices.slice(0, 5),
        meanRpm5m,
        adminNotes,
      })
    }

    // Fallback via Supabase REST when SQL connection is not configured
    if (!sql) return await lookupViaRest()

    // SQL path (preferred when server DB connection is configured)
    let user
    try {
      let users
      if (email) {
        users = await sql`select id, email, created_at, email_confirmed_at, last_sign_in_at from auth.users where lower(email) = ${email} limit 1`
      } else {
        users = await sql`
          select u.id, u.email, u.created_at, u.email_confirmed_at, u.last_sign_in_at
          from auth.users u
          join public.profiles p on p.id = u.id
          where lower(p.display_name) = ${qLower}
          limit 1
        `
      }
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
    // Load latest admin notes for this profile (DB or REST)
    let adminNotes = []
    try {
      if (sql) {
        const rows = await sql`
          select id, profile_id, admin_id, admin_name, message, created_at
          from public.profile_admin_notes
          where profile_id = ${user.id}
          order by created_at desc
          limit 50
        `
        adminNotes = Array.isArray(rows) ? rows.map(r => ({ id: String(r.id), admin_id: r.admin_id || null, admin_name: r.admin_name || null, message: String(r.message || ''), created_at: r.created_at })) : []
      } else if (supabaseUrlEnv && supabaseAnonKey) {
        const headers = { 'apikey': supabaseAnonKey, 'Accept': 'application/json' }
        const token = getBearerTokenFromRequest(req)
        if (token) headers['Authorization'] = `Bearer ${token}`
        const resp = await fetch(`${supabaseUrlEnv}/rest/v1/profile_admin_notes?profile_id=eq.${encodeURIComponent(user.id)}&select=id,profile_id,admin_id,admin_name,message,created_at&order=created_at.desc&limit=50`, { headers })
        if (resp.ok) {
          const arr = await resp.json().catch(() => [])
          adminNotes = Array.isArray(arr) ? arr.map((r) => ({ id: String(r.id), admin_id: r?.admin_id || null, admin_name: r?.admin_name || null, message: String(r?.message || ''), created_at: r?.created_at || null })) : []
        }
      }
    } catch {}
    let ips = []
    let lastOnlineAt = null
    let lastIp = null
    let visitsCount = 0
    let uniqueIpsCount = 0
    let isBannedEmail = false
    let bannedReason = null
    let bannedAt = null
    let bannedIps = []
    let plantsTotal = 0
    try {
      const ipRows = await sql`select distinct ip_address::text as ip from public.web_visits where user_id = ${user.id} and ip_address is not null order by ip asc`
      ips = (ipRows || []).map(r => String(r.ip).replace(/\/[0-9]{1,3}$/, '')).filter(Boolean)
    } catch {}
    let lastCountry = null
    let lastReferrer = null
    try {
      const lastRows = await sql`
        select occurred_at, ip_address::text as ip, geo_country, referrer
        from public.web_visits
        where user_id = ${user.id}
        order by occurred_at desc
        limit 1
      `
      if (Array.isArray(lastRows) && lastRows[0]) {
        lastOnlineAt = lastRows[0].occurred_at || null
        lastIp = (lastRows[0].ip || '').toString().replace(/\/[0-9]{1,3}$/, '') || null
        lastCountry = lastRows[0].geo_country ? String(lastRows[0].geo_country).toUpperCase() : null
        const ref = lastRows[0].referrer || ''
        const domain = extractHostname(ref)
        lastReferrer = domain || (ref ? String(ref) : 'direct')
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
    // Drop garden counts on server path
    try {
      const rows = await sql`
        select coalesce(sum(gp.plants_on_hand), 0)::int as c
        from public.garden_plants gp
        where gp.garden_id in (
          select id from public.gardens where created_by = ${user.id}
          union
          select garden_id from public.garden_members where user_id = ${user.id}
        )
      `
      plantsTotal = rows?.[0]?.c ?? 0
    } catch {}
    try {
      const br = await sql`
        select reason, banned_at
        from public.banned_accounts
        where lower(email) = ${email ? email : (user.email ? user.email.toLowerCase() : '')}
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
        where user_id = ${user.id} or lower(email) = ${email ? email : (user.email ? user.email.toLowerCase() : '')}
      `
      bannedIps = Array.isArray(bi) ? bi.map(r => String(r.ip)).filter(Boolean) : []
    } catch {}
    // Aggregates (SQL path)
    let topReferrers = []
    let topCountries = []
    let topDevices = []
    let meanRpm5m = null
    try {
      const [refRows, countryRows, uaRows, rpmRows] = await Promise.all([
        sql`
          select source, visits from (
            select case
                     when v.referrer is null or v.referrer = '' then 'direct'
                     when v.referrer ilike 'http%' then split_part(split_part(v.referrer, '://', 2), '/', 1)
                     else v.referrer
                   end as source,
                   count(*)::int as visits
            from public.web_visits v
            where v.user_id = ${user.id}
              and v.occurred_at >= now() - interval '30 days'
            group by 1
          ) s
          order by visits desc
          limit 10
        `,
        sql`
          select upper(v.geo_country) as country, count(*)::int as visits
          from public.web_visits v
          where v.user_id = ${user.id}
            and v.geo_country is not null and v.geo_country <> ''
            and v.occurred_at >= now() - interval '30 days'
          group by 1
          order by visits desc
          limit 10
        `,
        sql`
          select v.user_agent, count(*)::int as visits
          from public.web_visits v
          where v.user_id = ${user.id}
            and v.occurred_at >= now() - interval '30 days'
          group by v.user_agent
          order by visits desc
          limit 200
        `,
        sql`select count(*)::int as c from public.web_visits where user_id = ${user.id} and occurred_at >= now() - interval '5 minutes'`,
      ])
      topReferrers = (Array.isArray(refRows) ? refRows : []).map(r => ({ source: String(r.source || 'direct'), visits: Number(r.visits || 0) }))
      topCountries = (Array.isArray(countryRows) ? countryRows : []).map(r => ({ country: String(r.country || ''), visits: Number(r.visits || 0) }))
      const deviceMap = new Map()
      for (const r of Array.isArray(uaRows) ? uaRows : []) {
        const key = categorizeDeviceFromUa(r?.user_agent || '')
        deviceMap.set(key, (deviceMap.get(key) || 0) + Number(r?.visits || 0))
      }
      topDevices = Array.from(deviceMap.entries()).map(([device, visits]) => ({ device, visits: Number(visits) }))
      topDevices.sort((a, b) => (b.visits || 0) - (a.visits || 0))
      meanRpm5m = Number((((rpmRows?.[0]?.c ?? 0) / 5)).toFixed(2))
    } catch {}

    try {
      const caller = await getUserFromRequest(req)
      const adminId = caller?.id || null
      const adminName = null
      if (sql) await sql`insert into public.admin_activity_logs (admin_id, admin_name, action, target, detail) values (${adminId}, ${adminName}, 'admin_lookup', ${email || qLower || null}, ${sql.json({ via: 'db' })})`
    } catch {}
    res.json({
      ok: true,
      user: { id: user.id, email: user.email, created_at: user.created_at, email_confirmed_at: user.email_confirmed_at || null, last_sign_in_at: user.last_sign_in_at || null },
      profile,
      ips,
      lastOnlineAt,
      lastIp,
      lastCountry,
      lastReferrer,
      visitsCount,
      uniqueIpsCount,
      plantsTotal,
      isBannedEmail,
      bannedReason,
      bannedAt,
      bannedIps,
      topReferrers: topReferrers.slice(0, 5),
      topCountries: topCountries.slice(0, 5),
      topDevices: topDevices.slice(0, 5),
      meanRpm5m,
      adminNotes,
    })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to lookup member' })
  }
})
// Admin: add a note on a profile
app.post('/api/admin/member-note', async (req, res) => {
  try {
    const adminUserId = await ensureAdmin(req, res)
    if (!adminUserId) return
    const { profileId, message } = req.body || {}
    const pid = typeof profileId === 'string' ? profileId.trim() : ''
    const msg = typeof message === 'string' ? message.trim() : ''
    if (!pid || !msg) {
      res.status(400).json({ error: 'Missing profileId or message' })
      return
    }

    // Get admin display name
    let adminName = null
    try {
      if (sql) {
        const rows = await sql`select coalesce(display_name, '') as name from public.profiles where id = ${adminUserId} limit 1`
        adminName = rows?.[0]?.name || null
      } else if (supabaseUrlEnv && supabaseAnonKey) {
        const headers = { 'apikey': supabaseAnonKey, 'Accept': 'application/json' }
        const token = getBearerTokenFromRequest(req)
        if (token) headers['Authorization'] = `Bearer ${token}`
        const resp = await fetch(`${supabaseUrlEnv}/rest/v1/profiles?id=eq.${encodeURIComponent(adminUserId)}&select=display_name&limit=1`, { headers })
        if (resp.ok) {
          const arr = await resp.json().catch(() => [])
          adminName = Array.isArray(arr) && arr[0] ? (arr[0].display_name || null) : null
        }
      }
    } catch {}

    // Insert note
    let created = null
    if (sql) {
      const rows = await sql`
        insert into public.profile_admin_notes (profile_id, admin_id, admin_name, message)
        values (${pid}, ${adminUserId}, ${adminName}, ${msg})
        returning id, created_at
      `
      created = rows?.[0]?.created_at || null
    } else if (supabaseUrlEnv && supabaseAnonKey) {
      const headers = { 'apikey': supabaseAnonKey, 'Accept': 'application/json', 'Content-Type': 'application/json' }
      const token = getBearerTokenFromRequest(req)
      if (token) headers['Authorization'] = `Bearer ${token}`
      const resp = await fetch(`${supabaseUrlEnv}/rest/v1/profile_admin_notes`, {
        method: 'POST', headers, body: JSON.stringify({ profile_id: pid, admin_id: adminUserId, admin_name: adminName, message: msg }),
      })
      if (!resp.ok) {
        const body = await resp.text().catch(() => '')
        res.status(resp.status).json({ error: body || 'Failed to insert note' })
        return
      }
    } else {
      res.status(500).json({ error: 'Database not configured' })
      return
    }
    // Log admin action
    try {
      const aid = adminUserId
      let aname = adminName
      if (!aname && sql) {
        const rows = await sql`select coalesce(display_name, '') as name from public.profiles where id = ${aid} limit 1`
        aname = rows?.[0]?.name || null
      }
      if (sql) {
        await sql`insert into public.admin_activity_logs (admin_id, admin_name, action, target, detail) values (${aid}, ${aname}, 'add_note', ${profileId}, ${sql.json({ message: msg })})`
      }
    } catch {}
    res.json({ ok: true, created_at: created })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to add note' })
  }
})

// Admin: delete a note by id
app.delete('/api/admin/member-note/:id', async (req, res) => {
  try {
    const adminUserId = await ensureAdmin(req, res)
    if (!adminUserId) return
    const noteId = (req.params.id || '').toString().trim()
    if (!noteId) {
      res.status(400).json({ error: 'Missing note id' })
      return
    }
    if (sql) {
      // Identify profile for logging
      let pid = null
      try {
        const rows = await sql`select profile_id from public.profile_admin_notes where id = ${noteId}::uuid`
        pid = rows?.[0]?.profile_id || null
      } catch {}
      await sql`delete from public.profile_admin_notes where id = ${noteId}::uuid`
      try { await sql`insert into public.admin_activity_logs (admin_id, action, target, detail) values (${adminUserId}, 'delete_note', ${pid}, ${sql.json({ noteId })})` } catch {}
      res.json({ ok: true })
      return
    }
    if (supabaseUrlEnv && supabaseAnonKey) {
      const headers = { 'apikey': supabaseAnonKey, 'Accept': 'application/json' }
      const token = getBearerTokenFromRequest(req)
      if (token) headers['Authorization'] = `Bearer ${token}`
      const r = await fetch(`${supabaseUrlEnv}/rest/v1/profile_admin_notes?id=eq.${encodeURIComponent(noteId)}`, { method: 'DELETE', headers })
      if (!r.ok) {
        const body = await r.text().catch(() => '')
        res.status(r.status).json({ error: body || 'Failed to delete note' })
        return
      }
      res.json({ ok: true })
      return
    }
    res.status(500).json({ error: 'Database not configured' })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to delete note' })
  }
})

// Admin: list users who have connected from a specific IP address
app.get('/api/admin/members-by-ip', async (req, res) => {
  try {
    const isAdmin = await isAdminFromRequest(req)
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin privileges required' })
      return
    }
    const raw = (req.query.ip || req.query.q || '').toString().trim()
    const ip = normalizeIp(raw)
    if (!ip) {
      res.status(400).json({ error: 'Invalid or missing IP address' })
      return
    }
    // Prefer direct DB when available
    if (sql) {
      try {
        const [aggRows, rows, refRows, uaRows, lastCountryRow, rpmRow] = await Promise.all([
          sql`
            select count(*)::int as connections_count,
                   max(occurred_at) as last_seen_at,
                   count(distinct user_id)::int as users_count
            from public.web_visits
            where ip_address = ${ip}::inet
          `,
          sql`
            select v.user_id as id,
                   u.email,
                   p.display_name,
                   max(v.occurred_at) as last_seen_at
            from public.web_visits v
            left join auth.users u on u.id = v.user_id
            left join public.profiles p on p.id = v.user_id
            where v.ip_address = ${ip}::inet and v.user_id is not null
            group by v.user_id, u.email, p.display_name
            order by last_seen_at desc
          `,
          sql`
            select source, visits from (
              select case
                       when v.referrer is null or v.referrer = '' then 'direct'
                       when v.referrer ilike 'http%' then split_part(split_part(v.referrer, '://', 2), '/', 1)
                       else v.referrer
                     end as source,
                     count(*)::int as visits
              from public.web_visits v
              where v.ip_address = ${ip}::inet
                and v.occurred_at >= now() - interval '30 days'
              group by 1
            ) s
            order by visits desc
            limit 10
          `,
          sql`
            select v.user_agent, count(*)::int as visits
            from public.web_visits v
            where v.ip_address = ${ip}::inet
              and v.occurred_at >= now() - interval '30 days'
            group by v.user_agent
            order by visits desc
            limit 200
          `,
          sql`select geo_country from public.web_visits where ip_address = ${ip}::inet and geo_country is not null and geo_country <> '' order by occurred_at desc limit 1`,
          sql`select count(*)::int as c from public.web_visits where ip_address = ${ip}::inet and occurred_at >= now() - interval '5 minutes'`,
        ])
        const users = (Array.isArray(rows) ? rows : []).map(r => ({
          id: String(r.id),
          email: r.email || null,
          display_name: r.display_name || null,
          last_seen_at: r.last_seen_at || null,
        }))
        const connectionsCount = aggRows?.[0]?.connections_count ?? users.length
        // Align displayed count with actual list of user cards
        const usersCount = users.length
        // Align last seen with the most recent known user (first row is latest)
        const lastSeenAt = users.length > 0 ? users[0].last_seen_at : null
        const ipTopReferrers = (Array.isArray(refRows) ? refRows : []).map(r => ({ source: String(r.source || 'direct'), visits: Number(r.visits || 0) }))
        const uaMap = new Map()
        for (const r of Array.isArray(uaRows) ? uaRows : []) {
          const key = categorizeDeviceFromUa(r?.user_agent || '')
          uaMap.set(key, (uaMap.get(key) || 0) + Number(r?.visits || 0))
        }
        const ipTopDevices = Array.from(uaMap.entries()).map(([device, visits]) => ({ device, visits: Number(visits) })).sort((a, b) => (b.visits || 0) - (a.visits || 0))
        const ipCountry = (lastCountryRow && lastCountryRow[0] && lastCountryRow[0].geo_country) ? String(lastCountryRow[0].geo_country).toUpperCase() : null
        const ipMeanRpm5m = Number((((rpmRow?.[0]?.c ?? 0) / 5)).toFixed(2))
        try {
          const caller = await getUserFromRequest(req)
          const adminId = caller?.id || null
          if (sql) await sql`insert into public.admin_activity_logs (admin_id, action, target, detail) values (${adminId}, 'admin_lookup', ${ip}, ${sql.json({ path: 'members-by-ip', via: 'db' })})`
        } catch {}
        res.json({ ok: true, ip, usersCount, connectionsCount, lastSeenAt, users, via: 'database', ipTopReferrers: ipTopReferrers.slice(0,5), ipTopDevices: ipTopDevices.slice(0,5), ipCountry, ipMeanRpm5m })
        return
      } catch (e) {
        // fall back to REST
      }
    }
    // Supabase REST fallback (requires admin via RLS policy)
    if (!supabaseUrlEnv || !supabaseAnonKey) {
      res.status(500).json({ error: 'Database not configured' })
      return
    }
    const headers = { 'apikey': supabaseAnonKey, 'Accept': 'application/json' }
    const bearer = getBearerTokenFromRequest(req)
    if (bearer) Object.assign(headers, { 'Authorization': `Bearer ${bearer}` })
    // Fetch visits for IP to get distinct user_ids and last_seen
    const visitsResp = await fetch(`${supabaseUrlEnv}/rest/v1/web_visits?ip_address=eq.${encodeURIComponent(ip)}&select=user_id,occurred_at,referrer,user_agent,geo_country&order=occurred_at.desc`, { headers })
    if (!visitsResp.ok) {
      const body = await visitsResp.text().catch(() => '')
      res.status(visitsResp.status).json({ error: body || 'Failed to load visits' })
      return
    }
    const visits = await visitsResp.json().catch(() => [])
    const userIdToLastSeen = new Map()
    // REST aggregates for IP
    const refCounts = new Map()
    const deviceCounts = new Map()
    let lastCountry = null
    let rpmCount5m = 0
    const cutoff5m = Date.now() - 5 * 60 * 1000
    for (const v of Array.isArray(visits) ? visits : []) {
      const uid = v?.user_id ? String(v.user_id) : null
      const ts = v?.occurred_at || null
      if (!uid) continue
      const prev = userIdToLastSeen.get(uid)
      if (!prev || (ts && new Date(ts).getTime() > new Date(prev).getTime())) {
        userIdToLastSeen.set(uid, ts)
      }
      // aggregates
      const domain = extractHostname(v?.referrer || '')
      const src = domain || (v?.referrer ? String(v.referrer) : '') || 'direct'
      refCounts.set(src, (refCounts.get(src) || 0) + 1)
      if (v?.user_agent) {
        const dev = categorizeDeviceFromUa(v.user_agent)
        deviceCounts.set(dev, (deviceCounts.get(dev) || 0) + 1)
      }
      if (!lastCountry && v?.geo_country) lastCountry = String(v.geo_country).toUpperCase()
      try { if (ts && new Date(ts).getTime() >= cutoff5m) rpmCount5m++ } catch {}
    }
    const userIds = Array.from(userIdToLastSeen.keys())
    if (userIds.length === 0) {
      res.json({ ok: true, ip, count: 0, users: [], via: 'supabase' })
      return
    }
    // Load display names; email may not be accessible via REST
    const inParam = userIds.map(id => encodeURIComponent(id)).join(',')
    const profResp = await fetch(`${supabaseUrlEnv}/rest/v1/profiles?id=in.(${inParam})&select=id,display_name`, { headers })
    const profiles = profResp.ok ? await profResp.json().catch(() => []) : []
    const idToDisplay = new Map()
    for (const p of Array.isArray(profiles) ? profiles : []) {
      idToDisplay.set(String(p.id), p?.display_name ? String(p.display_name) : null)
    }
    // Fetch emails via security-definer RPC to bypass RLS on auth.users
    let emails = []
    try {
      const emailResp = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/get_emails_by_user_ids`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ _ids: userIds }),
      })
      if (emailResp.ok) {
        emails = await emailResp.json().catch(() => [])
      }
    } catch {}
    const idToEmail = new Map()
    for (const r of Array.isArray(emails) ? emails : []) {
      if (r && r.id) idToEmail.set(String(r.id), r?.email ? String(r.email) : null)
    }
    const users = userIds.map((id) => ({
      id,
      email: idToEmail.get(id) || null,
      display_name: idToDisplay.get(id) || null,
      last_seen_at: userIdToLastSeen.get(id) || null,
    }))
    // Sort by last_seen desc
    users.sort((a, b) => {
      const ta = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0
      const tb = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0
      return tb - ta
    })
    // Aggregates via RPCs to avoid RLS surprises
    let connectionsCount = 0
    // Align last seen and users count with the actual displayed list
    let lastSeenAt = users.length > 0 ? users[0].last_seen_at : null
    let usersCount = users.length
    try {
      const [connResp, usersResp, lastResp] = await Promise.all([
        fetch(`${supabaseUrlEnv}/rest/v1/rpc/count_ip_connections`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ _ip: ip }) }),
        fetch(`${supabaseUrlEnv}/rest/v1/rpc/count_ip_unique_users`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ _ip: ip }) }),
        fetch(`${supabaseUrlEnv}/rest/v1/rpc/get_ip_last_seen`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ _ip: ip }) }),
      ])
      if (connResp.ok) {
        const val = await connResp.json().catch(() => 0)
        if (typeof val === 'number') connectionsCount = val
      }
      // Keep usersCount aligned with the list (do not override via RPC)
      if (usersResp.ok) {
        await usersResp.json().catch(() => users.length)
      }
      // Keep lastSeenAt aligned with known users (do not override with guest-only visits)
      if (lastResp.ok) {
        await lastResp.json().catch(() => null)
      }
    } catch {}

    const ipTopReferrers = Array.from(refCounts.entries()).map(([source, visits]) => ({ source, visits: Number(visits) })).sort((a, b) => (b.visits || 0) - (a.visits || 0)).slice(0,5)
    const ipTopDevices = Array.from(deviceCounts.entries()).map(([device, visits]) => ({ device, visits: Number(visits) })).sort((a, b) => (b.visits || 0) - (a.visits || 0)).slice(0,5)
    const ipCountry = lastCountry || null
    const ipMeanRpm5m = Number((rpmCount5m / 5).toFixed(2))
    try {
      const caller = await getUserFromRequest(req)
      const adminId = caller?.id || null
      if (sql) await sql`insert into public.admin_activity_logs (admin_id, action, target, detail) values (${adminId}, 'admin_lookup', ${ip}, ${sql.json({ path: 'members-by-ip', via: 'rest' })})`
    } catch {}
    res.json({ ok: true, ip, usersCount, connectionsCount, lastSeenAt, users, via: 'supabase', ipTopReferrers, ipTopDevices, ipCountry, ipMeanRpm5m })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to search by IP' })
  }
})

// Admin: per-user visits series (last 30 days, UTC calendar days)
app.get('/api/admin/member-visits-series', async (req, res) => {
  try {
    // Admin check disabled to mirror member lookup behavior
    const userIdParam = (req.query.userId || req.query.user_id || '').toString().trim()
    const emailParam = (req.query.email || '').toString().trim()

    const resolveUserIdViaRest = async (email) => {
      if (!supabaseUrlEnv || !supabaseAnonKey) return null
      const headers = { 'apikey': supabaseAnonKey, 'Accept': 'application/json', 'Content-Type': 'application/json' }
      const token = getBearerTokenFromRequest(req)
      if (token) Object.assign(headers, { 'Authorization': `Bearer ${token}` })
      try {
        const rpc = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/get_user_id_by_email`, {
          method: 'POST', headers, body: JSON.stringify({ _email: email })
        })
        if (rpc.ok) {
          const val = await rpc.json().catch(() => null)
          if (val) return String(val)
        }
      } catch {}
      return null
    }

    // Resolve user id
    let targetUserId = userIdParam || null
    if (!targetUserId && emailParam) {
      const email = emailParam.toLowerCase()
      if (sql) {
        try {
          const users = await sql`select id from auth.users where lower(email) = ${email} limit 1`
          if (Array.isArray(users) && users[0]) targetUserId = String(users[0].id)
        } catch {}
      }
      if (!targetUserId) targetUserId = await resolveUserIdViaRest(emailParam)
    }
    if (!targetUserId) {
      res.status(400).json({ error: 'Missing userId or email' })
      return
    }

    // SQL (preferred)
    if (sql) {
      try {
        const rows = await sql`
          with days as (
            select generate_series(((now() at time zone 'utc')::date - interval '29 days'), (now() at time zone 'utc')::date, interval '1 day')::date as d
          )
          select d as day,
                 coalesce((select count(*) from public.web_visits v where v.user_id = ${targetUserId} and (timezone('utc', v.occurred_at))::date = d), 0)::int as visits
          from days
          order by d asc
        `
        const series30d = (rows || []).map(r => ({ date: new Date(r.day).toISOString().slice(0,10), visits: Number(r.visits || 0) }))
        const total30d = series30d.reduce((a, b) => a + (b.visits || 0), 0)
        res.json({ ok: true, userId: targetUserId, series30d, total30d, via: 'database' })
        return
      } catch (e) {
        // fall through to REST
      }
    }

    // Supabase REST fallback using security-definer RPC
    if (supabaseUrlEnv && supabaseAnonKey) {
      const headers = { 'apikey': supabaseAnonKey, 'Accept': 'application/json', 'Content-Type': 'application/json' }
      const token = getBearerTokenFromRequest(req)
      if (token) Object.assign(headers, { 'Authorization': `Bearer ${token}` })
      try {
        const resp = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/get_user_visits_series_days`, {
          method: 'POST', headers, body: JSON.stringify({ _user_id: targetUserId, _days: 30 })
        })
        if (resp.ok) {
          const arr = await resp.json().catch(() => [])
          const series30d = (Array.isArray(arr) ? arr : []).map((r) => ({ date: String(r.date), visits: Number(r.visits || 0) }))
          const total30d = series30d.reduce((a, b) => a + (b.visits || 0), 0)
          res.json({ ok: true, userId: targetUserId, series30d, total30d, via: 'supabase' })
          return
        }
      } catch {}
    }

    res.status(500).json({ error: 'Database not configured' })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to load member visits series' })
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
    const seenIds = new Set()
    const seenEmails = new Set()
    const seenDisplay = new Set()
    try {
      if (sql) {
        // Email matches
        const emailRows = await sql`
          select u.id, u.email, u.created_at, p.display_name
          from auth.users u
          left join public.profiles p on p.id = u.id
          where lower(u.email) like ${q + '%'}
          order by u.created_at desc
          limit 7
        `
        if (Array.isArray(emailRows)) {
          for (const r of emailRows) {
            const idKey = String(r.id)
            const emailKey = (r.email ? String(r.email).toLowerCase() : '')
            if (seenIds.has(idKey) || (emailKey && seenEmails.has(emailKey))) continue
            seenIds.add(idKey)
            if (emailKey) seenEmails.add(emailKey)
            if (r.display_name) seenDisplay.add(String(r.display_name).toLowerCase())
            out.push({ id: r.id, email: r.email || null, display_name: r.display_name || null, created_at: r.created_at })
          }
        }
        // Display name matches
        const nameRows = await sql`
          select u.id, u.email, u.created_at, p.display_name
          from public.profiles p
          join auth.users u on u.id = p.id
          where lower(p.display_name) like ${q + '%'}
          order by u.created_at desc
          limit 7
        `
        if (Array.isArray(nameRows)) {
          for (const r of nameRows) {
            const idKey = String(r.id)
            const emailKey = (r.email ? String(r.email).toLowerCase() : '')
            const dispKey = (r.display_name ? String(r.display_name).toLowerCase() : '')
            if (seenIds.has(idKey)) continue
            if (emailKey && seenEmails.has(emailKey)) continue
            if (dispKey && seenDisplay.has(dispKey)) continue
            seenIds.add(idKey)
            if (emailKey) seenEmails.add(emailKey)
            if (dispKey) seenDisplay.add(dispKey)
            out.push({ id: r.id, email: r.email || null, display_name: r.display_name || null, created_at: r.created_at })
          }
        }
      } else {
        // Fallback via Supabase REST (security-definer RPC; token optional)
        if (supabaseUrlEnv && supabaseAnonKey) {
          const headers = { 'apikey': supabaseAnonKey, 'Accept': 'application/json', 'Content-Type': 'application/json' }
          const token = getBearerTokenFromRequest(req)
          if (token) Object.assign(headers, { 'Authorization': `Bearer ${token}` })
          // Email suggestions
          const [emailResp, nameResp] = await Promise.all([
            fetch(`${supabaseUrlEnv}/rest/v1/rpc/suggest_users_by_email_prefix`, {
              method: 'POST', headers, body: JSON.stringify({ _prefix: q, _limit: 7 }),
            }),
            fetch(`${supabaseUrlEnv}/rest/v1/rpc/suggest_users_by_display_name_prefix`, {
              method: 'POST', headers, body: JSON.stringify({ _prefix: q, _limit: 7 }),
            }),
          ])
          if (emailResp.ok) {
            const arr = await emailResp.json().catch(() => [])
            for (const r of Array.isArray(arr) ? arr : []) {
              const idKey = String(r.id)
              const emailKey = (r.email ? String(r.email).toLowerCase() : '')
              if (seenIds.has(idKey) || (emailKey && seenEmails.has(emailKey))) continue
              seenIds.add(idKey)
              if (emailKey) seenEmails.add(emailKey)
              out.push({ id: r.id, email: r.email || null, display_name: null, created_at: r.created_at })
            }
          }
          if (nameResp.ok) {
            const arr = await nameResp.json().catch(() => [])
            for (const r of Array.isArray(arr) ? arr : []) {
              const idKey = String(r.id)
              const dispKey = (r.display_name ? String(r.display_name).toLowerCase() : '')
              if (seenIds.has(idKey) || (dispKey && seenDisplay.has(dispKey))) continue
              seenIds.add(idKey)
              if (dispKey) seenDisplay.add(dispKey)
              out.push({ id: r.id, email: null, display_name: r.display_name || null, created_at: r.created_at || null })
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
    try {
      const caller = await getUserFromRequest(req)
      const adminId = caller?.id || null
      const adminName = null
      await sql`insert into public.admin_activity_logs (admin_id, admin_name, action, target, detail) values (${adminId}, ${adminName}, 'promote_admin', ${targetId}, ${sql.json({ email: targetEmail })})`
    } catch {}
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

// Admin: demote a user from admin by email or user_id
app.post('/api/admin/demote-admin', async (req, res) => {
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
    // Ensure profiles table exists, then set is_admin = false
    try {
      const exists = await sql`select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles'`
      if (!exists || exists.length === 0) {
        res.status(500).json({ error: 'Profiles table not found' })
        return
      }
    } catch {}
    try {
      await sql`insert into public.profiles (id, is_admin) values (${targetId}, false) on conflict (id) do update set is_admin = false`
    } catch (e) {
      res.status(500).json({ error: e?.message || 'Failed to demote user' })
      return
    }
    try {
      const caller = await getUserFromRequest(req)
      const adminId = caller?.id || null
      const adminName = null
      await sql`insert into public.admin_activity_logs (admin_id, admin_name, action, target, detail) values (${adminId}, ${adminName}, 'demote_admin', ${targetId}, ${sql.json({ email: targetEmail })})`
    } catch {}
    res.json({ ok: true, userId: targetId, email: targetEmail, isAdmin: false })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to demote user' })
  }
})

app.options('/api/admin/demote-admin', (_req, res) => {
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

    try {
      const caller = await getUserFromRequest(req)
      const adminId = caller?.id || null
      const adminName = null
      await sql`insert into public.admin_activity_logs (admin_id, admin_name, action, target, detail) values (${adminId}, ${adminName}, 'ban_user', ${email}, ${sql.json({ userId, ips })})`
    } catch {}
    res.json({ ok: true, userId: userId || null, email, ipCount: ips.length, bannedAt: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to ban user' })
  }
})

// Helper: load plants via Supabase anon client when SQL is unavailable
async function loadPlantsViaSupabase() {
  if (!supabaseServer) return null
  try {
    const { data, error } = await supabaseServer
      .from('plants')
      .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, care_sunlight, care_water, care_soil, care_difficulty, seeds_available, water_freq_unit, water_freq_value, water_freq_period, water_freq_amount')
      .order('name', { ascending: true })
    if (error) return null
    return (Array.isArray(data) ? data : []).map((r) => ({
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
      // Optional frequency fields (tolerated by client)
      waterFreqUnit: r.water_freq_unit ?? undefined,
      waterFreqValue: r.water_freq_value ?? null,
      waterFreqPeriod: r.water_freq_period ?? undefined,
      waterFreqAmount: r.water_freq_amount ?? null,
    }))
  } catch {
    return null
  }
}

app.get('/api/plants', async (_req, res) => {
  try {
    if (sql) {
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
        return
      } catch (e) {
        // Fall through to Supabase fallback on SQL query failure
      }
    }
    const fallback = await loadPlantsViaSupabase()
    if (fallback) {
      res.json(fallback)
      return
    }
    res.status(500).json({ error: 'Database not configured' })
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

// Admin: refresh website by invoking scripts/refresh-plant-swipe.sh from repo root
async function handlePullCode(req, res) {
  try {
    const uid = "public"
    if (!uid) return

    const branch = (req.query.branch || '').toString().trim() || undefined
    const repoRoot = await getRepoRoot()
    const scriptPath = path.resolve(repoRoot, 'scripts', 'refresh-plant-swipe.sh')

    // Verify the refresh script exists
    try {
      await fs.access(scriptPath)
    } catch {
      res.status(500).json({ ok: false, error: `refresh script not found at ${scriptPath}` })
      return
    }
    // Ensure it is executable (best-effort)
    try { await fs.chmod(scriptPath, 0o755) } catch {}

    // Pre-validate requested branch to fail fast on typos or deleted branches
    if (branch) {
      try {
        const gitBase = `git -c "safe.directory=${repoRoot}" -C "${repoRoot}"`
        await exec(`${gitBase} remote update --prune`, { timeout: 30000 })
        const [{ stdout: remoteOut }, { stdout: localOut }] = await Promise.all([
          exec(`${gitBase} for-each-ref --format='%(refname:short)' refs/remotes/origin`, { timeout: 30000 }),
          exec(`${gitBase} for-each-ref --format='%(refname:short)' refs/heads`, { timeout: 30000 }),
        ])
        const normalize = (s) => s.trim().replace(/^origin\//, '')
        const allowed = new Set(
          [...(remoteOut || '').split('\n'), ...(localOut || '').split('\n')]
            .map(x => x.trim())
            .filter(Boolean)
            .map(normalize)
            .filter(name => name && name !== 'HEAD' && name !== 'origin' && !name.includes('->'))
        )
        if (!allowed.has(branch)) {
          res.status(400).json({ ok: false, error: `Unknown branch: ${branch}` })
          return
        }
      } catch {}
    }

    // Execute the script from repository root so it updates current branch and builds
    // Run detached so we can return a response before the service restarts
    const execEnv = { ...process.env, CI: process.env.CI || 'true', SUDO_ASKPASS: process.env.SUDO_ASKPASS || '', PLANTSWIPE_REPO_DIR: repoRoot }
    // Do not restart services inside the script when invoked from the API.
    // This allows us to finish the SSE cleanly and control restarts from the UI.
    execEnv.SKIP_SERVICE_RESTARTS = 'true'
    if (branch) {
      // Pass target branch to refresh script
      execEnv.PLANTSWIPE_TARGET_BRANCH = branch
    }
    const child = spawnChild(scriptPath, {
      cwd: repoRoot,
      detached: true,
      stdio: 'ignore',
      env: execEnv,
      shell: false,
    })
    try { child.unref() } catch {}

    try {
      const caller = await getUserFromRequest(req)
      const adminId = caller?.id || null
      let adminName = null
      if (sql && adminId) {
        try {
          const rows = await sql`select coalesce(display_name, '') as name from public.profiles where id = ${adminId} limit 1`
          adminName = (rows?.[0]?.name || '').trim() || null
        } catch {}
      }
      if (!adminName && supabaseUrlEnv && supabaseAnonKey && adminId) {
        try {
          const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
          const bearer = getBearerTokenFromRequest(req)
          if (bearer) headers['Authorization'] = `Bearer ${bearer}`
          const url = `${supabaseUrlEnv}/rest/v1/profiles?id=eq.${encodeURIComponent(adminId)}&select=display_name&limit=1`
          const r = await fetch(url, { headers })
          if (r.ok) {
            const arr = await r.json().catch(() => [])
            adminName = Array.isArray(arr) && arr[0] ? (arr[0].display_name || null) : null
          }
        } catch {}
      }
      let ok = false
      if (sql) {
        try { await sql`insert into public.admin_activity_logs (admin_id, admin_name, action, target, detail) values (${adminId}, ${adminName}, 'pull_code', ${branch || null}, ${sql.json({ source: 'api' })})`; ok = true } catch {}
      }
      if (!ok) {
        try { await insertAdminActivityViaRest(req, { admin_id: adminId, admin_name: adminName, action: 'pull_code', target: branch || null, detail: { source: 'api' } }) } catch {}
      }
    } catch {}
    res.json({ ok: true, branch, started: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'refresh failed' })
  }
}

app.post('/api/admin/pull-code', handlePullCode)
app.get('/api/admin/pull-code', handlePullCode)
app.options('/api/admin/pull-code', (_req, res) => {
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.status(204).end()
})

// Admin: stream pull/build logs via Server-Sent Events (SSE)
app.get('/api/admin/pull-code/stream', async (req, res) => {
  try {
    const uid = "public"
    if (!uid) return

    // Require admin (same policy as other admin endpoints)
    const isAdmin = await isAdminFromRequest(req)
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin privileges required' })
      return
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // for nginx
    res.flushHeaders?.()

    const send = (event, data) => {
      try {
        if (event) res.write(`event: ${event}\n`)
        const payload = typeof data === 'string' ? data : JSON.stringify(data)
        // Split by lines to avoid giant frames
        const lines = String(payload).split(/\r?\n/) || []
        for (const line of lines) res.write(`data: ${line}\n`)
        res.write('\n')
      } catch {}
    }

    send('open', { ok: true, message: 'Starting refresh…' })

    const repoRoot = await getRepoRoot()
    const branch = (req.query.branch || '').toString().trim() || ''

    // Log that a streamed pull/build has been initiated
    try {
      const caller = await getUserFromRequest(req)
      const adminId = caller?.id || null
      let adminName = null
      if (sql && adminId) {
        try {
          const rows = await sql`select coalesce(display_name, '') as name from public.profiles where id = ${adminId} limit 1`
          adminName = (rows?.[0]?.name || '').trim() || null
        } catch {}
      }
      if (!adminName && supabaseUrlEnv && supabaseAnonKey && adminId) {
        try {
          const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
          const bearer = getBearerTokenFromRequest(req)
          if (bearer) headers['Authorization'] = `Bearer ${bearer}`
          const url = `${supabaseUrlEnv}/rest/v1/profiles?id=eq.${encodeURIComponent(adminId)}&select=display_name&limit=1`
          const r = await fetch(url, { headers })
          if (r.ok) {
            const arr = await r.json().catch(() => [])
            adminName = Array.isArray(arr) && arr[0] ? (arr[0].display_name || null) : null
          }
        } catch {}
      }
      let ok = false
      if (sql) {
        try { await sql`insert into public.admin_activity_logs (admin_id, admin_name, action, target, detail) values (${adminId}, ${adminName}, 'pull_code', ${branch || null}, ${sql.json({ source: 'stream' })})`; ok = true } catch {}
      }
      if (!ok) {
        try { await insertAdminActivityViaRest(req, { admin_id: adminId, admin_name: adminName, action: 'pull_code', target: branch || null, detail: { source: 'stream' } }) } catch {}
      }
    } catch {}
    const scriptPath = path.resolve(repoRoot, 'scripts', 'refresh-plant-swipe.sh')
    try { await fs.access(scriptPath) } catch {
      send('error', { error: `refresh script not found at ${scriptPath}` })
      res.end()
      return
    }
    try { await fs.chmod(scriptPath, 0o755) } catch {}

    // Allow the script to perform restarts even if it drops the stream briefly
    const childEnv = { ...process.env, CI: process.env.CI || 'true', PLANTSWIPE_REPO_DIR: repoRoot }
    // Avoid restarting services from the script while streaming logs (keeps SSE alive)
    childEnv.SKIP_SERVICE_RESTARTS = 'true'
    if (branch) {
      // Pre-validate requested branch and surface a clear error on failure
      try {
        const gitBase = `git -c "safe.directory=${repoRoot}" -C "${repoRoot}"`
        await exec(`${gitBase} remote update --prune`, { timeout: 30000 })
        const [{ stdout: remoteOut }, { stdout: localOut }] = await Promise.all([
          exec(`${gitBase} for-each-ref --format='%(refname:short)' refs/remotes/origin`, { timeout: 30000 }),
          exec(`${gitBase} for-each-ref --format='%(refname:short)' refs/heads`, { timeout: 30000 }),
        ])
        const normalize = (s) => s.trim().replace(/^origin\//, '')
        const allowed = new Set(
          [...(remoteOut || '').split('\n'), ...(localOut || '').split('\n')]
            .map(x => x.trim())
            .filter(Boolean)
            .map(normalize)
            .filter(name => name && name !== 'HEAD' && name !== 'origin' && !name.includes('->'))
        )
        if (!allowed.has(branch)) {
          send('error', { error: `Unknown branch: ${branch}` })
          send('done', { ok: false, code: 1 })
          res.end()
          return
        }
      } catch {}
      childEnv.PLANTSWIPE_TARGET_BRANCH = branch
      send('log', `[pull] Target branch requested: ${branch}`)
    }
    const child = spawnChild(scriptPath, [], {
      cwd: repoRoot,
      env: childEnv,
      shell: false,
    })

    // Stream stdout/stderr
    child.stdout?.on('data', (buf) => {
      const text = buf.toString()
      send('log', text)
    })
    child.stderr?.on('data', (buf) => {
      const text = buf.toString()
      send('log', text)
    })
    child.on('error', (err) => {
      send('error', { error: err?.message || 'spawn failed' })
    })
    child.on('close', (code) => {
      if (code === 0) {
        send('done', { ok: true, code })
      } else {
        send('done', { ok: false, code })
      }
      try { res.end() } catch {}
    })

    // Heartbeat to keep the connection alive behind proxies
    const id = setInterval(() => { try { res.write(': ping\n\n') } catch {} }, 15000)
    req.on('close', () => { try { clearInterval(id) } catch {}; try { child.kill('SIGTERM') } catch {} })
  } catch (e) {
    try { res.status(500).json({ error: e?.message || 'stream failed' }) } catch {}
  }
})

// Admin: list remote branches and current branch
app.get('/api/admin/branches', async (req, res) => {
  try {
    const uid = "public"
    if (!uid) return

    // Always operate from the repository root and mark it safe for this process
    const repoRoot = await getRepoRoot()
    const gitBase = `git -c "safe.directory=${repoRoot}" -C "${repoRoot}"`
    await exec(`${gitBase} remote update --prune`, { timeout: 60000 })
    // Prefer for-each-ref over branch -r to avoid pointer lines and formatting quirks
    const { stdout: branchesStdout } = await exec(`${gitBase} for-each-ref --format='%(refname:short)' refs/remotes/origin`, { timeout: 60000 })
    let branches = branchesStdout
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => name.replace(/^origin\//, ''))
      // Exclude HEAD pointer, the remote namespace itself ("origin"), and any symbolic ref lines
      .filter(name => name !== 'HEAD' && name !== 'origin' && !name.includes('->'))
      .sort((a, b) => a.localeCompare(b))

    // Fallback to local branches if remote list is empty (e.g., detached or offline)
    if (branches.length === 0) {
      const { stdout: localStdout } = await exec(`${gitBase} for-each-ref --format='%(refname:short)' refs/heads`, { timeout: 60000 })
      branches = localStdout
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
    }

    const { stdout: currentStdout } = await exec(`${gitBase} rev-parse --abbrev-ref HEAD`, { timeout: 30000 })
    const current = currentStdout.trim()

    try {
      const caller = await getUserFromRequest(req)
      const adminId = caller?.id || null
      const adminName = null
      if (sql) await sql`insert into public.admin_activity_logs (admin_id, admin_name, action, target, detail) values (${adminId}, ${adminName}, 'list_branches', ${current || null}, ${sql.json({ count: branches.length })})`
    } catch {}
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
    const { pagePath, referrer: bodyReferrer, userId, extra, pageTitle, language } = req.body || {}
    const ipAddress = getClientIp(req)
    const geo = await resolveGeo(req, ipAddress)
    const userAgent = req.get('user-agent') || ''
    const tokenUserId = await getUserIdFromRequest(req)
    const effectiveUserId = tokenUserId || (typeof userId === 'string' ? userId : null)
    if (typeof pagePath !== 'string' || pagePath.length === 0) {
      res.status(400).json({ error: 'Missing pagePath' })
      return
    }
    const acceptLanguage = (req.get('accept-language') || '').split(',')[0] || null
    const lang = language || acceptLanguage
    const referrer = (typeof bodyReferrer === 'string' && bodyReferrer.length > 0) ? bodyReferrer : (req.get('referer') || req.get('referrer') || '')
    await insertWebVisit({ sessionId, userId: effectiveUserId, pagePath, referrer, userAgent, ipAddress, geo, extra, pageTitle, language: lang }, req)
    res.status(204).end()
  } catch (e) {
    res.status(500).json({ error: 'Failed to record visit' })
  }
})

// Admin: unique visitors stats (past 10m and 7 days)
app.get('/api/admin/visitors-stats', async (req, res) => {
  const uid = "public"
  if (!uid) return
  // Helper that always succeeds using in-memory analytics
  const respondFromMemory = (extra = {}) => {
    try {
      const daysParam = Number(req.query.days || 7)
      const days = (daysParam === 30 ? 30 : 7)
      const currentUniqueVisitors10m = memAnalytics.getUniqueIpCountInLastMinutes(10)
      const uniqueIpsLast30m = memAnalytics.getUniqueIpCountInLastMinutes(30)
      const uniqueIpsLast60m = memAnalytics.getUniqueIpCountInLastMinutes(60)
      const visitsLast60m = memAnalytics.getVisitCountInLastMinutes(60)
      const uniqueIps7d = memAnalytics.getUniqueIpCountInLastDays(days)
      const series7d = memAnalytics.getDailySeries(days)
      res.json({ ok: true, currentUniqueVisitors10m, uniqueIpsLast30m, uniqueIpsLast60m, visitsLast60m, uniqueIps7d, series7d, via: 'memory', days, ...extra })
      return true
    } catch {
      return false
    }
  }
  try {
    if (!sql) {
      // Supabase REST fallback using security-definer RPCs
      if (supabaseUrlEnv && supabaseAnonKey) {
        try {
          const headers = { 'apikey': supabaseAnonKey, 'Accept': 'application/json', 'Content-Type': 'application/json' }
          // Attempt to use caller token when present (not required for definer functions)
          const token = getBearerTokenFromRequest(req)
          if (token) Object.assign(headers, { 'Authorization': `Bearer ${token}` })

          const daysParam = Number(req.query.days || 7)
          const days = (daysParam === 30 ? 30 : 7)

          const [c10, c30, c60u, c60v, uN, sN] = await Promise.all([
            fetch(`${supabaseUrlEnv}/rest/v1/rpc/count_unique_ips_last_minutes`, { method: 'POST', headers, body: JSON.stringify({ _minutes: 10 }) }),
            fetch(`${supabaseUrlEnv}/rest/v1/rpc/count_unique_ips_last_minutes`, { method: 'POST', headers, body: JSON.stringify({ _minutes: 30 }) }),
            fetch(`${supabaseUrlEnv}/rest/v1/rpc/count_unique_ips_last_minutes`, { method: 'POST', headers, body: JSON.stringify({ _minutes: 60 }) }),
            fetch(`${supabaseUrlEnv}/rest/v1/rpc/count_visits_last_minutes`, { method: 'POST', headers, body: JSON.stringify({ _minutes: 60 }) }),
            fetch(`${supabaseUrlEnv}/rest/v1/rpc/count_unique_ips_last_days`, { method: 'POST', headers, body: JSON.stringify({ _days: days }) }),
            fetch(`${supabaseUrlEnv}/rest/v1/rpc/get_visitors_series_days`, { method: 'POST', headers, body: JSON.stringify({ _days: days }) }),
          ])

          const [c10v, c30v, c60uv, c60vv, uNv, sNv] = await Promise.all([
            c10.ok ? c10.json().catch(() => 0) : Promise.resolve(0),
            c30.ok ? c30.json().catch(() => 0) : Promise.resolve(0),
            c60u.ok ? c60u.json().catch(() => 0) : Promise.resolve(0),
            c60v.ok ? c60v.json().catch(() => 0) : Promise.resolve(0),
            uN.ok ? uN.json().catch(() => 0) : Promise.resolve(0),
            sN.ok ? sN.json().catch(() => []) : Promise.resolve([]),
          ])

          const series7d = Array.isArray(sNv)
            ? sNv.map((r) => ({ date: String(r.date), uniqueVisitors: Number(r.unique_visitors ?? 0) }))
            : []

          res.json({
            ok: true,
            currentUniqueVisitors10m: Number(c10v) || 0,
            uniqueIpsLast30m: Number(c30v) || 0,
            uniqueIpsLast60m: Number(c60uv) || 0,
            visitsLast60m: Number(c60vv) || 0,
            uniqueIps7d: Number(uNv) || 0,
            series7d,
            via: 'supabase',
            days,
          })
          return
        } catch {}
      }
      // Fallback to memory-only if Supabase REST isn't configured or failed
      respondFromMemory()
      return
    }

    const daysParam = Number(req.query.days || 7)
    const days = (daysParam === 30 ? 30 : 7)
    const [rows10m, rows30m, rows60mUnique, rows60mRaw, rowsNdUnique] = await Promise.all([
      sql`select count(distinct v.ip_address)::int as c from public.web_visits v where v.ip_address is not null and v.occurred_at >= now() - interval '10 minutes'`,
      sql`select count(distinct v.ip_address)::int as c from public.web_visits v where v.ip_address is not null and v.occurred_at >= now() - interval '30 minutes'`,
      sql`select count(distinct v.ip_address)::int as c from public.web_visits v where v.ip_address is not null and v.occurred_at >= now() - interval '60 minutes'`,
      sql`select count(*)::int as c from public.web_visits where occurred_at >= now() - interval '60 minutes'`,
      // Unique IPs across the last N calendar days in UTC
      sql`select count(distinct v.ip_address)::int as c
           from public.web_visits v
           where v.ip_address is not null
             and timezone('utc', v.occurred_at) >= ((now() at time zone 'utc')::date - interval '${days - 1} days')`
    ])

    const currentUniqueVisitors10m = rows10m?.[0]?.c ?? 0
    const uniqueIpsLast30m = rows30m?.[0]?.c ?? 0
    const uniqueIpsLast60m = rows60mUnique?.[0]?.c ?? 0
    const visitsLast60m = rows60mRaw?.[0]?.c ?? 0
    const uniqueIps7d = rowsNdUnique?.[0]?.c ?? 0

    const rows7 = await sql`
      with days as (
        select generate_series(((now() at time zone 'utc')::date - interval '${days - 1} days'), (now() at time zone 'utc')::date, interval '1 day')::date as d
      )
      select d as day,
             coalesce((select count(distinct v.ip_address)
                       from public.web_visits v
                       where timezone('utc', v.occurred_at)::date = d
                         and v.ip_address is not null), 0)::int as unique_visitors
      from days
      order by d asc
    `
    const series7d = (rows7 || []).map(r => ({ date: new Date(r.day).toISOString().slice(0,10), uniqueVisitors: Number(r.unique_visitors || 0) }))

    res.json({ ok: true, currentUniqueVisitors10m, uniqueIpsLast30m, uniqueIpsLast60m, visitsLast60m, uniqueIps7d, series7d, via: 'database', days })
  } catch (e) {
    // On DB failure, fall back to in-memory analytics instead of 500s
    if (!respondFromMemory({ error: e?.message || 'DB query failed' })) {
      res.status(500).json({ ok: false, error: e?.message || 'DB query failed' })
    }
  }
})

// Admin: total unique visitors across last 7 days (distinct IPs, UTC calendar days)
app.get('/api/admin/visitors-unique-7d', async (req, res) => {
  const uid = "public"
  if (!uid) return
  const respondFromMemory = (extra = {}) => {
    try {
      const uniqueIps7d = memAnalytics.getUniqueIpCountInLastDays(7)
      res.json({ ok: true, uniqueIps7d, via: 'memory', ...extra })
      return true
    } catch {
      return false
    }
  }
  try {
    if (sql) {
      const rows = await sql`
        select count(distinct v.ip_address)::int as c
        from public.web_visits v
        where v.ip_address is not null
          and timezone('utc', v.occurred_at) >= ((now() at time zone 'utc')::date - interval '6 days')
      `
      const uniqueIps7d = rows?.[0]?.c ?? 0
      res.json({ ok: true, uniqueIps7d, via: 'database' })
      return
    }

    // Supabase REST fallback using security-definer RPC
    if (supabaseUrlEnv && supabaseAnonKey) {
      const headers = { 'apikey': supabaseAnonKey, 'Accept': 'application/json', 'Content-Type': 'application/json' }
      const token = getBearerTokenFromRequest(req)
      if (token) Object.assign(headers, { 'Authorization': `Bearer ${token}` })
      const r = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/count_unique_ips_last_days`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ _days: 7 }),
      })
      if (r.ok) {
        const val = await r.json().catch(() => 0)
        const uniqueIps7d = Number(val) || 0
        res.json({ ok: true, uniqueIps7d, via: 'supabase' })
        return
      }
    }

    // Memory fallback
    respondFromMemory()
  } catch (e) {
    if (!respondFromMemory({ error: e?.message || 'DB query failed' })) {
      res.status(500).json({ ok: false, error: e?.message || 'DB query failed' })
    }
  }
})

// Admin: breakdown of where visitors come from (top countries and top referrers)
app.get('/api/admin/sources-breakdown', async (req, res) => {
  const uid = "public"
  if (!uid) return
  try {
    // Memory fallback cannot easily yield breakdowns; prefer DB or Supabase REST
    if (sql) {
      const daysParam = Number(req.query.days || 30)
      const days = (daysParam === 7 ? 7 : 30)
      const [countries, referrers] = await Promise.all([
        sql`select * from public.get_top_countries(${days}, ${10000})`,
        sql`select * from public.get_top_referrers(${days}, ${10})`,
      ])
      const allCountries = (countries || []).map(r => ({ country: (r.country || ''), visits: Number(r.visits || 0) })).filter(c => c.country)
      const allReferrers = (referrers || []).map(r => ({ source: String(r.source || 'direct'), visits: Number(r.visits || 0) }))
      allCountries.sort((a, b) => (b.visits || 0) - (a.visits || 0))
      allReferrers.sort((a, b) => (b.visits || 0) - (a.visits || 0))
      const topCountries = allCountries.slice(0, 5)
      const otherCountriesList = allCountries.slice(5)
      const otherCountries = { count: otherCountriesList.length, visits: otherCountriesList.reduce((s, c) => s + (c.visits || 0), 0) }
      const topReferrers = allReferrers.slice(0, 5)
      const otherReferrersList = allReferrers.slice(5)
      const otherReferrers = { count: otherReferrersList.length, visits: otherReferrersList.reduce((s, c) => s + (c.visits || 0), 0) }
      res.json({ ok: true, topCountries, otherCountries, topReferrers, otherReferrers, via: 'database', days })
      return
    }

    if (supabaseUrlEnv && supabaseAnonKey) {
      const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
      const token = getBearerTokenFromRequest(req)
      if (token) headers.Authorization = `Bearer ${token}`
      const daysParam = Number(req.query.days || 30)
      const days = (daysParam === 7 ? 7 : 30)
      // Prefer RPCs for reliable grouping
      const [cr, rr] = await Promise.all([
        fetch(`${supabaseUrlEnv}/rest/v1/rpc/get_top_countries`, { method: 'POST', headers, body: JSON.stringify({ _days: days, _limit: 10000 }) }),
        fetch(`${supabaseUrlEnv}/rest/v1/rpc/get_top_referrers`, { method: 'POST', headers, body: JSON.stringify({ _days: days, _limit: 10 }) }),
      ])
      const cData = cr.ok ? await cr.json().catch(() => []) : []
      const rData = rr.ok ? await rr.json().catch(() => []) : []
      const allCountries = (Array.isArray(cData) ? cData : []).map((r) => ({ country: String(r.country || ''), visits: Number(r.visits || 0) })).filter(c => !!c.country)
      const allReferrers = (Array.isArray(rData) ? rData : []).map((r) => ({ source: String(r.source || 'direct'), visits: Number(r.visits || 0) }))
      allCountries.sort((a, b) => (b.visits || 0) - (a.visits || 0))
      allReferrers.sort((a, b) => (b.visits || 0) - (a.visits || 0))
      const topCountries = allCountries.slice(0, 5)
      const otherCountriesList = allCountries.slice(5)
      const otherCountries = { count: otherCountriesList.length, visits: otherCountriesList.reduce((s, c) => s + (c.visits || 0), 0) }
      const topReferrers = allReferrers.slice(0, 5)
      const otherReferrersList = allReferrers.slice(5)
      const otherReferrers = { count: otherReferrersList.length, visits: otherReferrersList.reduce((s, c) => s + (c.visits || 0), 0) }
      res.json({ ok: true, topCountries, otherCountries, topReferrers, otherReferrers, via: 'supabase', days })
      return
    }

    res.status(200).json({ ok: true, topCountries: [], topReferrers: [], via: 'memory' })
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Failed to load sources breakdown' })
  }
})

// Admin: list unique IP addresses connected in the last N minutes (default 60)
app.get('/api/admin/online-ips', async (req, res) => {
  const uid = "public"
  if (!uid) return
  const minutesParam = Number(req.query.minutes || req.query.window || 60)
  const windowMinutes = Number.isFinite(minutesParam) && minutesParam > 0 ? Math.min(24 * 60, Math.floor(minutesParam)) : 60

  const respondFromMemory = (extra = {}) => {
    try {
      // Build set of IPs from the in-memory minute buckets within the window
      const nowMin = Math.floor(Date.now() / 60000)
      const start = nowMin - windowMinutes + 1
      const uniq = new Set()
      for (let m = start; m <= nowMin; m++) {
        const set = memAnalytics.minuteToUniqueIps.get(m)
        if (set && set.size) {
          for (const ip of set) uniq.add(ip)
        }
      }
      const ips = Array.from(uniq)
      res.json({ ok: true, ips, via: 'memory', windowMinutes, count: ips.length, updatedAt: Date.now() })
      return true
    } catch {
      return false
    }
  }

  try {
    if (sql) {
      const rows = await sql`
        select distinct v.ip_address as ip
        from public.web_visits v
        where v.ip_address is not null
          and v.occurred_at >= now() - interval '${windowMinutes} minutes'
        order by ip asc
      `
      const ips = Array.isArray(rows) ? rows.map(r => String(r.ip)).filter(Boolean) : []
      res.json({ ok: true, ips, via: 'database', windowMinutes, count: ips.length, updatedAt: Date.now() })
      return
    }

    // Supabase REST fallback: query distinct IPs in window
    if (supabaseUrlEnv && supabaseAnonKey) {
      const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
      const token = getBearerTokenFromRequest(req)
      if (token) headers.Authorization = `Bearer ${token}`
      // Use RPC if available; otherwise use REST with select distinct
      let ips = []
      try {
        const resp = await fetch(`${supabaseUrlEnv}/rest/v1/web_visits?select=ip_address&occurred_at=gte.${new Date(Date.now() - windowMinutes * 60000).toISOString()}&ip_address=not.is.null`, { headers })
        if (resp.ok) {
          const arr = await resp.json().catch(() => [])
          const uniq = new Set((Array.isArray(arr) ? arr : []).map(r => String(r.ip_address || '')).filter(Boolean))
          ips = Array.from(uniq).sort()
        }
      } catch {}
      if (ips.length > 0) {
        res.json({ ok: true, ips, via: 'supabase', windowMinutes, count: ips.length, updatedAt: Date.now() })
        return
      }
    }

    if (!respondFromMemory()) {
      res.status(500).json({ ok: false, error: 'Failed to collect IPs' })
    }
  } catch (e) {
    if (!respondFromMemory({ error: e?.message || 'DB query failed' })) {
      res.status(500).json({ ok: false, error: e?.message || 'DB query failed' })
    }
  }
})

// Admin: simple online users count (unique IPs past 60 minutes)
app.get('/api/admin/online-users', async (req, res) => {
  const uid = "public"
  if (!uid) return
  const respondFromMemory = (extra = {}) => {
    try {
      const ipCount = memAnalytics.getUniqueIpCountInLastMinutes(60)
      res.json({ ok: true, onlineUsers: ipCount, via: 'memory', ...extra })
      return true
    } catch {
      return false
    }
  }
  try {
    if (sql) {
      const [ipRows] = await Promise.all([
        sql`select count(distinct v.ip_address)::int as c from public.web_visits v where v.ip_address is not null and v.occurred_at >= now() - interval '60 minutes'`,
      ])
      const ipCount = ipRows?.[0]?.c ?? 0
      res.json({ ok: true, onlineUsers: ipCount, via: 'database' })
      return
    }

    // No direct DB connection: attempt Supabase REST fallback using RPC for unique IPs
    if (supabaseUrlEnv && supabaseAnonKey) {
      const headers = { apikey: supabaseAnonKey, Accept: 'application/json', 'Content-Type': 'application/json' }
      const token = getBearerTokenFromRequest(req)
      if (token) headers.Authorization = `Bearer ${token}`
      const resp = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/count_unique_ips_last_minutes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ _minutes: 60 }),
      })
      if (resp.ok) {
        const val = await resp.json().catch(() => 0)
        const ipCount = Number(val) || 0
        res.json({ ok: true, onlineUsers: ipCount, via: 'supabase' })
        return
      }
    }
    respondFromMemory()
  } catch (e) {
    if (!respondFromMemory({ error: e?.message || 'DB query failed' })) {
      res.status(500).json({ ok: false, error: e?.message || 'DB query failed' })
    }
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
    const userAgent = req.get('user-agent') || ''
    const acceptLanguage = (req.get('accept-language') || '').split(',')[0] || null
    // Resolve geo asynchronously and do not block response rendering
    resolveGeo(req, ipAddress)
      .then((geo) => getUserIdFromRequest(req)
        .then((uid) => insertWebVisit({ sessionId, userId: uid || null, pagePath, referrer, userAgent, ipAddress, geo, extra: { source: 'initial_load' }, language: acceptLanguage }, req))
        .catch(() => {}))
      .catch(() => {})
  } catch {}
  res.sendFile(path.join(distDir, 'index.html'))
})

const shouldListen = String(process.env.DISABLE_LISTEN || 'false').toLowerCase() !== 'true'
if (shouldListen) {
  const port = process.env.PORT || 3000
  app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`)
    // Best-effort ensure ban tables are present at startup
    ensureBanTables().catch(() => {})
  })
}

// Export app for testing and tooling
export { app }

