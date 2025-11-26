import React from 'react'
import { Button } from '@/components/ui/button'
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
  Search,
  Loader2,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const deliveryModeOptions = [
  { value: 'send_now', label: 'Send Instantly', description: 'All users receive immediately', icon: Zap, color: 'purple' },
  { value: 'planned', label: 'Planned', description: 'One-time, timezone-aware', icon: Calendar, color: 'indigo' },
  { value: 'scheduled', label: 'Scheduled', description: 'Recurring, timezone-aware', icon: Clock, color: 'emerald' },
] as const

const audienceOptions = [
  { value: 'all', label: 'All Users', icon: Users },
  { value: 'tasks_open', label: 'Incomplete Tasks Today', icon: CheckCircle2 },
  { value: 'inactive_week', label: 'Inactive 7+ Days', icon: AlertCircle },
  { value: 'admins', label: 'Admins Only', icon: Users },
  { value: 'custom', label: 'Custom User IDs', icon: Users },
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

const DEFAULT_TIMEZONE = 'Europe/London'

const defaultFormState = (): FormState => ({
  title: '',
  description: '',
  deliveryMode: 'send_now',
  audience: 'all',
  timezone:
    (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || DEFAULT_TIMEZONE,
  messageVariants: [],
  randomize: true,
  plannedFor: '',
  scheduleStart: '',
  scheduleInterval: 'daily',
  ctaUrl: '',
  customUserIds: '',
})

const TEMPLATE_VARIABLES = [
  { variable: '{{user}}', description: 'User display name' },
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

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

function formatRelativeTime(value?: string | null): string | null {
  if (!value) return null
  try {
    const date = new Date(value)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffMs < 0) {
      const absDays = Math.abs(diffDays)
      if (absDays === 0) return "Today"
      if (absDays === 1) return "Yesterday"
      return `${absDays} days ago`
    }
    if (diffDays === 0) {
      if (diffHours <= 1) return "In less than an hour"
      return `In ${diffHours} hours`
    }
    if (diffDays === 1) return "Tomorrow"
    return `In ${diffDays} days`
  } catch {
    return null
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

const getStatusConfig = (state: string) => {
  switch (state) {
    case 'scheduled':
      return { label: 'Scheduled', bg: 'bg-blue-500/10', text: 'text-blue-600', dot: 'bg-blue-500' }
    case 'paused':
      return { label: 'Paused', bg: 'bg-amber-500/10', text: 'text-amber-600', dot: 'bg-amber-500' }
    case 'completed':
      return { label: 'Completed', bg: 'bg-emerald-500/10', text: 'text-emerald-600', dot: 'bg-emerald-500' }
    default:
      return { label: state, bg: 'bg-stone-500/10', text: 'text-stone-500', dot: 'bg-stone-400' }
  }
}

const getDeliveryConfig = (mode: string) => {
  switch (mode) {
    case 'send_now':
      return { label: 'Instant', bg: 'bg-purple-500/10', text: 'text-purple-600', Icon: Zap }
    case 'planned':
      return { label: 'Planned', bg: 'bg-indigo-500/10', text: 'text-indigo-600', Icon: Calendar }
    case 'scheduled':
      return { label: 'Scheduled', bg: 'bg-emerald-500/10', text: 'text-emerald-600', Icon: Clock }
    default:
      return { label: mode, bg: 'bg-stone-500/10', text: 'text-stone-500', Icon: Clock }
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
  const [searchQuery, setSearchQuery] = React.useState('')

  // Filter notifications based on search
  const filteredNotifications = React.useMemo(() => {
    if (!searchQuery.trim()) return notifications
    const query = searchQuery.toLowerCase()
    return notifications.filter(n => 
      n.title.toLowerCase().includes(query) ||
      n.messageVariants.some(m => m.toLowerCase().includes(query))
    )
  }, [notifications, searchQuery])

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
        ((typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || DEFAULT_TIMEZONE),
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
          formState.deliveryMode === 'planned' ? (formState.plannedFor || undefined) : undefined,
        scheduleStartAt:
          formState.deliveryMode === 'scheduled'
            ? (formState.scheduleStart || formState.plannedFor || undefined)
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <BellRing className="h-5 w-5 text-white" />
            </div>
            Push Notifications
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">
            Create, schedule, and manage push notifications for your users
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          {notifications.length > 0 && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-10 h-11 rounded-xl border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-[#2a2a2d]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button 
              onClick={openCreateForm}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Notification
            </Button>
          </div>
        </div>
      </div>

      {/* Push Configuration Warning */}
      {!pushConfigured && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100">Push delivery disabled</h3>
              <p className="text-sm text-amber-700 dark:text-amber-200 mt-1">
                Add VAPID keys to enable live notifications. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY on the server.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/20 p-4">
          <div className="flex items-center gap-3 text-sm text-red-800 dark:text-red-200">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            {error}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading notifications...</span>
          </div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 dark:border-[#3e3e42] p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
            <BellRing className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">No notifications yet</h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-6 max-w-sm mx-auto">
            Get started by creating your first push notification
          </p>
          <Button onClick={openCreateForm} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
            <Plus className="mr-2 h-4 w-4" />
            Create Notification
          </Button>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 dark:border-[#3e3e42] p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-stone-400" />
          </div>
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">No results found</h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
            No notifications match "<span className="font-medium">{searchQuery}</span>"
          </p>
          <Button variant="outline" onClick={() => setSearchQuery('')} className="rounded-xl">
            Clear search
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredNotifications.map((notification) => {
            const statusConfig = getStatusConfig(notification.state)
            const deliveryConfig = getDeliveryConfig(notification.deliveryMode)
            const DeliveryIcon = deliveryConfig.Icon
            const relativeTime = formatRelativeTime(notification.nextRunAt)
            
            return (
              <div
                key={notification.id}
                className="group relative rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-5 transition-all hover:border-amber-300 dark:hover:border-amber-800 hover:shadow-lg hover:shadow-amber-500/5"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  {/* Icon */}
                  <div className={cn(
                    "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center",
                    deliveryConfig.bg
                  )}>
                    <DeliveryIcon className={cn("h-5 w-5", deliveryConfig.text)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-semibold text-stone-900 dark:text-white">
                        {notification.title}
                      </h3>
                      <div className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                        statusConfig.bg, statusConfig.text
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig.dot)} />
                        {statusConfig.label}
                      </div>
                      <div className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                        deliveryConfig.bg, deliveryConfig.text
                      )}>
                        {deliveryConfig.label}
                      </div>
                    </div>

                    {notification.description && (
                      <p className="text-sm text-stone-500 dark:text-stone-400 mb-3">
                        {notification.description}
                      </p>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="text-xs font-medium text-stone-400 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                          <Target className="h-3.5 w-3.5" />
                          Audience
                        </div>
                        <div className="text-sm font-medium text-stone-700 dark:text-stone-300">
                          {audienceLabels[notification.audience] || notification.audience}
                        </div>
                      </div>
                      
                      {notification.nextRunAt && (
                        <div>
                          <div className="text-xs font-medium text-stone-400 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                            <Clock className="h-3.5 w-3.5" />
                            Next Run
                          </div>
                          <div className="text-sm font-medium text-stone-700 dark:text-stone-300">
                            {formatDateTime(notification.nextRunAt)}
                            {relativeTime && (
                              <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                                ({relativeTime})
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">
                          Sent
                        </div>
                        <div className="text-sm font-medium">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {notification.stats.sent}
                          </span>
                          <span className="text-stone-400"> / {notification.stats.total}</span>
                          {notification.stats.failed > 0 && (
                            <span className="text-red-500 ml-2">({notification.stats.failed} failed)</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-medium text-stone-400 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Messages
                        </div>
                        <div className="text-sm font-medium text-stone-700 dark:text-stone-300">
                          {notification.messageVariants.length} variant{notification.messageVariants.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    {/* Message Preview */}
                    <div className="flex flex-wrap gap-2">
                      {notification.messageVariants.slice(0, 2).map((msg, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-[#2a2a2d] text-xs text-stone-600 dark:text-stone-400 max-w-xs truncate"
                        >
                          {msg}
                        </div>
                      ))}
                      {notification.messageVariants.length > 2 && (
                        <div className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-[#2a2a2d] text-xs text-stone-500">
                          +{notification.messageVariants.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditForm(notification)}
                      className="rounded-lg h-9 px-3 text-stone-500 hover:text-stone-700"
                    >
                      <Edit className="h-4 w-4 mr-1.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => triggerNotification(notification)}
                      className="rounded-lg h-9 px-3 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    >
                      <Send className="h-4 w-4 mr-1.5" />
                      Send
                    </Button>
                    {notification.deliveryMode === 'scheduled' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleState(notification)}
                        className="rounded-lg h-9 px-3"
                      >
                        {notification.state === 'paused' ? (
                          <>
                            <Play className="h-4 w-4 mr-1.5" />
                            Resume
                          </>
                        ) : (
                          <>
                            <Pause className="h-4 w-4 mr-1.5" />
                            Pause
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNotification(notification)}
                      className="rounded-lg h-9 px-3 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {formMode === 'create' ? 'Create Notification' : 'Edit Notification'}
            </DialogTitle>
            <DialogDescription>
              Configure the schedule, audience, and messages.
              <span className="block text-xs mt-1 opacity-75">
                💡 Notifications are automatically translated based on user language.
              </span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
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
                <Label htmlFor="description">Description (internal)</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formState.description}
                  onChange={handleFormChange}
                  placeholder="Optional internal note"
                  className="rounded-xl min-h-[60px]"
                />
              </div>
            </div>

            {/* Delivery Settings */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deliveryMode" className="flex items-center gap-2">
                  <DeliveryModeIcon className="h-4 w-4" />
                  Delivery Mode
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
                      {option.label} - {option.description}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="audience" className="flex items-center gap-2">
                  <AudienceIcon className="h-4 w-4" />
                  Audience
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

            {/* Planned Date */}
            {formState.deliveryMode === 'planned' && (
              <div className="space-y-2">
                <Label htmlFor="plannedFor">Planned Date & Time</Label>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="scheduleStart">First Run</Label>
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
                  <Label htmlFor="scheduleInterval">Repeat</Label>
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
                <Label htmlFor="customUserIds">Custom User IDs</Label>
                <Textarea
                  id="customUserIds"
                  name="customUserIds"
                  value={formState.customUserIds}
                  onChange={handleFormChange}
                  placeholder="One user ID per line"
                  className="rounded-xl min-h-[80px] font-mono text-sm"
                />
              </div>
            )}

            {/* Message Variants */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Message Variants ({formState.messageVariants.length})
                </Label>
                <div className="relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-lg h-8 px-2"
                    onMouseEnter={() => setShowTemplateInfo(true)}
                    onMouseLeave={() => setShowTemplateInfo(false)}
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                  {showTemplateInfo && (
                    <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-white dark:bg-[#1e1e20] border border-stone-200 dark:border-[#3e3e42] rounded-xl shadow-lg p-4">
                      <div className="text-sm font-semibold mb-2">Variables</div>
                      {TEMPLATE_VARIABLES.map((item) => (
                        <div key={item.variable} className="flex items-center gap-2 text-xs mb-1">
                          <code className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded">
                            {item.variable}
                          </code>
                          <span className="text-stone-500">{item.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {formState.messageVariants.length === 0 ? (
                  <div className="text-sm text-stone-500 text-center py-4 border border-dashed rounded-xl">
                    No messages yet. Add one below.
                  </div>
                ) : (
                  formState.messageVariants.map((variant, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-3 border border-stone-200 dark:border-[#3e3e42] rounded-xl bg-stone-50 dark:bg-[#1a1a1d]"
                    >
                      {editingVariantIndex === index ? (
                        <div className="flex-1 space-y-2">
                          <Textarea
                            value={newVariantText}
                            onChange={(e) => setNewVariantText(e.target.value)}
                            className="rounded-xl min-h-[60px] text-sm"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="rounded-lg h-8 bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => updateMessageVariant(index, newVariantText)}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="rounded-lg h-8"
                              onClick={cancelEditingVariant}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 text-sm text-stone-700 dark:text-stone-300">
                            {variant}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="rounded-lg h-8 w-8 p-0"
                              onClick={() => startEditingVariant(index)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="rounded-lg h-8 w-8 p-0 text-red-500 hover:text-red-700"
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

              <div className="flex items-center gap-2">
                <Input
                  value={newVariantText}
                  onChange={(e) => setNewVariantText(e.target.value)}
                  placeholder="Enter message..."
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
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* CTA URL */}
            <div className="space-y-2">
              <Label htmlFor="ctaUrl" className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Call-to-Action URL (optional)
              </Label>
              <Input
                id="ctaUrl"
                name="ctaUrl"
                value={formState.ctaUrl}
                onChange={handleFormChange}
                placeholder="https://..."
                className="rounded-xl"
              />
            </div>

            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {formError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              className="rounded-xl" 
              onClick={() => setFormOpen(false)}
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {formMode === 'create' ? 'Create' : 'Save Changes'}
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
