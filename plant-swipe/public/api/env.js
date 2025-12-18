// Static fallback for environments that cannot proxy /api/env.js
// Mirrors the top-level env.js but keeps the URL under /api/env.js to
// avoid noisy 404s when the API server isn't available.
window.__ENV__ = {
  VITE_SUPABASE_URL: globalThis.VITE_SUPABASE_URL || '',
  VITE_SUPABASE_ANON_KEY: globalThis.VITE_SUPABASE_ANON_KEY || '',
  VITE_ADMIN_STATIC_TOKEN: globalThis.VITE_ADMIN_STATIC_TOKEN || '',
  VITE_ADMIN_PUBLIC_MODE: globalThis.VITE_ADMIN_PUBLIC_MODE || false,
};
