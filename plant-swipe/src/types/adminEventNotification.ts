/**
 * Admin Event Notification Types
 *
 * Configurable notifications sent to selected admins when special events occur
 * (user reports, bug reports, plant reports, plant requests).
 */

export type AdminEventType = 'user_report' | 'bug_report' | 'plant_report' | 'plant_request'

export const ADMIN_EVENT_TYPES: AdminEventType[] = [
  'user_report',
  'bug_report',
  'plant_report',
  'plant_request',
]

export const ADMIN_EVENT_LABELS: Record<AdminEventType, string> = {
  user_report: 'User Report',
  bug_report: 'Bug Report',
  plant_report: 'Plant Report',
  plant_request: 'Plant Request',
}

export const ADMIN_EVENT_DESCRIPTIONS: Record<AdminEventType, string> = {
  user_report: 'Triggered when a user reports another user for misconduct',
  bug_report: 'Triggered when a user submits a bug report',
  plant_report: 'Triggered when a user reports inaccurate plant information',
  plant_request: 'Triggered when a user requests a new plant to be added',
}

/** Available template variables per event type */
export const ADMIN_EVENT_VARIABLES: Record<AdminEventType, { key: string; description: string }[]> = {
  user_report: [
    { key: 'reporter_name', description: 'Display name of the user who filed the report' },
    { key: 'reported_user_name', description: 'Display name of the reported user' },
    { key: 'reason', description: 'The reason provided for the report' },
    { key: 'report_id', description: 'Unique ID of the report' },
  ],
  bug_report: [
    { key: 'reporter_name', description: 'Display name of the user who reported the bug' },
    { key: 'bug_name', description: 'Title/name of the bug' },
    { key: 'description', description: 'Bug description text' },
    { key: 'report_id', description: 'Unique ID of the bug report' },
  ],
  plant_report: [
    { key: 'reporter_name', description: 'Display name of the user who reported the plant issue' },
    { key: 'plant_name', description: 'Name of the plant being reported' },
    { key: 'note', description: 'The issue description/note' },
    { key: 'report_id', description: 'Unique ID of the plant report' },
  ],
  plant_request: [
    { key: 'requester_name', description: 'Display name of the user who requested the plant' },
    { key: 'plant_name', description: 'Name of the requested plant' },
    { key: 'request_count', description: 'Number of times this plant has been requested' },
  ],
}

export interface AdminEventNotification {
  id: string
  eventType: AdminEventType
  enabled: boolean
  messageTemplate: string
  adminIds: string[]
  createdAt: string
  updatedAt: string
}
