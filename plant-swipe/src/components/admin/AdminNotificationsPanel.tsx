import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabaseClient'
import {
  BellRing,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Edit,
  Plus,
  Clock,
  Send,
} from 'lucide-react'

const deliveryModeOptions = [
  { value: 'send_now', label: 'Send now' },
  { value: 'planned', label: 'Planned (one-time)' },
  { value: 'scheduled', label: 'Scheduled (recurring)' },
] as const

const audienceOptions = [
  { value: 'all', label: 'All users' },
  { value: 'tasks_open', label: 'Users with incomplete tasks today' },
  { value: 'inactive_week', label: 'Inactive for 7 days' },
  { value: 'admins', label: 'Admins only' },
  { value: 'custom', label: 'Custom user IDs' },
] as const

const scheduleIntervals = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const

type AdminNotification = {
  id: string
  title: string
  description: string | null
  audience: string
  deliveryMode: string
  state: string
  messageVariants: string[]
  randomize: boolean
  timezone: string | null
  plannedFor: string | null
  scheduleStartAt: string | null
  scheduleInterval: string | null
  ctaUrl: string | null
  customUserIds: string[]
  runCount: number
  nextRunAt: string | null
  lastRunAt: string | null
  stats: { total: number; sent: number; pending: number; failed: number }
}

type FormState = {
  title: string
  description: string
  deliveryMode: 'send_now' | 'planned' | 'scheduled'
  audience: 'all' | 'tasks_open' | 'inactive_week' | 'admins' | 'custom'
  timezone: string
  messageVariantsText: string
  randomize: boolean
  plannedFor: string
  scheduleStart: string
  scheduleInterval: 'daily' | 'weekly' | 'monthly'
  ctaUrl: string
  customUserIds: string
}

