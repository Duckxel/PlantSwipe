// @ts-nocheck
import React from 'react'
import { createPortal } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { GardenPlantTask } from '@/types/garden'
import { listPlantTasks, deletePlantTask, updatePatternTask, listGardenTasks, syncTaskOccurrencesForGarden } from '@/lib/gardens'
import { SchedulePickerDialog } from '@/components/plant/SchedulePickerDialog'
import { TaskCreateDialog } from '@/components/plant/TaskCreateDialog'

export function TaskEditorDialog({ open, onOpenChange, gardenId, gardenPlantId, onChanged }: { open: boolean; onOpenChange: (o: boolean) => void; gardenId: string; gardenPlantId: string; onChanged?: () => Promise<void> | void }) {
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
      const score = (t: GardenPlantTask): number => {
        try {
          if (t.scheduleKind === 'repeat_pattern') {
            const amount = Math.max(1, Number(t.amount || 1))
            const req = Math.max(1, Number(t.requiredCount || 1))
            const period = (t.period || 'week') as 'week'|'month'|'year'
            const perWeek = period === 'week' ? amount : period === 'month' ? amount / 4.345 : amount / 52
            return perWeek * req
          }
          if (t.scheduleKind === 'repeat_duration') {
            const amt = Math.max(1, Number(t.intervalAmount || 1))
            const unit = String(t.intervalUnit || 'week')
            const req = Math.max(1, Number(t.requiredCount || 1))
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
      setError(e?.message || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [gardenPlantId])

  React.useEffect(() => { if (open) load() }, [open, load])

  const resetEditor = () => {
    setPatternPeriod('week')
    setPatternAmount(1)
    setPatternSelection({})
    setEditingTask(null)
  }

  const remove = async (taskId: string) => {
    try {
      await deletePlantTask(taskId)
      // Ensure occurrences are regenerated and UI reflects changes
      try {
        const allTasks = await listGardenTasks(gardenId)
        const now = new Date()
        const startIso = new Date(now.getTime() - 7*24*3600*1000).toISOString()
        const endIso = new Date(now.getTime() + 60*24*3600*1000).toISOString()
        await syncTaskOccurrencesForGarden(gardenId, startIso, endIso)
      } catch {}
      await load()
      if (onChanged) await onChanged()
    } catch (e: any) {
      setError(e?.message || 'Failed to delete task')
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
          <DialogTitle>Tasks</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Existing tasks</div>
            <Button className="rounded-2xl" onClick={() => setCreateOpen(true)}>Add Task</Button>
          </div>
          <div className="rounded-xl border">
            {loading && <div className="p-3 text-sm opacity-60">Loading…</div>}
            {error && <div className="p-3 text-sm text-red-600">{error}</div>}
            {!loading && tasks.length === 0 && <div className="p-3 text-sm opacity-60">No tasks yet</div>}
            <div className="divide-y">
              {tasks.map(t => (
                <div key={t.id} className="flex items-center justify-between px-3 py-2">
                  <div className="text-sm">
                    <div className="font-medium capitalize flex items-center gap-2">
                      <span className="h-6 w-6 rounded-md border bg-stone-100 flex items-center justify-center text-base">
                        {t.type === 'water' && '💧'}
                        {t.type === 'fertilize' && '🍽️'}
                        {t.type === 'harvest' && '🌾'}
                        {t.type === 'cut' && '✂️'}
                        {t.type === 'custom' && (t.emoji || '🪴')}
                      </span>
                      <span>{t.type === 'custom' ? (t.customName || 'Custom') : t.type}</span>
                    </div>
                    <div className="text-xs opacity-60">{renderTaskSummary(t)}</div>
                  </div>
                  <TaskRowMenu
                    onEdit={t.scheduleKind === 'repeat_pattern' ? () => {
                      setEditingTask(t)
                      setPatternPeriod((t.period as any) || 'week')
                      setPatternAmount(Number(t.amount || t.requiredCount || 1))
                      setPatternSelection({
                        weeklyDays: t.weeklyDays || undefined,
                        monthlyDays: t.monthlyDays || undefined,
                        yearlyDays: t.yearlyDays || undefined,
                        monthlyNthWeekdays: t.monthlyNthWeekdays || undefined,
                      })
                      // Delay open to next tick to avoid menu overlay capturing events
                      setTimeout(() => setPatternOpen(true), 0)
                    } : undefined}
                    onDelete={() => remove(t.id)}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" className="rounded-2xl" onClick={() => { resetEditor(); onOpenChange(false) }}>Close</Button>
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
              setEditingTask(null)
              await load()
              if (onChanged) await onChanged()
            } catch (e: any) {
              setError(e?.message || 'Failed to update task')
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
        onCreated={async () => { await load(); if (onChanged) await onChanged() }}
      />
    </Dialog>
  )
}

function renderTaskSummary(t: GardenPlantTask): string {
  if (t.scheduleKind === 'one_time_date') {
    return `One time on ${t.dueAt ? new Date(t.dueAt).toLocaleString() : '—'}`
  }
  if (t.scheduleKind === 'one_time_duration') {
    return `One time in ${t.intervalAmount} ${t.intervalUnit}`
  }
  if (t.scheduleKind === 'repeat_duration') {
    return `Every ${t.intervalAmount} ${t.intervalUnit}, need ${t.requiredCount}`
  }
  if (t.scheduleKind === 'repeat_pattern') {
    if (t.period === 'week') return `Per week: ${(t.weeklyDays || []).length} day(s)`
    if (t.period === 'month') return `Per month: ${(t.monthlyNthWeekdays || t.monthlyDays || []).length} time(s)`
    return `Per year: ${(t.yearlyDays || []).length} time(s)`
  }
  return ''
}

function TaskRowMenu({ onEdit, onDelete }: { onEdit?: () => void; onDelete: () => void }) {
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
            <button onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit() }} className="w-full text-left px-3 py-2 rounded-t-xl hover:bg-stone-50">Edit</button>
          )}
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete() }} className={`w-full text-left px-3 py-2 ${onEdit ? '' : 'rounded-t-xl'} rounded-b-xl hover:bg-stone-50 text-red-600`}>Delete</button>
        </div>
      )}
    </div>
  )
}

