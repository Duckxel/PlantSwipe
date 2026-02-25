// @ts-nocheck
import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { GardenPlantTask } from '@/types/garden'
import { listPlantTasks, deletePlantTask, updatePatternTask, resyncTaskOccurrencesForGarden, logGardenActivity, refreshGardenTaskCache } from '@/lib/gardens'
import { broadcastGardenUpdate, addGardenBroadcastListener } from '@/lib/realtime'
import { useAuth } from '@/context/AuthContext'
import { SchedulePickerDialog } from '@/components/plant/SchedulePickerDialog'
import { TaskCreateDialog } from '@/components/plant/TaskCreateDialog'
import { supabase } from '@/lib/supabaseClient'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, Plus } from 'lucide-react'

const TASK_EMOJIS: Record<string, string> = {
  water: '💧',
  fertilize: '🍽️',
  harvest: '🌾',
  cut: '✂️',
}

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
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!gardenPlantId) return
    setLoading(true)
    setError(null)
    try {
      const rows = await listPlantTasks(gardenPlantId)
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

  // Listen for task broadcasts from other users
  React.useEffect(() => {
    if (!open || !gardenId) return
    let active = true
    let teardown: (() => Promise<void>) | null = null
    addGardenBroadcastListener((message) => {
      if (!active) return
      if (message.gardenId !== gardenId) return
      if (message.kind !== 'tasks') return
      if (message.actorId && message.actorId === user?.id) return
      load().catch(() => {})
    }).then((unsubscribe) => {
      if (!active) unsubscribe().catch(() => {})
      else teardown = unsubscribe
    }).catch(() => {})
    return () => { active = false; if (teardown) teardown().catch(() => {}) }
  }, [open, gardenId, load, user?.id])

  // Postgres realtime
  React.useEffect(() => {
    if (!open || !gardenId) return
    const channel = supabase.channel(`rt-tasks-editor-${gardenId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_plant_tasks' }, () => load().catch(() => {}))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_plant_task_occurrences' }, () => load().catch(() => {}))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_activity_logs', filter: `garden_id=eq.${gardenId}` }, () => load().catch(() => {}))
    const sub = channel.subscribe()
    if (sub instanceof Promise) sub.catch(() => {})
    return () => { try { supabase.removeChannel(channel) } catch {} }
  }, [open, gardenId, load])

  const _resetEditor = () => {
    setPatternPeriod('week')
    setPatternAmount(1)
    setPatternSelection({})
    setEditingTask(null)
  }

  const remove = async (taskId: string) => {
    const task = tasks.find((x) => x.id === taskId)
    const label = task ? (task.type === 'custom' ? (task.customName || t('garden.taskTypes.custom')) : t(`garden.taskTypes.${task.type}`)) : t('garden.taskTypes.custom')
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setConfirmDelete(null)
    try {
      await deletePlantTask(taskId)
      emitTasksRealtime({ action: 'delete', taskId }).catch(() => {})
      try { window.dispatchEvent(new CustomEvent('garden:tasks_changed')) } catch {}
      const backgroundTasks = () => {
        const now = new Date()
        const startIso = new Date(now.getTime() - 7*24*3600*1000).toISOString()
        const endIso = new Date(now.getTime() + 60*24*3600*1000).toISOString()
        resyncTaskOccurrencesForGarden(gardenId, startIso, endIso).then(() => refreshGardenTaskCache(gardenId).catch(() => {})).catch(() => {})
        logGardenActivity({ gardenId, kind: 'note' as any, message: t('gardenDashboard.taskDialog.deletedTask', { taskName: label }), taskName: label, actorColor: null }).catch(() => {})
        load().catch(() => {})
        if (onChanged) Promise.resolve(onChanged()).catch(() => {})
      }
      if ('requestIdleCallback' in window) window.requestIdleCallback(backgroundTasks, { timeout: 1000 })
      else setTimeout(backgroundTasks, 100)
    } catch (e: any) {
      setTasks(tasks)
      setError(e?.message || t('gardenDashboard.taskDialog.failedToDelete'))
    }
  }

  const startEdit = (task: GardenPlantTask) => {
    if (task.scheduleKind !== 'repeat_pattern') return
    setEditingTask(task)
    setPatternPeriod((task.period as any) || 'week')
    setPatternAmount(Number(task.amount || task.requiredCount || 1))
    setPatternSelection({
      weeklyDays: task.weeklyDays || undefined,
      monthlyDays: task.monthlyDays || undefined,
      yearlyDays: task.yearlyDays || undefined,
      monthlyNthWeekdays: task.monthlyNthWeekdays || undefined,
    })
    setTimeout(() => setPatternOpen(true), 0)
  }

  const getTaskEmoji = (task: GardenPlantTask) =>
    task.type === 'custom' ? (task.emoji || '🪴') : (TASK_EMOJIS[task.type] || '📋')

  const getTaskName = (task: GardenPlantTask) =>
    task.type === 'custom' ? (task.customName || t('garden.taskTypes.custom')) : t(`garden.taskTypes.${task.type}`)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="rounded-2xl p-0 overflow-hidden max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(_e) => {}}
        onInteractOutside={(_e) => {}}
        onCloseAutoFocus={(_e) => {}}
        aria-describedby={undefined}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-3">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              {t('gardenDashboard.taskDialog.tasks', 'Tasks')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('gardenDashboard.taskDialog.existingTasks')}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-3">
          {/* Task list */}
          {loading && (
            <div className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">
              {t('gardenDashboard.taskDialog.loading', 'Loading...')}
            </div>
          )}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {!loading && tasks.length === 0 && (
            <div className="py-8 text-center">
              <div className="text-3xl mb-2">🌱</div>
              <div className="text-sm text-stone-500 dark:text-stone-400">
                {t('gardenDashboard.taskDialog.noTasksYet', 'No tasks yet')}
              </div>
              <div className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                {t('gardenDashboard.taskDialog.addFirstTask', 'Add a task to get started')}
              </div>
            </div>
          )}

          {/* Task cards */}
          <div className="space-y-2">
            {tasks.map(task => (
              <div
                key={task.id}
                className="group flex items-center gap-3 p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800/50 hover:border-stone-300 dark:hover:border-stone-600 transition-colors"
              >
                {/* Emoji */}
                <div className="h-10 w-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-xl flex-shrink-0">
                  {getTaskEmoji(task)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{getTaskName(task)}</div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
                    {renderTaskSummary(task, t)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                  {task.scheduleKind === 'repeat_pattern' && (
                    <button
                      type="button"
                      onClick={() => startEdit(task)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                      aria-label={t('gardenDashboard.taskDialog.edit', 'Edit')}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {confirmDelete === task.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => remove(task.id)}
                        className="h-8 px-2 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                      >
                        {t('gardenDashboard.taskDialog.confirmDelete', 'Delete')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className="h-8 px-2 rounded-lg text-xs font-medium text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(task.id)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-stone-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      aria-label={t('gardenDashboard.taskDialog.delete', 'Delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add task button */}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">{t('gardenDashboard.taskDialog.addTask', 'Add Task')}</span>
          </button>
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
              const updatedTask = { ...editingTask, period: patternPeriod, amount: patternAmount }
              setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t))
              setEditingTask(null)
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
              emitTasksRealtime({ action: 'update', taskId: editingTask.id }).catch(() => {})
              try { window.dispatchEvent(new CustomEvent('garden:tasks_changed')) } catch {}
              const backgroundTasks = () => {
                const now = new Date()
                resyncTaskOccurrencesForGarden(gardenId, new Date(now.getTime() - 7*24*3600*1000).toISOString(), new Date(now.getTime() + 60*24*3600*1000).toISOString()).then(() => refreshGardenTaskCache(gardenId).catch(() => {})).catch(() => {})
                const label = editingTask.type === 'custom' ? (editingTask.customName || t('garden.taskTypes.custom')) : t(`garden.taskTypes.${editingTask.type}`)
                logGardenActivity({ gardenId, kind: 'note' as any, message: t('gardenDashboard.taskDialog.updatedTask', { taskName: label }), taskName: label, actorColor: null }).catch(() => {})
                load().catch(() => {})
                if (onChanged) Promise.resolve(onChanged()).catch(() => {})
              }
              if ('requestIdleCallback' in window) window.requestIdleCallback(backgroundTasks, { timeout: 1000 })
              else setTimeout(backgroundTasks, 100)
            } catch (e: any) {
              setTasks(prev => prev.map(t => t.id === editingTask.id ? editingTask : t))
              setEditingTask(editingTask)
              setError(e?.message || t('gardenDashboard.taskDialog.failedToUpdate'))
            }
          }
        }}
        initialSelection={patternSelection}
        onChangePeriod={(p) => setPatternPeriod(p)}
        onChangeAmount={(n) => setPatternAmount(n)}
        allowedPeriods={['week', 'month', 'year'] as any}
        modal={false}
      />
      <TaskCreateDialog
        open={createOpen}
        onOpenChange={(o) => setCreateOpen(o)}
        gardenId={gardenId}
        gardenPlantId={gardenPlantId}
        onCreated={async () => {
          emitTasksRealtime({ action: 'create', gardenPlantId }).catch(() => {})
          try { window.dispatchEvent(new CustomEvent('garden:tasks_changed')) } catch {}
          const reloadFn = () => {
            load().catch(() => {})
            if (onChanged) Promise.resolve(onChanged()).catch(() => {})
          }
          if ('requestIdleCallback' in window) window.requestIdleCallback(reloadFn, { timeout: 500 })
          else setTimeout(reloadFn, 100)
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
