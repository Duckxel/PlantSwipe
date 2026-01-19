import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts"
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.0"

type CampaignRow = {
  id: string
  title: string
  status: string
  template_id: string | null
  template_version: number | null
  subject: string
  body_html: string
  body_json: Record<string, unknown> | null
  variables: unknown
  scheduled_for: string | null
  timezone: string | null
  test_mode: boolean | null
  test_email: string | null
}

type Recipient = {
  userId: string
  email: string
  displayName: string
  timezone: string | null
  language: string
}

type EmailTranslation = {
  language: string
  subject: string
  preview_text: string | null
  body_html: string
  body_json: Record<string, unknown> | null
}

// Supported languages - should match frontend i18n config
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SUPPORTED_LANGUAGES = ['en', 'fr'] as const
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]
const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

// Email wrapper localized strings
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

type CampaignSummary = {
  id: string
  title: string
  previousStatus: string
  status: string
  skipped: boolean
  reason?: string
  totalRecipients: number
  sentCount: number
  failedCount: number
  batches: Array<{ index: number; size: number; status: "sent" | "failed"; error?: string }>
  durationMs: number
  pendingCount: number
  alreadySent: number
  dueThisRun: number
  sentThisRun: number
  nextScheduledFor: string | null
}

const payloadSchema = z
  .object({
    campaignId: z.string().uuid().optional(),
    campaignLimit: z.number().int().min(1).max(10).optional(),
    recipientLimit: z.number().int().min(1).max(5000).optional(),
    batchSize: z.number().int().min(1).max(100).optional(),
  })
  .optional()
  .default({})

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
const RESEND_BATCH_ENDPOINT = `${RESEND_BASE_URL}/emails/batch`
const RESEND_API_KEY =
  Deno.env.get("EMAIL_CAMPAIGN_RESEND_KEY") ??
  Deno.env.get("RESEND_API_KEY") ??
  Deno.env.get("SUPABASE_RESEND_API_KEY") ??
  ""

const DEFAULT_FROM_EMAIL = "Aphylia <info@aphylia.app>"
const fromEmail = formatFromAddress(
  Deno.env.get("EMAIL_CAMPAIGN_FROM") ?? Deno.env.get("RESEND_FROM") ?? DEFAULT_FROM_EMAIL,
)
const replyToEmail = Deno.env.get("EMAIL_CAMPAIGN_REPLY_TO") ?? Deno.env.get("RESEND_REPLY_TO") ?? undefined

const DEFAULT_BATCH_SIZE = clamp(Number(Deno.env.get("EMAIL_CAMPAIGN_BATCH_SIZE") ?? "40") || 40, 1, 100)
const MAX_RECIPIENT_LIMIT = 5000

