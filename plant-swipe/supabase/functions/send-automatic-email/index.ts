import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts"
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.0"

// Supported languages - should match frontend i18n config
type SupportedLanguage = 'en' | 'fr'
const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

// Email wrapper localized strings (same as email-campaign-runner)
const EMAIL_WRAPPER_STRINGS: Record<SupportedLanguage, {
  teamName: string
  tagline: string
  exploreButton: string
  aboutLink: string
  contactLink: string
  copyright: string
}> = {
  en: {
    teamName: "The Aphylia Team",
    tagline: "Helping you grow your plant knowledge 🌱",
    exploreButton: "Explore Aphylia →",
    aboutLink: "About",
    contactLink: "Contact",
    copyright: "© {{year}} Aphylia. Made with 💚 for plant enthusiasts everywhere.",
  },
  fr: {
    teamName: "L'équipe Aphylia",
    tagline: "Vous aider à développer vos connaissances botaniques 🌱",
    exploreButton: "Explorer Aphylia →",
    aboutLink: "À propos",
    contactLink: "Contact",
    copyright: "© {{year}} Aphylia. Fait avec 💚 pour les passionnés de plantes partout.",
  },
}

type EmailTrigger = {
  id: string
  trigger_type: string
  display_name: string
  description: string | null
  is_enabled: boolean
  template_id: string | null
}

type EmailTemplate = {
  id: string
  title: string
  subject: string
  body_html: string
  body_json: Record<string, unknown> | null
  version: number
}

type EmailTranslation = {
  language: string
  subject: string
  preview_text: string | null
  body_html: string
}

const payloadSchema = z.object({
  triggerType: z.string().min(1),  // e.g., 'WELCOME_EMAIL'
  userId: z.string().uuid(),
  userEmail: z.string().email(),
  userDisplayName: z.string().min(1),
  userLanguage: z.string().optional().default('en'),
})

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
  "Content-Type": "application/json",
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

const RESEND_BASE_URL = (Deno.env.get("RESEND_BASE_URL") ?? "https://api.resend.com").replace(/\/$/, "")
const RESEND_SEND_ENDPOINT = `${RESEND_BASE_URL}/emails`
const RESEND_API_KEY =
  Deno.env.get("EMAIL_CAMPAIGN_RESEND_KEY") ??
  Deno.env.get("RESEND_API_KEY") ??
  Deno.env.get("SUPABASE_RESEND_API_KEY") ??
  ""

