import postgres from 'postgres';

// Build connection string using pooler
const projectRef = 'lxnkcguwewrskqnyzjwi';
const region = process.env.SUPABASE_REGION || 'eu-west-2';
const pass = process.env.SUPABASE_DB_PASSWORD;
const poolerHost = `aws-0-${region}.pooler.supabase.com`;
const poolerUser = `postgres.${projectRef}`;
const url = `postgresql://${encodeURIComponent(poolerUser)}:${encodeURIComponent(pass)}@${poolerHost}:6543/postgres?sslmode=require`;

console.log('Connecting to:', poolerHost + ':6543');
console.log('User:', poolerUser);

const sql = postgres(url, { 
  ssl: { rejectUnauthorized: false },
  connect_timeout: 10,
  idle_timeout: 20,
  max: 1 
});

try {
  const start = Date.now();
  const result = await sql`SELECT 1 as test`;
  const latency = Date.now() - start;
  console.log(`SUCCESS! Database connection works (${latency}ms):`, result);
  await sql.end();
  process.exit(0);
} catch (err) {
  console.error('FAILED:', err.message);
  await sql.end();
  process.exit(1);
}