const DEFAULT_CAMPAIGN_TIMEZONE = "UTC"
const MAX_TIMEZONE_LEAD_HOURS = clamp(
  Number(Deno.env.get("EMAIL_CAMPAIGN_MAX_TZ_LEAD_HOURS") ?? "26") || 26,
  1,
  36,
)
const SEND_WINDOW_GRACE_MS = clamp(
  Number(Deno.env.get("EMAIL_CAMPAIGN_SEND_GRACE_MS") ?? "60000") || 60000,
  1000,
  300000,
)
const RESCHEDULE_BACKOFF_MS = clamp(
  Number(Deno.env.get("EMAIL_CAMPAIGN_RECHECK_DELAY_MS") ?? "60000") || 60000,
  1000,
  300000,
)
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

  const options = {
    forceCampaignId: parsedInput.campaignId ?? null,
    campaignLimit: parsedInput.campaignLimit ?? 1,
    recipientLimit: parsedInput.recipientLimit
      ? Math.min(parsedInput.recipientLimit, MAX_RECIPIENT_LIMIT)
      : undefined,
    batchSize: clamp(parsedInput.batchSize ?? DEFAULT_BATCH_SIZE, 1, 100),
  }

  try {
    const dueCampaigns = await loadCampaigns(supabase, options)
    if (!dueCampaigns.length) {
      return jsonResponse(200, { processed: 0, campaigns: [] })
    }

    const summaries: CampaignSummary[] = []
    for (const campaign of dueCampaigns) {
      const summary = await processCampaign(supabase, campaign, options)
      summaries.push(summary)
    }

    return jsonResponse(200, { processed: summaries.length, campaigns: summaries })
  } catch (error) {
    console.error("[email-campaign-runner] unhandled error", error)
    return jsonResponse(500, {
      error: "internal_error",
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

async function loadCampaigns(
  client: SupabaseClient,
  options: {
    forceCampaignId: string | null
    campaignLimit: number
  },
): Promise<CampaignRow[]> {
  if (options.forceCampaignId) {
    const { data, error } = await client
      .from("admin_email_campaigns")
      .select("*")
      .eq("id", options.forceCampaignId)
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data ? [data as CampaignRow] : []
  }

  const now = new Date()
  const horizon = new Date(now.getTime() + MAX_TIMEZONE_LEAD_HOURS * 60 * 60 * 1000).toISOString()
  const { data, error } = await client
    .from("admin_email_campaigns")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_for", horizon)
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .limit(options.campaignLimit)

  if (error) throw error
  return (data ?? []) as CampaignRow[]
}

async function processCampaign(
  client: SupabaseClient,
  campaign: CampaignRow,
  options: {
    forceCampaignId: string | null
    recipientLimit?: number
    batchSize: number
  },
): Promise<CampaignSummary> {
  const startedAt = new Date()
  const claimStatuses = options.forceCampaignId ? ["draft", "scheduled"] : ["scheduled"]
  const updatePayload = {
    status: "running",
    send_started_at: startedAt.toISOString(),
    send_error: null,
  }
  const { data: claimed, error: claimError } = await client
    .from("admin_email_campaigns")
    .update(updatePayload)
    .eq("id", campaign.id)
    .in("status", claimStatuses)
    .select("*")
    .single()

  if (claimError || !claimed) {
    return {
      id: campaign.id,
      title: campaign.title,
      previousStatus: campaign.status,
      status: campaign.status,
      skipped: true,
      reason: claimError?.message ?? "Campaign already running or completed",
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0,
      batches: [],
      durationMs: 0,
    }
  }

  const summary: CampaignSummary = {
    id: campaign.id,
    title: campaign.title,
    previousStatus: campaign.status,
    status: "running",
    skipped: false,
    totalRecipients: 0,
    sentCount: 0,
    failedCount: 0,
    batches: [],
    durationMs: 0,
    pendingCount: 0,
    alreadySent: 0,
    dueThisRun: 0,
    sentThisRun: 0,
    nextScheduledFor: null,
  }

  try {
    // Check if this is a test mode campaign - only send to test_email
    const isTestMode = claimed.test_mode === true
    const testEmail = claimed.test_email?.trim()

    let recipients: Recipient[]

    if (isTestMode) {
      if (!testEmail) {
        summary.status = "failed"
        summary.reason = "Test mode enabled but no test_email specified"
        summary.durationMs = Date.now() - startedAt.getTime()
        await finalizeCampaign(client, campaign.id, {
          status: "failed",
          send_completed_at: new Date().toISOString(),
          send_error: summary.reason,
          total_recipients: 0,
          sent_count: 0,
          failed_count: 0,
          send_summary: summary,
        })
        return summary
      }

      // For test mode, create a single test recipient
      console.log(`[email-campaign-runner] TEST MODE: sending only to ${testEmail}`)
      recipients = [{
        userId: "test-user-" + campaign.id,
        email: testEmail,
        displayName: "Test User",
        timezone: null,
        language: DEFAULT_LANGUAGE,
      }]
    } else {
      // Normal mode: collect all recipients
      recipients = await collectRecipients(client, options.recipientLimit)
    }

    summary.totalRecipients = recipients.length

    if (!recipients.length) {
      summary.status = "failed"
      summary.reason = "No recipients with confirmed email"
      summary.durationMs = Date.now() - startedAt.getTime()
      await finalizeCampaign(client, campaign.id, {
        status: "failed",
        send_completed_at: new Date().toISOString(),
        send_error: summary.reason,
        total_recipients: 0,
        sent_count: 0,
        failed_count: 0,
        send_summary: summary,
      })
      return summary
    }

    const alreadySentSet = await fetchSentUserIds(client, campaign.id)
    summary.alreadySent = alreadySentSet.size
    summary.sentCount = alreadySentSet.size

    const unsentRecipients = recipients.filter((recipient) => !alreadySentSet.has(recipient.userId))

    // Fetch email template translations for multi-language support
    console.log(`[email-campaign-runner] Campaign ${campaign.id} template_id: ${campaign.template_id || 'NULL'}`)
    const emailTranslations = await fetchEmailTemplateTranslations(client, campaign.template_id)
    console.log(`[email-campaign-runner] Loaded ${emailTranslations.size} translations: [${Array.from(emailTranslations.keys()).join(', ')}]`)

    if (!unsentRecipients.length) {
      summary.status = "sent"
      summary.reason = "All recipients already delivered previously"
      summary.durationMs = Date.now() - startedAt.getTime()
      await finalizeCampaign(client, campaign.id, {
        status: "sent",
        send_completed_at: new Date().toISOString(),
        send_error: null,
        total_recipients: summary.totalRecipients,
        sent_count: summary.sentCount,
        failed_count: 0,
        send_summary: summary,
      })
      return summary
    }

    const plans = buildRecipientPlans(claimed, unsentRecipients)
    const now = new Date()
    const { due, future } = partitionRecipientPlans(plans, now)
    summary.dueThisRun = due.length
    summary.pendingCount = future.length
    summary.nextScheduledFor = future.length ? future[0].sendAt : null

    const remainingBudget =
      typeof options.recipientLimit === "number"
        ? Math.max(options.recipientLimit - summary.sentCount, 0)
        : Number.POSITIVE_INFINITY

    const dueToSend =
      remainingBudget === Number.POSITIVE_INFINITY ? due : due.slice(0, remainingBudget)
    const leftoverDue = due.slice(dueToSend.length)
    summary.pendingCount += leftoverDue.length
    summary.nextScheduledFor = determineNextScheduledFor(leftoverDue, future, now)

    if (!dueToSend.length) {
      summary.status = "scheduled"
      summary.reason =
        leftoverDue.length > 0 ? "recipient_limit_reached" : "waiting_for_user_timezones"
      summary.durationMs = Date.now() - startedAt.getTime()
      const nextRun =
        summary.nextScheduledFor ?? new Date(now.getTime() + RESCHEDULE_BACKOFF_MS).toISOString()
      await updateCampaignSchedule(client, campaign.id, summary, nextRun)
      return summary
    }

    const recipientsToSend = dueToSend.map((plan) => plan.recipient)
    const batches = chunkRecipients(recipientsToSend, options.batchSize)
    const successfulRecipients: Recipient[] = []
    let aborted = false

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchResult = await sendBatch(claimed, batch, i, emailTranslations)
      summary.batches.push(batchResult)
      if (batchResult.status === "sent") {
        successfulRecipients.push(...batch)
        summary.sentThisRun += batchResult.size
        summary.sentCount += batchResult.size
      } else {
        summary.reason = batchResult.error
        aborted = true
        break
      }
    }

    // Record sends for tracking (skip for test mode since test users don't exist in auth.users)
    if (successfulRecipients.length && !isTestMode) {
      await recordCampaignSends(client, campaign.id, successfulRecipients)
    }

    summary.durationMs = Date.now() - startedAt.getTime()

    if (aborted) {
      summary.status = summary.sentThisRun > 0 ? "partial" : "failed"
      summary.failedCount = Math.max(summary.failedCount, summary.totalRecipients - summary.sentCount)
      await finalizeCampaign(client, campaign.id, {
        status: summary.status,
        send_completed_at: new Date().toISOString(),
        send_error: summary.reason,
        total_recipients: summary.totalRecipients,
        sent_count: summary.sentCount,
        failed_count: summary.failedCount,
        send_summary: summary,
      })
      return summary
    }

    const remainingCount = future.length + leftoverDue.length
    summary.pendingCount = remainingCount
    summary.nextScheduledFor =
      determineNextScheduledFor(leftoverDue, future, now) ??
      new Date(now.getTime() + RESCHEDULE_BACKOFF_MS).toISOString()

    if (remainingCount === 0) {
      summary.status = "sent"
      summary.nextScheduledFor = null
      await finalizeCampaign(client, campaign.id, {
        status: "sent",
        send_completed_at: new Date().toISOString(),
        send_error: null,
        total_recipients: summary.totalRecipients,
        sent_count: summary.sentCount,
        failed_count: 0,
        send_summary: summary,
      })
    } else {
      summary.status = "scheduled"
      await updateCampaignSchedule(client, campaign.id, summary, summary.nextScheduledFor)
    }

    if (campaign.template_id && summary.sentCount > 0 && remainingCount === 0) {
      await client
        .from("admin_email_templates")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", campaign.template_id)
    }

    return summary
  } catch (error) {
    // Properly stringify any error type (Error instances, plain objects, or primitives)
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error)
        : String(error)
    
    summary.status = "failed"
    summary.reason = errorMessage
    summary.durationMs = Date.now() - startedAt.getTime()
    const failureCount =
      summary.totalRecipients > 0
        ? Math.max(summary.totalRecipients - summary.sentCount, summary.failedCount)
        : summary.failedCount
    summary.failedCount = failureCount

    // If emails were already sent, mark as partial success instead of failed
    if (summary.sentThisRun > 0) {
      summary.status = "partial"
    }

    // Try to finalize with error status (don't throw if this fails)
    try {
      await finalizeCampaign(client, campaign.id, {
        status: summary.status,
        send_completed_at: new Date().toISOString(),
        send_error: errorMessage,
        total_recipients: summary.totalRecipients,
        sent_count: summary.sentCount,
        failed_count: failureCount,
        send_summary: summary,
      })
    } catch (finalizeError) {
      console.error("[email-campaign-runner] failed to finalize after error", campaign.id, finalizeError)
    }

    console.error("[email-campaign-runner] campaign failed", campaign.id, errorMessage, error)
    return summary
  }
}

async function collectRecipients(
  client: SupabaseClient,
  limit?: number,
): Promise<Recipient[]> {
  const recipients: Recipient[] = []
  const perPage = 200
  let page = 1

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage,
    })
    if (error) throw error
    const users = data?.users ?? []
    if (!users.length) break

    const ids = users.map((user) => user.id)
    const profileMeta = await fetchProfileMeta(client, ids)

    for (const user of users) {
      if (!user.email) continue
      const confirmed = Boolean(user.email_confirmed_at || user.confirmed_at)
      if (!confirmed) continue

      const profile = profileMeta.get(user.id)
      
      // Skip users who have explicitly opted out of email campaigns
      // notify_email defaults to true (null means opted in)
      if (profile?.notifyEmail === false) continue

      const displayName =
        profile?.displayName ||
        (typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : null) ||
        user.email.split("@")[0] ||
        `Friend ${user.id.slice(0, 8)}`
      const timezone =
        profile?.timezone ||
        (typeof user.user_metadata?.timezone === "string" ? user.user_metadata.timezone : null) ||
        null
      const language = profile?.language || DEFAULT_LANGUAGE

      recipients.push({
        userId: user.id,
        email: user.email,
        displayName,
        timezone,
        language,
      })

      if (limit && recipients.length >= limit) {
        return recipients
      }
    }

    if (users.length < perPage) break
    page += 1
  }

  return recipients
}

