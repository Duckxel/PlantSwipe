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
import OpenAI from 'openai'
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'


dotenv.config()
// Optionally load server-only secrets from .env.server (ignored if missing)
try {
  dotenv.config({ path: path.resolve(__dirname, '.env.server') })
} catch {}
// Ensure we also load a co-located .env next to server.js regardless of cwd
try {
  dotenv.config({ path: path.resolve(__dirname, '.env') })
} catch {}

// Map common env aliases so deployments can be plug‑and‑play with a single .env
function preferEnv(target, sources) {
  if (!process.env[target]) {
    for (const k of sources) {
      const v = process.env[k]
      if (v && String(v).length > 0) { process.env[target] = v; break }
    }
  }
}
// Allow DB_URL to serve as DATABASE_URL, and other common aliases
preferEnv('DATABASE_URL', ['DB_URL', 'PG_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'SUPABASE_DB_URL'])
// Normalize Supabase envs for server code if only VITE_* are present
preferEnv('SUPABASE_URL', ['VITE_SUPABASE_URL', 'REACT_APP_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'])
preferEnv('SUPABASE_ANON_KEY', ['VITE_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'])
// Normalize optional admin token from frontend env
preferEnv('ADMIN_STATIC_TOKEN', ['VITE_ADMIN_STATIC_TOKEN'])

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

function parseEmailTargets(raw, fallback) {
  const source = (typeof raw === 'string' && raw.trim().length > 0) ? raw : (fallback || '')
  if (!source) return []
  return source
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

const DEFAULT_SUPPORT_EMAIL = 'support@aphylia.app'
const DEFAULT_BUSINESS_EMAIL = 'contact@aphylia.app'

// Utility: wrap a promise with a timeout that rejects when exceeded
function withTimeout(promise, ms, label = 'TIMEOUT') {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label)), Math.max(1, ms || 0))
    Promise.resolve(promise)
      .then((v) => { try { clearTimeout(t) } catch {}; resolve(v) })
      .catch((e) => { try { clearTimeout(t) } catch {}; reject(e) })
  })
}

// Supabase client (server-side) for auth verification
// Support both runtime server env and Vite-style public envs
const supabaseUrlEnv = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServer = (supabaseUrlEnv && supabaseAnonKey)
  ? createSupabaseClient(supabaseUrlEnv, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

const openaiApiKey = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY || ''
const openaiModel = process.env.OPENAI_MODEL || 'gpt-5-nano'
let openaiClient = null
if (openaiApiKey) {
  try {
    openaiClient = new OpenAI({ apiKey: openaiApiKey })
  } catch (err) {
    console.error('[server] Failed to initialize OpenAI client:', err)
    openaiClient = null
  }
} else {
  console.warn('[server] OPENAI_KEY not configured — AI plant fill endpoint disabled')
}

const supportEmailTargets = parseEmailTargets(process.env.SUPPORT_EMAIL_TO || process.env.SUPPORT_EMAIL, DEFAULT_SUPPORT_EMAIL)
const supportEmailFrom =
  process.env.SUPPORT_EMAIL_FROM
  || process.env.RESEND_FROM
  || (supportEmailTargets[0] ? `Plant Swipe <${supportEmailTargets[0]}>` : `Plant Swipe <${DEFAULT_SUPPORT_EMAIL}>`)
const businessEmailTargets = parseEmailTargets(
  process.env.BUSINESS_EMAIL_TO || process.env.BUSINESS_EMAIL || process.env.CONTACT_EMAIL_TO,
  DEFAULT_BUSINESS_EMAIL,
)
const businessEmailFrom =
  process.env.BUSINESS_EMAIL_FROM
  || process.env.RESEND_BUSINESS_FROM
  || (businessEmailTargets[0] ? `Plant Swipe Partnerships <${businessEmailTargets[0]}>` : supportEmailFrom)
const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY || ''
const supportEmailWebhook = process.env.SUPPORT_EMAIL_WEBHOOK_URL || process.env.CONTACT_WEBHOOK_URL || ''
const contactRateLimitStore = new Map()

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

function getTokenFromQuery(req) {
  try {
    const qToken = req.query?.token || req.query?.access_token
    return qToken ? String(qToken) : null
  } catch {
    return null
  }
}

async function getUserFromRequestOrToken(req) {
  const direct = await getUserFromRequest(req)
  if (direct?.id) return direct
  const qToken = getTokenFromQuery(req)
  if (qToken && supabaseServer) {
    try {
      const { data, error } = await supabaseServer.auth.getUser(qToken)
      if (!error && data?.user?.id) {
        return { id: data.user.id, email: data.user.email || null }
      }
    } catch {}
  }
  return null
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

function getAuthTokenFromRequest(req) {
  return getBearerTokenFromRequest(req) || getTokenFromQuery(req)
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

const disallowedImageKeys = new Set(['image', 'imageurl', 'image_url', 'imageURL', 'thumbnail', 'photo', 'picture'])
const disallowedFieldKeys = new Set(['externalids'])
const metadataKeys = new Set(['type', 'description', 'options', 'items', 'additionalProperties', 'examples', 'format'])

function pickPrimaryPhotoUrlFromArray(photos, fallback) {
  if (Array.isArray(photos)) {
    const normalized = []
    for (const entry of photos) {
      if (!entry || typeof entry !== 'object') continue
      const url = typeof entry.url === 'string' ? entry.url.trim() : ''
      if (!url) continue
      normalized.push({ url, isPrimary: entry.isPrimary === true })
    }
    if (normalized.length > 0) {
      const primary = normalized.find((photo) => photo.isPrimary && photo.url)
      if (primary && primary.url) return primary.url
      return normalized[0].url
    }
  }
  return typeof fallback === 'string' && fallback ? fallback : ''
}

const JsonValueSchema = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.object({}).catchall(JsonValueSchema)
  ])
)
const PlantFillSchema = z.object({}).catchall(JsonValueSchema)

function sanitizeTemplate(node, path = []) {
  if (Array.isArray(node)) {
    return node.map((item) => sanitizeTemplate(item, path))
  }
  if (node && typeof node === 'object') {
    const result = {}
    for (const [key, value] of Object.entries(node)) {
      const lowerKey = key.toLowerCase()
      if (disallowedImageKeys.has(lowerKey)) continue
      if (disallowedFieldKeys.has(lowerKey)) continue
      if (lowerKey === 'name' && path.length === 0) continue
      result[key] = sanitizeTemplate(value, [...path, key])
    }
    return result
  }
  return node
}

function ensureStructure(template, target) {
  if (Array.isArray(template)) {
    return Array.isArray(target) ? target : []
  }
  if (template && typeof template === 'object' && !Array.isArray(template)) {
    const result =
      target && typeof target === 'object' && !Array.isArray(target)
        ? { ...target }
        : {}
    for (const [key, templateValue] of Object.entries(template)) {
      if (!(key in result)) {
        if (Array.isArray(templateValue)) {
          result[key] = []
        } else if (templateValue && typeof templateValue === 'object') {
          result[key] = ensureStructure(templateValue, {})
        } else {
          result[key] = null
        }
      } else if (templateValue && typeof templateValue === 'object') {
        result[key] = ensureStructure(templateValue, result[key])
      }
    }
    return result
  }
  return target !== undefined ? target : null
}

function stripDisallowedKeys(node, path = []) {
  if (Array.isArray(node)) {
    return node.map((item) => stripDisallowedKeys(item, path))
  }
  if (node && typeof node === 'object') {
    const result = {}
    for (const [key, value] of Object.entries(node)) {
      const lowerKey = key.toLowerCase()
      if (disallowedImageKeys.has(lowerKey)) continue
      if (disallowedFieldKeys.has(lowerKey)) continue
      if (lowerKey === 'name' && path.length === 0) continue
      result[key] = stripDisallowedKeys(value, [...path, key])
    }
    return result
  }
  return node
}

function schemaToBlueprint(node) {
  if (Array.isArray(node)) {
    if (node.length === 0) return []
    return node.map((item) => schemaToBlueprint(item))
  }
  if (!node || typeof node !== 'object') {
    return null
  }
  const obj = node
  if (typeof obj.type === 'string') {
    const typeValue = obj.type.toLowerCase()
    if (typeValue === 'array') {
      const items = obj.items
      if (!items) return []
      const blueprintItem = schemaToBlueprint(items)
      return Array.isArray(blueprintItem) ? blueprintItem : [blueprintItem]
    }
    if (typeValue === 'object') {
      const result = {}
      const source =
        typeof obj.properties === 'object' && obj.properties !== null && !Array.isArray(obj.properties)
          ? obj.properties
          : Object.fromEntries(
              Object.entries(obj).filter(([key]) => !metadataKeys.has(key))
            )
      for (const [key, value] of Object.entries(source)) {
        result[key] = schemaToBlueprint(value)
      }
      return result
    }
    return null
  }

  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    if (metadataKeys.has(key)) continue
    result[key] = schemaToBlueprint(value)
  }
  return result
}

function pruneEmpty(node) {
  if (Array.isArray(node)) {
    const pruned = node
      .map((item) => pruneEmpty(item))
      .filter((item) => item !== undefined)
    return pruned.length > 0 ? pruned : undefined
  }
  if (node && typeof node === 'object') {
    const result = {}
    for (const [key, value] of Object.entries(node)) {
      const prunedValue = pruneEmpty(value)
      if (prunedValue !== undefined) result[key] = prunedValue
    }
    return Object.keys(result).length > 0 ? result : undefined
  }
  if (node === null || node === undefined) return undefined
  if (typeof node === 'string') {
    return node.trim().length > 0 ? node : undefined
  }
  return node
}

function mergePreferExisting(aiValue, existingValue) {
  if (existingValue === undefined) return aiValue
  if (existingValue === null) return aiValue
  if (Array.isArray(existingValue)) {
    if (existingValue.length === 0) {
      return Array.isArray(aiValue) ? aiValue : []
    }
    return existingValue
  }
  if (existingValue && typeof existingValue === 'object') {
    const aiObj = aiValue && typeof aiValue === 'object' && !Array.isArray(aiValue) ? aiValue : {}
    const result = { ...aiObj }
    for (const [key, existingChild] of Object.entries(existingValue)) {
      result[key] = mergePreferExisting(aiObj[key], existingChild)
    }
    return result
  }
  if (typeof existingValue === 'string') {
    const trimmed = existingValue.trim()
    if (trimmed.length > 0) return existingValue
    if (typeof aiValue === 'string') return aiValue
    return trimmed
  }
  return existingValue
}

function removeNullValues(node) {
  if (node === null || node === undefined) {
    return undefined
  }
  if (Array.isArray(node)) {
    const cleaned = node
      .map((item) => removeNullValues(item))
      .filter((item) => item !== undefined)
    return cleaned
  }
  if (node && typeof node === 'object') {
    const result = {}
    for (const [key, value] of Object.entries(node)) {
      const cleanedValue = removeNullValues(value)
      if (cleanedValue !== undefined) {
        result[key] = cleanedValue
      }
    }
    return Object.keys(result).length > 0 ? result : undefined
  }
  return node
}

function collectFieldHints(node, path, hints = new Set()) {
  if (!node || typeof node !== 'object') {
    return hints
  }

  const type = typeof node.type === 'string' ? node.type.toLowerCase() : null
  if (Array.isArray(node.options) && node.options.length > 0) {
    hints.add(`${path}: choose only from [${node.options.join(', ')}]`)
  }
  if (type === 'number' || type === 'integer') {
    hints.add(`${path}: answer with numbers only.`)
  }
  if (type === 'boolean') {
    hints.add(`${path}: answer with "true" or "false".`)
  }
  if (type === 'array') {
    const items = node.items
    if (typeof items === 'string') {
      const itemType = items.toLowerCase()
      if (itemType === 'number' || itemType === 'integer') {
        hints.add(`${path}: provide an array of numbers.`)
      } else if (itemType === 'boolean') {
        hints.add(`${path}: provide an array of true/false values.`)
      }
    } else if (items && typeof items === 'object') {
      collectFieldHints(items, `${path}[]`, hints)
    }
  }
  if (node.additionalProperties && typeof node.additionalProperties === 'object') {
    collectFieldHints(node.additionalProperties, `${path}.*`, hints)
  }

  const skipKeys = new Set([
    'type',
    'description',
    'options',
    'items',
    'additionalProperties',
    'min',
    'max',
    'minCm',
    'maxCm',
    'rowCm',
    'plantCm',
    'minF',
    'maxF',
    'minC',
    'maxC',
    'units',
    'unit',
    'example',
    'default',
  ])

  for (const [key, value] of Object.entries(node)) {
    if (skipKeys.has(key)) continue
    if (value && typeof value === 'object') {
      collectFieldHints(value, `${path}.${key}`, hints)
    }
  }

  return hints
}

function inferExpectedKind(node) {
  if (Array.isArray(node)) return 'array'
  if (!node || typeof node !== 'object') {
    return typeof node
  }
  if (typeof node.type === 'string') {
    return node.type.toLowerCase()
  }
  return 'object'
}

function inferArrayItemKind(node) {
  if (!node || typeof node !== 'object') return 'unknown'
  const items = node.items
  if (typeof items === 'string') {
    return items.toLowerCase()
  }
  if (items && typeof items === 'object') {
    if (typeof items.type === 'string') {
      return items.type.toLowerCase()
    }
    return 'object'
  }
  return 'unknown'
}

function coerceValueForSchema(schemaNode, value, existingValue) {
  const kind = inferExpectedKind(schemaNode)
  if (value === undefined || value === null) {
    return value
  }

  if (kind === 'number' || kind === 'integer') {
    if (typeof value === 'number') {
      return kind === 'integer' ? Math.round(value) : value
    }
    if (typeof value === 'string') {
      const numericText = value.trim().match(/[-+]?\d+(\.\d+)?/g)
      if (numericText && numericText.length > 0) {
        const num = Number(numericText[0])
        if (!Number.isNaN(num)) {
          return kind === 'integer' ? Math.round(num) : num
        }
      }
    }
    return existingValue !== undefined ? existingValue : undefined
  }

  if (kind === 'boolean') {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const lowered = value.trim().toLowerCase()
      if (lowered === 'true') return true
      if (lowered === 'false') return false
    }
    return existingValue !== undefined ? existingValue : undefined
  }

  if (kind === 'array') {
    if (Array.isArray(value)) {
      return value
    }
    if (typeof value === 'string') {
      const itemKind = inferArrayItemKind(schemaNode)
      const parts = value
        .split(/[,;\n]+/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
      if (itemKind === 'number' || itemKind === 'integer') {
        const numbers = parts
          .map((part) => Number(part))
          .filter((num) => !Number.isNaN(num))
        return numbers
      }
      if (itemKind === 'boolean') {
        const bools = parts
          .map((part) => {
            const lowered = part.toLowerCase()
            if (lowered === 'true') return true
            if (lowered === 'false') return false
            return null
          })
          .filter((item) => item !== null)
        return bools
      }
      return parts
    }
    return existingValue !== undefined ? existingValue : []
  }

  if (kind === 'object') {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed
        }
      } catch {}
    }
    if (existingValue && typeof existingValue === 'object') {
      return existingValue
    }
    return {}
  }

  if (kind === 'string') {
    if (typeof value === 'string') {
      return value
    }
    if (value != null) {
      return String(value)
    }
    return existingValue !== undefined ? existingValue : ''
  }

  return value
}

