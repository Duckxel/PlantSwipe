import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabaseClient"
import type { Plant } from "@/types/plant"

function generateUUIDv4(): string {
  try {
    const anyCrypto = (typeof crypto !== 'undefined') ? (crypto as any) : undefined
    if (anyCrypto && typeof anyCrypto.randomUUID === 'function') {
      return anyCrypto.randomUUID()
    }
    if (anyCrypto && typeof anyCrypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16)
      anyCrypto.getRandomValues(bytes)
      bytes[6] = (bytes[6] & 0x0f) | 0x40
      bytes[8] = (bytes[8] & 0x3f) | 0x80
      const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0'))
      return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`
    }
  } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

interface CreatePlantPageProps {
  onCancel: () => void
  onSaved?: (plantId: string) => void
}

export const CreatePlantPage: React.FC<CreatePlantPageProps> = ({ onCancel, onSaved }) => {
  const [name, setName] = React.useState("")
  const [scientificName, setScientificName] = React.useState("")
  const [colors, setColors] = React.useState<string>("")
  const [seasons, setSeasons] = React.useState<string[]>([])
  const [rarity, setRarity] = React.useState<Plant["rarity"]>("Common")
  const [meaning, setMeaning] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [imageUrl, setImageUrl] = React.useState("")
  const [careSunlight, setCareSunlight] = React.useState<Plant["care"]["sunlight"]>("Low")
  const [careWater, setCareWater] = React.useState<Plant["care"]["water"]>("Low")
  const [careSoil, setCareSoil] = React.useState("")
  const [careDifficulty, setCareDifficulty] = React.useState<Plant["care"]["difficulty"]>("Easy")
  const [seedsAvailable, setSeedsAvailable] = React.useState(false)
  const [waterFreqPeriod, setWaterFreqPeriod] = React.useState<'week' | 'month' | 'year'>('week')
  const [waterFreqAmount, setWaterFreqAmount] = React.useState<number>(1)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [ok, setOk] = React.useState<string | null>(null)

  const toggleSeason = (s: Plant["seasons"][number]) => {
    setSeasons((cur: string[]) => (cur.includes(s) ? cur.filter((x: string) => x !== s) : [...cur, s]))
  }

  const save = async () => {
    setError(null)
    setOk(null)
    if (!name.trim()) { setError("Name is required"); return }
    if (!scientificName.trim()) { setError("Scientific name is required"); return }
    if (!careSoil.trim()) { setError("Soil is required"); return }
    // Validate frequency constraints
    const periodMax: Record<'week'|'month'|'year', number> = { week: 7, month: 4, year: 12 }
    const maxAllowed = periodMax[waterFreqPeriod]
    let normalizedAmount = Math.max(1, Math.min(Number(waterFreqAmount || 1), maxAllowed))
    if (Number(waterFreqAmount || 1) > maxAllowed) {
      // Provide gentle guidance rather than blocking
      setOk(`Capped to ${maxAllowed} per ${waterFreqPeriod}. For more, use a shorter period.`)
    }
    setSaving(true)
    try {
      const id = generateUUIDv4()
      const nameNorm = name.trim()
      const sciNorm = scientificName.trim()
      const colorArray = colors.split(",").map((c) => c.trim()).filter(Boolean)

      // Duplicate check: name or scientific name (case-insensitive)
      const byName = await supabase.from('plants').select('id').ilike('name', nameNorm).limit(1).maybeSingle()
      if (byName.error) { setError(byName.error.message); return }
      const bySci = await supabase.from('plants').select('id').ilike('scientific_name', sciNorm).limit(1).maybeSingle()
      if (bySci.error) { setError(bySci.error.message); return }
      if (byName.data?.id || bySci.data?.id) {
        setError('A plant with the same name or scientific name already exists')
        return
      }

      const { error: insErr } = await supabase.from('plants').insert({
        id,
        name: nameNorm,
        scientific_name: sciNorm,
        colors: colorArray,
        seasons,
        rarity,
        meaning: meaning || null,
        description: description || null,
        image_url: imageUrl || null,
        care_sunlight: careSunlight,
        care_water: careWater,
        care_soil: careSoil,
        care_difficulty: careDifficulty,
        seeds_available: seedsAvailable,
        // Default watering frequency fields
        water_freq_period: waterFreqPeriod,
        water_freq_amount: normalizedAmount,
        // Legacy/alternative field names for compatibility
        water_freq_unit: waterFreqPeriod,
        water_freq_value: normalizedAmount,
      })
      if (insErr) { setError(insErr.message); return }
      setOk('Saved')
      onSaved && onSaved(id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-8 px-4 md:px-0">
      <Card className="rounded-3xl">
        <CardContent className="p-6 md:p-8 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="plant-name">Name</Label>
            <Input id="plant-name" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
          </div>
          {/* Default watering frequency */}
          <div className="grid gap-2">
            <Label>Default watering frequency</Label>
            <div className="grid grid-cols-2 gap-2">
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" value={waterFreqPeriod} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setWaterFreqPeriod(e.target.value as any)}>
                {(["week","month","year"] as const).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <Input type="number" min={1} max={waterFreqPeriod === 'week' ? 7 : waterFreqPeriod === 'month' ? 4 : 12} value={String(waterFreqAmount)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWaterFreqAmount(Math.max(1, Number(e.target.value || '1')))} />
            </div>
            <div className="text-xs opacity-60">
              {waterFreqPeriod === 'week' && 'Max 7 per week.'}
              {waterFreqPeriod === 'month' && 'Max 4 per month (otherwise use week).'}
              {waterFreqPeriod === 'year' && 'Max 12 per year (otherwise use month).'}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-scientific">Scientific name</Label>
            <Input id="plant-scientific" value={scientificName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScientificName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-colors">Colors (comma separated)</Label>
            <Input id="plant-colors" placeholder="Red, Yellow" value={colors} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColors(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Seasons</Label>
            <div className="flex flex-wrap gap-2">
              {(["Spring", "Summer", "Autumn", "Winter"] as const).map((s) => (
                <button key={s} onClick={() => toggleSeason(s)} className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition ${seasons.includes(s) ? "bg-black text-white" : "bg-white hover:bg-stone-50"}`} aria-pressed={seasons.includes(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-rarity">Rarity</Label>
            <select id="plant-rarity" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" value={rarity} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRarity(e.target.value as Plant["rarity"])}>
              {(["Common", "Uncommon", "Rare", "Legendary"] as const).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-meaning">Meaning</Label>
            <Input id="plant-meaning" value={meaning} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMeaning(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-description">Description</Label>
            <Input id="plant-description" value={description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-image">Image URL</Label>
            <Input id="plant-image" value={imageUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageUrl(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-sunlight">Care: Sunlight</Label>
            <select id="plant-sunlight" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" value={careSunlight} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCareSunlight(e.target.value as Plant["care"]["sunlight"])}>
              {(["Low", "Medium", "High"] as const).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-water">Care: Water</Label>
            <select id="plant-water" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" value={careWater} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCareWater(e.target.value as Plant["care"]["water"]) }>
              {(["Low", "Medium", "High"] as const).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-soil">Care: Soil</Label>
            <Input id="plant-soil" value={careSoil} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCareSoil(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-difficulty">Care: Difficulty</Label>
            <select id="plant-difficulty" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" value={careDifficulty} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCareDifficulty(e.target.value as Plant["care"]["difficulty"]) }>
              {(["Easy", "Moderate", "Hard"] as const).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input id="plant-seeds" type="checkbox" checked={seedsAvailable} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSeedsAvailable(e.target.checked)} />
            <Label htmlFor="plant-seeds">Seeds available</Label>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          {ok && <div className="text-sm text-green-600">{ok}</div>}
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="rounded-2xl" onClick={onCancel}>Cancel</Button>
            <Button className="rounded-2xl" onClick={save} disabled={saving}>Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

