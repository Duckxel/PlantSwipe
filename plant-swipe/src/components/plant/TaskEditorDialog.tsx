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
  const { t } = useTranslation('common')
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
      setError(e?.message || t('gardenDashboard.taskDialog.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }, [gardenPlantId, t])

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
    const task = tasks.find((x) => x.id === taskId)
    const label = task ? (task.type === 'custom' ? (task.customName || t('garden.taskTypes.custom')) : t(`garden.taskTypes.${task.type}`)) : t('garden.taskTypes.custom')
    
    // Optimistic update - remove from UI immediately
    setTasks(prev => prev.filter(t => t.id !== taskId))
    
    try {
      await deletePlantTask(taskId)
      
      // Broadcast immediately (non-blocking)
      emitTasksRealtime({ action: 'delete', taskId }).catch(() => {})
      try { window.dispatchEvent(new CustomEvent('garden:tasks_changed')) } catch {}
      
      // Background tasks - don't block UI
      const backgroundTasks = () => {
        // Resync occurrences in background
        const now = new Date()
        const startIso = new Date(now.getTime() - 7*24*3600*1000).toISOString()
        const endIso = new Date(now.getTime() + 60*24*3600*1000).toISOString()
        resyncTaskOccurrencesForGarden(gardenId, startIso, endIso).catch(() => {})
        
        // Log activity (non-blocking)
        logGardenActivity({ gardenId, kind: 'note' as any, message: t('gardenDashboard.taskDialog.deletedTask', { taskName: label }), taskName: label, actorColor: null }).catch(() => {})
        
        // Reload tasks in background
        load().catch(() => {})
        if (onChanged) {
          Promise.resolve(onChanged()).catch(() => {})
        }
      }
      
      // Use requestIdleCallback to avoid blocking UI
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(backgroundTasks, { timeout: 1000 })
      } else {
        setTimeout(backgroundTasks, 100)
      }
    } catch (e: any) {
      // Revert optimistic update on error
      setTasks(tasks)
      setError(e?.message || t('gardenDashboard.taskDialog.failedToDelete'))
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
          <DialogTitle>{t('gardenDashboard.taskDialog.tasks')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{t('gardenDashboard.taskDialog.existingTasks')}</div>
            <Button className="rounded-2xl" onClick={() => setCreateOpen(true)}>{t('gardenDashboard.taskDialog.addTask')}</Button>
          </div>
          <div className="rounded-xl border border-stone-300 dark:border-[#3e3e42] bg-white dark:bg-[#252526]">
            {loading && <div className="p-3 text-sm opacity-60">{t('gardenDashboard.taskDialog.loading')}</div>}
            {error && <div className="p-3 text-sm text-red-600 dark:text-red-400">{error}</div>}
            {!loading && tasks.length === 0 && <div className="p-3 text-sm opacity-60">{t('gardenDashboard.taskDialog.noTasksYet')}</div>}
            <div className="divide-y divide-stone-200 dark:divide-[#3e3e42]">
              {tasks.map(task => (
                <div key={task.id} className="flex items-center justify-between px-3 py-2">
                  <div className="text-sm">
                    <div className="font-medium capitalize flex items-center gap-2">
                      <span className="h-6 w-6 rounded-md border border-stone-300 dark:border-[#3e3e42] bg-stone-100 dark:bg-[#2d2d30] flex items-center justify-center text-base">
                        {task.type === 'water' && '💧'}
                        {task.type === 'fertilize' && '🍽️'}
                        {task.type === 'harvest' && '🌾'}
                        {task.type === 'cut' && '✂️'}
                        {task.type === 'custom' && (task.emoji || '🪴')}
                      </span>
                      <span>{task.type === 'custom' ? (task.customName || t('garden.taskTypes.custom')) : t(`garden.taskTypes.${task.type}`)}</span>
                    </div>
                    <div className="text-xs opacity-60">{renderTaskSummary(task, t)}</div>
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
            <Button variant="secondary" className="rounded-2xl" onClick={() => { resetEditor(); onOpenChange(false) }}>{t('gardenDashboard.taskDialog.close')}</Button>
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
              // Optimistic update - update UI immediately
              const updatedTask = { ...editingTask, period: patternPeriod, amount: patternAmount }
              setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t))
              setEditingTask(null)
              
              // Update task in database
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
              
              // Broadcast immediately (non-blocking)
              emitTasksRealtime({ action: 'update', taskId: editingTask.id }).catch(() => {})
              try { window.dispatchEvent(new CustomEvent('garden:tasks_changed')) } catch {}
              
              // Background tasks - don't block UI
              const backgroundTasks = () => {
                // Resync occurrences in background
                const now = new Date()
                const startIso = new Date(now.getTime() - 7*24*3600*1000).toISOString()
                const endIso = new Date(now.getTime() + 60*24*3600*1000).toISOString()
                resyncTaskOccurrencesForGarden(gardenId, startIso, endIso).catch(() => {})
                
                // Log activity (non-blocking)
                const label = editingTask.type === 'custom' ? (editingTask.customName || t('garden.taskTypes.custom')) : t(`garden.taskTypes.${editingTask.type}`)
                logGardenActivity({ gardenId, kind: 'note' as any, message: t('gardenDashboard.taskDialog.updatedTask', { taskName: label }), taskName: label, actorColor: null }).catch(() => {})
                
                // Reload tasks in background
                load().catch(() => {})
                if (onChanged) {
                  Promise.resolve(onChanged()).catch(() => {})
                }
              }
              
              // Use requestIdleCallback to avoid blocking UI
              if ('requestIdleCallback' in window) {
                window.requestIdleCallback(backgroundTasks, { timeout: 1000 })
              } else {
                setTimeout(backgroundTasks, 100)
              }
            } catch (e: any) {
              // Revert optimistic update on error
              setTasks(prev => prev.map(t => t.id === editingTask.id ? editingTask : t))
              setEditingTask(editingTask)
              setError(e?.message || t('gardenDashboard.taskDialog.failedToUpdate'))
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
          // Broadcast update immediately (non-blocking)
          emitTasksRealtime({ action: 'create', gardenPlantId }).catch(() => {})
          try { window.dispatchEvent(new CustomEvent('garden:tasks_changed')) } catch {}
          
          // Reload in background
          const reloadFn = () => {
            load().catch(() => {})
            if (onChanged) {
              Promise.resolve(onChanged()).catch(() => {})
            }
          }
          
          if ('requestIdleCallback' in window) {
            window.requestIdleCallback(reloadFn, { timeout: 500 })
          } else {
            setTimeout(reloadFn, 100)
          }
        }}
      />
    </Dialog>
  )
}

