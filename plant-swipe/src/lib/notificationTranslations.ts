/**
 * Notification Template Translation Utilities
 * 
 * Functions to save and load notification template translations from Supabase
 * Similar to the email translation system
 */

import { supabase } from './supabaseClient'
import type { SupportedLanguage } from './i18n'

export interface NotificationTemplateTranslation {
  template_id: string
  language: SupportedLanguage
  message_variants: string[]
}

export interface NotificationTemplateTranslationRow extends NotificationTemplateTranslation {
  id: string
  created_at: string
  updated_at: string
}

/**
 * Save or update a notification template translation
 */
export async function saveNotificationTemplateTranslation(
  translation: NotificationTemplateTranslation
): Promise<{ error?: Error }> {
  try {
    const timestamp = new Date().toISOString()
    const { error } = await supabase
      .from('notification_template_translations')
      .upsert(
        {
          template_id: translation.template_id,
          language: translation.language,
          message_variants: translation.message_variants,
          updated_at: timestamp,
        },
        { onConflict: 'template_id,language' }
      )

    if (error) {
      return { error: new Error(error.message) }
    }

    return {}
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to save translation') }
  }
}

/**
 * Save multiple notification template translations
 */
export async function saveNotificationTemplateTranslations(
  translations: NotificationTemplateTranslation[]
): Promise<{ error?: Error }> {
  if (!translations.length) return {}

  try {
    const timestamp = new Date().toISOString()
    const rows = translations.map((t) => ({
      template_id: t.template_id,
      language: t.language,
      message_variants: t.message_variants,
      updated_at: timestamp,
    }))

    const { error } = await supabase
      .from('notification_template_translations')
      .upsert(rows, { onConflict: 'template_id,language' })

    if (error) {
      return { error: new Error(error.message) }
    }

    return {}
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to save translations') }
  }
}

/**
 * Get notification template translation for a specific language
 */
export async function getNotificationTemplateTranslation(
  templateId: string,
  language: SupportedLanguage
): Promise<{ data?: NotificationTemplateTranslationRow | null; error?: Error }> {
  try {
    const { data, error } = await supabase
      .from('notification_template_translations')
      .select('*')
      .eq('template_id', templateId)
      .eq('language', language)
      .maybeSingle()

    if (error) {
      return { error: new Error(error.message) }
    }

    return { data: data as NotificationTemplateTranslationRow | null }
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to load translation') }
  }
}

/**
 * Get all translations for a notification template
 */
export async function getNotificationTemplateTranslations(
  templateId: string
): Promise<{ data?: NotificationTemplateTranslationRow[]; error?: Error }> {
  try {
    const { data, error } = await supabase
      .from('notification_template_translations')
      .select('*')
      .eq('template_id', templateId)

    if (error) {
      return { error: new Error(error.message) }
    }

    return { data: (data || []) as NotificationTemplateTranslationRow[] }
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to load translations') }
  }
}

/**
 * Delete all translations for a notification template
 */
export async function deleteNotificationTemplateTranslations(
  templateId: string
): Promise<{ error?: Error }> {
  try {
    const { error } = await supabase
      .from('notification_template_translations')
      .delete()
      .eq('template_id', templateId)

    if (error) {
      return { error: new Error(error.message) }
    }

    return {}
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to delete translations') }
  }
}

/**
 * Check which languages have translations for a template
 */
export async function getTranslatedLanguages(
  templateId: string
): Promise<{ data?: SupportedLanguage[]; error?: Error }> {
  try {
    const { data, error } = await supabase
      .from('notification_template_translations')
      .select('language')
      .eq('template_id', templateId)

    if (error) {
      return { error: new Error(error.message) }
    }

    const languages = (data || [])
      .map((row) => row.language as SupportedLanguage)
      .filter((lang): lang is SupportedLanguage => !!lang)

    return { data: languages }
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to load languages') }
  }
}
