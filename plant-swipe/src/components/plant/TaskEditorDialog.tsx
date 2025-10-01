// @ts-nocheck
import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { TaskType, TaskScheduleKind, TaskUnit, GardenPlantTask } from '@/types/garden'
import { createDefaultWateringTask, upsertOneTimeTask, listPlantTasks, deletePlantTask, createPatternTask, updatePatternTask } from '@/lib/gardens'
import { SchedulePickerDialog } from '@/components/plant/SchedulePickerDialog'

export function TaskEditorDialog({ open, onOpenChange, gardenId, gardenPlantId }: { open: boolean; onOpenChange: (o: boolean) => void; gardenId: string; gardenPlantId: string }) {
  const [tasks, setTasks] = React.useState<GardenPlantTask[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [type, setType] = React.useState<TaskType>('water')
  const [customName, setCustomName] = React.useState<string>('')
  const [scheduleKind, setScheduleKind] = React.useState<TaskScheduleKind>('repeat_pattern')
  const [dueAt, setDueAt] = React.useState<string>('')
  const [intervalAmount, setIntervalAmount] = React.useState<number>(1)
  const [intervalUnit, setIntervalUnit] = React.useState<TaskUnit>('day')
  const [requiredCount, setRequiredCount] = React.useState<number>(2)
  const [saving, setSaving] = React.useState(false)

  // Pattern scheduling state
  const [patternOpen, setPatternOpen] = React.useState(false)
  const [patternPeriod, setPatternPeriod] = React.useState<'week'|'month'|'year'>('week')
  const [patternAmount, setPatternAmount] = React.useState<number>(1)
  const [patternSelection, setPatternSelection] = React.useState<{ weeklyDays?: number[]; monthlyDays?: number[]; yearlyDays?: string[]; monthlyNthWeekdays?: string[] }>({})
  const [editingTask, setEditingTask] = React.useState<GardenPlantTask | null>(null)

  const load = React.useCallback(async () => {
    if (!gardenPlantId) return
    setLoading(true)
    setError(null)
    try {
      const rows = await listPlantTasks(gardenPlantId)
      setTasks(rows)
    } catch (e: any) {
      setError(e?.message || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [gardenPlantId])

  React.useEffect(() => { if (open) load() }, [open, load])

  const resetForm = () => {
    setType('water')
    setCustomName('')
    setScheduleKind('repeat_pattern')
    setDueAt('')
    setIntervalAmount(1)
    setIntervalUnit('day')
    setRequiredCount(2)
    setPatternPeriod('week')
    setPatternAmount(1)
    setPatternSelection({})
    setEditingTask(null)
  }

  const save = async () => {
    if (!gardenId || !gardenPlantId || saving) return
    setSaving(true)
    setError(null)
    try {
      if (scheduleKind === 'repeat_duration' && type === 'water' && requiredCount === 2 && intervalAmount === 1) {
        await createDefaultWateringTask({ gardenId, gardenPlantId, unit: intervalUnit })
      } else if (scheduleKind === 'repeat_pattern') {
        const sel = patternSelection || {}
        await createPatternTask({
          gardenId,
          gardenPlantId,
          type,
          customName: type === 'custom' ? (customName || null) : null,
          period: patternPeriod,
          amount: patternAmount,
          weeklyDays: patternPeriod === 'week' ? (sel.weeklyDays || []) : null,
          monthlyDays: patternPeriod === 'month' ? (sel.monthlyDays || []) : null,
          yearlyDays: patternPeriod === 'year' ? (sel.yearlyDays || []) : null,
          monthlyNthWeekdays: patternPeriod === 'month' ? (sel.monthlyNthWeekdays || []) : null,
          requiredCount,
        })
      } else if (scheduleKind === 'one_time_date') {
        const dateIso = dueAt ? new Date(dueAt).toISOString() : null
        await upsertOneTimeTask({ gardenId, gardenPlantId, type, customName: type === 'custom' ? (customName || null) : null, kind: 'one_time_date', dueAt: dateIso, requiredCount })
      } else if (scheduleKind === 'one_time_duration') {
        await upsertOneTimeTask({ gardenId, gardenPlantId, type, customName: type === 'custom' ? (customName || null) : null, kind: 'one_time_duration', intervalAmount, intervalUnit, requiredCount })
      } else if (scheduleKind === 'repeat_duration') {
        await upsertOneTimeTask({ gardenId, gardenPlantId, type, customName: type === 'custom' ? (customName || null) : null, kind: 'repeat_duration', intervalAmount, intervalUnit, requiredCount })
      }
      resetForm()
      await load()
    } catch (e: any) {
      setError(e?.message || 'Failed to save task')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (taskId: string) => {
    try {
      await deletePlantTask(taskId)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Failed to delete task')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Tasks</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Existing tasks</div>
            <div className="max-h-48 overflow-auto rounded-xl border">
              {loading && <div className="p-3 text-sm opacity-60">Loading…</div>}
              {error && <div className="p-3 text-sm text-red-600">{error}</div>}
              {!loading && tasks.length === 0 && <div className="p-3 text-sm opacity-60">No tasks yet</div>}
              {tasks.map(t => (
                <div key={t.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0">
                  <div className="text-sm">
                    <div className="font-medium">{t.type === 'custom' ? (t.customName || 'Custom') : t.type}</div>
                    <div className="text-xs opacity-60">
                      {t.scheduleKind === 'one_time_date' && `One time on ${t.dueAt ? new Date(t.dueAt).toLocaleString() : '—'}`}
                      {t.scheduleKind === 'one_time_duration' && `One time in ${t.intervalAmount} ${t.intervalUnit}`}
                      {t.scheduleKind === 'repeat_duration' && `Every ${t.intervalAmount} ${t.intervalUnit}, need ${t.requiredCount}`}
                      {t.scheduleKind === 'repeat_pattern' && (
                        t.period === 'week'
                          ? `Per week: ${(t.weeklyDays || []).length} day(s)`
                          : t.period === 'month'
                            ? `Per month: ${(t.monthlyNthWeekdays || t.monthlyDays || []).length} time(s)`
                            : `Per year: ${(t.yearlyDays || []).length} date(s)`
                      )}
                    </div>
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
                      setPatternOpen(true)
                    } : undefined}
                    onDelete={() => remove(t.id)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Add task</div>
            <div className="grid grid-cols-2 gap-2">
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm md:text-sm" value={type} onChange={(e: any) => setType(e.target.value)}>
                {(['water','fertilize','harvest','custom'] as TaskType[]).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm md:text-sm" value={scheduleKind} onChange={(e: any) => setScheduleKind(e.target.value)}>
                {(['repeat_pattern','one_time_date','one_time_duration','repeat_duration'] as TaskScheduleKind[]).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            {type === 'custom' && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Custom name</label>
                <Input value={customName} onChange={(e: any) => setCustomName(e.target.value)} placeholder="e.g., Prune roses" />
              </div>
            )}
            {scheduleKind === 'repeat_pattern' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm md:text-sm" value={patternPeriod} onChange={(e: any) => setPatternPeriod(e.target.value)}>
                    {(['week','month','year'] as Array<'week'|'month'|'year'>).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <Input type="number" min={1} max={patternPeriod === 'week' ? 7 : patternPeriod === 'month' ? 4 : 12} value={String(patternAmount)} onChange={(e: any) => setPatternAmount(Math.max(1, Number(e.target.value || '1')))} />
                </div>
                <div className="text-xs opacity-60">
                  {patternPeriod === 'week' && 'Pick days Monday–Sunday'}
                  {patternPeriod === 'month' && 'Pick 1st–4th weekdays (e.g., 1st Mon)'}
                  {patternPeriod === 'year' && 'Pick specific dates across the year'}
                </div>
                <div>
                  <Button variant="secondary" className="rounded-2xl" onClick={() => setPatternOpen(true)}>Pick schedule…</Button>
                </div>
              </div>
            )}
            {scheduleKind === 'one_time_date' && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Due date/time</label>
                <Input type="datetime-local" value={dueAt} onChange={(e: any) => setDueAt(e.target.value)} />
              </div>
            )}
            {scheduleKind !== 'one_time_date' && scheduleKind !== 'repeat_pattern' && (
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" min={1} value={String(intervalAmount)} onChange={(e: any) => setIntervalAmount(Math.max(1, Number(e.target.value || '1')))} />
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm md:text-sm" value={intervalUnit} onChange={(e: any) => setIntervalUnit(e.target.value)}>
                  {(['hour','day','week','month','year'] as TaskUnit[]).map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Required count</label>
              <Input type="number" min={1} value={String(requiredCount)} onChange={(e: any) => setRequiredCount(Math.max(1, Number(e.target.value || '1')))} />
              <div className="text-xs opacity-60">Progress and completion use this count.</div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" className="rounded-2xl" onClick={() => { resetForm(); onOpenChange(false) }}>Close</Button>
              <Button className="rounded-2xl" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save task'}</Button>
            </div>
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
                requiredCount,
              })
              setEditingTask(null)
              await load()
            } catch (e: any) {
              setError(e?.message || 'Failed to update task')
            }
          }
        }}
        initialSelection={patternSelection}
        onChangeAmount={(n) => setPatternAmount(n)}
        allowedPeriods={[patternPeriod]}
      />
    </Dialog>
  )
}

function TaskRowMenu({ onEdit, onDelete }: { onEdit?: () => void; onDelete: () => void }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="relative">
      <Button variant="secondary" className="rounded-xl px-2" onClick={(e: any) => { e.stopPropagation(); setOpen((o) => !o) }}>⋯</Button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-white border rounded-xl shadow-lg z-10">
          {onEdit && (
            <button onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit() }} className="w-full text-left px-3 py-2 rounded-t-xl hover:bg-stone-50">Edit</button>
          )}
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete() }} className={`w-full text-left px-3 py-2 ${onEdit ? '' : 'rounded-t-xl'} rounded-b-xl hover:bg-stone-50 text-red-600`}>Delete</button>
        </div>
      )}
    </div>
  )
}

