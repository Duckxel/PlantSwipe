import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  getAdminEventNotifications,
  updateAdminEventNotification,
} from '@/lib/adminEventNotifications'
import { supabase } from '@/lib/supabaseClient'
import type { AdminEventNotification, AdminEventType } from '@/types/adminEventNotification'
import {
  ADMIN_EVENT_LABELS,
  ADMIN_EVENT_DESCRIPTIONS,
  ADMIN_EVENT_VARIABLES,
} from '@/types/adminEventNotification'
import {
  AlertTriangle,
  Bug,
  Check,
  Code,
  Leaf,
  Loader2,
  RefreshCw,
  Save,
  Sprout,
  User,
  Users,
  X,
  BellRing,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type AdminUser = {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

const EVENT_ICONS: Record<AdminEventType, React.ReactNode> = {
  user_report: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  bug_report: <Bug className="h-5 w-5 text-red-500" />,
  plant_report: <Leaf className="h-5 w-5 text-emerald-500" />,
  plant_request: <Sprout className="h-5 w-5 text-blue-500" />,
}

export function AdminEventNotificationsPanel() {
  const [configs, setConfigs] = React.useState<AdminEventNotification[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [admins, setAdmins] = React.useState<AdminUser[]>([])
  const [saving, setSaving] = React.useState<string | null>(null)

  // Local edits (keyed by event_type)
  const [edits, setEdits] = React.useState<Record<string, {
    enabled: boolean
    messageTemplate: string
    adminIds: string[]
  }>>({})

  // Track which configs have unsaved changes
  const [dirty, setDirty] = React.useState<Set<string>>(new Set())

  // Load configs and admin list
  const loadData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [configsData, adminsRes] = await Promise.all([
        getAdminEventNotifications(),
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .eq('is_admin', true)
          .order('display_name'),
      ])

      setConfigs(configsData)
      setAdmins(
        (adminsRes.data || []).map((a) => ({
          id: String(a.id),
          displayName: a.display_name || null,
          avatarUrl: a.avatar_url || null,
        }))
      )

      // Initialize edits from loaded data
      const initialEdits: typeof edits = {}
      for (const c of configsData) {
        initialEdits[c.eventType] = {
          enabled: c.enabled,
          messageTemplate: c.messageTemplate,
          adminIds: [...c.adminIds],
        }
      }
      setEdits(initialEdits)
      setDirty(new Set())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load admin event notification settings')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  // Update a local edit field
  const updateEdit = React.useCallback((eventType: string, field: string, value: unknown) => {
    setEdits((prev) => ({
      ...prev,
      [eventType]: {
        ...prev[eventType],
        [field]: value,
      },
    }))
    setDirty((prev) => new Set(prev).add(eventType))
  }, [])

  // Toggle an admin in the admin list for a given event type
  const toggleAdmin = React.useCallback((eventType: string, adminId: string) => {
    setEdits((prev) => {
      const current = prev[eventType]?.adminIds || []
      const next = current.includes(adminId)
        ? current.filter((id) => id !== adminId)
        : [...current, adminId]
      return {
        ...prev,
        [eventType]: {
          ...prev[eventType],
          adminIds: next,
        },
      }
    })
    setDirty((prev) => new Set(prev).add(eventType))
  }, [])

  // Save a single event config
  const handleSave = React.useCallback(async (eventType: AdminEventType) => {
    const edit = edits[eventType]
    if (!edit) return

    setSaving(eventType)
    try {
      const updated = await updateAdminEventNotification(eventType, {
        enabled: edit.enabled,
        messageTemplate: edit.messageTemplate,
        adminIds: edit.adminIds,
      })
      // Update local configs
      setConfigs((prev) =>
        prev.map((c) => (c.eventType === eventType ? updated : c))
      )
      setDirty((prev) => {
        const next = new Set(prev)
        next.delete(eventType)
        return next
      })
    } catch (e: unknown) {
      console.error('Failed to save:', e)
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(null)
    }
  }, [edits])

  // Insert variable at cursor in textarea
  const insertVariable = React.useCallback((eventType: string, variableKey: string) => {
    const textareaId = `template-${eventType}`
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null
    const tag = `{{${variableKey}}}`

    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const current = edits[eventType]?.messageTemplate || ''
      const newValue = current.substring(0, start) + tag + current.substring(end)
      updateEdit(eventType, 'messageTemplate', newValue)
      // Restore cursor after React re-render
      requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(start + tag.length, start + tag.length)
      })
    } else {
      // Fallback: append
      const current = edits[eventType]?.messageTemplate || ''
      updateEdit(eventType, 'messageTemplate', current + tag)
    }
  }, [edits, updateEdit])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BellRing className="h-5 w-5 text-emerald-500" />
            Admin Event Notifications
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Configure push notifications sent to admins when special events occur.
            Each event has its own toggle, message template, and list of admin recipients.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="icon" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Event cards */}
      {configs.length === 0 ? (
        <div className="text-center py-12">
          <BellRing className="h-12 w-12 text-stone-300 dark:text-stone-600 mx-auto mb-4" />
          <p className="text-stone-500 dark:text-stone-400">
            No event notification configs found. Run the database migration to seed default configs.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {configs.map((config) => {
            const edit = edits[config.eventType]
            if (!edit) return null
            const isDirty = dirty.has(config.eventType)
            const isSaving = saving === config.eventType
            const variables = ADMIN_EVENT_VARIABLES[config.eventType] || []

            return (
              <Card key={config.eventType} className="rounded-xl overflow-hidden">
                <CardContent className="p-0">
                  {/* Card header */}
                  <div className="flex items-center justify-between p-5 border-b border-stone-200 dark:border-stone-700">
                    <div className="flex items-center gap-3">
                      {EVENT_ICONS[config.eventType]}
                      <div>
                        <h3 className="font-semibold text-base">
                          {ADMIN_EVENT_LABELS[config.eventType]}
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          {ADMIN_EVENT_DESCRIPTIONS[config.eventType]}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isDirty && (
                        <Badge variant="outline" className="text-amber-600 bg-amber-50 dark:bg-amber-900/20 text-xs">
                          Unsaved
                        </Badge>
                      )}
                      <Switch
                        checked={edit.enabled}
                        onCheckedChange={(checked) => updateEdit(config.eventType, 'enabled', checked)}
                      />
                    </div>
                  </div>

                  {/* Card body */}
                  <div className={cn('p-5 space-y-5', !edit.enabled && 'opacity-50 pointer-events-none')}>
                    {/* Admin selection */}
                    <div>
                      <label className="text-sm font-medium flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-stone-500" />
                        Admins to Notify
                      </label>
                      {admins.length === 0 ? (
                        <p className="text-sm text-stone-400 italic">No admin users found</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {admins.map((admin) => {
                            const isSelected = edit.adminIds.includes(admin.id)
                            return (
                              <button
                                key={admin.id}
                                type="button"
                                className={cn(
                                  'flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-sm',
                                  isSelected
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                    : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 text-stone-600 dark:text-stone-400'
                                )}
                                onClick={() => toggleAdmin(config.eventType, admin.id)}
                              >
                                {admin.avatarUrl ? (
                                  <img
                                    src={admin.avatarUrl}
                                    alt=""
                                    className="w-6 h-6 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center">
                                    <User className="h-3 w-3 text-stone-500" />
                                  </div>
                                )}
                                <span>{admin.displayName || 'Admin'}</span>
                                {isSelected && <Check className="h-4 w-4 text-emerald-500" />}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {edit.adminIds.length === 0 && edit.enabled && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                          No admins selected — notifications won't be sent.
                        </p>
                      )}
                    </div>

                    {/* Message template */}
                    <div>
                      <label
                        htmlFor={`template-${config.eventType}`}
                        className="text-sm font-medium flex items-center gap-2 mb-2"
                      >
                        <Code className="h-4 w-4 text-stone-500" />
                        Message Template
                      </label>
                      <Textarea
                        id={`template-${config.eventType}`}
                        value={edit.messageTemplate}
                        onChange={(e) => updateEdit(config.eventType, 'messageTemplate', e.target.value)}
                        placeholder="Enter notification message..."
                        rows={3}
                        className="rounded-xl text-sm font-mono"
                      />
                    </div>

                    {/* Available variables */}
                    <div>
                      <label className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-2 block">
                        Available Variables (click to insert)
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {variables.map((v) => (
                          <button
                            key={v.key}
                            type="button"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-mono transition-colors group"
                            onClick={() => insertVariable(config.eventType, v.key)}
                            title={v.description}
                          >
                            <span className="text-emerald-600 dark:text-emerald-400">{`{{${v.key}}}`}</span>
                            <span className="text-stone-400 dark:text-stone-500 hidden sm:inline">
                              — {v.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preview */}
                    {edit.messageTemplate && (
                      <div>
                        <label className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-2 block">
                          Preview
                        </label>
                        <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 text-sm text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700">
                          {renderPreview(edit.messageTemplate, config.eventType)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card footer */}
                  <div className="flex items-center justify-end gap-2 p-4 border-t border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/30">
                    <Button
                      variant="default"
                      size="sm"
                      className="rounded-xl"
                      disabled={!isDirty || isSaving}
                      onClick={() => handleSave(config.eventType)}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Render a preview with sample values replacing variables */
function renderPreview(template: string, eventType: AdminEventType): string {
  const sampleValues: Record<AdminEventType, Record<string, string>> = {
    user_report: {
      reporter_name: 'JaneDoe',
      reported_user_name: 'JohnSmith',
      reason: 'Inappropriate behavior',
      report_id: 'abc-123',
    },
    bug_report: {
      reporter_name: 'JaneDoe',
      bug_name: 'Login button not working',
      description: 'The login button does not respond on mobile',
      report_id: 'bug-456',
    },
    plant_report: {
      reporter_name: 'JaneDoe',
      plant_name: 'Monstera Deliciosa',
      note: 'Watering frequency seems incorrect',
      report_id: 'pr-789',
    },
    plant_request: {
      requester_name: 'JaneDoe',
      plant_name: 'Philodendron Pink Princess',
      request_count: '3',
    },
  }

  let preview = template
  const samples = sampleValues[eventType] || {}
  for (const [key, value] of Object.entries(samples)) {
    preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return preview
}