type ProfileMeta = {
  displayName: string | null
  timezone: string | null
  language: string
  notifyEmail: boolean | null
}

async function fetchProfileMeta(client: SupabaseClient, ids: string[]): Promise<Map<string, ProfileMeta>> {
  const map = new Map<string, ProfileMeta>()
  if (!ids.length) return map
  const { data, error } = await client
    .from("profiles")
    .select("id, display_name, timezone, language, notify_email")
    .in("id", ids)
  if (error) {
    console.warn("[email-campaign-runner] failed to load profile metadata", error)
    return map
  }
  for (const row of data ?? []) {
    if (row?.id) {
      map.set(row.id, {
        displayName: typeof row.display_name === "string" ? row.display_name : null,
        timezone: typeof row.timezone === "string" && row.timezone.trim().length ? row.timezone : null,
        language: typeof row.language === "string" && row.language.trim().length ? row.language : DEFAULT_LANGUAGE,
        notifyEmail: row.notify_email === false ? false : null, // null means opted in (default)
      })
    }
  }
  return map
}

function chunkRecipients(list: Recipient[], size: number): Recipient[][] {
  const batches: Recipient[][] = []
  for (let i = 0; i < list.length; i += size) {
    batches.push(list.slice(i, i + size))
  }
  return batches
}

type RecipientPlan = {
  recipient: Recipient
  sendAt: string
}

function buildRecipientPlans(campaign: CampaignRow, recipients: Recipient[]): RecipientPlan[] {
  const plans = recipients.map((recipient) => ({
    recipient,
    sendAt: computeUserSendTime(campaign, recipient.timezone),
  }))
  plans.sort((a, b) => {
    const aTime = new Date(a.sendAt).getTime()
    const bTime = new Date(b.sendAt).getTime()
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
      return Number.isNaN(aTime) ? 1 : -1
    }
    return aTime - bTime
  })
  return plans
}

function partitionRecipientPlans(plans: RecipientPlan[], now: Date) {
  const due: RecipientPlan[] = []
  const future: RecipientPlan[] = []
  for (const plan of plans) {
    const sendAtDate = new Date(plan.sendAt)
    if (Number.isNaN(sendAtDate.getTime())) {
      due.push({ recipient: plan.recipient, sendAt: now.toISOString() })
      continue
    }
    if (sendAtDate.getTime() <= now.getTime() + SEND_WINDOW_GRACE_MS) {
      due.push(plan)
    } else {
      future.push(plan)
    }
  }
  return { due, future }
}

function determineNextScheduledFor(leftoverDue: RecipientPlan[], futurePlans: RecipientPlan[], now: Date): string | null {
  if (leftoverDue.length) {
    return new Date(now.getTime() + RESCHEDULE_BACKOFF_MS).toISOString()
  }
  if (futurePlans.length) {
    return futurePlans[0].sendAt
  }
  return null
}

function computeUserSendTime(campaign: CampaignRow, userTimezone: string | null): string {
  const scheduled = campaign.scheduled_for
  if (!scheduled) return new Date().toISOString()
  const campaignTimezone =
    campaign.timezone && campaign.timezone.trim().length ? campaign.timezone : DEFAULT_CAMPAIGN_TIMEZONE
  const targetTimezone = userTimezone && userTimezone.trim().length ? userTimezone : campaignTimezone
  return convertCampaignTimeToUserUtc(scheduled, campaignTimezone, targetTimezone)
}

