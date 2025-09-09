import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabaseClient"
import type { Plant } from "@/types/plant"

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
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [ok, setOk] = React.useState<string | null>(null)

  const toggleSeason = (s: Plant["seasons"][number]) => {
    setSeasons((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
  }

  const save = async () => {
    setError(null)
    setOk(null)
    if (!name.trim()) { setError("Name is required"); return }
    if (!scientificName.trim()) { setError("Scientific name is required"); return }
    if (!careSoil.trim()) { setError("Soil is required"); return }
    setSaving(true)
    try {
      const id = crypto.randomUUID()
      const colorArray = colors.split(",").map((c) => c.trim()).filter(Boolean)
      const { error: insErr } = await supabase.from('plants').insert({
        id,
        name,
        scientific_name: scientificName,
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
            <Input id="plant-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-scientific">Scientific name</Label>
            <Input id="plant-scientific" value={scientificName} onChange={(e) => setScientificName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-colors">Colors (comma separated)</Label>
            <Input id="plant-colors" placeholder="Red, Yellow" value={colors} onChange={(e) => setColors(e.target.value)} />
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
            <select id="plant-rarity" className="h-9 rounded-md border px-3 text-sm" value={rarity} onChange={(e) => setRarity(e.target.value as Plant["rarity"])}>
              {(["Common", "Uncommon", "Rare", "Legendary"] as const).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-meaning">Meaning</Label>
            <Input id="plant-meaning" value={meaning} onChange={(e) => setMeaning(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-description">Description</Label>
            <Input id="plant-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-image">Image URL</Label>
            <Input id="plant-image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-sunlight">Care: Sunlight</Label>
            <select id="plant-sunlight" className="h-9 rounded-md border px-3 text-sm" value={careSunlight} onChange={(e) => setCareSunlight(e.target.value as Plant["care"]["sunlight"])}>
              {(["Low", "Medium", "High"] as const).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-water">Care: Water</Label>
            <select id="plant-water" className="h-9 rounded-md border px-3 text-sm" value={careWater} onChange={(e) => setCareWater(e.target.value as Plant["care"]["water"]) }>
              {(["Low", "Medium", "High"] as const).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-soil">Care: Soil</Label>
            <Input id="plant-soil" value={careSoil} onChange={(e) => setCareSoil(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plant-difficulty">Care: Difficulty</Label>
            <select id="plant-difficulty" className="h-9 rounded-md border px-3 text-sm" value={careDifficulty} onChange={(e) => setCareDifficulty(e.target.value as Plant["care"]["difficulty"]) }>
              {(["Easy", "Moderate", "Hard"] as const).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input id="plant-seeds" type="checkbox" checked={seedsAvailable} onChange={(e) => setSeedsAvailable(e.target.checked)} />
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

