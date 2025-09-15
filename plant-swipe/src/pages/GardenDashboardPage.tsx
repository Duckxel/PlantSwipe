// @ts-nocheck
import React from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SchedulePickerDialog } from '@/components/plant/SchedulePickerDialog'
import type { Garden } from '@/types/garden'
import type { Plant } from '@/types/plant'
import { getGarden, getGardenPlants, getGardenMembers, addMemberByEmail, fetchScheduleForPlants, markGardenPlantWatered, updateGardenPlantFrequency, deleteGardenPlant, reseedSchedule, addPlantToGarden, fetchServerNowISO, upsertGardenTask, getGardenTasks, ensureDailyTasksForGardens, upsertGardenPlantSchedule, getGardenPlantSchedule, getGardenInventory, adjustInventoryAndLogTransaction } from '@/lib/gardens'
import { supabase } from '@/lib/supabaseClient'


type TabKey = 'overview' | 'plants' | 'routine' | 'settings'

export const GardenDashboardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [garden, setGarden] = React.useState<Garden | null>(null)
  const [tab, setTab] = React.useState<TabKey>('overview')
  const [plants, setPlants] = React.useState<Array<any>>([])
  const [members, setMembers] = React.useState<Array<{ userId: string; displayName?: string | null; role: 'owner' | 'member' }>>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [serverToday, setServerToday] = React.useState<string | null>(null)
  const [dueToday, setDueToday] = React.useState<Set<string> | null>(null)
  const [dailyStats, setDailyStats] = React.useState<Array<{ date: string; due: number; completed: number; success: boolean }>>([])
  const [weekDays, setWeekDays] = React.useState<string[]>([])
  const [weekCounts, setWeekCounts] = React.useState<number[]>([])
  const [dueThisWeekByPlant, setDueThisWeekByPlant] = React.useState<Record<string, number[]>>({})
  const [inventoryCounts, setInventoryCounts] = React.useState<Record<string, number>>({})
  const [totalOnHand, setTotalOnHand] = React.useState(0)
  const [speciesOnHand, setSpeciesOnHand] = React.useState(0)

  const [addOpen, setAddOpen] = React.useState(false)
  const [plantQuery, setPlantQuery] = React.useState('')
  const [plantResults, setPlantResults] = React.useState<Plant[]>([])
  const [selectedPlant, setSelectedPlant] = React.useState<Plant | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [scheduleOpen, setScheduleOpen] = React.useState(false)
  const [pendingGardenPlantId, setPendingGardenPlantId] = React.useState<string | null>(null)
  const [pendingPeriod, setPendingPeriod] = React.useState<'week' | 'month' | 'year' | null>(null)
  const [pendingAmount, setPendingAmount] = React.useState<number>(0)
  const [initialSelectionState, setInitialSelectionState] = React.useState<{ weeklyDays?: number[]; monthlyDays?: number[]; yearlyDays?: string[]; monthlyNthWeekdays?: string[] } | undefined>(undefined)
  const [addDetailsOpen, setAddDetailsOpen] = React.useState(false)
  const [addNickname, setAddNickname] = React.useState('')
  const [addCount, setAddCount] = React.useState<number>(1)
  const [scheduleLockYear, setScheduleLockYear] = React.useState<boolean>(false)
  const [scheduleAllowedPeriods, setScheduleAllowedPeriods] = React.useState<Array<'week'|'month'|'year'> | undefined>(undefined)

  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [inviteEmail, setInviteEmail] = React.useState('')
  const [inviteError, setInviteError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const g = await getGarden(id)
      setGarden(g)
      const gps = await getGardenPlants(id)
      setPlants(gps)
      const ms = await getGardenMembers(id)
      setMembers(ms.map(m => ({ userId: m.userId, displayName: m.displayName ?? null, role: m.role })))
      const nowIso = await fetchServerNowISO()
      const today = nowIso.slice(0,10)
      setServerToday(today)
      await ensureDailyTasksForGardens(today)
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      const startIso = start.toISOString().slice(0,10)
      const taskRows = await getGardenTasks(id, startIso, today)

      const sched = await fetchScheduleForPlants(gps.map((gp: any) => gp.id), 45)
      const dset = new Set<string>()
      const map: Record<string, { due: number; completed: number }> = {}
      for (const gpId of Object.keys(sched)) {
        for (const row of (sched as any)[gpId] as any[]) {
          const d = row.dueDate
          if (!map[d]) map[d] = { due: 0, completed: 0 }
          map[d].due += 1
          if (row.completedAt) map[d].completed += 1
          if (d === today && !row.completedAt) dset.add(gpId)
        }
      }
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

      // Prefer deriving week due from explicit plant schedule definitions to avoid stale pre-seeded rows
      const gpIds = gps.map((gp: any) => gp.id)
      const { data: sdefs } = await supabase
        .from('garden_plant_schedule')
        .select('garden_plant_id, period, amount, weekly_days, monthly_days, yearly_days, monthly_nth_weekdays')
        .in('garden_plant_id', gpIds)

      const defByPlant: Record<string, any> = {}
      for (const row of (sdefs || [])) {
        defByPlant[String((row as any).garden_plant_id)] = row
      }

      const perPlant: Record<string, number[]> = {}
      const weeklyDayNumberForIdx = [1,2,3,4,5,6,0] // Mon..Sun -> 1..6,0
      const derivedCounts = Array(7).fill(0)

      for (const gp of gps as any[]) {
        const gpId = String(gp.id)
        const def = defByPlant[gpId]
        const idxs = new Set<number>()
        if (def) {
          for (let i = 0; i < 7; i++) {
            const ds = weekDaysIso[i]
            const dt = new Date(`${ds}T00:00:00Z`)
            const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
            const dd = String(dt.getUTCDate()).padStart(2, '0')
            const ymd = `${mm}-${dd}`
            const weekdayNum = weeklyDayNumberForIdx[i]
            const p = (def as any).period
            if (p === 'week') {
              const arr: number[] = ((def as any).weekly_days || []) as number[]
              if (arr.includes(weekdayNum)) idxs.add(i)
            } else if (p === 'month') {
              const arr: number[] = ((def as any).monthly_days || []) as number[]
              const nth: string[] = ((def as any).monthly_nth_weekdays || []) as string[]
              const date = dt.getUTCDate()
              if (arr.includes(date)) idxs.add(i)
              if (nth.length > 0) {
                // Compute week-of-month (1-4) and weekday (0=Sun..6=Sat) for current date
                const weekday = dt.getUTCDay()
                const weekIndex = Math.floor((date - 1) / 7) + 1 // 1..4 (ignore 5th occurrences)
                if (weekIndex >= 1 && weekIndex <= 4) {
                  const key = `${weekIndex}-${weekday}`
                  if (nth.includes(key)) idxs.add(i)
                }
              }
            } else if (p === 'year') {
              const arr: string[] = ((def as any).yearly_days || []) as string[]
              if (arr.includes(ymd)) idxs.add(i)
            }
          }
        }
        const list = Array.from(idxs).sort((a, b) => a - b)
        perPlant[gpId] = list
        for (const i of list) derivedCounts[i] += 1
      }
      // Fallback to existing schedule-based counts if definitions missing entirely
      const hasAnyDefs = Object.keys(perPlant).length > 0 && Object.values(perPlant).some(arr => (arr as number[]).length > 0)
      setWeekCounts(hasAnyDefs ? derivedCounts : weekDaysIso.map(ds => (map[ds]?.due ?? 0)))
      setDueThisWeekByPlant(perPlant)

      // Determine due-today plants from schedule definitions, excluding those already completed today
      const idxToday = weekDaysIso.indexOf(today)
      const completedToday = new Set<string>()
      for (const gpId of Object.keys(sched)) {
        for (const row of (sched as any)[gpId] as any[]) {
          if (row.dueDate === today && row.completedAt) completedToday.add(gpId)
        }
      }
      const dset2 = new Set<string>()
      for (const [gpId, idxs] of Object.entries(perPlant)) {
        if (idxToday >= 0 && (idxs as number[]).includes(idxToday) && !completedToday.has(gpId)) dset2.add(gpId)
      }
      setDueToday(dset2)

      // Load inventory counts for display
      const inv = await getGardenInventory(id)
      const countsMap: Record<string, number> = {}
      for (const it of inv) {
        countsMap[String(it.plantId)] = Number(it.plantsOnHand || 0)
      }
      setInventoryCounts(countsMap)
      setTotalOnHand(Object.values(countsMap).reduce((a, b) => a + (Number(b) || 0), 0))
      setSpeciesOnHand(Object.values(countsMap).filter(v => (Number(v) || 0) > 0).length)
      const days: Array<{ date: string; due: number; completed: number; success: boolean }> = []
      const anchor30 = new Date(today)
      for (let i = 29; i >= 0; i--) {
        const d = new Date(anchor30)
        d.setDate(d.getDate() - i)
        const ds = d.toISOString().slice(0,10)
        const entry = map[ds] || { due: 0, completed: 0 }
        const trow = taskRows.find(tr => tr.day === ds && tr.taskType === 'watering')
        // If computing for 'today', prefer derived counts from schedule definitions
        const isToday = ds === today
        const idxTodayForStats = isToday ? weekDaysIso.indexOf(today) : -1
        const dueOverride = isToday && idxTodayForStats >= 0 ? (Object.values(perPlant).reduce((acc: number, arr: any) => acc + ((arr as number[]).includes(idxTodayForStats) ? 1 : 0), 0)) : undefined
        const dueVal = dueOverride !== undefined ? dueOverride : entry.due
        const success = dueVal > 0 ? (entry.completed >= dueVal) : Boolean(trow?.success)
        days.push({ date: ds, due: dueVal, completed: entry.completed, success })
      }
      // Keep dueToday from schedule definitions (already set)
      setDailyStats(days)
    } catch (e: any) {
      setError(e?.message || 'Failed to load garden')
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => { load() }, [load])

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
    const res = await addMemberByEmail({ gardenId: id, email: inviteEmail.trim() })
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
      const nicknameVal = addNickname.trim().length > 0 ? addNickname.trim() : null
      const qty = Math.max(0, Number(addCount || 0))
      const gp = await addPlantToGarden({ gardenId: id, plantId: selectedPlant.id, seedsPlanted: 0, nickname: nicknameVal || undefined })
      if (qty > 0) {
        await adjustInventoryAndLogTransaction({ gardenId: id, plantId: selectedPlant.id, plantsDelta: qty, transactionType: 'buy_plants' })
      }
      setAddDetailsOpen(false)
      setAddNickname('')
      setAddCount(1)
      setAddOpen(false)
      setSelectedPlant(null)
      setPlantQuery('')
      // Enforce allowed schedule to week/month, keep amount editable
      const recommended = (selectedPlant.waterFreqPeriod || (selectedPlant.waterFreqUnit as any)) as 'week'|'month'|'year' | undefined
      const mapped = recommended === 'year' ? 'week' : (recommended as any)
      const defaultPeriod = (mapped && ['week','month'].includes(mapped)) ? mapped : 'week'
      const defaultAmount = Number(selectedPlant.waterFreqAmount ?? selectedPlant.waterFreqValue ?? 1) || 1
      setPendingGardenPlantId(gp.id)
      setPendingPeriod(defaultPeriod as any)
      setPendingAmount(defaultAmount > 0 ? defaultAmount : 1)
      setInitialSelectionState(undefined)
      setScheduleLockYear(false)
      setScheduleAllowedPeriods(['week','month'])
      setScheduleOpen(true)
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
      setScheduleAllowedPeriods(undefined)
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
      setScheduleAllowedPeriods(undefined)
      setScheduleOpen(true)
    }
  }

  const handleSaveSchedule = async (selection: { weeklyDays?: number[]; monthlyDays?: number[]; yearlyDays?: string[]; monthlyNthWeekdays?: string[] }) => {
    if (!pendingGardenPlantId || !pendingPeriod || !id) return
    try {
      await updateGardenPlantFrequency({ gardenPlantId: pendingGardenPlantId, unit: pendingPeriod, value: pendingAmount })
      await upsertGardenPlantSchedule({
        gardenPlantId: pendingGardenPlantId,
        period: pendingPeriod,
        amount: pendingAmount,
        weeklyDays: selection.weeklyDays || null,
        monthlyDays: selection.monthlyDays || null,
        yearlyDays: selection.yearlyDays || null,
        monthlyNthWeekdays: selection.monthlyNthWeekdays || null,
      })
      if (serverToday) {
        // Clear upcoming due rows from today forward, then reseed fresh based on new schedule
        await supabase
          .from('garden_watering_schedule')
          .delete()
          .eq('garden_plant_id', pendingGardenPlantId)
          .gte('due_date', serverToday)
          .is('completed_at', null)
      }
      await reseedSchedule(pendingGardenPlantId)
      if (serverToday) {
        // Ensure tasks row exists; success will be derived from schedule completion elsewhere
        await ensureDailyTasksForGardens(serverToday)
      }
      await load()
      setTab('plants')
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
      await markGardenPlantWatered(gardenPlantId)
      if (serverToday && garden?.id) {
        await upsertGardenTask({ gardenId: garden.id, day: serverToday, gardenPlantId, success: true })
      }
      await load()
      setTab('routine')
    } catch (e: any) {
      setError(e?.message || 'Failed to log watering')
    }
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
                <Button key={k} variant={tab === k ? 'default' : 'secondary'} className="rounded-2xl" onClick={() => setTab(k)}>{label}</Button>
              ))}
            </nav>
          </aside>
          <main className="min-h-[60vh]">
            {tab === 'overview' && (
              <OverviewSection plants={plants} membersCount={members.length} serverToday={serverToday} dailyStats={dailyStats} totalOnHand={totalOnHand} speciesOnHand={speciesOnHand} />
            )}

            {tab === 'plants' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="text-lg font-medium">Plants in this garden</div>
                  <Button className="rounded-2xl" onClick={() => setAddOpen(true)}>Add Plant</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plants.map((gp: any) => (
                    <Card key={gp.id} className="rounded-2xl overflow-hidden">
                      <div className="grid grid-cols-3 gap-0">
                        <div className="col-span-1 h-36 bg-cover bg-center" style={{ backgroundImage: `url(${gp.plant?.image || ''})` }} />
                        <div className="col-span-2 p-3">
                          <div className="font-medium">{gp.nickname || gp.plant?.name}</div>
                          {gp.nickname && <div className="text-xs opacity-60">{gp.plant?.name}</div>}
                          <div className="text-xs opacity-60">On hand: {inventoryCounts[gp.plantId] ?? 0}</div>
                          <div className="text-xs opacity-60">Frequency: {gp.overrideWaterFreqValue ? `${gp.overrideWaterFreqValue} / ${gp.overrideWaterFreqUnit}` : 'not set'}</div>
                          <div className="mt-2 flex gap-2 flex-wrap">
                            <Button variant="secondary" className="rounded-2xl" onClick={() => openEditSchedule(gp)}>Schedule</Button>
                            <EditPlantButton gp={gp} gardenId={id!} onChanged={load} serverToday={serverToday} />
                            <Button variant="secondary" className="rounded-2xl" onClick={async () => { await deleteGardenPlant(gp.id); if (serverToday) { await ensureDailyTasksForGardens(serverToday) } await load() }}>Delete</Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {tab === 'routine' && (
              <RoutineSection plants={plants} duePlantIds={dueToday} onLogWater={logWater} weekDays={weekDays} weekCounts={weekCounts} serverToday={serverToday} dueThisWeekByPlant={dueThisWeekByPlant} />
            )}

            {tab === 'settings' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="text-lg font-medium">Garden details</div>
                  <Card className="rounded-2xl p-4">
                    <GardenDetailsEditor garden={garden} onSaved={load} />
                  </Card>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-medium">Manage members</div>
                    <Button className="rounded-2xl" onClick={() => setInviteOpen(true)}>Add member</Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {members.map(m => (
                      <Card key={m.userId} className="rounded-2xl p-4">
                        <div className="font-medium">{m.displayName || m.userId}</div>
                        <div className="text-xs opacity-60">{m.role}</div>
                      </Card>
                    ))}
                  </div>
                </div>
                <div className="pt-2">
                  <Button variant="destructive" className="rounded-2xl" onClick={async () => { if (!id) return; if (!confirm('Delete this garden? This cannot be undone.')) return; try { await supabase.from('gardens').delete().eq('id', id); window.location.href = '/gardens' } catch (e) { alert('Failed to delete garden') } }}>Delete garden</Button>
                </div>
              </div>
            )}
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

function RoutineSection({ plants, duePlantIds, onLogWater, weekDays, weekCounts, serverToday, dueThisWeekByPlant }: { plants: any[]; duePlantIds: Set<string> | null; onLogWater: (id: string) => Promise<void>; weekDays: string[]; weekCounts: number[]; serverToday: string | null; dueThisWeekByPlant: Record<string, number[]> }) {
  const duePlants = React.useMemo(() => {
    if (!duePlantIds) return []
    return plants.filter((gp: any) => duePlantIds.has(gp.id))
  }, [plants, duePlantIds])
  const maxCount = Math.max(1, ...weekCounts)
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
            return (
              <div key={ds} className="flex flex-col items-center justify-end gap-1 h-36">
                <div className={`w-7 rounded-md ${count > 0 ? 'bg-emerald-400' : 'bg-stone-300'}`} style={{ height: `${heightPct}%` }} />
                <div className={`text-[11px] ${isToday ? 'underline' : 'opacity-70'}`}>{labels[idx]}</div>
                <div className="text-[10px] opacity-60">{count}</div>
              </div>
            )
          })}
        </div>
      </Card>
      <div className="flex justify-between items-center">
        <div className="text-base font-medium">Today</div>
        {duePlants.length > 0 && (
          <Button className="rounded-2xl" onClick={async () => { for (const gp of duePlants) { await onLogWater(gp.id) } }}>Watered all due plants</Button>
        )}
      </div>
      {duePlants.length === 0 && (
        <div className="text-sm opacity-70">No plants to water today</div>
      )}
      {duePlants.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {duePlants.map((gp: any) => (
            <Card key={gp.id} className="rounded-2xl p-4">
              <div className="font-medium">{gp.nickname || gp.plant?.name}</div>
              {gp.nickname && <div className="text-xs opacity-60">{gp.plant?.name}</div>}
              <div className="text-sm opacity-70">Water need: {gp.plant?.care.water}</div>
              <div className="text-xs opacity-70">Due this week: {dueThisWeekByPlant[gp.id]?.map((i) => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]).join(', ') || '—'}</div>
              <div className="mt-2 flex items-center gap-2">
                <Button className="rounded-2xl" onClick={() => onLogWater(gp.id)}>Mark watered</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
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

function OverviewSection({ plants, membersCount, serverToday, dailyStats, totalOnHand, speciesOnHand }: { plants: any[]; membersCount: number; serverToday: string | null; dailyStats: Array<{ date: string; due: number; completed: number; success: boolean }>; totalOnHand: number; speciesOnHand: number }) {
  const totalToWaterToday = dailyStats.find(d => d.date === (serverToday || ''))?.due ?? 0
  const completedToday = dailyStats.find(d => d.date === (serverToday || ''))?.completed ?? 0
  const progressPct = totalToWaterToday === 0 ? 100 : Math.min(100, Math.round((completedToday / totalToWaterToday) * 100))
  const anchor = serverToday ? new Date(serverToday) : new Date()
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(anchor)
    d.setDate(d.getDate() - (29 - i))
    const dateIso = d.toISOString().slice(0,10)
    const dayNum = d.getDate()
    const success = dailyStats.find(x => x.date === dateIso)?.success ?? false
    return { dayNum, isToday: i === 29, success }
  })
  const streak = (() => {
    let s = 0
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].success || (i === days.length - 1 && totalToWaterToday === 0)) s++;
      else break;
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
        <div className="text-sm opacity-60 mb-2">{completedToday} / {totalToWaterToday || 0} watered</div>
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
  const [count, setCount] = React.useState<number>(0)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    setNickname(gp.nickname || '')
  }, [gp.nickname])

  const loadInitialCount = React.useCallback(async () => {
    try {
      const { data } = await supabase
        .from('garden_inventory')
        .select('plants_on_hand')
        .eq('garden_id', gardenId)
        .eq('plant_id', gp.plantId)
        .maybeSingle()
      const current = Number(data?.plants_on_hand ?? 0)
      setCount(current)
    } catch {}
  }, [gardenId, gp.plantId])
  React.useEffect(() => { loadInitialCount() }, [loadInitialCount])

  const save = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      // Update nickname
      await supabase.from('garden_plants').update({ nickname: nickname.trim() || null }).eq('id', gp.id)
      // Update count via inventory table; delete plant if 0
      if (count <= 0) {
        await supabase.from('garden_plants').delete().eq('id', gp.id)
        if (serverToday) await ensureDailyTasksForGardens(serverToday)
      } else {
        // Compute delta by reading current inventory
        const { data: inv } = await supabase
          .from('garden_inventory')
          .select('plants_on_hand')
          .eq('garden_id', gardenId)
          .eq('plant_id', gp.plantId)
          .maybeSingle()
        const current = Number(inv?.plants_on_hand ?? 0)
        const delta = count - current
        if (delta !== 0) {
          await adjustInventoryAndLogTransaction({ gardenId, plantId: gp.plantId, plantsDelta: delta, transactionType: delta > 0 ? 'buy_plants' : 'sell_plants' })
        }
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

function GardenDetailsEditor({ garden, onSaved }: { garden: Garden; onSaved: () => Promise<void> }) {
  const [name, setName] = React.useState(garden.name)
  const [imageUrl, setImageUrl] = React.useState(garden.coverImageUrl || '')
  const [submitting, setSubmitting] = React.useState(false)
  const save = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await supabase.from('gardens').update({ name: name.trim() || garden.name, cover_image_url: imageUrl.trim() || null }).eq('id', garden.id)
      await onSaved()
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Garden name</label>
        <Input value={name} onChange={(e: any) => setName(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium">Cover image URL</label>
        <Input value={imageUrl} onChange={(e: any) => setImageUrl(e.target.value)} placeholder="https://…" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button className="rounded-2xl" onClick={save} disabled={submitting}>{submitting ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </div>
  )
}

