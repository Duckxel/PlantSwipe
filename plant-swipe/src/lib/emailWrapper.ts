/**
 * Email HTML Wrapper
 * Creates a beautiful, styled email that matches the Aphylia website aesthetic
 * Supports multiple languages for internationalization
 */

import type { SupportedLanguage } from './i18n'
import { getDividerHTML, type DividerStyle } from '@/components/tiptap-node/styled-divider-node/styled-divider-node-extension'

// SVG logo URL that should be replaced with PNG for email compatibility
const SVG_LOGO_URL = 'https://media.aphylia.app/UTILITY/admin/uploads/svg/plant-swipe-icon.svg'
const PNG_LOGO_URL = 'https://media.aphylia.app/UTILITY/admin/uploads/png/icon-500_transparent_white.png'

export interface EmailWrapperOptions {
  subject?: string
  previewText?: string
  unsubscribeUrl?: string
  websiteUrl?: string
  language?: SupportedLanguage
}

const DEFAULT_OPTIONS: EmailWrapperOptions = {
  websiteUrl: 'https://aphylia.app',
  language: 'en',
}

// Social media URLs
const SOCIAL_MEDIA = {
  youtube: 'https://www.youtube.com/@aphylia_app',
  twitter: 'https://x.com/aphylia_app',
  instagram: 'https://www.instagram.com/aphylia_app/',
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

/**
 * Get localized strings for the email wrapper based on language
 */
export function getEmailWrapperStrings(language: SupportedLanguage = 'en') {
  return EMAIL_WRAPPER_I18N[language] || EMAIL_WRAPPER_I18N.en
}

// Aphylia logo URL for emails (using PNG for better email client compatibility - Gmail doesn't support SVG or WebP)
const APHYLIA_LOGO_URL = 'https://media.aphylia.app/UTILITY/admin/uploads/png/icon-500_transparent_white.png'
const APHYLIA_LOGO_IMG = `<img src="${APHYLIA_LOGO_URL}" alt="Aphylia" width="32" height="32" style="display:block;border:0;outline:none;text-decoration:none;" />`
const APHYLIA_LOGO_IMG_LARGE = `<img src="${APHYLIA_LOGO_URL}" alt="Aphylia" width="48" height="48" style="display:block;border:0;outline:none;text-decoration:none;" />`

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
    
    /* Typography - colors not using !important to allow inline styles */
    h1 { font-size: 32px; font-weight: 700; color: #111827; margin: 0 0 20px 0; line-height: 1.2; letter-spacing: -0.5px; }
    h2 { font-size: 26px; font-weight: 700; color: #1f2937; margin: 32px 0 16px 0; line-height: 1.3; }
    h3 { font-size: 22px; font-weight: 600; color: #374151; margin: 28px 0 12px 0; line-height: 1.4; }
    h4 { font-size: 18px; font-weight: 600; color: #4b5563; margin: 24px 0 10px 0; }
    p { margin: 0 0 16px 0; line-height: 1.75; color: #374151; }
    
    /* Text colors - preserve inline color styles */
    span[style*="color"] { color: inherit; }
    
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
            <td class="email-header" style="background:linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%);padding:24px 32px;text-align:center;">
              <img src="https://media.aphylia.app/UTILITY/admin/uploads/png/baniere-logo-plus-titre-v2-54ef1ba8-2e4d-47fd-91bb-8bf4cbe01260.png" alt="Aphylia" width="280" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;max-width:100%;height:auto;" />
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
                          <!-- Logo in green square - using table for centering -->
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:#10b981;border-radius:16px;width:56px;height:56px;">
                            <tr>
                              <td align="center" valign="middle" style="width:56px;height:56px;">
                                ${APHYLIA_LOGO_IMG_LARGE}
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
                    
                    <!-- Social Media Links -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px auto;">
                      <tr>
                        <td align="center">
                          <p style="margin:0 0 12px 0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">${strings.followUs}</p>
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <!-- YouTube -->
                              <td style="padding:0 8px;">
                                <a href="${SOCIAL_MEDIA.youtube}" target="_blank" style="display:inline-block;width:36px;height:36px;background:#f3f4f6;border-radius:50%;text-decoration:none;line-height:36px;text-align:center;" title="YouTube">
                                  <span style="font-size:16px;">▶</span>
                                </a>
                              </td>
                              <!-- X (Twitter) -->
                              <td style="padding:0 8px;">
                                <a href="${SOCIAL_MEDIA.twitter}" target="_blank" style="display:inline-block;width:36px;height:36px;background:#f3f4f6;border-radius:50%;text-decoration:none;line-height:36px;text-align:center;" title="X">
                                  <span style="font-size:16px;font-weight:bold;color:#374151;">𝕏</span>
                                </a>
                              </td>
                              <!-- Instagram -->
                              <td style="padding:0 8px;">
                                <a href="${SOCIAL_MEDIA.instagram}" target="_blank" style="display:inline-block;width:36px;height:36px;background:linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);border-radius:50%;text-decoration:none;line-height:36px;text-align:center;" title="Instagram">
                                  <span style="font-size:14px;color:#ffffff;">📷</span>
                                </a>
                              </td>
                            </tr>
                          </table>
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
 */
export function generateEmailPreviewHtml(bodyHtml: string, options: EmailWrapperOptions = {}): string {
  return wrapEmailHtml(bodyHtml, options)
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
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:32px;padding:24px;background-color:#f0fdf4;border-radius:20px;border:1px solid rgba(16, 185, 129, 0.1);">
      <tr>
        <td width="72" style="vertical-align:middle;padding-right:16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:#10b981;border-radius:16px;width:56px;height:56px;">
            <tr>
              <td align="center" valign="middle" style="width:56px;height:56px;">
                ${APHYLIA_LOGO_IMG_LARGE}
              </td>
            </tr>
          </table>
        </td>
        <td style="vertical-align:middle;">
          <p style="margin:0 0 4px 0;font-size:18px;font-weight:700;color:#111827;">${strings.teamName}</p>
          <p style="margin:0;font-size:14px;color:#6b7280;">${strings.tagline}</p>
        </td>
      </tr>
    </table>
  `

  const footer = `
    <div style="margin-top:24px;padding-top:24px;border-top:1px solid rgba(16, 185, 129, 0.1);text-align:center;">
      <a href="${opts.websiteUrl}" style="display:inline-block;background:linear-gradient(135deg, #059669 0%, #10b981 100%);color:#ffffff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:50px;text-decoration:none;box-shadow:0 8px 24px -6px rgba(16, 185, 129, 0.4);margin-bottom:16px;">
        ${strings.exploreButton}
      </a>
      <div style="margin:16px 0;">
        <p style="margin:0 0 12px 0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">${strings.followUs}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <td style="padding:0 8px;">
              <a href="${SOCIAL_MEDIA.youtube}" target="_blank" style="display:inline-block;width:36px;height:36px;background:#f3f4f6;border-radius:50%;text-decoration:none;line-height:36px;text-align:center;" title="YouTube">
                <span style="font-size:16px;">▶</span>
              </a>
            </td>
            <td style="padding:0 8px;">
              <a href="${SOCIAL_MEDIA.twitter}" target="_blank" style="display:inline-block;width:36px;height:36px;background:#f3f4f6;border-radius:50%;text-decoration:none;line-height:36px;text-align:center;" title="X">
                <span style="font-size:16px;font-weight:bold;color:#374151;">𝕏</span>
              </a>
            </td>
            <td style="padding:0 8px;">
              <a href="${SOCIAL_MEDIA.instagram}" target="_blank" style="display:inline-block;width:36px;height:36px;background:linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);border-radius:50%;text-decoration:none;line-height:36px;text-align:center;" title="Instagram">
                <span style="font-size:14px;color:#ffffff;">📷</span>
              </a>
            </td>
          </tr>
        </table>
      </div>
      <p style="margin:12px 0 0 0;font-size:12px;color:#9ca3af;">
        ${strings.copyright.replace('{year}', String(currentYear))}
      </p>
    </div>
  `

  return { bodyHtml, signature, footer }
}

/**
 * Helper to safely decode images array from a base64/JSON data attribute
 */
function decodeImagesAttr(encoded: string | null): Array<{src: string, alt?: string, focalX?: number, focalY?: number}> {
  if (!encoded) return []
  
  try {
    // First try base64 decoding (new format)
    if (typeof atob === 'function') {
      try {
        const json = decodeURIComponent(atob(encoded))
        return JSON.parse(json)
      } catch {
        // If base64 fails, try direct JSON parse (old format compatibility)
      }
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
  // Simple pattern to match resizable-image divs
  const imagePattern = /<div[^>]*data-type="resizable-image"[^>]*>[\s\S]*?<\/div>/gi
  
  return html.replace(imagePattern, (match) => {
    // Extract attributes
    const alignMatch = match.match(/data-align="([^"]*)"/)
    const widthMatch = match.match(/data-width="([^"]*)"/)
    
    const align = alignMatch ? alignMatch[1] : 'center'
    const width = widthMatch ? widthMatch[1] : '100%'
    
    // Extract img src
    const srcMatch = match.match(/src="([^"]*)"/)
    const altMatch = match.match(/alt="([^"]*)"/)
    
    if (!srcMatch) {
      return match
    }
    
    const src = srcMatch[1]
    const alt = altMatch ? altMatch[1] : ''
    
    // Calculate pixel width (assuming 540px container)
    const widthPercent = width.endsWith('%') ? parseInt(width) : 100
    const pixelWidth = Math.floor(540 * (widthPercent / 100))
    
    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;"><tr><td align="${align}"><img src="${src}" alt="${alt}" width="${pixelWidth}" style="display:block;max-width:100%;border-radius:16px;"></td></tr></table>`
  })
}


/**
 * Converts image grid divs to email-compatible table-based HTML
 * CSS Grid doesn't work in most email clients, so we use tables instead
 * 
 * Note: This is exported for use in email sending pipelines.
 * For web previews, the div-based structure with CSS grid works fine.
 */
export function convertImageGridToEmailTable(html: string): string {
  // Match pattern: <div...data-type="image-grid"...>...<div...>...</div></div>
  const gridPattern = /(<div[^>]*data-type="image-grid"[^>]*>)([\s\S]*?)(<\/div>\s*<\/div>)/gi
  
  let result = html
  let match
  
  // Reset lastIndex for global regex
  gridPattern.lastIndex = 0
  
  while ((match = gridPattern.exec(html)) !== null) {
    const fullMatch = match[0]
    const openTag = match[1]
    
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
    }
    
    // Fallback: extract from img tags
    if (!images.length) {
      const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi
      let imgMatch
      while ((imgMatch = imgRegex.exec(fullMatch)) !== null) {
        const altMatch = imgMatch[0].match(/alt="([^"]*)"/)
        images.push({ src: imgMatch[1], alt: altMatch ? altMatch[1] : '' })
      }
    }
    
    if (!images.length) {
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
    
    result = result.replace(fullMatch, replacement)
  }
  
  return result
}

/**
 * Sanitizes email HTML for web preview
 * - Replaces SVG logo URLs with PNG for Gmail compatibility
 * - Fixes escaped divider HTML from TipTap
 * - Removes filter:brightness(0) invert(1) that was used for SVG workaround
 * - Keeps div-based image grids (CSS grid works in browsers)
 */
export function sanitizeEmailHtml(html: string): string {
  let result = html

  // For web preview, keep the div-based structure for both resizable images and image grids
  // CSS handles these properly in browsers. Only convert to tables when sending emails.

  // 1. Replace all SVG logo URLs with PNG (Gmail doesn't support SVG)
  result = result.replace(
    new RegExp(SVG_LOGO_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
    PNG_LOGO_URL
  )

  // 2. Remove the old SVG filter workaround that makes PNG logos invisible
  // The filter:brightness(0) invert(1) was used to make SVGs white, but PNG is already white
  result = result.replace(/filter:\s*brightness\(0\)\s*invert\(1\);?/g, '')

  // 3. Fix escaped styled-divider HTML (TipTap escapes the inner HTML)
  // Match dividers with escaped content like &lt;div style="..."&gt;&lt;/div&gt;
  result = result.replace(
    /<div[^>]*data-type="styled-divider"[^>]*data-style="([^"]*)"[^>]*data-color="([^"]*)"[^>]*>([^<]*(?:&lt;|&gt;|&#\d+;)[^<]*)<\/div>/gi,
    (match, style, color, escapedContent) => {
      // Check if the content is escaped HTML
      if (escapedContent.includes('&lt;') || escapedContent.includes('&gt;')) {
        const dividerHtml = getDividerHTML(style as DividerStyle, color)
        return `<div data-type="styled-divider" data-style="${style}" data-color="${color}" style="padding: 24px 0; text-align: center;">${dividerHtml}</div>`
      }
      return match
    }
  )

  // 4. Also handle dividers where the style attribute is inline (simpler pattern)
  // This catches cases where the escaped HTML is directly inside
  const escapedDividerPatterns = [
    // Solid divider
    { escaped: '&lt;div style="height: 2px; background: #059669; opacity: 0.3; border-radius: 1px"&gt;&lt;/div&gt;', style: 'solid', color: 'emerald' },
    { escaped: '&lt;div style="height: 3px; background-color: #059669; border-radius: 2px"&gt;&lt;/div&gt;', style: 'gradient', color: 'emerald' },
  ]

  for (const pattern of escapedDividerPatterns) {
    if (result.includes(pattern.escaped)) {
      result = result.replace(
        new RegExp(pattern.escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        getDividerHTML(pattern.style as DividerStyle, pattern.color)
      )
    }
  }

  return result
}

/**
 * Prepares email HTML for actual sending to email clients
 * - Does everything sanitizeEmailHtml does
 * - ALSO converts image grids to table-based layout (required for email clients)
 * 
 * Use this function when sending emails, not for web preview
 */
export function prepareEmailHtmlForSending(html: string): string {
  // First apply all the standard sanitization
  let result = sanitizeEmailHtml(html)
  
  // Convert resizable images to tables (for proper alignment in email clients)
  result = convertResizableImageToEmailHtml(result)
  
  // Convert image grids to tables (email clients don't support CSS Grid)
  result = convertImageGridToEmailTable(result)
  
  return result
}
