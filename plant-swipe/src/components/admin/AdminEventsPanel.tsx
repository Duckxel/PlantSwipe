import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabaseClient'
import {
  Calendar,
  Trash2,
  Edit2,
  Loader2,
  Trophy,
  Users,
  Egg,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Play,
  ShieldCheck,
  Clock,
  Eye,
  EyeOff,
  Package,
  RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EventRow } from '@/types/event'
import type { BadgeRow } from '@/types/badge'
/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic admin data */

type EventWithStats = EventRow & {
  item_count: number
  participant_count: number
  completion_count: number
  badge: BadgeRow | null
}

type EventFormData = {
  name: string
  description: string
  event_type: string
  badge_id: string
  starts_at: string
  ends_at: string
  is_active: boolean
  admin_only: boolean
}

const EVENT_TYPES = [
  { value: 'egg_hunt', label: 'Egg Hunt', icon: Egg },
  { value: 'scavenger_hunt', label: 'Scavenger Hunt', icon: Eye },
  { value: 'seasonal', label: 'Seasonal', icon: Calendar },
]

const emptyForm: EventFormData = {
  name: '',
  description: '',
  event_type: 'egg_hunt',
  badge_id: '',
  starts_at: '',
  ends_at: '',
  is_active: false,
  admin_only: false,
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return dateStr }
}

function toLocalInputValue(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    // Format as YYYY-MM-DDTHH:mm for datetime-local input
    return d.toISOString().slice(0, 16)
  } catch { return '' }
}

function getEventStatus(event: EventRow): { label: string; color: string; icon: React.ComponentType<any> } {
  if (!event.is_active) return { label: 'Invisible', color: 'text-stone-400', icon: EyeOff }
  if (event.admin_only) return { label: 'Admin Testing', color: 'text-purple-500', icon: ShieldCheck }
  const now = new Date()
  if (event.starts_at && new Date(event.starts_at) > now) return { label: 'Scheduled', color: 'text-blue-500', icon: Clock }
  if (event.ends_at && new Date(event.ends_at) < now) return { label: 'Ended', color: 'text-amber-500', icon: CheckCircle2 }
  return { label: 'Live', color: 'text-emerald-500', icon: Play }
}

