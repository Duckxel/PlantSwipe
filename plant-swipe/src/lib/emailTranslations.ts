/**
 * Email Template Translation Utilities
 * 
 * Functions to save and load email template translations from Supabase
 * Similar to the plant translation system
 */

import { supabase } from './supabaseClient'
import type { SupportedLanguage } from './i18n'
import type { JSONContent } from '@tiptap/core'

export interface EmailTemplateTranslation {
  template_id: string
  language: SupportedLanguage
  subject: string
  preview_text?: string | null
  body_html: string
  body_json?: JSONContent | null
}

export interface EmailTemplateTranslationRow extends EmailTemplateTranslation {
  id: string
  created_at: string
  updated_at: string
}

/**
 * Save or update an email template translation
 */
export async function saveEmailTemplateTranslation(
  translation: EmailTemplateTranslation
): Promise<{ error?: Error }> {
  try {
    const timestamp = new Date().toISOString()
    const { error } = await supabase
      .from('admin_email_template_translations')
      .upsert(
        {
          template_id: translation.template_id,
          language: translation.language,
          subject: translation.subject,
          preview_text: translation.preview_text || null,
          body_html: translation.body_html,
          body_json: translation.body_json || null,
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
 * Save multiple email template translations
 */
export async function saveEmailTemplateTranslations(
  translations: EmailTemplateTranslation[]
): Promise<{ error?: Error }> {
  if (!translations.length) return {}

  try {
    const timestamp = new Date().toISOString()
    const rows = translations.map((t) => ({
      template_id: t.template_id,
      language: t.language,
      subject: t.subject,
      preview_text: t.preview_text || null,
      body_html: t.body_html,
      body_json: t.body_json || null,
      updated_at: timestamp,
    }))

    const { error } = await supabase
      .from('admin_email_template_translations')
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
 * Get email template translation for a specific language
 */
export async function getEmailTemplateTranslation(
  templateId: string,
  language: SupportedLanguage
): Promise<{ data?: EmailTemplateTranslationRow | null; error?: Error }> {
  try {
    const { data, error } = await supabase
      .from('admin_email_template_translations')
      .select('*')
      .eq('template_id', templateId)
      .eq('language', language)
      .maybeSingle()

    if (error) {
      return { error: new Error(error.message) }
    }

    return { data: data as EmailTemplateTranslationRow | null }
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to load translation') }
  }
}

/**
 * Get all translations for an email template
 */
export async function getEmailTemplateTranslations(
  templateId: string
): Promise<{ data?: EmailTemplateTranslationRow[]; error?: Error }> {
  try {
    const { data, error } = await supabase
      .from('admin_email_template_translations')
      .select('*')
      .eq('template_id', templateId)

    if (error) {
      return { error: new Error(error.message) }
    }

    return { data: (data || []) as EmailTemplateTranslationRow[] }
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to load translations') }
  }
}

/**
 * Delete all translations for an email template
 */
export async function deleteEmailTemplateTranslations(
  templateId: string
): Promise<{ error?: Error }> {
  try {
    const { error } = await supabase
      .from('admin_email_template_translations')
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
      .from('admin_email_template_translations')
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
