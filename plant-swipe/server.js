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


dotenv.config()
// Optionally load server-only secrets from .env.server (ignored if missing)
try {
  dotenv.config({ path: path.resolve(__dirname, '.env.server') })
} catch {}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const exec = promisify(execCb)

// Supabase client (server-side) for auth verification
const supabaseUrlEnv = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabaseServer = (supabaseUrlEnv && supabaseAnonKey)
  ? createSupabaseClient(supabaseUrlEnv, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
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
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_TOKEN
const supabaseAdmin = (supabaseUrlEnv && supabaseServiceKey) ? createSupabaseClient(supabaseUrlEnv, supabaseServiceKey) : null

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// Admin: restart server (detached self-reexec)
app.post('/api/admin/restart-server', async (req, res) => {
  try {
    const uid = await ensureAdmin(req, res)
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
})

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
    const uid = await ensureAdmin(req, res)
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
    const dump = spawn('pg_dump', ['--dbname', connectionString, '--no-owner', '--no-acl'], {
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
  const uid = await ensureAdmin(req, res)
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