function convertCampaignTimeToUserUtc(scheduledUtc: string, campaignTimezone: string, userTimezone: string): string {
  try {
    const scheduledDate = new Date(scheduledUtc)
    if (Number.isNaN(scheduledDate.getTime())) {
      return scheduledUtc
    }
    if (campaignTimezone === userTimezone) {
      return scheduledDate.toISOString()
    }

    const campaignFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: campaignTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    const campaignParts = campaignFormatter.formatToParts(scheduledDate)
    const getPart = (type: string) => parseInt(campaignParts.find((p) => p.type === type)?.value ?? "0", 10)

    const year = getPart("year")
    const month = getPart("month") - 1
    const day = getPart("day")
    const hour = getPart("hour")
    const minute = getPart("minute")
    const second = getPart("second")

    const isoBase =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T` +
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`
    let candidateUtc = new Date(`${isoBase}Z`)

    for (let iteration = 0; iteration < 10; iteration++) {
      const userFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: userTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      const userParts = userFormatter.formatToParts(candidateUtc)
      const getUserPart = (type: string) => parseInt(userParts.find((p) => p.type === type)?.value ?? "0", 10)

      const userYear = getUserPart("year")
      const userMonth = getUserPart("month") - 1
      const userDay = getUserPart("day")
      const userHour = getUserPart("hour")
      const userMinute = getUserPart("minute")
      const userSecond = getUserPart("second")

      if (
        userYear === year &&
        userMonth === month &&
        userDay === day &&
        userHour === hour &&
        userMinute === minute &&
        Math.abs(userSecond - second) <= 1
      ) {
        return candidateUtc.toISOString()
      }

      const desiredLocal = new Date(year, month, day, hour, minute, second)
      const actualLocal = new Date(userYear, userMonth, userDay, userHour, userMinute, userSecond)
      const diffMs = desiredLocal.getTime() - actualLocal.getTime()

      if (Math.abs(diffMs) < 1000) {
        return candidateUtc.toISOString()
      }

      candidateUtc = new Date(candidateUtc.getTime() + diffMs)
    }

    return candidateUtc.toISOString()
  } catch (error) {
    console.error("[email-campaign-runner] timezone conversion failed", error)
    return scheduledUtc
  }
}

async function fetchEmailTemplateTranslations(
  client: SupabaseClient,
  templateId: string | null,
): Promise<Map<string, EmailTranslation>> {
  const map = new Map<string, EmailTranslation>()
  if (!templateId) return map
  
  const { data, error } = await client
    .from("admin_email_template_translations")
    .select("language, subject, preview_text, body_html, body_json")
    .eq("template_id", templateId)
  
  if (error) {
    console.warn("[email-campaign-runner] failed to load email translations", error)
    return map
  }
  
  for (const row of data ?? []) {
    if (row?.language) {
      map.set(row.language, {
        language: row.language,
        subject: row.subject,
        preview_text: row.preview_text,
        body_html: row.body_html,
        body_json: row.body_json,
      })
    }
  }
  
  return map
}

async function fetchSentUserIds(client: SupabaseClient, campaignId: string): Promise<Set<string>> {
  const sent = new Set<string>()
  const { data, error } = await client
    .from("admin_campaign_sends")
    .select("user_id")
    .eq("campaign_id", campaignId)
  if (error) {
    console.warn("[email-campaign-runner] failed to load prior campaign sends", error)
    return sent
  }
  for (const row of data ?? []) {
    if (row?.user_id) {
      sent.add(row.user_id)
    }
  }
  return sent
}

async function recordCampaignSends(client: SupabaseClient, campaignId: string, recipients: Recipient[]) {
  if (!recipients.length) return
  const chunkSize = 500
  for (let i = 0; i < recipients.length; i += chunkSize) {
    const slice = recipients.slice(i, i + chunkSize)
    const timestamp = new Date().toISOString()
    const payload = slice.map((recipient) => ({
      campaign_id: campaignId,
      user_id: recipient.userId,
      sent_at: timestamp,
      status: "sent",
    }))
    const { error } = await client.from("admin_campaign_sends").insert(payload)
    if (error) throw error
  }
}

async function updateCampaignSchedule(
  client: SupabaseClient,
  campaignId: string,
  summary: CampaignSummary,
  nextScheduledFor: string,
) {
  // Sanitize summary to ensure it can be serialized
  let sanitizedSummary: Record<string, unknown> | null = null
  try {
    sanitizedSummary = JSON.parse(JSON.stringify(summary))
  } catch {
    console.warn("[email-campaign-runner] Could not serialize summary for schedule update")
  }

  const { error } = await client
    .from("admin_email_campaigns")
    .update({
      status: "scheduled",
      scheduled_for: nextScheduledFor,
      total_recipients: summary.totalRecipients,
      sent_count: summary.sentCount,
      failed_count: summary.failedCount,
      send_summary: sanitizedSummary,
      send_error: null,
      send_completed_at: null,
    })
    .eq("id", campaignId)
  if (error) {
    throw new Error(`Failed to update campaign schedule: ${error.message || JSON.stringify(error)}`)
  }
}

