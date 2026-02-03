import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts"
import { wrapAdminEmailHtmlShared } from "../_shared/emailTemplateShared.ts"

const DEFAULT_SUPPORT_EMAIL = "support@aphylia.app"
const DEFAULT_BUSINESS_EMAIL = "contact@aphylia.app"
const RESEND_ENDPOINT = "https://api.resend.com/emails"

const parseEmailList = (raw: string | undefined, fallback: string): string[] => {
  if (!raw) return [fallback]
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .slice(0, 10) // keep payloads bounded
}

const SUPPORT_EMAILS = parseEmailList(
  getFirstEnv("CONTACT_SUPPORT_EMAIL", "SUPPORT_EMAIL_TO", "SUPPORT_EMAIL"),
  DEFAULT_SUPPORT_EMAIL,
)
const BUSINESS_EMAILS = parseEmailList(
  getFirstEnv("CONTACT_BUSINESS_EMAIL", "BUSINESS_EMAIL_TO", "BUSINESS_EMAIL", "CONTACT_EMAIL_TO"),
  DEFAULT_BUSINESS_EMAIL,
)
const BUG_EMAILS = ["dev@aphylia.app"]

const RECIPIENT_EMAILS = {
  support: SUPPORT_EMAILS,
  business: BUSINESS_EMAILS,
  bug: BUG_EMAILS,
} as const
type Audience = keyof typeof RECIPIENT_EMAILS

const DEFAULT_FROM_EMAIL = "form@aphylia.app"
const SUPPORT_FROM_EMAIL =
  getFirstEnv("RESEND_FROM", "SMTP_FROM", "SUPABASE_SMTP_SENDER") ?? DEFAULT_FROM_EMAIL
const BUSINESS_FROM_EMAIL =
  getFirstEnv("RESEND_BUSINESS_FROM", "BUSINESS_SMTP_FROM") ?? SUPPORT_FROM_EMAIL

const SUPPORT_FROM_NAME =
  getFirstEnv("RESEND_FROM_NAME", "SMTP_FROM_NAME") ?? "Aphylia Support Form"
const BUSINESS_FROM_NAME =
  getFirstEnv("RESEND_BUSINESS_FROM_NAME", "BUSINESS_FROM_NAME") ?? "Aphylia Business Form"

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(4000),
  submittedAt: z.string().optional(),
  audience: z.enum(["support", "business", "bug"]).optional(),
  screenshotUrl: z.string().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        content: z.string(), // Base64
      }),
    )
    .optional(),
  // Additional user info (when user is logged in)
  userInfo: z.object({
    userId: z.string().optional(),
    username: z.string().optional(),
    displayName: z.string().optional(),
    roles: z.array(z.string()).optional(),
    isAdmin: z.boolean().optional(),
    country: z.string().optional(),
    timezone: z.string().optional(),
    language: z.string().optional(),
    experienceYears: z.number().optional(),
    setupCompleted: z.boolean().optional(),
  }).optional(),
})

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, prefer, x-supabase-client-platform, x-supabase-client, x-supabase-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
  "Content-Type": "application/json",
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  })

function getFirstEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = Deno.env.get(key)
    if (value && value.length > 0) {
      return value
    }
  }
  return undefined
}

