import postgres from 'postgres'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

let sqlInstance = null

function hydrateEnvFromDotenvIfNeeded() {
	if (process.env.DATABASE_URL || (process.env.SUPABASE_URL && process.env.SUPABASE_DB_PASSWORD)) return
	// Load from .env in current working directory and parent directory (monorepo/root)
	try { dotenv.config({ path: path.resolve(process.cwd(), '.env') }) } catch {}
	try { dotenv.config({ path: path.resolve(process.cwd(), '.env.local') }) } catch {}
	try { dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') }) } catch {}
	try { dotenv.config({ path: path.resolve(process.cwd(), '..', '.env.local') }) } catch {}
	// Fallback minimal manual parse from cwd if dotenv didn't populate
	try {
		const tryParse = (filename) => {
			const envPath = path.resolve(process.cwd(), filename)
			if (fs.existsSync(envPath)) {
				const raw = fs.readFileSync(envPath, 'utf-8')
				raw.split(/\r?\n/).forEach(line => {
					if (!line || line.startsWith('#')) return
					const eq = line.indexOf('=')
					if (eq === -1) return
					const key = line.slice(0, eq).trim()
					let value = line.slice(eq + 1).trim()
					if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
						value = value.slice(1, -1)
					}
					if (!(key in process.env)) process.env[key] = value
				})
			}
		}
		tryParse('.env')
		tryParse('.env.local')
	} catch {}
}

function buildConnectionString() {
	hydrateEnvFromDotenvIfNeeded()
	// Primary sources
	let cs = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL
	// Expand simple ${SUPABASE_DB_PASSWORD}
	if (cs && cs.includes('${SUPABASE_DB_PASSWORD}') && process.env.SUPABASE_DB_PASSWORD) {
		cs = cs.replace('${SUPABASE_DB_PASSWORD}', process.env.SUPABASE_DB_PASSWORD)
	}
	// Build from discrete PG* variables if needed
	if (!cs) {
		const host = process.env.PGHOST || process.env.POSTGRES_HOST
		const user = process.env.PGUSER || process.env.POSTGRES_USER
		const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || process.env.SUPABASE_DB_PASSWORD
		const port = process.env.PGPORT || process.env.POSTGRES_PORT || '5432'
		const database = process.env.PGDATABASE || process.env.POSTGRES_DB || 'plants'
		if (host && user) {
			const encUser = encodeURIComponent(user)
			const encPass = password ? encodeURIComponent(password) : ''
			const auth = encPass ? `${encUser}:${encPass}` : encUser
			cs = `postgresql://${auth}@${host}:${port}/${database}`
		}
	}
	// Supabase convenience fallback
	if (!cs && (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && (process.env.SUPABASE_DB_PASSWORD || process.env.VITE_SUPABASE_DB_PASSWORD)) {
		const supaUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
		const supaPwd = process.env.SUPABASE_DB_PASSWORD || process.env.VITE_SUPABASE_DB_PASSWORD
		const host = (() => {
			try { return new URL(supaUrl).host } catch { return null }
		})()
		// Convert <ref>.supabase.co -> db.<ref>.supabase.co for direct Postgres
		let pgHost = host
		if (host && host.endsWith('.supabase.co') && !host.startsWith('db.')) {
			const parts = host.split('.')
			if (parts.length >= 3) {
				pgHost = `db.${parts[0]}.supabase.co`
			}
		}
		const database = process.env.PGDATABASE || process.env.POSTGRES_DB || 'postgres'
		if (pgHost) cs = `postgresql://postgres:${encodeURIComponent(supaPwd)}@${pgHost}:5432/${database}`
	}
	// Ensure TLS for remote hosts unless explicitly configured
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

export function getSql() {
	if (sqlInstance) return sqlInstance
	const cs = buildConnectionString()
	if (!cs) {
		console.warn('[db] Missing DATABASE_URL (and/or SUPABASE_URL + SUPABASE_DB_PASSWORD). API routes will return 500.')
		throw new Error('DATABASE_URL not configured. Set DATABASE_URL or SUPABASE_URL & SUPABASE_DB_PASSWORD in .env')
	}
	// Add SSL for remote hosts by default (e.g., Supabase), allow plain for localhost
	let options = undefined
	try {
		const url = new URL(cs)
		const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
		if (!isLocal) {
			options = { ssl: 'require' }
		}
	} catch {}
	sqlInstance = options ? postgres(cs, options) : postgres(cs)
	return sqlInstance
}

export default getSql