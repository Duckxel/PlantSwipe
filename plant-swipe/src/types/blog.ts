import type { JSONContent } from '@tiptap/core'

export type BlogPost = {
  id: string
  title: string
  slug: string
  bodyHtml: string
  coverImageUrl: string | null
  excerpt: string | null
  publishedAt: string
  createdAt: string
  updatedAt: string
  authorId: string
  authorName: string | null
  isPublished: boolean
  editorData: JSONContent | null
  /** Whether to display the cover image at the top of the blog post */
  showCoverImage: boolean
  /** User who last modified the post (if different from author) */
  updatedByName: string | null
  /** AI-generated or custom SEO title for search engines and social sharing */
  seoTitle: string | null
  /** AI-generated or custom SEO description for search engines and social sharing */
  seoDescription: string | null
  /** AI-generated or custom tags for categorization (limited to 7 tags) */
  tags: string[]
}

export type BlogPostInput = {
  id?: string
  title: string
  bodyHtml: string
  slug?: string
  coverImageUrl?: string | null
  excerpt?: string | null
  isPublished?: boolean
  publishedAt?: string | null
  editorData?: JSONContent | null
  showCoverImage?: boolean
  updatedByName?: string | null
  /** AI-generated or custom SEO title for search engines and social sharing */
  seoTitle?: string | null
  /** AI-generated or custom SEO description for search engines and social sharing */
  seoDescription?: string | null
  /** AI-generated or custom tags for categorization (limited to 7 tags) */
  tags?: string[]
}

/**
 * Extract the first image URL from HTML content.
 * Used as a fallback cover image when none is explicitly set.
 */
export function extractFirstImageFromHtml(html: string): string | null {
  if (!html) return null
  // Match <img> tags with src attribute
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
  if (imgMatch?.[1]) return imgMatch[1]
  // Match background-image url in inline styles
  const bgMatch = html.match(/background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/i)
  if (bgMatch?.[1]) return bgMatch[1]
  return null
}
