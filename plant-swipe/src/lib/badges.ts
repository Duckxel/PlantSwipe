import { supabase } from '@/lib/supabaseClient'
import type { BadgeRow, UserBadgeRow, UserBadgeWithDetails } from '@/types/badge'

/** Fetch all available badges. */
export async function getAllBadges(): Promise<BadgeRow[]> {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error || !data) return []
  return data as BadgeRow[]
}

/** Fetch all badges earned by a specific user, with badge details. */
export async function getUserBadges(userId: string): Promise<UserBadgeWithDetails[]> {
  const { data, error } = await supabase
    .from('user_badges')
    .select('*, badge:badges(*)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })

  if (error || !data) return []
  return data as unknown as UserBadgeWithDetails[]
}

/** Award a badge to a user by slug. Idempotent. Returns true on success. */
export async function awardBadge(userId: string, badgeSlug: string): Promise<boolean> {
  // Look up the badge by slug
  const { data: badge, error: badgeErr } = await supabase
    .from('badges')
    .select('id')
    .eq('slug', badgeSlug)
    .eq('is_active', true)
    .single()

  if (badgeErr || !badge) return false

  const { error } = await supabase
    .from('user_badges')
    .insert({ user_id: userId, badge_id: badge.id })

  // unique violation = already earned
  if (error && error.code !== '23505') return false
  return true
}

/** Award a badge by badge ID directly. Idempotent. */
export async function awardBadgeById(userId: string, badgeId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_badges')
    .insert({ user_id: userId, badge_id: badgeId })

  if (error && error.code !== '23505') return false
  return true
}

/** Check if a user has a specific badge (by slug). */
export async function userHasBadge(userId: string, badgeSlug: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_badges')
    .select('id, badge:badges!inner(slug)')
    .eq('user_id', userId)
    .eq('badges.slug', badgeSlug)
    .limit(1)

  if (error || !data || data.length === 0) return false
  return true
}
