/**
 * Email HTML Wrapper
 * Creates a beautiful, styled email that matches the Aphylia website aesthetic
 * Supports multiple languages for internationalization
 * 
 * IMPORTANT: This file should stay in sync with the email-campaign-runner edge function
 * Both should produce identical HTML output for consistency between preview and sent emails.
 */

import type { SupportedLanguage } from './i18n'

export interface EmailWrapperOptions {
  subject?: string
  previewText?: string
  unsubscribeUrl?: string
  websiteUrl?: string
  language?: SupportedLanguage
}

/**
 * Variables that can be used in email templates
 * These are replaced at send time with actual values
 */
export const EMAIL_TEMPLATE_VARIABLES = [
  { token: '{{user}}', description: "The recipient's display name (capitalized)" },
  { token: '{{email}}', description: "The recipient's email address" },
  { token: '{{random}}', description: '10 random alphanumeric characters (A-Z, a-z, 0-9)' },
  { token: '{{code}}', description: 'Verification code, OTP, or sensitive data' },
  { token: '{{date}}', description: 'Current date in user-friendly format' },
  { token: '{{year}}', description: 'Current year' },
] as const

/**
 * Generates a random string of alphanumeric characters
 */
export function generateRandomString(length: number = 10): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

/**
 * Replaces template variables with their values
 * Use for preview or when sending emails
 */
export function replaceEmailTemplateVariables(
  input: string, 
  context: Record<string, string> = {}
): string {
  if (!input) return ''
  
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const normalized = key.trim().toLowerCase()
    
    // Handle special dynamic variables
    if (normalized === 'random') {
      return generateRandomString(10)
    }
    if (normalized === 'date') {
      return new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    }
    if (normalized === 'year') {
      return String(new Date().getFullYear())
    }
    
    // Handle context-provided variables
    const replacement = context[normalized]
    return replacement !== undefined ? replacement : match
  })
}

const DEFAULT_OPTIONS: EmailWrapperOptions = {
  websiteUrl: 'https://aphylia.app',
  language: 'en',
}

// Localized strings for the email wrapper
const EMAIL_WRAPPER_I18N: Record<SupportedLanguage, {
  teamName: string
  tagline: string
  exploreButton: string
  aboutLink: string
  contactLink: string
  unsubscribeLink: string
  copyright: string
}> = {
  en: {
    teamName: 'The Aphylia Team',
    tagline: 'Helping you grow your plant knowledge 🌱',
    exploreButton: 'Explore Aphylia →',
    aboutLink: 'About',
    contactLink: 'Contact',
    unsubscribeLink: 'Unsubscribe',
    copyright: '© {year} Aphylia. Made with 💚 for plant enthusiasts everywhere.',
  },
  fr: {
    teamName: "L'équipe Aphylia",
    tagline: 'Vous accompagne dans votre découverte des plantes 🌱',
    exploreButton: 'Découvrir Aphylia →',
    aboutLink: 'À propos',
    contactLink: 'Contact',
    unsubscribeLink: 'Se désabonner',
    copyright: '© {year} Aphylia. Fait avec 💚 pour les passionnés de plantes partout dans le monde.',
  },
}

/**
 * Get localized strings for the email wrapper based on language
 */
export function getEmailWrapperStrings(language: SupportedLanguage = 'en') {
  return EMAIL_WRAPPER_I18N[language] || EMAIL_WRAPPER_I18N.en
}