function renderTaskSummary(task: GardenPlantTask, translate: ReturnType<typeof useTranslation<'common'>>['t']): string {
  if (task.scheduleKind === 'one_time_date') {
    return translate('gardenDashboard.taskDialog.taskSummary.oneTimeOn', { date: task.dueAt ? new Date(task.dueAt).toLocaleString() : '—' })
  }
  if (task.scheduleKind === 'one_time_duration') {
    return translate('gardenDashboard.taskDialog.taskSummary.oneTimeIn', { amount: task.intervalAmount, unit: task.intervalUnit })
  }
  if (task.scheduleKind === 'repeat_duration') {
    return translate('gardenDashboard.taskDialog.taskSummary.everyNeed', { amount: task.intervalAmount, unit: task.intervalUnit, required: task.requiredCount })
  }
  if (task.scheduleKind === 'repeat_pattern') {
    if (task.period === 'week') return translate('gardenDashboard.taskDialog.taskSummary.perWeek', { count: (task.weeklyDays || []).length })
    if (task.period === 'month') return translate('gardenDashboard.taskDialog.taskSummary.perMonth', { count: (task.monthlyNthWeekdays || task.monthlyDays || []).length })
    return translate('gardenDashboard.taskDialog.taskSummary.perYear', { count: (task.yearlyDays || []).length })
  }
  return ''
}

function TaskRowMenu({ onEdit, onDelete }: { onEdit?: () => void; onDelete: () => void }) {
  const { t } = useTranslation('common')
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
          className="fixed w-40 bg-white dark:bg-[#252526] border border-stone-300 dark:border-[#3e3e42] rounded-xl shadow-lg z-[80]"
          style={{ top: position.top, left: position.left }}
        >
          {onEdit && (
            <button onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit() }} className="w-full text-left px-3 py-2 rounded-t-xl hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-black dark:text-white">{t('gardenDashboard.taskDialog.edit')}</button>
          )}
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete() }} className={`w-full text-left px-3 py-2 ${onEdit ? '' : 'rounded-t-xl'} rounded-b-xl hover:bg-stone-50 dark:hover:bg-[#2d2d30] text-red-600 dark:text-red-400`}>{t('gardenDashboard.taskDialog.delete')}</button>
        </div>
      )}
    </div>
  )
}

