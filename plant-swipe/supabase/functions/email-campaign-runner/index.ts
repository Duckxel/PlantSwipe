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
}

type Recipient = {
  userId: string
  email: string
  displayName: string
  timezone: string | null
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

const DEFAULT_FROM_EMAIL = "Plant Swipe <info@aphylia.app>"
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
    const recipients = await collectRecipients(client, options.recipientLimit)
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

    let remainingBudget =
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
      const batchResult = await sendBatch(claimed, batch, i)
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

    if (successfulRecipients.length) {
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
    summary.status = "failed"
    summary.reason = error instanceof Error ? error.message : String(error)
    summary.durationMs = Date.now() - startedAt.getTime()
    const failureCount =
      summary.totalRecipients > 0
        ? Math.max(summary.totalRecipients - summary.sentCount, summary.failedCount)
        : summary.failedCount
    summary.failedCount = failureCount

    await finalizeCampaign(client, campaign.id, {
      status: "failed",
      send_completed_at: new Date().toISOString(),
      send_error: summary.reason,
      total_recipients: summary.totalRecipients,
      sent_count: summary.sentCount,
      failed_count: failureCount,
      send_summary: summary,
    })

    console.error("[email-campaign-runner] campaign failed", campaign.id, error)
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

      recipients.push({
        userId: user.id,
        email: user.email,
        displayName,
        timezone,
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
}

async function fetchProfileMeta(client: SupabaseClient, ids: string[]): Promise<Map<string, ProfileMeta>> {
  const map = new Map<string, ProfileMeta>()
  if (!ids.length) return map
  const { data, error } = await client
    .from("profiles")
    .select("id, display_name, timezone")
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
  const { error } = await client
    .from("admin_email_campaigns")
    .update({
      status: "scheduled",
      scheduled_for: nextScheduledFor,
      total_recipients: summary.totalRecipients,
      sent_count: summary.sentCount,
      failed_count: summary.failedCount,
      send_summary: summary,
      send_error: null,
      send_completed_at: null,
    })
    .eq("id", campaignId)
  if (error) {
    throw error
  }
}

async function sendBatch(
  campaign: CampaignRow,
  recipients: Recipient[],
  batchIndex: number,
): Promise<{ index: number; size: number; status: "sent" | "failed"; error?: string }> {
  if (!recipients.length) {
    return { index: batchIndex, size: 0, status: "sent" }
  }

  const payload = recipients.map((recipient) => {
    const userRaw = recipient.displayName
    const userCap = userRaw.charAt(0).toUpperCase() + userRaw.slice(1).toLowerCase()
    const context = { user: userCap }
    const bodyHtml = renderTemplate(campaign.body_html, context)
    const subject = renderTemplate(campaign.subject, context)
    // Wrap the body HTML with our beautiful styled email template
    const html = wrapEmailHtml(bodyHtml, subject)
    const text = stripHtml(bodyHtml || campaign.body_html)

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
  const { error } = await client
    .from("admin_email_campaigns")
    .update(payload)
    .eq("id", campaignId)
  if (error) {
    console.error("[email-campaign-runner] failed to finalize campaign", campaignId, error)
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

function formatFromAddress(raw: string, defaultName = "Plant Swipe"): string {
  if (!raw) return DEFAULT_FROM_EMAIL
  if (raw.includes("<")) return raw
  return `${defaultName} <${raw}>`
}

/**
 * Wraps email body content with a beautiful styled template
 * Matches the Aphylia website aesthetic with gradients and rounded corners
 */
function wrapEmailHtml(bodyHtml: string, subject: string): string {
  const currentYear = new Date().getFullYear()
  const websiteUrl = Deno.env.get("WEBSITE_URL") ?? "https://aphylia.app"

  // Simplified Aphylia logo as inline SVG for emails
  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="32" height="32"><path fill="#ffffff" d="M50 5c-2.5 8-8 15-15 20 5 3 8 10 8 18 0 12-8 22-18 25 3 5 10 12 20 17 10-5 17-12 20-17-10-3-18-13-18-25 0-8 3-15 8-18-7-5-12.5-12-15-20z"/><circle cx="35" cy="58" r="5" fill="#ffffff"/><circle cx="65" cy="58" r="5" fill="#ffffff"/></svg>`

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${subject || 'Aphylia'}</title>
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
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background: linear-gradient(180deg, #ecfdf5 0%, #ffffff 30%, #ffffff 70%, #fef3c7 100%); min-height: 100vh; }
    a { color: #059669; text-decoration: none; }
    a:hover { color: #047857; }
    h1, h2, h3, h4 { color: #111827; margin: 0 0 16px 0; font-weight: 700; line-height: 1.3; }
    p { margin: 0 0 16px 0; line-height: 1.7; }
    @media (prefers-color-scheme: dark) {
      body { background: linear-gradient(180deg, #0b1220 0%, #0a0f1a 30%, #0a0f1a 70%, #0f0f0f 100%) !important; }
      .email-wrapper { background: linear-gradient(180deg, #0b1220 0%, #0a0f1a 30%, #0a0f1a 70%, #0f0f0f 100%) !important; }
      .email-container { background: linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(24, 24, 27, 0.98) 50%, rgba(251, 191, 36, 0.03) 100%) !important; border-color: rgba(63, 63, 70, 0.5) !important; }
      .email-body { color: #f4f4f5 !important; }
      .email-body p, .email-body li, .email-body span, .email-body td { color: #e4e4e7 !important; }
      .email-body h1, .email-body h2, .email-body h3, .email-body h4 { color: #ffffff !important; }
      .signature-section { background: rgba(16, 185, 129, 0.08) !important; border-color: rgba(16, 185, 129, 0.15) !important; }
      .footer-section { border-color: rgba(63, 63, 70, 0.3) !important; }
      .footer-section p { color: #71717a !important; }
    }
    @media screen and (max-width: 640px) {
      .email-container { width: 100% !important; margin: 0 !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
      .email-body { padding: 32px 24px !important; }
      .signature-section { margin: 24px !important; padding: 24px !important; }
      .footer-section { padding: 24px !important; }
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
                            ${logoSvg}
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
              <table role="presentation" class="signature-section" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0.02) 100%);border-radius:20px;border:1px solid rgba(16, 185, 129, 0.1);overflow:hidden;">
                <tr>
                  <td style="padding:28px 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="64" style="vertical-align:top;padding-right:20px;">
                          <div style="width:56px;height:56px;background:linear-gradient(135deg, #059669 0%, #10b981 100%);border-radius:16px;text-align:center;line-height:56px;">
                            ${logoSvg}
                          </div>
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0 0 4px 0;font-size:18px;font-weight:700;color:#111827;letter-spacing:-0.3px;">
                            The Aphylia Team
                          </p>
                          <p style="margin:0;font-size:14px;color:#6b7280;">
                            Helping you grow your plant knowledge 🌱
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
                            Explore Aphylia →
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 12px 0;font-size:13px;color:#9ca3af;">
                      <a href="${websiteUrl}" style="color:#059669;text-decoration:none;font-weight:500;">aphylia.app</a>
                      <span style="color:#d1d5db;margin:0 8px;">•</span>
                      <a href="${websiteUrl}/about" style="color:#9ca3af;text-decoration:none;">About</a>
                      <span style="color:#d1d5db;margin:0 8px;">•</span>
                      <a href="${websiteUrl}/contact" style="color:#9ca3af;text-decoration:none;">Contact</a>
                    </p>
                    <p style="margin:0;font-size:12px;color:#d1d5db;">
                      © ${currentYear} Aphylia. Made with 💚 for plant enthusiasts everywhere.
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
