import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts"
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts"

const SUPPORT_EMAIL = "support@aphylia.app"

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(10).max(4000),
  submittedAt: z.string().optional(),
})

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  const { name, email, message, submittedAt } = parsed.data

  const smtpHost = getFirstEnv("SMTP_HOST", "SUPABASE_SMTP_HOST") ?? "smtp.resend.com"
  const smtpPortRaw = getFirstEnv("SMTP_PORT", "SUPABASE_SMTP_PORT") ?? "465"
  const smtpUser = getFirstEnv("SMTP_USER", "SUPABASE_SMTP_USER", "RESEND_SMTP_USER") ?? "resend"
  const smtpPass = getFirstEnv("SMTP_PASS", "SUPABASE_SMTP_PASS", "RESEND_API_KEY", "SUPABASE_RESEND_API_KEY")

  if (!smtpPass) {
    console.error("contact-support: missing SMTP credentials (password/API key)")
    return jsonResponse(500, {
      error: "smtp_not_configured",
      message: "Missing SMTP password/API key (set RESEND_API_KEY or SMTP_PASS).",
    })
  }

  const smtpPort = Number(smtpPortRaw)
  if (Number.isNaN(smtpPort)) {
    console.error("contact-support: invalid SMTP port", smtpPortRaw)
    return jsonResponse(500, {
      error: "invalid_smtp_port",
      message: `SMTP port value "${smtpPortRaw}" is not a number.`,
    })
  }

  const fromAddressRaw = getFirstEnv("RESEND_FROM", "SMTP_FROM", "SUPABASE_SMTP_SENDER") ?? SUPPORT_EMAIL
  const fromName = getFirstEnv("RESEND_FROM_NAME", "SMTP_FROM_NAME") ?? "Plant Swipe Contact"

  const fromAddress = fromAddressRaw.includes("<")
    ? fromAddressRaw
    : `${fromName} <${fromAddressRaw}>`

  const subject = `Contact form message from ${name}`

  const plainBody = [
    `New contact form submission:`,
    ``,
    `Name: ${name}`,
    `Email: ${email}`,
    submittedAt ? `Submitted at: ${submittedAt}` : undefined,
    ``,
    `Message:`,
    message,
  ].filter(Boolean).join("\n")

  const htmlBody = `
    <h2 style="margin-bottom:12px;">New contact form submission</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
    ${submittedAt ? `<p><strong>Submitted at:</strong> ${escapeHtml(submittedAt)}</p>` : ""}
    <hr style="margin:16px 0;" />
    <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
  `

  try {
    const client = new SmtpClient()
    if (smtpPort === 465) {
      await client.connectTLS({
        hostname: smtpHost,
        port: smtpPort,
        username: smtpUser,
        password: smtpPass,
      })
    } else {
      await client.connect({
        hostname: smtpHost,
        port: smtpPort,
        username: smtpUser,
        password: smtpPass,
      })
    }

    await client.send({
      from: fromAddress,
      to: SUPPORT_EMAIL,
      subject,
      content: plainBody,
      html: htmlBody,
    })

    await client.close()
    return jsonResponse(200, { success: true })
  } catch (error) {
    console.error("contact-support: failed to send email via SMTP", error)
    return jsonResponse(500, {
      error: "smtp_error",
      message: "Failed to send support email.",
    })
  }
})