// Aphylia logo as inline SVG (simplified and optimized for email)
const APHYLIA_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="48" height="48"><path fill="#059669" d="M50 5c-2.5 8-8 15-15 20 5 3 8 10 8 18 0 12-8 22-18 25 3 5 10 12 20 17 10-5 17-12 20-17-10-3-18-13-18-25 0-8 3-15 8-18-7-5-12.5-12-15-20z"/><circle cx="35" cy="58" r="5" fill="#059669"/><circle cx="65" cy="58" r="5" fill="#059669"/></svg>`

/**
 * Wraps email body content with a beautiful styled template
 * Uses inline CSS for maximum email client compatibility
 * Supports language parameter for internationalization
 */
export function wrapEmailHtml(bodyHtml: string, options: EmailWrapperOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const currentYear = new Date().getFullYear()
  const lang = opts.language || 'en'
  const strings = getEmailWrapperStrings(lang)
  
  // Preview text (hidden text that shows in email inbox previews)
  const previewTextHtml = opts.previewText 
    ? `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${opts.previewText}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="${lang}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${opts.subject || 'Aphylia'}</title>
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
  ${previewTextHtml}
  
  <!-- Email Wrapper -->
  <table role="presentation" class="email-wrapper" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg, #ecfdf5 0%, #ffffff 30%, #ffffff 70%, #fef3c7 100%);margin:0;padding:0;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 20px;">
        
        <!-- Main Container -->
        <table role="presentation" class="email-container" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:linear-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(255, 255, 255, 0.99) 50%, rgba(251, 191, 36, 0.03) 100%);border-radius:32px;border:1px solid rgba(16, 185, 129, 0.12);box-shadow:0 32px 64px -16px rgba(16, 185, 129, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td class="email-header" style="background:linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%);padding:32px 48px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:20px;padding:14px 28px;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="vertical-align:middle;padding-right:12px;">
                            ${APHYLIA_LOGO_SVG.replace('fill="#059669"', 'fill="#ffffff"').replace('width="48" height="48"', 'width="32" height="32"')}
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
          
          <!-- Body Content -->
          <tr>
            <td class="email-body" style="padding:48px 48px 32px 48px;color:#374151;font-size:16px;line-height:1.75;">
              ${bodyHtml}
            </td>
          </tr>
          
          <!-- Signature Section -->
          <tr>
            <td style="padding:0 48px 48px 48px;">
              <table role="presentation" class="signature-section" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0.02) 100%);border-radius:20px;border:1px solid rgba(16, 185, 129, 0.1);overflow:hidden;">
                <tr>
                  <td style="padding:28px 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="64" style="vertical-align:top;padding-right:20px;">
                          <!-- Logo SVG -->
                          <div style="width:56px;height:56px;background:linear-gradient(135deg, #059669 0%, #10b981 100%);border-radius:16px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px -8px rgba(16, 185, 129, 0.5);">
                            <table role="presentation" width="56" height="56" cellpadding="0" cellspacing="0">
                              <tr>
                                <td align="center" valign="middle" style="padding:8px;">
                                  ${APHYLIA_LOGO_SVG.replace('fill="#059669"', 'fill="#ffffff"')}
                                </td>
                              </tr>
                            </table>
                          </div>
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
          
          <!-- Footer -->
          <tr>
            <td class="footer-section" style="padding:32px 48px;text-align:center;border-top:1px solid rgba(16, 185, 129, 0.08);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <!-- Social/CTA -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;">
                      <tr>
                        <td>
                          <a href="${opts.websiteUrl}" style="display:inline-block;background:linear-gradient(135deg, #059669 0%, #10b981 100%);color:#ffffff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:50px;text-decoration:none;box-shadow:0 8px 24px -6px rgba(16, 185, 129, 0.4);">
                            ${strings.exploreButton}
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Links -->
                    <p style="margin:0 0 12px 0;font-size:13px;color:#9ca3af;">
                      <a href="${opts.websiteUrl}" style="color:#059669;text-decoration:none;font-weight:500;">aphylia.app</a>
                      <span style="color:#d1d5db;margin:0 8px;">•</span>
                      <a href="${opts.websiteUrl}/about" style="color:#9ca3af;text-decoration:none;">${strings.aboutLink}</a>
                      <span style="color:#d1d5db;margin:0 8px;">•</span>
                      <a href="${opts.websiteUrl}/contact" style="color:#9ca3af;text-decoration:none;">${strings.contactLink}</a>
                      ${opts.unsubscribeUrl ? `<span style="color:#d1d5db;margin:0 8px;">•</span><a href="${opts.unsubscribeUrl}" style="color:#9ca3af;text-decoration:none;">${strings.unsubscribeLink}</a>` : ''}
                    </p>
                    
                    <!-- Copyright -->
                    <p style="margin:0;font-size:12px;color:#d1d5db;">
                      ${strings.copyright.replace('{year}', String(currentYear))}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
        <!-- End Main Container -->
        
      </td>
    </tr>
  </table>
  <!-- End Email Wrapper -->
  
</body>
</html>`
}

/**
 * Generates a preview-friendly HTML for display (non-iframe version)
 * Applies variable replacement with sample values for preview
 */
export function generateEmailPreviewHtml(bodyHtml: string, options: EmailWrapperOptions = {}): string {
  // Apply variable replacement with sample preview values
  const previewContext: Record<string, string> = {
    user: 'Alex',
    email: 'alex@example.com',
    code: 'A1B2C3',
  }
  
  const processedBody = replaceEmailTemplateVariables(bodyHtml, previewContext)
  const processedSubject = options.subject 
    ? replaceEmailTemplateVariables(options.subject, previewContext) 
    : options.subject
    
  return wrapEmailHtml(processedBody, { ...options, subject: processedSubject })
}

/**
 * Returns a complete HTML document that can be used in an iframe for 100% accurate preview
 * This is the recommended way to preview emails as it uses the exact same wrapper function
 */
export function generateIframePreviewHtml(bodyHtml: string, options: EmailWrapperOptions = {}): string {
  return generateEmailPreviewHtml(bodyHtml, options)
}

/**
 * Generates just the email body styles without wrapper (for inline preview)
 */
export function getEmailBodyContent(bodyHtml: string, options: EmailWrapperOptions = {}): {
  bodyHtml: string
  signature: string
  footer: string
} {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const currentYear = new Date().getFullYear()
  const lang = opts.language || 'en'
  const strings = getEmailWrapperStrings(lang)

  const signature = `
    <div style="margin-top:32px;padding:24px;background:linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0.02) 100%);border-radius:20px;border:1px solid rgba(16, 185, 129, 0.1);">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="width:56px;height:56px;background:linear-gradient(135deg, #059669 0%, #10b981 100%);border-radius:16px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px -8px rgba(16, 185, 129, 0.5);">
          ${APHYLIA_LOGO_SVG.replace('fill="#059669"', 'fill="#ffffff"')}
        </div>
        <div>
          <p style="margin:0 0 4px 0;font-size:18px;font-weight:700;color:#111827;">${strings.teamName}</p>
          <p style="margin:0;font-size:14px;color:#6b7280;">${strings.tagline}</p>
        </div>
      </div>
    </div>
  `

  const footer = `
    <div style="margin-top:24px;padding-top:24px;border-top:1px solid rgba(16, 185, 129, 0.1);text-align:center;">
      <a href="${opts.websiteUrl}" style="display:inline-block;background:linear-gradient(135deg, #059669 0%, #10b981 100%);color:#ffffff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:50px;text-decoration:none;box-shadow:0 8px 24px -6px rgba(16, 185, 129, 0.4);margin-bottom:16px;">
        ${strings.exploreButton}
      </a>
      <p style="margin:12px 0 0 0;font-size:12px;color:#9ca3af;">
        ${strings.copyright.replace('{year}', String(currentYear))}
      </p>
    </div>
  `

  return { bodyHtml, signature, footer }
}
