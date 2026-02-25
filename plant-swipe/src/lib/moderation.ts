/**
 * Moderation Library
 * 
 * Functions for user reporting, blocking, threat levels, and ban management
 */

import { supabase } from './supabaseClient'
import type {
  UserReport,
  UserReportNote,
  UserBlock,
  ThreatLevel,
  CreateReportParams,
  UpdateReportParams,
  CreateReportNoteParams,
  ReportStatus
} from '@/types/moderation'
/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic moderation API data */

// ===== User Reports =====

/**
 * Create a new user report
 */
export async function createUserReport(params: CreateReportParams): Promise<UserReport> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Must be logged in to report a user')

  const { data, error } = await supabase
    .from('user_reports')
    .insert({
      reported_user_id: params.reportedUserId,
      reporter_id: user.id,
      reason: params.reason,
      status: 'review'
    })
    .select('id, reported_user_id, reporter_id, reason, status, created_at, classified_at, classified_by')
    .single()

  if (error) throw new Error(error.message)

  return mapReportRow(data)
}

/**
 * Get all reports (admin only)
 */
export async function getReports(options?: {
  status?: ReportStatus
  limit?: number
  offset?: number
}): Promise<UserReport[]> {
  let query = supabase
    .from('user_reports')
    .select(`
      id,
      reported_user_id,
      reporter_id,
      reason,
      status,
      created_at,
      classified_at,
      classified_by,
      reported_user:profiles!user_reports_reported_user_id_fkey(id, display_name, avatar_url, threat_level),
      reporter:profiles!user_reports_reporter_id_fkey(id, display_name, avatar_url)
    `)
    .order('created_at', { ascending: false })

  if (options?.status) {
    query = query.eq('status', options.status)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  return (data || []).map(mapReportRowWithJoins)
}

/**
 * Get reports for a specific user (admin only)
 */
export async function getReportsForUser(userId: string): Promise<UserReport[]> {
  const { data, error } = await supabase
    .from('user_reports')
    .select(`
      id,
      reported_user_id,
      reporter_id,
      reason,
      status,
      created_at,
      classified_at,
      classified_by,
      reporter:profiles!user_reports_reporter_id_fkey(id, display_name, avatar_url),
      classifier:profiles!user_reports_classified_by_fkey(id, display_name)
    `)
    .eq('reported_user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data || []).map(mapReportRowWithJoins)
}

/**
 * Get a single report by ID (admin only)
 */
export async function getReport(reportId: string): Promise<UserReport | null> {
  const { data, error } = await supabase
    .from('user_reports')
    .select(`
      id,
      reported_user_id,
      reporter_id,
      reason,
      status,
      created_at,
      classified_at,
      classified_by,
      reported_user:profiles!user_reports_reported_user_id_fkey(id, display_name, avatar_url, threat_level),
      reporter:profiles!user_reports_reporter_id_fkey(id, display_name, avatar_url),
      classifier:profiles!user_reports_classified_by_fkey(id, display_name)
    `)
    .eq('id', reportId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw new Error(error.message)
  }

  return mapReportRowWithJoins(data)
}

/**
 * Update a report status (admin only)
 */
export async function updateReport(reportId: string, params: UpdateReportParams): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Must be logged in')

  const updateData: Record<string, unknown> = {}
  
  if (params.status) {
    updateData.status = params.status
    if (params.status === 'classified') {
      updateData.classified_at = new Date().toISOString()
      updateData.classified_by = user.id
    }
  }

  const { error } = await supabase
    .from('user_reports')
    .update(updateData)
    .eq('id', reportId)

  if (error) throw new Error(error.message)
}

/**
 * Get report count by status
 */
export async function getReportCounts(): Promise<{ review: number; classified: number; total: number }> {
  const { data, error } = await supabase
    .from('user_reports')
    .select('status')

  if (error) {
    console.warn('[moderation] Failed to get report counts:', error)
    return { review: 0, classified: 0, total: 0 }
  }

  const counts = { review: 0, classified: 0, total: 0 }
  for (const row of data || []) {
    counts.total++
    if (row.status === 'review') counts.review++
    if (row.status === 'classified') counts.classified++
  }

  return counts
}

// ===== Report Notes =====

/**
 * Add a note to a report (admin only)
 */
export async function addReportNote(params: CreateReportNoteParams): Promise<UserReportNote> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Must be logged in')

  const { data, error } = await supabase
    .from('user_report_notes')
    .insert({
      report_id: params.reportId,
      admin_id: user.id,
      note: params.note
    })
    .select('id, report_id, admin_id, note, created_at')
    .single()

  if (error) throw new Error(error.message)

  return {
    id: String(data.id),
    reportId: String(data.report_id),
    adminId: String(data.admin_id),
    note: String(data.note),
    createdAt: String(data.created_at)
  }
}

/**
 * Get notes for a report (admin only)
 */
