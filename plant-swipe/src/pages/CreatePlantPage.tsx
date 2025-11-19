import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Loader2, Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { PlantProfileForm } from "@/components/plant/PlantProfileForm"
import { fetchAiPlantFill } from "@/lib/aiPlantFill"
import plantSchema from "../../PLANT-INFO-SCHEMA.json"
import type { Plant, PlantColor } from "@/types/plant"
import { useAuth } from "@/context/AuthContext"

function generateUUIDv4(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

const emptyPlant: Plant = {
  id: generateUUIDv4(),
  name: "",
  utility: [],
  comestiblePart: [],
  fruitType: [],
  images: [],
  identity: { givenNames: [], colors: [] },
  plantCare: {},
  growth: {},
  usage: {},
  ecology: {},
  danger: {},
  miscellaneous: {},
  meta: {},
  seasons: [],
  colors: [],
}

async function upsertColors(colors: PlantColor[]) {
  if (!colors?.length) return [] as string[]
  const upsertPayload = colors.map((c) => ({ name: c.name, hex_code: c.hexCode || null }))
  const { data, error } = await supabase.from('colors').upsert(upsertPayload).select('id,name')
  if (error) throw new Error(error.message)
  return (data || []).map((row) => row.id as string)
}

async function linkColors(plantId: string, colorIds: string[]) {
  if (!colorIds.length) return
  await supabase.from('plant_colors').delete().eq('plant_id', plantId)
  const inserts = colorIds.map((id) => ({ plant_id: plantId, color_id: id }))
  const { error } = await supabase.from('plant_colors').insert(inserts)
  if (error) throw new Error(error.message)
}

async function upsertImages(plantId: string, images: Plant["images"]) {
  await supabase.from('plant_images').delete().eq('plant_id', plantId)
  if (!images?.length) return
  const inserts = images.filter((img) => img.link).map((img) => ({ plant_id: plantId, link: img.link, use: img.use || 'other' }))
  if (inserts.length === 0) return
  const { error } = await supabase.from('plant_images').insert(inserts)
  if (error) throw new Error(error.message)
}

export const CreatePlantPage: React.FC<{ onCancel: () => void; onSaved?: (id: string) => void; initialName?: string }> = ({ onCancel, onSaved, initialName }) => {
  const { profile } = useAuth()
  const [plant, setPlant] = React.useState<Plant>(() => ({ ...emptyPlant, name: initialName || "" }))
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [aiWorking, setAiWorking] = React.useState(false)

  const savePlant = async () => {
    if (!plant.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const plantId = plant.id || generateUUIDv4()
      const payload = {
        id: plantId,
        name: plant.name.trim(),
        plant_type: plant.plantType || null,
        utility: plant.utility || [],
        comestible_part: plant.comestiblePart || [],
        fruit_type: plant.fruitType || [],
        identity: plant.identity || {},
        plant_care: plant.plantCare || {},
        growth: plant.growth || {},
        usage: plant.usage || {},
        ecology: plant.ecology || {},
        danger: plant.danger || {},
        miscellaneous: plant.miscellaneous || {},
        meta: {
          ...(plant.meta || {}),
          createdBy: plant.meta?.createdBy || (profile as any)?.full_name || undefined,
        },
        description: plant.identity?.overview || null,
        colors: (plant.identity?.colors || []).map((c) => c.name),
        seasons: plant.identity?.season || [],
      }
      const { data, error: insertError } = await supabase
        .from('plants')
        .upsert(payload)
        .select('id')
        .maybeSingle()
      if (insertError) throw new Error(insertError.message)
      const savedId = data?.id || plantId
      const colorIds = await upsertColors(plant.identity?.colors || [])
      await linkColors(savedId, colorIds)
      await upsertImages(savedId, plant.images || [])
      setPlant({ ...plant, id: savedId })
      onSaved?.(savedId)
    } catch (e: any) {
      setError(e?.message || 'Failed to save plant')
    } finally {
      setSaving(false)
    }
  }

  const runAiFill = async () => {
    setAiWorking(true)
    setError(null)
    try {
      const aiData = await fetchAiPlantFill({ plantName: plant.name || 'Unknown plant', schema: plantSchema })
      if (aiData && typeof aiData === 'object') {
        setPlant((prev) => ({ ...prev, ...(aiData as any), id: prev.id || generateUUIDv4() }))
      }
    } catch (e: any) {
      setError(e?.message || 'AI fill failed')
    } finally {
      setAiWorking(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pb-10 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Create Plant</h1>
          <p className="text-sm text-muted-foreground">Fill every field with the supplied descriptions or let AI help.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={savePlant} disabled={saving || aiWorking}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Plant
          </Button>
        </div>
      </div>
      {error && (
        <Card className="border-red-500">
          <CardContent className="flex gap-2 items-center text-red-700 py-3">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}
      <div className="flex gap-3">
        <Button type="button" onClick={runAiFill} disabled={aiWorking}>
          {aiWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          AI fill all fields
        </Button>
        <p className="text-sm text-muted-foreground self-center">AI will try to populate almost every field based on the provided schema.</p>
      </div>
      <PlantProfileForm value={plant} onChange={setPlant} />
    </div>
  )
}

export default CreatePlantPage
