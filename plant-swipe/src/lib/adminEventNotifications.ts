/**
 * Admin Event Notifications Library
 *
 * CRUD operations for admin event notification settings and
 * the trigger function that sends push notifications to selected admins.
 */

import { supabase } from './supabaseClient'
import type { AdminEventNotification, AdminEventType } from '@/types/adminEventNotification'
import { sendInstantPushNotification } from './notifications'
/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic Supabase data */

// ===== CRUD =====

/**
 * Get all admin event notification configs
 */
export async function getAdminEventNotifications(): Promise<AdminEventNotification[]> {
  const { data, error } = await supabase
    .from('admin_event_notifications')
    .select('*')
    .order('event_type')

  if (error) {
    // Table may not exist yet
    if (error.message?.includes('does not exist') || error.code === '42P01') return []
    throw new Error(error.message)
  }

  return (data || []).map(mapRow)
}

/**
 * Get a single event notification config by event type
 */
export async function getAdminEventNotification(eventType: AdminEventType): Promise<AdminEventNotification | null> {
  const { data, error } = await supabase
    .from('admin_event_notifications')
    .select('*')
    .eq('event_type', eventType)
    .maybeSingle()

  if (error) {
    if (error.message?.includes('does not exist') || error.code === '42P01') return null
    throw new Error(error.message)
  }

  return data ? mapRow(data) : null
}

/**
 * Update an admin event notification config
 */
export async function updateAdminEventNotification(
  eventType: AdminEventType,
  updates: {
    enabled?: boolean
    messageTemplate?: string
    adminIds?: string[]
  }
): Promise<AdminEventNotification> {
  const updateData: Record<string, unknown> = {}
  if (updates.enabled !== undefined) updateData.enabled = updates.enabled
  if (updates.messageTemplate !== undefined) updateData.message_template = updates.messageTemplate
  if (updates.adminIds !== undefined) updateData.admin_ids = updates.adminIds

  const { data, error } = await supabase
    .from('admin_event_notifications')
    .update(updateData)
    .eq('event_type', eventType)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data)
}

// ===== Notification Trigger =====

/**
 * Send admin event notifications for a given event type.
 * Looks up the config, interpolates variables into the template, and sends
 * push notifications to each selected admin.
 *
 * Call this from the relevant event handler (e.g. createUserReport).
 * Fire-and-forget — errors are logged but not thrown.
 */
export async function sendAdminEventNotification(
  eventType: AdminEventType,
  variables: Record<string, string>
): Promise<void> {
  try {
    const config = await getAdminEventNotification(eventType)
    if (!config || !config.enabled || config.adminIds.length === 0) return

    // Interpolate variables into message template
    let message = config.messageTemplate
    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    }

    const title = formatEventTitle(eventType)

    // Send push notification to each admin (fire-and-forget per admin)
    await Promise.allSettled(
      config.adminIds.map(adminId =>
        sendInstantPushNotification({
          recipientId: adminId,
          type: 'system' as any,
          title,
          body: message,
          data: { eventType, ...variables },
        })
      )
    )
  } catch (err) {
    console.warn(`[admin-event-notifications] Failed to send ${eventType} notifications:`, err)
  }
}

// ===== Helpers =====

function formatEventTitle(eventType: AdminEventType): string {
  switch (eventType) {
    case 'user_report': return 'New User Report'
    case 'bug_report': return 'New Bug Report'
    case 'plant_report': return 'New Plant Report'
    case 'plant_request': return 'New Plant Request'
    default: return 'Admin Notification'
  }
}

function mapRow(row: any): AdminEventNotification {
  return {
    id: String(row.id),
    eventType: row.event_type as AdminEventType,
    enabled: Boolean(row.enabled),
    messageTemplate: String(row.message_template || ''),
    adminIds: Array.isArray(row.admin_ids) ? row.admin_ids.map(String) : [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}
