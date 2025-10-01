// ESM server to serve API and static assets
import express from 'express'
import postgres from 'postgres'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs/promises'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'

dotenv.config()
// Optionally load server-only secrets from .env.server (ignored if missing)
try {
  dotenv.config({ path: path.resolve(__dirname, '.env.server') })
} catch {}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