async function generateFieldData(options) {
  const { plantName, fieldKey, fieldSchema, existingField } = options || {}
  if (!openaiClient) {
    throw new Error('OpenAI client not configured')
  }

  const hintList = Array.from(collectFieldHints(fieldSchema, fieldKey)).slice(0, 50)
  const commonInstructions = [
    'You fill plant data for individual fields.',
    'Respond only with valid JSON containing the requested field.',
    'Never include explanations, markdown, or extra prose.',
    'Never output null; use empty strings, empty arrays, or omit keys instead.',
    'Reuse any existing data when it is already suitable.',
  ].join('\n')

  const promptSections = [
    `Plant name: ${plantName}`,
    `Field key: ${fieldKey}`,
    `Field definition (for reference):\n${JSON.stringify(fieldSchema, null, 2)}`,
  ]

  if (fieldKey === 'description') {
    promptSections.push(
      'Write a cohesive botanical description between 100 and 400 words. Use complete sentences and paragraph-style prose, highlight appearance, growth habit, seasonal interest, and growing requirements. Do not use bullet lists, headings, or markdown. Stay factual and avoid repetition.'
    )
  }

  if (fieldKey === 'meta') {
    promptSections.push(
      'When filling meta.funFact, write one or two concise sentences (under 40 words total) that share a distinct trivia, historical note, or surprising usage. Do not repeat symbolism information covered in the meaning field. Avoid lists, markdown, or restating care guidance.'
    )
  }

  if (fieldKey === 'meaning') {
    promptSections.push(
      'Return a single string under 50 words that concentrates on the plant’s symbolism—highlight key themes such as emotions, rites, or values (e.g., love, marriage, protection). Mention cultural or historical contexts only when they reinforce the symbolism. Do not include care advice, botanical traits, bullet characters, or markdown.'
    )
  }

  if (hintList.length > 0) {
    promptSections.push(`Constraints:\n- ${hintList.join('\n- ')}`)
  }

  if (existingField !== undefined) {
    promptSections.push(`Existing data (prefer and expand when correct):\n${JSON.stringify(existingField, null, 2)}`)
  }

  promptSections.push(
    `Respond with JSON shaped exactly like:\n{"${fieldKey}": ...}\nDo not include any other keys or commentary.`
  )

  const response = await openaiClient.responses.create(
    {
      model: openaiModel,
      reasoning: { effort: 'low' },
      instructions: commonInstructions,
      input: promptSections.join('\n\n'),
    },
    { timeout: Number(process.env.OPENAI_TIMEOUT_MS || 180000) }
  )

  const outputText = typeof response?.output_text === 'string' ? response.output_text.trim() : ''
  if (!outputText) {
    throw new Error(`AI returned empty output for "${fieldKey}"`)
  }

  let parsedField
  try {
    parsedField = JSON.parse(outputText)
  } catch (parseError) {
    const jsonMatch = outputText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        parsedField = JSON.parse(jsonMatch[0])
      } catch (innerError) {
        console.error('[server] Failed to parse extracted AI field response:', innerError, outputText)
      }
    } else {
      console.error('[server] Failed to parse AI field response:', parseError, outputText)
    }
  }

  const rawValue =
    parsedField && typeof parsedField === 'object' && !Array.isArray(parsedField) && fieldKey in parsedField
      ? parsedField[fieldKey]
      : parsedField && typeof parsedField === 'object' && !Array.isArray(parsedField)
        ? parsedField
        : outputText
  const coercedValue = coerceValueForSchema(
    fieldSchema,
    typeof rawValue === 'string' ? rawValue.trim() : rawValue,
    existingField
  )

  const cleanedValue = removeNullValues(coercedValue)
  return cleanedValue !== undefined ? cleanedValue : undefined
}

function removeExternalIds(node) {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) {
    return node.map((item) => removeExternalIds(item))
  }
  const result = {}
  for (const [key, value] of Object.entries(node)) {
    if (key.toLowerCase() === 'externalids') continue
    result[key] = removeExternalIds(value)
  }
  return result
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
      if (!isLocal && !url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require')
      if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '5')
      cs = url.toString()
    } catch {}
  }
  return cs
}

const connectionString = buildConnectionString()
if (!connectionString) {
  console.warn('[server] DATABASE_URL not configured — API will error on queries')
}

// Prefer SSL for non-local databases even if URL lacks sslmode; honor custom CA
let postgresOptions = {}
try {
  if (connectionString) {
    const u = new URL(connectionString)
    const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
    if (!isLocal) {
      const allowInsecure = String(process.env.ALLOW_INSECURE_DB_TLS || 'false').toLowerCase() === 'true'
      if (allowInsecure) {
        postgresOptions = { ssl: { rejectUnauthorized: false } }
      } else {
        const candidates = [
        process.env.PGSSLROOTCERT,
        process.env.NODE_EXTRA_CA_CERTS,
        '/etc/ssl/certs/aws-rds-global.pem',
        '/etc/ssl/certs/ca-certificates.crt',
        ].filter(Boolean)
        let ssl = undefined
        for (const p of candidates) {
          try {
            if (p && fsSync.existsSync(p)) {
              const ca = fsSync.readFileSync(p, 'utf8')
              if (ca && ca.length > 0) { ssl = { rejectUnauthorized: true, ca }; break }
            }
          } catch {}
        }
        if (!ssl) ssl = true
        postgresOptions = { ssl }
      }
    }
  }
} catch {}
const sql = connectionString ? postgres(connectionString, postgresOptions) : null

// Resolve visits table name (default: public.web_visits). Supports alternate names like visit-web.
const VISITS_TABLE_ENV =
  (process.env.VISITS_TABLE ||
    process.env.VISIT_TABLE ||
    process.env.WEB_VISITS_TABLE ||
    'web_visits').trim()

function buildVisitsTableIdentifier() {
  try {
    const t = VISITS_TABLE_ENV || 'web_visits'
    // Allow letters, digits, underscore or hyphen
    if (/^[a-zA-Z0-9_]+$/.test(t)) return `public.${t}`
    if (/^[a-zA-Z0-9_-]+$/.test(t)) return `public."${t}"`
  } catch {}
  return 'public.web_visits'
}
const VISITS_TABLE_SQL_IDENT = buildVisitsTableIdentifier()

