import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts"
import { wrapEmailHtmlShared } from "../_shared/emailTemplateShared.ts"

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

    const { name, email, subject, message, submittedAt, audience: parsedAudience, attachments, screenshotUrl } =
      parsed.data
    const audience: Audience = parsedAudience ?? "support"
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
  const audienceConfig: Record<Audience, { icon: string; label: string; color: string; bgColor: string; borderColor: string }> = {
    support: { 
      icon: "💬", 
      label: "Support Request", 
      color: "#059669", 
      bgColor: "#ecfdf5", 
      borderColor: "#a7f3d0" 
    },
    business: { 
      icon: "💼", 
      label: "Business Inquiry", 
      color: "#7c3aed", 
      bgColor: "#f5f3ff", 
      borderColor: "#c4b5fd" 
    },
    bug: { 
      icon: "🐛", 
      label: "Bug Report", 
      color: "#dc2626", 
      bgColor: "#fef2f2", 
      borderColor: "#fecaca" 
    },
  }

  const config = audienceConfig[audience]
  
  // Format the timestamp nicely
  const formattedDate = submittedAt 
    ? new Date(submittedAt).toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : new Date().toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })

  // Build the beautiful body HTML
  const bodyHtml = `
    <!-- Audience Badge -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:${config.bgColor};border:2px solid ${config.borderColor};border-radius:50px;padding:12px 24px;">
        <span style="font-size:24px;vertical-align:middle;margin-right:8px;">${config.icon}</span>
        <span style="font-size:16px;font-weight:700;color:${config.color};vertical-align:middle;">${config.label}</span>
      </div>
    </div>

    <!-- Subject Header -->
    <h1 style="font-size:24px;font-weight:700;color:#111827;margin:0 0 24px 0;text-align:center;line-height:1.3;">
      ${escapeHtml(finalSubject)}
    </h1>

    <!-- Contact Info Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, ${config.bgColor} 0%, #ffffff 100%);border-radius:16px;border:1px solid ${config.borderColor};margin-bottom:24px;overflow:hidden;">
      <tr>
        <td style="padding:24px;">
          <!-- From Row -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr>
              <td width="100" style="color:#6b7280;font-size:14px;font-weight:500;vertical-align:top;padding-top:2px;">From</td>
              <td>
                <div style="font-size:16px;font-weight:600;color:#111827;margin-bottom:4px;">${escapeHtml(name)}</div>
                <a href="mailto:${escapeHtml(email)}" style="font-size:14px;color:${config.color};text-decoration:none;">${escapeHtml(email)}</a>
              </td>
            </tr>
          </table>
          
          <!-- Divider -->
          <div style="height:1px;background:${config.borderColor};margin:16px 0;"></div>
          
          <!-- Details Grid -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50%" style="vertical-align:top;padding-right:12px;">
                <div style="color:#6b7280;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Category</div>
                <div style="font-size:14px;font-weight:600;color:#374151;">${audience.charAt(0).toUpperCase() + audience.slice(1)}</div>
              </td>
              <td width="50%" style="vertical-align:top;padding-left:12px;">
                <div style="color:#6b7280;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Received</div>
                <div style="font-size:14px;font-weight:600;color:#374151;">${formattedDate}</div>
              </td>
            </tr>
          </table>
          
          <!-- Delivered To (smaller, secondary info) -->
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid ${config.borderColor};">
            <div style="color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Delivered to</div>
            <div style="font-size:13px;color:#6b7280;">${escapeHtml(recipientEmails.join(", "))}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Quick Reply Button -->
    <div style="text-align:center;margin-bottom:32px;">
      <a href="mailto:${escapeHtml(email)}?subject=Re: ${encodeURIComponent(finalSubject)}" style="display:inline-block;background:linear-gradient(135deg, ${config.color} 0%, ${config.color}dd 100%);color:#ffffff;font-weight:600;font-size:14px;padding:14px 32px;border-radius:50px;text-decoration:none;box-shadow:0 8px 24px -6px ${config.color}66;">
        ✉️ Reply to ${escapeHtml(name.split(' ')[0])}
      </a>
    </div>

    <!-- Message Section -->
    <div style="margin-bottom:24px;">
      <div style="display:flex;align-items:center;margin-bottom:16px;">
        <div style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Message</div>
        <div style="flex:1;height:1px;background:#e5e7eb;margin-left:12px;"></div>
      </div>
      <div style="background:#f9fafb;border-radius:16px;padding:24px;border:1px solid #e5e7eb;">
        <p style="margin:0;font-size:15px;line-height:1.8;color:#374151;white-space:pre-wrap;">${escapeHtml(message)}</p>
      </div>
    </div>

    ${screenshotUrl ? `
    <!-- Screenshot Section (Bug Reports) -->
    <div style="margin-bottom:24px;">
      <div style="display:flex;align-items:center;margin-bottom:16px;">
        <div style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">📸 Screenshot Attached</div>
        <div style="flex:1;height:1px;background:#e5e7eb;margin-left:12px;"></div>
      </div>
      <div style="background:#fef2f2;border-radius:16px;padding:16px;border:2px dashed #fecaca;text-align:center;">
        <a href="${escapeHtml(screenshotUrl)}" target="_blank" style="display:block;text-decoration:none;">
          <img src="${escapeHtml(screenshotUrl)}" alt="Bug report screenshot" style="max-width:100%;max-height:400px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.1);margin-bottom:12px;" />
          <div style="color:#dc2626;font-size:13px;font-weight:500;">Click to view full size →</div>
        </a>
      </div>
    </div>
    ` : ""}

    <!-- Internal Note -->
    <div style="background:#fffbeb;border-radius:12px;padding:16px;border:1px solid #fde68a;text-align:center;">
      <p style="margin:0;font-size:13px;color:#92400e;">
        💡 <strong>Tip:</strong> Click the reply button above or reply directly to this email to respond to the user.
      </p>
    </div>
  `

  // Wrap with the beautiful email template
  const htmlBody = wrapEmailHtmlShared(bodyHtml, {
    subject: finalSubject,
    previewText: `${config.label} from ${name}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`,
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

