// @ts-nocheck
import React from 'react'
import { createPortal } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { GardenPlantTask } from '@/types/garden'
import { listPlantTasks, deletePlantTask, updatePatternTask, resyncTaskOccurrencesForGarden, logGardenActivity } from '@/lib/gardens'
import { broadcastGardenUpdate, addGardenBroadcastListener } from '@/lib/realtime'
import { useAuth } from '@/context/AuthContext'
import { SchedulePickerDialog } from '@/components/plant/SchedulePickerDialog'
import { TaskCreateDialog } from '@/components/plant/TaskCreateDialog'
import { supabase } from '@/lib/supabaseClient'
import { useTranslation } from 'react-i18next'

export function TaskEditorDialog({ open, onOpenChange, gardenId, gardenPlantId, onChanged }: { open: boolean; onOpenChange: (o: boolean) => void; gardenId: string; gardenPlantId: string; onChanged?: () => Promise<void> | void }) {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [tasks, setTasks] = React.useState<GardenPlantTask[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Pattern scheduling state
  const [patternOpen, setPatternOpen] = React.useState(false)
  const [patternPeriod, setPatternPeriod] = React.useState<'week'|'month'|'year'>('week')
  const [patternAmount, setPatternAmount] = React.useState<number>(1)
  const [patternSelection, setPatternSelection] = React.useState<{ weeklyDays?: number[]; monthlyDays?: number[]; yearlyDays?: string[]; monthlyNthWeekdays?: string[] }>({})
  const [editingTask, setEditingTask] = React.useState<GardenPlantTask | null>(null)

  const [createOpen, setCreateOpen] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!gardenPlantId) return
    setLoading(true)
    setError(null)
    try {
      const rows = await listPlantTasks(gardenPlantId)
      // Sort by normalized frequency (descending)
      const score = (task: GardenPlantTask): number => {
        try {
          if (task.scheduleKind === 'repeat_pattern') {
            const amount = Math.max(1, Number(task.amount || 1))
            const req = Math.max(1, Number(task.requiredCount || 1))
            const period = (task.period || 'week') as 'week'|'month'|'year'
            const perWeek = period === 'week' ? amount : period === 'month' ? amount / 4.345 : amount / 52
            return perWeek * req
          }
          if (task.scheduleKind === 'repeat_duration') {
            const amt = Math.max(1, Number(task.intervalAmount || 1))
            const unit = String(task.intervalUnit || 'week')
            const req = Math.max(1, Number(task.requiredCount || 1))
            const weeks = unit === 'day' ? amt / 7 : unit === 'week' ? amt : unit === 'month' ? amt * 4.345 : unit === 'year' ? amt * 52 : amt / 7
            const perWeek = weeks > 0 ? (1 / weeks) : 0
            return perWeek * req
          }
        } catch {}
        return 0
      }
      rows.sort((a, b) => score(b) - score(a))
      setTasks(rows)
    } catch (e: any) {
      setError(e?.message || t('garden.taskDialog.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }, [gardenPlantId])

  const emitTasksRealtime = React.useCallback(async (metadata?: Record<string, unknown>) => {
    await broadcastGardenUpdate({ gardenId, kind: 'tasks', metadata, actorId: user?.id ?? null }).catch(() => {})
  }, [gardenId, user?.id])

  React.useEffect(() => { if (open) load() }, [open, load])

  // Listen for task completion broadcasts from other users
  React.useEffect(() => {
    if (!open || !gardenId) return
    let active = true
    let teardown: (() => Promise<void>) | null = null

    addGardenBroadcastListener((message) => {
      if (!active) return
      if (message.gardenId !== gardenId) return
      if (message.kind !== 'tasks') return
      if (message.actorId && message.actorId === user?.id) return
      // Reload tasks when other users complete tasks or make changes
      load().catch(() => {})
    })
      .then((unsubscribe) => {
        if (!active) {
          unsubscribe().catch(() => {})
        } else {
          teardown = unsubscribe
        }
      })
      .catch(() => {})

    return () => {
      active = false
      if (teardown) teardown().catch(() => {})
    }
  }, [open, gardenId, load, user?.id])

  // Also listen to postgres changes for immediate updates
  React.useEffect(() => {
    if (!open || !gardenId) return

    const channel = supabase.channel(`rt-tasks-editor-${gardenId}`)
      // Task definition changes
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_plant_tasks' }, () => {
        load().catch(() => {})
      })
      // Task occurrence changes (completions)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_plant_task_occurrences' }, () => {
        load().catch(() => {})
      })
      // Garden activity changes (may indicate task completions)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_activity_logs', filter: `garden_id=eq.${gardenId}` }, () => {
        load().catch(() => {})
      })

    const subscription = channel.subscribe()
    if (subscription instanceof Promise) subscription.catch(() => {})

    return () => {
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [open, gardenId, load])

  const resetEditor = () => {
    setPatternPeriod('week')
    setPatternAmount(1)
    setPatternSelection({})
    setEditingTask(null)
  }

  const remove = async (taskId: string) => {
    try {
      await deletePlantTask(taskId)
      // Resync occurrences to purge old ones for the deleted task
      try {
        const now = new Date()
        const startIso = new Date(now.getTime() - 7*24*3600*1000).toISOString()
        const endIso = new Date(now.getTime() + 60*24*3600*1000).toISOString()
        await resyncTaskOccurrencesForGarden(gardenId, startIso, endIso)
      } catch {}
      // Log activity so other clients refresh via SSE
      try {
        const task = tasks.find((x) => x.id === taskId)
        const label = task ? (task.type === 'custom' ? (task.customName || t('garden.taskTypes.custom')) : t(`garden.taskTypes.${task.type}`)) : t('garden.taskTypes.custom')
        await logGardenActivity({ gardenId, kind: 'note' as any, message: t('garden.taskDialog.deletedTask', { taskName: label }), taskName: label, actorColor: null })
        try { window.dispatchEvent(new CustomEvent('garden:tasks_changed')) } catch {}
      } catch {}
      // Broadcast update BEFORE reload to ensure other clients receive it
      await emitTasksRealtime({ action: 'delete', taskId })
      await load()
      if (onChanged) await onChanged()
    } catch (e: any) {
      setError(e?.message || t('garden.taskDialog.failedToDelete'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="rounded-2xl"
        onOpenAutoFocus={(e) => { e.preventDefault() }}
        // Allow outside pointer events so absolutely positioned menu stays interactive
        onPointerDownOutside={(e) => { /* allow */ }}
        onInteractOutside={(e) => { /* allow */ }}
        onCloseAutoFocus={(e) => { /* allow */ }}
      >
        <DialogHeader>
          <DialogTitle>{t('garden.taskDialog.tasks')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{t('garden.taskDialog.existingTasks')}</div>
            <Button className="rounded-2xl" onClick={() => setCreateOpen(true)}>{t('garden.taskDialog.addTask')}</Button>
          </div>
          <div className="rounded-xl border">
            {loading && <div className="p-3 text-sm opacity-60">{t('garden.taskDialog.loading')}</div>}
            {error && <div className="p-3 text-sm text-red-600">{error}</div>}
            {!loading && tasks.length === 0 && <div className="p-3 text-sm opacity-60">{t('garden.taskDialog.noTasksYet')}</div>}
            <div className="divide-y">
              {tasks.map(task => (
                <div key={task.id} className="flex items-center justify-between px-3 py-2">
                  <div className="text-sm">
                    <div className="font-medium capitalize flex items-center gap-2">
                      <span className="h-6 w-6 rounded-md border bg-stone-100 flex items-center justify-center text-base">
                        {task.type === 'water' && '💧'}
                        {task.type === 'fertilize' && '🍽️'}
                        {task.type === 'harvest' && '🌾'}
                        {task.type === 'cut' && '✂️'}
                        {task.type === 'custom' && (task.emoji || '🪴')}
                      </span>
                      <span>{task.type === 'custom' ? (task.customName || t('garden.taskTypes.custom')) : t(`garden.taskTypes.${task.type}`)}</span>
                    </div>
                    <div className="text-xs opacity-60">{renderTaskSummary(task)}</div>
                  </div>
                  <TaskRowMenu
                    onEdit={task.scheduleKind === 'repeat_pattern' ? () => {
                      setEditingTask(task)
                      setPatternPeriod((task.period as any) || 'week')
                      setPatternAmount(Number(task.amount || task.requiredCount || 1))
                      setPatternSelection({
                        weeklyDays: task.weeklyDays || undefined,
                        monthlyDays: task.monthlyDays || undefined,
                        yearlyDays: task.yearlyDays || undefined,
                        monthlyNthWeekdays: task.monthlyNthWeekdays || undefined,
                      })
                      // Delay open to next tick to avoid menu overlay capturing events
                      setTimeout(() => setPatternOpen(true), 0)
                    } : undefined}
                    onDelete={() => remove(task.id)}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" className="rounded-2xl" onClick={() => { resetEditor(); onOpenChange(false) }}>{t('garden.taskDialog.close')}</Button>
          </div>
        </div>
      </DialogContent>
      <SchedulePickerDialog
        open={patternOpen}
        onOpenChange={(o) => setPatternOpen(o)}
        period={patternPeriod}
        amount={patternAmount}
        onSave={async (sel) => {
          setPatternSelection(sel)
          if (editingTask && editingTask.scheduleKind === 'repeat_pattern') {
            try {
              await updatePatternTask({
                taskId: editingTask.id,
                period: patternPeriod,
                amount: patternAmount,
                weeklyDays: patternPeriod === 'week' ? (sel.weeklyDays || []) : null,
                monthlyDays: patternPeriod === 'month' ? (sel.monthlyDays || []) : null,
                yearlyDays: patternPeriod === 'year' ? (sel.yearlyDays || []) : null,
                monthlyNthWeekdays: patternPeriod === 'month' ? (sel.monthlyNthWeekdays || []) : null,
                requiredCount: editingTask.requiredCount || 1,
              })
              // After updating, resync occurrences to remove stale dates
              try {
                const now = new Date()
                const startIso = new Date(now.getTime() - 7*24*3600*1000).toISOString()
                const endIso = new Date(now.getTime() + 60*24*3600*1000).toISOString()
                await resyncTaskOccurrencesForGarden(gardenId, startIso, endIso)
              } catch {}
              // Log activity so other clients refresh via SSE
              try {
                const label = editingTask.type === 'custom' ? (editingTask.customName || t('garden.taskTypes.custom')) : t(`garden.taskTypes.${editingTask.type}`)
                await logGardenActivity({ gardenId, kind: 'note' as any, message: t('garden.taskDialog.updatedTask', { taskName: label }), taskName: label, actorColor: null })
                try { window.dispatchEvent(new CustomEvent('garden:tasks_changed')) } catch {}
              } catch {}
              // Broadcast update BEFORE reload to ensure other clients receive it
              await emitTasksRealtime({ action: 'update', taskId: editingTask.id })
              setEditingTask(null)
              await load()
              if (onChanged) await onChanged()
            } catch (e: any) {
              setError(e?.message || t('garden.taskDialog.failedToUpdate'))
            }
          }
        }}
        initialSelection={patternSelection}
        onChangePeriod={(p) => setPatternPeriod(p)}
        onChangeAmount={(n) => setPatternAmount(n)}
        // Allow switching across week/month/year as requested
        allowedPeriods={[ 'week', 'month', 'year' ] as any}
        modal={false}
      />
      <TaskCreateDialog
        open={createOpen}
        onOpenChange={(o) => setCreateOpen(o)}
        gardenId={gardenId}
        gardenPlantId={gardenPlantId}
        onCreated={async () => {
          // Broadcast update BEFORE reload to ensure other clients receive it
          await emitTasksRealtime({ action: 'create', gardenPlantId })
          await load()
          // Notify global UI to refresh nav badges immediately on task creation
          try { window.dispatchEvent(new CustomEvent('garden:tasks_changed')) } catch {}
          if (onChanged) await onChanged()
        }}
      />
    </Dialog>
  )
}

function renderTaskSummary(task: GardenPlantTask): string {
  const { t: translate } = useTranslation()
  if (task.scheduleKind === 'one_time_date') {
    return translate('garden.taskDialog.taskSummary.oneTimeOn', { date: task.dueAt ? new Date(task.dueAt).toLocaleString() : '—' })
  }
  if (task.scheduleKind === 'one_time_duration') {
    return translate('garden.taskDialog.taskSummary.oneTimeIn', { amount: task.intervalAmount, unit: task.intervalUnit })
  }
  if (task.scheduleKind === 'repeat_duration') {
    return translate('garden.taskDialog.taskSummary.everyNeed', { amount: task.intervalAmount, unit: task.intervalUnit, required: task.requiredCount })
  }
  if (task.scheduleKind === 'repeat_pattern') {
    if (task.period === 'week') return translate('garden.taskDialog.taskSummary.perWeek', { count: (task.weeklyDays || []).length })
    if (task.period === 'month') return translate('garden.taskDialog.taskSummary.perMonth', { count: (task.monthlyNthWeekdays || task.monthlyDays || []).length })
    return translate('garden.taskDialog.taskSummary.perYear', { count: (task.yearlyDays || []).length })
  }
  return ''
}

function TaskRowMenu({ onEdit, onDelete }: { onEdit?: () => void; onDelete: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement | null>(null)
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = React.useState<{ top: number; left: number; placement: 'top' | 'bottom' }>({ top: 0, left: 0, placement: 'bottom' })
  const rafRef = React.useRef<number | null>(null)

  const computePosition = React.useCallback((placementHint?: 'top' | 'bottom') => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const predictedHeight = onEdit ? 88 : 46 // approximate menu height
    const predictedWidth = 160 // w-40 => 10rem
    const spaceBelow = window.innerHeight - rect.bottom
    const place: 'top' | 'bottom' = placementHint || (spaceBelow < predictedHeight + 12 ? 'top' : 'bottom')
    const top = place === 'bottom' ? (rect.bottom + 8) : (rect.top - predictedHeight - 8)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - predictedWidth - 8))
    setPosition({ top: Math.max(8, Math.min(top, window.innerHeight - 8 - predictedHeight)), left, placement: place })
  }, [onEdit])

  React.useEffect(() => {
    if (!open) return
    computePosition()
    const onWindow = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => computePosition(position.placement))
    }
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current && menuRef.current.contains(target)) return
      if (buttonRef.current && buttonRef.current.contains(target)) return
      setOpen(false)
    }
    window.addEventListener('resize', onWindow)
    // capture scroll from any ancestor; recalc to keep anchored
    window.addEventListener('scroll', onWindow, true)
    document.addEventListener('mousedown', onDocClick, true)
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false) }, { once: true })
    return () => {
      window.removeEventListener('resize', onWindow)
      window.removeEventListener('scroll', onWindow, true)
      document.removeEventListener('mousedown', onDocClick, true)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [open, computePosition, position.placement])

  return (
    <div className="relative">
      <Button
        ref={buttonRef as any}
        variant="secondary"
        className="rounded-xl px-2"
        onClick={(e: any) => { e.stopPropagation(); setOpen((o) => !o) }}
      >
        ⋯
      </Button>
      {open && (
        <div
          ref={menuRef as any}
          className="absolute right-0 top-full mt-2 w-40 bg-white border rounded-xl shadow-lg z-[80]"
        >
          {onEdit && (
            <button onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit() }} className="w-full text-left px-3 py-2 rounded-t-xl hover:bg-stone-50">{t('garden.taskDialog.edit')}</button>
          )}
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete() }} className={`w-full text-left px-3 py-2 ${onEdit ? '' : 'rounded-t-xl'} rounded-b-xl hover:bg-stone-50 text-red-600`}>{t('garden.taskDialog.delete')}</button>
        </div>
      )}
    </div>
  )
}

