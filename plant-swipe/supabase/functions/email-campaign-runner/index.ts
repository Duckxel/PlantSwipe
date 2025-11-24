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
}

type Recipient = {
  userId: string
  email: string
  displayName: string
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

const DEFAULT_FROM_EMAIL = "Plant Swipe <support@aphylia.app>"
const fromEmail = formatFromAddress(
  Deno.env.get("EMAIL_CAMPAIGN_FROM") ?? Deno.env.get("RESEND_FROM") ?? DEFAULT_FROM_EMAIL,
)
const replyToEmail = Deno.env.get("EMAIL_CAMPAIGN_REPLY_TO") ?? Deno.env.get("RESEND_REPLY_TO") ?? undefined

const DEFAULT_BATCH_SIZE = clamp(Number(Deno.env.get("EMAIL_CAMPAIGN_BATCH_SIZE") ?? "40") || 40, 1, 100)
const MAX_RECIPIENT_LIMIT = 5000

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

  const nowIso = new Date().toISOString()
  const { data, error } = await client
    .from("admin_email_campaigns")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_for", nowIso)
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
  }

  try {
    const recipients = await collectRecipients(client, options.recipientLimit)
    summary.totalRecipients = recipients.length

    if (!recipients.length) {
      summary.status = "failed"
      summary.reason = "No recipients with confirmed email"
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

    const batches = chunkRecipients(recipients, options.batchSize)
    let aborted = false
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchResult = await sendBatch(claimed, batch, i)
      summary.batches.push(batchResult)
      if (batchResult.status === "sent") {
        summary.sentCount += batchResult.size
      } else {
        summary.reason = batchResult.error
        aborted = true
        break
      }
    }

    summary.failedCount = aborted ? Math.max(0, summary.totalRecipients - summary.sentCount) : 0
    summary.status =
      summary.failedCount === 0
        ? "sent"
        : summary.sentCount > 0
          ? "partial"
          : "failed"
    summary.durationMs = Date.now() - startedAt.getTime()

    await finalizeCampaign(client, campaign.id, {
      status: summary.status,
      send_completed_at: new Date().toISOString(),
      send_error: summary.reason,
      total_recipients: summary.totalRecipients,
      sent_count: summary.sentCount,
      failed_count: summary.failedCount,
      send_summary: summary,
    })

    if (campaign.template_id && summary.sentCount > 0) {
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

    await finalizeCampaign(client, campaign.id, {
      status: "failed",
      send_completed_at: new Date().toISOString(),
      send_error: summary.reason,
      total_recipients: summary.totalRecipients,
      sent_count: summary.sentCount,
      failed_count: summary.failedCount || summary.totalRecipients,
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
    const profileNames = await fetchDisplayNames(client, ids)

    for (const user of users) {
      if (!user.email) continue
      const confirmed = Boolean(user.email_confirmed_at || user.confirmed_at)
      if (!confirmed) continue

      const displayName =
        profileNames.get(user.id) ||
        (typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : null) ||
        user.email.split("@")[0] ||
        `Friend ${user.id.slice(0, 8)}`

      recipients.push({
        userId: user.id,
        email: user.email,
        displayName,
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

async function fetchDisplayNames(client: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!ids.length) return map
  const { data, error } = await client
    .from("profiles")
    .select("id, display_name")
    .in("id", ids)
  if (error) {
    console.warn("[email-campaign-runner] failed to load profile names", error)
    return map
  }
  for (const row of data ?? []) {
    if (row?.id && typeof row.display_name === "string") {
      map.set(row.id, row.display_name)
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

async function sendBatch(
  campaign: CampaignRow,
  recipients: Recipient[],
  batchIndex: number,
): Promise<{ index: number; size: number; status: "sent" | "failed"; error?: string }> {
  if (!recipients.length) {
    return { index: batchIndex, size: 0, status: "sent" }
  }

  const payload = recipients.map((recipient) => {
    const context = { user: recipient.displayName }
    const html = renderTemplate(campaign.body_html, context)
    const subject = renderTemplate(campaign.subject, context)
    const text = stripHtml(html || campaign.body_html)

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
