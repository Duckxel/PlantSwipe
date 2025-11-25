import type { Plant } from './plant'

export type BookmarkVisibility = 'public' | 'private'

export interface Bookmark {
  id: string
  user_id: string
  name: string
  visibility: BookmarkVisibility
  created_at: string
  updated_at: string
  // Populated fields
  items?: BookmarkItem[]
  plant_count?: number
  preview_images?: string[]
}

export interface BookmarkItem {
  id: string
  bookmark_id: string
  plant_id: string
  created_at: string
  // Populated fields
  plant?: Plant
}
