import type { JSONContent } from '@tiptap/core'

export type BlogPost = {
  id: string
  title: string
  slug: string
  bodyHtml: string
  coverImageUrl: string | null
  excerpt: string | null
  metaDescription: string | null
  seoTitle: string | null
  tags: string[]
  publishedAt: string
  createdAt: string
  updatedAt: string
  authorId: string
  authorName: string | null
  isPublished: boolean
  editorData: JSONContent | null
}

export type BlogPostInput = {
  id?: string
  title: string
  bodyHtml: string
  slug?: string
  coverImageUrl?: string | null
  excerpt?: string | null
  metaDescription?: string | null
  seoTitle?: string | null
  tags?: string[]
  isPublished?: boolean
  publishedAt?: string | null
  editorData?: JSONContent | null
}
