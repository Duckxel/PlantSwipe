import { supabase, type BlogPostRow } from '@/lib/supabaseClient'
import type { BlogPost, BlogPostInput } from '@/types/blog'

const BLOG_POST_SELECT = 'id, title, slug, body_html, editor_data, author_id, author_name, cover_image_url, excerpt, is_published, published_at, created_at, updated_at'
const MAX_SLUG_ATTEMPTS = 15

export type SaveBlogPostParams = BlogPostInput & {
  authorId: string
  authorName: string | null
}

export function mapBlogPostRow(row: BlogPostRow): BlogPost {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    bodyHtml: row.body_html,
    editorData: row.editor_data,
    authorId: row.author_id,
    authorName: row.author_name,
    coverImageUrl: row.cover_image_url,
    excerpt: row.excerpt,
    isPublished: row.is_published,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const slugifyTitle = (value: string) => {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/["']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
  if (base) return base
  return `post-${Math.random().toString(36).slice(2, 10)}`
}

const normalizeExcerpt = (html: string, fallback?: string | null, limit = 260) => {
  const candidate = fallback ?? html
  if (!candidate) return null
  const withoutTags = candidate
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!withoutTags) return null
  if (withoutTags.length <= limit) return withoutTags
  return `${withoutTags.slice(0, limit - 1).trim()}…`
}

async function ensureUniqueSlug(base: string, existingId?: string) {
  let attempt = 0
  let candidate = base
  while (attempt < MAX_SLUG_ATTEMPTS) {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, slug')
      .eq('slug', candidate)
      .maybeSingle()
    if (error && error.code !== 'PGRST116') {
      // Unknown error; break to avoid blocking save. Supabase uses PGRST116 for no rows.
      break
    }
    if (!data || data.id === existingId) {
      return candidate
    }
    attempt += 1
    candidate = `${base}-${attempt + 1}`
  }
  return `${base}-${Date.now()}`
}

export async function fetchBlogPosts(opts?: { includeDrafts?: boolean; limit?: number }) {
  const query = supabase
    .from('blog_posts')
    .select(BLOG_POST_SELECT)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (opts?.limit) {
    query.limit(opts.limit)
  }

  if (!opts?.includeDrafts) {
    query.eq('is_published', true).lte('published_at', new Date().toISOString())
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapBlogPostRow(row as BlogPostRow))
}

export async function fetchBlogPost(identifier: string) {
  const { data, error } = await supabase
    .from('blog_posts')
    .select(BLOG_POST_SELECT)
    .or(`id.eq.${identifier},slug.eq.${identifier}`)
    .limit(1)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message)
  }

  if (!data) return null
  return mapBlogPostRow(data as BlogPostRow)
}

export async function saveBlogPost(params: SaveBlogPostParams) {
  const isUpdate = Boolean(params.id)
  const baseSlug = params.slug?.trim() || slugifyTitle(params.title)
  const slug = await ensureUniqueSlug(baseSlug, params.id)

  const basePayload = {
    title: params.title.trim(),
    slug,
    body_html: params.bodyHtml,
    editor_data: params.editorData ?? null,
    author_id: params.authorId,
    author_name: params.authorName,
    cover_image_url: params.coverImageUrl ?? null,
    excerpt: params.excerpt ?? normalizeExcerpt(params.bodyHtml),
    is_published: params.isPublished ?? true,
  }

  const payload = isUpdate
    ? basePayload
    : {
        ...basePayload,
        published_at: params.publishedAt ?? new Date().toISOString(),
      }

  const query = supabase.from('blog_posts')
  const response = isUpdate
    ? await query.update(payload).eq('id', params.id!).select(BLOG_POST_SELECT).maybeSingle()
    : await query.insert(payload).select(BLOG_POST_SELECT).maybeSingle()

  if (response.error) {
    return { error: response.error.message }
  }

  if (!response.data) {
    return { error: 'No blog post returned by Supabase.' }
  }

  return { data: mapBlogPostRow(response.data as BlogPostRow) }
}

export async function deleteBlogPost(id: string) {
  const { error } = await supabase.from('blog_posts').delete().eq('id', id)
  if (error) {
    throw new Error(error.message)
  }
}