// Helper function to get visits table identifier parts for use with sql.identifier()
// Returns [schema, table] array that can be safely used with sql.identifier()
function getVisitsTableIdentifierParts() {
  try {
    const t = VISITS_TABLE_ENV || 'web_visits'
    // Validate table name: allow letters, digits, underscore or hyphen
    if (/^[a-zA-Z0-9_-]+$/.test(t)) {
      return ['public', t]
    }
  } catch {}
  return ['public', 'web_visits']
}

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
        const rows = await withTimeout(sql`select 1 as one`, 1000, 'DB_TIMEOUT')
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
      where occurred_at >= (now() - make_interval(days => ${days}))
      order by occurred_at desc
      limit 2000
    `
    res.json({ ok: true, logs: Array.isArray(rows) ? rows : [], via: 'database' })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to load admin logs' })
  }
})

// Admin: AI-assisted plant data fill
app.post('/api/admin/ai/plant-fill', async (req, res) => {
  try {
    const caller = await ensureAdmin(req, res)
    if (!caller) return
    if (!openaiClient) {
      res.status(503).json({ error: 'AI plant fill is not configured' })
      return
    }

    const body = req.body || {}
    const plantName = typeof body.plantName === 'string' ? body.plantName.trim() : ''
    if (!plantName) {
      res.status(400).json({ error: 'Plant name is required' })
      return
    }

    const schema = body.schema
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      res.status(400).json({ error: 'Valid schema object is required' })
      return
    }

    const sanitizedSchemaRaw = sanitizeTemplate(schema)
    if (!sanitizedSchemaRaw || Array.isArray(sanitizedSchemaRaw) || typeof sanitizedSchemaRaw !== 'object') {
      res.status(400).json({ error: 'Invalid schema provided' })
      return
    }
    const sanitizedSchema = sanitizedSchemaRaw
    const schemaBlueprint = schemaToBlueprint(sanitizedSchema)

    const canUseExisting = body.existingData && typeof body.existingData === 'object' && !Array.isArray(body.existingData)
    const existingDataRaw = canUseExisting ? stripDisallowedKeys(body.existingData) || {} : {}

    const aggregated = {}

    for (const fieldKey of Object.keys(schemaBlueprint)) {
      const fieldSchema = sanitizedSchema[fieldKey]
      if (!fieldSchema) {
        continue
      }

      const existingFieldRaw =
        existingDataRaw && typeof existingDataRaw === 'object'
          ? existingDataRaw[fieldKey]
          : undefined
      const existingFieldClean =
        existingFieldRaw !== undefined ? removeNullValues(existingFieldRaw) : undefined

      const fieldValue = await generateFieldData({
        plantName,
        fieldKey,
        fieldSchema,
        existingField: existingFieldClean,
      })

      const cleanedField =
        fieldValue !== undefined ? removeNullValues(fieldValue) : undefined
    if (cleanedField !== undefined) {
      aggregated[fieldKey] = removeExternalIds(cleanedField)
    } else {
      delete aggregated[fieldKey]
    }
    }

    let plantData = ensureStructure(schemaBlueprint, aggregated)
    plantData = stripDisallowedKeys(plantData)
    plantData = mergePreferExisting(plantData, existingDataRaw)
    plantData = ensureStructure(schemaBlueprint, plantData)
    plantData = stripDisallowedKeys(plantData)
    const cleanedPlantData = removeNullValues(plantData)
    if (cleanedPlantData && typeof cleanedPlantData === 'object' && !Array.isArray(cleanedPlantData)) {
      plantData = cleanedPlantData
    }

    if (!plantData || typeof plantData !== 'object' || Array.isArray(plantData)) {
      throw new Error('AI output could not be transformed into a plant record')
    }

    const plantObject = removeExternalIds(plantData)
    if (!('meta' in plantObject) || typeof plantObject.meta !== 'object' || plantObject.meta === null || Array.isArray(plantObject.meta)) {
      plantObject.meta = {}
    }
    const metaObject = plantObject.meta
    if (!metaObject.funFact || (typeof metaObject.funFact === 'string' && metaObject.funFact.trim().length === 0)) {
      metaObject.funFact = `Symbolic meaning information for ${plantName} is currently not well documented; please supplement this entry with future research.`
    }

    res.json({ success: true, data: plantObject, model: openaiModel })
  } catch (err) {
    console.error('[server] AI plant fill failed:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'Failed to fill plant data' })
    }
  }
})
app.options('/api/admin/ai/plant-fill', (_req, res) => {
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Admin-Token')
  res.status(204).end()
})
app.options('/api/admin/ai/plant-fill/field', (_req, res) => {
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Admin-Token')
  res.status(204).end()
})

app.post('/api/admin/ai/plant-fill/field', async (req, res) => {
  try {
    const caller = await ensureAdmin(req, res)
    if (!caller) return
    if (!openaiClient) {
      res.status(503).json({ error: 'AI plant fill is not configured' })
      return
    }

    const body = req.body || {}
    const plantName = typeof body.plantName === 'string' ? body.plantName.trim() : ''
    const fieldKey = typeof body.fieldKey === 'string' ? body.fieldKey.trim() : ''
    if (!plantName || !fieldKey) {
      res.status(400).json({ error: 'Plant name and field key are required' })
      return
    }

    const schema = body.schema
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      res.status(400).json({ error: 'Valid schema object is required' })
      return
    }

    const sanitizedSchemaRaw = sanitizeTemplate(schema)
    if (!sanitizedSchemaRaw || Array.isArray(sanitizedSchemaRaw) || typeof sanitizedSchemaRaw !== 'object') {
      res.status(400).json({ error: 'Invalid schema provided' })
      return
    }

    const sanitizedSchema = sanitizedSchemaRaw
    const fieldSchema = sanitizedSchema[fieldKey]
    if (!fieldSchema) {
      res.status(400).json({ error: `Schema for field "${fieldKey}" not found` })
      return
    }

    const existingFieldRaw = body.existingField
    let existingField = existingFieldRaw
    if (existingFieldRaw && typeof existingFieldRaw === 'object') {
      existingField = stripDisallowedKeys({ [fieldKey]: existingFieldRaw })?.[fieldKey]
    }
    const existingFieldClean =
      existingField !== undefined ? removeNullValues(existingField) : undefined

    const fieldValue = await generateFieldData({
      plantName,
      fieldKey,
      fieldSchema,
      existingField: existingFieldClean,
    })

    const cleanedValue = fieldValue !== undefined ? removeNullValues(fieldValue) : undefined
    const sanitizedValue = cleanedValue !== undefined ? removeExternalIds(cleanedValue) : undefined

    res.json({
      success: true,
      field: fieldKey,
      data: sanitizedValue ?? null,
    })
  } catch (err) {
    console.error('[server] AI plant field fill failed:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'Failed to fill field' })
    }
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
        // Cast to expected types to avoid parameter type ambiguity
        await sql`
          insert into public.admin_activity_logs (admin_id, admin_name, action, target, detail)
          values (${adminId || null}::uuid, ${adminName || null}::text, ${action}::text, ${target || null}::text, ${sql.json(detail)})
        `
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
    const disablePwaEnv = String(process.env.VITE_DISABLE_PWA || process.env.DISABLE_PWA || process.env.PWA_DISABLED || '').trim()
    const env = {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
      VITE_ADMIN_STATIC_TOKEN: process.env.VITE_ADMIN_STATIC_TOKEN || process.env.ADMIN_STATIC_TOKEN || '',
      VITE_ADMIN_PUBLIC_MODE: String(process.env.VITE_ADMIN_PUBLIC_MODE || process.env.ADMIN_PUBLIC_MODE || '').toLowerCase() === 'true',
      VITE_DISABLE_PWA: disablePwaEnv,
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

const htmlEscapeMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[&<>"']/g, (ch) => htmlEscapeMap[ch] || ch)
}

function isContactRateLimited(key) {
  const now = Date.now()
  const windowMs = Number(process.env.CONTACT_FORM_WINDOW_MS || 5 * 60 * 1000)
  const limit = Number(process.env.CONTACT_FORM_MAX_ATTEMPTS || 5)
  const history = contactRateLimitStore.get(key) || []
  const recent = history.filter((ts) => now - ts < windowMs)
  if (recent.length >= limit) {
    contactRateLimitStore.set(key, recent)
    return true
  }
  recent.push(now)
  contactRateLimitStore.set(key, recent)
  return false
}

const CONTACT_AUDIENCES = new Set(['support', 'business'])

function normalizeContactAudience(value) {
  if (typeof value !== 'string') return 'support'
  const normalized = value.trim().toLowerCase()
  return CONTACT_AUDIENCES.has(normalized) ? normalized : 'support'
}

async function dispatchSupportEmail({ name, email, subject, message, audience = 'support' }) {
  const normalizedAudience = normalizeContactAudience(audience)
  const targets = normalizedAudience === 'business'
    ? (businessEmailTargets.length ? businessEmailTargets : [DEFAULT_BUSINESS_EMAIL])
    : (supportEmailTargets.length ? supportEmailTargets : [DEFAULT_SUPPORT_EMAIL])
  const fromAddress = normalizedAudience === 'business' ? businessEmailFrom : supportEmailFrom
  const safeName = name ? name.slice(0, 200) : ''
  const safeSubject = subject && subject.trim() ? subject.trim().slice(0, 180) : null
  const sanitizedMessage = (message || '').replace(/\r\n/g, '\n').slice(0, 5000)
  const plainText = [
    `New ${normalizedAudience} contact form submission`,
    '',
    `Name: ${safeName || 'N/A'}`,
    `Email: ${email || 'N/A'}`,
    `Audience: ${normalizedAudience}`,
    `Delivered to: ${targets.join(', ')}`,
    '',
    sanitizedMessage || 'No additional message provided.',
  ].join('\n')
  const htmlBody = [
    `<h2 style="font-family:system-ui,sans-serif;margin:0 0 12px;">New ${normalizedAudience} contact form submission</h2>`,
    `<p style="font-family:system-ui,sans-serif;margin:0 0 8px;"><strong>Name:</strong> ${escapeHtml(safeName) || 'N/A'}</p>`,
    `<p style="font-family:system-ui,sans-serif;margin:0 0 16px;"><strong>Email:</strong> ${escapeHtml(email || '') || 'N/A'}</p>`,
    `<p style="font-family:system-ui,sans-serif;margin:0 0 8px;"><strong>Audience:</strong> ${escapeHtml(normalizedAudience)}</p>`,
    `<p style="font-family:system-ui,sans-serif;margin:0 0 16px;"><strong>Delivered to:</strong> ${escapeHtml(targets.join(', '))}</p>`,
    `<p style="font-family:system-ui,sans-serif;margin:0;">${escapeHtml(sanitizedMessage || 'No additional message provided.').replace(/\n/g, '<br />')}</p>`,
  ].join('')
  const finalSubject = safeSubject || `Contact form message from ${safeName || email || 'Plant Swipe user'}`

  if (resendApiKey) {
    const payload = {
      from: fromAddress,
      to: targets,
      subject: finalSubject,
      text: plainText,
      html: htmlBody,
    }
    if (email) payload.reply_to = email
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(text || `Resend API error (${resp.status})`)
    }
    return
  }

  if (supportEmailWebhook) {
    const resp = await fetch(supportEmailWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: targets,
        subject: finalSubject,
        text: plainText,
        html: htmlBody,
        replyTo: email || null,
        audience: normalizedAudience,
      }),
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(text || `Webhook delivery failed (${resp.status})`)
    }
    return
  }

  throw new Error('Email delivery not configured')
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
    const rows = await sql.unsafe(`select count(*)::int as c from ${VISITS_TABLE_SQL_IDENT} where session_id = $1`, [sessionId])
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
    const tablePath = (process.env.VISITS_TABLE_REST || VISITS_TABLE_ENV || 'web_visits')
    const fullResp = await fetch(`${supabaseUrlEnv}/rest/v1/${tablePath}`, {
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
    const minResp = await fetch(`${supabaseUrlEnv}/rest/v1/${tablePath}`, {
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
    const trafficAugmentedExtra = (() => { try { const { traffic_source, traffic_details } = deriveTrafficSource(referrer); return { ...(extra || {}), traffic_source, traffic_details } } catch { return (extra || {}) } })()
    const geoCountry = (geo?.geo_country && /^[a-z]{2}$/i.test(String(geo.geo_country))) ? String(geo.geo_country).toUpperCase() : (geo?.geo_country || null)
    await sql.unsafe(
      `insert into ${VISITS_TABLE_SQL_IDENT}
         (session_id, user_id, page_path, referrer, user_agent, ip_address, geo_country, geo_region, geo_city, extra, visit_num, page_title, language)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13)`,
      [sessionId, userId || null, pagePath, referrer || null, userAgent || null, ipAddress || null, geoCountry, geo?.geo_region || null, geo?.geo_city || null, JSON.stringify(trafficAugmentedExtra), computedVisitNum, pageTitle || null, lang]
    )
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

function scheduleRestartAllServices(trigger = 'manual') {
  const serviceNode = process.env.NODE_SYSTEMD_SERVICE || process.env.SELF_SYSTEMD_SERVICE || 'plant-swipe-node'
  const serviceAdmin = process.env.ADMIN_SYSTEMD_SERVICE || 'admin-api'
  const serviceNginx = process.env.NGINX_SYSTEMD_SERVICE || 'nginx'
  const label = trigger || 'manual'
  setTimeout(() => {
    console.log(`[restart] Scheduling service restart (trigger=${label})`)
    ;(async () => {
      try { await exec('sudo -n nginx -t', { timeout: 15000 }) } catch {}
      try { await exec(`sudo -n systemctl reload ${serviceNginx}`, { timeout: 20000 }) } catch {}
      try {
        const admin = spawnChild('sudo', ['-n', 'systemctl', 'restart', serviceAdmin], { detached: true, stdio: 'ignore' })
        try { admin.unref() } catch {}
      } catch {}
      try {
        const node = spawnChild('sudo', ['-n', 'systemctl', 'restart', serviceNode], { detached: true, stdio: 'ignore' })
        try { node.unref() } catch {}
      } catch {}
    })()
      .catch(() => {})
      .finally(() => {
        try { process.exit(0) } catch {}
      })
  }, 150)
}

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

      scheduleRestartAllServices('api_endpoint')
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

// Ensure broadcast table exists (idempotent)
async function ensureBroadcastTable() {
  if (!sql) return
  try {
    await sql`
      create table if not exists public.broadcast_messages (
        id uuid primary key default gen_random_uuid(),
        message text not null,
        severity text not null default 'info',
        created_at timestamptz not null default now(),
        expires_at timestamptz null,
        removed_at timestamptz null,
        created_by uuid null
      );
    `
    // Backfill/ensure severity column and constraint for older deployments
    try { await sql`alter table if exists public.broadcast_messages add column if not exists severity text;` } catch {}
    try { await sql`update public.broadcast_messages set severity = 'info' where severity is null;` } catch {}
    try {
      await sql`
        do $$ begin
          if not exists (
            select 1 from pg_constraint where conname = 'broadcast_messages_severity_chk'
          ) then
            alter table public.broadcast_messages
            add constraint broadcast_messages_severity_chk check (severity in ('info','warning','danger'));
          end if;
        end $$;
      `
    } catch {}
    await sql`create index if not exists broadcast_messages_created_at_idx on public.broadcast_messages (created_at desc);`
    await sql`create index if not exists broadcast_messages_active_idx on public.broadcast_messages (expires_at) where removed_at is null;`
  } catch {}
}

async function ensureRequestedPlantsSchema() {
  if (!sql) return
  const ddl = `
create table if not exists public.requested_plants (
  id uuid primary key default gen_random_uuid(),
  plant_name text not null,
  plant_name_normalized text not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  request_count integer not null default 1 check (request_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null
);

alter table if exists public.requested_plants add column if not exists plant_name text;
alter table if exists public.requested_plants add column if not exists plant_name_normalized text;
alter table if exists public.requested_plants add column if not exists requested_by uuid references auth.users(id) on delete cascade;
alter table if exists public.requested_plants add column if not exists request_count integer not null default 1;
alter table if exists public.requested_plants add column if not exists created_at timestamptz not null default now();
alter table if exists public.requested_plants add column if not exists updated_at timestamptz not null default now();
alter table if exists public.requested_plants add column if not exists completed_at timestamptz;
alter table if exists public.requested_plants add column if not exists completed_by uuid;

do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'requested_plants_request_count_check') then
    alter table public.requested_plants add constraint requested_plants_request_count_check check (request_count > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'requested_plants_requested_by_fkey') then
    alter table public.requested_plants add constraint requested_plants_requested_by_fkey
      foreign key (requested_by) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'requested_plants_completed_by_fkey') then
    alter table public.requested_plants add constraint requested_plants_completed_by_fkey
      foreign key (completed_by) references auth.users(id) on delete set null;
  end if;
end
$do$;

create index if not exists requested_plants_plant_name_normalized_idx on public.requested_plants(plant_name_normalized);
create unique index if not exists requested_plants_active_name_unique_idx on public.requested_plants(plant_name_normalized) where completed_at is null;
create index if not exists requested_plants_completed_at_idx on public.requested_plants(completed_at);
create index if not exists requested_plants_requested_by_idx on public.requested_plants(requested_by);
create index if not exists requested_plants_created_at_idx on public.requested_plants(created_at desc);
`
  try {
    await sql.unsafe(ddl, [], { simple: true })
    await sql`update public.requested_plants set plant_name_normalized = lower(trim(plant_name)) where plant_name_normalized is null and plant_name is not null`
    await sql`alter table public.requested_plants alter column plant_name_normalized set not null`
  } catch (err) {
    console.error('[sync] failed to ensure requested_plants schema', err)
  }
}

async function ensurePlantTranslationsSchema() {
  if (!sql) return
  const ddl = `
create table if not exists public.plant_translations (
  id uuid primary key default gen_random_uuid(),
  plant_id text not null references public.plants(id) on delete cascade,
  language text not null check (language in ('en', 'fr')),
  name text not null,
  identifiers jsonb,
  ecology jsonb,
  usage jsonb,
  meta jsonb,
  phenology jsonb,
  care jsonb,
  planting jsonb,
  problems jsonb,
  scientific_name text,
  meaning text,
  description text,
  care_soil text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plant_id, language)
);

create index if not exists plant_translations_plant_id_idx on public.plant_translations(plant_id);
create index if not exists plant_translations_language_idx on public.plant_translations(language);

alter table if exists public.plant_translations add column if not exists identifiers jsonb;
alter table if exists public.plant_translations add column if not exists ecology jsonb;
alter table if exists public.plant_translations add column if not exists usage jsonb;
alter table if exists public.plant_translations add column if not exists meta jsonb;
alter table if exists public.plant_translations add column if not exists phenology jsonb;
alter table if exists public.plant_translations add column if not exists care jsonb;
alter table if exists public.plant_translations add column if not exists planting jsonb;
alter table if exists public.plant_translations add column if not exists problems jsonb;

alter table public.plant_translations enable row level security;

do $do$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'plant_translations'
      and policyname = 'plant_translations_select_all'
  ) then
    drop policy plant_translations_select_all on public.plant_translations;
  end if;
  create policy plant_translations_select_all on public.plant_translations for select to authenticated, anon using (true);
end $do$;

do $do$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'plant_translations'
      and policyname = 'plant_translations_insert'
  ) then
    drop policy plant_translations_insert on public.plant_translations;
  end if;
  create policy plant_translations_insert on public.plant_translations for insert to authenticated with check (true);
end $do$;

do $do$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'plant_translations'
      and policyname = 'plant_translations_update'
  ) then
    drop policy plant_translations_update on public.plant_translations;
  end if;
  create policy plant_translations_update on public.plant_translations for update to authenticated using (true) with check (true);
end $do$;

do $do$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'plant_translations'
      and policyname = 'plant_translations_delete'
  ) then
    drop policy plant_translations_delete on public.plant_translations;
  end if;
  create policy plant_translations_delete on public.plant_translations for delete to authenticated using (true);