async function sendBatch(
  campaign: CampaignRow,
  recipients: Recipient[],
  batchIndex: number,
  translations: Map<string, EmailTranslation>,
): Promise<{ index: number; size: number; status: "sent" | "failed"; error?: string }> {
  if (!recipients.length) {
    return { index: batchIndex, size: 0, status: "sent" }
  }

  const payload = recipients.map((recipient) => {
    const userRaw = recipient.displayName
    const userCap = userRaw.charAt(0).toUpperCase() + userRaw.slice(1).toLowerCase()
    
    // Generate random 10-character string (uppercase, lowercase, numbers)
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    let randomStr = ""
    for (let i = 0; i < 10; i++) {
      randomStr += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    
    const websiteUrl = Deno.env.get("WEBSITE_URL") ?? "https://aphylia.app"
    
    // Variables available for replacement in email templates
    const context: Record<string, string> = { 
      user: userCap,                                    // User's display name (capitalized)
      email: recipient.email,                           // User's email address
      random: randomStr,                                // 10 random characters (unique per email)
      url: websiteUrl.replace(/^https?:\/\//, ""),      // Website URL without protocol (e.g., "aphylia.app")
      code: "XXXXXX"                                    // Placeholder for campaign emails (real codes are for transactional emails)
    }
    
    // Get user's language and find appropriate translation
    const userLang = recipient.language as SupportedLanguage
    const translation = translations.get(userLang)
    
    // Debug: log language matching (only for first few recipients per batch to avoid spam)
    if (batchIndex === 0 && recipients.indexOf(recipient) < 3) {
      console.log(`[email-campaign-runner] Recipient ${recipient.email}: lang=${userLang}, translation_found=${!!translation}`)
    }
    
    // Use translated content if available, otherwise fall back to default campaign content
    const rawSubject = translation?.subject || campaign.subject
    const rawBodyHtml = translation?.body_html || campaign.body_html
    
    const bodyHtmlRaw = renderTemplate(rawBodyHtml, context)
    const subject = renderTemplate(rawSubject, context)
    // Sanitize the body HTML to fix email-incompatible CSS (gradients, flexbox, shadows, etc.)
    const bodyHtml = sanitizeHtmlForEmail(bodyHtmlRaw)
    // Wrap the body HTML with our beautiful styled email template (with localized wrapper)
    const html = wrapEmailHtml(bodyHtml, subject, userLang)
    const text = stripHtml(bodyHtml || rawBodyHtml)

    const base: Record<string, unknown> = {
      from: fromEmail,
      to: recipient.email,
      subject,
      html,
      text,
      headers: {
        "X-Campaign-Id": campaign.id,
        ...(campaign.template_id ? { "X-Template-Id": campaign.template_id } : {}),
      },
      tags: [
        { name: "campaign_id", value: campaign.id },
        ...(campaign.template_id ? [{ name: "template_id", value: campaign.template_id }] : []),
      ],
    }
    if (replyToEmail) {
      base.reply_to = replyToEmail
    }
    return base
  })

  try {
    const response = await fetch(RESEND_BATCH_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const detail = await safeParseJson(await response.text())
      const errorMessage = typeof detail === "object" && detail !== null
        ? JSON.stringify(detail)
        : `Resend responded with ${response.status}`
      console.error("[email-campaign-runner] batch failed", errorMessage)
      return {
        index: batchIndex,
        size: recipients.length,
        status: "failed",
        error: errorMessage,
      }
    }

    return {
      index: batchIndex,
      size: recipients.length,
      status: "sent",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[email-campaign-runner] batch exception", message)
    return {
      index: batchIndex,
      size: recipients.length,
      status: "failed",
      error: message,
    }
  }
}

async function finalizeCampaign(
  client: SupabaseClient,
  campaignId: string,
  payload: Record<string, unknown>,
) {
  // Remove potentially circular or non-serializable data from send_summary
  if (payload.send_summary && typeof payload.send_summary === 'object') {
    try {
      // Ensure send_summary can be serialized to JSON
      payload.send_summary = JSON.parse(JSON.stringify(payload.send_summary))
    } catch (_e) {
      console.warn("[email-campaign-runner] Could not serialize send_summary, removing it")
      delete payload.send_summary
    }
  }

  const { error } = await client
    .from("admin_email_campaigns")
    .update(payload)
    .eq("id", campaignId)
  
  if (error) {
    console.error("[email-campaign-runner] failed to finalize campaign", campaignId, JSON.stringify(error))
    // Throw so the caller knows finalization failed
    throw new Error(`Failed to finalize campaign: ${error.message || JSON.stringify(error)}`)
  }
  
  console.log(`[email-campaign-runner] Campaign ${campaignId} finalized with status: ${payload.status}`)
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

/**
 * Helper to safely decode images array from a base64/JSON data attribute
 */
function decodeImagesAttr(encoded: string | null): Array<{src: string, alt?: string, focalX?: number, focalY?: number}> {
  if (!encoded) return []
  
  try {
    // First try base64 decoding (new format)
    try {
      const json = decodeURIComponent(atob(encoded))
      return JSON.parse(json)
    } catch {
      // If base64 fails, try direct JSON parse (old format compatibility)
    }
    // Fallback: try direct JSON parse for backward compatibility
    return JSON.parse(encoded)
  } catch {
    return []
  }
}

/**
 * Converts resizable image divs to email-compatible table-based HTML
 * For better alignment support across email clients
 */
function convertResizableImageToEmailHtml(html: string): string {
  console.log('[email-campaign-runner] convertResizableImageToEmailHtml called')
  
  // Simple pattern to match resizable-image divs
  const imagePattern = /<div[^>]*data-type="resizable-image"[^>]*>[\s\S]*?<\/div>/gi
  
  return html.replace(imagePattern, (match) => {
    console.log(`[email-campaign-runner] Found resizable-image: ${match.substring(0, 80)}...`)
    
    // Extract attributes
    const alignMatch = match.match(/data-align="([^"]*)"/)
    const widthMatch = match.match(/data-width="([^"]*)"/)
    
    const align = alignMatch ? alignMatch[1] : 'center'
    const width = widthMatch ? widthMatch[1] : '100%'
    
    // Extract img src
    const srcMatch = match.match(/src="([^"]*)"/)
    const altMatch = match.match(/alt="([^"]*)"/)
    
    if (!srcMatch) {
      console.log('[email-campaign-runner] No src found, returning original')
      return match
    }
    
    const src = srcMatch[1]
    const alt = altMatch ? altMatch[1] : ''
    
    // Calculate pixel width (assuming 540px container)
    const widthPercent = width.endsWith('%') ? parseInt(width) : 100
    const pixelWidth = Math.floor(540 * (widthPercent / 100))
    
    console.log(`[email-campaign-runner] Converting image: ${align}, ${width}, ${pixelWidth}px`)
    
    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;"><tr><td align="${align}"><img src="${src}" alt="${alt}" width="${pixelWidth}" style="display:block;max-width:100%;border-radius:16px;"></td></tr></table>`
  })
}

/**
 * Finds the matching closing div tag for a div starting at the given position
 * Handles nested divs correctly by counting depth
 */
