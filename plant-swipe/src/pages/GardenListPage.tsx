// @ts-nocheck
import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/context/AuthContext'
import { getUserGardens, createGarden, fetchServerNowISO, getGardenTodayProgress, getGardenPlants, listGardenTasks, listOccurrencesForTasks, resyncTaskOccurrencesForGarden, progressTaskOccurrence } from '@/lib/gardens'
import type { Garden } from '@/types/garden'
import { useNavigate } from 'react-router-dom'

export const GardenListPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [gardens, setGardens] = React.useState<Garden[]>([])
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [imageUrl, setImageUrl] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [progressByGarden, setProgressByGarden] = React.useState<Record<string, { due: number; completed: number }>>({})
  const [serverToday, setServerToday] = React.useState<string | null>(null)
  const [loadingTasks, setLoadingTasks] = React.useState(false)
  const [allPlants, setAllPlants] = React.useState<any[]>([])
  const [todayTaskOccurrences, setTodayTaskOccurrences] = React.useState<Array<{ id: string; taskId: string; gardenPlantId: string; dueAt: string; requiredCount: number; completedCount: number; completedAt: string | null; taskType?: 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'; taskEmoji?: string | null }>>([])

  const notifyTasksChanged = React.useCallback(() => {
    try { window.dispatchEvent(new CustomEvent('garden:tasks_changed')) } catch {}
  }, [])

  const load = React.useCallback(async () => {
    if (!user?.id) { setGardens([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const data = await getUserGardens(user.id)
      setGardens(data)
      // Fetch server 'today' and compute per-garden progress
      const nowIso = await fetchServerNowISO()
      const today = nowIso.slice(0,10)
      setServerToday(today)
      const entries = await Promise.all(
        data.map(async (g) => {
          try {
            const prog = await getGardenTodayProgress(g.id, today)
            return [g.id, prog] as const
          } catch {
            return [g.id, { due: 0, completed: 0 }] as const
          }
        })
      )
      const map: Record<string, { due: number; completed: number }> = {}
      for (const [gid, prog] of entries) map[gid] = prog
      setProgressByGarden(map)
    } catch (e: any) {
      setError(e?.message || 'Failed to load gardens')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  React.useEffect(() => { load() }, [load])

  // Load all gardens' tasks due today for the sidebar
  const loadAllTodayOccurrences = React.useCallback(async () => {
    if (!serverToday) return
    if (gardens.length === 0) { setAllPlants([]); setTodayTaskOccurrences([]); return }
    setLoadingTasks(true)
    try {
      const startIso = `${serverToday}T00:00:00.000Z`
      const endIso = `${serverToday}T23:59:59.999Z`
      // 1) Fetch tasks per garden
      const tasksPerGarden = await Promise.all(gardens.map(g => listGardenTasks(g.id)))
      const taskTypeById: Record<string, 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'> = {}
      const taskEmojiById: Record<string, string | null> = {}
      const taskIdsByGarden: Record<string, string[]> = {}
      for (let i = 0; i < gardens.length; i++) {
        const g = gardens[i]
        const tasks = tasksPerGarden[i] || []
        taskIdsByGarden[g.id] = tasks.map(t => t.id)
        for (const t of tasks) {
          taskTypeById[t.id] = (t as any).type
          taskEmojiById[t.id] = (t as any).emoji || null
        }
      }
      // 2) Resync occurrences per garden in parallel
      await Promise.all(gardens.map(g => resyncTaskOccurrencesForGarden(g.id, startIso, endIso)))
      // 3) Load occurrences per garden
      const occsPerGarden = await Promise.all(gardens.map(g => listOccurrencesForTasks(taskIdsByGarden[g.id] || [], startIso, endIso)))
      const occsAugmented: Array<any> = []
      for (const arr of occsPerGarden) {
        for (const o of (arr || [])) {
          occsAugmented.push({
            ...o,
            taskType: taskTypeById[o.taskId] || 'custom',
            taskEmoji: taskEmojiById[o.taskId] || null,
          })
        }
      }
      setTodayTaskOccurrences(occsAugmented)
      // 4) Load plants for all gardens for display and mapping
      const plantsPerGarden = await Promise.all(gardens.map(g => getGardenPlants(g.id)))
      const idToGardenName = gardens.reduce<Record<string, string>>((acc, g) => { acc[g.id] = g.name; return acc }, {})
      const all = plantsPerGarden.flat().map((gp: any) => ({
        ...gp,
        gardenName: idToGardenName[gp.gardenId] || '',
      }))
      setAllPlants(all)
    } catch {
      // swallow; page has global error area
    } finally {
      setLoadingTasks(false)
    }
  }, [gardens, serverToday])

  React.useEffect(() => { loadAllTodayOccurrences() }, [loadAllTodayOccurrences])

  const onProgressOccurrence = React.useCallback(async (occId: string, inc: number) => {
    try {
      await progressTaskOccurrence(occId, inc)
    } finally {
      await load()
      await loadAllTodayOccurrences()
      notifyTasksChanged()
    }
  }, [load, loadAllTodayOccurrences, notifyTasksChanged])

  const onCompleteAllForPlant = React.useCallback(async (gardenPlantId: string) => {
    try {
      const occs = todayTaskOccurrences.filter(o => o.gardenPlantId === gardenPlantId)
      const ops: Promise<any>[] = []
      for (const o of occs) {
        const remaining = Math.max(0, Number(o.requiredCount || 1) - Number(o.completedCount || 0))
        if (remaining > 0) ops.push(progressTaskOccurrence(o.id, remaining))
      }
      if (ops.length > 0) await Promise.all(ops)
    } finally {
      await load()
      await loadAllTodayOccurrences()
      notifyTasksChanged()
    }
  }, [todayTaskOccurrences, load, loadAllTodayOccurrences, notifyTasksChanged])

  const onCreate = async () => {
    if (!user?.id) return
    if (!name.trim() || submitting) return
    setSubmitting(true)
    try {
      const garden = await createGarden({ name: name.trim(), coverImageUrl: imageUrl.trim() || null, ownerUserId: user.id })
      setOpen(false)
      setName('')
      setImageUrl('')
      // Navigate to the new garden dashboard
      navigate(`/garden/${garden.id}`)
    } catch (e: any) {
      setError(e?.message || 'Failed to create garden')
    } finally {
      setSubmitting(false)
    }
  }

  // Derived helpers for tasks sidebar
  const occsByPlant = React.useMemo(() => {
    const map: Record<string, typeof todayTaskOccurrences> = {}
    for (const o of todayTaskOccurrences) {
      if (!map[o.gardenPlantId]) map[o.gardenPlantId] = [] as any
      map[o.gardenPlantId].push(o)
    }
    return map
  }, [todayTaskOccurrences])

  const plantsWithTasks = React.useMemo(() => {
    return allPlants.filter((gp: any) => (occsByPlant[gp.id] || []).length > 0)
  }, [allPlants, occsByPlant])

  const totalTasks = React.useMemo(() => todayTaskOccurrences.reduce((a, o) => a + Math.max(1, Number(o.requiredCount || 1)), 0), [todayTaskOccurrences])
  const totalDone = React.useMemo(() => todayTaskOccurrences.reduce((a, o) => a + Math.min(Math.max(1, Number(o.requiredCount || 1)), Number(o.completedCount || 0)), 0), [todayTaskOccurrences])

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-0">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div>
          <div className="flex items-center justify-between mt-6 mb-4">
            <h1 className="text-2xl font-semibold">Your Gardens</h1>
            {user && (
              <Button className="rounded-2xl" onClick={() => setOpen(true)}>Create Garden</Button>
            )}
          </div>
          {loading && <div className="p-6 opacity-60 text-sm">Loading…</div>}
          {error && <div className="p-6 text-sm text-red-600">{error}</div>}
          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gardens.map((g, idx) => (
                <Card key={g.id} className={`rounded-2xl overflow-hidden relative ${dragIndex === idx ? 'ring-2 ring-black' : ''}`} draggable onDragStart={() => setDragIndex(idx)} onDragOver={(e) => e.preventDefault()} onDrop={() => {
                  if (dragIndex === null || dragIndex === idx) return;
                  const arr = gardens.slice()
                  const [moved] = arr.splice(dragIndex, 1)
                  arr.splice(idx, 0, moved)
                  setGardens(arr)
                  setDragIndex(null)
                }}>
                  {progressByGarden[g.id] && (
                    (() => {
                      const { due, completed } = progressByGarden[g.id]
                      const done = due === 0 || completed >= due
                      const inProgress = due > 0 && completed > 0 && completed < due
                      const color = done ? 'bg-emerald-500 text-white' : inProgress ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                      const label = done ? 'All done' : `${completed} / ${due}`
                      return (
                        <div className={`pointer-events-none absolute top-2 right-2 rounded-xl px-2 py-0.5 text-xs font-medium shadow ${color}`}>
                          {label}
                        </div>
                      )
                    })()
                  )}
                  <button onClick={() => navigate(`/garden/${g.id}`)} className="grid grid-cols-3 gap-0 w-full text-left">
                    <div className="col-span-1 h-36 bg-cover bg-center rounded-l-2xl" style={{ backgroundImage: `url(${g.coverImageUrl || ''})` }} />
                    <div className="col-span-2 p-4">
                      <div className="font-medium">{g.name}</div>
                      <div className="text-xs opacity-60">Created {new Date(g.createdAt).toLocaleDateString()}</div>
                    </div>
                  </button>
                </Card>
              ))}
            </div>
          )}
          {!loading && !error && gardens.length === 0 && (
            <div className="p-10 text-center opacity-60 text-sm">No gardens yet. Create your first garden to get started.</div>
          )}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Create a Garden</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="My balcony garden" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Cover image URL (optional)</label>
                  <Input value={imageUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageUrl(e.target.value)} placeholder="https://…" />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="secondary" className="rounded-2xl" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button className="rounded-2xl" onClick={onCreate} disabled={!name.trim() || submitting}>{submitting ? 'Creating…' : 'Create'}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Right-side Tasks sidebar for all gardens */}
        <aside className="mt-6 lg:mt-6">
          <div className="space-y-3">
            <div className="text-lg font-semibold">Tasks</div>
            <Card className="rounded-2xl p-4">
              <div className="text-sm opacity-60 mb-2">All gardens</div>
              <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                <div className="h-2 bg-emerald-500" style={{ width: `${totalTasks === 0 ? 100 : Math.min(100, Math.round((totalDone / totalTasks) * 100))}%` }} />
              </div>
              <div className="text-xs opacity-70 mt-1">Today: {totalDone} / {totalTasks}</div>
            </Card>
            {loadingTasks && (
              <Card className="rounded-2xl p-4 text-sm opacity-70">Loading tasks…</Card>
            )}
            {!loadingTasks && plantsWithTasks.length === 0 && (
              <Card className="rounded-2xl p-4 text-sm opacity-70">No tasks due today. 🌿</Card>
            )}
            {!loadingTasks && plantsWithTasks.map((gp: any) => {
              const occs = occsByPlant[gp.id] || []
              const req = occs.reduce((a: number, o: any) => a + Math.max(1, Number(o.requiredCount || 1)), 0)
              const done = occs.reduce((a: number, o: any) => a + Math.min(Math.max(1, Number(o.requiredCount || 1)), Number(o.completedCount || 0)), 0)
              return (
                <Card key={gp.id} className="rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{gp.nickname || gp.plant?.name}</div>
                      <div className="text-xs opacity-60">{gp.gardenName}{gp.nickname ? ` • ${gp.plant?.name || ''}` : ''}</div>
                      <div className="text-xs opacity-70">{done} / {req} done</div>
                    </div>
                    {(done < req) && (
                      <Button size="sm" className="rounded-xl" onClick={() => onCompleteAllForPlant(gp.id)}>Complete all</Button>
                    )}
                  </div>
                  <div className="mt-2 space-y-2">
                    {occs.map((o: any) => {
                      const tt = (o as any).taskType || 'custom'
                      const badgeClass = `${tt === 'water' ? 'bg-blue-500' : tt === 'fertilize' ? 'bg-green-500' : tt === 'harvest' ? 'bg-yellow-400' : tt === 'cut' ? 'bg-orange-500' : 'bg-purple-500'} ${tt === 'harvest' ? 'text-black' : 'text-white'}`
                      const icon = (o as any).taskEmoji || (tt === 'water' ? '💧' : tt === 'fertilize' ? '🍽️' : tt === 'harvest' ? '🌾' : tt === 'cut' ? '✂️' : '🪴')
                      return (
                        <div key={o.id} className="flex items-center justify-between gap-3 text-sm rounded-xl border p-2">
                          <div className="flex items-center gap-2">
                            <span className={`h-6 w-6 flex items-center justify-center rounded-md border`}>{icon}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}>{String(tt).toUpperCase()}</span>
                            <span className="text-xs opacity-70">{gp.nickname || gp.plant?.name}</span>
                          </div>
                          <div className="opacity-80">{o.completedCount} / {o.requiredCount}</div>
                          <Button className="rounded-xl" size="sm" onClick={() => onProgressOccurrence(o.id, 1)} disabled={(o.completedCount || 0) >= (o.requiredCount || 1)}>+1</Button>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )
            })}
          </div>
        </aside>
      </div>
    </div>
  )
}

