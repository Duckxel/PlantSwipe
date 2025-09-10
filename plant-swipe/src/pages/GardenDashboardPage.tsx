import React from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Garden } from '@/types/garden'
import type { Plant } from '@/types/plant'
import { getGarden, getGardenPlants, addPlantToGarden, logWaterEvent, getGardenMembers } from '@/lib/gardens'
import { supabase } from '@/lib/supabaseClient'

type TabKey = 'overview' | 'plants' | 'routine' | 'inventory' | 'members'

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
  const [inviteQuery, setInviteQuery] = React.useState('')
  const [inviteResults, setInviteResults] = React.useState<Array<{ id: string; display_name: string | null }>>([])

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

  React.useEffect(() => {
    let ignore = false
    if (!inviteQuery.trim()) { setInviteResults([]); return }
    ;(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name')
        .ilike('display_name', `%${inviteQuery}%`)
        .limit(10)
      if (!ignore) setInviteResults((data || []) as any)
    })()
    return () => { ignore = true }
  }, [inviteQuery])

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

  const inviteUser = async (userId: string) => {
    if (!id) return
    try {
      const { addGardenMember } = await import('@/lib/gardens')
      await addGardenMember({ gardenId: id, userId, role: 'member' })
      setInviteOpen(false)
      setInviteQuery('')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Failed to add member')
    }
  }

  return (
    <div className="max-w-6xl mx-auto mt-6 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
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
                ['inventory','Inventory'],
                ['members','Members'],
              ] as Array<[TabKey, string]>).map(([k, label]) => (
                <Button key={k} variant={tab === k ? 'default' : 'secondary'} className="rounded-2xl" onClick={() => setTab(k)}>{label}</Button>
              ))}
            </nav>
          </aside>
          <main className="min-h-[60vh]">
            {tab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="rounded-2xl p-4">
                  <div className="text-xs opacity-60">Plants</div>
                  <div className="text-2xl font-semibold">{plants.length}</div>
                </Card>
                <Card className="rounded-2xl p-4">
                  <div className="text-xs opacity-60">Seeds planted</div>
                  <div className="text-2xl font-semibold">{plants.reduce((s, p) => s + (p.seedsPlanted || 0), 0)}</div>
                </Card>
                <Card className="rounded-2xl p-4">
                  <div className="text-xs opacity-60">Members</div>
                  <div className="text-2xl font-semibold">{members.length}</div>
                </Card>
                <div className="md:col-span-3">
                  <Card className="rounded-2xl p-4">
                    <div className="font-medium mb-2">Next tasks</div>
                    <div className="text-sm opacity-60">Water and care reminders show up after you add plants and log actions.</div>
                  </Card>
                </div>
              </div>
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
              <div className="space-y-3">
                <div className="text-lg font-medium">Watering and care</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plants.map((gp: any) => (
                    <Card key={gp.id} className="rounded-2xl p-4">
                      <div className="font-medium">{gp.plant?.name}{gp.nickname ? ` · ${gp.nickname}` : ''}</div>
                      <div className="text-sm opacity-70">Water need: {gp.plant?.care.water}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <Button className="rounded-2xl" onClick={() => logWater(gp.id)}>Log watered</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {tab === 'inventory' && (
              <div className="space-y-3">
                <div className="text-lg font-medium">Inventory</div>
                <div className="text-sm opacity-60">Track seeds and plants. Buying/selling flows can be added here.</div>
              </div>
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
                <Input placeholder="Search users by display name…" value={inviteQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteQuery(e.target.value)} />
                <div className="max-h-60 overflow-auto rounded-xl border">
                  {inviteResults.map(u => (
                    <button key={u.id} onClick={() => inviteUser(u.id)} className="w-full text-left px-3 py-2 hover:bg-stone-50">
                      <div className="font-medium">{u.display_name || u.id}</div>
                    </button>
                  ))}
                  {inviteQuery && inviteResults.length === 0 && (
                    <div className="px-3 py-6 text-sm opacity-60">No results</div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}