export const AdminEventsPanel: React.FC = () => {
  const [events, setEvents] = React.useState<EventWithStats[]>([])
  const [badges, setBadges] = React.useState<BadgeRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [showForm, setShowForm] = React.useState(false)
  const [editingEvent, setEditingEvent] = React.useState<EventWithStats | null>(null)
  const [formData, setFormData] = React.useState<EventFormData>(emptyForm)
  const [expandedEvent, setExpandedEvent] = React.useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null)
  const [cleaning, setCleaning] = React.useState<string | null>(null)
  const [resetting, setResetting] = React.useState<string | null>(null)
  const [confirmReset, setConfirmReset] = React.useState<string | null>(null)

  // Load events with stats
  const loadEvents = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
      if (eventError) throw eventError

      // Fetch badges
      const { data: badgeData } = await supabase.from('badges').select('*').eq('is_active', true)
      setBadges((badgeData || []) as BadgeRow[])

      // Fetch item counts per event
      const { data: itemCounts } = await supabase
        .from('event_items')
        .select('event_id')
      const itemCountMap: Record<string, number> = {}
      for (const row of (itemCounts || [])) {
        itemCountMap[row.event_id] = (itemCountMap[row.event_id] || 0) + 1
      }

      // Fetch participant counts (unique users with progress)
      const { data: progressData } = await supabase
        .from('event_user_progress')
        .select('event_id, user_id')
      const participantMap: Record<string, Set<string>> = {}
      for (const row of (progressData || [])) {
        if (!participantMap[row.event_id]) participantMap[row.event_id] = new Set()
        participantMap[row.event_id].add(row.user_id)
      }

      // Fetch completion counts
      const { data: completionData } = await supabase
        .from('event_registrations')
        .select('event_id')
      const completionMap: Record<string, number> = {}
      for (const row of (completionData || [])) {
        completionMap[row.event_id] = (completionMap[row.event_id] || 0) + 1
      }

      // Build badge map
      const badgeMap: Record<string, BadgeRow> = {}
      for (const b of (badgeData || [])) badgeMap[b.id] = b as BadgeRow

      const eventsWithStats: EventWithStats[] = (eventData || []).map((e: any) => ({
        ...e,
        item_count: itemCountMap[e.id] || 0,
        participant_count: participantMap[e.id]?.size || 0,
        completion_count: completionMap[e.id] || 0,
        badge: e.badge_id ? badgeMap[e.badge_id] || null : null,
      }))

      setEvents(eventsWithStats)
    } catch (err: any) {
      setError(err.message || 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { loadEvents() }, [loadEvents])

  React.useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  const handleEdit = (event: EventWithStats) => {
    setEditingEvent(event)
    setFormData({
      name: event.name,
      description: event.description || '',
      event_type: event.event_type,
      badge_id: event.badge_id || '',
      starts_at: toLocalInputValue(event.starts_at),
      ends_at: toLocalInputValue(event.ends_at),
      is_active: event.is_active,
      admin_only: event.admin_only,
    })
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingEvent(null)
    setFormData({ ...emptyForm })
  }

  const handleSave = async () => {
    if (!formData.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        event_type: formData.event_type,
        badge_id: formData.badge_id || null,
        starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : null,
        ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
        is_active: formData.is_active,
        admin_only: formData.admin_only,
        updated_at: new Date().toISOString(),
      }

      if (!editingEvent) return

      // If admin_only was on and is now being turned off via the form, auto-reset progress
      if (editingEvent.admin_only && !formData.admin_only) {
        await supabase.rpc('reset_event_progress', { target_event_id: editingEvent.id })
      }

      const { data: updatedRow, error: updateError } = await supabase
        .from('events')
        .update(payload)
        .eq('id', editingEvent.id)
        .select('id')
        .maybeSingle()
      if (updateError) throw updateError
      if (!updatedRow) throw new Error('Event was not updated (no permission or row missing).')

      setSuccess(editingEvent.admin_only && !formData.admin_only
        ? 'Event updated — progress reset for public launch'
        : 'Event updated')
      handleCancel()
      await loadEvents()
    } catch (err: any) {
      setError(err.message || 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  const handleCleanup = async (eventId: string) => {
    setCleaning(eventId)
    try {
      const { error } = await supabase.rpc('cleanup_event', { target_event_id: eventId })
      if (error) throw error
      setSuccess('Event cleaned up — items and progress removed')
      setConfirmDelete(null)
      await loadEvents()
    } catch (err: any) {
      setError(err.message || 'Cleanup failed')
    } finally {
      setCleaning(null)
    }
  }

  const handleReset = async (eventId: string) => {
    setResetting(eventId)
    try {
      const { error } = await supabase.rpc('reset_event_progress', { target_event_id: eventId })
      if (error) throw error
      setSuccess('Progress reset — event is fresh for all users')
      setConfirmReset(null)
      await loadEvents()
    } catch (err: any) {
      setError(err.message || 'Reset failed')
    } finally {
      setResetting(null)
    }
  }

  const toggleActive = async (event: EventWithStats) => {
    try {
      const { data: updatedRow, error } = await supabase
        .from('events')
        .update({
          is_active: !event.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id)
        .select('id, is_active')
        .maybeSingle()
      if (error) throw error
      if (!updatedRow) throw new Error('Event was not updated (no permission or row missing).')
      setSuccess(event.is_active ? 'Event deactivated' : 'Event activated')
      await loadEvents()
    } catch (err: any) {
      setError(err.message || 'Failed to toggle event')
    }
  }

  const toggleAdminOnly = async (event: EventWithStats) => {
    try {
      // When going public (admin_only → false), auto-reset all progress
      // so test data from admin testing doesn't interfere
      if (event.admin_only) {
        const { error: resetError } = await supabase.rpc('reset_event_progress', { target_event_id: event.id })
        if (resetError) throw resetError
      }

      const { data: updatedRow, error } = await supabase
        .from('events')
        .update({
          admin_only: !event.admin_only,
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!updatedRow) throw new Error('Event was not updated (no permission or row missing).')
      setSuccess(event.admin_only ? 'Event is now public — all progress has been reset' : 'Event restricted to admins')
      await loadEvents()
    } catch (err: any) {
      setError(err.message || 'Failed to toggle admin-only')
    }
  }

  const renderEventCard = (event: EventWithStats) => {
    const status = getEventStatus(event)
    const StatusIcon = status.icon
    const isExpanded = expandedEvent === event.id

    return (
      <Card
        key={event.id}
        className={cn(
          'rounded-2xl border transition-all cursor-pointer',
          isExpanded
            ? 'border-emerald-300 dark:border-emerald-700 shadow-md'
            : 'border-stone-200 dark:border-[#3e3e42] hover:border-stone-300 dark:hover:border-[#4e4e52]'
        )}
        onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
      >
        <CardContent className="p-4">
          {/* Header row */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-stone-100 dark:bg-[#2d2d30] flex items-center justify-center">
              <Egg className="h-5 w-5 text-amber-500" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                  {event.name}
                </h3>
                <span className={cn('flex items-center gap-1 text-xs font-medium', status.color)}>
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-1 text-xs text-stone-500 dark:text-stone-400">
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {event.item_count} items
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {event.participant_count} participants
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {event.completion_count} completed
                </span>
              </div>

              {event.badge && (
                <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600 dark:text-amber-400">
                  <Trophy className="h-3 w-3" />
                  {event.badge.name}
                </div>
              )}
            </div>

            <div className="flex-shrink-0">
              {isExpanded ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
            </div>
          </div>

          {/* Expanded details */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-stone-200 dark:border-[#3e3e42] space-y-4" onClick={(e) => e.stopPropagation()}>
              {/* Info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-stone-50 dark:bg-[#2d2d30] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-stone-500">Type</p>
                  <p className="text-sm font-medium mt-0.5">{event.event_type.replace('_', ' ')}</p>
                </div>
                <div className="rounded-xl bg-stone-50 dark:bg-[#2d2d30] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-stone-500">Start</p>
                  <p className="text-sm font-medium mt-0.5">{formatDate(event.starts_at)}</p>
                </div>
                <div className="rounded-xl bg-stone-50 dark:bg-[#2d2d30] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-stone-500">End</p>
                  <p className="text-sm font-medium mt-0.5">{formatDate(event.ends_at)}</p>
                </div>
                <div className="rounded-xl bg-stone-50 dark:bg-[#2d2d30] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-stone-500">Completion</p>
                  <p className="text-sm font-medium mt-0.5">
                    {event.participant_count > 0
                      ? `${Math.round((event.completion_count / event.participant_count) * 100)}%`
                      : '—'}
                  </p>
                </div>
              </div>

              {event.description && (
                <p className="text-xs text-stone-500 dark:text-stone-400">{event.description}</p>
              )}

              {/* Quick actions */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm" variant="outline" className="rounded-xl"
                  onClick={() => toggleActive(event)}
                >
                  {event.is_active ? <EyeOff className="h-3.5 w-3.5 mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
                  {event.is_active ? 'Make Invisible' : 'Make Visible'}
                </Button>

                {event.is_active && (
                  <Button
                    size="sm" variant="outline" className="rounded-xl"
                    onClick={() => toggleAdminOnly(event)}
                  >
                    <ShieldCheck className={cn('h-3.5 w-3.5 mr-1.5', event.admin_only ? 'text-purple-500' : '')} />
                    {event.admin_only ? 'Make Public' : 'Admin Testing'}
                  </Button>
                )}

                <Button
                  size="sm" variant="outline" className="rounded-xl"
                  onClick={() => handleEdit(event)}
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>

                {/* Reset Progress (two-step) */}
                {confirmReset === event.id ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm" variant="outline"
                      className="rounded-xl text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-900/20"
                      onClick={() => handleReset(event.id)}
                      disabled={resetting === event.id}
                    >
                      {resetting === event.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
                      Confirm Reset
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setConfirmReset(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm" variant="outline" className="rounded-xl text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    onClick={() => setConfirmReset(event.id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Reset Progress
                  </Button>
                )}

                {/* Cleanup (two-step) */}
                {confirmDelete === event.id ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm" variant="outline"
                      className="rounded-xl text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20"
                      onClick={() => handleCleanup(event.id)}
                      disabled={cleaning === event.id}
                    >
                      {cleaning === event.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                      Confirm Cleanup
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setConfirmDelete(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm" variant="outline" className="rounded-xl text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    onClick={() => setConfirmDelete(event.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Cleanup
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderForm = () => (
    <Card className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 shadow-md">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
            Edit Event
          </h3>
          <button onClick={handleCancel} className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
            <X className="h-4 w-4 text-stone-500" />
          </button>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="event-name">Name *</Label>
          <Input
            id="event-name"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g., Easter Egg Hunt 2026"
            className="rounded-xl"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="event-desc">Description</Label>
          <textarea
            id="event-desc"
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            placeholder="Find all hidden eggs across the site!"
            className="w-full rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-transparent px-3 py-2 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Type */}
        <div className="space-y-2">
          <Label>Event Type</Label>
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES.map((t) => {
              const TIcon = t.icon
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, event_type: t.value }))}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all',
                    formData.event_type === t.value
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                      : 'bg-stone-100 dark:bg-[#2d2d30] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3e3e42]'
                  )}
                >
                  <TIcon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Badge */}
        <div className="space-y-2">
          <Label>Badge (awarded on completion)</Label>
          <select
            value={formData.badge_id}
            onChange={(e) => setFormData((p) => ({ ...p, badge_id: e.target.value }))}
            className="w-full rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">No badge</option>
            {badges.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.slug})</option>
            ))}
          </select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="event-start">Start Date</Label>
            <Input
              id="event-start"
              type="datetime-local"
              value={formData.starts_at}
              onChange={(e) => setFormData((p) => ({ ...p, starts_at: e.target.value }))}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-end">End Date</Label>
            <Input
              id="event-end"
              type="datetime-local"
              value={formData.ends_at}
              onChange={(e) => setFormData((p) => ({ ...p, ends_at: e.target.value }))}
              className="rounded-xl"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          <label className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-[#2d2d30] cursor-pointer select-none">
            <div className="relative">
              <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData((p) => ({ ...p, is_active: e.target.checked }))} className="sr-only peer" />
              <div className={cn('w-11 h-6 rounded-full transition-colors', formData.is_active ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-600')} />
              <div className={cn('absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform', formData.is_active && 'translate-x-5')} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium flex items-center gap-1.5">
                <Eye className={cn('h-4 w-4', formData.is_active ? 'text-emerald-500' : 'text-stone-400')} />
                Visible
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">When off, event is invisible to everyone including admins</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-[#2d2d30] cursor-pointer select-none">
            <div className="relative">
              <input type="checkbox" checked={formData.admin_only} onChange={(e) => setFormData((p) => ({ ...p, admin_only: e.target.checked }))} className="sr-only peer" />
              <div className={cn('w-11 h-6 rounded-full transition-colors', formData.admin_only ? 'bg-purple-500' : 'bg-stone-300 dark:bg-stone-600')} />
              <div className={cn('absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform', formData.admin_only && 'translate-x-5')} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium flex items-center gap-1.5">
                <ShieldCheck className={cn('h-4 w-4', formData.admin_only ? 'text-purple-500' : 'text-stone-400')} />
                Admin Testing
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">Only admins see eggs — when off, the event goes public automatically on the start date</p>
            </div>
          </label>
        </div>

        {/* Save */}
        <div className="flex items-center gap-2 pt-2">
          <Button className="rounded-xl flex-1" onClick={handleSave} disabled={saving || !formData.name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Update Event
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={handleCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <Calendar className="h-6 w-6 text-emerald-600" />
            Event Management
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Create and manage seasonal events, egg hunts, and campaigns
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] p-3">
            <p className="text-xs text-stone-500">Total Events</p>
            <p className="text-lg font-bold text-stone-900 dark:text-white">{events.length}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] p-3">
            <p className="text-xs text-stone-500">Active</p>
            <p className="text-lg font-bold text-emerald-600">{events.filter((e) => e.is_active && !e.admin_only).length}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] p-3">
            <p className="text-xs text-stone-500">Admin Only</p>
            <p className="text-lg font-bold text-purple-500">{events.filter((e) => e.is_active && e.admin_only).length}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] p-3">
            <p className="text-xs text-stone-500">Total Completions</p>
            <p className="text-lg font-bold text-blue-500">{events.reduce((s, e) => s + e.completion_count, 0)}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none rounded-sm" aria-label="Dismiss error" title="Dismiss error">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Info: events are created via SQL files */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-stone-50 dark:bg-[#2d2d30] border border-stone-200 dark:border-[#3e3e42] text-xs text-stone-500 dark:text-stone-400">
        <Package className="h-4 w-4 flex-shrink-0" />
        To create a new event, add a folder in <code className="font-mono bg-stone-200 dark:bg-stone-700 px-1 rounded">events/</code> with a <code className="font-mono bg-stone-200 dark:bg-stone-700 px-1 rounded">setup.sql</code> file and run it on the database.
      </div>

      {/* Edit form (no creation — events are managed via SQL files) */}
      {showForm && editingEvent && renderForm()}

      {/* Event list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-stone-500 dark:text-stone-400">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No events yet</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {events.map(renderEventCard)}
        </div>
      )}
    </div>
  )
}
