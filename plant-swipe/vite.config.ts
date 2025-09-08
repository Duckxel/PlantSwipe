// @ts-nocheck
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
// Use regular path/url imports (Vite provides Node polytypes via tsconfig.node.json)
import path from 'path'
import { fileURLToPath } from 'url'

// Simple runtime Postgres access for dev using postgres.js via db.js
// Exposes REST endpoints under /api during Vite dev only.

// ESM __dirname shim
// Derive __dirname for ESM context
// @ts-ignore augment import.meta at runtime
const __dirname = path.dirname(fileURLToPath(import.meta.url))

function apiPlugin(): Plugin {
  return {
    name: 'plantswipe-api',
    configureServer(server) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req?.url) return next()
        if (!req.url.startsWith('/api')) return next()

        // Health check should not attempt DB connection
        if (req.url === '/api/health') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
          return
        }

        if (req.url === '/api/plants' && req.method === 'GET') {
          let sql: any = null
          try {
            const mod: any = await import('./db.js')
            // Support either default returning instance or function
            sql = typeof mod.default === 'function' ? mod.default() : mod.default
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Database initialization failed', detail: (e as any)?.message }))
            return
          }

          try {
            // Query real table structure as provided (lowercase plural: plants)
            const rows: any[] = await sql`select * from plants order by name asc`
            // Map DB rows to frontend Plant shape
            const mapped = rows.map(r => ({
              id: r.id,
              name: r.name,
              scientificName: r.scientific_name,
              colors: r.colors ?? [],
              seasons: r.seasons ?? [],
              rarity: r.rarity, // enum text already matches
              meaning: r.meaning ?? '',
              description: r.description ?? '',
              image: r.image_url ?? '',
              care: {
                sunlight: r.care_sunlight,
                water: r.care_water,
                soil: r.care_soil,
                difficulty: r.care_difficulty
              },
              seedsAvailable: r.seeds_available === true
            }))
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(mapped))
            return
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: (e as any).message }))
            return
          }
        }

        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), apiPlugin()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } }
})