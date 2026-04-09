import type { Plant } from './plant'

export type BookmarkVisibility = 'public' | 'private'

export interface BookmarkOwner {
  id: string
  display_name: string
  avatar_url: string | null
}

export interface Bookmark {
  id: string
  user_id: string
  name: string
  visibility: BookmarkVisibility
  is_like: boolean
  created_at: string
  updated_at: string
  // Populated fields
  items?: BookmarkItem[]
  plant_count?: number
  preview_images?: string[]
  owner?: BookmarkOwner
}

export interface BookmarkItem {
  id: string
  bookmark_id: string
  plant_id: string
  created_at: string
  // Populated fields
  plant?: Plant
}
