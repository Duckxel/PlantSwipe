/**
 * Impressions tracking utility.
 * Tracks page views for plant info pages and blog posts.
 * Only admins can read the counts.
 */

import { supabase } from '@/lib/supabaseClient'

export type ImpressionType = 'plant' | 'blog'

/**
 * Track a page view impression (fire-and-forget, does not block rendering).
 * Called on every page load/reload of a plant info page or blog post.
 */
export function trackImpression(type: ImpressionType, id: string): void {
  if (!id) return
  fetch('/api/impressions/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, id }),
    credentials: 'same-origin',
  }).catch(() => {
    // Silently ignore errors — impression tracking is non-critical
  })
}

/**
 * Fetch the impression count for a specific entity.
 * Requires admin authentication — returns null if the user is not admin.
 */
export async function fetchImpression(
  type: ImpressionType,
  id: string
): Promise<{ count: number; lastViewedAt: string | null } | null> {
  if (!id) return null
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return null

    const res = await fetch(`/api/impressions/${type}/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'same-origin',
    })
    if (!res.ok) return null
    const data = await res.json()
    return { count: data.count ?? 0, lastViewedAt: data.lastViewedAt ?? null }
  } catch {
    return null
  }
}