end $do$;
`
  try {
    await sql.unsafe(ddl, [], { simple: true })
  } catch (err) {
    console.error('[sync] failed to ensure plant_translations schema', err)
  }
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
    'requested_plants',
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

    // Ensure critical tables that power new features exist even if the SQL script was partially applied.
    await ensureRequestedPlantsSchema()
    await ensurePlantTranslationsSchema()

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

async function runSupabaseEdgeDeploy() {
  const repoRoot = await getRepoRoot()
  const scriptPath = path.join(repoRoot, 'scripts', 'deploy-supabase-functions.sh')
  try {
    await fs.access(scriptPath)
  } catch {
    throw new Error(`deploy script not found at ${scriptPath}`)
  }
  try { await fs.chmod(scriptPath, 0o755) } catch {}

  const env = {
    ...process.env,
    CI: process.env.CI || 'true',
    PLANTSWIPE_REPO_DIR: repoRoot,
  }

  return await new Promise((resolve, reject) => {
    const child = spawnChild(scriptPath, {
      cwd: repoRoot,
      env,
      shell: false,
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (buf) => { stdout += buf.toString() })
    child.stderr?.on('data', (buf) => { stderr += buf.toString() })
    child.on('error', (err) => reject(err))
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

function tailLines(text, limit) {
  if (!text) return ''
  const lines = String(text).split(/\r?\n/)
  return lines.slice(-limit).join('\n')
}

async function handleDeployEdgeFunctions(req, res) {
  const caller = await ensureAdmin(req, res)
  if (!caller) return
  try {
    const result = await runSupabaseEdgeDeploy()
    const stdoutTail = tailLines(result.stdout, 200)
    const stderrTail = tailLines(result.stderr, 100)

    if (result.code !== 0) {
      console.error('[server] Supabase deployment failed', { code: result.code })
      res.status(500).json({
        ok: false,
        error: 'Supabase deployment failed',
        returncode: result.code,
        stdout: stdoutTail,
        stderr: stderrTail,
      })
      return
    }

    res.json({
      ok: true,
      message: 'Supabase Edge Functions deployed successfully',
      returncode: result.code,
      stdout: stdoutTail,
      stderr: stderrTail,
    })
  } catch (err) {
    console.error('[server] deploy-edge-functions failed', err)
    res.status(500).json({
      ok: false,
      error: 'Failed to trigger Supabase deployment',
      detail: err?.message || String(err),
    })
  }
}

app.post('/api/admin/deploy-edge-functions', handleDeployEdgeFunctions)
app.get('/api/admin/deploy-edge-functions', handleDeployEdgeFunctions)

app.options('/api/admin/deploy-edge-functions', (_req, res) => {
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Admin-Token')
  res.status(204).end()
})

app.post('/api/admin/plant-translations/ensure-schema', async (req, res) => {
  const caller = await ensureAdmin(req, res)
  if (!caller) return
  try {
    await ensurePlantTranslationsSchema()
    res.json({ ok: true })
  } catch (err) {
    console.error('[server] ensure plant_translations schema failed', err)
    res.status(500).json({ error: err?.message || 'Failed to ensure plant translation schema' })
  }
})
app.options('/api/admin/plant-translations/ensure-schema', (_req, res) => {
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
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
      let plantsCount = null

    if (sql) {
      try {
        const profilesRows = await sql`select count(*)::int as count from public.profiles`
        profilesCount = Array.isArray(profilesRows) && profilesRows[0] ? Number(profilesRows[0].count) : 0
      } catch {}
      try {
        const authRows = await sql`select count(*)::int as count from auth.users`
        authUsersCount = Array.isArray(authRows) && authRows[0] ? Number(authRows[0].count) : null
        } catch {}
        try {
          const plantsRows = await sql`select count(*)::int as count from public.plants`
          plantsCount = Array.isArray(plantsRows) && plantsRows[0] ? Number(plantsRows[0].count) : 0
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
        try {
          const pr = await fetch(`${supabaseUrlEnv}/rest/v1/plants?select=id`, {
            headers: { ...baseHeaders, 'Prefer': 'count=exact', 'Range': '0-0' },
          })
          if (pr.ok) {
            const contentRange = pr.headers.get('content-range') || ''
            const match = contentRange.match(/\/(\d+)$/)
            if (match) plantsCount = Number(match[1])
          }
        } catch {}
    }

      res.json({ ok: true, profilesCount, authUsersCount, plantsCount })
  } catch (e) {
      res.status(200).json({ ok: true, profilesCount: 0, authUsersCount: null, plantsCount: null, error: e?.message || 'Failed to load stats', errorCode: 'ADMIN_STATS_ERROR' })
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
        const tablePath = (process.env.VISITS_TABLE_REST || VISITS_TABLE_ENV || 'web_visits')
        const lr = await fetch(`${supabaseUrlEnv}/rest/v1/${tablePath}?user_id=eq.${encodeURIComponent(targetId)}&select=occurred_at,ip_address,geo_country,referrer&order=occurred_at.desc&limit=1`, {
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
      // Fallback: if lastIp is null but we have IPs, use the first one from distinct IPs list
      if (!lastIp && Array.isArray(ips) && ips.length > 0) {
        lastIp = ips[0]
      }

      // Counts (best-effort via headers; requires Authorization)
      let visitsCount = undefined
      try {
        const vc = await fetch(`${supabaseUrlEnv}/rest/v1/${tablePath}?user_id=eq.${encodeURIComponent(targetId)}&select=id`, {
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
        // Request up to 5000 visits (Supabase REST default limit is 1000, but we can request more)
        const r = await fetch(`${supabaseUrlEnv}/rest/v1/${tablePath}?user_id=eq.${encodeURIComponent(targetId)}&occurred_at=gte.${encodeURIComponent(cutoff30d)}&select=referrer,geo_country,user_agent,occurred_at&order=occurred_at.desc&limit=5000`, {
          headers: { ...baseHeaders, 'Range': '0-4999' },
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
      const ipRows = await sql.unsafe(`select distinct ip_address::text as ip from ${VISITS_TABLE_SQL_IDENT} where user_id = $1 and ip_address is not null order by ip asc`, [user.id])
      ips = (ipRows || []).map(r => String(r.ip).replace(/\/[0-9]{1,3}$/, '')).filter(Boolean)
    } catch {}
    let lastCountry = null
    let lastReferrer = null
    try {
      const visitsTableId = sql.identifier(getVisitsTableIdentifierParts())
      const lastRows = await sql`
        select occurred_at, ip_address::text as ip, geo_country, referrer
        from ${visitsTableId}
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
    // Fallback: if lastIp is null but we have IPs, use the first one from distinct IPs list
    if (!lastIp && Array.isArray(ips) && ips.length > 0) {
      lastIp = ips[0]
    }
    try {
      const [vcRows, uipRows] = await Promise.all([
        sql.unsafe(`select count(*)::int as c from ${VISITS_TABLE_SQL_IDENT} where user_id = $1`, [user.id]),
        sql.unsafe(`select count(distinct ip_address)::int as c from ${VISITS_TABLE_SQL_IDENT} where user_id = $1 and ip_address is not null`, [user.id]),
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
        sql.unsafe(`
          select source, visits from (
            select case
                     when v.referrer is null or v.referrer = '' then 'direct'
                     when v.referrer ilike 'http%' then split_part(split_part(v.referrer, '://', 2), '/', 1)
                     else v.referrer
                   end as source,
                   count(*)::int as visits
            from ${VISITS_TABLE_SQL_IDENT} v
            where v.user_id = $1
              and v.occurred_at >= now() - interval '30 days'
            group by 1
          ) s
          order by visits desc
          limit 10
        `, [user.id]),
        sql.unsafe(`
          select upper(v.geo_country) as country, count(*)::int as visits
          from ${VISITS_TABLE_SQL_IDENT} v
          where v.user_id = $1
            and v.geo_country is not null and v.geo_country <> ''
            and v.occurred_at >= now() - interval '30 days'
          group by 1
          order by visits desc
          limit 10
        `, [user.id]),
        sql.unsafe(`
          select v.user_agent, count(*)::int as visits
          from ${VISITS_TABLE_SQL_IDENT} v
          where v.user_id = $1
            and v.occurred_at >= now() - interval '30 days'
          group by v.user_agent
          order by visits desc
          limit 200
        `, [user.id]),
        sql.unsafe(`select count(*)::int as c from ${VISITS_TABLE_SQL_IDENT} where user_id = $1 and occurred_at >= now() - interval '5 minutes'`, [user.id]),
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
            from ${sql ? sql`` : ''} public.web_visits
            where ip_address = ${ip}::inet
          `,
          sql`
            select v.user_id as id,
                   u.email,
                   p.display_name,
                   max(v.occurred_at) as last_seen_at
            from ${sql ? sql`` : ''} public.web_visits v
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
              from ${sql ? sql`` : ''} public.web_visits v
              where v.ip_address = ${ip}::inet
                and v.occurred_at >= now() - interval '30 days'
              group by 1
            ) s
            order by visits desc
            limit 10
          `,
          sql`
            select v.user_agent, count(*)::int as visits
            from ${sql ? sql`` : ''} public.web_visits v
            where v.ip_address = ${ip}::inet
              and v.occurred_at >= now() - interval '30 days'
            group by v.user_agent
            order by visits desc
            limit 200
          `,
          sql.unsafe(`select geo_country from ${VISITS_TABLE_SQL_IDENT} where ip_address = $1::inet and geo_country is not null and geo_country <> '' order by occurred_at desc limit 1`, [ip]),
          sql.unsafe(`select count(*)::int as c from ${VISITS_TABLE_SQL_IDENT} where ip_address = $1::inet and occurred_at >= now() - interval '5 minutes'`, [ip]),
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
    const tablePath = (process.env.VISITS_TABLE_REST || VISITS_TABLE_ENV || 'web_visits')
    const visitsResp = await fetch(`${supabaseUrlEnv}/rest/v1/${tablePath}?ip_address=eq.${encodeURIComponent(ip)}&select=user_id,occurred_at,referrer,user_agent,geo_country&order=occurred_at.desc`, { headers })
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

    // SQL (preferred) - use same pattern as global visits graph
    if (sql) {
      try {
        const rows = await sql.unsafe(`
          with days as (
            select generate_series(((now() at time zone 'utc')::date - interval '29 days'), (now() at time zone 'utc')::date, interval '1 day')::date as d
          )
          select to_char(d, 'YYYY-MM-DD') as date,
                 coalesce((
                   select count(*)::int
                   from ${VISITS_TABLE_SQL_IDENT} v
                   where v.user_id = $1
                     and (timezone('utc', v.occurred_at))::date = d
                 ), 0)::int as visits
          from days
          order by d asc
        `, [targetUserId])
        const series30d = (rows || []).map(r => ({ date: String(r.date), visits: Number(r.visits || 0) }))
        const total30d = series30d.reduce((a, b) => a + (b.visits || 0), 0)
        res.json({ ok: true, userId: targetUserId, series30d, total30d, via: 'database' })
        return
      } catch (e) {
        console.error('SQL query failed for member visits series:', e)
        // fall through to REST
      }
    }

    // Supabase REST fallback - try RPC first, then direct query
    if (supabaseUrlEnv && supabaseAnonKey) {
      const headers = { 'apikey': supabaseAnonKey, 'Accept': 'application/json', 'Content-Type': 'application/json' }
      const token = getBearerTokenFromRequest(req)
      if (token) Object.assign(headers, { 'Authorization': `Bearer ${token}` })
      
      // Try RPC function first (if available)
      try {
        const resp = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/get_user_visits_series_days`, {
          method: 'POST', headers, body: JSON.stringify({ _user_id: targetUserId, _days: 30 })
        })
        if (resp.ok) {
          const arr = await resp.json().catch(() => [])
          const series30d = (Array.isArray(arr) ? arr : []).map((r) => ({ date: String(r.date), visits: Number(r.visits || 0) }))
          const total30d = series30d.reduce((a, b) => a + (b.visits || 0), 0)
          res.json({ ok: true, userId: targetUserId, series30d, total30d, via: 'supabase-rpc' })
          return
        }
      } catch (e) {
        // RPC might not exist, try direct query
      }
      
      // Fallback: Query visits table directly via REST
      try {
        const tablePath = (process.env.VISITS_TABLE_REST || VISITS_TABLE_ENV || 'web_visits')
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        
        // Fetch visits with pagination support (limit 1000 per page)
        let allVisits = []
        let offset = 0
        const limit = 1000
        
        while (true) {
          const visitsResp = await fetch(
            `${supabaseUrlEnv}/rest/v1/${tablePath}?user_id=eq.${encodeURIComponent(targetUserId)}&occurred_at=gte.${thirtyDaysAgo}&select=occurred_at&order=occurred_at.asc&limit=${limit}&offset=${offset}`,
            { headers: { ...headers, 'Prefer': 'count=exact' } }
          )
          
          if (!visitsResp.ok) {
            const errorText = await visitsResp.text().catch(() => 'Unknown error')
            console.error(`REST direct query failed for user ${targetUserId}: ${visitsResp.status} ${errorText}`)
            break
          }
          
          const visits = await visitsResp.json().catch(() => [])
          if (!Array.isArray(visits) || visits.length === 0) break
          
          allVisits = allVisits.concat(visits)
          
          // Check if we got all results (if less than limit, we're done)
          if (visits.length < limit) break
          
          offset += limit
          
          // Safety limit: don't fetch more than 10k visits
          if (offset >= 10000) break
        }
        
        // Generate series for last 30 days
        const series30d = []
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)
        
        // Group visits by date
        const visitsByDate = new Map()
        if (Array.isArray(allVisits)) {
          for (const visit of allVisits) {
            if (visit.occurred_at) {
              const date = new Date(visit.occurred_at)
              date.setUTCHours(0, 0, 0, 0)
              const dateStr = date.toISOString().split('T')[0]
              visitsByDate.set(dateStr, (visitsByDate.get(dateStr) || 0) + 1)
            }
          }
        }
        
        // Generate 30 days of data
        for (let i = 29; i >= 0; i--) {
          const date = new Date(today)
          date.setUTCDate(date.getUTCDate() - i)
          const dateStr = date.toISOString().split('T')[0]
          series30d.push({
            date: dateStr,
            visits: visitsByDate.get(dateStr) || 0
          })
        }
        
        const total30d = series30d.reduce((a, b) => a + (b.visits || 0), 0)
        res.json({ ok: true, userId: targetUserId, series30d, total30d, via: 'supabase-rest' })
        return
      } catch (e) {
        console.error('REST direct query exception:', e)
      }
    }

    // If we get here, both SQL and REST failed
    // Return empty data instead of error so the graph can still render (empty)
    console.warn(`Could not load visits series for user ${targetUserId}: SQL and REST both failed`)
    res.json({ 
      ok: true, 
      userId: targetUserId, 
      series30d: [], 
      total30d: 0, 
      via: 'fallback',
      warning: 'Could not load visits data from database'
    })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to load member visits series' })
  }
})

