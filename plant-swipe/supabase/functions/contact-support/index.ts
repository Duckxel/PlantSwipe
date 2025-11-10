import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts"

const SUPPORT_EMAIL = "support@aphylia.app"
const RESEND_ENDPOINT = "https://api.resend.com/emails"

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(4000),
  submittedAt: z.string().optional(),
})

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, prefer",
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

const getFirstEnv = (...keys: string[]): string | undefined => {
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

  const { name, email, subject, message, submittedAt } = parsed.data

  const resendApiKey = getFirstEnv("RESEND_API_KEY", "SUPABASE_RESEND_API_KEY")

  if (!resendApiKey) {
    console.error("contact-support: missing Resend API key")
    return jsonResponse(500, {
      error: "resend_not_configured",
      message: "Missing RESEND_API_KEY (or SUPABASE_RESEND_API_KEY) environment variable.",
    })
  }

  const fromAddressRaw =
    getFirstEnv("RESEND_FROM", "SMTP_FROM", "SUPABASE_SMTP_SENDER") ?? "form@aphylia.app"
  const fromName = getFirstEnv("RESEND_FROM_NAME", "SMTP_FROM_NAME") ?? "Aphylia Support Form"

  const fromAddress = fromAddressRaw.includes("<")
    ? fromAddressRaw
    : `${fromName} <${fromAddressRaw}>`

  // Fallback if caller somehow sends an empty/too short subject post-validation:
  const finalSubject = subject || `Contact form message from ${name}`

  const plainBody = [
    `New contact form submission:`,
    ``,
    `Subject: ${finalSubject}`,
    `Name: ${name}`,
    `Email: ${email}`,
    submittedAt ? `Submitted at: ${submittedAt}` : undefined,
    ``,
    `Message:`,
    message,
  ].filter(Boolean).join("\n")

  const htmlBody = `
    <h2 style="margin-bottom:12px;">New contact form submission</h2>
    <p><strong>Subject:</strong> ${escapeHtml(finalSubject)}</p>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
    ${submittedAt ? `<p><strong>Submitted at:</strong> ${escapeHtml(submittedAt)}</p>` : ""}
    <hr style="margin:16px 0;" />
    <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
  `

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [SUPPORT_EMAIL],
        reply_to: email,
        subject: finalSubject,
        text: plainBody,
        html: htmlBody,
        tags: [{ name: "source", value: "contact-form" }],
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

    return jsonResponse(200, { success: true })
  } catch (error) {
    console.error("contact-support: failed to call Resend API", error)
    return jsonResponse(500, {
      error: "resend_request_failed",
      message: "Unable to reach Resend API.",
    })
  }
})

