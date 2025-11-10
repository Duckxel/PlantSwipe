// @ts-nocheck
import React from 'react'
import { useAuth } from '@/context/AuthContext'
import { useParams, Routes, Route, useLocation } from 'react-router-dom'
import { NavLink } from '@/components/i18n/NavLink'
import { Navigate } from '@/components/i18n/Navigate'
import { useLanguageNavigate, removeLanguagePrefix } from '@/lib/i18nRouting'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { PlantDetails } from '@/components/plant/PlantDetails'
import { Info, ArrowUpRight } from 'lucide-react'
import { SchedulePickerDialog } from '@/components/plant/SchedulePickerDialog'
import { TaskEditorDialog } from '@/components/plant/TaskEditorDialog'
import type { Garden } from '@/types/garden'
import type { Plant } from '@/types/plant'
import { getGarden, getGardenPlants, getGardenMembers, addMemberByNameOrEmail, deleteGardenPlant, addPlantToGarden, fetchServerNowISO, upsertGardenTask, getGardenTasks, ensureDailyTasksForGardens, upsertGardenPlantSchedule, getGardenPlantSchedule, updateGardenMemberRole, removeGardenMember, listGardenTasks, listOccurrencesForTasks, progressTaskOccurrence, updateGardenPlantsOrder, refreshGardenStreak, listGardenActivityToday, logGardenActivity, resyncTaskOccurrencesForGarden, computeGardenTaskForDay, getGardenTodayOccurrencesCached, getGardenWeeklyStatsCached, getGardenTodayProgressUltraFast, refreshGardenTaskCache } from '@/lib/gardens'
import { supabase } from '@/lib/supabaseClient'
import { addGardenBroadcastListener, broadcastGardenUpdate, type GardenRealtimeKind } from '@/lib/realtime'
import { getAccentOption } from '@/lib/accent'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/lib/i18nRouting'
import { mergePlantWithTranslation } from '@/lib/plantTranslationLoader'
import { OverviewSectionSkeleton } from '@/components/garden/GardenSkeletons'
 


type TabKey = 'overview' | 'plants' | 'routine' | 'settings'