export async function getReportNotes(reportId: string): Promise<UserReportNote[]> {
  const { data, error } = await supabase
    .from('user_report_notes')
    .select(`
      id,
      report_id,
      admin_id,
      note,
      created_at,
      admin:profiles!user_report_notes_admin_id_fkey(id, display_name)
    `)
    .eq('report_id', reportId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  return (data || []).map(row => ({
    id: String(row.id),
    reportId: String(row.report_id),
    adminId: String(row.admin_id),
    note: String(row.note),
    createdAt: String(row.created_at),
    admin: row.admin ? {
      id: String((row.admin as any).id),
      displayName: (row.admin as any).display_name || null
    } : null
  }))
}

// ===== Threat Levels =====

/**
 * Get a user's threat level
 */
export async function getUserThreatLevel(userId: string): Promise<ThreatLevel> {
  const { data, error } = await supabase
    .from('profiles')
    .select('threat_level')
    .eq('id', userId)
    .single()

  if (error) {
    console.warn('[moderation] Failed to get threat level:', error)
    return 0
  }

 return (data?.threat_level ?? 0) as ThreatLevel
}

/**
 * Set a user's threat level (admin only)
 */
export async function setUserThreatLevel(userId: string, threatLevel: ThreatLevel): Promise<any> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (token) headers["Authorization"] = `Bearer ${token}`
  try {
    const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
    if (adminToken) headers["X-Admin-Token"] = String(adminToken)
  } catch {}

  const resp = await fetch("/api/admin/threat-level", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({ userId, threatLevel }),
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`)
  return data
}

/**
 * Check if a user is banned (threat level 3)
 */
export async function isUserBanned(userId: string): Promise<boolean> {
  const level = await getUserThreatLevel(userId)
  return level === 3
}

// ===== User Blocks =====

/**
 * Block a user
 */
export async function blockUser(blockedId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Must be logged in')
  if (user.id === blockedId) throw new Error('Cannot block yourself')

  const { error } = await supabase
    .from('user_blocks')
    .insert({
      blocker_id: user.id,
      blocked_id: blockedId
    })

  if (error) {
    if (error.code === '23505') return // Already blocked, ignore
    throw new Error(error.message)
  }
}

/**
 * Unblock a user
 */
export async function unblockUser(blockedId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Must be logged in')

  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedId)

  if (error) throw new Error(error.message)
}

/**
 * Get all blocked users for the current user
 */
export async function getBlockedUsers(): Promise<UserBlock[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return []

  const { data, error } = await supabase
    .from('user_blocks')
    .select(`
      id,
      blocker_id,
      blocked_id,
      created_at,
      blocked_user:profiles!user_blocks_blocked_id_fkey(id, display_name, avatar_url)
    `)
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[moderation] Failed to get blocked users:', error)
    return []
  }

  return (data || []).map(row => ({
    id: String(row.id),
    blockerId: String(row.blocker_id),
    blockedId: String(row.blocked_id),
    createdAt: String(row.created_at),
    blockedUser: row.blocked_user ? {
      id: String((row.blocked_user as any).id),
      displayName: (row.blocked_user as any).display_name || null,
      avatarUrl: (row.blocked_user as any).avatar_url || null
    } : null
  }))
}

/**
 * Check if the current user has blocked another user
 */
export async function hasBlockedUser(blockedId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return false

  const { data, error } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedId)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}

/**
 * Check if a specific user has blocked the current user
 * (used to show blocked content as "private" to the blocked user)
 */
export async function isBlockedByUser(blockerId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return false

  const { data, error } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', user.id)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}

/**
 * Check if either user has blocked the other (bidirectional check)
 */
export async function areUsersBlocked(user1Id: string, user2Id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('are_users_blocked', {
    _user1_id: user1Id,
    _user2_id: user2Id
  })

  if (error) {
    console.warn('[moderation] Failed to check block status:', error)
    return false
  }

  return Boolean(data)
}

// ===== Helper Functions =====

function mapReportRow(row: any): UserReport {
  return {
    id: String(row.id),
    reportedUserId: String(row.reported_user_id),
    reporterId: String(row.reporter_id),
    reason: String(row.reason),
    status: row.status as ReportStatus,
    createdAt: String(row.created_at),
    classifiedAt: row.classified_at ? String(row.classified_at) : null,
    classifiedBy: row.classified_by ? String(row.classified_by) : null
  }
}

function mapReportRowWithJoins(row: any): UserReport {
  const report = mapReportRow(row)
  
  if (row.reported_user) {
    report.reportedUser = {
      id: String(row.reported_user.id),
      displayName: row.reported_user.display_name || null,
      avatarUrl: row.reported_user.avatar_url || null,
      threatLevel: (row.reported_user.threat_level ?? 0) as ThreatLevel
    }
  }
  
  if (row.reporter) {
    report.reporter = {
      id: String(row.reporter.id),
      displayName: row.reporter.display_name || null,
      avatarUrl: row.reporter.avatar_url || null
    }
  }
  
  if (row.classifier) {
    report.classifier = {
      id: String(row.classifier.id),
      displayName: row.classifier.display_name || null
    }
  }
  
  return report
}
