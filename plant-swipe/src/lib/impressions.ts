/**
 * Impressions tracking utility.
 * Tracks page views for plant info pages and blog posts.
 * Only admins can read the counts.
 *
 * A 5-second per-entity cooldown (stored in localStorage) prevents
 * spamming reloads from inflating the counter.
 */

import { supabase } from '@/lib/supabaseClient'

export type ImpressionType = 'plant' | 'blog'

/** Cooldown duration in milliseconds */
const IMPRESSION_COOLDOWN_MS = 5_000

/**
 * Returns true if this entity was tracked less than IMPRESSION_COOLDOWN_MS ago.
 * Uses localStorage so the cooldown survives page reloads.
 */
function isOnCooldown(type: ImpressionType, id: string): boolean {
  try {
    const key = `imp_cd_${type}_${id}`
    const ts = localStorage.getItem(key)
    if (!ts) return false
    return Date.now() - Number(ts) < IMPRESSION_COOLDOWN_MS
  } catch {
    return false
  }
}

/** Mark the entity as just tracked (starts the cooldown window). */
function setCooldown(type: ImpressionType, id: string): void {
  try {
    const key = `imp_cd_${type}_${id}`
    localStorage.setItem(key, String(Date.now()))
  } catch {
    // localStorage unavailable — cooldown won't persist across reloads
  }
}

/**
 * Track a page view impression (fire-and-forget, does not block rendering).
 * Called on every page load/reload of a plant info page or blog post.
 * Skipped if the same entity was tracked within the last 5 seconds.
 */
export function trackImpression(type: ImpressionType, id: string): void {
  if (!id) return
  if (isOnCooldown(type, id)) return
  setCooldown(type, id)
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
