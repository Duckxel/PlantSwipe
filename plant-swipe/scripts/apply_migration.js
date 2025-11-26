
import postgres from 'postgres'
import fs from 'node:fs/promises'

async function run() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  const sql = postgres(connectionString)
  
  try {
    const migration = await fs.readFile('/workspace/plant-swipe/supabase/migrations/20251125_campaign_timezones.sql', 'utf-8')
    console.log('Applying migration...')
    await sql.unsafe(migration)
    console.log('Migration applied successfully')
  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    await sql.end()
  }
}

run()