// Admin: paginated member list (newest first, 20 per page by default)
app.get('/api/admin/member-list', async (req, res) => {
  try {
    const caller = await ensureAdmin(req, res)
    if (!caller) return
    const rawLimit = Number(req.query.limit)
    const rawOffset = Number(req.query.offset)
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 20
    const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0
    const sortRaw = (req.query.sort || 'newest').toString().trim().toLowerCase()
    const sort = sortRaw.startsWith('old') ? 'oldest'
      : sortRaw === 'rpm' || sortRaw.startsWith('rpm')
        ? 'rpm'
        : 'newest'
    const fetchSize = limit + 1
    const normalizeRows = (rows) => {
      if (!Array.isArray(rows)) return []
      return rows
        .map((r) => {
          const id = r?.id ? String(r.id) : null
          if (!id) return null
          const rpm =
            r?.rpm5m !== undefined && r?.rpm5m !== null
              ? Number(r.rpm5m)
              : null
          return {
            id,
            email: r?.email || null,
            display_name: r?.display_name || null,
            created_at: r?.created_at || null,
            is_admin: r?.is_admin === true,
            rpm5m: Number.isFinite(rpm) ? rpm : null,
          }
        })
        .filter((r) => r !== null)
    }

    if (sql) {
      const visitsTableSql = buildVisitsTableIdentifier()
      const orderClause =
        sort === 'rpm'
          ? 'rpm5m desc nulls last, u.created_at desc'
          : sort === 'oldest'
            ? 'u.created_at asc'
            : 'u.created_at desc'
      const rows = await sql.unsafe(
        `
        select
          u.id,
          u.email,
          u.created_at,
          p.display_name,
          p.is_admin,
          coalesce(rpm.c, 0)::numeric / 5 as rpm5m
        from auth.users u
        left join public.profiles p on p.id = u.id
        left join lateral (
          select count(*)::int as c
          from ${visitsTableSql} v
          where v.user_id = u.id
            and v.occurred_at >= now() - interval '5 minutes'
        ) rpm on true
        order by ${orderClause}
        limit $1
        offset $2
        `,
        [fetchSize, offset],
      )
      const normalized = normalizeRows(rows)
      const hasMore = normalized.length > limit
      const members = hasMore ? normalized.slice(0, limit) : normalized
      res.json({
        ok: true,
        members,
        hasMore,
        nextOffset: offset + members.length,
        via: 'database',
      })
      return
    }

    if (supabaseUrlEnv && supabaseAnonKey) {
      const headers = { apikey: supabaseAnonKey, Accept: 'application/json', 'Content-Type': 'application/json' }
      const token = getBearerTokenFromRequest(req)
      if (token) headers['Authorization'] = `Bearer ${token}`
      const resp = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/get_recent_members`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ _limit: fetchSize, _offset: offset, _sort: sort }),
      })
      if (!resp.ok) {
        const body = await resp.text().catch(() => '')
        res.status(resp.status).json({ error: body || 'Failed to load member list' })
        return
      }
      const arr = await resp.json().catch(() => [])
      const normalized = normalizeRows(arr)
      const hasMore = normalized.length > limit
      const members = hasMore ? normalized.slice(0, limit) : normalized
      res.json({
        ok: true,
        members,
        hasMore,
        nextOffset: offset + members.length,
        via: 'supabase',
      })
      return
    }

    res.status(500).json({ error: 'Database not configured' })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to load member list' })
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
      const ipRows = await sql.unsafe(`select distinct ip_address::text as ip from ${VISITS_TABLE_SQL_IDENT} where user_id = $1 and ip_address is not null`, [userId])
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
        .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, photos, care_sunlight, care_water, care_soil, care_difficulty, seeds_available, water_freq_unit, water_freq_value, water_freq_period, water_freq_amount')
      .order('name', { ascending: true })
    if (error) return null
      return (Array.isArray(data) ? data : []).map((r) => {
        const photos = Array.isArray(r.photos) ? r.photos : undefined
        return {
          id: r.id,
          name: r.name,
          scientificName: r.scientific_name,
          colors: r.colors ?? [],
          seasons: r.seasons ?? [],
          rarity: r.rarity,
          meaning: r.meaning ?? '',
          description: r.description ?? '',
          photos,
          image: pickPrimaryPhotoUrlFromArray(photos, r.image_url ?? ''),
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
        }
      })
  } catch {
    return null
  }
}

app.post('/api/contact', async (req, res) => {
  try {
    const body = req.body || {}
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 180) : ''
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : ''
    const audienceInput =
      typeof body.audience === 'string' ? body.audience :
      (typeof body.channel === 'string' ? body.channel : '')
    const audience = normalizeContactAudience(audienceInput)

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'A valid email address is required.' })
      return
    }
    if (!message) {
      res.status(400).json({ error: 'Message is required.' })
      return
    }

    const ip = getClientIp(req) || 'unknown'
    if (isContactRateLimited(ip)) {
      res.status(429).json({ error: 'Too many messages in a short period. Please try again later.' })
      return
    }

    await dispatchSupportEmail({ name, email, subject, message, audience })
    res.json({ ok: true, audience })
  } catch (error) {
    console.error('[contact] failed to send support email:', error)
    res.status(500).json({ error: 'Failed to send message. Please try again later.' })
  }
})

// DeepL Translation API endpoint
app.post('/api/translate', async (req, res) => {
  try {
    const { text, source_lang, target_lang } = req.body
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid text field' })
    }
    
    if (!source_lang || !target_lang) {
      return res.status(400).json({ error: 'Missing source_lang or target_lang' })
    }
    
    // Skip translation if source and target are the same
    if (source_lang.toUpperCase() === target_lang.toUpperCase()) {
      return res.json({ translatedText: text })
    }
    
    // Get DeepL API key from environment
    const deeplApiKey = process.env.DEEPL_API_KEY
    if (!deeplApiKey) {
      console.error('[translate] DeepL API key not configured')
      return res.status(500).json({ error: 'Translation service not configured' })
    }
    
    // Use DeepL API (free tier: https://api-free.deepl.com)
    const deeplUrl = process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate'
    
    const response = await fetch(deeplUrl, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${deeplApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text: text,
        source_lang: source_lang.toUpperCase(),
        target_lang: target_lang.toUpperCase(),
      }),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('[translate] DeepL API error:', response.status, errorText)
      return res.status(response.status).json({ error: 'Translation failed: ' + (errorText || response.statusText) })
    }
    
    const data = await response.json()
    const translatedText = data.translations?.[0]?.text || text
    
    res.json({ translatedText })
  } catch (error) {
    console.error('[translate] Translation error:', error)
    res.status(500).json({ error: 'Translation service error: ' + (error?.message || 'Unknown error') })
  }
})

app.get('/api/plants', async (_req, res) => {
  try {
    if (sql) {
      try {
          const rows = await sql`select * from plants order by name asc`
          const mapped = rows.map(r => {
            const photos = Array.isArray(r.photos) ? r.photos : undefined
            return {
              id: r.id,
              name: r.name,
              scientificName: r.scientific_name,
              colors: r.colors ?? [],
              seasons: r.seasons ?? [],
              rarity: r.rarity,
              meaning: r.meaning ?? '',
              description: r.description ?? '',
              photos,
              image: pickPrimaryPhotoUrlFromArray(photos, r.image_url ?? ''),
              care: {
                sunlight: r.care_sunlight,
                water: r.care_water,
                soil: r.care_soil,
                difficulty: r.care_difficulty,
              },
              seedsAvailable: r.seeds_available === true,
            }
          })
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
    execEnv.SKIP_ENV_SYNC = 'true'
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

      // Heartbeat to keep the connection alive behind proxies
      const heartbeatId = setInterval(() => { try { res.write(': ping\n\n') } catch {} }, 15000)
      let clientDisconnected = false
      let streamClosedGracefully = false
      let autoRestartScheduled = false

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
        const ok = code === 0
        if (!streamClosedGracefully) {
          if (ok) {
            send('done', { ok: true, code })
          } else {
            send('done', { ok: false, code })
          }
        }
        streamClosedGracefully = true
        try { clearInterval(heartbeatId) } catch {}
        try { res.end() } catch {}
        if (ok && clientDisconnected && !autoRestartScheduled) {
          autoRestartScheduled = true
          console.log('[pull-code] Build finished after client disconnect; scheduling service restart.')
          scheduleRestartAllServices('pull_code_stream_auto')
        }
      })

      req.on('close', () => {
        if (streamClosedGracefully) return
        clientDisconnected = true
        try { clearInterval(heartbeatId) } catch {}
        console.warn('[pull-code] SSE client disconnected early; continuing refresh in background.')
      })
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
    // Keep this fast: limit network timeout and avoid blocking when offline
    try { await exec(`${gitBase} remote update --prune`, { timeout: 5000 }) } catch {}
    // Prefer for-each-ref over branch -r to avoid pointer lines and formatting quirks
    const { stdout: branchesStdout } = await exec(`${gitBase} for-each-ref --format='%(refname:short)' refs/remotes/origin`, { timeout: 5000 })
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
      const { stdout: localStdout } = await exec(`${gitBase} for-each-ref --format='%(refname:short)' refs/heads`, { timeout: 3000 })
      branches = localStdout
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
    }

    const { stdout: currentStdout } = await exec(`${gitBase} rev-parse --abbrev-ref HEAD`, { timeout: 3000 })
    const current = currentStdout.trim()

    // Read the last update time from TIME file if it exists
    let lastUpdateTime = null
    try {
      const timeFile = path.join(repoRoot, 'TIME')
      const timeContent = await fs.readFile(timeFile, 'utf-8')
      lastUpdateTime = timeContent.trim() || null
    } catch {
      // TIME file doesn't exist or can't be read, which is fine
    }

    try {
      const caller = await getUserFromRequest(req)
      const adminId = caller?.id || null
      const adminName = null
      if (sql) await sql`insert into public.admin_activity_logs (admin_id, admin_name, action, target, detail) values (${adminId}, ${adminName}, 'list_branches', ${current || null}, ${sql.json({ count: branches.length })})`
    } catch {}
    res.json({ branches, current, lastUpdateTime })
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
    let geo = { geo_country: null, geo_region: null, geo_city: null }
    try {
      geo = await withTimeout(resolveGeo(req, ipAddress), 800, 'GEO_TIMEOUT')
    } catch {}
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
    // Do not block the response on DB write; best-effort in background
    insertWebVisit({ sessionId, userId: effectiveUserId, pagePath, referrer, userAgent, ipAddress, geo, extra, pageTitle, language: lang }, req).catch(() => {})
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
      sql.unsafe(`select count(distinct v.ip_address)::int as c from ${VISITS_TABLE_SQL_IDENT} v where v.ip_address is not null and v.occurred_at >= now() - interval '10 minutes'`),
      sql.unsafe(`select count(distinct v.ip_address)::int as c from ${VISITS_TABLE_SQL_IDENT} v where v.ip_address is not null and v.occurred_at >= now() - interval '30 minutes'`),
      sql.unsafe(`select count(distinct v.ip_address)::int as c from ${VISITS_TABLE_SQL_IDENT} v where v.ip_address is not null and v.occurred_at >= now() - interval '60 minutes'`),
      sql.unsafe(`select count(*)::int as c from ${VISITS_TABLE_SQL_IDENT} where occurred_at >= now() - interval '60 minutes'`),
      // Unique IPs across the last N calendar days in UTC
      sql.unsafe(`select count(distinct v.ip_address)::int as c
                  from ${VISITS_TABLE_SQL_IDENT} v
                  where v.ip_address is not null
                    and timezone('utc', v.occurred_at) >= ((now() at time zone 'utc')::date - interval '${days - 1} days')`)
    ])

    const currentUniqueVisitors10m = rows10m?.[0]?.c ?? 0
    const uniqueIpsLast30m = rows30m?.[0]?.c ?? 0
    const uniqueIpsLast60m = rows60mUnique?.[0]?.c ?? 0
    const visitsLast60m = rows60mRaw?.[0]?.c ?? 0
    const uniqueIps7d = rowsNdUnique?.[0]?.c ?? 0

    const rows7 = await sql.unsafe(
      `with days as (
         select generate_series(((now() at time zone 'utc')::date - interval '${days - 1} days'), (now() at time zone 'utc')::date, interval '1 day')::date as d
       )
       select to_char(d, 'YYYY-MM-DD') as date,
              coalesce((
                select count(distinct v.ip_address)
                from ${VISITS_TABLE_SQL_IDENT} v
                where (timezone('utc', v.occurred_at))::date = d
              ), 0)::int as unique_visitors
       from days
       order by d asc`)
    const series7d = (rows7 || []).map(r => ({ date: String(r.date), uniqueVisitors: Number(r.unique_visitors || 0) }))

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
      const rows = await sql.unsafe(
        `select count(distinct v.ip_address)::int as c
         from ${VISITS_TABLE_SQL_IDENT} v
         where v.ip_address is not null
           and (timezone('utc', v.occurred_at))::date >= ((now() at time zone 'utc')::date - interval '6 days')`
      )
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
      const otherCountries = {
        count: otherCountriesList.length,
        visits: otherCountriesList.reduce((s, c) => s + (c.visits || 0), 0),
        codes: otherCountriesList.map(c => c.country).filter(Boolean),
        items: otherCountriesList.map(c => ({ country: c.country, visits: Number(c.visits || 0) })),
      }
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
      const otherCountries = {
        count: otherCountriesList.length,
        visits: otherCountriesList.reduce((s, c) => s + (c.visits || 0), 0),
        codes: otherCountriesList.map(c => c.country).filter(Boolean),
        items: otherCountriesList.map(c => ({ country: c.country, visits: Number(c.visits || 0) })),
      }
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
        from ${VISITS_TABLE_SQL_IDENT} v
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
        const tablePath = (process.env.VISITS_TABLE_REST || VISITS_TABLE_ENV || 'web_visits')
        const url = `${supabaseUrlEnv}/rest/v1/${tablePath}?select=ip_address&occurred_at=gte.${new Date(Date.now() - windowMinutes * 60000).toISOString()}&ip_address=not.is.null`
        const resp = await withTimeout(fetch(url, { headers }), 1200, 'REST_TIMEOUT')
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
        sql.unsafe(`select count(distinct v.ip_address)::int as c from ${VISITS_TABLE_SQL_IDENT} v where v.ip_address is not null and v.occurred_at >= now() - interval '60 minutes'`),
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

// --- Global broadcast message system ---
// SSE client registry
const broadcastClients = new Set()

function sseWrite(res, event, data) {
  try {
    if (!res) return
    if (event) res.write(`event: ${event}\n`)
    const payload = typeof data === 'string' ? data : JSON.stringify(data)
    const lines = String(payload).split(/\r?\n/)
    for (const line of lines) res.write(`data: ${line}\n`)
    res.write('\n')
  } catch {}
}

async function getActiveBroadcastRow() {
  // Prefer direct SQL when available
  if (sql) {
    try {
      const rows = await sql`
        select 
          bm.id::text as id,
          bm.message,
          bm.severity,
          bm.created_at,
          bm.expires_at,
          bm.created_by::text as created_by,
          coalesce(p.display_name, p.email, '') as admin_name
        from public.broadcast_messages bm
        left join public.profiles p on p.id = bm.created_by
        where bm.removed_at is null and (bm.expires_at is null or bm.expires_at > now())
        order by bm.created_at desc
        limit 1
      `
      return Array.isArray(rows) && rows[0] ? rows[0] : null
    } catch {}
  }
  // Supabase REST fallback for reads
  if (supabaseUrlEnv && supabaseAnonKey) {
    try {
      const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
      const url = `${supabaseUrlEnv}/rest/v1/broadcast_messages?removed_at=is.null&select=id,message,severity,created_at,expires_at,created_by&order=created_at.desc&limit=10`
      const r = await fetch(url, { headers })
      if (r.ok) {
        const arr = await r.json().catch(() => [])
        const now = Date.now()
        const valid = (Array.isArray(arr) ? arr : []).find((row) => {
          const ex = row?.expires_at ? Date.parse(row.expires_at) : null
          return !ex || ex > now
        })
        return valid || null
      }
    } catch {}
  }
  return null
}

function broadcastToAll(payload) {
  try {
    for (const res of Array.from(broadcastClients)) {
      sseWrite(res, 'broadcast', payload)
    }
  } catch {}
}

function clearBroadcastForAll() {
  try {
    for (const res of Array.from(broadcastClients)) {
      sseWrite(res, 'clear', { ok: true })
    }
  } catch {}
}

// Public: fetch current active broadcast
app.get('/api/broadcast/active', async (_req, res) => {
  try {
    // Prevent caches from serving stale broadcast state
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
    } catch {}
    const row = await getActiveBroadcastRow()
    if (row) {
      res.json({ ok: true, broadcast: {
        id: String(row.id || ''),
        message: String(row.message || ''),
        severity: String(row.severity || 'info'),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
        createdBy: row.created_by ? String(row.created_by) : null,
        adminName: row.admin_name ? String(row.admin_name) : null,
      } })
    } else {
      res.json({ ok: true, broadcast: null })
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Failed to load broadcast' })
  }
})

// Public: Server-Sent Events stream for broadcast updates
app.get('/api/broadcast/stream', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    // Send initial state (only broadcast if active exists; do not force-clear here)
    try {
      const row = await getActiveBroadcastRow()
      if (row) {
        sseWrite(res, 'broadcast', {
          id: String(row.id || ''),
          message: String(row.message || ''),
          severity: String(row.severity || 'info'),
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
          expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
          createdBy: row.created_by ? String(row.created_by) : null,
          adminName: row.admin_name ? String(row.admin_name) : null,
        })
      }
    } catch {}

    broadcastClients.add(res)
    const hb = setInterval(() => { try { res.write(': ping\n\n') } catch {} }, 15000)
    req.on('close', () => { try { clearInterval(hb) } catch {}; broadcastClients.delete(res) })
  } catch (e) {
    try { res.status(500).json({ error: e?.message || 'stream failed' }) } catch {}
  }
})

// User membership SSE: notify when the current user's garden memberships change
app.get('/api/self/memberships/stream', async (req, res) => {
  try {
    // Allow token via query param for EventSource
    let user = null
    try {
      const qToken = (req.query?.token || req.query?.access_token)
      if (qToken && supabaseServer) {
        const { data, error } = await supabaseServer.auth.getUser(String(qToken))
        if (!error && data?.user?.id) user = { id: data.user.id, email: data.user.email || null }
      }
    } catch {}
    if (!user) user = await getUserFromRequest(req)
    if (!user?.id) { res.status(401).json({ error: 'Unauthorized' }); return }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    sseWrite(res, 'ready', { ok: true })

    const getSig = async () => {
      try {
        if (sql) {
          const rows = await sql`
            select gm.garden_id::text as garden_id
            from public.garden_members gm
            where gm.user_id = ${user.id}
            order by gm.garden_id asc
          `
          const list = (rows || []).map((r) => String(r.garden_id))
          return list.join(',')
        } else if (supabaseUrlEnv && supabaseAnonKey) {
          const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
          // Include Authorization from bearer header or token query param (EventSource)
          const bearer = getBearerTokenFromRequest(req) || (req.query?.token ? String(req.query.token) : (req.query?.access_token ? String(req.query.access_token) : null))
          if (bearer) Object.assign(headers, { Authorization: `Bearer ${bearer}` })
          const url = `${supabaseUrlEnv}/rest/v1/garden_members?user_id=eq.${encodeURIComponent(user.id)}&select=garden_id&order=garden_id.asc`
          const r = await fetch(url, { headers })
          const arr = r.ok ? (await r.json().catch(() => [])) : []
          const list = (arr || []).map((row) => String(row.garden_id))
          return list.join(',')
        }
      } catch {}
      return ''
    }

    let lastSig = await getSig()

    const poll = async () => {
      try {
        const next = await getSig()
        if (next !== lastSig) {
          lastSig = next
          sseWrite(res, 'memberships', { changed: true })
        }
      } catch {}
    }

    const iv = setInterval(poll, 1000)
    const hb = setInterval(() => { try { res.write(': ping\n\n') } catch {} }, 15000)
    req.on('close', () => { try { clearInterval(iv); clearInterval(hb) } catch {} })
  } catch (e) {
    try { res.status(500).json({ error: e?.message || 'stream failed' }) } catch {}
  }
})

// Private info lookup (self or admin)
app.get('/api/users/:id/private', async (req, res) => {
  try {
    const targetId = String(req.params.id || '').trim()
    if (!targetId) { res.status(400).json({ ok: false, error: 'user id required' }); return }
    const viewer = await getUserFromRequest(req)
    if (!viewer?.id) { res.status(401).json({ ok: false, error: 'Unauthorized' }); return }
    let allowed = viewer.id === targetId
    if (!allowed) {
      try {
        allowed = await isAdminFromRequest(req)
      } catch {}
    }
    if (!allowed) { res.status(403).json({ ok: false, error: 'Forbidden' }); return }

    if (sql) {
      const rows = await sql`
        select u.id::text as id, u.email
        from auth.users u
        where u.id = ${targetId}
        limit 1
      `
      const row = Array.isArray(rows) && rows[0] ? rows[0] : null
      res.json({
        ok: true,
        user: row ? { id: String(row.id || targetId), email: row.email || null } : null,
      })
      return
    }

    if (supabaseUrlEnv && supabaseAnonKey) {
      try {
        const headers = { apikey: supabaseAnonKey, Accept: 'application/json', 'Content-Type': 'application/json' }
        const bearer = getBearerTokenFromRequest(req)
        if (bearer) headers['Authorization'] = `Bearer ${bearer}`
        const resp = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/get_user_private_info`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ _user_id: targetId }),
        })
        if (resp.ok) {
          const body = await resp.json().catch(() => null)
          const row = Array.isArray(body) ? body[0] : body
          res.json({
            ok: true,
            user: row ? { id: String(row.id || targetId), email: row.email || null } : null,
          })
          return
        }
      } catch {}
    }

    res.status(503).json({ ok: false, error: 'Private info lookup unavailable' })
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Failed to load private info' })
  }
})

