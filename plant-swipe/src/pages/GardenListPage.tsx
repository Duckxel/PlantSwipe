// @ts-nocheck
import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/context/AuthContext'
import { getUserGardens, createGarden, fetchServerNowISO, getGardenTodayProgress, getGardenPlants, listGardenTasks, listOccurrencesForTasks, resyncTaskOccurrencesForGarden, progressTaskOccurrence, listCompletionsForOccurrences, logGardenActivity } from '@/lib/gardens'
import { supabase } from '@/lib/supabaseClient'
import { addGardenBroadcastListener, broadcastGardenUpdate, type GardenRealtimeKind } from '@/lib/realtime'
import type { Garden } from '@/types/garden'
import { useTranslation } from 'react-i18next'
import { useLanguageNavigate } from '@/lib/i18nRouting'

export const GardenListPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useLanguageNavigate()
  const { t } = useTranslation('common')
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
  const [completionsByOcc, setCompletionsByOcc] = React.useState<Record<string, Array<{ userId: string; displayName: string | null }>>>({})

  const reloadTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastReloadRef = React.useRef<number>(0)
  const gardenIdsRef = React.useRef<Set<string>>(new Set())
  const gardensRef = React.useRef<typeof gardens>([])
  const serverTodayRef = React.useRef<string | null>(null)

  const emitGardenRealtime = React.useCallback((gardenId: string, kind: GardenRealtimeKind = 'tasks', metadata?: Record<string, unknown>) => {
    try { window.dispatchEvent(new CustomEvent('garden:tasks_changed')) } catch {}
    broadcastGardenUpdate({ gardenId, kind, metadata, actorId: user?.id ?? null }).catch(() => {})
  }, [user?.id])

  const load = React.useCallback(async () => {
    if (!user?.id) {
      setGardens([])
      gardensRef.current = []
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getUserGardens(user.id)
      setGardens(data)
      gardensRef.current = data
      // Fetch server 'today' and compute per-garden progress
      const nowIso = await fetchServerNowISO()
      const today = nowIso.slice(0,10)
      setServerToday(today)
      serverTodayRef.current = today
      // compute progress sequentially to avoid hammering backend on frequent realtime updates
      const entries: Array<[string, { due: number; completed: number }]> = []
      for (const g of data) {
        try {
          const prog = await getGardenTodayProgress(g.id, today)
          entries.push([g.id, prog])
        } catch {
          entries.push([g.id, { due: 0, completed: 0 }])
        }
      }
      const map: Record<string, { due: number; completed: number }> = {}
      for (const [gid, prog] of entries) map[gid] = prog
      setProgressByGarden(map)
    } catch (e: any) {
      setError(e?.message || t('garden.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }, [user?.id, t])

  React.useEffect(() => { load() }, [load])

  // Load all gardens' tasks due today for the sidebar
  const loadAllTodayOccurrences = React.useCallback(async (
    gardensOverride?: typeof gardens,
    todayOverride?: string | null,
  ) => {
    const today = todayOverride ?? serverTodayRef.current ?? serverToday
    const gardensList = gardensOverride ?? gardensRef.current ?? gardens
    if (!today) return
    if (gardensList.length === 0) { setAllPlants([]); setTodayTaskOccurrences([]); return }
    setLoadingTasks(true)
    try {
      const startIso = `${today}T00:00:00.000Z`
      const endIso = `${today}T23:59:59.999Z`
      // 1) Fetch tasks per garden sequentially (reduce contention during rapid realtime)
      const tasksPerGarden: any[] = []
      for (const g of gardensList) {
        tasksPerGarden.push(await listGardenTasks(g.id))
      }
      const taskTypeById: Record<string, 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'> = {}
      const taskEmojiById: Record<string, string | null> = {}
      const taskIdsByGarden: Record<string, string[]> = {}
      for (let i = 0; i < gardensList.length; i++) {
        const g = gardensList[i]
        const tasks = tasksPerGarden[i] || []
        taskIdsByGarden[g.id] = tasks.map(t => t.id)
        for (const t of tasks) {
          taskTypeById[t.id] = (t as any).type
          taskEmojiById[t.id] = (t as any).emoji || null
        }
      }
      // 2) Resync occurrences per garden in parallel
      await Promise.all(gardensList.map(g => resyncTaskOccurrencesForGarden(g.id, startIso, endIso)))
      // 3) Load occurrences per garden
      const occsPerGarden = await Promise.all(gardensList.map(g => listOccurrencesForTasks(taskIdsByGarden[g.id] || [], startIso, endIso)))
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
      // Fetch completions for all occurrences
      const ids = occsAugmented.map(o => o.id)
      const compMap = await listCompletionsForOccurrences(ids)
      setCompletionsByOcc(compMap)
      // 4) Load plants for all gardens for display and mapping
      const plantsPerGarden = await Promise.all(gardensList.map(g => getGardenPlants(g.id)))
      const idToGardenName = gardensList.reduce<Record<string, string>>((acc, g) => { acc[g.id] = g.name; return acc }, {})
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

  const scheduleReload = React.useCallback(() => {
    const execute = async () => {
      lastReloadRef.current = Date.now()
      await load()
      await loadAllTodayOccurrences()
    }

    const now = Date.now()
    const since = now - (lastReloadRef.current || 0)
    const minInterval = 750

    if (since < minInterval) {
      if (reloadTimerRef.current) return
      const wait = Math.max(0, minInterval - since)
      reloadTimerRef.current = setTimeout(() => {
        reloadTimerRef.current = null
        execute().catch(() => {})
      }, wait)
      return
    }

    if (reloadTimerRef.current) return
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null
      execute().catch(() => {})
    }, 50)
  }, [load, loadAllTodayOccurrences])

  React.useEffect(() => {
    return () => {
      if (reloadTimerRef.current) {
        try { clearTimeout(reloadTimerRef.current) } catch {}
        reloadTimerRef.current = null
      }
    }
  }, [])

  React.useEffect(() => {
    gardenIdsRef.current = new Set(gardens.map((g) => g.id))
  }, [gardens])

  const notifyTasksChanged = React.useCallback(() => {
    try { window.dispatchEvent(new CustomEvent('garden:tasks_changed')) } catch {}
  }, [])

  // SSE: listen for server-driven membership updates for instant garden list refresh
  React.useEffect(() => {
    if (!user?.id) return
    let es: EventSource | null = null
    ;(async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session
        const token = session?.access_token
        const url = token ? `/api/self/memberships/stream?token=${encodeURIComponent(token)}` : '/api/self/memberships/stream'
        es = new EventSource(url, { withCredentials: true })
        const handler = () => scheduleReload()
        es.addEventListener('ready', () => {})
        es.addEventListener('memberships', handler as any)
        es.onerror = () => {}
      } catch {}
    })()
    return () => { try { es?.close() } catch {} }
  }, [scheduleReload, user?.id])

  // SSE: listen to all-gardens activity and refresh on any activity event
  React.useEffect(() => {
    if (!user?.id) return
    let es: EventSource | null = null
    ;(async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session
        const token = session?.access_token
        const url = token ? `/api/self/gardens/activity/stream?token=${encodeURIComponent(token)}` : '/api/self/gardens/activity/stream'
        es = new EventSource(url, { withCredentials: true })
        const handler = () => scheduleReload()
        es.addEventListener('ready', () => {})
        es.addEventListener('membership', handler as any)
        es.addEventListener('activity', handler as any)
        es.onerror = () => {}
      } catch {}
    })()
    return () => { try { es?.close() } catch {} }
  }, [scheduleReload, user?.id])

  // Realtime: reflect membership changes and garden/task updates instantly
  React.useEffect(() => {
    if (!user?.id) return
    const ch = supabase
      .channel(`rt-gardens-for-${user.id}`)
      // When current user's membership rows change (added/removed), refresh list
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_members', filter: `user_id=eq.${user.id}` }, () => scheduleReload())
      // Garden metadata changes (rename, cover). Also watch deletes to drop immediately.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gardens' }, () => scheduleReload())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'gardens' }, () => scheduleReload())
      // Plants/Tasks changes across any garden (kept broad to ensure immediacy)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_plants' }, () => scheduleReload())
      // Watch both scoped and unscoped task changes to ensure updates reflect
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_plant_tasks' }, () => scheduleReload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_plant_task_occurrences' }, () => scheduleReload())

    const subscription = ch.subscribe()
    if (subscription instanceof Promise) subscription.catch(() => {})
    return () => {
      try { supabase.removeChannel(ch) } catch {}
    }
  }, [scheduleReload, user?.id])

  React.useEffect(() => { loadAllTodayOccurrences() }, [loadAllTodayOccurrences])

  React.useEffect(() => {
    let active = true
    let teardown: (() => Promise<void>) | null = null

    addGardenBroadcastListener((message) => {
      if (message.actorId && user?.id && message.actorId === user.id) return
      if (!gardenIdsRef.current.has(message.gardenId)) return
      scheduleReload()
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
  }, [scheduleReload, user?.id])

  const onProgressOccurrence = React.useCallback(async (occId: string, inc: number) => {
    let broadcastGardenId: string | null = null
    try {
      await progressTaskOccurrence(occId, inc)
      // Log activity for the appropriate garden
      try {
        const o = todayTaskOccurrences.find((x: any) => x.id === occId)
        if (o) {
          const gp = allPlants.find((p: any) => p.id === o.gardenPlantId)
          const gardenId = gp?.gardenId
          if (gardenId) broadcastGardenId = gardenId
          if (gardenId) {
            const type = (o as any).taskType || 'custom'
            const label = String(type).toUpperCase()
            const plantName = gp?.nickname || gp?.plant?.name || null
            const newCount = Number(o.completedCount || 0) + inc
            const required = Math.max(1, Number(o.requiredCount || 1))
            const done = newCount >= required
            const kind = done ? 'task_completed' : 'task_progressed'
            const msg = done
              ? `has completed "${label}" Task on "${plantName || 'Plant'}"`
              : `has progressed "${label}" Task on "${plantName || 'Plant'}" (${Math.min(newCount, required)}/${required})`
            await logGardenActivity({ gardenId, kind: kind as any, message: msg, plantName: plantName || null, taskName: label, actorColor: null })
            // Broadcast update BEFORE reload to ensure other clients receive it
            await broadcastGardenUpdate({ gardenId, kind: 'tasks', actorId: user?.id ?? null }).catch((err) => {
              console.warn('[GardenList] Failed to broadcast task update:', err)
            })
          }
        }
      } catch {}
    } finally {
      // Always refresh gardens and occurrences so UI counts update immediately
      await load()
      await loadAllTodayOccurrences()
      if (broadcastGardenId) emitGardenRealtime(broadcastGardenId, 'tasks')
    }
  }, [allPlants, emitGardenRealtime, load, loadAllTodayOccurrences, todayTaskOccurrences, user?.id])

  const onCompleteAllForPlant = React.useCallback(async (gardenPlantId: string) => {
    const gp = allPlants.find((p: any) => p.id === gardenPlantId)
    const gardenId = gp?.gardenId ? String(gp.gardenId) : null
    try {
      const occs = todayTaskOccurrences.filter(o => o.gardenPlantId === gardenPlantId)
      for (const o of occs) {
        const remaining = Math.max(0, Number(o.requiredCount || 1) - Number(o.completedCount || 0))
        if (remaining <= 0) continue
        for (let i = 0; i < remaining; i++) {
          await progressTaskOccurrence(o.id, 1)
        }
      }
      // Log summary activity for this plant/garden
      try {
        const gp = allPlants.find((p: any) => p.id === gardenPlantId)
        if (gp?.gardenId) {
          const plantName = gp?.nickname || gp?.plant?.name || 'Plant'
          await logGardenActivity({ gardenId: gp.gardenId, kind: 'task_completed' as any, message: `completed all due tasks on "${plantName}"`, plantName, actorColor: null })
          // Broadcast update AFTER all task completions finish, BEFORE reload to ensure other clients receive it
          await broadcastGardenUpdate({ gardenId: gp.gardenId, kind: 'tasks', actorId: user?.id ?? null }).catch((err) => {
            console.warn('[GardenList] Failed to broadcast task update:', err)
          })
        }
      } catch {}
    } finally {
      await load()
      await loadAllTodayOccurrences()
      if (gardenId) emitGardenRealtime(gardenId, 'tasks')
    }
  }, [allPlants, emitGardenRealtime, load, loadAllTodayOccurrences, todayTaskOccurrences, user?.id])

  const onMarkAllCompleted = React.useCallback(async () => {
    const affectedGardenIds = new Set<string>()
    try {
      const ops: Promise<any>[] = []
      for (const o of todayTaskOccurrences) {
        const remaining = Math.max(0, Number(o.requiredCount || 1) - Number(o.completedCount || 0))
        if (remaining > 0) ops.push(progressTaskOccurrence(o.id, remaining))
        const gp = allPlants.find((p: any) => p.id === o.gardenPlantId)
        if (gp?.gardenId) affectedGardenIds.add(String(gp.gardenId))
      }
      if (ops.length > 0) await Promise.all(ops)
      // Broadcast updates for all affected gardens BEFORE reload
      await Promise.all(Array.from(affectedGardenIds).map((gid) => 
        broadcastGardenUpdate({ gardenId: gid, kind: 'tasks', actorId: user?.id ?? null }).catch((err) => {
          console.warn('[GardenList] Failed to broadcast task update for garden:', gid, err)
        })
      ))
    } finally {
      await load()
      await loadAllTodayOccurrences()
      affectedGardenIds.forEach((gid) => emitGardenRealtime(gid, 'tasks'))
    }
  }, [allPlants, emitGardenRealtime, load, loadAllTodayOccurrences, todayTaskOccurrences, user?.id])

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

  const gardensWithTasks = React.useMemo(() => {
    const byGarden: Array<{ gardenId: string; gardenName: string; plants: any[]; req: number; done: number }> = []
    const idToGardenName = gardens.reduce<Record<string, string>>((acc, g) => { acc[g.id] = g.name; return acc }, {})
    for (const g of gardens) {
      const plants = allPlants.filter((gp: any) => gp.gardenId === g.id && (occsByPlant[gp.id] || []).length > 0)
      if (plants.length === 0) continue
      let req = 0, done = 0
      for (const gp of plants) {
        const occs = occsByPlant[gp.id] || []
        req += occs.reduce((a: number, o: any) => a + Math.max(1, Number(o.requiredCount || 1)), 0)
        done += occs.reduce((a: number, o: any) => a + Math.min(Math.max(1, Number(o.requiredCount || 1)), Number(o.completedCount || 0)), 0)
      }
      byGarden.push({ gardenId: g.id, gardenName: idToGardenName[g.id] || '', plants, req, done })
    }
    return byGarden
  }, [gardens, allPlants, occsByPlant])

  const totalTasks = React.useMemo(() => todayTaskOccurrences.reduce((a, o) => a + Math.max(1, Number(o.requiredCount || 1)), 0), [todayTaskOccurrences])
  const totalDone = React.useMemo(() => todayTaskOccurrences.reduce((a, o) => a + Math.min(Math.max(1, Number(o.requiredCount || 1)), Number(o.completedCount || 0)), 0), [todayTaskOccurrences])

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-0">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex items-center justify-between mt-6 mb-4">
            <h1 className="text-2xl font-semibold">{t('garden.yourGardens')}</h1>
            {user && (
              <Button className="rounded-2xl" onClick={() => setOpen(true)}>{t('garden.create')}</Button>
            )}
          </div>
          {loading && <div className="p-6 opacity-60 text-sm">{t('common.loading')}</div>}
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
                      const label = done ? t('garden.allDone') : `${completed} / ${due}`
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
                      <div className="text-xs opacity-60">{t('garden.created')} {new Date(g.createdAt).toLocaleDateString()}</div>
                    </div>
                  </button>
                </Card>
              ))}
            </div>
          )}
          {!loading && !error && gardens.length === 0 && (
            <div className="p-10 text-center opacity-60 text-sm">{t('garden.noGardens')}. {t('garden.createFirst')}</div>
          )}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>{t('garden.createGarden')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{t('garden.name')}</label>
                  <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder={t('garden.namePlaceholder')} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{t('garden.coverImageUrl')}</label>
                  <Input value={imageUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageUrl(e.target.value)} placeholder={t('garden.coverImageUrlPlaceholder')} />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="secondary" className="rounded-2xl" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
                  <Button className="rounded-2xl" onClick={onCreate} disabled={!name.trim() || submitting}>{submitting ? t('garden.creating') : t('common.create')}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Right-side Tasks sidebar for all gardens */}
        <aside className="mt-6 lg:mt-6 lg:border-l lg:border-stone-200 lg:pl-6">
          <div className="space-y-3">
            <div className="text-lg font-semibold">{t('garden.tasks')}</div>
            <Card className="rounded-2xl p-4">
              <div className="text-sm opacity-60 mb-2">{t('garden.allGardens')}</div>
              <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                <div className="h-2 bg-emerald-500" style={{ width: `${totalTasks === 0 ? 100 : Math.min(100, Math.round((totalDone / totalTasks) * 100))}%` }} />
              </div>
              <div className="text-xs opacity-70 mt-1">{t('garden.today')}: {totalDone} / {totalTasks}</div>
            </Card>
            {totalTasks > totalDone && (
              <div>
                <Button className="rounded-2xl w-full" onClick={onMarkAllCompleted}>{t('garden.markAllCompleted')}</Button>
              </div>
            )}
            {loadingTasks && (
              <Card className="rounded-2xl p-4 text-sm opacity-70">{t('garden.loadingTasks')}</Card>
            )}
            {!loadingTasks && gardensWithTasks.length === 0 && (
              <Card className="rounded-2xl p-4 text-sm opacity-70">{t('garden.noTasksToday')}</Card>
            )}
            {!loadingTasks && gardensWithTasks.map((gw) => (
              <Card key={gw.gardenId} className="rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{gw.gardenName}</div>
                    <div className="text-xs opacity-70">{gw.done} / {gw.req} {t('garden.done')}</div>
                  </div>
                </div>
                <div className="mt-3 space-y-3">
                  {gw.plants.map((gp: any) => {
                    const occs = occsByPlant[gp.id] || []
                    const req = occs.reduce((a: number, o: any) => a + Math.max(1, Number(o.requiredCount || 1)), 0)
                    const done = occs.reduce((a: number, o: any) => a + Math.min(Math.max(1, Number(o.requiredCount || 1)), Number(o.completedCount || 0)), 0)
                    return (
                      <Card key={gp.id} className="rounded-2xl p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">{gp.nickname || gp.plant?.name}</div>
                          {done < req && (
                            <Button size="sm" className="rounded-xl" onClick={() => onCompleteAllForPlant(gp.id)}>{t('garden.completeAll')}</Button>
                          )}
                        </div>
                        <div className="text-[11px] opacity-60">{done} / {req} {t('garden.done')}</div>
                        <div className="mt-2 space-y-2">
                          {occs.map((o: any) => {
                            const tt = (o as any).taskType || 'custom'
                            const badgeClass = `${tt === 'water' ? 'bg-blue-500' : tt === 'fertilize' ? 'bg-green-500' : tt === 'harvest' ? 'bg-yellow-400' : tt === 'cut' ? 'bg-orange-500' : 'bg-purple-500'} ${tt === 'harvest' ? 'text-black' : 'text-white'}`
                            const taskEmoji = (o as any).taskEmoji
                            const icon = (taskEmoji && taskEmoji !== '??' && taskEmoji !== '???' && taskEmoji.trim() !== '') ? taskEmoji : (tt === 'water' ? '💧' : tt === 'fertilize' ? '🍽️' : tt === 'harvest' ? '🌾' : tt === 'cut' ? '✂️' : '🪴')
                            const isDone = (Number(o.completedCount || 0) >= Number(o.requiredCount || 1))
                            const completions = completionsByOcc[o.id] || []
                            return (
                              <div key={o.id} className={`flex items-center justify-between gap-3 text-sm rounded-xl border p-2 ${isDone ? 'bg-stone-50' : ''}`}>
                                <div className="flex items-center gap-2">
                                  <span className={`h-6 w-6 flex items-center justify-center rounded-md border`}>{icon}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}>{String(tt).toUpperCase()}</span>
                                  <span className="text-xs opacity-70">{gp.nickname || gp.plant?.name}</span>
                                </div>
                                {!isDone ? (
                                  <>
                                    <div className="opacity-80">{o.completedCount} / {o.requiredCount}</div>
                                    <Button className="rounded-xl" size="sm" onClick={() => onProgressOccurrence(o.id, 1)} disabled={(o.completedCount || 0) >= (o.requiredCount || 1)}>+1</Button>
                                  </>
                                ) : (
                                  <div className="text-xs opacity-70 truncate max-w-[50%]">
                                    {completions.length === 0 ? t('garden.completed') : `${t('garden.doneBy')} ${completions.map(c => c.displayName || 'Someone').join(', ')}`}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </Card>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

