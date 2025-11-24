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
  editorData: Record<string, unknown> | null
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
  editorData?: Record<string, unknown> | null
}
