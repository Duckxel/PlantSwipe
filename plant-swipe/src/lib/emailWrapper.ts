/**
 * Email HTML Wrapper
 * Creates a beautiful, styled email that matches the Plant Swipe / Aphylia website aesthetic
 */

export interface EmailWrapperOptions {
  subject?: string
  previewText?: string
  unsubscribeUrl?: string
  websiteUrl?: string
  logoUrl?: string
}

const DEFAULT_OPTIONS: EmailWrapperOptions = {
  websiteUrl: 'https://aphylia.app',
  logoUrl: 'https://aphylia.app/logo.png',
}

/**
 * Wraps email body content with a beautiful styled template
 * Uses inline CSS for maximum email client compatibility
 */
export function wrapEmailHtml(bodyHtml: string, options: EmailWrapperOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const currentYear = new Date().getFullYear()
  
  // Preview text (hidden text that shows in email inbox previews)
  const previewTextHtml = opts.previewText 
    ? `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${opts.previewText}</div>`
    : ''

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
  <title>${opts.subject || 'Plant Swipe'}</title>
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
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    
    /* Base */
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background: linear-gradient(135deg, #ecfdf5 0%, #ffffff 50%, #fef3c7 100%); }
    
    /* Links */
    a { color: #059669; text-decoration: none; }
    a:hover { color: #047857; text-decoration: underline; }
    
    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      body { background: linear-gradient(135deg, #0b1220 0%, #0a0f1a 50%, #05080f 100%) !important; }
      .email-wrapper { background: linear-gradient(135deg, #0b1220 0%, #0a0f1a 50%, #05080f 100%) !important; }
      .email-container { background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(30, 30, 30, 0.95) 50%, rgba(251, 191, 36, 0.05) 100%) !important; border-color: #3e3e42 !important; }
      .email-header { background: linear-gradient(135deg, #065f46 0%, #047857 100%) !important; }
      .email-body { background: rgba(30, 30, 30, 0.9) !important; color: #f5f5f5 !important; }
      .email-body p, .email-body li, .email-body span { color: #e5e5e5 !important; }
      .email-body h1, .email-body h2, .email-body h3, .email-body h4 { color: #ffffff !important; }
      .email-footer { background: rgba(20, 20, 20, 0.95) !important; }
      .email-footer p, .email-footer a { color: #a3a3a3 !important; }
    }
    
    /* Responsive */
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; margin: 0 !important; border-radius: 0 !important; }
      .email-body { padding: 24px 20px !important; }
      .email-header { padding: 24px 20px !important; }
      .email-footer { padding: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:linear-gradient(135deg, #ecfdf5 0%, #ffffff 50%, #fef3c7 100%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  ${previewTextHtml}
  
  <!-- Email Wrapper -->
  <table role="presentation" class="email-wrapper" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, #ecfdf5 0%, #ffffff 50%, #fef3c7 100%);margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        
        <!-- Main Container -->
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(255, 255, 255, 0.98) 50%, rgba(251, 191, 36, 0.06) 100%);border-radius:24px;border:1px solid rgba(16, 185, 129, 0.2);box-shadow:0 25px 50px -12px rgba(16, 185, 129, 0.25), 0 0 0 1px rgba(16, 185, 129, 0.05);overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td class="email-header" style="background:linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%);padding:32px 40px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <!-- Logo/Brand -->
                    <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:16px;padding:12px 24px;backdrop-filter:blur(10px);">
                      <span style="font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;text-shadow:0 2px 4px rgba(0,0,0,0.1);">🌿 Aphylia</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Body Content -->
          <tr>
            <td class="email-body" style="background:rgba(255,255,255,0.95);padding:40px;color:#1f2937;font-size:16px;line-height:1.7;">
              ${bodyHtml}
            </td>
          </tr>
          
          <!-- CTA Section -->
          <tr>
            <td style="background:linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(255, 255, 255, 0.98) 100%);padding:32px 40px;text-align:center;border-top:1px solid rgba(16, 185, 129, 0.1);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${opts.websiteUrl}" style="display:inline-block;background:linear-gradient(135deg, #059669 0%, #10b981 100%);color:#ffffff;font-weight:600;font-size:16px;padding:16px 40px;border-radius:50px;text-decoration:none;box-shadow:0 10px 30px -5px rgba(16, 185, 129, 0.4), 0 0 0 1px rgba(16, 185, 129, 0.1);transition:all 0.2s;">
                      Visit Aphylia 🌱
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td class="email-footer" style="background:linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);padding:32px 40px;text-align:center;border-top:1px solid rgba(16, 185, 129, 0.1);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <p style="margin:0 0 16px 0;font-size:14px;color:#6b7280;line-height:1.6;">
                      You're receiving this because you're part of the Aphylia community.<br>
                      We only send emails when we have something meaningful to share.
                    </p>
                    <p style="margin:0 0 16px 0;font-size:13px;color:#9ca3af;">
                      <a href="${opts.websiteUrl}" style="color:#059669;text-decoration:none;font-weight:500;">aphylia.app</a>
                      ${opts.unsubscribeUrl ? ` · <a href="${opts.unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>` : ''}
                    </p>
                    <p style="margin:0;font-size:12px;color:#d1d5db;">
                      © ${currentYear} Aphylia. Made with 💚 for plant lovers.
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
 * Generates a preview-friendly HTML that can be displayed in an iframe
 * Adds some padding and a neutral background
 */
export function generateEmailPreviewHtml(bodyHtml: string, options: EmailWrapperOptions = {}): string {
  return wrapEmailHtml(bodyHtml, options)
}
