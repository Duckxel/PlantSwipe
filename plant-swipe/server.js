// ESM server to serve API and static assets
import express from 'express'
import postgres from 'postgres'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'

dotenv.config()
// Optionally load server-only secrets from .env.server (ignored if missing)
try {
  dotenv.config({ path: path.resolve(__dirname, '.env.server') })
} catch {}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const exec = promisify(execCb)

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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
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
    const requiredToken = process.env.ADMIN_API_TOKEN
    const providedToken = req.get('x-admin-token') || ''
    if (requiredToken && providedToken !== requiredToken) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const repoDir = path.resolve(__dirname)
    const cmd = `git -C "${repoDir}" fetch --all --prune && git -C "${repoDir}" pull --ff-only`
    const { stdout, stderr } = await exec(cmd, { timeout: 120000 })
    res.json({ ok: true, stdout, stderr })
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'git pull failed' })
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