export const GardenDashboardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useLanguageNavigate()
  const location = useLocation()
  const { user, profile, refreshProfile } = useAuth()
  const { t } = useTranslation('common')
  const currentLang = useLanguage()
  const [garden, setGarden] = React.useState<Garden | null>(null)
  const [tab, setTab] = React.useState<TabKey>('overview')
  // derive tab from URL path segment after /garden/:id
  React.useEffect(() => {
    // Remove language prefix first to get the actual path
    const pathWithoutLang = removeLanguagePrefix(location.pathname)
    const base = `/garden/${id || ''}`
    const rest = pathWithoutLang.startsWith(base) ? pathWithoutLang.slice(base.length) : ''
    const seg = rest.replace(/^\//, '').split('/')[0] as TabKey
    setTab((seg as TabKey) || 'overview')
  }, [location.pathname, id])
  const [plants, setPlants] = React.useState<Array<any>>([])
  const [members, setMembers] = React.useState<Array<{ userId: string; displayName?: string | null; email?: string | null; role: 'owner' | 'member'; joinedAt?: string; accentKey?: string | null }>>([])
  const [loading, setLoading] = React.useState(true)
  const [heavyLoading, setHeavyLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [serverToday, setServerToday] = React.useState<string | null>(null)
  const serverTodayRef = React.useRef<string | null>(null)
  const [dueToday, setDueToday] = React.useState<Set<string> | null>(null)
  const [dailyStats, setDailyStats] = React.useState<Array<{ date: string; due: number; completed: number; success: boolean }>>([])
  const [taskOccDueToday, setTaskOccDueToday] = React.useState<Record<string, number>>({})
  const [taskCountsByPlant, setTaskCountsByPlant] = React.useState<Record<string, number>>({})
  const [todayTaskOccurrences, setTodayTaskOccurrences] = React.useState<Array<{ id: string; taskId: string; gardenPlantId: string; dueAt: string; requiredCount: number; completedCount: number; completedAt: string | null }>>([])
  const [weekDays, setWeekDays] = React.useState<string[]>([])
  const [weekCounts, setWeekCounts] = React.useState<number[]>([])
  const [weekCountsByType, setWeekCountsByType] = React.useState<{ water: number[]; fertilize: number[]; harvest: number[]; cut: number[]; custom: number[] }>({ water: [], fertilize: [], harvest: [], cut: [], custom: [] })
  const [dueThisWeekByPlant, setDueThisWeekByPlant] = React.useState<Record<string, number[]>>({})
  const [instanceCounts, setInstanceCounts] = React.useState<Record<string, number>>({})
  const [totalOnHand, setTotalOnHand] = React.useState(0)
  const [speciesOnHand, setSpeciesOnHand] = React.useState(0)

  const [addOpen, setAddOpen] = React.useState(false)
  const [plantQuery, setPlantQuery] = React.useState('')
  const [plantResults, setPlantResults] = React.useState<Plant[]>([])
  const [selectedPlant, setSelectedPlant] = React.useState<Plant | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [scheduleOpen, setScheduleOpen] = React.useState(false)
  const [taskOpen, setTaskOpen] = React.useState(false)
  const [pendingGardenPlantId, setPendingGardenPlantId] = React.useState<string | null>(null)
  const [pendingPeriod, setPendingPeriod] = React.useState<'week' | 'month' | 'year' | null>(null)
  const [pendingAmount, setPendingAmount] = React.useState<number>(0)
  const [initialSelectionState, setInitialSelectionState] = React.useState<{ weeklyDays?: number[]; monthlyDays?: number[]; yearlyDays?: string[]; monthlyNthWeekdays?: string[] } | undefined>(undefined)
  const [addDetailsOpen, setAddDetailsOpen] = React.useState(false)
  const [addNickname, setAddNickname] = React.useState('')
  const [addCount, setAddCount] = React.useState<number>(1)
  const countInputRef = React.useRef<HTMLInputElement | null>(null)
  const [scheduleLockYear, setScheduleLockYear] = React.useState<boolean>(false)
  const [scheduleAllowedPeriods, setScheduleAllowedPeriods] = React.useState<Array<'week'|'month'|'year'> | undefined>(undefined)
  const [dragIdx, setDragIdx] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (addDetailsOpen) {
      const t = setTimeout(() => {
        try { countInputRef.current?.focus(); countInputRef.current?.select() } catch {}
      }, 0)
      return () => { try { clearTimeout(t) } catch {} }
    }
  }, [addDetailsOpen])

  const [activityRev, setActivityRev] = React.useState(0)
  const streakRefreshedRef = React.useRef(false)
  const skipTodayCacheRef = React.useRef(false)
  const [progressingOccIds, setProgressingOccIds] = React.useState<Set<string>>(new Set())
  const [completingPlantIds, setCompletingPlantIds] = React.useState<Set<string>>(new Set())

  const [infoPlant, setInfoPlant] = React.useState<Plant | null>(null)
  // Favorites (liked plants)
  const [likedIds, setLikedIds] = React.useState<string[]>([])
  React.useEffect(() => {
    const arr = Array.isArray((profile as any)?.liked_plant_ids)
      ? ((profile as any).liked_plant_ids as any[]).map(String)
      : []
    setLikedIds(arr)
  }, [profile?.liked_plant_ids])

  const [inviteOpen, setInviteOpen] = React.useState(false)
  // Track if any modal is open to pause reloads
  const anyModalOpen = addOpen || addDetailsOpen || scheduleOpen || taskOpen || inviteOpen
  const reloadTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastReloadRef = React.useRef<number>(0)
  const pendingReloadRef = React.useRef<boolean>(false)
  const [inviteEmail, setInviteEmail] = React.useState('')
  const [inviteAny, setInviteAny] = React.useState('')
  const [inviteError, setInviteError] = React.useState<string | null>(null)
  const [friends, setFriends] = React.useState<Array<{ id: string; display_name: string | null; email: string | null }>>([])
  const [friendSuggestions, setFriendSuggestions] = React.useState<Array<{ id: string; display_name: string | null; email: string | null }>>([])
  const [suggestionsOpen, setSuggestionsOpen] = React.useState(false)

  // Notify global UI components to refresh Garden badge without page reload
  const emitGardenRealtime = React.useCallback((kind: GardenRealtimeKind = 'tasks', metadata?: Record<string, unknown>) => {
    try { window.dispatchEvent(new CustomEvent('garden:tasks_changed')) } catch {}
    if (!id) return
    broadcastGardenUpdate({ gardenId: id, kind, metadata, actorId: user?.id ?? null }).catch(() => {})
  }, [id, user?.id])

  const updateTodayProgressState = React.useCallback(async () => {
    const gardenId = id
    const todayIso = serverTodayRef.current ?? serverToday
    if (!gardenId || !todayIso) return
    try {
      const { due, completed } = await getGardenTodayProgressUltraFast(gardenId, todayIso)
      const success = due === 0 ? true : (completed >= due)
      setDailyStats(prev => {
        let found = false
        const next = prev.map(d => {
          if (d.date === todayIso) {
            found = true
            return { ...d, due, completed, success }
          }
          return d
        })
        if (found) return next
        const appended = [...prev, { date: todayIso, due, completed, success }]
        appended.sort((a, b) => a.date.localeCompare(b.date))
        return appended.slice(-30)
      })
      await upsertGardenTask({ gardenId, day: todayIso, gardenPlantId: null, success })
    } catch (err) {
      console.warn('[GardenDashboard] Failed to update today progress state:', err)
    }
  }, [id, serverToday])

  const load = React.useCallback(async (opts?: { silent?: boolean; preserveHeavy?: boolean; suppressError?: boolean }) => {
    if (!id) return
    // Keep UI visible on subsequent reloads to avoid blink
    const silent = opts?.silent ?? (garden !== null)
    const suppressError = opts?.suppressError ?? false
    if (!silent) setLoading(true)
    if (!suppressError) setError(null)
    try {
      // Fast-path: hydrate via batched API, then continue with detailed computations
      let hydratedPlants: any[] | null = null
      let gpsLocal: any[] | null = null
      let hydrated = false
      try {
        const session = (await supabase.auth.getSession()).data.session
        const token = session?.access_token
        const headers: Record<string, string> = { 'Accept': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        const resp = await fetch(`/api/garden/${id}/overview`, { headers, credentials: 'same-origin' })
        if (resp.ok) {
          const data = await resp.json().catch(() => ({}))
          if (data?.ok) {
            if (data.garden) setGarden({
              id: String(data.garden.id),
              name: String(data.garden.name),
              coverImageUrl: data.garden.coverImageUrl || null,
              createdBy: String(data.garden.createdBy || ''),
              createdAt: String(data.garden.createdAt || ''),
              streak: Number(data.garden.streak || 0),
            } as any)
            if (Array.isArray(data.plants)) { setPlants(data.plants); hydratedPlants = data.plants }
            if (Array.isArray(data.members)) setMembers(data.members.map((m: any) => ({ userId: String(m.userId || m.user_id), displayName: m.displayName ?? m.display_name ?? null, email: m.email ?? null, role: m.role, joinedAt: m.joinedAt ?? m.joined_at ?? null, accentKey: m.accentKey ?? null })))
          if (data.serverNow) {
            const todayIso = String(data.serverNow).slice(0,10)
            setServerToday(todayIso)
            serverTodayRef.current = todayIso
          }
            hydrated = true
          }
        }
      } catch {}

      let gardenCreatedDayIso: string | null = null
      let todayLocal: string | null = null
      if (!hydrated) {
        const [g0, gpsRaw, ms, nowIso] = await Promise.all([
          getGarden(id),
          getGardenPlants(id, currentLang),
          getGardenMembers(id),
          fetchServerNowISO(),
        ])
        setGarden(g0)
        // Track garden creation day (YYYY-MM-DD) to avoid validating pre-creation days
        gardenCreatedDayIso = g0?.createdAt ? new Date(g0.createdAt).toISOString().slice(0,10) : null
        gpsLocal = gpsRaw
        setPlants(gpsRaw)
        setMembers(ms.map(m => ({ userId: m.userId, displayName: m.displayName ?? null, email: (m as any).email ?? null, role: m.role, joinedAt: (m as any).joinedAt, accentKey: (m as any).accentKey ?? null })))
        todayLocal = nowIso.slice(0,10)
        setServerToday(todayLocal)
        serverTodayRef.current = todayLocal
      }
      // Resolve 'today' for subsequent computations regardless of hydration path
      let today = (serverToday || todayLocal || '')
      if (!today) {
        const nowIso2 = await fetchServerNowISO()
        today = nowIso2.slice(0,10)
        setServerToday(today)
        serverTodayRef.current = today
      }
      // Ensure base streak is refreshed from server, at most once per session
      try {
        if (!streakRefreshedRef.current) {
          streakRefreshedRef.current = true
          await refreshGardenStreak(id, new Date(new Date(today).getTime() - 24*3600*1000).toISOString().slice(0,10))
          const g1 = await getGarden(id)
          setGarden(g1)
          // Prefer refreshed garden's createdAt if available
          gardenCreatedDayIso = g1?.createdAt ? new Date(g1.createdAt).toISOString().slice(0,10) : gardenCreatedDayIso
        }
      } catch {}
      // Do not recompute today's task here to avoid overriding recent actions; rely on action-specific updates
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      const startIso = start.toISOString().slice(0,10)
      // Defer heavy computations; garden_tasks fetched later for stats
      // Compute current week (Mon-Sun) in UTC based on server 'today'
      const parseUTC = (iso: string) => new Date(`${iso}T00:00:00Z`)
      const anchorUTC = parseUTC(today)
      const dayUTC = anchorUTC.getUTCDay() // 0=Sun..6=Sat
      const diffToMonday = (dayUTC + 6) % 7
      const mondayUTC = new Date(anchorUTC)
      mondayUTC.setUTCDate(anchorUTC.getUTCDate() - diffToMonday)
      const weekDaysIso: string[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(mondayUTC)
        d.setUTCDate(mondayUTC.getUTCDate() + i)
        weekDaysIso.push(d.toISOString().slice(0,10))
      }
      setWeekDays(weekDaysIso)

      // Derive week counts exclusively from Tasks v2 occurrences (no legacy schedule)
      // Heavy task/occurrence computation deferred to when user opens Routine/Plants
      // Preserve heavy state on silent reloads (routine UI stability)
      const computeHeavy = opts?.preserveHeavy ? false : false
      if (computeHeavy) {
        const weekStartIso = `${weekDaysIso[0]}T00:00:00.000Z`
        const weekEndIso = `${weekDaysIso[6]}T23:59:59.999Z`
        await resyncTaskOccurrencesForGarden(id, weekStartIso, weekEndIso)
        const allTasks = await listGardenTasks(id)
        const occs = await listOccurrencesForTasks(allTasks.map(t => t.id), `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`)
        const taskTypeById: Record<string, 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'> = {}
        const taskEmojiById: Record<string, string | null> = {}
        for (const t of allTasks) { taskTypeById[t.id] = t.type as any; taskEmojiById[t.id] = (t as any).emoji || null }
        const occsWithType = occs.map(o => ({ ...o, taskType: taskTypeById[o.taskId] || 'custom', taskEmoji: taskEmojiById[o.taskId] || null }))
        setTodayTaskOccurrences(occsWithType as any)
        const taskCountMap: Record<string, number> = {}
        for (const t of allTasks) taskCountMap[t.gardenPlantId] = (taskCountMap[t.gardenPlantId] || 0) + 1
        setTaskCountsByPlant(taskCountMap)
        const dueMap: Record<string, number> = {}
        for (const o of occs) {
          const remaining = Math.max(0, (o.requiredCount || 1) - (o.completedCount || 0))
          if (remaining > 0) dueMap[o.gardenPlantId] = (dueMap[o.gardenPlantId] || 0) + remaining
        }
        setTaskOccDueToday(dueMap)

        // Weekly details
        if (weekDaysIso.length === 7) {
          const weekOccs = await listOccurrencesForTasks(allTasks.map(t => t.id), weekStartIso, weekEndIso)
          const typeCounts: { water: number[]; fertilize: number[]; harvest: number[]; cut: number[]; custom: number[] } = {
            water: Array(7).fill(0), fertilize: Array(7).fill(0), harvest: Array(7).fill(0), cut: Array(7).fill(0), custom: Array(7).fill(0),
          }
          const tById: Record<string, 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'> = {}
          for (const t of allTasks) tById[t.id] = t.type as any
          for (const o of weekOccs) {
            const dayIso = new Date(o.dueAt).toISOString().slice(0,10)
            const idx = weekDaysIso.indexOf(dayIso)
            if (idx >= 0) {
              const typ = tById[o.taskId] || 'custom'
              const inc = Math.max(1, Number(o.requiredCount || 1))
              ;(typeCounts as any)[typ][idx] += inc
            }
          }
          const totals = weekDaysIso.map((_, i) => typeCounts.water[i] + typeCounts.fertilize[i] + typeCounts.harvest[i] + typeCounts.cut[i] + typeCounts.custom[i])
          setWeekCountsByType(typeCounts)
          setWeekCounts(totals)

          const dueMapSets: Record<string, Set<number>> = {}
          for (const o of weekOccs) {
            const dayIso = new Date(o.dueAt).toISOString().slice(0,10)
            const remaining = Math.max(0, Number(o.requiredCount || 1) - Number(o.completedCount || 0))
            if (remaining <= 0) continue
            if (dayIso <= today) continue
            const idx = weekDaysIso.indexOf(dayIso)
            if (idx >= 0) {
              const pid = String(o.gardenPlantId)
              if (!dueMapSets[pid]) dueMapSets[pid] = new Set<number>()
              dueMapSets[pid].add(idx)
            }
          }
          const dueMapNext: Record<string, number[]> = {}
          for (const pid of Object.keys(dueMapSets)) dueMapNext[pid] = Array.from(dueMapSets[pid]).sort((a, b) => a - b)
          setDueThisWeekByPlant(dueMapNext)
        }

        const dueTodaySet = new Set<string>()
        for (const o of occs) {
          const remaining = Math.max(0, (o.requiredCount || 1) - (o.completedCount || 0))
          if (remaining > 0) dueTodaySet.add(o.gardenPlantId)
        }
        setDueToday(dueTodaySet)
      } else {
        // Do not clear heavy routine state during light reloads; keep last known values
        if (!silent) {
          setTodayTaskOccurrences([])
          setTaskCountsByPlant({})
          setTaskOccDueToday({})
          setWeekCountsByType({ water: Array(7).fill(0), fertilize: Array(7).fill(0), harvest: Array(7).fill(0), cut: Array(7).fill(0), custom: Array(7).fill(0) })
          setWeekCounts(Array(7).fill(0))
          setDueThisWeekByPlant({})
          setDueToday(new Set<string>())
        }
      }


      // Load inventory counts for display
      // Compute per-instance counts and totals from garden_plants instances, not species-level inventory
      const perInstanceCounts: Record<string, number> = {}
      let total = 0
      let species = 0
      const seenSpecies = new Set<string>()
      const plantsLocal = (hydratedPlants ?? gpsLocal ?? plants) as any[]
      for (const gp of plantsLocal) {
        const c = Number(gp.plantsOnHand || 0)
        perInstanceCounts[String(gp.plantId)] = (perInstanceCounts[String(gp.plantId)] || 0) + c
        total += c
        if (c > 0 && !seenSpecies.has(String(gp.plantId))) {
          seenSpecies.add(String(gp.plantId))
          species += 1
        }
      }
      setInstanceCounts(perInstanceCounts)
      setTotalOnHand(total)
      setSpeciesOnHand(species)
      // Build last-30-days success using garden_tasks (fast, no occurrences)
      try {
        const statsStart = new Date(today)
        statsStart.setDate(statsStart.getDate() - 29)
        const statsStartIso = statsStart.toISOString().slice(0,10)
        const rows = await getGardenTasks(id, statsStartIso, today)
        const successByDay: Record<string, boolean> = {}
        for (const r of rows) successByDay[r.day] = Boolean(r.success)
        const days: Array<{ date: string; due: number; completed: number; success: boolean }> = []
        const anchor30 = new Date(today)
        for (let i = 29; i >= 0; i--) {
          const d = new Date(anchor30)
          d.setDate(d.getDate() - i)
          const ds = d.toISOString().slice(0,10)
          const beforeCreation = gardenCreatedDayIso ? (ds < gardenCreatedDayIso) : false
          const success = beforeCreation ? false : Boolean(successByDay[ds])
          days.push({ date: ds, due: 0, completed: 0, success })
        }
        setDailyStats(days)
      } catch {}
      serverTodayRef.current = today
    } catch (e: any) {
      if (suppressError) {
        console.warn('[GardenDashboard] Silent load failed:', e)
      } else {
        setError(e?.message || 'Failed to load garden')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [id, garden, currentLang])

  // Lazy heavy loader for tabs that need it - only load when tab is actually viewed
  const loadHeavyForCurrentTab = React.useCallback(async (todayOverride?: string | null, opts?: { suppressError?: boolean }) => {
    const todayValue = todayOverride ?? serverTodayRef.current ?? serverToday
    if (!id || !todayValue) return
    
    // Skip if already loading or if not needed for current tab
    if (heavyLoading) return
    
    // Only load heavy data for tabs that need it
    if (tab !== 'routine' && tab !== 'plants' && tab !== 'overview') return
    
    setHeavyLoading(true)
    try {
      const parseUTC = (iso: string) => new Date(`${iso}T00:00:00Z`)
      const anchorUTC = parseUTC(todayValue)
      const dayUTC = anchorUTC.getUTCDay()
      const diffToMonday = (dayUTC + 6) % 7
      const mondayUTC = new Date(anchorUTC)
      mondayUTC.setUTCDate(anchorUTC.getUTCDate() - diffToMonday)
      const weekDaysIso: string[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(mondayUTC)
        d.setUTCDate(mondayUTC.getUTCDate() + i)
        weekDaysIso.push(d.toISOString().slice(0,10))
      }
      setWeekDays(weekDaysIso)
      const today = todayValue
      
      // Load tasks in parallel with resync for better performance
      const [allTasks] = await Promise.all([
        listGardenTasks(id),
        // Resync in background - don't block
        (async () => {
          const weekStartIso = `${weekDaysIso[0]}T00:00:00.000Z`
          const weekEndIso = `${weekDaysIso[6]}T23:59:59.999Z`
          // Use requestIdleCallback for resync to avoid blocking
          const resyncFn = () => {
            resyncTaskOccurrencesForGarden(id, weekStartIso, weekEndIso).catch(() => {})
          }
          if ('requestIdleCallback' in window) {
            window.requestIdleCallback(resyncFn, { timeout: 2000 })
          } else {
            setTimeout(resyncFn, 500)
          }
        })(),
      ])
      
      const skipCache = skipTodayCacheRef.current
      if (skipCache) skipTodayCacheRef.current = false

      let occsDetailed: Array<any> = []
      let usedCache = false
      let cachedOccs: Array<any> | null = null

      if (!skipCache) {
        cachedOccs = await getGardenTodayOccurrencesCached(id, today).catch(() => null)
        if (cachedOccs && cachedOccs.length > 0) {
          occsDetailed = cachedOccs as any
          usedCache = true
        }
      }

      if (!usedCache) {
        const occs = await listOccurrencesForTasks(allTasks.map(t => t.id), `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`)
        const taskTypeById: Record<string, 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'> = {}
        const taskEmojiById: Record<string, string | null> = {}
        for (const t of allTasks) { taskTypeById[t.id] = t.type as any; taskEmojiById[t.id] = (t as any).emoji || null }
        occsDetailed = occs.map(o => ({ ...o, taskType: taskTypeById[o.taskId] || 'custom', taskEmoji: taskEmojiById[o.taskId] || null }))
        refreshGardenTaskCache(id, today).catch(() => {})
      }

      setTodayTaskOccurrences(occsDetailed as any)

      const taskCountMap: Record<string, number> = {}
      for (const t of allTasks) taskCountMap[t.gardenPlantId] = (taskCountMap[t.gardenPlantId] || 0) + 1
      setTaskCountsByPlant(taskCountMap)

      const dueMap: Record<string, number> = {}
      for (const o of occsDetailed) {
        const remaining = Math.max(0, (o.requiredCount || 1) - (o.completedCount || 0))
        if (remaining > 0) dueMap[o.gardenPlantId] = (dueMap[o.gardenPlantId] || 0) + remaining
      }
      setTaskOccDueToday(dueMap)

      setDailyStats(prev => {
        const reqDone = occsDetailed.reduce((acc: number, o: any) => acc + Math.max(1, Number(o.requiredCount || 1)), 0)
        const compDone = occsDetailed.reduce((acc: number, o: any) => acc + Math.min(Math.max(1, Number(o.requiredCount || 1)), Number(o.completedCount || 0)), 0)
        return prev.map(d => d.date === today ? { ...d, due: reqDone, completed: compDone } : d)
      })
      
      // Only load week data if on routine tab
      if (tab === 'routine') {
        // Try to load from cache first
        const cachedWeekStats = await getGardenWeeklyStatsCached(id, weekDaysIso[0]).catch(() => null)
        
        if (cachedWeekStats) {
          // Use cached weekly stats
          setWeekCountsByType({
            water: cachedWeekStats.waterTasksByDay,
            fertilize: cachedWeekStats.fertilizeTasksByDay,
            harvest: cachedWeekStats.harvestTasksByDay,
            cut: cachedWeekStats.cutTasksByDay,
            custom: cachedWeekStats.customTasksByDay,
          })
          setWeekCounts(cachedWeekStats.totalTasksByDay)
          
          // Still need to compute dueThisWeekByPlant from occurrences
          const weekStartIso = `${weekDaysIso[0]}T00:00:00.000Z`
          const weekEndIso = `${weekDaysIso[6]}T23:59:59.999Z`
          const weekOccs = await listOccurrencesForTasks(allTasks.map(t => t.id), weekStartIso, weekEndIso)
          const dueMapSets: Record<string, Set<number>> = {}
          for (const o of weekOccs) {
            const dayIso = new Date(o.dueAt).toISOString().slice(0,10)
            const remaining = Math.max(0, Number(o.requiredCount || 1) - Number(o.completedCount || 0))
            if (remaining <= 0) continue
            if (dayIso <= today) continue
            const idx = weekDaysIso.indexOf(dayIso)
            if (idx >= 0) {
              const pid = String(o.gardenPlantId)
              if (!dueMapSets[pid]) dueMapSets[pid] = new Set<number>()
              dueMapSets[pid].add(idx)
            }
          }
          const dueMapNext: Record<string, number[]> = {}
          for (const pid of Object.keys(dueMapSets)) dueMapNext[pid] = Array.from(dueMapSets[pid]).sort((a, b) => a - b)
          setDueThisWeekByPlant(dueMapNext)
        } else {
          // Fallback: compute week data
          const loadWeekData = async () => {
            const weekStartIso = `${weekDaysIso[0]}T00:00:00.000Z`
            const weekEndIso = `${weekDaysIso[6]}T23:59:59.999Z`
            const weekOccs = await listOccurrencesForTasks(allTasks.map(t => t.id), weekStartIso, weekEndIso)
            const typeCounts: { water: number[]; fertilize: number[]; harvest: number[]; cut: number[]; custom: number[] } = {
              water: Array(7).fill(0), fertilize: Array(7).fill(0), harvest: Array(7).fill(0), cut: Array(7).fill(0), custom: Array(7).fill(0),
            }
            const tById: Record<string, 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'> = {}
            for (const t of allTasks) tById[t.id] = t.type as any
            for (const o of weekOccs) {
              const dayIso = new Date(o.dueAt).toISOString().slice(0,10)
              const idx = weekDaysIso.indexOf(dayIso)
              if (idx >= 0) {
                const typ = tById[o.taskId] || 'custom'
                const inc = Math.max(1, Number(o.requiredCount || 1))
                ;(typeCounts as any)[typ][idx] += inc
              }
            }
            const totals = weekDaysIso.map((_, i) => typeCounts.water[i] + typeCounts.fertilize[i] + typeCounts.harvest[i] + typeCounts.cut[i] + typeCounts.custom[i])
            setWeekCountsByType(typeCounts)
            setWeekCounts(totals)
            const dueMapSets: Record<string, Set<number>> = {}
            for (const o of weekOccs) {
              const dayIso = new Date(o.dueAt).toISOString().slice(0,10)
              const remaining = Math.max(0, Number(o.requiredCount || 1) - Number(o.completedCount || 0))
              if (remaining <= 0) continue
              if (dayIso <= today) continue
              const idx = weekDaysIso.indexOf(dayIso)
              if (idx >= 0) {
                const pid = String(o.gardenPlantId)
                if (!dueMapSets[pid]) dueMapSets[pid] = new Set<number>()
                dueMapSets[pid].add(idx)
              }
            }
            const dueMapNext: Record<string, number[]> = {}
            for (const pid of Object.keys(dueMapSets)) dueMapNext[pid] = Array.from(dueMapSets[pid]).sort((a, b) => a - b)
            setDueThisWeekByPlant(dueMapNext)
            
            // Refresh cache in background
            refreshGardenTaskCache(id, today).catch(() => {})
          }
          
          // Load week data in background
          if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => loadWeekData(), { timeout: 1000 })
          } else {
            setTimeout(() => loadWeekData(), 200)
          }
        }
      }
      
      const occsForDueToday = cachedOccs && cachedOccs.length > 0
        ? cachedOccs
        : (await listOccurrencesForTasks(
            allTasks.map(t => t.id),
            `${today}T00:00:00.000Z`,
            `${today}T23:59:59.999Z`,
          ).catch(() => []))
      const dueTodaySet = new Set<string>()
      for (const o of (occsForDueToday || [])) {
        const remaining = Math.max(0, (o.requiredCount || 1) - (o.completedCount || 0))
        if (remaining > 0) dueTodaySet.add(o.gardenPlantId)
      }
      setDueToday(dueTodaySet)
    } catch (e: any) {
      if (opts?.suppressError) {
        console.warn('[GardenDashboard] Silent heavy load failed:', e)
      } else {
        setError(e?.message || 'Failed to load tasks')
      }
    } finally {
      setHeavyLoading(false)
    }
  }, [id, serverToday, tab])

  // Targeted update function that only refreshes specific parts to avoid flashing
  const updateTargeted = React.useCallback(async (kind: GardenRealtimeKind = 'general') => {
    if (!id) return
    if (anyModalOpen) {
      pendingReloadRef.current = true
      return
    }

    const now = Date.now()
    const since = now - (lastReloadRef.current || 0)
    const minInterval = 300 // Reduced debounce for smoother updates

    if (since < minInterval) {
      if (reloadTimerRef.current) return
      const wait = Math.max(0, minInterval - since)
      reloadTimerRef.current = setTimeout(() => {
        reloadTimerRef.current = null
        updateTargeted(kind).catch(() => {})
      }, wait)
      return
    }

    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current)
      reloadTimerRef.current = null
    }

    lastReloadRef.current = Date.now()

    try {
      const today = serverTodayRef.current ?? serverToday
      
      // Update only what's needed based on kind
      if (kind === 'tasks' || kind === 'general') {
        // Tasks: Update task occurrences and counts without touching plants
        const allTasks = await listGardenTasks(id)
        if (today) {
          const weekStartIso = (() => {
            const parseUTC = (iso: string) => new Date(`${iso}T00:00:00Z`)
            const anchorUTC = parseUTC(today)
            const dayUTC = anchorUTC.getUTCDay()
            const diffToMonday = (dayUTC + 6) % 7
            const mondayUTC = new Date(anchorUTC)
            mondayUTC.setUTCDate(anchorUTC.getUTCDate() - diffToMonday)
            return mondayUTC.toISOString().slice(0,10) + 'T00:00:00.000Z'
          })()
          const weekEndIso = (() => {
            const parseUTC = (iso: string) => new Date(`${iso}T00:00:00Z`)
            const anchorUTC = parseUTC(today)
            const dayUTC = anchorUTC.getUTCDay()
            const diffToMonday = (dayUTC + 6) % 7
            const mondayUTC = new Date(anchorUTC)
            mondayUTC.setUTCDate(anchorUTC.getUTCDate() - diffToMonday)
            mondayUTC.setUTCDate(mondayUTC.getUTCDate() + 6)
            return mondayUTC.toISOString().slice(0,10) + 'T23:59:59.999Z'
          })()
          await resyncTaskOccurrencesForGarden(id, weekStartIso, weekEndIso)
          const occs = await listOccurrencesForTasks(allTasks.map(t => t.id), `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`)
          const taskTypeById: Record<string, 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'> = {}
          const taskEmojiById: Record<string, string | null> = {}
          for (const t of allTasks) { taskTypeById[t.id] = t.type as any; taskEmojiById[t.id] = (t as any).emoji || null }
          const occsWithType = occs.map(o => ({ ...o, taskType: taskTypeById[o.taskId] || 'custom', taskEmoji: taskEmojiById[o.taskId] || null }))
          
          // Update state using functional updates to preserve existing items
          setTodayTaskOccurrences(prev => {
            // Replace with new data but preserve object references for unchanged items to avoid re-renders
            const prevMap = new Map(prev.map(o => [o.id, o]))
            const newMap = new Map(occsWithType.map(o => [o.id, o]))
            const result: any[] = []
            
            // Use new data order, but keep existing object references when data hasn't changed
            for (const newOcc of occsWithType) {
              const existing = prevMap.get(newOcc.id)
              if (existing && 
                  existing.completedCount === newOcc.completedCount &&
                  existing.requiredCount === newOcc.requiredCount &&
                  existing.taskId === newOcc.taskId &&
                  existing.gardenPlantId === newOcc.gardenPlantId) {
                // Keep existing reference to avoid React re-render
                result.push(existing)
              } else {
                result.push(newOcc)
              }
            }
            
            return result
          })
          
          const taskCountMap: Record<string, number> = {}
          for (const t of allTasks) taskCountMap[t.gardenPlantId] = (taskCountMap[t.gardenPlantId] || 0) + 1
          setTaskCountsByPlant(prev => ({ ...prev, ...taskCountMap }))
          
          const dueMap: Record<string, number> = {}
          for (const o of occs) {
            const remaining = Math.max(0, (o.requiredCount || 1) - (o.completedCount || 0))
            if (remaining > 0) dueMap[o.gardenPlantId] = (dueMap[o.gardenPlantId] || 0) + remaining
          }
          setTaskOccDueToday(prev => ({ ...prev, ...dueMap }))
          
          const dueTodaySet = new Set<string>()
          for (const o of occs) {
            const remaining = Math.max(0, (o.requiredCount || 1) - (o.completedCount || 0))
            if (remaining > 0) dueTodaySet.add(o.gardenPlantId)
          }
          setDueToday(prev => {
            const next = new Set(prev || new Set())
            // Update set: add new due items, remove items that are no longer due
            for (const pid of dueTodaySet) next.add(pid)
            for (const pid of Array.from(next)) {
              if (!dueTodaySet.has(pid)) next.delete(pid)
            }
            return next
          })

          if (tab === 'routine' && today) {
            const weekOccs = await listOccurrencesForTasks(allTasks.map(t => t.id), weekStartIso, weekEndIso)
            const typeCounts: { water: number[]; fertilize: number[]; harvest: number[]; cut: number[]; custom: number[] } = {
              water: Array(7).fill(0), fertilize: Array(7).fill(0), harvest: Array(7).fill(0), cut: Array(7).fill(0), custom: Array(7).fill(0),
            }
            const tById: Record<string, 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'> = {}
            for (const t of allTasks) tById[t.id] = t.type as any
            for (const o of weekOccs) {
              const dayIso = new Date(o.dueAt).toISOString().slice(0,10)
              const idx = weekDays.indexOf(dayIso)
              if (idx >= 0) {
                const typ = tById[o.taskId] || 'custom'
                const inc = Math.max(1, Number(o.requiredCount || 1))
                ;(typeCounts as any)[typ][idx] += inc
              }
            }
            const totals = weekDays.map((_, i) => typeCounts.water[i] + typeCounts.fertilize[i] + typeCounts.harvest[i] + typeCounts.cut[i] + typeCounts.custom[i])
            setWeekCountsByType(typeCounts)
            setWeekCounts(totals)

            const dueMapSets: Record<string, Set<number>> = {}
            for (const o of weekOccs) {
              const dayIso = new Date(o.dueAt).toISOString().slice(0,10)
              const remaining = Math.max(0, Number(o.requiredCount || 1) - Number(o.completedCount || 0))
              if (remaining <= 0) continue
              if (dayIso <= today) continue
              const idx = weekDays.indexOf(dayIso)
              if (idx >= 0) {
                const pid = String(o.gardenPlantId)
                if (!dueMapSets[pid]) dueMapSets[pid] = new Set<number>()
                dueMapSets[pid].add(idx)
              }
            }
            const dueMapNext: Record<string, number[]> = {}
            for (const pid of Object.keys(dueMapSets)) dueMapNext[pid] = Array.from(dueMapSets[pid]).sort((a, b) => a - b)
            setDueThisWeekByPlant(dueMapNext)
          }

          // Update daily stats for today only
          if (today) {
            setDailyStats(prev => {
              const reqDone = occs.reduce((acc, o) => acc + Math.max(1, Number(o.requiredCount || 1)), 0)
              const compDone = occs.reduce((acc, o) => acc + Math.min(Math.max(1, Number(o.requiredCount || 1)), Number(o.completedCount || 0)), 0)
              return prev.map(d => d.date === today ? { ...d, due: reqDone, completed: compDone } : d)
            })
          }
        }
      }

      if (kind === 'plants' || kind === 'general') {
        // Plants: Update plants array while preserving existing items
        const gpsRaw = await getGardenPlants(id, currentLang)
        setPlants(prev => {
          // Merge: preserve order and existing items, update changed ones
          const prevMap = new Map(prev.map((p: any) => [p.id, p]))
          const merged: any[] = []
          // Use new order but preserve existing objects where possible
          for (const newP of gpsRaw) {
            const existing = prevMap.get(newP.id)
            // Compare key fields that matter for rendering to avoid unnecessary re-renders
            if (existing && 
                existing.nickname === newP.nickname &&
                existing.plantsOnHand === newP.plantsOnHand &&
                existing.plantId === newP.plantId &&
                existing.id === newP.id) {
              // Keep existing reference to avoid React re-render
              merged.push(existing)
            } else {
              merged.push(newP)
            }
          }
          return merged
        })

        // Update inventory counts
        const perInstanceCounts: Record<string, number> = {}
        let total = 0
        let species = 0
        const seenSpecies = new Set<string>()
        for (const gp of gpsRaw) {
          const c = Number(gp.plantsOnHand || 0)
          perInstanceCounts[String(gp.plantId)] = (perInstanceCounts[String(gp.plantId)] || 0) + c
          total += c
          if (c > 0 && !seenSpecies.has(String(gp.plantId))) {
            seenSpecies.add(String(gp.plantId))
            species += 1
          }
        }
        setInstanceCounts(perInstanceCounts)
        setTotalOnHand(total)
        setSpeciesOnHand(species)
      }

      if (kind === 'members' || kind === 'general') {
        // Members: Update members array
        const ms = await getGardenMembers(id)
        setMembers(ms.map(m => ({ userId: m.userId, displayName: m.displayName ?? null, email: (m as any).email ?? null, role: m.role, joinedAt: (m as any).joinedAt, accentKey: (m as any).accentKey ?? null })))
      }

      if (kind === 'activity' || kind === 'general') {
        // Activity: Just trigger refresh
        setActivityRev((r) => r + 1)
      }

      if (kind === 'settings' || kind === 'general') {
        // Settings: Update garden info
        const g0 = await getGarden(id)
        if (g0) setGarden(g0)
      }
    } catch (e) {
      // Fallback to full reload on error
      console.warn('[GardenDashboard] Targeted update failed, falling back to full reload:', e)
      await load({ silent: true, preserveHeavy: true, suppressError: true })
      await loadHeavyForCurrentTab(serverTodayRef.current ?? serverToday, { suppressError: true })
    }
  }, [id, anyModalOpen, serverToday, tab, weekDays, load, loadHeavyForCurrentTab, currentLang])

  const scheduleReload = React.useCallback(() => {
    const executeReload = async () => {
      pendingReloadRef.current = false
      lastReloadRef.current = Date.now()
      await load({ silent: true, preserveHeavy: true, suppressError: true })
      await loadHeavyForCurrentTab(serverTodayRef.current ?? serverToday, { suppressError: true })
      setActivityRev((r) => r + 1)
    }

    if (anyModalOpen) {
      pendingReloadRef.current = true
      return
    }

    const now = Date.now()
    const since = now - (lastReloadRef.current || 0)
    const minInterval = 750

    if (since < minInterval) {
      if (reloadTimerRef.current) return
      const wait = Math.max(0, minInterval - since)
      reloadTimerRef.current = setTimeout(() => {
        reloadTimerRef.current = null
        executeReload().catch(() => {})
      }, wait)
      return
    }

    if (reloadTimerRef.current) return
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null
      executeReload().catch(() => {})
    }, 50)
  }, [anyModalOpen, load, loadHeavyForCurrentTab])

  React.useEffect(() => {
    return () => {
      if (reloadTimerRef.current) {
        try { clearTimeout(reloadTimerRef.current) } catch {}
        reloadTimerRef.current = null
      }
    }
  }, [])

  const currentUserId = user?.id || null
  const isOwner = React.useMemo(() => {
    // Admins have full owner-level access across all gardens
    if (profile?.is_admin) return true
    if (!currentUserId) return false
    const self = members.find(m => m.userId === currentUserId)
    return self?.role === 'owner'
  }, [members, currentUserId, profile?.is_admin])

  React.useEffect(() => { load() }, [load])

  // Load heavy data when tab changes or when garden loads - use requestIdleCallback for better performance
  React.useEffect(() => {
    if (!loading && id && serverToday) {
      // Use requestIdleCallback to defer heavy loading until browser is idle
      const loadFn = () => {
        loadHeavyForCurrentTab(serverTodayRef.current ?? serverToday)
      }
      
      if ('requestIdleCallback' in window) {
        const idleId = window.requestIdleCallback(loadFn, { timeout: 500 })
        return () => {
          window.cancelIdleCallback(idleId)
        }
      } else {
        const timer = setTimeout(loadFn, 100)
        return () => clearTimeout(timer)
      }
    }
  }, [tab, loadHeavyForCurrentTab, serverToday, loading, id])

  // Realtime updates via Supabase (tables: gardens, garden_members, garden_plants, garden_plant_tasks, garden_plant_task_occurrences, plants)
  React.useEffect(() => {
    if (!id) return

    const channel = supabase.channel(`rt-garden-${id}`)
      // Garden row changes (name, cover image, streak) - use targeted update
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gardens', filter: `id=eq.${id}` }, () => {
        updateTargeted('settings').catch(() => {})
      })
      // Immediate redirect if garden is deleted by another user
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'gardens', filter: `id=eq.${id}` }, () => { try { navigate('/gardens') } catch {} })
      // Member changes (add/remove/promote/demote) - use targeted update
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_members', filter: `garden_id=eq.${id}` }, () => {
        updateTargeted('members').catch(() => {})
      })
      // Garden instance edits (nickname, on-hand count, reorder, add/remove) - use targeted update
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_plants', filter: `garden_id=eq.${id}` }, () => {
        updateTargeted('plants').catch(() => {})
      })
      // Task definition changes affecting counts and due badges - use targeted update
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_plant_tasks', filter: `garden_id=eq.${id}` }, () => {
        updateTargeted('tasks').catch(() => {})
      })
      // Also watch task edits scoped by plant (fallback when garden_id is missing on row level) - use targeted update
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_plant_tasks' }, (payload) => {
        try {
          const row = (payload as any)?.new || (payload as any)?.old || {}
          const gpId = String(row.garden_plant_id || '')
          if (!gpId) { updateTargeted('tasks').catch(() => {}); return }
          updateTargeted('tasks').catch(() => {})
        } catch { updateTargeted('tasks').catch(() => {}) }
      })
      // Occurrence progress/completion updates (affects Routine and Today counts) - use targeted update
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_plant_task_occurrences' }, () => {
        updateTargeted('tasks').catch(() => {})
      })
      // Global plant library changes (name/image updates) - use targeted update
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plants' }, () => {
        updateTargeted('plants').catch(() => {})
      })
      // Garden activity log changes (authoritative cross-client signal) - use targeted update
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garden_activity_logs', filter: `garden_id=eq.${id}` }, () => {
        updateTargeted('activity').catch(() => {})
      })

    const subscription = channel.subscribe()
    if (subscription instanceof Promise) subscription.catch(() => {})

    return () => {
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [id, navigate, updateTargeted])

  React.useEffect(() => {
    if (!id) return
    let active = true
    let teardown: (() => Promise<void>) | null = null

    addGardenBroadcastListener((message) => {
      if (message.gardenId !== id) return
      if (message.actorId && message.actorId === currentUserId) return
      // Use targeted update based on broadcast kind to avoid flashing
      updateTargeted(message.kind || 'general').catch(() => {})
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
  }, [currentUserId, id, updateTargeted])

  // When modals close, run any pending reload once
  React.useEffect(() => {
    if (!anyModalOpen && pendingReloadRef.current) {
      pendingReloadRef.current = false
      scheduleReload()
    }
  }, [anyModalOpen, scheduleReload])

  const viewerIsOwner = React.useMemo(() => {
    // Admins can manage any garden
    if (profile?.is_admin) return true
    if (!user?.id) return false
    return members.some(m => m.userId === user.id && m.role === 'owner')
  }, [members, user?.id, profile?.is_admin])

  const ownersCount = React.useMemo(() => {
    return members.filter(m => m.role === 'owner').length
  }, [members])

  // Resolve the current viewer's chosen accent color as a CSS hsl() value
  const getActorColorCss = React.useCallback(() => {
    const uid = profile?.id || user?.id
    if (!uid) return null
    const mm = members.find(m => m.userId === uid)
    if (!mm?.accentKey) return null
    const opt = getAccentOption(mm.accentKey as any)
    return opt ? `hsl(${opt.hsl})` : null
  }, [members, profile?.id, user?.id])

  React.useEffect(() => {
    let ignore = false
    if (!plantQuery.trim()) { setPlantResults([]); return }
    ;(async () => {
      const queryLower = plantQuery.toLowerCase().trim()
      
      // Search in base plants table
      const { data: basePlants, error: baseError } = await supabase
        .from('plants')
        .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, care_sunlight, care_water, care_soil, care_difficulty, seeds_available, water_freq_unit, water_freq_value, water_freq_period, water_freq_amount')
        .ilike('name', `%${queryLower}%`)
        .limit(20)
      
      // Search in translations table for current language
      const { data: translatedPlants, error: transError } = await supabase
        .from('plant_translations')
        .select('plant_id, name, scientific_name, meaning, description, care_soil')
        .eq('language', currentLang)
        .ilike('name', `%${queryLower}%`)
        .limit(20)
      
      if (baseError || transError) {
        console.error('Error searching plants:', baseError || transError)
        if (!ignore) setPlantResults([])
        return
      }
      
      // Get unique plant IDs from both searches
      const basePlantIds = new Set((basePlants || []).map((p: any) => p.id))
      const translatedPlantIds = new Set((translatedPlants || []).map((t: any) => t.plant_id))
      const allPlantIds = new Set([...basePlantIds, ...translatedPlantIds])
      
      if (allPlantIds.size === 0) {
        if (!ignore) setPlantResults([])
        return
      }
      
      // Load full plant data for all matching IDs
      const { data: fullPlants, error: fullError } = await supabase
        .from('plants')
        .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, care_sunlight, care_water, care_soil, care_difficulty, seeds_available, water_freq_unit, water_freq_value, water_freq_period, water_freq_amount')
        .in('id', Array.from(allPlantIds))
        .limit(20)
      
      if (fullError || !fullPlants) {
        console.error('Error loading full plants:', fullError)
        if (!ignore) setPlantResults([])
        return
      }
      
      // Load translations for current language
      const plantIds = fullPlants.map((p: any) => p.id)
      const { data: translations } = await supabase
        .from('plant_translations')
        .select('*')
        .eq('language', currentLang)
        .in('plant_id', plantIds)
      
      // Create translation map
      const translationMap = new Map()
      if (translations) {
        translations.forEach((t: any) => {
          translationMap.set(t.plant_id, t)
        })
      }
      
      // Merge translations with base plants and filter by search query
      const merged: Plant[] = fullPlants
        .map((p: any) => {
          const translation = translationMap.get(p.id)
          const mergedPlant = mergePlantWithTranslation(p, translation)
          return mergedPlant
        })
        .filter((p: Plant) => {
          // Filter by translated name or base name
          const nameMatch = p.name.toLowerCase().includes(queryLower)
          return nameMatch
        })
        .slice(0, 10) // Limit to 10 results
      
      if (!ignore) {
        setPlantResults(merged)
      }
    })()
    return () => { ignore = true }
  }, [plantQuery, currentLang])

  const loadFriends = React.useCallback(async () => {
    if (!user?.id) return
    try {
      const { data, error: err } = await supabase
        .from('friends')
        .select('id, user_id, friend_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (err) throw err
      
      const friendIds = (data || []).map(f => f.friend_id)
      if (friendIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', friendIds)
        
        const emailPromises = friendIds.map(async (id) => {
          try {
            const { data: emailData } = await supabase.rpc('get_friend_email', { _friend_id: id })
            return { id, email: emailData || null }
          } catch {
            return { id, email: null }
          }
        })
        const emails = await Promise.all(emailPromises)
        const emailMap = new Map(emails.map(e => [e.id, e.email]))
        
        const profileMap = new Map((profiles || []).map(p => [p.id, p]))
        const friendsWithProfiles = (data || []).map(f => {
          const profile = profileMap.get(f.friend_id)
          return {
            id: f.friend_id,
            display_name: profile?.display_name || null,
            email: emailMap.get(f.friend_id) || null
          }
        })
        setFriends(friendsWithProfiles)
      } else {
        setFriends([])
      }
    } catch (e: any) {
      console.error('Failed to load friends:', e)
    }
  }, [user?.id])

  // Load friends when invite dialog opens
  React.useEffect(() => {
    if (inviteOpen && user?.id) {
      loadFriends()
      setInviteAny('')
      setFriendSuggestions([])
      setSuggestionsOpen(false)
      setInviteError(null)
    }
  }, [inviteOpen, user?.id, loadFriends])

  // Filter friend suggestions based on input
  React.useEffect(() => {
    const memberIds = new Set(members.map(m => m.userId))
    
    // Filter out already members
    let filtered = friends.filter(f => !memberIds.has(f.id))
    
    // If there's input, filter by display name or email
    if (inviteAny.trim()) {
      const query = inviteAny.trim().toLowerCase()
      filtered = filtered.filter(f => {
        const displayNameMatch = f.display_name?.toLowerCase().includes(query)
        const emailMatch = f.email?.toLowerCase().includes(query)
        return displayNameMatch || emailMatch
      })
      
      // Check if input exactly matches any suggestion (case-insensitive)
      const exactMatch = filtered.some(f => {
        const displayNameExact = f.display_name?.toLowerCase() === query
        const emailExact = f.email?.toLowerCase() === query
        return displayNameExact || emailExact
      })
      
      // Limit to top 5
      filtered = filtered.slice(0, 5)
      
      setFriendSuggestions(filtered)
      // Hide suggestions if input exactly matches a suggestion or if no matches
      setSuggestionsOpen(filtered.length > 0 && inviteOpen && !exactMatch)
    } else {
      // Limit to top 5
      filtered = filtered.slice(0, 5)
      
      setFriendSuggestions(filtered)
      setSuggestionsOpen(filtered.length > 0 && inviteOpen)
    }
  }, [inviteAny, friends, members, inviteOpen])

  const submitInvite = async () => {
    if (!id || !inviteAny.trim()) return
    setInviteError(null)
    const res = await addMemberByNameOrEmail({ gardenId: id, input: inviteAny.trim(), role: 'member' })
    if (!res.ok) {
      setInviteError(res.reason === 'no_account' ? 'No account found' : 'Failed to add member')
      return
    }
    // Log membership change so other clients update via SSE
    try {
      const actorColorCss = getActorColorCss()
      await logGardenActivity({ gardenId: id, kind: 'note' as any, message: 'added a member', actorColor: actorColorCss || null })
      setActivityRev((r) => r + 1)
    } catch {}
    setInviteOpen(false)
    setInviteAny('')
    setFriendSuggestions([])
    setSuggestionsOpen(false)
    await load()
    emitGardenRealtime('members')
  }

  const addSelectedPlant = async () => {
    if (!id || !selectedPlant || adding) return
    setAdding(true)
    try {
      // Open details modal to capture count and nickname
      // Prefill the editable name field with the plant's species name
      setAddNickname(selectedPlant.name)
      setAddDetailsOpen(true)
      return
    } catch (e: any) {
      setError(e?.message || 'Failed to add plant')
    } finally {
      setAdding(false)
    }
  }

  const confirmAddSelectedPlant = async () => {
    if (!id || !selectedPlant) return
    try {
      // If there is exactly one existing instance of this species in the garden,
      // and it has no per-instance count yet, backfill it from species-level inventory
      const { data: existingRows } = await supabase
        .from('garden_plants')
        .select('id')
        .eq('garden_id', id)
        .eq('plant_id', selectedPlant.id)
      const existingIds = (existingRows || []).map((r: any) => String(r.id))
      if (existingIds.length === 1) {
        const existingId = existingIds[0]
        const { data: speciesInv } = await supabase
          .from('garden_inventory')
          .select('plants_on_hand')
          .eq('garden_id', id)
          .eq('plant_id', selectedPlant.id)
          .maybeSingle()
        const { data: instInv } = await supabase
          .from('garden_instance_inventory')
          .select('plants_on_hand')
          .eq('garden_plant_id', existingId)
          .maybeSingle()
        const speciesCount = Number(speciesInv?.plants_on_hand ?? 0)
        const instCount = Number(instInv?.plants_on_hand ?? 0)
        if (speciesCount > 0 && instCount === 0) {
          await supabase
            .from('garden_instance_inventory')
            .upsert({ garden_id: id, garden_plant_id: existingId, plants_on_hand: speciesCount, seeds_on_hand: 0 }, { onConflict: 'garden_plant_id' })
        }
      }
      // Treat unchanged name (same as species name) as no custom nickname
      const trimmedName = addNickname.trim()
      const nicknameVal = trimmedName.length > 0 && trimmedName !== (selectedPlant.name || '').trim() ? trimmedName : null
      const qty = Math.max(0, Number(addCount || 0))
      // Create a new instance and set its own count; do not merge into species inventory
      const gp = await addPlantToGarden({ gardenId: id, plantId: selectedPlant.id, seedsPlanted: 0, nickname: nicknameVal || undefined })
      if (qty > 0) {
        await supabase.from('garden_plants').update({ plants_on_hand: qty }).eq('id', gp.id)
      }
      // Log activity: plant added
      try {
        const actorColorCss = getActorColorCss()
        await logGardenActivity({
          gardenId: id,
          kind: 'plant_added' as any,
          message: `added "${nicknameVal || selectedPlant.name}"${qty > 0 ? ` x${qty}` : ''}`,
          plantName: nicknameVal || selectedPlant.name,
          actorColor: actorColorCss || null,
        })
        setActivityRev((r) => r + 1)
      } catch {}
      setAddDetailsOpen(false)
      setAddNickname('')
      setAddCount(1)
      setAddOpen(false)
      setSelectedPlant(null)
      setPlantQuery('')
      // Open Tasks with default watering 2x (user can change unit)
      setPendingGardenPlantId(gp.id)
      setTaskOpen(true)
      emitGardenRealtime('plants')
    } catch (e: any) {
      setError(e?.message || 'Failed to add plant')
    }
  }

  const openEditSchedule = async (gardenPlant: any) => {
    try {
      const schedule = await getGardenPlantSchedule(gardenPlant.id)
      const period = (schedule?.period || gardenPlant.overrideWaterFreqUnit || gardenPlant.plant?.waterFreqPeriod || gardenPlant.plant?.waterFreqUnit || 'week') as 'week' | 'month' | 'year'
      const amountRaw = schedule?.amount ?? gardenPlant.overrideWaterFreqValue ?? gardenPlant.plant?.waterFreqAmount ?? gardenPlant.plant?.waterFreqValue ?? 1
      const amount = Number(amountRaw) > 0 ? Number(amountRaw) : 1
      setPendingGardenPlantId(gardenPlant.id)
      setPendingPeriod(period)
      setPendingAmount(amount)
      setInitialSelectionState({
        weeklyDays: schedule?.weeklyDays || undefined,
        monthlyDays: schedule?.monthlyDays || undefined,
        yearlyDays: schedule?.yearlyDays || undefined,
        monthlyNthWeekdays: schedule?.monthlyNthWeekdays || undefined,
      })
      setScheduleLockYear(false)
      setScheduleAllowedPeriods([period])
      setScheduleOpen(true)
    } catch (e) {
      // Fallback: open with inferred defaults
      const period = (gardenPlant.overrideWaterFreqUnit || gardenPlant.plant?.waterFreqPeriod || gardenPlant.plant?.waterFreqUnit || 'week') as 'week' | 'month' | 'year'
      const amountRaw = gardenPlant.overrideWaterFreqValue ?? gardenPlant.plant?.waterFreqAmount ?? gardenPlant.plant?.waterFreqValue ?? 1
      const amount = Number(amountRaw) > 0 ? Number(amountRaw) : 1
      setPendingGardenPlantId(gardenPlant.id)
      setPendingPeriod(period)
      setPendingAmount(amount)
      setInitialSelectionState(undefined)
      setScheduleLockYear(false)
      setScheduleAllowedPeriods([period])
      setScheduleOpen(true)
    }
  }

  const handleSaveSchedule = async (selection: { weeklyDays?: number[]; monthlyDays?: number[]; yearlyDays?: string[]; monthlyNthWeekdays?: string[] }) => {
    if (!pendingGardenPlantId || !pendingPeriod || !id) return
    try {
      await upsertGardenPlantSchedule({
        gardenPlantId: pendingGardenPlantId,
        period: pendingPeriod,
        amount: pendingAmount,
        weeklyDays: selection.weeklyDays || null,
        monthlyDays: selection.monthlyDays || null,
        yearlyDays: selection.yearlyDays || null,
        monthlyNthWeekdays: selection.monthlyNthWeekdays || null,
      })
      // Log schedule change so other clients refresh via SSE
      try {
        const gp = (plants as any[]).find((p: any) => p.id === pendingGardenPlantId)
        const plantName = gp?.nickname || gp?.plant?.name || 'Plant'
        const actorColorCss = getActorColorCss()
        const per = String(pendingPeriod).toUpperCase()
        await logGardenActivity({ gardenId: id, kind: 'note' as any, message: `updated schedule on "${plantName}" (${pendingAmount}/${per})`, plantName, actorColor: actorColorCss || null })
        setActivityRev((r) => r + 1)
      } catch {}
      if (serverToday && garden?.id) {
        // Recompute today's task for this garden to reflect new schedule
        await computeGardenTaskForDay({ gardenId: garden.id, dayIso: serverToday })
      }
      await load({ silent: true, preserveHeavy: true })
      if (tab === 'routine') {
        await loadHeavyForCurrentTab(serverTodayRef.current ?? serverToday)
      }
      if (id) navigate(`/garden/${id}/plants`)
      emitGardenRealtime('tasks')
    } catch (e: any) {
      setError(e?.message || 'Failed to save schedule')
      throw e
    } finally {
      setPendingGardenPlantId(null)
      setPendingPeriod(null)
      setPendingAmount(0)
      setInitialSelectionState(undefined)
      setScheduleOpen(false)
    }
  }

  const logWater = async (gardenPlantId: string) => {
    try {
      // Transition path: no legacy watering schedule updates; users should complete occurrences instead
      if (serverToday && garden?.id) {
        try {
          // Recompute success solely from task occurrences
          const today = serverToday
          const allTasks = await listGardenTasks(garden.id)
          // Use resync to purge stale occurrences first
          await resyncTaskOccurrencesForGarden(garden.id, `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`)
          const occs = await listOccurrencesForTasks(allTasks.map(t => t.id), `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`)
          let due = 0, completed = 0
          for (const o of occs) {
            const req = Math.max(1, Number(o.requiredCount || 1))
            const comp = Math.min(req, Number(o.completedCount || 0))
            due += req
            completed += comp
          }
          const success = due === 0 ? true : (completed >= due)
          await upsertGardenTask({ gardenId: garden.id, day: today, gardenPlantId: null, success })
          skipTodayCacheRef.current = true
          await updateTodayProgressState()
        } catch {}
      }
      await load({ silent: true, preserveHeavy: true })
      if (tab === 'routine') {
        await loadHeavyForCurrentTab(serverTodayRef.current ?? serverToday)
      }
      if (id) navigate(`/garden/${id}/routine`)
      emitGardenRealtime('tasks')
    } catch (e: any) {
      setError(e?.message || 'Failed to log watering')
    }
  }

  const completeAllTodayForPlant = async (gardenPlantId: string) => {
    // Set loading state
    setCompletingPlantIds(prev => new Set(prev).add(gardenPlantId))
    
      try {
        const occs = todayTaskOccurrences.filter(o => o.gardenPlantId === gardenPlantId)
        for (const o of occs) {
          const remaining = Math.max(0, Number(o.requiredCount || 1) - Number(o.completedCount || 0))
          if (remaining <= 0) continue
          // Some backends increment by exactly 1 regardless of provided amount.
          // Perform deterministic 1-step increments to guarantee full completion.
          for (let i = 0; i < remaining; i++) {
            await progressTaskOccurrence(o.id, 1)
          }
        }
        // Log summary activity for this plant
        try {
          if (id) {
            const gp = (plants as any[]).find((p: any) => p.id === gardenPlantId)
            const plantName = gp?.nickname || gp?.plant?.name || 'Plant'
            const actorColorCss = getActorColorCss()
            await logGardenActivity({ gardenId: id, kind: 'task_completed' as any, message: `completed all due tasks on "${plantName}"`, plantName, actorColor: actorColorCss || null })
            setActivityRev((r) => r + 1)
            // Broadcast update BEFORE reload to ensure other clients receive it
            await broadcastGardenUpdate({ gardenId: id, kind: 'tasks', actorId: user?.id ?? null }).catch((err) => {
              console.warn('[GardenDashboard] Failed to broadcast task update:', err)
            })
          }
        } catch {}
        skipTodayCacheRef.current = true
        await updateTodayProgressState()
        await load()
      // Signal other UI (nav bars) to refresh notification badges
      emitGardenRealtime('tasks')
    } catch (e) {
      // swallow; global error display exists
    } finally {
      // Clear loading state
      setCompletingPlantIds(prev => {
        const next = new Set(prev)
        next.delete(gardenPlantId)
        return next
      })
    }
  }

  // Toggle like for a plant and sync to profile
  const toggleLiked = async (plantId: string) => {
    if (!user?.id) return
    setLikedIds((prev) => {
      const has = prev.includes(plantId)
      const next = has ? prev.filter((id) => id !== plantId) : [...prev, plantId]
      ;(async () => {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ liked_plant_ids: next })
            .eq('id', user.id)
          if (error) {
            setLikedIds(prev)
          } else {
            refreshProfile().catch(() => {})
          }
        } catch {
          setLikedIds(prev)
        }
      })()
      return next
    })
  }

  // invite by email only (implemented in submitInvite)

  // Shared progress handler for Task occurrences (used by Routine and Tasks sidebar)
  const progressOccurrenceHandler = React.useCallback(async (occId: string, inc: number) => {
    // Set loading state
    setProgressingOccIds(prev => new Set(prev).add(occId))
    
    try {
      await progressTaskOccurrence(occId, inc)
      const o = todayTaskOccurrences.find((x: any) => x.id === occId)
      if (o && id) {
        const gp = (plants as any[]).find((p: any) => p.id === o.gardenPlantId)
        const type = (o as any).taskType || 'custom'
        const taskTypeLabel = t(`garden.taskTypes.${type}`)
        const plantName = gp?.nickname || gp?.plant?.name || null
        const newCount = Number(o.completedCount || 0) + inc
        const required = Number(o.requiredCount || 1)
        const done = newCount >= required
        const kind = done ? 'task_completed' : 'task_progressed'
        const msg = done
          ? t('garden.activity.completedTask', { taskType: taskTypeLabel, plantName: plantName || t('garden.activity.plant') })
          : t('garden.activity.progressedTask', { taskType: taskTypeLabel, plantName: plantName || t('garden.activity.plant'), completed: Math.min(newCount, required), required })
        const actorColorCss = getActorColorCss()
        await logGardenActivity({ gardenId: id!, kind: kind as any, message: msg, plantName: plantName || null, taskName: taskTypeLabel, actorColor: actorColorCss || null })
        setActivityRev((r) => r + 1)
        // Broadcast update BEFORE reload to ensure other clients receive it
        await broadcastGardenUpdate({ gardenId: id, kind: 'tasks', actorId: user?.id ?? null }).catch((err) => {
          console.warn('[GardenDashboard] Failed to broadcast task update:', err)
        })
      }
      skipTodayCacheRef.current = true
      await updateTodayProgressState()
    } finally {
      // Clear loading state
      setProgressingOccIds(prev => {
        const next = new Set(prev)
        next.delete(occId)
        return next
      })
      
      await load({ silent: true, preserveHeavy: true })
      await loadHeavyForCurrentTab(serverTodayRef.current ?? serverToday)
      // Also emit local event for immediate UI updates
      emitGardenRealtime('tasks')
    }
  }, [todayTaskOccurrences, id, plants, getActorColorCss, load, loadHeavyForCurrentTab, emitGardenRealtime, user?.id, t])

  return (
    <div className="max-w-6xl mx-auto mt-6 grid grid-cols-1 md:grid-cols-[220px_1fr] lg:grid-cols-[220px_1fr] gap-6">
      {error && <div className="p-6 text-sm text-red-600">{error}</div>}
      {loading && (
        <>
          <aside className="space-y-2 md:sticky md:top-4 self-start">
            <div className="h-7 w-32 bg-stone-200 dark:bg-stone-700 rounded animate-pulse mb-4" />
            <nav className="flex flex-wrap md:flex-col gap-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-10 w-full bg-stone-200 dark:bg-stone-700 rounded-2xl animate-pulse" />
              ))}
            </nav>
          </aside>
          <main className="min-h-[60vh]">
            {tab === 'overview' && <OverviewSectionSkeleton />}
            {tab !== 'overview' && <div className="p-6 text-sm opacity-60">{t('gardenDashboard.loading')}</div>}
          </main>
        </>
      )}
      {!loading && garden && (
        <>
          <aside className="space-y-2 md:sticky md:top-4 self-start">
            <div className="text-xl font-semibold">{garden.name}</div>
            <nav className="flex flex-wrap md:flex-col gap-2">
              {([
                ['overview', t('gardenDashboard.overview')],
                ['plants', t('gardenDashboard.plants')],
                ['routine', t('gardenDashboard.routine')],
                ['settings', t('gardenDashboard.settings')],
              ] as Array<[TabKey, string]>).map(([k, label]) => (
                <Button key={k} asChild variant={tab === k ? 'default' : 'secondary'} className="rounded-2xl md:w-full">
                  <NavLink to={`/garden/${id}/${k}`} className="no-underline">{label}</NavLink>
                </Button>
              ))}
            </nav>
          </aside>
          <main className="min-h-[60vh]">
            <Routes>
              <Route path="overview" element={<OverviewSection gardenId={id!} activityRev={activityRev} plants={plants} membersCount={members.length} serverToday={serverToday} dailyStats={dailyStats} totalOnHand={totalOnHand} speciesOnHand={speciesOnHand} baseStreak={garden.streak || 0} />} />
              <Route path="plants" element={(
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="text-lg font-medium">{t('gardenDashboard.plantsSection.plantsInGarden')}</div>
                    <Button className="rounded-2xl" onClick={() => setAddOpen(true)}>{t('gardenDashboard.plantsSection.addPlant')}</Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {plants.map((gp: any, idx: number) => (
                      <Card key={gp.id} className={`rounded-2xl overflow-hidden relative ${dragIdx === idx ? 'ring-2 ring-black' : ''}`}
                        draggable
                        onDragStart={(e) => {
                          // Prevent drag when starting from interactive controls
                          const target = e.target as HTMLElement
                          if (target && target.closest('button, a, input, textarea, select, [role="menuitem"]')) {
                            e.preventDefault()
                            return
                          }
                          setDragIdx(idx)
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={async () => {
                          if (dragIdx === null || dragIdx === idx) return
                          const next = plants.slice()
                          const [moved] = next.splice(dragIdx, 1)
                          next.splice(idx, 0, moved)
                          setPlants(next)
                          setDragIdx(null)
                          try {
                            await updateGardenPlantsOrder({ gardenId: id!, orderedIds: next.map((p: any) => p.id) })
                            try {
                              const actorColorCss = getActorColorCss()
                              await logGardenActivity({ gardenId: id!, kind: 'note' as any, message: 'reordered plants', actorColor: actorColorCss || null })
                              setActivityRev((r) => r + 1)
                            } catch {}
                            emitGardenRealtime('plants')
                          } catch {}
                        }}
                      >
                        <div className="absolute top-2 right-2 z-10">
                          <button
                            onClick={(e: any) => { e.stopPropagation(); if (gp?.plant) navigate(`/plants/${gp.plant.id}`, { state: { backgroundLocation: location } }) }}
                            onMouseDown={(e: any) => e.stopPropagation()}
                            onTouchStart={(e: any) => e.stopPropagation()}
                            aria-label={t('gardenDashboard.plantsSection.moreInformation')}
                            className="h-8 w-8 rounded-full flex items-center justify-center shadow border bg-white/90 text-black hover:bg-white"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 items-stretch gap-0">
                          <div className="col-span-1 relative h-full min-h-[148px] rounded-l-2xl overflow-hidden bg-stone-100">
                            {gp.plant?.image ? (
                              <img
                                src={gp.plant.image}
                                alt={gp.nickname || gp.plant?.name || 'Plant'}
                                decoding="async"
                                loading="lazy"
                                className="absolute inset-0 h-full w-full object-cover object-center select-none"
                                draggable={false}
                              />
                            ) : null}
                          </div>
                          <div className="col-span-2 p-3">
                            <div className="font-medium">{gp.nickname || gp.plant?.name}</div>
                            {gp.nickname && <div className="text-xs opacity-60">{gp.plant?.name}</div>}
                            <div className="text-xs opacity-60">{t('gardenDashboard.plantsSection.onHand')} {Number(gp.plantsOnHand ?? 0)}</div>
                        <div className="text-xs opacity-60">{t('gardenDashboard.plantsSection.tasks')} {taskCountsByPlant[gp.id] || 0}</div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs opacity-60">{t('gardenDashboard.plantsSection.dueToday')} {taskOccDueToday[gp.id] || 0}</div>
                        </div>
                            <div className="mt-2 flex gap-2 flex-wrap">
                              <Button
                                variant="secondary"
                                className="rounded-2xl"
                                draggable={false}
                                onMouseDown={(e: any) => e.stopPropagation()}
                                onTouchStart={(e: any) => e.stopPropagation()}
                                onClick={() => { setPendingGardenPlantId(gp.id); setTaskOpen(true) }}
                              >
                                {t('gardenDashboard.plantsSection.tasksButton')}
                              </Button>
                              <EditPlantButton gp={gp} gardenId={id!} onChanged={load} serverToday={serverToday} actorColorCss={getActorColorCss()} />
                              <Button
                                variant="secondary"
                                className="rounded-2xl"
                                draggable={false}
                                onMouseDown={(e: any) => e.stopPropagation()}
                                onTouchStart={(e: any) => e.stopPropagation()}
                                onClick={async () => {
                                await deleteGardenPlant(gp.id)
                                if (serverToday && id) {
                                  try {
                                    // Recompute success from occurrences only
                                    const today = serverToday
                                    const allTasks = await listGardenTasks(id)
                                    await resyncTaskOccurrencesForGarden(id, `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`)
                                    const occs = await listOccurrencesForTasks(allTasks.map(t => t.id), `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`)
                                    let due = 0, completed = 0
                                    for (const o of occs) {
                                      const req = Math.max(1, Number(o.requiredCount || 1))
                                      const comp = Math.min(req, Number(o.completedCount || 0))
                                      due += req
                                      completed += comp
                                    }
                                    const success = due === 0 ? true : (completed >= due)
                                    await upsertGardenTask({ gardenId: id, day: today, gardenPlantId: null, success })
                                  } catch {}
                                }
                                // Signal other UI (nav bars) to refresh notification badges
                                emitGardenRealtime('tasks')
                                try {
                                  const actorColorCss = getActorColorCss()
                                  await logGardenActivity({ gardenId: id!, kind: 'plant_deleted' as any, message: `deleted "${gp.nickname || gp.plant?.name || 'Plant'}"`, plantName: gp.nickname || gp.plant?.name || null, actorColor: actorColorCss || null })
                                  setActivityRev((r) => r + 1)
                                } catch {}
                                await load()
                                }}
                              >
                                {t('gardenDashboard.plantsSection.delete')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                  {plants.length === 0 && (
                    <div className="p-10 text-center opacity-60 text-sm">
                      {t('gardenDashboard.plantsSection.noPlantsYet')}
                    </div>
                  )}
                </div>
              )} />
              {/* Routine route kept for weekly chart; item rows show completers instead of button */}
              <Route path="routine" element={<RoutineSection plants={plants} duePlantIds={dueToday} onLogWater={logWater} weekDays={weekDays} weekCounts={weekCounts} weekCountsByType={weekCountsByType} serverToday={serverToday} dueThisWeekByPlant={dueThisWeekByPlant} todayTaskOccurrences={todayTaskOccurrences} onProgressOccurrence={progressOccurrenceHandler} progressingOccIds={progressingOccIds} completingPlantIds={completingPlantIds} completeAllTodayForPlant={completeAllTodayForPlant} />} />
              <Route path="settings" element={(
                <div className="space-y-6">
                  {garden && (
                    <Card className="rounded-2xl p-4 bg-muted/50">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{t('garden.created')} {new Date(garden.createdAt).toLocaleDateString()}</span>
                      </div>
                    </Card>
                  )}
                  <div className="space-y-3">
                    <div className="text-lg font-medium">{t('gardenDashboard.settingsSection.gardenDetails')}</div>
                    <Card className="rounded-2xl p-4">
                      <GardenDetailsEditor garden={garden} onSaved={load} canEdit={viewerIsOwner} />
                    </Card>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-medium">{t('gardenDashboard.settingsSection.manageMembers')}</div>
                      <Button className="rounded-2xl" onClick={() => setInviteOpen(true)}>{t('gardenDashboard.settingsSection.addMember')}</Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {members.map(m => (
                        <MemberCard key={m.userId} member={m} gardenId={id!} onChanged={load} viewerIsOwner={viewerIsOwner} ownerCount={ownersCount} currentUserId={currentUserId} />
                      ))}
                    </div>
                  </div>
                  <div className="pt-2">
                    {isOwner ? (
                      <Button variant="destructive" className="rounded-2xl" onClick={async () => { if (!id) return; if (!confirm(t('gardenDashboard.settingsSection.deleteGardenConfirm'))) return; try { await supabase.from('gardens').delete().eq('id', id); navigate('/gardens') } catch (e) { alert(t('gardenDashboard.settingsSection.failedToDeleteGarden')) } }}>{t('gardenDashboard.settingsSection.deleteGarden')}</Button>
                    ) : (
                      <Button variant="destructive" className="rounded-2xl" onClick={async () => { if (!id || !currentUserId) return; if (!confirm(t('gardenDashboard.settingsSection.quitGardenConfirm'))) return; try { await removeGardenMember({ gardenId: id, userId: currentUserId }); navigate('/gardens') } catch (e) { alert(t('gardenDashboard.settingsSection.failedToQuitGarden')) } }}>{t('gardenDashboard.settingsSection.quitGarden')}</Button>
                    )}
                  </div>
                </div>
              )} />
              <Route path="" element={<Navigate to={`overview`} replace />} />
              <Route path="*" element={<Navigate to={`overview`} replace />} />
            </Routes>
          </main>
          
          {/* Tasks sidebar removed per requirement: tasks now on Garden list page */}

          {/* Add Plant Dialog */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>{t('gardenDashboard.plantsSection.addPlantToGarden')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder={t('gardenDashboard.plantsSection.searchPlants')} value={plantQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlantQuery(e.target.value)} />
                <div className="max-h-60 overflow-auto rounded-xl border border-stone-300 dark:border-[#3e3e42] bg-white dark:bg-[#252526]">
                  {plantResults.map(p => (
                    <button key={p.id} onClick={() => setSelectedPlant(p)} className={`w-full text-left px-3 py-2 hover:bg-stone-50 dark:hover:bg-[#2d2d30] ${selectedPlant?.id === p.id ? 'bg-stone-100 dark:bg-[#2d2d30]' : ''}`}>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs opacity-60">{p.scientificName}</div>
                    </button>
                  ))}
                  {plantQuery && plantResults.length === 0 && (
                    <div className="px-3 py-6 text-sm opacity-60">{t('gardenDashboard.plantsSection.noResults')}</div>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" className="rounded-2xl" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
                  <Button className="rounded-2xl" disabled={!selectedPlant || adding} onClick={addSelectedPlant}>{adding ? t('gardenDashboard.plantsSection.adding') : t('gardenDashboard.plantsSection.next')}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Plant Details Dialog */}
          <Dialog open={addDetailsOpen} onOpenChange={setAddDetailsOpen}>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>{t('gardenDashboard.plantsSection.addDetails')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">{t('gardenDashboard.plantsSection.customName')}</label>
                  <Input value={addNickname} maxLength={30} onChange={(e: any) => setAddNickname(e.target.value)} placeholder={t('gardenDashboard.plantsSection.optionalNickname')} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('gardenDashboard.plantsSection.numberOfFlowers')}</label>
                  <Input ref={countInputRef} autoFocus type="number" min={0} value={String(addCount)} onChange={(e: any) => setAddCount(Number(e.target.value))} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" className="rounded-2xl" onClick={() => setAddDetailsOpen(false)}>{t('gardenDashboard.plantsSection.back')}</Button>
                  <Button className="rounded-2xl" onClick={confirmAddSelectedPlant} disabled={!selectedPlant}>{t('gardenDashboard.plantsSection.add')}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Schedule Picker Dialog */}
          <SchedulePickerDialog
            open={scheduleOpen}
            onOpenChange={setScheduleOpen}
            period={(pendingPeriod as any) || 'week'}
            amount={pendingAmount || 1}
            onSave={handleSaveSchedule}
            initialSelection={initialSelectionState}
            onChangePeriod={(p) => setPendingPeriod(p)}
            onChangeAmount={(n) => setPendingAmount(n)}
            lockToYear={scheduleLockYear}
            allowedPeriods={scheduleAllowedPeriods as any}
          />

          {/* Task Editor Dialog */}
          <TaskEditorDialog
            open={taskOpen}
            onOpenChange={(o) => { setTaskOpen(o); if (!o) setPendingGardenPlantId(null) }}
            gardenId={id!}
            gardenPlantId={pendingGardenPlantId || ''}
            onChanged={async () => {
              // Ensure page reflects latest tasks after create/update/delete
              await load({ silent: true, preserveHeavy: true })
              // Always refresh heavy data so counts and badges update immediately
              await loadHeavyForCurrentTab(serverTodayRef.current ?? serverToday)
              // Notify global UI components (badges) to refresh
              try { window.dispatchEvent(new CustomEvent('garden:tasks_changed')) } catch {}
            }}
          />

          

          {/* Invite Dialog */}
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>{t('gardenDashboard.settingsSection.addMemberTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="relative">
                  <Input 
                    placeholder={t('gardenDashboard.settingsSection.enterDisplayNameOrEmail')} 
                    value={inviteAny} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setInviteAny(e.target.value)
                      setSuggestionsOpen(true)
                    }}
                    onFocus={() => {
                      if (friendSuggestions.length > 0) setSuggestionsOpen(true)
                    }}
                    onBlur={() => setTimeout(() => setSuggestionsOpen(false), 200)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setSuggestionsOpen(false)
                      }
                    }}
                  />
                  {suggestionsOpen && friendSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#252526] border border-stone-300 dark:border-[#3e3e42] rounded-xl shadow-lg max-h-60 overflow-auto">
                      {friendSuggestions.map((friend) => (
                        <button
                          key={friend.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-stone-50 dark:hover:bg-[#2d2d30] flex flex-col gap-1"
                          onClick={() => {
                            setInviteAny(friend.display_name || friend.email || '')
                            setSuggestionsOpen(false)
                          }}
                        >
                          <div className="font-medium">{friend.display_name || t('gardenDashboard.settingsSection.unknown')}</div>
                          {friend.email && (
                            <div className="text-xs opacity-60">{friend.email}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {inviteError && <div className="text-sm text-red-600">{inviteError}</div>}
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" className="rounded-2xl" onClick={() => {
                    setInviteOpen(false)
                    setInviteAny('')
                    setFriendSuggestions([])
                    setSuggestionsOpen(false)
                    setInviteError(null)
                  }}>{t('common.cancel')}</Button>
                  <Button className="rounded-2xl" onClick={submitInvite} disabled={!inviteAny.trim()}>{t('gardenDashboard.settingsSection.addMember')}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}

function RoutineSection({ plants, duePlantIds, onLogWater, weekDays, weekCounts, weekCountsByType, serverToday, dueThisWeekByPlant, todayTaskOccurrences, onProgressOccurrence, progressingOccIds, completingPlantIds, completeAllTodayForPlant }: { plants: any[]; duePlantIds: Set<string> | null; onLogWater: (id: string) => Promise<void>; weekDays: string[]; weekCounts: number[]; weekCountsByType: { water: number[]; fertilize: number[]; harvest: number[]; cut: number[]; custom: number[] }; serverToday: string | null; dueThisWeekByPlant: Record<string, number[]>; todayTaskOccurrences: Array<{ id: string; taskId: string; gardenPlantId: string; dueAt: string; requiredCount: number; completedCount: number; completedAt: string | null; taskType?: 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom' }>; onProgressOccurrence: (id: string, inc: number) => Promise<void>; progressingOccIds: Set<string>; completingPlantIds: Set<string>; completeAllTodayForPlant: (gardenPlantId: string) => Promise<void> }) {
  const { t } = useTranslation('common')
  const duePlants = React.useMemo(() => {
    if (!duePlantIds) return []
    return plants.filter((gp: any) => duePlantIds.has(gp.id))
  }, [plants, duePlantIds])
  const hasTodayTasks = (todayTaskOccurrences || []).length > 0
  const emptyPhrases = React.useMemo(() => t('gardenDashboard.routineSection.emptyPhrases', { returnObjects: true }) as string[], [t])
  const randomEmptyPhrase = React.useMemo(() => {
    const idx = Math.floor(Math.random() * emptyPhrases.length)
    return emptyPhrases[idx]
  }, [emptyPhrases])
  const maxCount = Math.max(1, ...weekCounts)
  const occsByPlant: Record<string, typeof todayTaskOccurrences> = {}
  for (const o of todayTaskOccurrences) {
    if (!occsByPlant[o.gardenPlantId]) occsByPlant[o.gardenPlantId] = [] as any
    occsByPlant[o.gardenPlantId].push(o)
  }
  // Fetch completions for done occurrences to display actor names
  const [completionsByOcc, setCompletionsByOcc] = React.useState<Record<string, Array<{ userId: string; displayName: string | null }>>>({})
  React.useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const doneOccIds = (todayTaskOccurrences || []).filter(o => (Number(o.completedCount || 0) >= Math.max(1, Number(o.requiredCount || 1)))).map(o => o.id)
        if (doneOccIds.length === 0) { if (!ignore) setCompletionsByOcc({}); return }
        const { listCompletionsForOccurrences } = await import('@/lib/gardens')
        const map = await listCompletionsForOccurrences(doneOccIds)
        if (!ignore) setCompletionsByOcc(map)
      } catch {}
    })()
    return () => { ignore = true }
  }, [todayTaskOccurrences])
  const typeToColor: Record<'water'|'fertilize'|'harvest'|'cut'|'custom', string> = {
    water: 'bg-blue-600 dark:bg-blue-500',
    fertilize: 'bg-green-600 dark:bg-green-500',
    harvest: 'bg-yellow-500 dark:bg-yellow-400',
    cut: 'bg-orange-600 dark:bg-orange-500',
    custom: 'bg-purple-600 dark:bg-purple-500',
  }
  const dayLabels = [t('gardenDashboard.routineSection.dayLabels.mon'), t('gardenDashboard.routineSection.dayLabels.tue'), t('gardenDashboard.routineSection.dayLabels.wed'), t('gardenDashboard.routineSection.dayLabels.thu'), t('gardenDashboard.routineSection.dayLabels.fri'), t('gardenDashboard.routineSection.dayLabels.sat'), t('gardenDashboard.routineSection.dayLabels.sun')]
  return (
    <div className="space-y-4">
      <div className="text-lg font-medium">{t('gardenDashboard.routineSection.thisWeek')}</div>
      <Card className="rounded-2xl p-4">
        <div className="text-sm opacity-60 mb-3">{t('gardenDashboard.routineSection.mondayToSunday')}</div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((ds, idx) => {
            const count = weekCounts[idx] || 0
            const heightPct = count === 0 ? 0 : Math.round((count / maxCount) * 100)
            const d = new Date(ds)
            const labels = dayLabels
            const isToday = serverToday === ds
            const water = weekCountsByType.water[idx] || 0
            const fert = weekCountsByType.fertilize[idx] || 0
            const harv = weekCountsByType.harvest[idx] || 0
            const cut = weekCountsByType.cut[idx] || 0
            const cust = weekCountsByType.custom[idx] || 0
            const segHeights = [
              heightPct === 0 ? 0 : Math.round(((water) / maxCount) * 100),
              heightPct === 0 ? 0 : Math.round(((fert) / maxCount) * 100),
              heightPct === 0 ? 0 : Math.round(((harv) / maxCount) * 100),
              heightPct === 0 ? 0 : Math.round(((cut) / maxCount) * 100),
              heightPct === 0 ? 0 : Math.round(((cust) / maxCount) * 100),
            ]
            return (
              <div key={ds} className="flex flex-col items-center justify-end gap-1 h-36">
                <div className="w-7 h-full bg-stone-300 rounded-md overflow-hidden flex flex-col justify-end">
                  {segHeights.map((h, i) => (
                    <div key={i} className={`${[typeToColor.water, typeToColor.fertilize, typeToColor.harvest, typeToColor.cut, typeToColor.custom][i]}`} style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className={`text-[11px] ${isToday ? 'underline' : 'opacity-70'}`}>{labels[idx]}</div>
                <div className="text-[10px] opacity-60">{count}</div>
              </div>
            )
          })}
        </div>
      </Card>
      <div className="flex justify-between items-center">
        <div className="text-base font-medium">{t('gardenDashboard.routineSection.today')}</div>
      </div>
      {hasTodayTasks ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plants.map((gp: any) => {
            const occs = occsByPlant[gp.id] || []
            const totalReq = occs.reduce((a, o) => a + Math.max(1, o.requiredCount || 1), 0)
            const totalDone = occs.reduce((a, o) => a + Math.min(Math.max(1, o.requiredCount || 1), o.completedCount || 0), 0)
            if (occs.length === 0) return null
            return (
              <Card key={gp.id} className="rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium">{gp.nickname || gp.plant?.name}</div>
                    {gp.nickname && <div className="text-xs opacity-60">{gp.plant?.name}</div>}
                  </div>
                  {totalDone < totalReq && (
                    <Button 
                      size="sm" 
                      className="rounded-xl" 
                      onClick={() => completeAllTodayForPlant(gp.id)}
                      disabled={completingPlantIds.has(gp.id)}
                    >
                      {completingPlantIds.has(gp.id) ? (
                        <span className="flex items-center gap-1">
                          <span className="animate-spin">⏳</span>
                          {t('garden.completing')}
                        </span>
                      ) : (
                        t('garden.completeAll')
                      )}
                    </Button>
                  )}
                </div>
                <div className="text-sm opacity-70">{t('gardenDashboard.routineSection.tasksDue')} {totalDone} / {totalReq}</div>
                <div className="mt-2 flex flex-col gap-2">
                  {occs.map((o) => {
                    const tt = (o as any).taskType || 'custom'
                    const badgeClass = `${typeToColor[tt]} ${tt === 'harvest' ? 'text-black' : 'text-white'}`
                    const taskEmoji = (o as any).taskEmoji
                    const icon = (taskEmoji && taskEmoji !== '??' && taskEmoji !== '???' && taskEmoji.trim() !== '') ? taskEmoji : (tt === 'water' ? '💧' : tt === 'fertilize' ? '🍽️' : tt === 'harvest' ? '🌾' : tt === 'cut' ? '✂️' : '🪴')
                    const isDone = (Number(o.completedCount || 0) >= Math.max(1, Number(o.requiredCount || 1)))
                    const completions = completionsByOcc[o.id] || []
                    return (
                      <div key={o.id} className={`flex items-center justify-between gap-3 text-sm rounded-xl border border-stone-300 dark:border-[#3e3e42] p-2 ${isDone ? 'bg-stone-50 dark:bg-[#2d2d30]' : 'bg-white dark:bg-[#252526]'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`h-6 w-6 flex items-center justify-center rounded-md border border-stone-300 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30]`}>{icon}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}>{t(`garden.taskTypes.${tt}`)}</span>
                        </div>
                        {!isDone ? (
                          <>
                            <div className="opacity-80 text-black dark:text-white">{o.completedCount} / {o.requiredCount}</div>
                            <Button 
                              className="rounded-xl" 
                              size="sm" 
                              onClick={() => onProgressOccurrence(o.id, 1)} 
                              disabled={(o.completedCount || 0) >= (o.requiredCount || 1) || progressingOccIds.has(o.id)}
                            >
                              {progressingOccIds.has(o.id) ? (
                                <span className="animate-spin">⏳</span>
                              ) : (
                                t('gardenDashboard.routineSection.completePlus1')
                              )}
                            </Button>
                          </>
                        ) : (
                          <div className="text-xs opacity-70 truncate max-w-[50%] text-black dark:text-white">
                            {completions.length === 0 ? t('gardenDashboard.routineSection.completed') : `${t('gardenDashboard.routineSection.doneBy')} ${completions.map(c => c.displayName || t('gardenDashboard.settingsSection.unknown')).join(', ')}`}
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
      ) : (
        <Card className="rounded-2xl p-6 text-center">
          <div className="text-base">{randomEmptyPhrase}</div>
        </Card>
      )}
      <div className="pt-2">
        <div className="text-base font-medium">{t('gardenDashboard.routineSection.dueThisWeek')}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plants.filter((gp: any) => (dueThisWeekByPlant[gp.id]?.length || 0) > 0 && !(duePlantIds?.has(gp.id))).map((gp: any) => (
          <Card key={gp.id} className="rounded-2xl p-4">
            <div className="font-medium">{gp.nickname || gp.plant?.name}</div>
            {gp.nickname && <div className="text-xs opacity-60">{gp.plant?.name}</div>}
            <div className="text-sm opacity-70">{t('gardenDashboard.routineSection.waterNeed')} {gp.plant?.care.water}</div>
            <div className="text-xs opacity-70">{t('gardenDashboard.routineSection.dueThisWeek')}: {dueThisWeekByPlant[gp.id]?.map((i) => dayLabels[i]).join(', ') || '-'}</div>
            <div className="mt-2 flex items-center gap-2">
              <Button className="rounded-2xl opacity-60" variant="secondary" disabled>{t('gardenDashboard.routineSection.upcoming')}</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}


function OverviewSection({ gardenId, activityRev, plants, membersCount, serverToday, dailyStats, totalOnHand, speciesOnHand, baseStreak }: { gardenId: string; activityRev?: number; plants: any[]; membersCount: number; serverToday: string | null; dailyStats: Array<{ date: string; due: number; completed: number; success: boolean }>; totalOnHand: number; speciesOnHand: number; baseStreak: number }) {
  const { t } = useTranslation('common')
  const [activity, setActivity] = React.useState<Array<{ id: string; actorName?: string | null; actorColor?: string | null; kind: string; message: string; plantName?: string | null; taskName?: string | null; occurredAt: string }>>([])
  const [loadingAct, setLoadingAct] = React.useState(false)
  const [errAct, setErrAct] = React.useState<string | null>(null)
  React.useEffect(() => {
    let ignore = false
    ;(async () => {
      if (!gardenId || !serverToday) return
      setLoadingAct(true)
      setErrAct(null)
      try {
        const rows = await listGardenActivityToday(gardenId, serverToday)
        if (!ignore) setActivity(rows)
      } catch (e: any) {
        if (!ignore) setErrAct(e?.message || t('gardenDashboard.overviewSection.failedToLoadActivity'))
      } finally {
        if (!ignore) setLoadingAct(false)
      }
    })()
    return () => { ignore = true }
  }, [gardenId, serverToday, activityRev])
  const totalToDoToday = dailyStats.find(d => d.date === (serverToday || ''))?.due ?? 0
  const completedToday = dailyStats.find(d => d.date === (serverToday || ''))?.completed ?? 0
  const progressPct = totalToDoToday === 0 ? 100 : Math.min(100, Math.round((completedToday / totalToDoToday) * 100))
  const anchor = serverToday ? new Date(serverToday) : new Date()
  
  // Compute max completed value to scale color intensity
  const maxCompleted = React.useMemo(() => 
    dailyStats.reduce((m, d) => Math.max(m, d.completed || 0), 0), 
    [dailyStats]
  )
  
  const colorForDay = (completed: number, success: boolean) => {
    // Grey: Tasks were not accomplished that day (tasks were due but not all completed)
    if (!success) return 'bg-stone-200 dark:bg-stone-700'
    // Green: Tasks were accomplished
    // Light mode: lighter color = fewer tasks, darker color = more tasks
    // Dark mode: darker color = fewer tasks, lighter color = more tasks
    if (maxCompleted <= 0) return 'bg-emerald-400 dark:bg-emerald-800'
    const ratio = completed / maxCompleted
    if (ratio <= 0) return 'bg-emerald-300 dark:bg-emerald-900'
    if (ratio <= 0.25) return 'bg-emerald-400 dark:bg-emerald-800'
    if (ratio <= 0.5) return 'bg-emerald-500 dark:bg-emerald-700'
    if (ratio <= 0.75) return 'bg-emerald-600 dark:bg-emerald-600'
    return 'bg-emerald-700 dark:bg-emerald-500'
  }
  
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(anchor)
    d.setDate(d.getDate() - (29 - i))
    const dateIso = d.toISOString().slice(0,10)
    const dayNum = d.getDate()
    // Treat missing task row as failed per requirement
    const found = dailyStats.find(x => x.date === dateIso)
    const success = found ? found.success : false
    const completed = found ? (found.completed || 0) : 0
    return { dayNum, isToday: i === 29, success, completed }
  })
  // Use DB-backed streak as base, but if today is in progress we can show live preview
  const streak = (() => {
    let s = baseStreak
    if (serverToday) {
      const today = dailyStats.find(d => d.date === serverToday)
      if (today && today.success) s = baseStreak + 1
    }
    return s
  })()
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl p-4">
          <div className="text-xs opacity-60">{t('gardenDashboard.overviewSection.plants')}</div>
          <div className="text-2xl font-semibold">{totalOnHand}</div>
          <div className="text-[11px] opacity-60">{t('gardenDashboard.overviewSection.species')} {speciesOnHand}</div>
        </Card>
        <Card className="rounded-2xl p-4">
          <div className="text-xs opacity-60">{t('gardenDashboard.overviewSection.members')}</div>
          <div className="flex items-center gap-2 mt-1">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <div className="text-2xl font-semibold">{membersCount}</div>
          </div>
        </Card>
        <Card className="rounded-2xl p-4">
          <div className="text-xs opacity-60">{t('gardenDashboard.overviewSection.streak')}</div>
          <div className="flex items-center gap-2 mt-1">
            <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
            </svg>
            <div className="text-2xl font-semibold">{streak} {t('gardenDashboard.overviewSection.days')}</div>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl p-4">
        <div className="font-medium mb-2">{t('gardenDashboard.overviewSection.todaysProgress')}</div>
        <div className="text-sm opacity-60 mb-2">{completedToday} / {totalToDoToday || 0} {t('gardenDashboard.overviewSection.tasksDone')}</div>
        <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
          <div className="h-3 bg-emerald-600 dark:bg-emerald-500" style={{ width: `${progressPct}%` }} />
        </div>
      </Card>

      <Card className="rounded-2xl p-4">
        <div className="font-medium mb-3">{t('gardenDashboard.overviewSection.last30Days')}</div>
        <div className="grid grid-cols-7 gap-x-3 gap-y-3 place-items-center">
          {days.map((d, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-md flex items-center justify-center ${colorForDay(d.completed, d.success)}`}>
                <div className="text-[11px]">{d.dayNum}</div>
              </div>
              {d.isToday && <div className="mt-1 h-0.5 w-5 bg-black dark:bg-white rounded-full" />}
            </div>
          ))}
        </div>
      </Card>

      {/* Activity (today) */}
      <Card className="rounded-2xl p-4">
        <div className="font-medium mb-2">{t('gardenDashboard.overviewSection.activityToday')}</div>
        {loadingAct && <div className="text-sm opacity-60">{t('gardenDashboard.overviewSection.loadingActivity')}</div>}
        {errAct && <div className="text-sm text-red-600">{errAct}</div>}
        {!loadingAct && activity.length === 0 && <div className="text-sm opacity-60">{t('gardenDashboard.overviewSection.noActivity')}</div>}
        <div className="space-y-2">
          {activity.map((a) => {
            const color = a.actorColor || null
            const ts = (() => {
              try {
                return new Date(a.occurredAt).toLocaleTimeString([], { hour12: false })
              } catch {
                return ''
              }
            })()
            return (
              <div key={a.id} className="text-sm flex items-start gap-2">
                {ts && <span className="text-xs opacity-60 tabular-nums">{ts}</span>}
                {ts && <span className="text-xs opacity-40">//</span>}
                <span className="font-semibold" style={color ? { color } : undefined}>{a.actorName || t('gardenDashboard.settingsSection.unknown')}</span>
                <span className="opacity-80">{a.message}</span>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function colorForName(name?: string | null, colorToken?: string | null): string {
  if (colorToken && /^text-/.test(colorToken)) return colorToken
  const colors = ['text-emerald-700','text-blue-700','text-indigo-700','text-rose-700','text-amber-700','text-purple-700','text-teal-700']
  if (!name || name.length === 0) return colors[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return colors[hash % colors.length]
}

function EditPlantButton({ gp, gardenId, onChanged, serverToday, actorColorCss }: { gp: any; gardenId: string; onChanged: () => Promise<void>; serverToday: string | null; actorColorCss?: string | null }) {
  const { t } = useTranslation('common')
  const [open, setOpen] = React.useState(false)
  const [nickname, setNickname] = React.useState(gp.nickname || '')
  const [count, setCount] = React.useState<number>(Number(gp.plantsOnHand ?? 0))
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    setNickname(gp.nickname || '')
  }, [gp.nickname])

  React.useEffect(() => { setCount(Number(gp.plantsOnHand ?? 0)) }, [gp.plantsOnHand])

  const save = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      // Update nickname & per-instance count; delete plant if count becomes 0
      await supabase.from('garden_plants').update({ nickname: nickname.trim() || null, plants_on_hand: Math.max(0, Number(count || 0)) }).eq('id', gp.id)
      if (count <= 0) {
        await supabase.from('garden_plants').delete().eq('id', gp.id)
        if (serverToday) await ensureDailyTasksForGardens(serverToday)
        try {
          await logGardenActivity({ gardenId, kind: 'plant_deleted' as any, message: `deleted "${gp.nickname || gp.plant?.name || 'Plant'}"`, plantName: gp.nickname || gp.plant?.name || null, actorColor: actorColorCss || null })
        } catch {}
      }
      // If name or count changed, log update
      try {
        const changedName = (gp.nickname || '') !== (nickname.trim() || '')
        const changedCount = Number(gp.plantsOnHand || 0) !== Math.max(0, Number(count || 0))
        if (changedName || changedCount) {
          const parts: string[] = []
          if (changedName) parts.push(`name: "${nickname.trim() || '-'}"`)
          if (changedCount) parts.push(`count: ${Math.max(0, Number(count || 0))}`)
          const plantName = nickname.trim() || gp.nickname || gp.plant?.name || 'Plant'
          await logGardenActivity({ gardenId, kind: 'plant_updated' as any, message: `updated ${plantName}: ${parts.join(', ')}`, plantName, actorColor: actorColorCss || null })
        }
      } catch {}
      await onChanged()
      setOpen(false)
    } catch (e) {
      // swallow; page has global error area
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button variant="secondary" className="rounded-2xl" onClick={() => setOpen(true)}>{t('gardenDashboard.taskDialog.edit')}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('gardenDashboard.plantsSection.editPlant')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t('gardenDashboard.plantsSection.customName')}</label>
              <Input value={nickname} maxLength={30} onChange={(e: any) => setNickname(e.target.value)} placeholder={t('gardenDashboard.plantsSection.optionalNickname')} />
            </div>
            <div>
              <label className="text-sm font-medium">{t('gardenDashboard.plantsSection.numberOfPlants')}</label>
              <Input type="number" min={0} value={String(count)} onChange={(e: any) => setCount(Number(e.target.value))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" className="rounded-2xl" onClick={() => setOpen(false)}>{t('cancel')}</Button>
              <Button className="rounded-2xl" onClick={save} disabled={submitting}>{submitting ? t('gardenDashboard.settingsSection.saving') : t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MemberCard({ member, gardenId, onChanged, viewerIsOwner, ownerCount, currentUserId }: { member: { userId: string; displayName?: string | null; email?: string | null; joinedAt?: string | null; role: 'owner' | 'member'; accentKey?: string | null }; gardenId: string; onChanged: () => Promise<void>; viewerIsOwner: boolean; ownerCount: number; currentUserId: string | null }) {
  const { t } = useTranslation('common')
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const isSelf = !!currentUserId && currentUserId === member.userId
  const canPromote = viewerIsOwner && member.role !== 'owner'
  // Owners can remove members; for owners, allow demote only when multiple owners exist
  const canRemove = viewerIsOwner && (member.role !== 'owner')
  const canDemoteOwner = viewerIsOwner && member.role === 'owner' && ownerCount > 1 && !isSelf
  const navigate = useLanguageNavigate()
  const doPromote = async () => {
    if (!canPromote || busy) return
    setBusy(true)
    try {
      await updateGardenMemberRole({ gardenId, userId: member.userId, role: 'owner' })
      try { await logGardenActivity({ gardenId, kind: 'note' as any, message: `promoted ${member.displayName || 'a member'} to owner`, actorColor: null }) } catch {}
      await onChanged()
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }
  const doDemote = async () => {
    if (!canDemoteOwner || busy) return
    // If this is the last owner, our DB trigger will delete the garden; warn accordingly
    if (!confirm(ownerCount <= 1 ? 'This is the last owner. This will delete the garden. Continue?' : 'Demote this owner to member?')) return
    setBusy(true)
    try {
      await updateGardenMemberRole({ gardenId, userId: member.userId, role: 'member' })
      try { await logGardenActivity({ gardenId, kind: 'note' as any, message: `demoted ${member.displayName || 'an owner'} to member`, actorColor: null }) } catch {}
      await onChanged()
    } catch (e) {
      // swallow; page has global error
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }
  const doRemove = async () => {
    if (busy) return
    if (!confirm('Remove this member from the garden?')) return
    setBusy(true)
    try {
      await removeGardenMember({ gardenId, userId: member.userId })
      try { await logGardenActivity({ gardenId, kind: 'note' as any, message: `removed ${member.displayName || 'a member'}`, actorColor: null }) } catch {}
      await onChanged()
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }
  return (
    <Card className="rounded-2xl p-4 relative">
      {/* Top-right actions: profile arrow + menu, same size and alignment */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        {member.displayName && (
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full h-8 w-8"
            aria-label="View profile"
            onClick={(e) => { e.stopPropagation(); navigate(`/u/${encodeURIComponent(member.displayName!)}`) }}
          >
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        )}
        {viewerIsOwner && !isSelf && (
          <div className="relative">
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full h-8 w-8"
              onClick={(e: any) => { e.stopPropagation(); setOpen((o) => !o) }}
              aria-label="Open member actions"
            >
              ?
            </Button>
            {open && (
              <div className="absolute right-0 mt-2 w-48 bg-white border rounded-xl shadow-lg z-10">
                {member.role !== 'owner' && (
                  <button disabled={!canPromote || busy} onClick={(e) => { e.stopPropagation(); doPromote() }} className={`w-full text-left px-3 py-2 hover:bg-stone-50 ${!canPromote ? 'opacity-60 cursor-not-allowed' : ''}`}>{t('gardenDashboard.settingsSection.promoteToOwner')}</button>
                )}
                {member.role === 'owner' && (
                  <button disabled={!canDemoteOwner || busy} onClick={(e) => { e.stopPropagation(); doDemote() }} className={`w-full text-left px-3 py-2 hover:bg-stone-50 ${!canDemoteOwner ? 'opacity-60 cursor-not-allowed' : ''}`}>{t('gardenDashboard.settingsSection.demoteToMember')}</button>
                )}
                {member.role !== 'owner' && (
                  <button disabled={!canRemove || busy} onClick={(e) => { e.stopPropagation(); doRemove() }} className="w-full text-left px-3 py-2 hover:bg-stone-50 text-red-600">{t('gardenDashboard.settingsSection.removeMember')}</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-start gap-3">
        <div>
          <div className="font-medium max-w-[60vw] truncate" style={member.accentKey ? (() => { const opt = getAccentOption(member.accentKey as any); return opt ? { color: `hsl(${opt.hsl})` } : undefined })() : undefined}>{member.displayName || member.userId}</div>
          {member.email && <div className="text-xs opacity-60">{member.email}</div>}
          <div className="text-xs opacity-60">{member.role === 'owner' ? t('gardenDashboard.settingsSection.owner') : t('gardenDashboard.settingsSection.member')}{member.joinedAt ? ` • ${t('gardenDashboard.settingsSection.joined')} ${new Date(member.joinedAt).toLocaleString()}` : ''}</div>
        </div>
      </div>
      {/* Self actions for non-owners: Quit button */}
      {isSelf && member.role !== 'owner' && (
        <div className="mt-3 flex justify-end">
          <Button
            variant="destructive"
            className="rounded-2xl"
            onClick={async (e: any) => {
              e.stopPropagation()
              if (!confirm(t('gardenDashboard.settingsSection.quitGardenConfirm'))) return
              try {
                await removeGardenMember({ gardenId, userId: member.userId })
                navigate('/gardens')
              } catch {}
            }}
          >{t('gardenDashboard.settingsSection.quit')}</Button>
        </div>
      )}
    </Card>
  )
}

function GardenDetailsEditor({ garden, onSaved, canEdit }: { garden: Garden; onSaved: () => Promise<void>; canEdit?: boolean }) {
  const { t } = useTranslation('common')
  const [name, setName] = React.useState(garden.name)
  const [imageUrl, setImageUrl] = React.useState(garden.coverImageUrl || '')
  const [submitting, setSubmitting] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const save = async () => {
    if (submitting) return
    if (!canEdit) return
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('gardens')
        .update({ name: name.trim() || garden.name, cover_image_url: imageUrl.trim() || null })
        .eq('id', garden.id)
      if (error) {
        setErr(error.message || 'Failed to save garden')
        return
      }
      setErr(null)
      // Log garden details update so other clients refresh via SSE
      try {
        const changedName = (garden.name || '') !== (name.trim() || '')
        const changedCover = (garden.coverImageUrl || '') !== (imageUrl.trim() || '')
        const parts: string[] = []
        if (changedName) parts.push(`name: "${name.trim() || '-'}"`)
        if (changedCover) parts.push('cover image updated')
        if (parts.length > 0) {
          await logGardenActivity({ gardenId: garden.id, kind: 'note' as any, message: `updated garden: ${parts.join(', ')}`, actorColor: null })
        }
      } catch {}
      await onSaved()
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">{t('gardenDashboard.settingsSection.gardenName')}</label>
        <Input value={name} onChange={(e: any) => setName(e.target.value)} disabled={!canEdit} />
      </div>
      <div>
        <label className="text-sm font-medium">{t('gardenDashboard.settingsSection.coverImageUrl')}</label>
        <Input value={imageUrl} onChange={(e: any) => setImageUrl(e.target.value)} placeholder="https://?" disabled={!canEdit} />
      </div>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <Button className="rounded-2xl" onClick={save} disabled={submitting || !canEdit}>{submitting ? t('gardenDashboard.settingsSection.saving') : t('gardenDashboard.settingsSection.saveChanges')}</Button>
      </div>
    </div>
  )
}

