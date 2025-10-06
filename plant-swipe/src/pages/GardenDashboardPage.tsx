// @ts-nocheck
import React from 'react'
import { useAuth } from '@/context/AuthContext'
import { useParams, NavLink, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { PlantDetails } from '@/components/plant/PlantDetails'
import { Info } from 'lucide-react'
import { SchedulePickerDialog } from '@/components/plant/SchedulePickerDialog'
import { TaskEditorDialog } from '@/components/plant/TaskEditorDialog'
import type { Garden } from '@/types/garden'
import type { Plant } from '@/types/plant'
import { getGarden, getGardenPlants, getGardenMembers, addMemberByEmail, deleteGardenPlant, addPlantToGarden, fetchServerNowISO, upsertGardenTask, getGardenTasks, ensureDailyTasksForGardens, upsertGardenPlantSchedule, getGardenPlantSchedule, getGardenInventory, adjustInventoryAndLogTransaction, updateGardenMemberRole, removeGardenMember, listGardenTasks, syncTaskOccurrencesForGarden, listOccurrencesForTasks, progressTaskOccurrence, updateGardenPlantsOrder, refreshGardenStreak } from '@/lib/gardens'
import { supabase } from '@/lib/supabaseClient'
 


type TabKey = 'overview' | 'plants' | 'routine' | 'settings'

export const GardenDashboardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, refreshProfile } = useAuth()
  const [garden, setGarden] = React.useState<Garden | null>(null)
  const [tab, setTab] = React.useState<TabKey>('overview')
  // derive tab from URL path segment after /garden/:id
  React.useEffect(() => {
    const base = `/garden/${id || ''}`
    const rest = location.pathname.startsWith(base) ? location.pathname.slice(base.length) : ''
    const seg = rest.replace(/^\//, '').split('/')[0] as TabKey
    setTab((seg as TabKey) || 'overview')
  }, [location.pathname, id])
  const [plants, setPlants] = React.useState<Array<any>>([])
  const [members, setMembers] = React.useState<Array<{ userId: string; displayName?: string | null; role: 'owner' | 'member' }>>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [serverToday, setServerToday] = React.useState<string | null>(null)
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
  const [scheduleLockYear, setScheduleLockYear] = React.useState<boolean>(false)
  const [scheduleAllowedPeriods, setScheduleAllowedPeriods] = React.useState<Array<'week'|'month'|'year'> | undefined>(undefined)
  const [dragIdx, setDragIdx] = React.useState<number | null>(null)

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
  const [inviteEmail, setInviteEmail] = React.useState('')
  const [inviteError, setInviteError] = React.useState<string | null>(null)

  const currentUserId = user?.id || null
  const isOwner = React.useMemo(() => {
    if (!currentUserId) return false
    const self = members.find(m => m.userId === currentUserId)
    return self?.role === 'owner'
  }, [members, currentUserId])

  const load = React.useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const g0 = await getGarden(id)
      setGarden(g0)
      const gps = await getGardenPlants(id)
      setPlants(gps)
      const ms = await getGardenMembers(id)
      setMembers(ms.map(m => ({ userId: m.userId, displayName: m.displayName ?? null, role: m.role })))
      const nowIso = await fetchServerNowISO()
      const today = nowIso.slice(0,10)
      setServerToday(today)
      // Ensure base streak is refreshed from server on reload
      try {
        await refreshGardenStreak(id, new Date(new Date(today).getTime() - 24*3600*1000).toISOString().slice(0,10))
        const g1 = await getGarden(id)
        setGarden(g1)
      } catch {}
      // Do not recompute today's task here to avoid overriding recent actions; rely on action-specific updates
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      const startIso = start.toISOString().slice(0,10)
      const taskRows = await getGardenTasks(id, startIso, today)
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

      // ===== Generic tasks (v2) =====
      // Ensure occurrences exist in our 30-day window, then load today's per-plant due counts
      const endWindow = new Date(today)
      endWindow.setDate(endWindow.getDate() + 30)
      await syncTaskOccurrencesForGarden(id, startIso, endWindow.toISOString())
      const allTasks = await listGardenTasks(id)
      const occs = await listOccurrencesForTasks(allTasks.map(t => t.id), `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`)
      // Annotate today's occurrences with task type and emoji for UI rendering
      const taskTypeById: Record<string, 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'> = {}
      const taskEmojiById: Record<string, string | null> = {}
      for (const t of allTasks) {
        taskTypeById[t.id] = t.type as any
        taskEmojiById[t.id] = (t as any).emoji || null
      }
      const occsWithType = occs.map(o => ({ ...o, taskType: taskTypeById[o.taskId] || 'custom', taskEmoji: taskEmojiById[o.taskId] || null }))
      setTodayTaskOccurrences(occsWithType as any)
      const taskCountMap: Record<string, number> = {}
      for (const t of allTasks) {
        taskCountMap[t.gardenPlantId] = (taskCountMap[t.gardenPlantId] || 0) + 1
      }
      setTaskCountsByPlant(taskCountMap)
      const dueMap: Record<string, number> = {}
      for (const o of occs) {
        const remaining = Math.max(0, (o.requiredCount || 1) - (o.completedCount || 0))
        if (remaining > 0) dueMap[o.gardenPlantId] = (dueMap[o.gardenPlantId] || 0) + remaining
      }
      setTaskOccDueToday(dueMap)

      // Build current-week counts from generic task occurrences (includes water, fertilize, harvest, custom)
      if (weekDaysIso.length === 7) {
        const weekStart = `${weekDaysIso[0]}T00:00:00.000Z`
        const weekEnd = `${weekDaysIso[6]}T23:59:59.999Z`
        const weekOccs = await listOccurrencesForTasks(allTasks.map(t => t.id), weekStart, weekEnd)
        const typeCounts: { water: number[]; fertilize: number[]; harvest: number[]; cut: number[]; custom: number[] } = {
          water: Array(7).fill(0),
          fertilize: Array(7).fill(0),
          harvest: Array(7).fill(0),
          cut: Array(7).fill(0),
          custom: Array(7).fill(0),
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
      }

      // Determine due-today plants from task occurrences
      const dueTodaySet = new Set<string>()
      for (const o of occs) {
        const remaining = Math.max(0, (o.requiredCount || 1) - (o.completedCount || 0))
        if (remaining > 0) dueTodaySet.add(o.gardenPlantId)
      }
      setDueToday(dueTodaySet)


      // Load inventory counts for display
      // Compute per-instance counts and totals from garden_plants instances, not species-level inventory
      const perInstanceCounts: Record<string, number> = {}
      let total = 0
      let species = 0
      const seenSpecies = new Set<string>()
      for (const gp of gps as any[]) {
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
      // Build last-30-days stats from generic task occurrences
      const statsStart = new Date(today)
      statsStart.setDate(statsStart.getDate() - 29)
      const statsStartIso = statsStart.toISOString().slice(0,10)
      const statsEnd = new Date(today)
      const statsOccs = await listOccurrencesForTasks(allTasks.map(t => t.id), `${statsStartIso}T00:00:00.000Z`, `${statsEnd.toISOString().slice(0,10)}T23:59:59.999Z`)
      const dayAgg: Record<string, { due: number; completed: number }> = {}
      for (const o of statsOccs) {
        const day = new Date(o.dueAt).toISOString().slice(0,10)
        const req = Math.max(1, Number(o.requiredCount || 1))
        const comp = Math.min(req, Number(o.completedCount || 0))
        if (!dayAgg[day]) dayAgg[day] = { due: 0, completed: 0 }
        dayAgg[day].due += req
        dayAgg[day].completed += comp
      }
      const days: Array<{ date: string; due: number; completed: number; success: boolean }> = []
      const anchor30 = new Date(today)
      for (let i = 29; i >= 0; i--) {
        const d = new Date(anchor30)
        d.setDate(d.getDate() - i)
        const ds = d.toISOString().slice(0,10)
        const entry = dayAgg[ds] || { due: 0, completed: 0 }
        // Do not count days before the garden was created as successful
        const createdDayIso = (() => { try { return new Date((g as any).createdAt).toISOString().slice(0,10) } catch { return null } })()
        const beforeCreation = createdDayIso ? (ds < createdDayIso) : false
        const success = beforeCreation ? false : (entry.due > 0 ? (entry.completed >= entry.due) : true)
        days.push({ date: ds, due: entry.due, completed: entry.completed, success })
      }
      setDailyStats(days)
    } catch (e: any) {
      setError(e?.message || 'Failed to load garden')
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => { load() }, [load])

  const viewerIsOwner = React.useMemo(() => {
    if (!user?.id) return false
    return members.some(m => m.userId === user.id && m.role === 'owner')
  }, [members, user?.id])

  React.useEffect(() => {
    let ignore = false
    if (!plantQuery.trim()) { setPlantResults([]); return }
    ;(async () => {
      const { data, error } = await supabase
        .from('plants')
        .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, care_sunlight, care_water, care_soil, care_difficulty, seeds_available, water_freq_unit, water_freq_value, water_freq_period, water_freq_amount')
        .ilike('name', `%${plantQuery}%`)
        .limit(10)
      if (!error && !ignore) {
        const res: Plant[] = (data || []).map((p: any) => ({
          id: String(p.id),
          name: p.name,
          scientificName: p.scientific_name || '',
          colors: Array.isArray(p.colors) ? p.colors.map(String) : [],
          seasons: Array.isArray(p.seasons) ? p.seasons.map(String) as any : [],
          rarity: p.rarity,
          meaning: p.meaning || '',
          description: p.description || '',
          image: p.image_url || '',
          care: { sunlight: p.care_sunlight || 'Low', water: p.care_water || 'Low', soil: p.care_soil || '', difficulty: p.care_difficulty || 'Easy' },
          seedsAvailable: Boolean(p.seeds_available ?? false),
          waterFreqUnit: p.water_freq_unit || undefined,
          waterFreqValue: p.water_freq_value ?? null,
          waterFreqPeriod: p.water_freq_period || undefined,
          waterFreqAmount: p.water_freq_amount ?? null,
        }))
        setPlantResults(res)
      }
    })()
    return () => { ignore = true }
  }, [plantQuery])

  const submitInvite = async () => {
    if (!id || !inviteEmail.trim()) return
    setInviteError(null)
    const res = await addMemberByEmail({ gardenId: id, email: inviteEmail.trim(), role: 'member' })
    if (!res.ok) {
      setInviteError(res.reason === 'no_account' ? 'No account with this email' : 'Failed to add member')
      return
    }
    setInviteOpen(false)
    setInviteEmail('')
    await load()
  }

  const addSelectedPlant = async () => {
    if (!id || !selectedPlant || adding) return
    setAdding(true)
    try {
      // Open details modal to capture count and nickname
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
      const nicknameVal = addNickname.trim().length > 0 ? addNickname.trim() : null
      const qty = Math.max(0, Number(addCount || 0))
      // Create a new instance and set its own count; do not merge into species inventory
      const gp = await addPlantToGarden({ gardenId: id, plantId: selectedPlant.id, seedsPlanted: 0, nickname: nicknameVal || undefined })
      if (qty > 0) {
        await supabase.from('garden_plants').update({ plants_on_hand: qty }).eq('id', gp.id)
      }
      setAddDetailsOpen(false)
      setAddNickname('')
      setAddCount(1)
      setAddOpen(false)
      setSelectedPlant(null)
      setPlantQuery('')
      // Open Tasks with default watering 2x (user can change unit)
      setPendingGardenPlantId(gp.id)
      setTaskOpen(true)
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
      if (serverToday && garden?.id) {
        // Recompute today's task for this garden to reflect new schedule
        await computeGardenTaskForDay({ gardenId: garden.id, dayIso: serverToday })
      }
      await load()
      if (id) navigate(`/garden/${id}/plants`)
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
          await syncTaskOccurrencesForGarden(garden.id, `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`)
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
        } catch {}
      }
      await load()
      if (id) navigate(`/garden/${id}/routine`)
    } catch (e: any) {
      setError(e?.message || 'Failed to log watering')
    }
  }

  const completeAllTodayForPlant = async (gardenPlantId: string) => {
    try {
      const occs = todayTaskOccurrences.filter(o => o.gardenPlantId === gardenPlantId)
      const ops: Promise<any>[] = []
      for (const o of occs) {
        const remaining = Math.max(0, (Number(o.requiredCount || 1)) - Number(o.completedCount || 0))
        if (remaining > 0) ops.push(progressTaskOccurrence(o.id, remaining))
      }
      if (ops.length > 0) await Promise.all(ops)
      await load()
    } catch (e) {
      // swallow; global error display exists
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

  return (
    <div className="max-w-6xl mx-auto mt-6 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
      {loading && <div className="p-6 text-sm opacity-60">Loading…</div>}
      {error && <div className="p-6 text-sm text-red-600">{error}</div>}
      {!loading && garden && (
        <>
          <aside className="space-y-2 lg:sticky lg:top-4 self-start">
            <div className="text-xl font-semibold">{garden.name}</div>
            <nav className="flex lg:flex-col gap-2">
              {([
                ['overview','Overview'],
                ['plants','Plants'],
                ['routine','Routine'],
                ['settings','Settings'],
              ] as Array<[TabKey, string]>).map(([k, label]) => (
                <Button key={k} asChild variant={tab === k ? 'default' : 'secondary'} className="rounded-2xl">
                  <NavLink to={`/garden/${id}/${k}`} className="no-underline">{label}</NavLink>
                </Button>
              ))}
            </nav>
          </aside>
          <main className="min-h-[60vh]">
            <Routes>
              <Route path="overview" element={<OverviewSection plants={plants} membersCount={members.length} serverToday={serverToday} dailyStats={dailyStats} totalOnHand={totalOnHand} speciesOnHand={speciesOnHand} baseStreak={garden.streak || 0} />} />
              <Route path="plants" element={(
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="text-lg font-medium">Plants in this garden</div>
                    <Button className="rounded-2xl" onClick={() => setAddOpen(true)}>Add Plant</Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {plants.map((gp: any, idx: number) => (
                      <Card key={gp.id} className={`rounded-2xl overflow-hidden relative ${dragIdx === idx ? 'ring-2 ring-black' : ''}`}
                        draggable
                        onDragStart={() => setDragIdx(idx)}
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
                          } catch {}
                        }}
                      >
                        <div className="absolute top-2 right-2 z-10">
                          <button
                            onClick={(e: any) => { e.stopPropagation(); if (gp?.plant) navigate(`/plants/${gp.plant.id}`, { state: { backgroundLocation: location } }) }}
                            onMouseDown={(e: any) => e.stopPropagation()}
                            onTouchStart={(e: any) => e.stopPropagation()}
                            aria-label="More information"
                            className="h-8 w-8 rounded-full flex items-center justify-center shadow border bg-white/90 text-black hover:bg-white"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 items-stretch gap-0">
                          <div className="col-span-1 h-full min-h-[148px] rounded-l-2xl overflow-hidden bg-stone-100">
                            {gp.plant?.image ? (
                              <img
                                src={gp.plant.image}
                                alt={gp.nickname || gp.plant?.name || 'Plant'}
                                className="h-full w-full object-cover object-center select-none"
                                draggable={false}
                              />
                            ) : null}
                          </div>
                          <div className="col-span-2 p-3">
                            <div className="font-medium">{gp.nickname || gp.plant?.name}</div>
                            {gp.nickname && <div className="text-xs opacity-60">{gp.plant?.name}</div>}
                            <div className="text-xs opacity-60">On hand: {Number(gp.plantsOnHand ?? 0)}</div>
                        <div className="text-xs opacity-60">Tasks: {taskCountsByPlant[gp.id] || 0}</div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs opacity-60">Due today: {taskOccDueToday[gp.id] || 0}</div>
                          {(taskOccDueToday[gp.id] || 0) > 0 && (
                            <Button size="sm" className="rounded-xl" onClick={() => completeAllTodayForPlant(gp.id)}>Complete all</Button>
                          )}
                        </div>
                            <div className="mt-2 flex gap-2 flex-wrap">
                              <Button variant="secondary" className="rounded-2xl" onClick={() => { setPendingGardenPlantId(gp.id); setTaskOpen(true) }}>Tasks</Button>
                              <EditPlantButton gp={gp} gardenId={id!} onChanged={load} serverToday={serverToday} />
                              <Button variant="secondary" className="rounded-2xl" onClick={async () => {
                                await deleteGardenPlant(gp.id)
                                if (serverToday && id) {
                                  try {
                                    // Recompute success from occurrences only
                                    const today = serverToday
                                    const allTasks = await listGardenTasks(id)
                                    await syncTaskOccurrencesForGarden(id, `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`)
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
                                await load()
                              }}>Delete</Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                  {plants.length === 0 && (
                    <div className="p-10 text-center opacity-60 text-sm">
                      No plants yet. Add your first plant to get started.
                    </div>
                  )}
                </div>
              )} />
              <Route path="routine" element={<RoutineSection plants={plants} duePlantIds={dueToday} onLogWater={logWater} weekDays={weekDays} weekCounts={weekCounts} weekCountsByType={weekCountsByType} serverToday={serverToday} dueThisWeekByPlant={dueThisWeekByPlant} todayTaskOccurrences={todayTaskOccurrences} onProgressOccurrence={async (occId: string, inc: number) => { await progressTaskOccurrence(occId, inc); await load() }} />} />
              <Route path="settings" element={(
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="text-lg font-medium">Garden details</div>
                    <Card className="rounded-2xl p-4">
                      <GardenDetailsEditor garden={garden} onSaved={load} canEdit={viewerIsOwner} />
                    </Card>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-medium">Manage members</div>
                      <Button className="rounded-2xl" onClick={() => setInviteOpen(true)}>Add member</Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {members.map(m => (
                        <MemberCard key={m.userId} member={m} gardenId={id!} onChanged={load} viewerIsOwner={viewerIsOwner} />
                      ))}
                    </div>
                  </div>
                  <div className="pt-2">
                    {isOwner ? (
                      <Button variant="destructive" className="rounded-2xl" onClick={async () => { if (!id) return; if (!confirm('Delete this garden? This cannot be undone.')) return; try { await supabase.from('gardens').delete().eq('id', id); window.location.href = '/gardens' } catch (e) { alert('Failed to delete garden') } }}>Delete garden</Button>
                    ) : (
                      <Button variant="destructive" className="rounded-2xl" onClick={async () => { if (!id || !currentUserId) return; if (!confirm('Quit this garden? You will be removed as a member.')) return; try { await removeGardenMember({ gardenId: id, userId: currentUserId }); window.location.href = '/gardens' } catch (e) { alert('Failed to quit garden') } }}>Quit garden</Button>
                    )}
                  </div>
                </div>
              )} />
              <Route path="" element={<Navigate to={`overview`} replace />} />
              <Route path="*" element={<Navigate to={`overview`} replace />} />
            </Routes>
          </main>

          {/* Add Plant Dialog */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Add plant to garden</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Search plants by name…" value={plantQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlantQuery(e.target.value)} />
                <div className="max-h-60 overflow-auto rounded-xl border">
                  {plantResults.map(p => (
                    <button key={p.id} onClick={() => setSelectedPlant(p)} className={`w-full text-left px-3 py-2 hover:bg-stone-50 ${selectedPlant?.id === p.id ? 'bg-stone-100' : ''}`}>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs opacity-60">{p.scientificName}</div>
                    </button>
                  ))}
                  {plantQuery && plantResults.length === 0 && (
                    <div className="px-3 py-6 text-sm opacity-60">No results</div>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" className="rounded-2xl" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button className="rounded-2xl" disabled={!selectedPlant || adding} onClick={addSelectedPlant}>{adding ? 'Adding…' : 'Next'}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Plant Details Dialog */}
          <Dialog open={addDetailsOpen} onOpenChange={setAddDetailsOpen}>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Add details</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Custom name</label>
                  <Input value={addNickname} maxLength={30} onChange={(e: any) => setAddNickname(e.target.value)} placeholder="Optional nickname" />
                </div>
                <div>
                  <label className="text-sm font-medium">Number of plants</label>
                  <Input type="number" min={0} value={String(addCount)} onChange={(e: any) => setAddCount(Number(e.target.value))} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" className="rounded-2xl" onClick={() => setAddDetailsOpen(false)}>Back</Button>
                  <Button className="rounded-2xl" onClick={confirmAddSelectedPlant} disabled={!selectedPlant}>Add</Button>
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
              await load()
            }}
          />

          {/* Info Sheet removed; using dedicated route /plants/:id */}

          {/* Invite Dialog */}
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Add member</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="member@email.com" type="email" value={inviteEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteEmail(e.target.value)} />
                {inviteError && <div className="text-sm text-red-600">{inviteError}</div>}
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" className="rounded-2xl" onClick={() => setInviteOpen(false)}>Cancel</Button>
                  <Button className="rounded-2xl" onClick={submitInvite} disabled={!inviteEmail.trim()}>Add member</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}

function RoutineSection({ plants, duePlantIds, onLogWater, weekDays, weekCounts, weekCountsByType, serverToday, dueThisWeekByPlant, todayTaskOccurrences, onProgressOccurrence }: { plants: any[]; duePlantIds: Set<string> | null; onLogWater: (id: string) => Promise<void>; weekDays: string[]; weekCounts: number[]; weekCountsByType: { water: number[]; fertilize: number[]; harvest: number[]; cut: number[]; custom: number[] }; serverToday: string | null; dueThisWeekByPlant: Record<string, number[]>; todayTaskOccurrences: Array<{ id: string; taskId: string; gardenPlantId: string; dueAt: string; requiredCount: number; completedCount: number; completedAt: string | null; taskType?: 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom' }>; onProgressOccurrence: (id: string, inc: number) => Promise<void> }) {
  const duePlants = React.useMemo(() => {
    if (!duePlantIds) return []
    return plants.filter((gp: any) => duePlantIds.has(gp.id))
  }, [plants, duePlantIds])
  const maxCount = Math.max(1, ...weekCounts)
  const occsByPlant: Record<string, typeof todayTaskOccurrences> = {}
  for (const o of todayTaskOccurrences) {
    if (!occsByPlant[o.gardenPlantId]) occsByPlant[o.gardenPlantId] = [] as any
    occsByPlant[o.gardenPlantId].push(o)
  }
  const typeToColor: Record<'water'|'fertilize'|'harvest'|'cut'|'custom', string> = {
    water: 'bg-blue-500',
    fertilize: 'bg-green-500',
    harvest: 'bg-yellow-400',
    cut: 'bg-orange-500',
    custom: 'bg-purple-500',
  }
  return (
    <div className="space-y-4">
      <div className="text-lg font-medium">This week</div>
      <Card className="rounded-2xl p-4">
        <div className="text-sm opacity-60 mb-3">Monday → Sunday</div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((ds, idx) => {
            const count = weekCounts[idx] || 0
            const heightPct = count === 0 ? 0 : Math.round((count / maxCount) * 100)
            const d = new Date(ds)
            const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
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
        <div className="text-base font-medium">Today</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plants.map((gp: any) => {
          const occs = occsByPlant[gp.id] || []
          const totalReq = occs.reduce((a, o) => a + Math.max(1, o.requiredCount || 1), 0)
          const totalDone = occs.reduce((a, o) => a + Math.min(Math.max(1, o.requiredCount || 1), o.completedCount || 0), 0)
          if (occs.length === 0) return null
          return (
            <Card key={gp.id} className="rounded-2xl p-4">
              <div className="font-medium">{gp.nickname || gp.plant?.name}</div>
              {gp.nickname && <div className="text-xs opacity-60">{gp.plant?.name}</div>}
              <div className="text-sm opacity-70">Tasks due: {totalDone} / {totalReq}</div>
              <div className="mt-2 flex flex-col gap-2">
                {occs.map((o) => {
                  const tt = (o as any).taskType || 'custom'
                  const badgeClass = `${typeToColor[tt]} ${tt === 'harvest' ? 'text-black' : 'text-white'}`
                  const customEmoji = (o as any).taskEmoji || null
                  const icon = customEmoji || (tt === 'water' ? '💧' : tt === 'fertilize' ? '🍽️' : tt === 'harvest' ? '🌾' : tt === 'cut' ? '✂️' : '🪴')
                  return (
                    <div key={o.id} className="flex items-center justify-between gap-3 text-sm rounded-xl border p-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-6 w-6 flex items-center justify-center rounded-md border`}>{icon}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}>{String(tt).toUpperCase()}</span>
                        {/* Time removed per request */}
                      </div>
                      <div className="opacity-80">{o.completedCount} / {o.requiredCount}</div>
                      <Button className="rounded-xl" size="sm" onClick={() => onProgressOccurrence(o.id, 1)} disabled={(o.completedCount || 0) >= (o.requiredCount || 1)}>Complete +1</Button>
                    </div>
                  )
                })}
              </div>
            </Card>
          )
        })}
      </div>
      <div className="pt-2">
        <div className="text-base font-medium">Due this week</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plants.filter((gp: any) => (dueThisWeekByPlant[gp.id]?.length || 0) > 0 && !(duePlantIds?.has(gp.id))).map((gp: any) => (
          <Card key={gp.id} className="rounded-2xl p-4">
            <div className="font-medium">{gp.nickname || gp.plant?.name}</div>
            {gp.nickname && <div className="text-xs opacity-60">{gp.plant?.name}</div>}
            <div className="text-sm opacity-70">Water need: {gp.plant?.care.water}</div>
            <div className="text-xs opacity-70">Due this week: {dueThisWeekByPlant[gp.id]?.map((i) => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]).join(', ') || '—'}</div>
            <div className="mt-2 flex items-center gap-2">
              <Button className="rounded-2xl opacity-60" variant="secondary" disabled>Upcoming</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}


function OverviewSection({ plants, membersCount, serverToday, dailyStats, totalOnHand, speciesOnHand, baseStreak }: { plants: any[]; membersCount: number; serverToday: string | null; dailyStats: Array<{ date: string; due: number; completed: number; success: boolean }>; totalOnHand: number; speciesOnHand: number; baseStreak: number }) {
  const totalToDoToday = dailyStats.find(d => d.date === (serverToday || ''))?.due ?? 0
  const completedToday = dailyStats.find(d => d.date === (serverToday || ''))?.completed ?? 0
  const progressPct = totalToDoToday === 0 ? 100 : Math.min(100, Math.round((completedToday / totalToDoToday) * 100))
  const anchor = serverToday ? new Date(serverToday) : new Date()
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(anchor)
    d.setDate(d.getDate() - (29 - i))
    const dateIso = d.toISOString().slice(0,10)
    const dayNum = d.getDate()
    // Treat missing task row as failed per requirement
    const found = dailyStats.find(x => x.date === dateIso)
    const success = found ? found.success : false
    return { dayNum, isToday: i === 29, success }
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
          <div className="text-xs opacity-60">Plants</div>
          <div className="text-2xl font-semibold">{totalOnHand}</div>
          <div className="text-[11px] opacity-60">Species: {speciesOnHand}</div>
        </Card>
        <Card className="rounded-2xl p-4">
          <div className="text-xs opacity-60">Members</div>
          <div className="text-2xl font-semibold">{membersCount}</div>
        </Card>
        <Card className="rounded-2xl p-4">
          <div className="text-xs opacity-60">Streak</div>
          <div className="text-2xl font-semibold">{streak} days</div>
        </Card>
      </div>

      <Card className="rounded-2xl p-4">
        <div className="font-medium mb-2">Today's progress</div>
        <div className="text-sm opacity-60 mb-2">{completedToday} / {totalToDoToday || 0} tasks done</div>
        <div className="h-3 bg-stone-200 rounded-full overflow-hidden">
          <div className="h-3 bg-emerald-500" style={{ width: `${progressPct}%` }} />
        </div>
      </Card>

      <Card className="rounded-2xl p-4">
        <div className="font-medium mb-3">Last 30 days</div>
        <div className="grid grid-cols-7 gap-x-3 gap-y-3 place-items-center">
          {days.map((d, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-md flex items-center justify-center ${d.success ? 'bg-emerald-400' : 'bg-stone-300'}`}>
                <div className="text-[11px]">{d.dayNum}</div>
              </div>
              {d.isToday && <div className="mt-1 h-0.5 w-5 bg-black rounded-full" />}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function EditPlantButton({ gp, gardenId, onChanged, serverToday }: { gp: any; gardenId: string; onChanged: () => Promise<void>; serverToday: string | null }) {
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
      }
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
      <Button variant="secondary" className="rounded-2xl" onClick={() => setOpen(true)}>Edit</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit plant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Custom name</label>
              <Input value={nickname} maxLength={30} onChange={(e: any) => setNickname(e.target.value)} placeholder="Optional nickname" />
            </div>
            <div>
              <label className="text-sm font-medium">Number of plants</label>
              <Input type="number" min={0} value={String(count)} onChange={(e: any) => setCount(Number(e.target.value))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" className="rounded-2xl" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="rounded-2xl" onClick={save} disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MemberCard({ member, gardenId, onChanged, viewerIsOwner }: { member: { userId: string; displayName?: string | null; role: 'owner' | 'member' }; gardenId: string; onChanged: () => Promise<void>; viewerIsOwner: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const canPromote = viewerIsOwner && member.role !== 'owner'
  const canRemove = viewerIsOwner && member.role !== 'owner'
  const doPromote = async () => {
    if (!canPromote || busy) return
    setBusy(true)
    try {
      await updateGardenMemberRole({ gardenId, userId: member.userId, role: 'owner' })
      await onChanged()
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
      await onChanged()
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }
  return (
    <Card className="rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{member.displayName || member.userId}</div>
          <div className="text-xs opacity-60">{member.role}</div>
        </div>
        <div className="relative">
          {viewerIsOwner && member.role !== 'owner' && (
            <Button variant="secondary" className="rounded-xl px-2" onClick={(e: any) => { e.stopPropagation(); setOpen((o) => !o) }}>⋯</Button>
          )}
          {open && (
            <div className="absolute right-0 mt-2 w-44 bg-white border rounded-xl shadow-lg z-10">
              <button disabled={!canPromote || busy} onClick={(e) => { e.stopPropagation(); doPromote() }} className={`w-full text-left px-3 py-2 rounded-t-xl hover:bg-stone-50 ${!canPromote ? 'opacity-60 cursor-not-allowed' : ''}`}>Promote to owner</button>
              <button disabled={!canRemove || busy} onClick={(e) => { e.stopPropagation(); doRemove() }} className="w-full text-left px-3 py-2 rounded-b-xl hover:bg-stone-50 text-red-600">Remove member</button>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function GardenDetailsEditor({ garden, onSaved, canEdit }: { garden: Garden; onSaved: () => Promise<void>; canEdit?: boolean }) {
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
      await onSaved()
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Garden name</label>
        <Input value={name} onChange={(e: any) => setName(e.target.value)} disabled={!canEdit} />
      </div>
      <div>
        <label className="text-sm font-medium">Cover image URL</label>
        <Input value={imageUrl} onChange={(e: any) => setImageUrl(e.target.value)} placeholder="https://…" disabled={!canEdit} />
      </div>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <Button className="rounded-2xl" onClick={save} disabled={submitting || !canEdit}>{submitting ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </div>
  )
}

