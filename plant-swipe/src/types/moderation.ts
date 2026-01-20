/**
 * Moderation Types
 * 
 * Types for user reporting, threat levels, blocking, and ban system
 */

// Threat level scale
export type ThreatLevel = 0 | 1 | 2 | 3

export const THREAT_LEVELS = {
  SAFE: 0 as ThreatLevel,
  SUS: 1 as ThreatLevel,      // Had 1 incident
  DANGER: 2 as ThreatLevel,   // Has multiple incidents
  BAN: 3 as ThreatLevel       // Banned from platform
} as const

export const THREAT_LEVEL_LABELS: Record<ThreatLevel, string> = {
  0: 'Safe',
  1: 'Sus',
  2: 'Danger',
  3: 'Banned'
}

export const THREAT_LEVEL_COLORS: Record<ThreatLevel, string> = {
  0: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
  1: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
  2: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30',
  3: 'text-red-600 bg-red-100 dark:bg-red-900/30'
}

// Report status
export type ReportStatus = 'review' | 'classified'

// User Report (file/case)
export interface UserReport {
  id: string
  reportedUserId: string
  reporterId: string
  reason: string
  status: ReportStatus
  createdAt: string
  classifiedAt: string | null
  classifiedBy: string | null
  // Joined data
  reportedUser?: {
    id: string
    displayName: string | null
    avatarUrl: string | null
    threatLevel: ThreatLevel
  } | null
  reporter?: {
    id: string
    displayName: string | null
    avatarUrl: string | null
  } | null
  classifier?: {
    id: string
    displayName: string | null
  } | null
  notes?: UserReportNote[]
}

// Admin note on a report
export interface UserReportNote {
  id: string
  reportId: string
  adminId: string
  note: string
  createdAt: string
  admin?: {
    id: string
    displayName: string | null
  } | null
}

// User Block
export interface UserBlock {
  id: string
  blockerId: string
  blockedId: string
  createdAt: string
  blockedUser?: {
    id: string
    displayName: string | null
    avatarUrl: string | null
  } | null
}

// Report creation params
export interface CreateReportParams {
  reportedUserId: string
  reason: string
}

// Report update params (for admin)
export interface UpdateReportParams {
  status?: ReportStatus
}

// Note creation params
export interface CreateReportNoteParams {
  reportId: string
  note: string
}
