// ESM server to serve API and static assets
import express from 'express'
import postgres from 'postgres'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs/promises'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

dotenv.config()
// Optionally load server-only secrets from .env.server (ignored if missing)
try {
  dotenv.config({ path: path.resolve(__dirname, '.env.server') })
} catch {}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const exec = promisify(execCb)

// Supabase client (server-side) for auth verification
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabaseServer = (supabaseUrl && supabaseAnonKey)
  ? createSupabaseClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

async function getUserIdFromRequest(req) {
  try {
    const header = req.get('authorization') || req.get('Authorization') || ''
    const prefix = 'bearer '
    if (!header || header.length < 10) return null
    const low = header.toLowerCase()
    if (!low.startsWith(prefix)) return null
    const token = header.slice(prefix.length).trim()
    if (!token || !supabaseServer) return null
    const { data, error } = await supabaseServer.auth.getUser(token)
    if (error || !data?.user?.id) return null
    return data.user.id
  } catch {
    return null
  }
}

async function isAdminUserId(userId) {
  if (!userId || !sql) return false
  try {
    const rows = await sql`select is_admin from profiles where id = ${userId} limit 1`
    if (Array.isArray(rows) && rows.length > 0) {
      const val = rows[0]?.is_admin
      return val === true
    }
  } catch {}
  return false
}

async function ensureAdmin(req, res) {
  const uid = await getUserIdFromRequest(req)
  if (!uid) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  const ok = await isAdminUserId(uid)
  if (!ok) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }
  return uid
}

function buildConnectionString() {
  let cs = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL
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
  if (!cs && process.env.SUPABASE_URL && process.env.SUPABASE_DB_PASSWORD) {
    try {
      const host = new URL(process.env.SUPABASE_URL).host
      let pgHost
      if (host.endsWith('.supabase.co')) {
        const parts = host.split('.')
        const isProjectHost = parts.length === 3 && parts[1] === 'supabase' && parts[2] === 'co' && !!parts[0]
        const isDbHost = parts.length === 4 && parts[0] === 'db' && !!parts[1] && parts[2] === 'supabase' && parts[3] === 'co'
        if (isDbHost) {
          pgHost = host
        } else if (isProjectHost) {
          const project = parts[0]
          pgHost = `db.${project}.supabase.co`
        }
      }
      if (pgHost) {
        const database = process.env.PGDATABASE || 'postgres'
        cs = `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@${pgHost}:5432/${database}`
      }
    } catch {}
  }
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
app.use(express.json())

// Supabase service client for admin verification
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_TOKEN
const supabaseAdmin = (supabaseUrl && supabaseServiceKey) ? createSupabaseClient(supabaseUrl, supabaseServiceKey) : null

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/admin/sync-schema', async (req, res) => {
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

// Admin: pull latest code from git repository
app.post('/api/admin/pull-code', async (req, res) => {
  try {
    const uid = await ensureAdmin(req, res)
    if (!uid) return

    const branch = (req.query.branch || '').toString().trim()
    const repoDir = path.resolve(__dirname)
    // Fetch all, prune stale remotes, delete local branches that have no remote (excluding current), checkout selected, and fast-forward pull
    // Notes:
    // - Deleting local branches that do not exist on origin anymore
    // - Skips deleting the currently checked-out branch
    // - Using --ff-only to avoid merges
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
    const fullCmd = parts.join(' && ')
    const { stdout, stderr } = await exec(fullCmd, { timeout: 240000, shell: '/bin/bash' })
    res.json({ ok: true, stdout, stderr, branch: branch || undefined })
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'git pull failed' })
  }
})

// Admin: list remote branches and current branch
app.get('/api/admin/branches', async (req, res) => {
  try {
    const uid = await ensureAdmin(req, res)
    if (!uid) return

    const repoDir = path.resolve(__dirname)
    await exec(`git -C "${repoDir}" remote update --prune`, { timeout: 60000 })
    const { stdout: branchesStdout } = await exec(`git -C "${repoDir}" branch -r --format='%(refname:short)'`, { timeout: 60000 })
    const branches = branchesStdout
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .filter(name => name.startsWith('origin/'))
      .map(name => name.replace(/^origin\//, ''))
      .filter(name => name !== 'HEAD')
      .sort((a, b) => a.localeCompare(b))

    const { stdout: currentStdout } = await exec(`git -C "${repoDir}" rev-parse --abbrev-ref HEAD`, { timeout: 30000 })
    const current = currentStdout.trim()

    res.json({ branches, current })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to list branches' })
  }
})

// Static assets
const distDir = path.resolve(__dirname, 'dist')
app.use(express.static(distDir))
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`)
})