const DEFAULT_FROM_EMAIL = "Plant Swipe <info@aphylia.app>"
const fromEmail = formatFromAddress(
  Deno.env.get("EMAIL_CAMPAIGN_FROM") ?? Deno.env.get("RESEND_FROM") ?? DEFAULT_FROM_EMAIL,
)
const replyToEmail = Deno.env.get("EMAIL_CAMPAIGN_REPLY_TO") ?? Deno.env.get("RESEND_REPLY_TO") ?? undefined

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed", message: "Only POST is supported" })
  }
  if (!supabase) {
    return jsonResponse(500, { error: "supabase_not_configured", message: "Missing SUPABASE_URL or service key" })
  }
  if (!RESEND_API_KEY) {
    return jsonResponse(500, { error: "resend_not_configured", message: "Missing RESEND_API_KEY" })
  }

  let parsedInput: z.infer<typeof payloadSchema>
  try {
    const body = await req.json().catch(() => ({}))
    parsedInput = payloadSchema.parse(body)
  } catch (error) {
    return jsonResponse(422, {
      error: "validation_error",
      message: error instanceof Error ? error.message : "Invalid payload",
    })
  }

  const { triggerType, userId, userEmail, userDisplayName, userLanguage } = parsedInput

  try {
    // 1. Check if this trigger is enabled and has a template
    const trigger = await loadTrigger(supabase, triggerType)
    
    if (!trigger) {
      console.log(`[send-automatic-email] Trigger ${triggerType} not found`)
      return jsonResponse(200, { 
        sent: false, 
        reason: "trigger_not_found",
        message: `Trigger ${triggerType} does not exist`
      })
    }

    if (!trigger.is_enabled) {
      console.log(`[send-automatic-email] Trigger ${triggerType} is disabled`)
      return jsonResponse(200, { 
        sent: false, 
        reason: "trigger_disabled",
        message: `Trigger ${triggerType} is disabled`
      })
    }

    if (!trigger.template_id) {
      console.log(`[send-automatic-email] Trigger ${triggerType} has no template configured`)
      return jsonResponse(200, { 
        sent: false, 
        reason: "no_template",
        message: `Trigger ${triggerType} has no template configured`
      })
    }

    // 2. Check if we've already sent this email to this user
    const alreadySent = await checkAlreadySent(supabase, triggerType, userId)
    if (alreadySent) {
      console.log(`[send-automatic-email] Already sent ${triggerType} to user ${userId}`)
      return jsonResponse(200, { 
        sent: false, 
        reason: "already_sent",
        message: `${triggerType} already sent to this user`
      })
    }

    // 3. Load the template
    const template = await loadTemplate(supabase, trigger.template_id)
    if (!template) {
      console.log(`[send-automatic-email] Template ${trigger.template_id} not found`)
      return jsonResponse(200, { 
        sent: false, 
        reason: "template_not_found",
        message: "Template not found"
      })
    }

    // 4. Load translations for user's language
    const translations = await fetchEmailTemplateTranslations(supabase, trigger.template_id)
    
    // 5. Prepare and send the email
    const result = await sendEmail({
      template,
      translations,
      userEmail,
      userDisplayName,
      userLanguage: userLanguage as SupportedLanguage,
      triggerType,
    })

    if (result.success) {
      // 6. Record the send
      await recordSend(supabase, triggerType, userId, trigger.template_id)
      
      console.log(`[send-automatic-email] Successfully sent ${triggerType} to ${userEmail}`)
      return jsonResponse(200, {
        sent: true,
        messageId: result.messageId,
        template: template.title,
      })
    } else {
      console.error(`[send-automatic-email] Failed to send ${triggerType} to ${userEmail}:`, result.error)
      return jsonResponse(200, {
        sent: false,
        reason: "send_failed",
        error: result.error,
      })
    }
  } catch (error) {
    console.error("[send-automatic-email] Unhandled error:", error)
    return jsonResponse(500, {
      error: "internal_error",
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

async function loadTrigger(
  client: SupabaseClient,
  triggerType: string
): Promise<EmailTrigger | null> {
  const { data, error } = await client
    .from("admin_email_triggers")
    .select("*")
    .eq("trigger_type", triggerType)
    .maybeSingle()

  if (error) {
    console.error("[send-automatic-email] Error loading trigger:", error)
    return null
  }
  return data as EmailTrigger | null
}

async function loadTemplate(
  client: SupabaseClient,
  templateId: string
): Promise<EmailTemplate | null> {
  const { data, error } = await client
    .from("admin_email_templates")
    .select("id, title, subject, body_html, body_json, version")
    .eq("id", templateId)
    .maybeSingle()

  if (error) {
    console.error("[send-automatic-email] Error loading template:", error)
    return null
  }
  return data as EmailTemplate | null
}

async function checkAlreadySent(
  client: SupabaseClient,
  triggerType: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await client
    .from("admin_automatic_email_sends")
    .select("id")
    .eq("trigger_type", triggerType)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.warn("[send-automatic-email] Error checking sent status:", error)
    return false // Allow send if we can't check
  }
  return data !== null
}

async function recordSend(
  client: SupabaseClient,
  triggerType: string,
  userId: string,
  templateId: string
): Promise<void> {
  const { error } = await client
    .from("admin_automatic_email_sends")
    .insert({
      trigger_type: triggerType,
      user_id: userId,
      template_id: templateId,
      sent_at: new Date().toISOString(),
      status: "sent",
    })

  if (error) {
    console.warn("[send-automatic-email] Error recording send:", error)
    // Don't throw - email was already sent
  }
}

async function fetchEmailTemplateTranslations(
  client: SupabaseClient,
  templateId: string
): Promise<Map<string, EmailTranslation>> {
  const map = new Map<string, EmailTranslation>()
  
  const { data, error } = await client
    .from("admin_email_template_translations")
    .select("language, subject, preview_text, body_html")
    .eq("template_id", templateId)

  if (error) {
    console.warn("[send-automatic-email] Failed to load email translations:", error)
    return map
  }

  for (const row of data ?? []) {
    if (row?.language) {
      map.set(row.language, {
        language: row.language,
        subject: row.subject,
        preview_text: row.preview_text,
        body_html: row.body_html,
      })
    }
  }

  return map
}

interface SendEmailParams {
  template: EmailTemplate
  translations: Map<string, EmailTranslation>
  userEmail: string
  userDisplayName: string
  userLanguage: SupportedLanguage
  triggerType: string
}

async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { template, translations, userEmail, userDisplayName, userLanguage, triggerType } = params
  
  // Prepare variable context
  const userCap = userDisplayName.charAt(0).toUpperCase() + userDisplayName.slice(1).toLowerCase()
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let randomStr = ""
  for (let i = 0; i < 10; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  const websiteUrl = Deno.env.get("WEBSITE_URL") ?? "https://aphylia.app"
  
  const context: Record<string, string> = {
    user: userCap,
    email: userEmail,
    random: randomStr,
    url: websiteUrl.replace(/^https?:\/\//, ""),
    code: "XXXXXX",
  }

  // Get translated content if available
  const translation = translations.get(userLanguage)
  const rawSubject = translation?.subject || template.subject
  const rawBodyHtml = translation?.body_html || template.body_html

  // Render variables
  const subject = renderTemplate(rawSubject, context)
  const bodyHtml = sanitizeHtmlForEmail(renderTemplate(rawBodyHtml, context))
  
  // Wrap with email template
  const html = wrapEmailHtml(bodyHtml, subject, userLanguage)
  const text = stripHtml(bodyHtml)

  // Send via Resend
  const payload = {
    from: fromEmail,
    to: userEmail,
    subject,
    html,
    text,
    headers: {
      "X-Trigger-Type": triggerType,
      "X-Template-Id": template.id,
    },
    tags: [
      { name: "trigger_type", value: triggerType },
      { name: "template_id", value: template.id },
    ],
    ...(replyToEmail ? { reply_to: replyToEmail } : {}),
  }

  try {
    const response = await fetch(RESEND_SEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const detail = await response.text()
      return { success: false, error: `Resend error: ${response.status} - ${detail}` }
    }

    const result = await response.json()
    return { success: true, messageId: result.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function renderTemplate(input: string | null | undefined, context: Record<string, string>): string {
  if (!input) return ""
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const normalized = key.trim().toLowerCase()
    const replacement = context[normalized]
    return replacement !== undefined ? replacement : `{{${key}}}`
  })
}

function stripHtml(input: string): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .trim()
}

function sanitizeHtmlForEmail(html: string): string {
  if (!html) return html
  
  let result = html
  
  // Replace CSS variables
  const cssVarMap: Record<string, string> = {
    "--tt-color-highlight-yellow": "#fef08a",
    "--tt-color-highlight-red": "#fecaca",
    "--tt-color-highlight-green": "#bbf7d0",
    "--tt-color-highlight-blue": "#bfdbfe",
    "--tt-color-highlight-purple": "#e9d5ff",
    "--tt-color-highlight-pink": "#fbcfe8",
    "--tt-color-highlight-orange": "#fed7aa",
  }
  result = result.replace(/var\(\s*(--tt-color-[a-zA-Z-]+)\s*\)/gi, (_match, varName) => {
    return cssVarMap[varName] || "#fef08a"
  })
  
  // Replace linear-gradient
  result = result.replace(/background:\s*linear-gradient\s*\([^;"}]*\)\s*;?/gi, (match) => {
    const hexMatch = match.match(/#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3}/)
    if (hexMatch) return `background-color: ${hexMatch[0]};`
    return "background-color: #ffffff;"
  })
  
  // Remove box-shadow
  result = result.replace(/box-shadow:\s*[^;"}]+;?/gi, "")
  
  // Replace rgba
  result = result.replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)/gi, (_match, r, g, b) => {
    const toHex = (n: string) => {
      const hex = parseInt(n).toString(16)
      return hex.length === 1 ? "0" + hex : hex
    }
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  })
  
  // Remove flex
  result = result.replace(/display:\s*flex\s*;[^;]*;?/gi, "text-align: center;")
  
  // Remove transition and gap
  result = result.replace(/transition:\s*[^;"}]+;?/gi, "")
  result = result.replace(/gap:\s*[^;"}]+;?/gi, "")
  
  // Clean up
  result = result.replace(/;\s*;/g, ";")
  result = result.replace(/style="\s*;/g, 'style="')
  result = result.replace(/;\s*"/g, '"')
  
  return result
}

function wrapEmailHtml(bodyHtml: string, subject: string, language: SupportedLanguage = DEFAULT_LANGUAGE): string {
  const currentYear = new Date().getFullYear()
  const websiteUrl = Deno.env.get("WEBSITE_URL") ?? "https://aphylia.app"
  const strings = EMAIL_WRAPPER_STRINGS[language] || EMAIL_WRAPPER_STRINGS[DEFAULT_LANGUAGE]
  const copyrightText = strings.copyright.replace("{{year}}", String(currentYear))

  const logoUrl = "https://media.aphylia.app/UTILITY/admin/uploads/png/icon-500_transparent_white.png"
  const logoImg = `<img src="${logoUrl}" alt="Aphylia" width="32" height="32" style="display:block;border:0;outline:none;text-decoration:none;" />`
  const logoImgLarge = `<img src="${logoUrl}" alt="Aphylia" width="40" height="40" style="display:block;border:0;outline:none;text-decoration:none;" />`

  return `<!DOCTYPE html>
<html lang="${language}" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${subject || 'Aphylia'}</title>
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@600;700&display=swap" rel="stylesheet">
  <style>
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; max-width: 100%; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    h1 { font-size: 32px; font-weight: 700; color: #111827; margin: 0 0 20px 0; line-height: 1.2; }
    h2 { font-size: 26px; font-weight: 700; color: #1f2937; margin: 32px 0 16px 0; }
    h3 { font-size: 22px; font-weight: 600; color: #374151; margin: 28px 0 12px 0; }
    p { margin: 0 0 16px 0; line-height: 1.75; color: #374151; }
    a { color: #059669; text-decoration: underline; font-weight: 500; }
    strong, b { font-weight: 600; color: #111827; }
    @media screen and (max-width: 640px) {
      .email-container { width: 100% !important; border-radius: 0 !important; }
      .email-body { padding: 32px 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:linear-gradient(180deg, #ecfdf5 0%, #ffffff 30%, #ffffff 70%, #fef3c7 100%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg, #ecfdf5 0%, #ffffff 30%, #ffffff 70%, #fef3c7 100%);margin:0;padding:0;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 20px;">
        <table role="presentation" class="email-container" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:32px;border:1px solid rgba(16, 185, 129, 0.12);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%);padding:32px 48px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:20px;padding:14px 28px;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="vertical-align:middle;padding-right:12px;">
                            ${logoImg}
                          </td>
                          <td style="vertical-align:middle;">
                            <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;font-family:'Quicksand',-apple-system,BlinkMacSystemFont,sans-serif;">Aphylia</span>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-body" style="padding:48px 48px 32px 48px;color:#374151;font-size:16px;line-height:1.75;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 48px 48px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border-radius:20px;border:1px solid rgba(16, 185, 129, 0.1);overflow:hidden;">
                <tr>
                  <td style="padding:28px 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="72" style="vertical-align:middle;padding-right:20px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:#10b981;border-radius:16px;width:56px;height:56px;">
                            <tr>
                              <td align="center" valign="middle" style="width:56px;height:56px;">
                                ${logoImgLarge}
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0 0 4px 0;font-size:18px;font-weight:700;color:#111827;">
                            ${strings.teamName}
                          </p>
                          <p style="margin:0;font-size:14px;color:#6b7280;">
                            ${strings.tagline}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 48px;text-align:center;border-top:1px solid rgba(16, 185, 129, 0.08);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;">
                      <tr>
                        <td>
                          <a href="${websiteUrl}" style="display:inline-block;background:linear-gradient(135deg, #059669 0%, #10b981 100%);color:#ffffff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:50px;text-decoration:none;">
                            ${strings.exploreButton}
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 12px 0;font-size:13px;color:#9ca3af;">
                      <a href="${websiteUrl}" style="color:#059669;text-decoration:none;font-weight:500;">aphylia.app</a>
                      <span style="color:#d1d5db;margin:0 8px;">•</span>
                      <a href="${websiteUrl}/about" style="color:#9ca3af;text-decoration:none;">${strings.aboutLink}</a>
                      <span style="color:#d1d5db;margin:0 8px;">•</span>
                      <a href="${websiteUrl}/contact" style="color:#9ca3af;text-decoration:none;">${strings.contactLink}</a>
                    </p>
                    <p style="margin:0;font-size:12px;color:#d1d5db;">
                      ${copyrightText}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  })
}

function formatFromAddress(raw: string, defaultName = "Plant Swipe"): string {
  if (!raw) return DEFAULT_FROM_EMAIL
  if (raw.includes("<")) return raw
  return `${defaultName} <${raw}>`
}