// User-wide Garden Activity SSE: pushes activity from all gardens the user belongs to
app.get('/api/self/gardens/activity/stream', async (req, res) => {
  try {
    // Resolve user from token param or cookie session
    let user = null
    try {
      const qToken = (req.query?.token || req.query?.access_token)
      if (qToken && supabaseServer) {
        const { data, error } = await supabaseServer.auth.getUser(String(qToken))
        if (!error && data?.user?.id) user = { id: data.user.id, email: data.user.email || null }
      }
    } catch {}
    if (!user) user = await getUserFromRequest(req)
    if (!user?.id) { res.status(401).json({ error: 'Unauthorized' }); return }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    sseWrite(res, 'ready', { ok: true })

    const getGardenIdsCsv = async () => {
      try {
        if (sql) {
          const rows = await sql`
            select garden_id::text as garden_id from public.garden_members where user_id = ${user.id}
          `
          const list = (rows || []).map((r) => String(r.garden_id))
          return list
        } else if (supabaseUrlEnv && supabaseAnonKey) {
          const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
          const bearer = getBearerTokenFromRequest(req)
          if (bearer) Object.assign(headers, { Authorization: `Bearer ${bearer}` })
          const url = `${supabaseUrlEnv}/rest/v1/garden_members?user_id=eq.${encodeURIComponent(user.id)}&select=garden_id`
          const r = await fetch(url, { headers })
          const arr = r.ok ? (await r.json().catch(() => [])) : []
          const list = (arr || []).map((row) => String(row.garden_id))
          return list
        }
      } catch {}
      return []
    }

    let gardenIds = await getGardenIdsCsv()
    let lastSig = gardenIds.slice().sort().join(',')
    let lastSeen = new Date(Date.now() - 2 * 60 * 1000).toISOString()

    const poll = async () => {
      try {
        // Refresh membership set
        const nextIds = await getGardenIdsCsv()
        const nextSig = nextIds.slice().sort().join(',')
        if (nextSig !== lastSig) {
          gardenIds = nextIds
          lastSig = nextSig
          sseWrite(res, 'membership', { changed: true })
        }
        if (!gardenIds || gardenIds.length === 0) return
        if (sql) {
          const rows = await sql`
            select id::text as id, garden_id::text as garden_id, actor_id::text as actor_id, actor_name, actor_color, kind, message, plant_name, task_name, occurred_at
            from public.garden_activity_logs
            where garden_id = any(${sql.array(gardenIds)}) and occurred_at > ${lastSeen}
            order by occurred_at asc
            limit 500
          `
          for (const r of rows || []) {
            lastSeen = new Date(r.occurred_at).toISOString()
            sseWrite(res, 'activity', {
              id: String(r.id), gardenId: String(r.garden_id), actorId: r.actor_id || null, actorName: r.actor_name || null, actorColor: r.actor_color || null,
              kind: r.kind, message: r.message, plantName: r.plant_name || null, taskName: r.task_name || null, occurredAt: new Date(r.occurred_at).toISOString(),
            })
          }
        } else if (supabaseUrlEnv && supabaseAnonKey) {
          const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
          // Include Authorization from bearer header or token query param (EventSource)
          const bearer = getBearerTokenFromRequest(req) || (req.query?.token ? String(req.query.token) : (req.query?.access_token ? String(req.query.access_token) : null))
          if (bearer) Object.assign(headers, { Authorization: `Bearer ${bearer}` })
          // Build OR filter for multiple garden_ids: or=(garden_id.eq.id1,garden_id.eq.id2,...)
          const orExpr = gardenIds.length > 0 ? `or=(${gardenIds.map(id => `garden_id.eq.${id}`).join(',')})` : ''
          const qp = [orExpr, `occurred_at=gt.${lastSeen}`, 'select=id,garden_id,actor_id,actor_name,actor_color,kind,message,plant_name,task_name,occurred_at', 'order=occurred_at.asc', 'limit=500']
            .filter(Boolean)
            .map(s => encodeURI(s))
            .join('&')
          const url = `${supabaseUrlEnv}/rest/v1/garden_activity_logs?${qp}`
          const r = await fetch(url, { headers })
          if (r.ok) {
            const arr = await r.json().catch(() => [])
            for (const row of arr || []) {
              lastSeen = new Date(row.occurred_at).toISOString()
              sseWrite(res, 'activity', {
                id: String(row.id), gardenId: String(row.garden_id), actorId: row.actor_id || null, actorName: row.actor_name || null, actorColor: row.actor_color || null,
                kind: row.kind, message: row.message, plantName: row.plant_name || null, taskName: row.task_name || null, occurredAt: new Date(row.occurred_at).toISOString(),
              })
            }
          }
        }
      } catch {}
    }

    const iv = setInterval(poll, 1000)
    const hb = setInterval(() => { try { res.write(': ping\n\n') } catch {} }, 15000)
    req.on('close', () => { try { clearInterval(iv); clearInterval(hb) } catch {} })
  } catch (e) {
    try { res.status(500).json({ error: e?.message || 'stream failed' }) } catch {}
  }
})

// ---- Garden overview + realtime (SSE) ----

async function isGardenMember(req, gardenId, userIdOverride = null) {
  try {
    const user = userIdOverride ? { id: userIdOverride } : await getUserFromRequest(req)
    if (!user?.id) return false
    // Admins can access any garden
    try { if (await isAdminFromRequest(req)) return true } catch {}
    if (sql) {
      const rows = await sql`
        select 1 as ok from public.garden_members
        where garden_id = ${gardenId} and user_id = ${user.id}
        limit 1
      `
      return Array.isArray(rows) && rows.length > 0
    }
    if (supabaseUrlEnv && supabaseAnonKey) {
      const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
      const bearer = getBearerTokenFromRequest(req)
      if (bearer) Object.assign(headers, { Authorization: `Bearer ${bearer}` })
      const url = `${supabaseUrlEnv}/rest/v1/garden_members?garden_id=eq.${encodeURIComponent(gardenId)}&user_id=eq.${encodeURIComponent(user.id)}&select=garden_id&limit=1`
      const r = await fetch(url, { headers })
      if (r.ok) {
        const arr = await r.json().catch(() => [])
        return Array.isArray(arr) && arr.length > 0
      }
    }
    return false
  } catch {
    return false
  }
}

app.get('/api/garden/:id/activity', async (req, res) => {
  try {
    const gardenId = String(req.params.id || '').trim()
    if (!gardenId) { res.status(400).json({ ok: false, error: 'garden id required' }); return }
    const user = await getUserFromRequestOrToken(req)
    if (!user?.id) { res.status(401).json({ ok: false, error: 'Unauthorized' }); return }
    const member = await isGardenMember(req, gardenId, user.id)
    if (!member) { res.status(403).json({ ok: false, error: 'Forbidden' }); return }

    const dayParam = typeof req.query.day === 'string' ? req.query.day : ''
    const dayIso = /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : new Date().toISOString().slice(0,10)
    const start = new Date(`${dayIso}T00:00:00.000Z`).toISOString()
    const endExclusive = new Date(new Date(`${dayIso}T00:00:00.000Z`).getTime() + 24 * 3600 * 1000).toISOString()

    let rows = []
    if (sql) {
      rows = await sql`
        select
          id::text as id,
          garden_id::text as garden_id,
          actor_id::text as actor_id,
          actor_name,
          actor_color,
          kind,
          message,
          plant_name,
          task_name,
          occurred_at
        from public.garden_activity_logs
        where garden_id = ${gardenId}
          and occurred_at >= ${start}
          and occurred_at < ${endExclusive}
        order by occurred_at desc
      `
    } else if (supabaseUrlEnv && supabaseAnonKey) {
      const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
      const bearer = getAuthTokenFromRequest(req)
      if (bearer) Object.assign(headers, { Authorization: `Bearer ${bearer}` })
      const url = `${supabaseUrlEnv}/rest/v1/garden_activity_logs?garden_id=eq.${encodeURIComponent(gardenId)}&occurred_at=gte.${encodeURIComponent(start)}&select=id,garden_id,actor_id,actor_name,actor_color,kind,message,plant_name,task_name,occurred_at&order=occurred_at.desc&limit=200`
      const resp = await fetch(url, { headers })
      if (resp.ok) {
        const arr = await resp.json().catch(() => [])
        rows = Array.isArray(arr) ? arr.filter((r) => {
          try {
            const ts = new Date(r.occurred_at).toISOString()
            return ts >= start && ts < endExclusive
          } catch {
            return false
          }
        }) : []
      }
    }

    const activity = []
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const occurredAtRaw = row?.occurred_at instanceof Date
          ? row.occurred_at.toISOString()
          : (row?.occurred_at ? String(row.occurred_at) : null)
        if (occurredAtRaw == null || occurredAtRaw === '') continue
        activity.push({
          id: String(row.id),
          gardenId: String(row.garden_id ?? row.gardenId ?? gardenId),
          actorId: row.actor_id ? String(row.actor_id) : row.actorId ? String(row.actorId) : null,
          actorName: row.actor_name ?? row.actorName ?? null,
          actorColor: row.actor_color ?? row.actorColor ?? null,
          kind: row.kind,
          message: row.message,
          plantName: row.plant_name ?? row.plantName ?? null,
          taskName: row.task_name ?? row.taskName ?? null,
          occurredAt: occurredAtRaw,
        })
      }
    }

      res.json({ ok: true, activity })
    } catch (e) {
      try { res.status(500).json({ ok: false, error: e?.message || 'failed to load activity' }) } catch {}
    }
  })