const escapeHtml = (input: string) =>
  input.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;"
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case '"':
        return "&quot;"
      case "'":
        return "&#39;"
      default:
        return char
    }
  })

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse(405, {
      error: "method_not_allowed",
      message: "Only POST requests are supported.",
    })
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return jsonResponse(400, {
      error: "invalid_json",
      message: "Request body must be valid JSON.",
    })
  }

  const parsed = contactSchema.safeParse(payload)
  if (!parsed.success) {
    return jsonResponse(422, {
      error: "validation_error",
      message: "Validation failed.",
      details: parsed.error.flatten(),
    })
  }

    const { name, email, subject, message, submittedAt, audience: parsedAudience, attachments, screenshotUrl, userInfo } =
      parsed.data
    const audience: Audience = parsedAudience ?? "support"
    const isLoggedIn = !!userInfo?.userId
    const recipientEmails = RECIPIENT_EMAILS[audience]

    if (!recipientEmails || recipientEmails.length === 0) {
      console.error("contact-support: no recipients configured for audience", audience)
      return jsonResponse(500, {
        error: "recipient_not_configured",
        message: "No recipients configured for the selected audience.",
      })
    }

  const resendApiKey = getFirstEnv("RESEND_API_KEY", "SUPABASE_RESEND_API_KEY")

  if (!resendApiKey) {
    console.error("contact-support: missing Resend API key")
    return jsonResponse(500, {
      error: "resend_not_configured",
      message: "Missing RESEND_API_KEY (or SUPABASE_RESEND_API_KEY) environment variable.",
    })
  }

    const fromName = audience === "business" ? BUSINESS_FROM_NAME : SUPPORT_FROM_NAME
    const fromAddressRaw = audience === "business" ? BUSINESS_FROM_EMAIL : SUPPORT_FROM_EMAIL
    const fromAddress = fromAddressRaw.includes("<")
      ? fromAddressRaw
      : `${fromName} <${fromAddressRaw}>`

  // Fallback if caller somehow sends an empty/too short subject post-validation:
  const finalSubject = subject || `Contact form message from ${name}`

    const plainBody = [
      `New ${audience} contact form submission:`,
    ``,
    `Subject: ${finalSubject}`,
    `Name: ${name}`,
    `Email: ${email}`,
      `Audience: ${audience}`,
      `Delivered to: ${recipientEmails.join(", ")}`,
    submittedAt ? `Submitted at: ${submittedAt}` : undefined,
    ``,
    `Message:`,
    message,
  ].filter(Boolean).join("\n")

  // Audience-specific configuration
  const audienceConfig: Record<Audience, { icon: string; label: string; color: string; bgColor: string }> = {
    support: { icon: "💬", label: "Support Request", color: "#059669", bgColor: "#ecfdf5" },
    business: { icon: "💼", label: "Business Inquiry", color: "#7c3aed", bgColor: "#f5f3ff" },
    bug: { icon: "🐛", label: "Bug Report", color: "#dc2626", bgColor: "#fef2f2" },
  }

  const config = audienceConfig[audience]
  
  // Format the timestamp nicely
  const formattedDate = submittedAt 
    ? new Date(submittedAt).toLocaleString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })

  // Build user info section if logged in
  const userInfoSection = isLoggedIn ? `
    <!-- User Account Info -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:8px;margin-bottom:20px;border:1px solid #bbf7d0;">
      <tr>
        <td style="padding:16px;">
          <div style="font-size:11px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">✓ Logged-in User</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
            ${userInfo?.userId ? `<tr><td style="padding:4px 0;color:#6b7280;width:100px;">User ID</td><td style="padding:4px 0;font-family:monospace;font-size:12px;">${escapeHtml(userInfo.userId)}</td></tr>` : ''}
            ${userInfo?.username ? `<tr><td style="padding:4px 0;color:#6b7280;">Username</td><td style="padding:4px 0;font-weight:500;">@${escapeHtml(userInfo.username)}</td></tr>` : ''}
            ${userInfo?.displayName ? `<tr><td style="padding:4px 0;color:#6b7280;">Display Name</td><td style="padding:4px 0;">${escapeHtml(userInfo.displayName)}</td></tr>` : ''}
            ${userInfo?.roles && userInfo.roles.length > 0 ? `<tr><td style="padding:4px 0;color:#6b7280;">Roles</td><td style="padding:4px 0;">${userInfo.roles.map(r => `<span style="display:inline-block;background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:10px;font-size:11px;margin-right:4px;">${escapeHtml(r)}</span>`).join('')}</td></tr>` : ''}
            ${userInfo?.isAdmin ? `<tr><td style="padding:4px 0;color:#6b7280;">Admin</td><td style="padding:4px 0;"><span style="display:inline-block;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-size:11px;">✓ Admin</span></td></tr>` : ''}
            ${userInfo?.country ? `<tr><td style="padding:4px 0;color:#6b7280;">Country</td><td style="padding:4px 0;">${escapeHtml(userInfo.country)}</td></tr>` : ''}
            ${userInfo?.timezone ? `<tr><td style="padding:4px 0;color:#6b7280;">Timezone</td><td style="padding:4px 0;">${escapeHtml(userInfo.timezone)}</td></tr>` : ''}
            ${userInfo?.language ? `<tr><td style="padding:4px 0;color:#6b7280;">Language</td><td style="padding:4px 0;">${escapeHtml(userInfo.language.toUpperCase())}</td></tr>` : ''}
            ${typeof userInfo?.experienceYears === 'number' ? `<tr><td style="padding:4px 0;color:#6b7280;">Experience</td><td style="padding:4px 0;">${userInfo.experienceYears} years</td></tr>` : ''}
            ${typeof userInfo?.setupCompleted === 'boolean' ? `<tr><td style="padding:4px 0;color:#6b7280;">Setup</td><td style="padding:4px 0;">${userInfo.setupCompleted ? '✓ Completed' : '✗ Not completed'}</td></tr>` : ''}
          </table>
        </td>
      </tr>
    </table>
  ` : `
    <!-- Guest User Notice -->
    <div style="background:#fef3c7;border-radius:8px;padding:12px 16px;margin-bottom:20px;border:1px solid #fde68a;">
      <span style="font-size:13px;color:#92400e;">⚠️ Guest user (not logged in)</span>
    </div>
  `

  // Build the clean body HTML
  const bodyHtml = `
    <!-- Header -->
    <div style="margin-bottom:24px;">
      <div style="display:inline-block;background:${config.bgColor};padding:6px 14px;border-radius:20px;margin-bottom:12px;">
        <span style="font-size:14px;">${config.icon}</span>
        <span style="font-size:13px;font-weight:600;color:${config.color};margin-left:6px;">${config.label}</span>
      </div>
      <h1 style="font-size:20px;font-weight:600;color:#18181b;margin:0 0 8px 0;line-height:1.3;">
        ${escapeHtml(finalSubject)}
      </h1>
      <p style="font-size:13px;color:#71717a;margin:0;">${formattedDate}</p>
    </div>

    <!-- Contact Info -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;margin-bottom:20px;">
      <tr>
        <td style="padding:16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom:8px;">
                <span style="font-size:13px;color:#71717a;">From:</span>
                <span style="font-size:14px;font-weight:500;color:#18181b;margin-left:8px;">${escapeHtml(name)}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span style="font-size:13px;color:#71717a;">Email:</span>
                <a href="mailto:${escapeHtml(email)}" style="font-size:14px;color:${config.color};margin-left:8px;">${escapeHtml(email)}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${userInfoSection}

    <!-- Message -->
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Message</div>
      <div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;padding:16px;">
        <p style="margin:0;font-size:14px;line-height:1.7;color:#3f3f46;white-space:pre-wrap;">${escapeHtml(message)}</p>
      </div>
    </div>

    ${screenshotUrl ? `
    <!-- Screenshot -->
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">📸 Screenshot</div>
      <div style="background:#fef2f2;border:1px dashed #fecaca;border-radius:8px;padding:12px;text-align:center;">
        <a href="${escapeHtml(screenshotUrl)}" target="_blank" style="display:block;text-decoration:none;">
          <img src="${escapeHtml(screenshotUrl)}" alt="Screenshot" style="max-width:100%;max-height:300px;border-radius:6px;margin-bottom:8px;" />
          <span style="font-size:12px;color:#dc2626;">View full size →</span>
        </a>
      </div>
    </div>
    ` : ""}

    <!-- Quick Actions -->
    <div style="text-align:center;padding-top:16px;border-top:1px solid #e4e4e7;">
      <a href="mailto:${escapeHtml(email)}?subject=Re: ${encodeURIComponent(finalSubject)}" style="display:inline-block;background:${config.color};color:#ffffff;font-weight:500;font-size:13px;padding:10px 24px;border-radius:6px;text-decoration:none;">
        Reply to ${escapeHtml(name.split(' ')[0])}
      </a>
    </div>

    <!-- Meta Info -->
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e4e4e7;">
      <p style="font-size:11px;color:#a1a1aa;margin:0;">
        Category: ${audience} · Delivered to: ${escapeHtml(recipientEmails.join(", "))}
      </p>
    </div>
  `

  // Wrap with the simple admin email template
  const htmlBody = wrapAdminEmailHtmlShared(bodyHtml, {
    subject: finalSubject,
    previewText: `${config.label} from ${name}: ${message.substring(0, 80)}${message.length > 80 ? '...' : ''}`,
  })

    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
            to: recipientEmails,
          reply_to: email,
          subject: finalSubject,
          text: plainBody,
          html: htmlBody,
          attachments,
          tags: [
            { name: "source", value: "contact-form" },
            { name: "audience", value: audience },
          ],
        }),
      })

    if (!response.ok) {
      let errorDetail: unknown = null
      try {
        errorDetail = await response.json()
      } catch {
        // Ignore parse errors, rely on status below.
      }
      console.error("contact-support: Resend API error", response.status, response.statusText, errorDetail)
      return jsonResponse(502, {
        error: "resend_error",
        message: "Failed to send email via Resend.",
        status: response.status,
      })
    }

      return jsonResponse(200, { success: true, audience })
  } catch (error) {
    console.error("contact-support: failed to call Resend API", error)
    return jsonResponse(500, {
      error: "resend_request_failed",
      message: "Unable to reach Resend API.",
    })
  }
})

