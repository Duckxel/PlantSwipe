import React from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Garden } from '@/types/garden'
import type { Plant } from '@/types/plant'
import { getGarden, getGardenPlants, addPlantToGarden, logWaterEvent, getGardenMembers, addMemberByEmail } from '@/lib/gardens'
import { supabase } from '@/lib/supabaseClient'

type TabKey = 'overview' | 'plants' | 'routine' | 'members'

export const GardenDashboardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [garden, setGarden] = React.useState<Garden | null>(null)
  const [tab, setTab] = React.useState<TabKey>('overview')
  const [plants, setPlants] = React.useState<Array<any>>([])
  const [members, setMembers] = React.useState<Array<{ userId: string; displayName?: string | null; role: 'owner' | 'member' }>>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [addOpen, setAddOpen] = React.useState(false)
  const [plantQuery, setPlantQuery] = React.useState('')
  const [plantResults, setPlantResults] = React.useState<Plant[]>([])
  const [selectedPlant, setSelectedPlant] = React.useState<Plant | null>(null)
  const [adding, setAdding] = React.useState(false)

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
        .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, care_sunlight, care_water, care_soil, care_difficulty, seeds_available')
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
      await addPlantToGarden({ gardenId: id, plantId: selectedPlant.id, seedsPlanted: 0 })
      setAddOpen(false)
      setSelectedPlant(null)
      setPlantQuery('')
      await load()
      setTab('plants')
    } catch (e: any) {
      setError(e?.message || 'Failed to add plant')
    } finally {
      setAdding(false)
    }
  }

  const logWater = async (gardenPlantId: string) => {
    try {
      await logWaterEvent({ gardenPlantId })
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
                ['members','Members'],
              ] as Array<[TabKey, string]>).map(([k, label]) => (
                <Button key={k} variant={tab === k ? 'default' : 'secondary'} className="rounded-2xl" onClick={() => setTab(k)}>{label}</Button>
              ))}
            </nav>
          </aside>
          <main className="min-h-[60vh]">
            {tab === 'overview' && (
              <OverviewSection plants={plants} membersCount={members.length} />
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
                          <div className="font-medium">{gp.plant?.name}{gp.nickname ? ` · ${gp.nickname}` : ''}</div>
                          <div className="text-xs opacity-60">Seeds planted: {gp.seedsPlanted || 0}</div>
                          <div className="mt-2">
                            <Button variant="secondary" className="rounded-2xl" onClick={() => logWater(gp.id)}>Log watered</Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {tab === 'routine' && (
              <RoutineSection plants={plants} onLogWater={logWater} />
            )}

            

            {tab === 'members' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-medium">Members</div>
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
                  <Button className="rounded-2xl" disabled={!selectedPlant || adding} onClick={addSelectedPlant}>{adding ? 'Adding…' : 'Add'}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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

function RoutineSection({ plants, onLogWater }: { plants: any[]; onLogWater: (id: string) => Promise<void> }) {
  // Placeholder: weekly mini bar chart and due list
  // Count water events in last 7 days is not implemented server-side yet; show mock using seedsPlanted as proxy
  const bars = [0,1,2,3,4,5,6].map((i) => ({ day: i, value: Math.min(5, plants.reduce((s, p) => s + (p.seedsPlanted ? 1 : 0), 0)) }))
  return (
    <div className="space-y-4">
      <div className="text-lg font-medium">Watering routine</div>
      <Card className="rounded-2xl p-4">
        <div className="text-sm opacity-60 mb-2">Past week</div>
        <div className="flex gap-2 items-end h-24">
          {bars.map((b, idx) => (
            <div key={idx} className="w-6 bg-emerald-200 rounded" style={{ height: `${10 + b.value * 18}px` }} />
          ))}
        </div>
      </Card>
      <div className="flex justify-between items-center">
        <div className="text-base font-medium">Today</div>
        <Button className="rounded-2xl" onClick={async () => { for (const gp of plants) { await onLogWater(gp.id) } }}>Watered all plants</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plants.map((gp: any) => (
          <Card key={gp.id} className="rounded-2xl p-4">
            <div className="font-medium">{gp.plant?.name}{gp.nickname ? ` · ${gp.nickname}` : ''}</div>
            <div className="text-sm opacity-70">Water need: {gp.plant?.care.water}</div>
            <div className="mt-2 flex items-center gap-2">
              <Button className="rounded-2xl" onClick={() => onLogWater(gp.id)}>Mark watered</Button>
              <Button variant="secondary" className="rounded-2xl opacity-60" disabled>Upcoming</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function OverviewSection({ plants, membersCount }: { plants: any[]; membersCount: number }) {
  // Compute a simple daily goal: number of plants to water today equals count of plants
  const totalToWater = plants.length
  const wateredToday = 0 // Placeholder until events are fetched; treat 0
  const progressPct = totalToWater === 0 ? 100 : Math.min(100, Math.round((wateredToday / totalToWater) * 100))
  // Build a simple 20-day streak-like calendar: mark validated if totalToWater===0
  const days = Array.from({ length: 20 }, (_, i) => ({
    day: i,
    validated: totalToWater === 0,
  }))
  const streak = days.reduce((s, d) => (d.validated ? s + 1 : 0), 0)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl p-4">
          <div className="text-xs opacity-60">Plants</div>
          <div className="text-2xl font-semibold">{plants.length}</div>
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
        <div className="text-sm opacity-60 mb-2">{wateredToday} / {totalToWater || 0} watered</div>
        <div className="h-3 bg-stone-200 rounded-full overflow-hidden">
          <div className="h-3 bg-emerald-500" style={{ width: `${progressPct}%` }} />
        </div>
      </Card>

      <Card className="rounded-2xl p-4">
        <div className="font-medium mb-3">Last 20 days</div>
        <div className="grid grid-cols-10 gap-2">
          {days.map((d, idx) => (
            <div key={idx} className={`h-6 rounded ${d.validated ? 'bg-emerald-400' : 'bg-stone-300'}`} />
          ))}
        </div>
      </Card>
    </div>
  )
}