app.get('/api/garden/:id/tasks', async (req, res) => {
  try {
    const gardenId = String(req.params.id || '').trim()
    if (!gardenId) { res.status(400).json({ ok: false, error: 'garden id required' }); return }
    const startDay = typeof req.query.start === 'string' ? req.query.start : ''
    const endDay = typeof req.query.end === 'string' ? req.query.end : ''
    const dayPattern = /^\d{4}-\d{2}-\d{2}$/
    if (!dayPattern.test(startDay) || !dayPattern.test(endDay)) {
      res.status(400).json({ ok: false, error: 'start and end must be YYYY-MM-DD' })
      return
    }
    const user = await getUserFromRequestOrToken(req)
    if (!user?.id) { res.status(401).json({ ok: false, error: 'Unauthorized' }); return }
    const member = await isGardenMember(req, gardenId, user.id)
    if (!member) { res.status(403).json({ ok: false, error: 'Forbidden' }); return }

    let rows = []
    if (sql) {
      rows = await sql`
        select
          id::text as id,
          garden_id::text as garden_id,
          day,
          task_type,
          garden_plant_ids,
          success
        from public.garden_tasks
        where garden_id = ${gardenId}
          and day >= ${startDay}
          and day <= ${endDay}
        order by day asc
      `
    } else if (supabaseUrlEnv && supabaseAnonKey) {
      const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
      const bearer = getAuthTokenFromRequest(req)
      if (bearer) Object.assign(headers, { Authorization: `Bearer ${bearer}` })
      const query = [
        'select=id,garden_id,day,task_type,garden_plant_ids,success',
        `garden_id=eq.${encodeURIComponent(gardenId)}`,
        `day=gte.${encodeURIComponent(startDay)}`,
        `day=lte.${encodeURIComponent(endDay)}`,
        'order=day.asc',
      ].join('&')
      const resp = await fetch(`${supabaseUrlEnv}/rest/v1/garden_tasks?${query}`, { headers })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        res.status(resp.status).json({ ok: false, error: text || 'failed to load tasks' })
        return
      }
      rows = await resp.json().catch(() => [])
    } else {
      res.status(503).json({ ok: false, error: 'Database not configured' })
      return
    }

    const tasks = (rows || []).map((r) => ({
      id: String(r.id),
      gardenId: String(r.garden_id),
      day: (() => {
        if (r.day instanceof Date) return r.day.toISOString().slice(0, 10)
        return String(r.day || '').slice(0, 10)
      })(),
      taskType: String(r.task_type || 'watering'),
      gardenPlantIds: Array.isArray(r.garden_plant_ids) ? r.garden_plant_ids : [],
      success: Boolean(r.success),
    }))
    res.json({ ok: true, tasks })
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'failed to load tasks' })
  }
})

