import postgres from 'postgres'

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

async function main() {
  const cs = buildConnectionString()
  if (!cs) {
    console.error('No DB connection string from env')
    process.exit(2)
  }
  const sql = postgres(cs)
  try {
    const nowRows = await sql.unsafe('select now() as now')
    const uniqRows = await sql.unsafe("select count(distinct ip_address)::int as c from public.web_visits where ip_address is not null and occurred_at >= now() - interval '60 minutes'")
    const visitsRows = await sql.unsafe("select count(*)::int as recent from public.web_visits where occurred_at >= now() - interval '60 minutes'")
    const lastRows = await sql.unsafe('select max(occurred_at) as last from public.web_visits')
    console.log(JSON.stringify({ now: nowRows?.[0]?.now, uniqueLast60m: uniqRows?.[0]?.c, visitsLast60m: visitsRows?.[0]?.recent, lastVisit: lastRows?.[0]?.last }))
  } catch (e) {
    console.error(e?.message || String(e))
    process.exit(1)
  } finally {
    try { await sql.end({ timeout: 1 }) } catch {}
  }
}

main()
