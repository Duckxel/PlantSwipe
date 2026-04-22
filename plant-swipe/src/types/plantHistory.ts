export type PlantHistoryAction =
  | 'field_change'
  | 'translate'
  | 'ai_fill'
  | 'note_add'
  | 'note_edit'
  | 'note_delete'
  | 'create'
  | 'status_change'

export interface PlantHistoryEntry {
  id: string
  plantId: string
  authorId: string | null
  authorName: string | null
  action: PlantHistoryAction
  field: string | null
  summary: string | null
  oldValue: string | null
  newValue: string | null
  createdAt: string
}

export interface PlantAdminNote {
  id: string
  plantId: string
  authorId: string | null
  authorName: string | null
  body: string
  createdAt: string
  updatedAt: string
}