app.post('/api/garden/:id/activity', async (req, res) => {
  try {
    const gardenId = String(req.params.id || '').trim()
    if (!gardenId) { res.status(400).json({ ok: false, error: 'garden id required' }); return }
    const user = await getUserFromRequest(req)
    if (!user?.id) { res.status(401).json({ ok: false, error: 'Unauthorized' }); return }
    const member = await isGardenMember(req, gardenId, user.id)
    if (!member) { res.status(403).json({ ok: false, error: 'Forbidden' }); return }

    const body = req.body || {}
    const kindRaw = typeof body.kind === 'string' ? body.kind.trim() : ''
    const messageRaw = typeof body.message === 'string' ? body.message.trim() : ''
    if (!kindRaw || !messageRaw) { res.status(400).json({ ok: false, error: 'kind and message required' }); return }
    const plantName = typeof body.plantName === 'string' ? body.plantName : null
    const taskName = typeof body.taskName === 'string' ? body.taskName : null
    const actorColor = typeof body.actorColor === 'string' ? body.actorColor : null

    if (sql) {
      let actorName = null
      try {
        const nameRows = await sql`select coalesce(display_name, email, '') as name from public.profiles where id = ${user.id} limit 1`
        if (Array.isArray(nameRows) && nameRows[0]) actorName = nameRows[0].name || null
      } catch {}
      const nowIso = new Date().toISOString()
      await sql`
        insert into public.garden_activity_logs (garden_id, actor_id, actor_name, actor_color, kind, message, plant_name, task_name, occurred_at)
        values (${gardenId}, ${user.id}, ${actorName}, ${actorColor || null}, ${kindRaw}, ${messageRaw}, ${plantName || null}, ${taskName || null}, ${nowIso})
      `
      res.json({ ok: true })
      return
    }

    if (supabaseUrlEnv && supabaseAnonKey) {
      const headers = { apikey: supabaseAnonKey, Accept: 'application/json', 'Content-Type': 'application/json' }
      const bearer = getBearerTokenFromRequest(req)
      if (bearer) Object.assign(headers, { Authorization: `Bearer ${bearer}` })
      const payload = {
        _garden_id: gardenId,
        _kind: kindRaw,
        _message: messageRaw,
        _plant_name: plantName,
        _task_name: taskName,
        _actor_color: actorColor,
      }
      const resp = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/log_garden_activity`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        res.status(resp.status).json({ ok: false, error: text || 'failed to log activity' })
        return
      }
      res.json({ ok: true })
      return
    }

    res.status(503).json({ ok: false, error: 'activity logging unavailable' })
  } catch (e) {
    try { res.status(500).json({ ok: false, error: e?.message || 'failed to log activity' }) } catch {}
  }
})

// Batched initial load for a garden
app.get('/api/garden/:id/overview', async (req, res) => {
  try {
    const gardenId = String(req.params.id || '').trim()
    if (!gardenId) { res.status(400).json({ ok: false, error: 'garden id required' }); return }
    const user = await getUserFromRequest(req)
    if (!user?.id) { res.status(401).json({ ok: false, error: 'Unauthorized' }); return }
    const member = await isGardenMember(req, gardenId, user.id)
    if (!member) { res.status(403).json({ ok: false, error: 'Forbidden' }); return }

    let garden = null
    let plants = []
    let members = []
    const serverNow = new Date().toISOString()

    if (sql) {
      const gRows = await sql`
        select id::text as id, name, cover_image_url, created_by::text as created_by, created_at, coalesce(streak, 0)::int as streak
        from public.gardens where id = ${gardenId} limit 1
      `
      garden = Array.isArray(gRows) && gRows[0] ? gRows[0] : null

      const gpRows = await sql`
          select
          gp.id::text as id,
          gp.garden_id::text as garden_id,
          gp.plant_id::text as plant_id,
          gp.nickname,
          gp.seeds_planted::int as seeds_planted,
          gp.planted_at,
          gp.expected_bloom_date,
          gp.override_water_freq_unit,
          gp.override_water_freq_value::int as override_water_freq_value,
          gp.plants_on_hand::int as plants_on_hand,
          gp.sort_index::int as sort_index,
          p.id as p_id,
          p.name as p_name,
          p.scientific_name as p_scientific_name,
          p.colors as p_colors,
          p.seasons as p_seasons,
          p.rarity as p_rarity,
          p.meaning as p_meaning,
          p.description as p_description,
          p.image_url as p_image_url,
          p.photos as p_photos,
          p.care_sunlight as p_care_sunlight,
          p.care_water as p_care_water,
          p.care_soil as p_care_soil,
          p.care_difficulty as p_care_difficulty,
          p.seeds_available as p_seeds_available,
          p.water_freq_unit as p_water_freq_unit,
          p.water_freq_value as p_water_freq_value,
          p.water_freq_period as p_water_freq_period,
          p.water_freq_amount as p_water_freq_amount
        from public.garden_plants gp
        left join public.plants p on p.id = gp.plant_id
        where gp.garden_id = ${gardenId}
        order by gp.sort_index asc nulls last
      `
        plants = (gpRows || []).map((r) => {
          const plantPhotos = Array.isArray(r.p_photos) ? r.p_photos : undefined
          const plantImage = pickPrimaryPhotoUrlFromArray(plantPhotos, r.p_image_url || '')
          return {
            id: String(r.id),
            gardenId: String(r.garden_id),
            plantId: String(r.plant_id),
            nickname: r.nickname,
            seedsPlanted: Number(r.seeds_planted || 0),
            plantedAt: r.planted_at || null,
            expectedBloomDate: r.expected_bloom_date || null,
            overrideWaterFreqUnit: r.override_water_freq_unit || null,
            overrideWaterFreqValue: (r.override_water_freq_value ?? null),
            plantsOnHand: Number(r.plants_on_hand || 0),
            sortIndex: (r.sort_index ?? null),
            plant: r.p_id ? {
              id: String(r.p_id),
              name: String(r.p_name || ''),
              scientificName: String(r.p_scientific_name || ''),
              colors: Array.isArray(r.p_colors) ? r.p_colors.map(String) : [],
              seasons: Array.isArray(r.p_seasons) ? r.p_seasons.map(String) : [],
              rarity: r.p_rarity,
              meaning: r.p_meaning || '',
              description: r.p_description || '',
              photos: plantPhotos,
              image: plantImage,
              care: { sunlight: r.p_care_sunlight || 'Low', water: r.p_care_water || 'Low', soil: r.p_care_soil || '', difficulty: r.p_care_difficulty || 'Easy' },
              seedsAvailable: Boolean(r.p_seeds_available ?? false),
              waterFreqUnit: r.p_water_freq_unit || undefined,
              waterFreqValue: r.p_water_freq_value ?? null,
              waterFreqPeriod: r.p_water_freq_period || undefined,
              waterFreqAmount: r.p_water_freq_amount ?? null,
            } : null,
          }
        })

      const mRows = await sql`
        select gm.garden_id::text as garden_id, gm.user_id::text as user_id, gm.role, gm.joined_at,
               p.display_name, p.accent_key,
               u.email
        from public.garden_members gm
        left join public.profiles p on p.id = gm.user_id
        left join auth.users u on u.id = gm.user_id
        where gm.garden_id = ${gardenId}
      `
      members = (mRows || []).map((r) => ({
        gardenId: String(r.garden_id),
        userId: String(r.user_id),
        role: r.role,
        joinedAt: r.joined_at ? new Date(r.joined_at).toISOString() : null,
        displayName: r.display_name || null,
        email: r.email || null,
        accentKey: r.accent_key || null,
      }))
    } else if (supabaseUrlEnv && supabaseAnonKey) {
      const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
      const bearer = getBearerTokenFromRequest(req)
      if (bearer) Object.assign(headers, { Authorization: `Bearer ${bearer}` })

      // Garden
      const gUrl = `${supabaseUrlEnv}/rest/v1/gardens?id=eq.${encodeURIComponent(gardenId)}&select=id,name,cover_image_url,created_by,created_at,streak&limit=1`
      const gResp = await fetch(gUrl, { headers })
      if (gResp.ok) {
        const arr = await gResp.json().catch(() => [])
        const row = Array.isArray(arr) && arr[0] ? arr[0] : null
        if (row) garden = { id: String(row.id), name: row.name, cover_image_url: row.cover_image_url || null, created_by: String(row.created_by), created_at: row.created_at, streak: Number(row.streak || 0) }
      }

      // Garden plants
      const gpUrl = `${supabaseUrlEnv}/rest/v1/garden_plants?garden_id=eq.${encodeURIComponent(gardenId)}&select=id,garden_id,plant_id,nickname,seeds_planted,planted_at,expected_bloom_date,override_water_freq_unit,override_water_freq_value,plants_on_hand,sort_index`
      const gpResp = await fetch(gpUrl, { headers })
      let gpRows = []
      if (gpResp.ok) gpRows = await gpResp.json().catch(() => [])
      const plantIds = Array.from(new Set(gpRows.map((r) => r.plant_id)))
      let plantsMap = {}
      if (plantIds.length > 0) {
        const inParam = plantIds.map((id) => encodeURIComponent(String(id))).join(',')
      const pUrl = `${supabaseUrlEnv}/rest/v1/plants?id=in.(${inParam})&select=id,name,scientific_name,colors,seasons,rarity,meaning,description,image_url,photos,care_sunlight,care_water,care_soil,care_difficulty,seeds_available,water_freq_unit,water_freq_value,water_freq_period,water_freq_amount`
        const pResp = await fetch(pUrl, { headers })
        const pRows = pResp.ok ? (await pResp.json().catch(() => [])) : []
        for (const p of pRows) {
            const plantPhotos = Array.isArray(p.photos) ? p.photos : undefined
          plantsMap[String(p.id)] = {
            id: String(p.id),
            name: String(p.name || ''),
            scientificName: String(p.scientific_name || ''),
            colors: Array.isArray(p.colors) ? p.colors.map(String) : [],
            seasons: Array.isArray(p.seasons) ? p.seasons.map(String) : [],
            rarity: p.rarity,
            meaning: p.meaning || '',
            description: p.description || '',
              photos: plantPhotos,
              image: pickPrimaryPhotoUrlFromArray(plantPhotos, p.image_url || ''),
            care: { sunlight: p.care_sunlight || 'Low', water: p.care_water || 'Low', soil: p.care_soil || '', difficulty: p.care_difficulty || 'Easy' },
            seedsAvailable: Boolean(p.seeds_available ?? false),
            waterFreqUnit: p.water_freq_unit || undefined,
            waterFreqValue: p.water_freq_value ?? null,
            waterFreqPeriod: p.water_freq_period || undefined,
            waterFreqAmount: p.water_freq_amount ?? null,
          }
        }
      }
      plants = gpRows.map((r) => ({
        id: String(r.id),
        gardenId: String(r.garden_id),
        plantId: String(r.plant_id),
        nickname: r.nickname,
        seedsPlanted: Number(r.seeds_planted || 0),
        plantedAt: r.planted_at || null,
        expectedBloomDate: r.expected_bloom_date || null,
        overrideWaterFreqUnit: r.override_water_freq_unit || null,
        overrideWaterFreqValue: (r.override_water_freq_value ?? null),
        plantsOnHand: Number(r.plants_on_hand || 0),
        sortIndex: (r.sort_index ?? null),
        plant: plantsMap[String(r.plant_id)] || null,
      }))

      // Members via RPC to include email
      try {
        const rpcResp = await fetch(`${supabaseUrlEnv}/rest/v1/rpc/get_profiles_for_garden`, {
          method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ _garden_id: gardenId })
        })
        if (rpcResp.ok) {
          const rows = await rpcResp.json().catch(() => [])
          const gmResp = await fetch(`${supabaseUrlEnv}/rest/v1/garden_members?garden_id=eq.${encodeURIComponent(gardenId)}&select=garden_id,user_id,role,joined_at`, { headers })
          const gms = gmResp.ok ? (await gmResp.json().catch(() => [])) : []
          const meta = {}
          for (const r of rows) meta[String(r.user_id)] = { display_name: r.display_name || null, email: r.email || null }
          members = gms.map((m) => ({
            gardenId: String(m.garden_id),
            userId: String(m.user_id),
            role: m.role,
            joinedAt: m.joined_at,
            displayName: (meta[String(m.user_id)] || {}).display_name || null,
            email: (meta[String(m.user_id)] || {}).email || null,
            accentKey: null,
          }))
        }
      } catch {}
    } else {
      res.status(500).json({ ok: false, error: 'Database not configured' }); return
    }

    // Normalize garden object to frontend shape
    const gardenOut = garden ? {
      id: String(garden.id),
      name: String(garden.name),
      coverImageUrl: (garden.cover_image_url || garden.coverImageUrl || null),
      createdBy: String(garden.created_by || garden.createdBy || ''),
      createdAt: garden.created_at ? new Date(garden.created_at).toISOString() : (garden.createdAt || null),
      streak: Number(garden.streak ?? 0),
    } : null
    res.json({ ok: true, garden: gardenOut, plants, members, serverNow })
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'overview failed' })
  }
})

// Garden activity SSE — pushes new rows in garden_activity_logs
app.get('/api/garden/:id/stream', async (req, res) => {
  try {
    const gardenId = String(req.params.id || '').trim()
    if (!gardenId) { res.status(400).json({ error: 'garden id required' }); return }
    const user = await getUserFromRequestOrToken(req)
    if (!user?.id) { res.status(401).json({ error: 'Unauthorized' }); return }
    const member = await isGardenMember(req, gardenId, user.id)
    if (!member) { res.status(403).json({ error: 'Forbidden' }); return }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    // Initial acknowledge
    sseWrite(res, 'ready', { ok: true, gardenId })

    // Start from last 2 minutes to avoid missing events across reconnects
    let lastSeen = new Date(Date.now() - 2 * 60 * 1000).toISOString()

    const poll = async () => {
      try {
        if (sql) {
          const rows = await sql`
            select id::text as id, garden_id::text as garden_id, actor_id::text as actor_id, actor_name, actor_color, kind, message, plant_name, task_name, occurred_at
            from public.garden_activity_logs
            where garden_id = ${gardenId} and occurred_at > ${lastSeen}
            order by occurred_at asc
            limit 500
          `
          for (const r of rows || []) {
            lastSeen = new Date(r.occurred_at).toISOString()
            sseWrite(res, 'activity', {
              id: String(r.id), gardenId: String(r.garden_id), actorId: r.actor_id || null, actorName: r.actor_name || null, actorColor: r.actor_color || null,
              kind: r.kind, message: r.message, plantName: r.plant_name || null, taskName: r.task_name || null, occurredAt: new Date(r.occurred_at).toISOString(),
            })
          }
        } else if (supabaseUrlEnv && supabaseAnonKey) {
          const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
          // Include Authorization from bearer header or token query param (EventSource)
      const bearer = getAuthTokenFromRequest(req)
          if (bearer) Object.assign(headers, { Authorization: `Bearer ${bearer}` })
          const url = `${supabaseUrlEnv}/rest/v1/garden_activity_logs?garden_id=eq.${encodeURIComponent(gardenId)}&occurred_at=gt.${encodeURIComponent(lastSeen)}&select=id,garden_id,actor_id,actor_name,actor_color,kind,message,plant_name,task_name,occurred_at&order=occurred_at.asc&limit=500`
          const r = await fetch(url, { headers })
          if (r.ok) {
            const arr = await r.json().catch(() => [])
            for (const row of arr) {
              lastSeen = new Date(row.occurred_at).toISOString()
              sseWrite(res, 'activity', {
                id: String(row.id), gardenId: String(row.garden_id), actorId: row.actor_id || null, actorName: row.actor_name || null, actorColor: row.actor_color || null,
                kind: row.kind, message: row.message, plantName: row.plant_name || null, taskName: row.task_name || null, occurredAt: new Date(row.occurred_at).toISOString(),
              })
            }
          }
        }
      } catch {}
    }

    const iv = setInterval(poll, 1000)
    const hb = setInterval(() => { try { res.write(': ping\n\n') } catch {} }, 15000)
    req.on('close', () => { try { clearInterval(iv); clearInterval(hb) } catch {} })
  } catch (e) {
    try { res.status(500).json({ error: e?.message || 'stream failed' }) } catch {}
  }
})

// ---- Admin logs SSE ----
app.get('/api/admin/admin-logs/stream', async (req, res) => {
  try {
    // Allow admin static token via query param for EventSource
    try {
      const adminToken = (req.query?.admin_token ? String(req.query.admin_token) : '')
      if (adminToken) {
        try { req.headers['x-admin-token'] = adminToken } catch {}
      }
    } catch {}
    const adminId = await ensureAdmin(req, res)
    if (!adminId) return

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    let lastSeen = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    // Send initial snapshot (latest 200)
    try {
      if (sql) {
        const rows = await sql`
          select occurred_at, admin_id::text as admin_id, admin_name, action, target, detail
          from public.admin_activity_logs
          where occurred_at >= now() - interval '30 days'
          order by occurred_at desc
          limit 200
        `
        const list = (rows || []).map((r) => ({
          occurred_at: new Date(r.occurred_at).toISOString(),
          admin_id: r.admin_id || null,
          admin_name: r.admin_name || null,
          action: r.action,
          target: r.target || null,
          detail: r.detail || null,
        }))
        sseWrite(res, 'snapshot', { logs: list })
        if (list[0]?.occurred_at) lastSeen = list[0].occurred_at
      } else if (supabaseUrlEnv && supabaseAnonKey) {
        const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
        const url = `${supabaseUrlEnv}/rest/v1/admin_activity_logs?occurred_at=gte.${encodeURIComponent(new Date(Date.now() - 30*24*3600*1000).toISOString())}&select=occurred_at,admin_id,admin_name,action,target,detail&order=occurred_at.desc&limit=200`
        const r = await fetch(url, { headers })
        if (r.ok) {
          const arr = await r.json().catch(() => [])
          const list = (arr || []).map((row) => ({
            occurred_at: new Date(row.occurred_at).toISOString(),
            admin_id: row.admin_id || null,
            admin_name: row.admin_name || null,
            action: row.action,
            target: row.target || null,
            detail: row.detail || null,
          }))
          sseWrite(res, 'snapshot', { logs: list })
          if (list[0]?.occurred_at) lastSeen = list[0].occurred_at
        }
      }
    } catch {}

    const poll = async () => {
      try {
        if (sql) {
          const rows = await sql`
            select occurred_at, admin_id::text as admin_id, admin_name, action, target, detail
            from public.admin_activity_logs
            where occurred_at > ${lastSeen}
            order by occurred_at asc
            limit 500
          `
          for (const r of rows || []) {
            const payload = {
              occurred_at: new Date(r.occurred_at).toISOString(),
              admin_id: r.admin_id || null,
              admin_name: r.admin_name || null,
              action: r.action,
              target: r.target || null,
              detail: r.detail || null,
            }
            lastSeen = payload.occurred_at
            sseWrite(res, 'append', payload)
          }
        } else if (supabaseUrlEnv && supabaseAnonKey) {
          const headers = { apikey: supabaseAnonKey, Accept: 'application/json' }
          const url = `${supabaseUrlEnv}/rest/v1/admin_activity_logs?occurred_at=gt.${encodeURIComponent(lastSeen)}&select=occurred_at,admin_id,admin_name,action,target,detail&order=occurred_at.asc&limit=500`
          const r = await fetch(url, { headers })
          if (r.ok) {
            const arr = await r.json().catch(() => [])
            for (const row of arr || []) {
              const payload = {
                occurred_at: new Date(row.occurred_at).toISOString(),
                admin_id: row.admin_id || null,
                admin_name: row.admin_name || null,
                action: row.action,
                target: row.target || null,
                detail: row.detail || null,
              }
              lastSeen = payload.occurred_at
              sseWrite(res, 'append', payload)
            }
          }
        }
      } catch {}
    }

    const iv = setInterval(poll, 2500)
    const hb = setInterval(() => { try { res.write(': ping\n\n') } catch {} }, 15000)
    req.on('close', () => { try { clearInterval(iv); clearInterval(hb) } catch {} })
  } catch (e) {
    try { res.status(500).json({ error: e?.message || 'stream failed' }) } catch {}
  }
})

// Admin: create a new broadcast message
app.post('/api/admin/broadcast', async (req, res) => {
  try {
    // Require admin and ensure table
    const adminId = await ensureAdmin(req, res)
    if (!adminId) return
    if (!sql) {
      res.status(500).json({ error: 'Database not configured' })
      return
    }
    await ensureBroadcastTable()

    const messageRaw = (req.body?.message || '').toString().trim()
    const severityRaw = (req.body?.severity || '').toString().trim().toLowerCase()
    const severity = (severityRaw === 'warning' || severityRaw === 'danger') ? severityRaw : 'info'
    const durationMsRaw = Number(req.body?.durationMs || req.body?.duration_ms || req.body?.duration || 0)
    if (!messageRaw) {
      res.status(400).json({ error: 'Message is required' })
      return
    }
    // Enforce single active message
    const active = await sql`
      select id from public.broadcast_messages
      where removed_at is null and (expires_at is null or expires_at > now())
      limit 1
    `
    if (Array.isArray(active) && active.length > 0) {
      res.status(409).json({ error: 'An active broadcast already exists' })
      return
    }
    let expiresAt = null
    if (Number.isFinite(durationMsRaw) && durationMsRaw > 0) {
      expiresAt = new Date(Date.now() + Math.floor(durationMsRaw)).toISOString()
    }
    const rows = await sql`
      insert into public.broadcast_messages (message, severity, created_by, expires_at)
      values (${messageRaw}, ${severity}, ${typeof adminId === 'string' ? adminId : null}, ${expiresAt ? expiresAt : null})
      returning id::text as id, message, severity, created_at, expires_at, created_by::text as created_by
    `
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null
    // Resolve admin name for SSE payload convenience
    let adminName = null
    if (row?.created_by && sql) {
      try {
        const nameRows = await sql`select coalesce(display_name, email, '') as name from public.profiles where id = ${row.created_by} limit 1`
        adminName = nameRows?.[0]?.name || null
      } catch {}
    }
    const payload = row ? {
      id: String(row.id || ''),
      message: String(row.message || ''),
      severity: String(row.severity || 'info'),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      createdBy: row.created_by ? String(row.created_by) : null,
      adminName: adminName ? String(adminName) : null,
    } : null
    if (payload) broadcastToAll(payload)
    res.json({ ok: true, broadcast: payload })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to create broadcast' })
  }
})

// Admin: update current broadcast message (edit message or severity, optionally extend/shorten duration)
app.put('/api/admin/broadcast', async (req, res) => {
  try {
    const adminId = await ensureAdmin(req, res)
    if (!adminId) return
    if (!sql) {
      res.status(500).json({ error: 'Database not configured' })
      return
    }
    await ensureBroadcastTable()
    // Find current active
    const rows = await sql`
      select id, message, severity, created_at, expires_at, created_by::text as created_by
      from public.broadcast_messages
      where removed_at is null and (expires_at is null or expires_at > now())
      order by created_at desc
      limit 1
    `
    const cur = Array.isArray(rows) && rows[0] ? rows[0] : null
    if (!cur) {
      res.status(404).json({ error: 'No active broadcast' })
      return
    }
    const nextMessage = (req.body?.message ?? cur.message)?.toString()?.trim()
    const sevRaw = (req.body?.severity ?? cur.severity)?.toString()?.trim()?.toLowerCase()
    const nextSeverity = (sevRaw === 'warning' || sevRaw === 'danger') ? sevRaw : 'info'
    const durationMsRaw = req.body?.durationMs ?? req.body?.duration_ms ?? null
    let nextExpires = cur.expires_at ? new Date(cur.expires_at) : null
    if (durationMsRaw === null) {
      // keep as is
    } else {
      const n = Number(durationMsRaw)
      if (Number.isFinite(n) && n > 0) nextExpires = new Date(Date.now() + Math.floor(n))
      else nextExpires = null
    }
    const upd = await sql`
      update public.broadcast_messages
      set message = ${nextMessage}, severity = ${nextSeverity}, expires_at = ${nextExpires ? nextExpires.toISOString() : null}
      where id = ${cur.id}
      returning id::text as id, message, severity, created_at, expires_at, created_by::text as created_by
    `
    const row = upd?.[0]
    let adminName = null
    if (row?.created_by && sql) {
      try {
        const nameRows = await sql`select coalesce(display_name, email, '') as name from public.profiles where id = ${row.created_by} limit 1`
        adminName = nameRows?.[0]?.name || null
      } catch {}
    }
    const payload = row ? {
      id: String(row.id || ''),
      message: String(row.message || ''),
      severity: String(row.severity || 'info'),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      createdBy: row.created_by ? String(row.created_by) : null,
      adminName: adminName ? String(adminName) : null,
    } : null
    if (payload) broadcastToAll(payload)
    res.json({ ok: true, broadcast: payload })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to update broadcast' })
  }
})

// Admin: remove current (or specified) broadcast message
app.delete('/api/admin/broadcast', async (req, res) => {
  try {
    const adminId = await ensureAdmin(req, res)
    if (!adminId) return
    if (!sql) {
      res.status(500).json({ error: 'Database not configured' })
      return
    }
    await ensureBroadcastTable()
    const idParam = (req.query?.id || req.body?.id || '').toString().trim()
    let rows
    if (idParam) {
      rows = await sql`
        update public.broadcast_messages
        set removed_at = now()
        where id = ${idParam} and removed_at is null
        returning id
      `
    } else {
      rows = await sql`
        update public.broadcast_messages
        set removed_at = now()
        where removed_at is null and (expires_at is null or expires_at > now())
        returning id
      `
    }
    const changed = Array.isArray(rows) && rows.length > 0
    if (changed) clearBroadcastForAll()
    res.json({ ok: true, removed: changed })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to remove broadcast' })
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
  const host = process.env.HOST || '127.0.0.1' // Bind to localhost only for security
  app.listen(port, host, () => {
    console.log(`[server] listening on http://${host}:${port}`)
    // Best-effort ensure ban tables are present at startup
    ensureBanTables().catch(() => {})
    ensureBroadcastTable().catch(() => {})
  })
}

// Export app for testing and tooling
export { app }

