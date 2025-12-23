import type { UserRole } from "@/constants/userRoles"

export type PlantProAdvice = {
  id: string
  plantId: string
  authorId: string
  authorDisplayName: string | null
  authorUsername: string | null
  authorAvatarUrl?: string | null
  authorRoles?: UserRole[] | null
  content: string
  imageUrl?: string | null
  referenceUrl?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
}