const defaultFormState = (): FormState => ({
  title: '',
  description: '',
  deliveryMode: 'send_now',
  audience: 'all',
  timezone:
    (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC',
  messageVariantsText: '',
  randomize: true,
  plannedFor: '',
  scheduleStart: '',
  scheduleInterval: 'daily',
  ctaUrl: '',
  customUserIds: '',
})

function isoToInputValue(value?: string | null): string {
  if (!value) return ''
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (n: number) => n.toString().padStart(2, '0')
    const yyyy = date.getFullYear()
    const mm = pad(date.getMonth() + 1)
    const dd = pad(date.getDate())
    const hh = pad(date.getHours())
    const min = pad(date.getMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`
  } catch {
    return ''
  }
}

function inputToIso(value: string): string | null {
  if (!value || value.trim().length === 0) return null
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString()
  } catch {
    return null
  }
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

async function buildAdminHeaders() {
  const session = (await supabase.auth.getSession()).data.session
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
  if (adminToken) headers['X-Admin-Token'] = adminToken
  return headers
}

const audienceLabels: Record<string, string> = audienceOptions.reduce((acc, option) => {
  acc[option.value] = option.label
  return acc
}, {} as Record<string, string>)

const deliveryLabels: Record<string, string> = deliveryModeOptions.reduce((acc, option) => {
  acc[option.value] = option.label
  return acc
}, {} as Record<string, string>)

export function AdminNotificationsPanel() {
  const [notifications, setNotifications] = React.useState<AdminNotification[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [pushConfigured, setPushConfigured] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)
  const [formMode, setFormMode] = React.useState<'create' | 'edit'>('create')
  const [formState, setFormState] = React.useState<FormState>(defaultFormState)
  const [submitting, setSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)

  const loadNotifications = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await buildAdminHeaders()
      const resp = await fetch('/api/admin/notifications', {
        headers,
        credentials: 'same-origin',
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Failed to load notifications')
      const list: AdminNotification[] = Array.isArray(data?.notifications)
        ? data.notifications
        : []
      setNotifications(list)
      setPushConfigured(Boolean(data?.pushConfigured ?? true))
    } catch (err) {
      setError((err as Error)?.message || 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadNotifications().catch(() => {})
  }, [loadNotifications])

  const openCreateForm = React.useCallback(() => {
    setFormMode('create')
    setFormState(defaultFormState())
    setEditingId(null)
    setFormError(null)
    setFormOpen(true)
  }, [])

  const openEditForm = React.useCallback((notification: AdminNotification) => {
    setFormMode('edit')
    setEditingId(notification.id)
    setFormError(null)
    setFormState({
      title: notification.title,
      description: notification.description || '',
      deliveryMode: notification.deliveryMode as FormState['deliveryMode'],
      audience: (notification.audience as FormState['audience']) || 'all',
      timezone: notification.timezone ||
        ((typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC'),
      messageVariantsText: notification.messageVariants.join('\n'),
      randomize: notification.randomize,
      plannedFor: isoToInputValue(notification.plannedFor),
      scheduleStart: isoToInputValue(notification.scheduleStartAt),
      scheduleInterval: (notification.scheduleInterval as FormState['scheduleInterval']) || 'daily',
      ctaUrl: notification.ctaUrl || '',
      customUserIds: (notification.customUserIds || []).join('\n'),
    })
    setFormOpen(true)
  }, [])

  const handleFormChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const target = event.target
      const { name, value, type } = target
      const nextValue = type === 'checkbox' && 'checked' in target ? (target as HTMLInputElement).checked : value
      setFormState((prev) => ({
        ...prev,
        [name]: nextValue,
      }))
    },
    [],
  )

  const submitForm = React.useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    setFormError(null)
    try {
      const messageVariants = formState.messageVariantsText
        .split(/\n+/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
      if (!messageVariants.length) {
        setFormError('Add at least one message variant')
        setSubmitting(false)
        return
      }
      const payload = {
        title: formState.title.trim(),
        description: formState.description.trim() || undefined,
        deliveryMode: formState.deliveryMode,
        audience: formState.audience,
        messageVariants,
        randomize: formState.randomize,
        timezone: formState.timezone,
        plannedFor:
          formState.deliveryMode === 'planned' ? inputToIso(formState.plannedFor) || undefined : undefined,
        scheduleStartAt:
          formState.deliveryMode === 'scheduled'
            ? inputToIso(formState.scheduleStart || formState.plannedFor) || undefined
            : undefined,
        scheduleInterval: formState.deliveryMode === 'scheduled' ? formState.scheduleInterval : undefined,
        ctaUrl: formState.ctaUrl.trim() || undefined,
        customUserIds:
          formState.audience === 'custom'
            ? formState.customUserIds
                .split(/\n+/)
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
            : [],
      }
      const headers = await buildAdminHeaders()
      const endpoint =
        formMode === 'create'
          ? '/api/admin/notifications'
          : `/api/admin/notifications/${encodeURIComponent(editingId || '')}`
      const method = formMode === 'create' ? 'POST' : 'PUT'
      const resp = await fetch(endpoint, {
        method,
        headers,
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Failed to save notification')
      setFormOpen(false)
      setFormState(defaultFormState())
      setEditingId(null)
      loadNotifications().catch(() => {})
    } catch (err) {
      setFormError((err as Error)?.message || 'Failed to save notification')
    } finally {
      setSubmitting(false)
    }
  }, [editingId, formMode, formState, loadNotifications, submitting])

  const deleteNotification = React.useCallback(
    async (notification: AdminNotification) => {
      if (!window.confirm(`Delete notification "${notification.title}"?`)) return
      try {
        const headers = await buildAdminHeaders()
        const resp = await fetch(`/api/admin/notifications/${encodeURIComponent(notification.id)}`, {
          method: 'DELETE',
          headers,
          credentials: 'same-origin',
        })
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(data?.error || 'Failed to delete notification')
        loadNotifications().catch(() => {})
      } catch (err) {
        alert((err as Error)?.message || 'Failed to delete notification')
      }
    },
    [loadNotifications],
  )

  const triggerNotification = React.useCallback(
    async (notification: AdminNotification) => {
      try {
        const headers = await buildAdminHeaders()
        const resp = await fetch(`/api/admin/notifications/${encodeURIComponent(notification.id)}/trigger`, {
          method: 'POST',
          headers,
          credentials: 'same-origin',
        })
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(data?.error || 'Failed to trigger notification')
        loadNotifications().catch(() => {})
      } catch (err) {
        alert((err as Error)?.message || 'Failed to trigger notification')
      }
    },
    [loadNotifications],
  )

  const toggleState = React.useCallback(
    async (notification: AdminNotification) => {
      const nextState = notification.state === 'paused' ? 'scheduled' : 'paused'
      try {
        const headers = await buildAdminHeaders()
        const resp = await fetch(`/api/admin/notifications/${encodeURIComponent(notification.id)}/state`, {
          method: 'POST',
          headers,
          credentials: 'same-origin',
          body: JSON.stringify({ state: nextState }),
        })
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(data?.error || 'Failed to update state')
        loadNotifications().catch(() => {})
      } catch (err) {
        alert((err as Error)?.message || 'Failed to update notification state')
      }
    },
    [loadNotifications],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BellRing className="h-5 w-5 text-emerald-600" /> Notifications
          </h2>
          <p className="text-sm text-muted-foreground">
            Plan, edit, and schedule push notifications for Aphylia users.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-2xl" onClick={() => loadNotifications()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button className="rounded-2xl" onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" /> New notification
          </Button>
        </div>
      </div>

      {!pushConfigured && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-3xl">
          <CardContent className="py-4">
            <div className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Push delivery is disabled. Add VAPID keys to enable live notifications.
            </div>
            <div className="text-xs text-amber-700 dark:text-amber-200 mt-1">
              Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY on the server to allow the PWA to receive notifications.
            </div>
          </CardContent>
        </Card>
      )}

      {error && <div className="text-sm text-rose-500">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading notifications…</div>
      ) : notifications.length === 0 ? (
        <Card className="rounded-3xl">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No notifications yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {notifications.map((notification) => (
            <Card key={notification.id} className="rounded-3xl">
              <CardContent className="py-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{notification.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {deliveryLabels[notification.deliveryMode] || notification.deliveryMode}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="rounded-full px-3 py-1 capitalize">{notification.state}</Badge>
                    <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => openEditForm(notification)}>
                      <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-2xl"
                      onClick={() => triggerNotification(notification)}
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" /> Send now
                    </Button>
                    {notification.deliveryMode === 'scheduled' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-2xl"
                        onClick={() => toggleState(notification)}
                      >
                        {notification.state === 'paused' ? (
                          <>
                            <Play className="mr-1.5 h-3.5 w-3.5" /> Resume
                          </>
                        ) : (
                          <>
                            <Pause className="mr-1.5 h-3.5 w-3.5" /> Pause
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-2xl border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => deleteNotification(notification)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
                {notification.description && (
                  <div className="text-sm text-muted-foreground">{notification.description}</div>
                )}
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Audience</div>
                    <div>{audienceLabels[notification.audience] || notification.audience}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Next run</div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDateTime(notification.nextRunAt)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Last run</div>
                    <div>{formatDateTime(notification.lastRunAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Stats</div>
                    <div className="text-sm">
                      Sent {notification.stats.sent}/{notification.stats.total} · Pending {notification.stats.pending}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Messages</div>
                  <div className="flex flex-wrap gap-2">
                    {notification.messageVariants.map((msg) => (
                      <span
                        key={msg}
                        className="rounded-2xl border bg-muted/50 px-3 py-1 text-xs text-muted-foreground"
                      >
                        {msg}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle>{formMode === 'create' ? 'Create notification' : 'Edit notification'}</DialogTitle>
            <DialogDescription>
              Configure the schedule, audience, and messages that will be delivered to users.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              name="title"
              value={formState.title}
              onChange={handleFormChange}
              placeholder="Title"
            />
            <Textarea
              name="description"
              value={formState.description}
              onChange={handleFormChange}
              placeholder="Internal description"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium flex flex-col gap-2">
                Delivery mode
                <Select name="deliveryMode" value={formState.deliveryMode} onChange={handleFormChange as any}>
                  {deliveryModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-sm font-medium flex flex-col gap-2">
                Audience
                <Select name="audience" value={formState.audience} onChange={handleFormChange as any}>
                  {audienceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            {formState.deliveryMode === 'planned' && (
              <label className="text-sm font-medium flex flex-col gap-2">
                Planned date/time
                <Input
                  type="datetime-local"
                  name="plannedFor"
                  value={formState.plannedFor}
                  onChange={handleFormChange}
                />
              </label>
            )}
            {formState.deliveryMode === 'scheduled' && (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm font-medium flex flex-col gap-2">
                  First run
                  <Input
                    type="datetime-local"
                    name="scheduleStart"
                    value={formState.scheduleStart}
                    onChange={handleFormChange}
                  />
                </label>
                <label className="text-sm font-medium flex flex-col gap-2">
                  Repeat
                  <Select
                    name="scheduleInterval"
                    value={formState.scheduleInterval}
                    onChange={handleFormChange as any}
                  >
                    {scheduleIntervals.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            )}
            {formState.audience === 'custom' && (
              <label className="text-sm font-medium flex flex-col gap-2">
                Custom user IDs (one per line)
                <Textarea
                  name="customUserIds"
                  value={formState.customUserIds}
                  onChange={handleFormChange}
                  placeholder="uuid-1\nuuid-2"
                />
              </label>
            )}
            <label className="text-sm font-medium flex flex-col gap-2">
              Message variants (one per line)
              <Textarea
                name="messageVariantsText"
                value={formState.messageVariantsText}
                onChange={handleFormChange}
                placeholder="Reminder text..."
              />
            </label>
            <label className="text-sm font-medium flex flex-col gap-2">
              CTA URL (optional)
              <Input name="ctaUrl" value={formState.ctaUrl} onChange={handleFormChange} placeholder="https://…" />
            </label>
            {formError && <div className="text-sm text-rose-500">{formError}</div>}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-2xl" onClick={submitForm} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save notification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminNotificationsPanel
