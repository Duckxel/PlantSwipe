/** Row from the `badges` table — badge catalog. */
export type BadgeRow = {
  id: string
  slug: string
  name: string
  description: string | null
  icon_url: string | null
  category: string
  is_active: boolean
  created_at: string
}

/** Row from the `user_badges` table — earned badges per user. */
export type UserBadgeRow = {
  id: string
  user_id: string
  badge_id: string
  earned_at: string
}

/** Badge with full info, used for display. */
export type UserBadgeWithDetails = UserBadgeRow & {
  badge: BadgeRow
}
