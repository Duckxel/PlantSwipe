/**
 * Shared Email Template Configuration
 * 
 * This file contains all the shared constants and HTML generation logic
 * for email templates. It's designed to be compatible with both:
 * - Frontend (Vite/Node)
 * - Supabase Edge Functions (Deno)
 * 
 * DO NOT add any framework-specific imports to this file.
 * 
 * To sync changes to the edge function, run:
 *   npm run sync-email-template
 * 
 * Or manually copy this file to:
 *   supabase/functions/_shared/emailTemplateShared.ts
 */

// =============================================================================
// TYPES
// =============================================================================

export type SupportedLanguage = 'en' | 'fr'

export interface EmailWrapperOptions {
  subject?: string
  previewText?: string
  unsubscribeUrl?: string
  websiteUrl?: string
  language?: SupportedLanguage
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'
export const DEFAULT_WEBSITE_URL = 'https://aphylia.app'

// Social media URLs
export const SOCIAL_MEDIA = {
  youtube: 'https://www.youtube.com/@aphylia_app',
  twitter: 'https://x.com/aphylia_app',
  instagram: 'https://www.instagram.com/aphylia_app/',
}

// Inline SVG icons for email (Lucide icon paths)
export const SOCIAL_ICONS = {
  youtube: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>`,
  twitter: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>`,
  instagram: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>`,
}

// Logo URLs
export const LOGO_URL = 'https://media.aphylia.app/UTILITY/admin/uploads/png/icon-500_transparent_white.png'
export const BANNER_URL = 'https://media.aphylia.app/UTILITY/admin/uploads/png/baniere-logo-plus-titre-v2-54ef1ba8-2e4d-47fd-91bb-8bf4cbe01260.png'

// Localized strings for the email wrapper
export const EMAIL_WRAPPER_I18N: Record<SupportedLanguage, {
  teamName: string
  tagline: string
  exploreButton: string
  aboutLink: string
  contactLink: string
  unsubscribeLink: string
  copyright: string
  followUs: string
}> = {
  en: {
    teamName: 'The Aphylia Team',
    tagline: 'Helping you grow your plant knowledge 🌱',
    exploreButton: 'Explore Aphylia →',
    aboutLink: 'About',
    contactLink: 'Contact',
    unsubscribeLink: 'Unsubscribe',
    copyright: '© {year} Aphylia. Made with 💚 for plant enthusiasts everywhere.',
    followUs: 'Follow us',
  },
  fr: {
    teamName: "L'équipe Aphylia",
    tagline: 'Vous accompagne dans votre découverte des plantes 🌱',
    exploreButton: 'Découvrir Aphylia →',
    aboutLink: 'À propos',
    contactLink: 'Contact',
    unsubscribeLink: 'Se désabonner',
    copyright: '© {year} Aphylia. Fait avec 💚 pour les passionnés de plantes partout dans le monde.',
    followUs: 'Suivez-nous',
  },
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get localized strings for the email wrapper based on language
 */
export function getEmailWrapperStrings(language: SupportedLanguage = 'en') {
  return EMAIL_WRAPPER_I18N[language] || EMAIL_WRAPPER_I18N.en
}

/**
 * Generate the logo image HTML (large version for signature)
 */
export function getLogoImgLarge(): string {
  return `<img src="${LOGO_URL}" alt="Aphylia" width="48" height="48" style="display:block;border:0;outline:none;text-decoration:none;" />`
}

// =============================================================================
// EMAIL HTML GENERATION - wrapEmailHtmlShared
// =============================================================================

/**
 * Wraps email body content with a beautiful styled template
 * Uses inline CSS for maximum email client compatibility
 * Supports language parameter for internationalization
 */
export function wrapEmailHtmlShared(bodyHtml: string, options: EmailWrapperOptions = {}): string {
  const websiteUrl = options.websiteUrl || DEFAULT_WEBSITE_URL
  const language = options.language || DEFAULT_LANGUAGE
  const currentYear = new Date().getFullYear()
  const strings = getEmailWrapperStrings(language)
  
  // Preview text (hidden text that shows in email inbox previews)
  const previewTextHtml = options.previewText 
    ? `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${options.previewText}</div>`
    : ''

  const logoImgLarge = getLogoImgLarge()

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
  <title>${options.subject || 'Aphylia'}</title>
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
          
          <!-- Header Banner -->
          <tr>
            <td class="email-header" style="background:linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%);padding:32px 48px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:20px;padding:14px 28px;">
                <img src="${BANNER_URL}" alt="Aphylia" height="48" style="display:block;border:0;outline:none;text-decoration:none;height:48px;width:auto;filter:brightness(0) invert(1);" />
              </div>
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
              <table role="presentation" class="signature-section" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border-radius:20px;border:1px solid rgba(16, 185, 129, 0.1);overflow:hidden;">
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
                    <!-- CTA Button -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;">
                      <tr>
                        <td>
                          <a href="${websiteUrl}" style="display:inline-block;background:linear-gradient(135deg, #059669 0%, #10b981 100%);color:#ffffff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:50px;text-decoration:none;box-shadow:0 8px 24px -6px rgba(16, 185, 129, 0.4);">
                            ${strings.exploreButton}
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Social Media Links -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px auto;">
                      <tr>
                        <td align="center">
                          <p style="margin:0 0 12px 0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">${strings.followUs}</p>
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding:0 6px;">
                                <a href="${SOCIAL_MEDIA.youtube}" target="_blank" style="display:inline-block;width:40px;height:40px;background:#f3f4f6;border-radius:12px;text-decoration:none;text-align:center;line-height:40px;color:#6b7280;" title="YouTube">
                                  <span style="display:inline-block;vertical-align:middle;line-height:normal;margin-top:10px;">${SOCIAL_ICONS.youtube}</span>
                                </a>
                              </td>
                              <td style="padding:0 6px;">
                                <a href="${SOCIAL_MEDIA.twitter}" target="_blank" style="display:inline-block;width:40px;height:40px;background:#f3f4f6;border-radius:12px;text-decoration:none;text-align:center;line-height:40px;color:#6b7280;" title="X">
                                  <span style="display:inline-block;vertical-align:middle;line-height:normal;margin-top:10px;">${SOCIAL_ICONS.twitter}</span>
                                </a>
                              </td>
                              <td style="padding:0 6px;">
                                <a href="${SOCIAL_MEDIA.instagram}" target="_blank" style="display:inline-block;width:40px;height:40px;background:#f3f4f6;border-radius:12px;text-decoration:none;text-align:center;line-height:40px;color:#6b7280;" title="Instagram">
                                  <span style="display:inline-block;vertical-align:middle;line-height:normal;margin-top:10px;">${SOCIAL_ICONS.instagram}</span>
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Links -->
                    <p style="margin:0 0 12px 0;font-size:13px;color:#9ca3af;">
                      <a href="${websiteUrl}" style="color:#059669;text-decoration:none;font-weight:500;">aphylia.app</a>
                      <span style="color:#d1d5db;margin:0 8px;">•</span>
                      <a href="${websiteUrl}/about" style="color:#9ca3af;text-decoration:none;">${strings.aboutLink}</a>
                      <span style="color:#d1d5db;margin:0 8px;">•</span>
                      <a href="${websiteUrl}/contact" style="color:#9ca3af;text-decoration:none;">${strings.contactLink}</a>
                      ${options.unsubscribeUrl ? `<span style="color:#d1d5db;margin:0 8px;">•</span><a href="${options.unsubscribeUrl}" style="color:#9ca3af;text-decoration:none;">${strings.unsubscribeLink}</a>` : ''}
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
