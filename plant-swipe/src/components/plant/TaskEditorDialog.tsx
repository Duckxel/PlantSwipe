import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { TaskType, TaskScheduleKind, TaskUnit, GardenPlantTask } from '@/types/garden'
import { createDefaultWateringTask, upsertOneTimeTask, listPlantTasks, deletePlantTask } from '@/lib/gardens'

export function TaskEditorDialog({ open, onOpenChange, gardenId, gardenPlantId }: { open: boolean; onOpenChange: (o: boolean) => void; gardenId: string; gardenPlantId: string }) {
  const [tasks, setTasks] = React.useState<GardenPlantTask[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [type, setType] = React.useState<TaskType>('water')
  const [customName, setCustomName] = React.useState<string>('')
  const [scheduleKind, setScheduleKind] = React.useState<TaskScheduleKind>('repeat_duration')
  const [dueAt, setDueAt] = React.useState<string>('')
  const [intervalAmount, setIntervalAmount] = React.useState<number>(1)
  const [intervalUnit, setIntervalUnit] = React.useState<TaskUnit>('day')
  const [requiredCount, setRequiredCount] = React.useState<number>(2)
  const [saving, setSaving] = React.useState(false)

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
    setScheduleKind('repeat_duration')
    setDueAt('')
    setIntervalAmount(1)
    setIntervalUnit('day')
    setRequiredCount(2)
  }

  const save = async () => {
    if (!gardenId || !gardenPlantId || saving) return
    setSaving(true)
    setError(null)
    try {
      if (scheduleKind === 'repeat_duration' && type === 'water' && requiredCount === 2 && intervalAmount === 1) {
        await createDefaultWateringTask({ gardenId, gardenPlantId, unit: intervalUnit })
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
                    </div>
                  </div>
                  <Button variant="secondary" className="rounded-xl" onClick={() => remove(t.id)}>Delete</Button>
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
                {(['one_time_date','one_time_duration','repeat_duration'] as TaskScheduleKind[]).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            {type === 'custom' && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Custom name</label>
                <Input value={customName} onChange={(e: any) => setCustomName(e.target.value)} placeholder="e.g., Prune roses" />
              </div>
            )}
            {scheduleKind === 'one_time_date' && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Due date/time</label>
                <Input type="datetime-local" value={dueAt} onChange={(e: any) => setDueAt(e.target.value)} />
              </div>
            )}
            {scheduleKind !== 'one_time_date' && (
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
    </Dialog>
  )
}

