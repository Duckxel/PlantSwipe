import type { UserRole } from "@/constants/userRoles"
import type { SupportedLanguage } from "@/lib/i18n"

/**
 * Translations cache for Pro Advice content
 * Key: language code (e.g., 'en', 'fr')
 * Value: translated content string
 */
export type ProAdviceTranslations = Partial<Record<SupportedLanguage, string>>

export type PlantProAdvice = {
  id: string
  plantId: string
  authorId: string
  authorDisplayName: string | null
  authorUsername: string | null
  authorAvatarUrl?: string | null
  authorRoles?: UserRole[] | null
  content: string
  /** ISO language code of the original content (detected via DeepL) */
  originalLanguage?: string | null
  /** Cached translations keyed by language code */
  translations?: ProAdviceTranslations | null
  imageUrl?: string | null
  referenceUrl?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
}
