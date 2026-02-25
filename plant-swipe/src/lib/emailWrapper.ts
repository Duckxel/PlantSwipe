/**
 * Email HTML Wrapper & Utilities
 *
 * The actual email HTML template lives in emailTemplateShared.ts (single source of truth).
 * This file:
 * - Re-exports wrapEmailHtmlShared as wrapEmailHtml for backward compat
 * - Provides browser-specific utilities: sanitizeEmailHtml, prepareEmailHtmlForSending
 * - Provides image grid / resizable image converters for email sending
 *
 * For the admin preview React component, see: components/email/EmailPreviewShell.tsx
 */

import type { SupportedLanguage } from './i18n'
import DOMPurify from 'dompurify'
import { getDividerHTML, type DividerStyle } from '@/components/tiptap-node/styled-divider-node/styled-divider-node-extension'
import { wrapEmailHtmlShared } from './emailTemplateShared'
/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic email template data */

// SVG logo URL that should be replaced with PNG for email compatibility
const SVG_LOGO_URL = 'https://media.aphylia.app/UTILITY/admin/uploads/svg/plant-swipe-icon.svg'
const PNG_LOGO_URL = 'https://media.aphylia.app/UTILITY/admin/uploads/png/icon-500_transparent_white.png'

// Initialize DOMPurify - works in both Browser (instance) and Node/Test (factory) environments
const getWindow = () => {
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined' && (globalThis as any).window) return (globalThis as any).window;
  return null;
}

// Lazy initialization to handle import hoisting in tests/SSR
let sanitizerInstance: any = null;
const getSanitizer = () => {
  if (sanitizerInstance) return sanitizerInstance;

  // Check if DOMPurify is already an instance (browser) or factory (node)
  if ((DOMPurify as any).sanitize) {
    sanitizerInstance = DOMPurify;
  } else {
    // Factory pattern - pass window if available
    const win = getWindow();
    sanitizerInstance = (DOMPurify as any)(win);
  }
  return sanitizerInstance;
}

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

/**
 * Wraps email body content with a beautiful styled template.
 * Delegates to wrapEmailHtmlShared (emailTemplateShared.ts) — the single
 * source of truth for the email HTML structure.
 */
export function wrapEmailHtml(bodyHtml: string, options: EmailWrapperOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  return wrapEmailHtmlShared(bodyHtml, {
    subject: opts.subject,
    previewText: opts.previewText,
    unsubscribeUrl: opts.unsubscribeUrl,
    websiteUrl: opts.websiteUrl,
    language: opts.language,
  })
}

/**
 * Generates a preview-friendly HTML for display (non-iframe version)
 */
export function generateEmailPreviewHtml(bodyHtml: string, options: EmailWrapperOptions = {}): string {
  return wrapEmailHtml(bodyHtml, options)
}

// =============================================================================
// UTILITY FUNCTIONS (sanitization, image conversion, etc.)
// =============================================================================

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
 * - Uses DOMPurify to prevent XSS attacks
 * - Replaces SVG logo URLs with PNG for Gmail compatibility
 * - Fixes escaped divider HTML from TipTap
 * - Removes filter:brightness(0) invert(1) that was used for SVG workaround
 * - Keeps div-based image grids (CSS grid works in browsers)
 */
export function sanitizeEmailHtml(html: string): string {
  // 0. Sanitize HTML to prevent XSS (scripts, event handlers, etc.)
  // We allow email-specific tags and attributes that might be stripped by default
  const cleanHtml = getSanitizer().sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['style', 'center', 'font'],
    ADD_ATTR: [
      'style', 'align', 'valign', 'bgcolor', 'width', 'height',
      'border', 'cellpadding', 'cellspacing', 'target', 'color',
      'face', 'size', 'background'
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'],
  })

  let result = cleanHtml

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
    (match: string, style: string, color: string, escapedContent: string) => {
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