function findMatchingDivClose(html: string, startPos: number): number {
  let depth = 0
  let pos = startPos
  
  while (pos < html.length) {
    const openMatch = html.slice(pos).match(/^<div\b/i)
    const closeMatch = html.slice(pos).match(/^<\/div>/i)
    
    if (openMatch) {
      depth++
      pos += openMatch[0].length
    } else if (closeMatch) {
      depth--
      if (depth === 0) {
        return pos + closeMatch[0].length
      }
      pos += closeMatch[0].length
    } else {
      pos++
    }
  }
  
  return -1 // Not found
}

/**
 * Converts image grid divs to email-compatible table-based HTML
 * CSS Grid doesn't work in most email clients, so we use tables instead
 */
function convertImageGridToEmailTable(html: string): string {
  console.log('[email-campaign-runner] convertImageGridToEmailTable called')
  
  // Simple approach: find data-type="image-grid" and extract data-images
  // Then replace the entire block (outer div + inner div + content)
  
  // Match pattern: <div...data-type="image-grid"...>...<div...>...</div></div>
  // Use a greedy match to find the full block
  const gridPattern = /(<div[^>]*data-type="image-grid"[^>]*>)([\s\S]*?)(<\/div>\s*<\/div>)/gi
  
  let result = html
  let match
  
  // Reset lastIndex for global regex
  gridPattern.lastIndex = 0
  
  while ((match = gridPattern.exec(html)) !== null) {
    const fullMatch = match[0]
    const openTag = match[1]
    
    console.log(`[email-campaign-runner] Found image-grid block: ${fullMatch.substring(0, 100)}...`)
    
    // Extract attributes from opening tag
    const columnsMatch = openTag.match(/data-columns="(\d)"/)
    const gapMatch = openTag.match(/data-gap="([^"]*)"/)
    const roundedMatch = openTag.match(/data-rounded="([^"]*)"/)
    const imagesMatch = openTag.match(/data-images="([^"]*)"/)
    const widthMatch = openTag.match(/data-width="([^"]*)"/)
    const alignMatch = openTag.match(/data-align="([^"]*)"/)
    
    const numCols = columnsMatch ? parseInt(columnsMatch[1], 10) : 2
    const gap = gapMatch ? gapMatch[1] : 'md'
    const isRounded = !roundedMatch || roundedMatch[1] !== "false"
    const gridWidth = widthMatch ? widthMatch[1] : '100%'
    const align = alignMatch ? alignMatch[1] : 'center'
    
    // Decode images from data-images attribute
    let images: Array<{src: string, alt?: string}> = []
    if (imagesMatch && imagesMatch[1]) {
      images = decodeImagesAttr(imagesMatch[1])
      console.log(`[email-campaign-runner] Decoded ${images.length} images from data-images`)
    }
    
    // Fallback: extract from img tags
    if (!images.length) {
      const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi
      let imgMatch
      while ((imgMatch = imgRegex.exec(fullMatch)) !== null) {
        const altMatch = imgMatch[0].match(/alt="([^"]*)"/)
        images.push({ src: imgMatch[1], alt: altMatch ? altMatch[1] : '' })
      }
      console.log(`[email-campaign-runner] Extracted ${images.length} images from img tags`)
    }
    
    if (!images.length) {
      console.log('[email-campaign-runner] No images found, skipping')
      continue
    }
    
    // Build table
    const gapMap: Record<string, number> = { none: 0, sm: 8, md: 16, lg: 24 }
    const gapPx = gapMap[gap] || 16
    const borderRadius = isRounded ? 'border-radius:16px;' : ''
    
    const containerWidth = 540
    const widthPercent = gridWidth.endsWith('%') ? parseInt(gridWidth) : 100
    const tableWidth = Math.floor(containerWidth * (widthPercent / 100))
    const cellWidth = Math.floor(tableWidth / numCols) - gapPx
    
    console.log(`[email-campaign-runner] Building ${numCols}-col table, ${tableWidth}px wide, cells ${cellWidth}px`)
    
    // Build rows
    const rows: string[] = []
    for (let i = 0; i < images.length; i += numCols) {
      const rowImages = images.slice(i, i + numCols)
      const cells = rowImages.map(img => 
        `<td style="padding:${gapPx/2}px;"><img src="${img.src}" alt="${img.alt || ''}" width="${cellWidth}" style="display:block;${borderRadius}"></td>`
      ).join('')
      
      const emptyCells = numCols - rowImages.length
      const emptyHtml = emptyCells > 0 ? `<td style="padding:${gapPx/2}px;"></td>`.repeat(emptyCells) : ''
      
      rows.push(`<tr>${cells}${emptyHtml}</tr>`)
    }
    
    const replacement = `<table width="${tableWidth}" align="${align}" cellpadding="0" cellspacing="0" border="0" style="margin:16px auto;"><tbody>${rows.join('')}</tbody></table>`
    
    console.log(`[email-campaign-runner] Replacing grid with table`)
    result = result.replace(fullMatch, replacement)
  }
  
  return result
}

/**
 * Sanitizes HTML content to make it email-client compatible
 * Replaces CSS properties that email clients don't support with compatible alternatives
 */
