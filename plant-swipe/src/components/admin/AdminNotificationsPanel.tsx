import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
  Users,
  Calendar,
  MessageSquare,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Zap,
  Info,
  X,
} from 'lucide-react'

const deliveryModeOptions = [
  { value: 'send_now', label: 'Send now', icon: Zap },
  { value: 'planned', label: 'Planned (one-time)', icon: Calendar },
  { value: 'scheduled', label: 'Scheduled (recurring)', icon: Clock },
] as const

const audienceOptions = [
  { value: 'all', label: 'All users', icon: Users },
  { value: 'tasks_open', label: 'Users with incomplete tasks today', icon: CheckCircle2 },
  { value: 'inactive_week', label: 'Inactive for 7 days', icon: AlertCircle },
  { value: 'admins', label: 'Admins only', icon: Users },
  { value: 'custom', label: 'Custom user IDs', icon: Users },
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
  messageVariants: string[]
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
  messageVariants: [],
  randomize: true,
  plannedFor: '',
  scheduleStart: '',
  scheduleInterval: 'daily',
  ctaUrl: '',
  customUserIds: '',
})

const TEMPLATE_VARIABLES = [
  { variable: '{{user}}', description: 'User name or display name' },
  { variable: '{{username}}', description: 'Username' },
  { variable: '{{email}}', description: 'User email address' },
  { variable: '{{garden}}', description: 'Garden name' },
  { variable: '{{plant}}', description: 'Plant name' },
  { variable: '{{task}}', description: 'Task name' },
  { variable: '{{count}}', description: 'Count or number' },
]

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

const getStateColor = (state: string) => {
  switch (state) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800'
    case 'paused':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800'
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-800'
  }
}

