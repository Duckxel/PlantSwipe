// @ts-nocheck
import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/context/AuthContext'
import { getUserGardens, createGarden, fetchServerNowISO, getGardenTodayProgressUltraFast, getGardensTodayProgressBatch, getGardenPlantsMinimal, listGardenTasksMinimal, listOccurrencesForTasks, listOccurrencesForMultipleGardens, resyncTaskOccurrencesForGarden, progressTaskOccurrence, listCompletionsForOccurrences, logGardenActivity } from '@/lib/gardens'
import { supabase } from '@/lib/supabaseClient'
import { addGardenBroadcastListener, broadcastGardenUpdate, type GardenRealtimeKind } from '@/lib/realtime'
import type { Garden } from '@/types/garden'
import { useTranslation } from 'react-i18next'
import { useLanguageNavigate } from '@/lib/i18nRouting'
import { Link } from '@/components/i18n/Link'

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
  // Cache for resync operations - skip if done recently
  const resyncCacheRef = React.useRef<Record<string, number>>({})
  const taskDataCacheRef = React.useRef<{ data: any; timestamp: number; today: string } | null>(null)
  const CACHE_TTL = 30 * 1000 // 30 seconds cache for resync
  const TASK_DATA_CACHE_TTL = 10 * 1000 // 10 seconds cache for task data
  const LOCALSTORAGE_TASK_CACHE_TTL = 60 * 1000 // 1 minute cache in localStorage
  const LOCALSTORAGE_GARDEN_CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache for gardens
  
  // localStorage cache helpers
  const getLocalStorageCache = React.useCallback((key: string): any | null => {
    try {
      const item = localStorage.getItem(key)
      if (!item) return null
      const parsed = JSON.parse(item)
      if (parsed.expires && Date.now() > parsed.expires) {
        localStorage.removeItem(key)
        return null
      }
      return parsed.data
    } catch {
      return null
    }
  }, [])
  
  const setLocalStorageCache = React.useCallback((key: string, data: any, ttl: number) => {
    try {
      const item = {
        data,
        expires: Date.now() + ttl,
        timestamp: Date.now(),
      }
      localStorage.setItem(key, JSON.stringify(item))
    } catch (e) {
      // Ignore quota errors
      console.warn('[GardenList] localStorage cache failed:', e)
    }
  }, [])
  
  const clearLocalStorageCache = React.useCallback((keyPrefix?: string) => {
    try {
      if (keyPrefix) {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(keyPrefix))
        keys.forEach(k => localStorage.removeItem(k))
      } else {
        localStorage.removeItem('garden_list_cache')
        localStorage.removeItem('garden_tasks_cache')
        localStorage.removeItem('server_time_offset')
      }
    } catch {}
  }, [])

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
      // Try to load from localStorage cache first
      const cacheKey = `garden_list_cache_${user.id}`
      const cachedGardens = getLocalStorageCache(cacheKey)
      
      let data: Garden[]
      let nowIso: string
      
      if (cachedGardens && cachedGardens.gardens) {
        // Use cached gardens immediately for instant display
        data = cachedGardens.gardens
        setGardens(data)
        gardensRef.current = data
        setLoading(false)
        
        // Try cached server time offset
        const timeOffset = getLocalStorageCache('server_time_offset')
        if (timeOffset && timeOffset.offset !== undefined) {
          const estimatedServerTime = new Date(Date.now() + timeOffset.offset)
          const today = estimatedServerTime.toISOString().slice(0, 10)
          setServerToday(today)
          serverTodayRef.current = today
        }
        
        // Load fresh data in background
        Promise.all([
          getUserGardens(user.id),
          fetchServerNowISO()
        ]).then(([freshData, freshNowIso]) => {
          // Update if data changed
          if (JSON.stringify(freshData) !== JSON.stringify(data)) {
            setGardens(freshData)
            gardensRef.current = freshData
          }
          
          // Cache fresh data
          setLocalStorageCache(cacheKey, { gardens: freshData }, LOCALSTORAGE_GARDEN_CACHE_TTL)
          
          // Cache server time offset
          const clientTime = Date.now()
          const serverTime = new Date(freshNowIso).getTime()
          const offset = serverTime - clientTime
          setLocalStorageCache('server_time_offset', { offset }, 24 * 60 * 60 * 1000) // 24 hours
          
          const today = freshNowIso.slice(0, 10)
          setServerToday(today)
          serverTodayRef.current = today
          
          // Update progress with fresh data - use batched RPC (single query, minimal egress)
          getGardensTodayProgressBatch(freshData.map(g => g.id), today).then((progMap) => {
            setProgressByGarden(progMap)
          }).catch(() => {})
        }).catch(() => {
          // If background fetch fails, keep using cached data
        })
        
        // Load progress for cached gardens - use batched RPC (single query, minimal egress)
        const today = serverTodayRef.current ?? new Date().toISOString().slice(0, 10)
        getGardensTodayProgressBatch(data.map(g => g.id), today).then((progMap) => {
          setProgressByGarden(progMap)
        }).catch(() => {})
        
        return
      }
      
      // No cache - fetch fresh data
      const [freshData, freshNowIso] = await Promise.all([
        getUserGardens(user.id),
        fetchServerNowISO()
      ])
      data = freshData
      nowIso = freshNowIso
      
      setGardens(data)
      gardensRef.current = data
      const today = nowIso.slice(0,10)
      setServerToday(today)
      serverTodayRef.current = today
      
      // Cache the data
      setLocalStorageCache(cacheKey, { gardens: data }, LOCALSTORAGE_GARDEN_CACHE_TTL)
      
      // Cache server time offset
      const clientTime = Date.now()
      const serverTime = new Date(nowIso).getTime()
      const offset = serverTime - clientTime
      setLocalStorageCache('server_time_offset', { offset }, 24 * 60 * 60 * 1000) // 24 hours
      
      // Set loading to false immediately so gardens render
      setLoading(false)
      
      // Load progress using batched RPC function (minimal egress - single query)
      getGardensTodayProgressBatch(data.map(g => g.id), today).then((progMap) => {
        setProgressByGarden(progMap)
      }).catch(() => {
        // Silently fail - progress will update on next refresh
      })
    } catch (e: any) {
      setError(e?.message || t('garden.failedToLoad'))
      setLoading(false)
    }
  }, [user?.id, t, getLocalStorageCache, setLocalStorageCache])

  React.useEffect(() => { load() }, [load])

  // Load all gardens' tasks due today for the sidebar
  const loadAllTodayOccurrences = React.useCallback(async (
    gardensOverride?: typeof gardens,
    todayOverride?: string | null,
    skipResync = false,
  ) => {
    const today = todayOverride ?? serverTodayRef.current ?? serverToday
    const gardensList = gardensOverride ?? gardensRef.current ?? gardens
    if (!today) return
    if (gardensList.length === 0) { setAllPlants([]); setTodayTaskOccurrences([]); return }
    
    // Multi-layer cache check: memory -> localStorage -> API
    const cacheKey = `${today}::${gardensList.map(g => g.id).sort().join(',')}`
    const now = Date.now()
    
    // 1. Check memory cache first (fastest)
    const cached = taskDataCacheRef.current
    if (cached && cached.today === today && (now - cached.timestamp) < TASK_DATA_CACHE_TTL) {
      setTodayTaskOccurrences(cached.data.occurrences)
      setCompletionsByOcc(cached.data.completions)
      setAllPlants(cached.data.plants)
      setLoadingTasks(false)
      return
    }
    
    // 2. Check localStorage cache (persists across page reloads)
    const localStorageKey = `garden_tasks_cache_${cacheKey}`
    const localStorageCache = getLocalStorageCache(localStorageKey)
    if (localStorageCache && localStorageCache.data) {
      setTodayTaskOccurrences(localStorageCache.data.occurrences || [])
      setCompletionsByOcc(localStorageCache.data.completions || {})
      setAllPlants(localStorageCache.data.plants || [])
      setLoadingTasks(false)
      
      // Also update memory cache
      taskDataCacheRef.current = {
        data: localStorageCache.data,
        timestamp: localStorageCache.timestamp || now,
        today,
      }
      
      // Refresh in background if cache is getting stale
      if (localStorageCache.timestamp && (now - localStorageCache.timestamp) > LOCALSTORAGE_TASK_CACHE_TTL / 2) {
        // Cache is half-expired, refresh in background
        setTimeout(() => {
          loadAllTodayOccurrences(gardensOverride, todayOverride, skipResync)
        }, 100)
      }
      return
    }
    
    setLoadingTasks(true)
    try {
      const startIso = `${today}T00:00:00.000Z`
      const endIso = `${today}T23:59:59.999Z`
      // 1) Fetch tasks per garden in parallel - use minimal version to reduce egress
      const tasksPerGarden = await Promise.all(gardensList.map(g => listGardenTasksMinimal(g.id)))
      const taskTypeById: Record<string, 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'> = {}
      const taskEmojiById: Record<string, string | null> = {}
      const taskIdsByGarden: Record<string, string[]> = {}
      for (let i = 0; i < gardensList.length; i++) {
        const g = gardensList[i]
        const tasks = tasksPerGarden[i] || []
        taskIdsByGarden[g.id] = tasks.map(t => t.id)
        for (const t of tasks) {
          taskTypeById[t.id] = t.type
          taskEmojiById[t.id] = t.emoji || null
        }
      }
      
      // 2) Resync only if needed and not cached recently
      if (!skipResync) {
        const resyncPromises = gardensList.map(async (g) => {
          const cacheKey = `${g.id}::${today}`
          const lastResync = resyncCacheRef.current[cacheKey] || 0
          if (now - lastResync < CACHE_TTL) {
            // Skip resync - cached recently
            return
          }
          await resyncTaskOccurrencesForGarden(g.id, startIso, endIso)
          resyncCacheRef.current[cacheKey] = now
        })
        await Promise.all(resyncPromises)
      }
      
      // 3) Load occurrences for all gardens in a single batched query (reduces egress)
      const occsByGarden = await listOccurrencesForMultipleGardens(taskIdsByGarden, startIso, endIso)
      const occsAugmented: Array<any> = []
      for (const [gardenId, arr] of Object.entries(occsByGarden)) {
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
      // 4) Load plants for all gardens - use minimal version to reduce egress by ~80%
      const gardenIds = gardensList.map(g => g.id)
      const plantsMinimal = await getGardenPlantsMinimal(gardenIds)
      const idToGardenName = gardensList.reduce<Record<string, string>>((acc, g) => { acc[g.id] = g.name; return acc }, {})
      const all = plantsMinimal.map((gp) => ({
        id: gp.id,
        gardenId: gp.gardenId,
        nickname: gp.nickname,
        plant: gp.plantName ? { name: gp.plantName } : null,
        gardenName: idToGardenName[gp.gardenId] || '',
      }))
      setAllPlants(all)
      
      // Cache the results in both memory and localStorage
      const cacheData = {
        occurrences: occsAugmented,
        completions: compMap,
        plants: all,
      }
      
      // Memory cache (fast access)
      taskDataCacheRef.current = {
        data: cacheData,
        timestamp: now,
        today,
      }
      
      // localStorage cache (persists across page reloads)
      setLocalStorageCache(localStorageKey, cacheData, LOCALSTORAGE_TASK_CACHE_TTL)
    } catch {
      // swallow; page has global error area
    } finally {
      setLoadingTasks(false)
    }
  }, [gardens, serverToday, getLocalStorageCache, setLocalStorageCache])

  const scheduleReload = React.useCallback(() => {
    const execute = async () => {
      lastReloadRef.current = Date.now()
      // Clear cache on reload
      taskDataCacheRef.current = null
      await load()
      // Skip resync on scheduled reloads unless it's been a while
      await loadAllTodayOccurrences(undefined, undefined, false)
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_plant_task_occurrences' }, () => {
        // Clear cache on realtime updates
        taskDataCacheRef.current = null
        clearLocalStorageCache(`garden_tasks_cache_`)
        scheduleReload()
      })

    const subscription = ch.subscribe()
    if (subscription instanceof Promise) subscription.catch(() => {})
    return () => {
      try { supabase.removeChannel(ch) } catch {}
    }
  }, [scheduleReload, user?.id])

  // Defer task loading until after gardens are displayed (non-blocking)
  // Use requestIdleCallback for better performance when browser is idle
  React.useEffect(() => {
    // Only load tasks after gardens are loaded
    if (!loading && gardens.length > 0) {
      let cancelled = false
      let backgroundTimer: ReturnType<typeof setTimeout> | null = null
      
      // Use requestIdleCallback if available, otherwise use setTimeout
      const scheduleTask = (callback: () => void, delay: number = 0) => {
        if ('requestIdleCallback' in window) {
          return window.requestIdleCallback(callback, { timeout: delay + 100 })
        }
        return setTimeout(callback, delay)
      }
      
      // Load tasks immediately but skip resync for instant display
      const timer = scheduleTask(() => {
        if (cancelled) return
        loadAllTodayOccurrences(undefined, undefined, true) // skipResync = true
        
        // Background resync after UI is shown - use longer delay to avoid blocking
        backgroundTimer = setTimeout(() => {
          if (cancelled) return
          const today = serverTodayRef.current ?? serverToday
          if (today && gardens.length > 0) {
            const startIso = `${today}T00:00:00.000Z`
            const endIso = `${today}T23:59:59.999Z`
            // Resync in background without blocking UI - use requestIdleCallback
            const resyncFn = () => {
              Promise.all(gardens.map(g => {
                const cacheKey = `${g.id}::${today}`
                const lastResync = resyncCacheRef.current[cacheKey] || 0
                const now = Date.now()
                if (now - lastResync >= CACHE_TTL) {
                  return resyncTaskOccurrencesForGarden(g.id, startIso, endIso).then(() => {
                    if (!cancelled) {
                      resyncCacheRef.current[cacheKey] = now
                    }
                  }).catch(() => {})
                }
                return Promise.resolve()
              })).then(() => {
                // After background resync, reload tasks to show updated data
                if (!cancelled) {
                  loadAllTodayOccurrences(undefined, undefined, true)
                }
              }).catch(() => {})
            }
            
            // Use requestIdleCallback for background resync to avoid blocking
            if ('requestIdleCallback' in window) {
              window.requestIdleCallback(resyncFn, { timeout: 3000 })
            } else {
              setTimeout(resyncFn, 2000) // Wait 2 seconds after initial load
            }
          }
        }, 100) // Reduced initial delay
      }, 0) // Start immediately when idle
      
      return () => {
        cancelled = true
        if (typeof timer === 'number') {
          clearTimeout(timer)
        } else if ('cancelIdleCallback' in window) {
          window.cancelIdleCallback(timer as number)
        }
        if (backgroundTimer) clearTimeout(backgroundTimer)
      }
    }
  }, [loading, gardens.length, loadAllTodayOccurrences, serverToday, gardens])

  React.useEffect(() => {
    let active = true
    let teardown: (() => Promise<void>) | null = null

    addGardenBroadcastListener((message) => {
      if (message.actorId && user?.id && message.actorId === user.id) return
      if (!gardenIdsRef.current.has(message.gardenId)) return
      // Clear cache on broadcast updates
      taskDataCacheRef.current = null
      clearLocalStorageCache(`garden_tasks_cache_`)
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
    const o = todayTaskOccurrences.find((x: any) => x.id === occId)
    
    // Optimistic update - update UI immediately
    if (o) {
      const optimisticOcc = { ...o, completedCount: Number(o.completedCount || 0) + inc }
      setTodayTaskOccurrences(prev => prev.map((x: any) => x.id === occId ? optimisticOcc : x))
      
      const gp = allPlants.find((p: any) => p.id === o.gardenPlantId)
      broadcastGardenId = gp?.gardenId || null
    }
    
    try {
      await progressTaskOccurrence(occId, inc)
      // Log activity for the appropriate garden
      try {
        if (o && broadcastGardenId) {
          const gp = allPlants.find((p: any) => p.id === o.gardenPlantId)
          const type = (o as any).taskType || 'custom'
          const taskTypeLabel = t(`garden.taskTypes.${type}`)
          const plantName = gp?.nickname || gp?.plant?.name || null
          const newCount = Number(o.completedCount || 0) + inc
          const required = Math.max(1, Number(o.requiredCount || 1))
          const done = newCount >= required
          const kind = done ? 'task_completed' : 'task_progressed'
          const msg = done
            ? t('garden.activity.completedTask', { taskType: taskTypeLabel, plantName: plantName || t('garden.activity.plant') })
            : t('garden.activity.progressedTask', { taskType: taskTypeLabel, plantName: plantName || t('garden.activity.plant'), completed: Math.min(newCount, required), required })
          // Don't await - fire and forget for speed
          logGardenActivity({ gardenId: broadcastGardenId, kind: kind as any, message: msg, plantName: plantName || null, taskName: taskTypeLabel, actorColor: null }).catch(() => {})
          // Broadcast update BEFORE reload to ensure other clients receive it
          broadcastGardenUpdate({ gardenId: broadcastGardenId, kind: 'tasks', actorId: user?.id ?? null }).catch((err) => {
            console.warn('[GardenList] Failed to broadcast task update:', err)
          })
        }
      } catch {}
    } catch (error) {
      // Revert optimistic update on error
      if (o) {
        setTodayTaskOccurrences(prev => prev.map((x: any) => x.id === occId ? o : x))
      }
      throw error
    } finally {
      // Refresh in background without blocking UI
      const today = serverTodayRef.current ?? serverToday
      if (today && broadcastGardenId) {
        delete resyncCacheRef.current[`${broadcastGardenId}::${today}`]
        clearLocalStorageCache(`garden_tasks_cache_`)
      }
      taskDataCacheRef.current = null
      
      // Use requestIdleCallback for background refresh
      const refreshFn = () => {
        load().catch(() => {})
        loadAllTodayOccurrences(undefined, undefined, false).catch(() => {})
        if (broadcastGardenId) emitGardenRealtime(broadcastGardenId, 'tasks')
      }
      
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(refreshFn, { timeout: 500 })
      } else {
        setTimeout(refreshFn, 100)
      }
    }
  }, [allPlants, emitGardenRealtime, load, loadAllTodayOccurrences, todayTaskOccurrences, serverToday, user?.id, clearLocalStorageCache, t])

  const onCompleteAllForPlant = React.useCallback(async (gardenPlantId: string) => {
    const gp = allPlants.find((p: any) => p.id === gardenPlantId)
    const gardenId = gp?.gardenId ? String(gp.gardenId) : null
    
    // Optimistic update - mark all as completed immediately
    const occs = todayTaskOccurrences.filter(o => o.gardenPlantId === gardenPlantId)
    const optimisticOccs = occs.map(o => ({
      ...o,
      completedCount: Math.max(Number(o.requiredCount || 1), Number(o.completedCount || 0))
    }))
    setTodayTaskOccurrences(prev => prev.map((x: any) => {
      const updated = optimisticOccs.find(opt => opt.id === x.id)
      return updated || x
    }))
    
    try {
      // Process all completions in parallel for speed
      const promises = occs.map(async (o) => {
        const remaining = Math.max(0, Number(o.requiredCount || 1) - Number(o.completedCount || 0))
        if (remaining <= 0) return
        // Process all increments in parallel
        return Promise.all(Array.from({ length: remaining }, () => progressTaskOccurrence(o.id, 1)))
      })
      await Promise.all(promises)
      
      // Log summary activity for this plant/garden (fire and forget)
      if (gardenId) {
        const plantName = gp?.nickname || gp?.plant?.name || t('garden.activity.plant')
        logGardenActivity({ gardenId, kind: 'task_completed' as any, message: t('garden.activity.completedAllTasks', { plantName }), plantName, actorColor: null }).catch(() => {})
        broadcastGardenUpdate({ gardenId, kind: 'tasks', actorId: user?.id ?? null }).catch((err) => {
          console.warn('[GardenList] Failed to broadcast task update:', err)
        })
      }
    } catch (error) {
      // Revert optimistic update on error
      setTodayTaskOccurrences(prev => prev.map((x: any) => {
        const original = occs.find(orig => orig.id === x.id)
        return original || x
      }))
      throw error
    } finally {
      // Refresh in background
      const today = serverTodayRef.current ?? serverToday
      if (today && gardenId) {
        delete resyncCacheRef.current[`${gardenId}::${today}`]
        clearLocalStorageCache(`garden_tasks_cache_`)
      }
      taskDataCacheRef.current = null
      
      const refreshFn = () => {
        load().catch(() => {})
        loadAllTodayOccurrences(undefined, undefined, false).catch(() => {})
        if (gardenId) emitGardenRealtime(gardenId, 'tasks')
      }
      
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(refreshFn, { timeout: 500 })
      } else {
        setTimeout(refreshFn, 100)
      }
    }
  }, [allPlants, emitGardenRealtime, load, loadAllTodayOccurrences, todayTaskOccurrences, serverToday, user?.id, clearLocalStorageCache, t])

  const onMarkAllCompleted = React.useCallback(async () => {
    const affectedGardenIds = new Set<string>()
    
    // Optimistic update - mark all as completed immediately
    const optimisticOccs = todayTaskOccurrences.map(o => {
      const gp = allPlants.find((p: any) => p.id === o.gardenPlantId)
      if (gp?.gardenId) affectedGardenIds.add(String(gp.gardenId))
      return {
        ...o,
        completedCount: Math.max(Number(o.requiredCount || 1), Number(o.completedCount || 0))
      }
    })
    setTodayTaskOccurrences(optimisticOccs as any)
    
    try {
      // Process all completions in parallel for speed
      const ops: Promise<any>[] = []
      for (const o of todayTaskOccurrences) {
        const remaining = Math.max(0, Number(o.requiredCount || 1) - Number(o.completedCount || 0))
        if (remaining > 0) ops.push(progressTaskOccurrence(o.id, remaining))
      }
      if (ops.length > 0) await Promise.all(ops)
      
      // Broadcast updates for all affected gardens (fire and forget)
      Promise.all(Array.from(affectedGardenIds).map((gid) => 
        broadcastGardenUpdate({ gardenId: gid, kind: 'tasks', actorId: user?.id ?? null }).catch((err) => {
          console.warn('[GardenList] Failed to broadcast task update for garden:', gid, err)
        })
      )).catch(() => {})
    } catch (error) {
      // Revert optimistic update on error
      setTodayTaskOccurrences(todayTaskOccurrences as any)
      throw error
    } finally {
      // Refresh in background
      const today = serverTodayRef.current ?? serverToday
      if (today) {
        affectedGardenIds.forEach((gid) => {
          delete resyncCacheRef.current[`${gid}::${today}`]
        })
        clearLocalStorageCache(`garden_tasks_cache_`)
      }
      taskDataCacheRef.current = null
      
      const refreshFn = () => {
        load().catch(() => {})
        loadAllTodayOccurrences(undefined, undefined, false).catch(() => {})
        affectedGardenIds.forEach((gid) => emitGardenRealtime(gid, 'tasks'))
      }
      
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(refreshFn, { timeout: 500 })
      } else {
        setTimeout(refreshFn, 100)
      }
    }
  }, [allPlants, emitGardenRealtime, load, loadAllTodayOccurrences, todayTaskOccurrences, serverToday, user?.id, clearLocalStorageCache])

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
      <div className={`grid grid-cols-1 ${user ? 'lg:grid-cols-[minmax(0,1fr)_360px]' : ''} gap-6`}>
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
                <Card key={g.id} className={`rounded-2xl overflow-hidden relative h-40 ${dragIndex === idx ? 'ring-2 ring-black' : ''}`} draggable onDragStart={() => setDragIndex(idx)} onDragOver={(e) => e.preventDefault()} onDrop={() => {
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
                        <div className={`pointer-events-none absolute top-2 right-2 rounded-xl px-2 py-0.5 text-xs font-medium shadow z-10 ${color}`}>
                          {label}
                        </div>
                      )
                    })()
                  )}
                  <Link to={`/garden/${g.id}`} className="grid grid-cols-3 gap-0 w-full h-full text-left">
                    <div className="col-span-1 rounded-l-2xl overflow-hidden bg-stone-100 dark:bg-[#252526]">
                      {g.coverImageUrl ? (
                        <img
                          src={g.coverImageUrl}
                          alt={g.name}
                          className="w-full h-full object-cover object-center"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="col-span-2 p-4 flex flex-col justify-center">
                      <div className="font-medium truncate">{g.name}</div>
                      <div className="text-xs opacity-60 mt-1">{t('garden.created')} {new Date(g.createdAt).toLocaleDateString()}</div>
                    </div>
                  </Link>
                </Card>
              ))}
            </div>
          )}
          {!loading && !error && gardens.length === 0 && (
            <div className="p-10 text-center">
              {!user ? (
                <Card className="rounded-2xl p-6 max-w-md mx-auto">
                  <div className="space-y-4">
                    <div className="text-lg font-semibold">{t('common.login')}</div>
                    <div className="text-sm opacity-70">
                      {t('garden.noGardens')}. {t('garden.createFirst')}
                    </div>
                    <Button className="rounded-2xl w-full" onClick={() => navigate('/')}>
                      {t('auth.login')}
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="opacity-60 text-sm">{t('garden.noGardens')}. {t('garden.createFirst')}</div>
              )}
            </div>
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

        {/* Right-side Tasks sidebar for all gardens - hidden for non-logged-in users */}
        {user && (
          <aside className="mt-6 lg:mt-6 lg:border-l lg:border-stone-200 dark:lg:border-[#3e3e42] lg:pl-6">
            <div className="space-y-3">
              <div className="text-lg font-semibold">{t('garden.tasks')}</div>
              <Card className="rounded-2xl p-4">
              <div className="text-sm opacity-60 mb-2">{t('garden.allGardens')}</div>
              <div className="h-2 bg-stone-200 dark:bg-[#3e3e42] rounded-full overflow-hidden">
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
                            const badgeClass = `${tt === 'water' ? 'bg-blue-600 dark:bg-blue-500' : tt === 'fertilize' ? 'bg-green-600 dark:bg-green-500' : tt === 'harvest' ? 'bg-yellow-500 dark:bg-yellow-400' : tt === 'cut' ? 'bg-orange-600 dark:bg-orange-500' : 'bg-purple-600 dark:bg-purple-500'} ${tt === 'harvest' ? 'text-black dark:text-black' : 'text-white'}`
                            const taskEmoji = (o as any).taskEmoji
                            const icon = (taskEmoji && taskEmoji !== '??' && taskEmoji !== '???' && taskEmoji.trim() !== '') ? taskEmoji : (tt === 'water' ? '💧' : tt === 'fertilize' ? '🍽️' : tt === 'harvest' ? '🌾' : tt === 'cut' ? '✂️' : '🪴')
                            const isDone = (Number(o.completedCount || 0) >= Number(o.requiredCount || 1))
                            const completions = completionsByOcc[o.id] || []
                            return (
                              <div key={o.id} className={`flex items-center justify-between gap-3 text-sm rounded-xl border border-stone-300 dark:border-[#3e3e42] p-2 ${isDone ? 'bg-stone-50 dark:bg-[#2d2d30]' : 'bg-white dark:bg-[#252526]'}`}>
                                <div className="flex items-center gap-2">
                                  <span className={`h-6 w-6 flex items-center justify-center rounded-md border border-stone-300 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30]`}>{icon}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}>{t(`garden.taskTypes.${tt}`)}</span>
                                  <span className="text-xs opacity-70 text-black dark:text-white">{gp.nickname || gp.plant?.name}</span>
                                </div>
                                {!isDone ? (
                                  <>
                                    <div className="opacity-80 text-black dark:text-white">{o.completedCount} / {o.requiredCount}</div>
                                    <Button className="rounded-xl" size="sm" onClick={() => onProgressOccurrence(o.id, 1)} disabled={(o.completedCount || 0) >= (o.requiredCount || 1)}>+1</Button>
                                  </>
                                ) : (
                                  <div className="text-xs opacity-70 truncate max-w-[50%] text-black dark:text-white">
                                    {completions.length === 0 ? t('garden.completed') : `${t('garden.doneBy')} ${completions.map(c => c.displayName || t('garden.someone')).join(', ')}`}
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
        )}
      </div>
    </div>
  )
}