function sanitizeHtmlForEmail(html: string): string {
  if (!html) return html
  
  let result = html
  
  // 0a. Convert resizable images to email-compatible tables
  result = convertResizableImageToEmailHtml(result)
  
  // 0b. Convert image grids to email-compatible tables (must be done early before other transformations)
  result = convertImageGridToEmailTable(result)
  
  // 1. Replace CSS variables with hardcoded colors (Gmail doesn't support var())
  const cssVarMap: Record<string, string> = {
    "--tt-color-highlight-yellow": "#fef08a",
    "--tt-color-highlight-red": "#fecaca",
    "--tt-color-highlight-green": "#bbf7d0",
    "--tt-color-highlight-blue": "#bfdbfe",
    "--tt-color-highlight-purple": "#e9d5ff",
    "--tt-color-highlight-pink": "#fbcfe8",
    "--tt-color-highlight-orange": "#fed7aa",
  }
  // Replace var(--variable-name) with actual color
  result = result.replace(/var\(\s*(--tt-color-[a-zA-Z-]+)\s*\)/gi, (_match, varName) => {
    return cssVarMap[varName] || "#fef08a" // Default to yellow
  })
  
  // 2. Replace linear-gradient backgrounds with solid colors
  // Match the full gradient including nested parentheses for rgb/rgba
  result = result.replace(/background:\s*linear-gradient\s*\([^;"}]*\)\s*;?/gi, (match) => {
    // Try to extract a hex color first
    const hexMatch = match.match(/#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3}/)
    if (hexMatch) {
      return `background-color: ${hexMatch[0]};`
    }
    // Try to extract rgb color
    const rgbMatch = match.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
    if (rgbMatch) {
      const toHex = (n: string) => {
        const hex = parseInt(n).toString(16)
        return hex.length === 1 ? "0" + hex : hex
      }
      return `background-color: #${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])};`
    }
    return "background-color: #ffffff;"
  })
  
  // 3. Remove box-shadow properties entirely (not supported in most email clients)
  result = result.replace(/box-shadow:\s*[^;"}]+;?/gi, "")
  
  // 4. Replace rgba() colors with solid hex (in all contexts, not just background)
  result = result.replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)/gi, (_match, r, g, b) => {
    const toHex = (n: string) => {
      const hex = parseInt(n).toString(16)
      return hex.length === 1 ? "0" + hex : hex
    }
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  })
  
  // 5. Replace display: flex with text-align: center for centering
  result = result.replace(/display:\s*flex\s*;\s*flex-direction:\s*column\s*;\s*align-items:\s*center\s*;?/gi, "text-align: center;")
  result = result.replace(/display:\s*flex\s*;\s*align-items:\s*center\s*;\s*justify-content:\s*center\s*;?/gi, "text-align: center;")
  result = result.replace(/display:\s*flex\s*;\s*align-items:\s*center\s*;/gi, "")
  
  // 6. Remove transition properties (not supported in email)
  result = result.replace(/transition:\s*[^;"}]+;?/gi, "")
  
  // 7. Remove gap property (not supported in email) - but NOT for our new table-based image grids
  result = result.replace(/(?<!table[^>]*style="[^"]*)gap:\s*[^;"}]+;?/gi, "")
  
  // 8. Replace display: grid/inline-grid with nothing (we've already converted grids to tables)
  result = result.replace(/display:\s*(?:inline-)?grid\s*;?/gi, "")
  result = result.replace(/grid-template-columns:\s*[^;"}]+;?/gi, "")
  
  // 8b. Remove aspect-ratio (not supported in email clients)
  result = result.replace(/aspect-ratio:\s*[^;"}]+;?/gi, "")
  
  // 8c. Remove object-fit and object-position (not supported in email clients)
  result = result.replace(/object-fit:\s*[^;"}]+;?/gi, "")
  result = result.replace(/object-position:\s*[^;"}]+;?/gi, "")
  
  // 9. Clean up any double semicolons or empty style artifacts
  result = result.replace(/;\s*;/g, ";")
  result = result.replace(/style="\s*;/g, 'style="')
  result = result.replace(/;\s*"/g, '"')
  
  // 10. Replace SVG logo URLs with PNG for Gmail compatibility (Gmail doesn't support SVG)
  const SVG_LOGO_URL = "https://media.aphylia.app/UTILITY/admin/uploads/svg/plant-swipe-icon.svg"
  const PNG_LOGO_URL = "https://media.aphylia.app/UTILITY/admin/uploads/png/icon-500_transparent_white.png"
  result = result.replace(new RegExp(SVG_LOGO_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), PNG_LOGO_URL)
  
  // 11. Remove the old SVG filter workaround (filter:brightness(0) invert(1))
  // This was used to make SVGs white, but PNG is already white
  result = result.replace(/filter:\s*brightness\(0\)\s*invert\(1\);?/g, "")
  
  // 12. Fix escaped styled-divider HTML (TipTap escapes the inner HTML)
  // These patterns match common escaped divider content
  const escapedDividerReplacements = [
    // Solid emerald divider
    {
      pattern: /&lt;div style="height: 2px; background: #059669; opacity: 0\.3; border-radius: 1px"&gt;&lt;\/div&gt;/g,
      replacement: '<div style="height: 2px; background: #059669; opacity: 0.3; border-radius: 1px;"></div>'
    },
    // Gradient emerald divider  
    {
      pattern: /&lt;div style="height: 3px; background-color: #059669; border-radius: 2px"&gt;&lt;\/div&gt;/g,
      replacement: '<div style="height: 3px; background-color: #059669; border-radius: 2px;"></div>'
    },
    // Generic escaped divs within styled-divider containers
    {
      pattern: /&lt;div\s+style="([^"]*)"&gt;&lt;\/div&gt;/g,
      replacement: '<div style="$1"></div>'
    }
  ]
  
  for (const { pattern, replacement } of escapedDividerReplacements) {
    result = result.replace(pattern, replacement)
  }
  
  return result
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  })
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

function safeParseJson(input: string): unknown {
  try {
    return JSON.parse(input)
  } catch {
    return input
  }
}

function formatFromAddress(raw: string, defaultName = "Aphylia"): string {
  if (!raw) return DEFAULT_FROM_EMAIL
  if (raw.includes("<")) return raw
  return `${defaultName} <${raw}>`
}

/**
 * Wraps email body content with a beautiful styled template
 * Matches the Aphylia website aesthetic with gradients and rounded corners
 * @param bodyHtml - The email body content
 * @param subject - The email subject line
 * @param language - The user's preferred language for localized wrapper strings
 */
function wrapEmailHtml(bodyHtml: string, subject: string, language: SupportedLanguage = DEFAULT_LANGUAGE): string {
  const currentYear = new Date().getFullYear()
  const websiteUrl = Deno.env.get("WEBSITE_URL") ?? "https://aphylia.app"
  
  // Get localized strings for the wrapper (fallback to English if language not found)
  const strings = EMAIL_WRAPPER_STRINGS[language] || EMAIL_WRAPPER_STRINGS[DEFAULT_LANGUAGE]
  const copyrightText = strings.copyright.replace("{{year}}", String(currentYear))

  // Aphylia logo URL for emails (using PNG for Gmail compatibility - Gmail doesn't support SVG or WebP)
  const logoUrl = "https://media.aphylia.app/UTILITY/admin/uploads/png/icon-500_transparent_white.png"
  const logoImg = `<img src="${logoUrl}" alt="Aphylia" width="32" height="32" style="display:block;border:0;outline:none;text-decoration:none;" />`
  const logoImgLarge = `<img src="${logoUrl}" alt="Aphylia" width="40" height="40" style="display:block;border:0;outline:none;text-decoration:none;" />`

  return `<!DOCTYPE html>
<html lang="${language}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${subject || 'Aphylia'}</title>
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@600;700&display=swap" rel="stylesheet">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style>
    table, td, div, p, a { font-family: Arial, sans-serif; }
  </style>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; max-width: 100%; }
    
    /* Base */
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background: linear-gradient(180deg, #ecfdf5 0%, #ffffff 30%, #ffffff 70%, #fef3c7 100%); min-height: 100vh; }
    
    /* Typography */
    h1 { font-size: 32px; font-weight: 700; color: #111827; margin: 0 0 20px 0; line-height: 1.2; letter-spacing: -0.5px; }
    h2 { font-size: 26px; font-weight: 700; color: #1f2937; margin: 32px 0 16px 0; line-height: 1.3; }
    h3 { font-size: 22px; font-weight: 600; color: #374151; margin: 28px 0 12px 0; line-height: 1.4; }
    h4 { font-size: 18px; font-weight: 600; color: #4b5563; margin: 24px 0 10px 0; }
    p { margin: 0 0 16px 0; line-height: 1.75; color: #374151; }
    
    /* Links */
    a { color: #059669; text-decoration: underline; text-underline-offset: 2px; font-weight: 500; }
    a:hover { color: #047857; }
    
    /* Code */
    code { background: #f3f4f6; color: #dc2626; padding: 3px 8px; border-radius: 6px; font-family: 'SF Mono', Monaco, monospace; font-size: 0.9em; }
    pre { background: linear-gradient(135deg, #1f2937 0%, #111827 100%); color: #e5e7eb; padding: 20px 24px; border-radius: 16px; overflow-x: auto; font-family: 'SF Mono', Monaco, monospace; font-size: 14px; line-height: 1.6; margin: 20px 0; }
    pre code { background: transparent; color: #e5e7eb; padding: 0; border-radius: 0; }
    
    /* Highlight */
    mark { background: linear-gradient(135deg, #fef08a 0%, #fde047 100%); color: #713f12; padding: 2px 6px; border-radius: 4px; }
    
    /* Blockquote */
    blockquote { border-left: 4px solid #10b981; background: rgba(16, 185, 129, 0.08); margin: 20px 0; padding: 16px 24px; border-radius: 0 12px 12px 0; font-style: italic; color: #374151; }
    
    /* Lists */
    ul, ol { margin: 16px 0; padding-left: 28px; }
    li { margin: 8px 0; color: #374151; }
    
    /* Horizontal Rule */
    hr { border: none; height: 2px; background: linear-gradient(90deg, transparent 0%, #10b981 50%, transparent 100%); margin: 32px 0; }
    
    /* Strong/Bold */
    strong, b { font-weight: 600; color: #111827; }
    
    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      body { background: linear-gradient(180deg, #0b1220 0%, #0a0f1a 30%, #0a0f1a 70%, #0f0f0f 100%) !important; }
      .email-wrapper { background: linear-gradient(180deg, #0b1220 0%, #0a0f1a 30%, #0a0f1a 70%, #0f0f0f 100%) !important; }
      .email-container { background: linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(24, 24, 27, 0.98) 50%, rgba(251, 191, 36, 0.03) 100%) !important; border-color: rgba(63, 63, 70, 0.5) !important; }
      .email-body { color: #f4f4f5 !important; }
      .email-body p, .email-body li, .email-body span, .email-body td { color: #e4e4e7 !important; }
      .email-body h1, .email-body h2, .email-body h3, .email-body h4 { color: #ffffff !important; }
      .email-body a { color: #34d399 !important; }
      .email-body code { background: #374151 !important; color: #fca5a5 !important; }
      .email-body mark { background: #854d0e !important; color: #fef08a !important; }
      .signature-section { background: rgba(16, 185, 129, 0.08) !important; border-color: rgba(16, 185, 129, 0.15) !important; }
      .footer-section { border-color: rgba(63, 63, 70, 0.3) !important; }
      .footer-section p { color: #71717a !important; }
    }
    
    /* Responsive */
    @media screen and (max-width: 640px) {
      .email-container { width: 100% !important; margin: 0 !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
      .email-body { padding: 32px 24px !important; }
      .signature-section { margin: 24px !important; padding: 24px !important; }
      .footer-section { padding: 24px !important; }
      h1 { font-size: 26px !important; }
      h2 { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:linear-gradient(180deg, #ecfdf5 0%, #ffffff 30%, #ffffff 70%, #fef3c7 100%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  <table role="presentation" class="email-wrapper" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg, #ecfdf5 0%, #ffffff 30%, #ffffff 70%, #fef3c7 100%);margin:0;padding:0;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 20px;">
        <table role="presentation" class="email-container" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:linear-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(255, 255, 255, 0.99) 50%, rgba(251, 191, 36, 0.03) 100%);border-radius:32px;border:1px solid rgba(16, 185, 129, 0.12);box-shadow:0 32px 64px -16px rgba(16, 185, 129, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;overflow:hidden;">
          <tr>
            <td class="email-header" style="background:linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%);padding:32px 48px;text-align:center;">
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
              <table role="presentation" class="signature-section" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border-radius:20px;border:1px solid rgba(16, 185, 129, 0.1);overflow:hidden;">
                <tr>
                  <td style="padding:28px 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="72" style="vertical-align:middle;padding-right:20px;">
                          <!-- Logo in green square - using table for centering -->
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:#10b981;border-radius:16px;width:56px;height:56px;">
                            <tr>
                              <td align="center" valign="middle" style="width:56px;height:56px;">
                                ${logoImgLarge}
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0 0 4px 0;font-size:18px;font-weight:700;color:#111827;letter-spacing:-0.3px;">
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
            <td class="footer-section" style="padding:32px 48px;text-align:center;border-top:1px solid rgba(16, 185, 129, 0.08);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;">
                      <tr>
                        <td>
                          <a href="${websiteUrl}" style="display:inline-block;background:linear-gradient(135deg, #059669 0%, #10b981 100%);color:#ffffff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:50px;text-decoration:none;box-shadow:0 8px 24px -6px rgba(16, 185, 129, 0.4);">
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