const getDeliveryModeColor = (mode: string) => {
  switch (mode) {
    case 'send_now':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    case 'planned':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
    case 'scheduled':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
  }
}

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
  const [editingVariantIndex, setEditingVariantIndex] = React.useState<number | null>(null)
  const [newVariantText, setNewVariantText] = React.useState('')
  const [showTemplateInfo, setShowTemplateInfo] = React.useState(false)

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
    setEditingVariantIndex(null)
    setNewVariantText('')
    setFormOpen(true)
  }, [])

  const openEditForm = React.useCallback((notification: AdminNotification) => {
    setFormMode('edit')
    setEditingId(notification.id)
    setFormError(null)
    setEditingVariantIndex(null)
    setNewVariantText('')
    setFormState({
      title: notification.title,
      description: notification.description || '',
      deliveryMode: notification.deliveryMode as FormState['deliveryMode'],
      audience: (notification.audience as FormState['audience']) || 'all',
      timezone: notification.timezone ||
        ((typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC'),
      messageVariants: [...notification.messageVariants],
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

  const addMessageVariant = React.useCallback(() => {
    const text = newVariantText.trim()
    if (!text) return
    setFormState((prev) => ({
      ...prev,
      messageVariants: [...prev.messageVariants, text],
    }))
    setNewVariantText('')
  }, [newVariantText])

  const updateMessageVariant = React.useCallback((index: number, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setFormState((prev) => {
      const updated = [...prev.messageVariants]
      updated[index] = trimmed
      return { ...prev, messageVariants: updated }
    })
    setEditingVariantIndex(null)
  }, [])

  const deleteMessageVariant = React.useCallback((index: number) => {
    setFormState((prev) => ({
      ...prev,
      messageVariants: prev.messageVariants.filter((_, i) => i !== index),
    }))
    if (editingVariantIndex === index) {
      setEditingVariantIndex(null)
    }
  }, [editingVariantIndex])

  const startEditingVariant = React.useCallback((index: number) => {
    setEditingVariantIndex(index)
    setNewVariantText(formState.messageVariants[index])
  }, [formState.messageVariants])

  const cancelEditingVariant = React.useCallback(() => {
    setEditingVariantIndex(null)
    setNewVariantText('')
  }, [])

  const submitForm = React.useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    setFormError(null)
    try {
      const messageVariants = formState.messageVariants.filter((v) => v.trim().length > 0)
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
      setEditingVariantIndex(null)
      setNewVariantText('')
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

  const DeliveryModeIcon = deliveryModeOptions.find((opt) => opt.value === formState.deliveryMode)?.icon || Clock
  const AudienceIcon = audienceOptions.find((opt) => opt.value === formState.audience)?.icon || Users

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BellRing className="h-6 w-6 text-emerald-600" /> 
            Push Notifications
          </h2>
          <p className="text-sm text-muted-foreground">
            Create, schedule, and manage push notifications for your users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="rounded-xl" 
            onClick={() => loadNotifications()} 
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> 
            Refresh
          </Button>
          <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" /> 
            New Notification
          </Button>
        </div>
      </div>

      {/* Push Configuration Warning */}
      {!pushConfigured && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Push delivery is disabled
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-200 mt-1">
                  Add VAPID keys to enable live notifications. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY on the server.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-900/20 rounded-xl">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-sm text-red-800 dark:text-red-200">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading ? (
        <Card className="rounded-xl">
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
            <div className="text-sm text-muted-foreground">Loading notifications…</div>
          </CardContent>
        </Card>
      ) : notifications.length === 0 ? (
        /* Empty State */
        <Card className="rounded-xl">
          <CardContent className="py-16 text-center">
            <BellRing className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No notifications yet</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Get started by creating your first push notification
            </p>
            <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={openCreateForm}>
              <Plus className="mr-2 h-4 w-4" /> 
              Create Notification
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Notifications List */
        <div className="grid gap-4">
          {notifications.map((notification) => {
            const DeliveryIcon = deliveryModeOptions.find((opt) => opt.value === notification.deliveryMode)?.icon || Clock
            const AudienceIconComponent = audienceOptions.find((opt) => opt.value === notification.audience)?.icon || Users
            
            return (
              <Card key={notification.id} className="rounded-xl border-2 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors">
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <CardTitle className="text-lg font-bold mb-1">
                            {notification.title}
                          </CardTitle>
                          {notification.description && (
                            <CardDescription className="text-sm mt-1">
                              {notification.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`rounded-full px-3 py-1 text-xs font-medium border ${getDeliveryModeColor(notification.deliveryMode)}`}>
                          <DeliveryIcon className="h-3 w-3 mr-1.5 inline" />
                          {deliveryLabels[notification.deliveryMode] || notification.deliveryMode}
                        </Badge>
                        <Badge className={`rounded-full px-3 py-1 text-xs font-medium border capitalize ${getStateColor(notification.state)}`}>
                          {notification.state === 'paused' ? (
                            <Pause className="h-3 w-3 mr-1.5 inline" />
                          ) : notification.state === 'scheduled' ? (
                            <Clock className="h-3 w-3 mr-1.5 inline" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 mr-1.5 inline" />
                          )}
                          {notification.state}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl" 
                        onClick={() => openEditForm(notification)}
                      >
                        <Edit className="mr-1.5 h-3.5 w-3.5" /> 
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => triggerNotification(notification)}
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" /> 
                        Send
                      </Button>
                      {notification.deliveryMode === 'scheduled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => toggleState(notification)}
                        >
                          {notification.state === 'paused' ? (
                            <>
                              <Play className="mr-1.5 h-3.5 w-3.5" /> 
                              Resume
                            </>
                          ) : (
                            <>
                              <Pause className="mr-1.5 h-3.5 w-3.5" /> 
                              Pause
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => deleteNotification(notification)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0 space-y-4">
                  {/* Audience & Schedule Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <AudienceIconComponent className="h-3.5 w-3.5" />
                        Audience
                      </div>
                      <div className="text-sm font-medium">
                        {audienceLabels[notification.audience] || notification.audience}
                      </div>
                      {notification.audience === 'custom' && notification.customUserIds.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {notification.customUserIds.length} user{notification.customUserIds.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    
                    {notification.nextRunAt && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          Next Run
                        </div>
                        <div className="text-sm font-medium">
                          {formatDateTime(notification.nextRunAt)}
                        </div>
                      </div>
                    )}
                    
                    {notification.lastRunAt && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Last Run
                        </div>
                        <div className="text-sm font-medium">
                          {formatDateTime(notification.lastRunAt)}
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Statistics
                      </div>
                      <div className="text-sm font-medium">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {notification.stats.sent}
                        </span>
                        {' / '}
                        <span className="text-muted-foreground">
                          {notification.stats.total}
                        </span>
                        {' sent'}
                      </div>
                      {notification.stats.pending > 0 && (
                        <div className="text-xs text-amber-600 dark:text-amber-400">
                          {notification.stats.pending} pending
                        </div>
                      )}
                      {notification.stats.failed > 0 && (
                        <div className="text-xs text-red-600 dark:text-red-400">
                          {notification.stats.failed} failed
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Message Variants */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Message Variants ({notification.messageVariants.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {notification.messageVariants.map((msg, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border bg-muted/50 px-3 py-2 text-sm text-foreground max-w-full"
                        >
                          <span className="break-words">{msg}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA URL */}
                  {notification.ctaUrl && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <LinkIcon className="h-3.5 w-3.5" />
                        Call-to-Action
                      </div>
                      <a 
                        href={notification.ctaUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline break-all"
                      >
                        {notification.ctaUrl}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog 
        open={formOpen} 
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditingVariantIndex(null)
            setNewVariantText('')
            setShowTemplateInfo(false)
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {formMode === 'create' ? 'Create New Notification' : 'Edit Notification'}
            </DialogTitle>
            <DialogDescription>
              Configure the schedule, audience, and messages that will be delivered to users.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b pb-2">
                Basic Information
              </h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    name="title"
                    value={formState.title}
                    onChange={handleFormChange}
                    placeholder="e.g., Daily Reminder"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Internal Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formState.description}
                    onChange={handleFormChange}
                    placeholder="Optional internal note about this notification"
                    className="rounded-xl min-h-[80px]"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b pb-2">
                Delivery Settings
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="deliveryMode" className="flex items-center gap-2">
                    <DeliveryModeIcon className="h-4 w-4" />
                    Delivery Mode *
                  </Label>
                  <Select 
                    id="deliveryMode"
                    name="deliveryMode" 
                    value={formState.deliveryMode} 
                    onChange={handleFormChange as any}
                    className="rounded-xl"
                  >
                    {deliveryModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="audience" className="flex items-center gap-2">
                    <AudienceIcon className="h-4 w-4" />
                    Audience *
                  </Label>
                  <Select 
                    id="audience"
                    name="audience" 
                    value={formState.audience} 
                    onChange={handleFormChange as any}
                    className="rounded-xl"
                  >
                    {audienceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Planned Date/Time */}
              {formState.deliveryMode === 'planned' && (
                <div className="space-y-2">
                  <Label htmlFor="plannedFor" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Planned Date & Time *
                  </Label>
                  <Input
                    id="plannedFor"
                    type="datetime-local"
                    name="plannedFor"
                    value={formState.plannedFor}
                    onChange={handleFormChange}
                    className="rounded-xl"
                  />
                </div>
              )}

              {/* Scheduled Settings */}
              {formState.deliveryMode === 'scheduled' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="scheduleStart" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      First Run Date & Time *
                    </Label>
                    <Input
                      id="scheduleStart"
                      type="datetime-local"
                      name="scheduleStart"
                      value={formState.scheduleStart}
                      onChange={handleFormChange}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduleInterval" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Repeat Interval *
                    </Label>
                    <Select
                      id="scheduleInterval"
                      name="scheduleInterval"
                      value={formState.scheduleInterval}
                      onChange={handleFormChange as any}
                      className="rounded-xl"
                    >
                      {scheduleIntervals.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              )}

              {/* Custom User IDs */}
              {formState.audience === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="customUserIds" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Custom User IDs *
                  </Label>
                  <Textarea
                    id="customUserIds"
                    name="customUserIds"
                    value={formState.customUserIds}
                    onChange={handleFormChange}
                    placeholder="Enter one user ID per line&#10;uuid-1&#10;uuid-2"
                    className="rounded-xl min-h-[100px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter one user ID per line
                  </p>
                </div>
              )}
            </div>

            {/* Message Content */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b pb-2">
                Message Content
              </h3>
              <div className="space-y-4">
                {/* Message Variants List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Message Variants * ({formState.messageVariants.length})
                    </Label>
                    <div className="relative">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl h-8 w-8 p-0"
                        onMouseEnter={() => setShowTemplateInfo(true)}
                        onMouseLeave={() => setShowTemplateInfo(false)}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                      {showTemplateInfo && (
                        <div 
                          className="absolute right-0 top-full mt-2 z-50 w-80 bg-card border border-border rounded-xl shadow-lg p-4"
                          onMouseEnter={() => setShowTemplateInfo(true)}
                          onMouseLeave={() => setShowTemplateInfo(false)}
                        >
                          <div className="text-sm font-semibold mb-3 text-foreground">Available Template Variables</div>
                          <div className="space-y-2.5 text-xs">
                            {TEMPLATE_VARIABLES.map((item) => (
                              <div key={item.variable} className="flex items-start gap-2">
                                <code className="bg-muted px-2 py-1 rounded text-emerald-600 dark:text-emerald-400 font-mono text-xs flex-shrink-0">
                                  {item.variable}
                                </code>
                                <span className="text-muted-foreground flex-1 pt-0.5">{item.description}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                            Use these variables in your messages to personalize notifications
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Variants List */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {formState.messageVariants.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-xl">
                        No message variants yet. Add one below.
                      </div>
                    ) : (
                      formState.messageVariants.map((variant, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 p-3 border rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          {editingVariantIndex === index ? (
                            <div className="flex-1 space-y-2">
                              <Textarea
                                value={newVariantText}
                                onChange={(e) => setNewVariantText(e.target.value)}
                                placeholder="Enter message variant..."
                                className="rounded-xl min-h-[60px] text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                    e.preventDefault()
                                    updateMessageVariant(index, newVariantText)
                                  }
                                  if (e.key === 'Escape') {
                                    cancelEditingVariant()
                                  }
                                }}
                                autoFocus
                              />
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl h-8"
                                  onClick={() => updateMessageVariant(index, newVariantText)}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                  Save
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl h-8"
                                  onClick={cancelEditingVariant}
                                >
                                  <X className="h-3.5 w-3.5 mr-1.5" />
                                  Cancel
                                </Button>
                                <span className="text-xs text-muted-foreground ml-auto">
                                  Press Ctrl+Enter to save
                                </span>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-foreground break-words">
                                  {variant}
                                </div>
                                {variant.includes('{{') && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {TEMPLATE_VARIABLES
                                      .filter((tv) => variant.includes(tv.variable))
                                      .map((tv) => (
                                        <Badge
                                          key={tv.variable}
                                          variant="outline"
                                          className="text-xs px-1.5 py-0"
                                        >
                                          {tv.variable}
                                        </Badge>
                                      ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-xl h-8 w-8 p-0"
                                  onClick={() => startEditingVariant(index)}
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-xl h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  onClick={() => deleteMessageVariant(index)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add New Variant */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={newVariantText}
                        onChange={(e) => setNewVariantText(e.target.value)}
                        placeholder="Enter new message variant..."
                        className="rounded-xl flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            addMessageVariant()
                          }
                        }}
                      />
                      <Button
                        type="button"
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                        onClick={addMessageVariant}
                        disabled={!newVariantText.trim()}
                      >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Add
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formState.randomize 
                        ? 'One message will be randomly selected for each user'
                        : 'The first message will be used for all users'}
                      {' • '}
                      Press Enter to add
                    </p>
                  </div>
                </div>

                {/* CTA URL */}
                <div className="space-y-2">
                  <Label htmlFor="ctaUrl" className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Call-to-Action URL (Optional)
                  </Label>
                  <Input
                    id="ctaUrl"
                    name="ctaUrl"
                    value={formState.ctaUrl}
                    onChange={handleFormChange}
                    placeholder="https://example.com/action"
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    URL to open when users tap the notification
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 p-3">
                <div className="flex items-center gap-2 text-sm text-red-800 dark:text-red-200">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {formError}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button 
              variant="outline" 
              className="rounded-xl" 
              onClick={() => {
                setFormOpen(false)
                setEditingVariantIndex(null)
                setNewVariantText('')
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button 
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700" 
              onClick={submitForm} 
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {formMode === 'create' ? 'Create Notification' : 'Save Changes'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminNotificationsPanel
