import { supabase } from "@/lib/supabaseClient"

type RuntimeEnvWindow = typeof globalThis & {
  __ENV__?: Record<string, string | undefined>
}

const runtimeEnv = (globalThis as RuntimeEnvWindow).__ENV__
const adminStaticToken =
  import.meta.env?.VITE_ADMIN_STATIC_TOKEN ?? runtimeEnv?.VITE_ADMIN_STATIC_TOKEN ?? ""

export async function buildAdminRequestHeaders(
  seed?: Record<string, string>,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = seed ? { ...seed } : {}

  try {
    const session = (await supabase.auth.getSession()).data.session
    const accessToken = session?.access_token
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`
    }
  } catch {
    // Silently ignore; caller might rely on static token instead.
  }

  if (adminStaticToken && !headers["X-Admin-Token"]) {
    headers["X-Admin-Token"] = String(adminStaticToken)
  }

  return headers
}
