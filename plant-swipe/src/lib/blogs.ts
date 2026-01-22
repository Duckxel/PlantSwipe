import { supabase, type BlogPostRow } from '@/lib/supabaseClient'
import type { BlogPost, BlogPostInput } from '@/types/blog'

const BLOG_POST_SELECT = 'id, title, slug, body_html, editor_data, author_id, author_name, cover_image_url, excerpt, meta_description, seo_title, tags, is_published, published_at, created_at, updated_at'
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
    metaDescription: row.meta_description,
    seoTitle: row.seo_title,
    tags: row.tags ?? [],
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

export type FetchBlogPostsOptions = {
  includeDrafts?: boolean
  limit?: number
  offset?: number
}

export type FetchBlogPostsResult = {
  posts: BlogPost[]
  hasMore: boolean
  total: number
}

export async function fetchBlogPosts(opts?: FetchBlogPostsOptions): Promise<BlogPost[]> {
  const query = supabase
    .from('blog_posts')
    .select(BLOG_POST_SELECT)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (opts?.limit) {
    query.limit(opts.limit)
  }

  if (opts?.offset) {
    query.range(opts.offset, opts.offset + (opts.limit || 10) - 1)
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

export async function fetchBlogPostsPaginated(opts?: FetchBlogPostsOptions): Promise<FetchBlogPostsResult> {
  const limit = opts?.limit || 10
  const offset = opts?.offset || 0

  // Get total count for pagination info
  const countQuery = supabase
    .from('blog_posts')
    .select('id', { count: 'exact', head: true })

  if (!opts?.includeDrafts) {
    countQuery.eq('is_published', true).lte('published_at', new Date().toISOString())
  }

  const { count, error: countError } = await countQuery
  if (countError) {
    throw new Error(countError.message)
  }

  const total = count || 0

  // Fetch the posts
  const posts = await fetchBlogPosts({ ...opts, limit, offset })

  return {
    posts,
    hasMore: offset + posts.length < total,
    total,
  }
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

  // Validate tags: limit to 5 and ensure they're valid strings
  const validTags = Array.isArray(params.tags)
    ? params.tags
        .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
        .map(tag => tag.trim().toLowerCase().slice(0, 30))
        .slice(0, 5)
    : []

  const basePayload = {
    title: params.title.trim(),
    slug,
    body_html: params.bodyHtml,
    editor_data: params.editorData ?? null,
    author_id: params.authorId,
    author_name: params.authorName,
    cover_image_url: params.coverImageUrl ?? null,
    excerpt: params.excerpt ?? normalizeExcerpt(params.bodyHtml),
    meta_description: params.metaDescription ?? null,
    seo_title: params.seoTitle ?? null,
    tags: validTags,
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
