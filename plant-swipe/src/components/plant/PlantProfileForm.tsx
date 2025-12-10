import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import { plantFormCategoryOrder, type CategoryProgress, type PlantFormCategory } from "@/lib/plantFormCategories"
import type { Plant, PlantColor, PlantImage, PlantSource, PlantType, PlantWateringSchedule } from "@/types/plant"
import { supabase } from "@/lib/supabaseClient"
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react"
import { SearchInput } from "@/components/ui/search-input"
import { FORM_STATUS_COLORS } from "@/constants/plantStatus"

export type PlantProfileFormProps = {
  value: Plant
  onChange: (plant: Plant) => void
  colorSuggestions?: PlantColor[]
  categoryProgress?: CategoryProgress
}

const neuCardClass =
  "rounded-2xl border border-emerald-100/80 dark:border-emerald-900/50 bg-gradient-to-br " +
  "from-emerald-50/80 via-emerald-100/70 to-white/80 dark:from-[#0f1a12] dark:via-[#0c140f] dark:to-[#0a120d] " +
  "shadow-[0_18px_50px_-26px_rgba(16,185,129,0.35)] dark:shadow-[0_22px_65px_-40px_rgba(0,0,0,0.65)]"

const normalizeHex = (hex?: string) => {
  if (!hex) return ""
  const trimmed = hex.trim()
  if (!trimmed) return ""
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`
}

type FieldType =
  | "text"
  | "textarea"
  | "tags"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "dict"
  | "watering"
  | "companions"
  | "sources"
  | "readonly"
  | "temperature"

type FieldOption = string | { label: string; value: string | number }

interface FieldConfig {
  key: string
  label: string
  description: string
  type: FieldType
  options?: ReadonlyArray<FieldOption>
}

const sanitizeOptionKey = (value: unknown) => {
  if (value === null || value === undefined) return "value"
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_") || "value"
}

const monthOptions = [
  { label: "January", value: 1 },
  { label: "February", value: 2 },
  { label: "March", value: 3 },
  { label: "April", value: 4 },
  { label: "May", value: 5 },
  { label: "June", value: 6 },
  { label: "July", value: 7 },
  { label: "August", value: 8 },
  { label: "September", value: 9 },
  { label: "October", value: 10 },
  { label: "November", value: 11 },
  { label: "December", value: 12 },
] as const

const monthLookup = monthOptions.reduce((acc, option) => {
  const lower = option.label.toLowerCase()
  acc[lower] = option.value
  acc[lower.slice(0, 3)] = option.value
  acc[String(option.value)] = option.value
  acc[option.value.toString().padStart(2, '0')] = option.value
  return acc
}, {} as Record<string, number>)

const normalizeMonthValue = (input: unknown): number | null => {
  if (typeof input === "number" && Number.isFinite(input)) {
    const int = Math.round(input)
    if (int >= 1 && int <= 12) return int
  }
  if (typeof input === "string") {
    const trimmed = input.trim().toLowerCase()
    if (!trimmed) return null
    if (monthLookup[trimmed]) return monthLookup[trimmed]
  }
  return null
}

const normalizeMonthArray = (value: unknown): number[] => {
  if (value === null || value === undefined) return []
  const source = Array.isArray(value) ? value : [value]
  const result: number[] = []
  for (const entry of source) {
    const normalized = normalizeMonthValue(entry)
    if (normalized && !result.includes(normalized)) result.push(normalized)
  }
  return result
}

const TagInput: React.FC<{ value: string[]; onChange: (v: string[]) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => {
  const [input, setInput] = React.useState("")
  const commit = () => {
    const v = input.trim()
    if (!v) return
    onChange([...value, v])
    setInput("")
  }
  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } }} placeholder={placeholder || "Add item and press Enter"} />
        <Button type="button" onClick={commit}>Add</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {value.map((tag, idx) => (
          <span key={`${tag}-${idx}`} className="px-2 py-1 bg-stone-100 dark:bg-[#2d2d30] rounded text-sm flex items-center gap-1">
            {tag}
            <button type="button" className="text-red-600" onClick={() => onChange(value.filter((_, i) => i !== idx))}>×</button>
          </span>
        ))}
      </div>
    </div>
  )
}

const CompanionSelector: React.FC<{ value: string[]; onChange: (ids: string[]) => void }> = ({ value, onChange }) => {
  const [companions, setCompanions] = React.useState<{ id: string; name: string }[]>([])
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [results, setResults] = React.useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    setCompanions((prev) => prev.filter((c) => value.includes(c.id)))
  }, [value])

  React.useEffect(() => {
    const missing = value.filter((id) => !companions.find((c) => c.id === id))
    if (!missing.length) return
    const loadMissing = async () => {
      const { data } = await supabase.from('plants').select('id,name').in('id', missing)
      if (data) {
        setCompanions((prev) => [...prev, ...data.map((p) => ({ id: p.id as string, name: (p as any).name as string }))])
      }
    }
    loadMissing()
  }, [companions, value])

  const searchPlants = async () => {
    setLoading(true)
    const query = supabase.from('plants').select('id,name').order('name').limit(20)
    if (search.trim()) query.ilike('name', `%${search.trim()}%`)
    const { data } = await query
    setResults((data || []).map((p) => ({ id: p.id as string, name: (p as any).name as string })))
    setLoading(false)
  }

  React.useEffect(() => {
    if (open) searchPlants()
  }, [open])

  const addCompanion = (plant: { id: string; name: string }) => {
    if (value.includes(plant.id)) { setOpen(false); return }
    onChange([...value, plant.id])
    setCompanions((prev) => [...prev, plant])
    setOpen(false)
  }

  const removeCompanion = (id: string) => {
    onChange(value.filter((c) => c !== id))
    setCompanions((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {value.length === 0 && <span className="text-sm text-muted-foreground">No companions added yet.</span>}
        {companions.map((c) => (
          <span key={c.id} className="px-2 py-1 bg-stone-100 dark:bg-[#2d2d30] rounded text-sm flex items-center gap-1">
            {c.name || c.id}
            <button type="button" className="text-red-600" onClick={() => removeCompanion(c.id)}>×</button>
          </span>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline">Add Companion</Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select a companion plant</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 items-center">
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plants by name" loading={loading} className="flex-1" />
            <Button type="button" onClick={searchPlants} disabled={loading}>{loading ? 'Searching...' : 'Search'}</Button>
          </div>
          <div className="max-h-80 overflow-y-auto space-y-2 mt-3">
            {(results || []).map((plant) => (
              <button
                key={plant.id}
                type="button"
                className="w-full text-left rounded border px-3 py-2 hover:bg-muted"
                onClick={() => addCompanion(plant)}
              >
                <div className="font-semibold">{plant.name}</div>
                <div className="text-xs text-muted-foreground">{plant.id}</div>
              </button>
            ))}
            {!results.length && !loading && (
              <div className="text-sm text-muted-foreground">No plants found.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const WateringScheduleEditor: React.FC<{
  value: PlantWateringSchedule[] | undefined
  onChange: (schedules: PlantWateringSchedule[]) => void
}> = ({ value, onChange }) => {
  const { t } = useTranslation('common')
  const schedules = Array.isArray(value) ? value : []
  const [draft, setDraft] = React.useState<PlantWateringSchedule>({ season: "", quantity: undefined, timePeriod: undefined })
  const addDraft = () => {
    if (!(draft.season?.trim() || draft.quantity !== undefined || draft.timePeriod)) return
    onChange([...schedules, { season: draft.season?.trim(), quantity: draft.quantity, timePeriod: draft.timePeriod }])
    setDraft({ season: "", quantity: undefined, timePeriod: draft.timePeriod })
  }
  const update = (idx: number, patch: Partial<PlantWateringSchedule>) => {
    onChange(
      schedules.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    )
  }
  const remove = (idx: number) => onChange(schedules.filter((_, i) => i !== idx))
    return (
      <div className="grid gap-3">
          {schedules.map((schedule, idx) => (
          <div key={`${schedule.season}-${idx}`} className="grid gap-2 rounded border p-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                  placeholder={t('plantAdmin.watering.seasonPlaceholder', 'Season (optional)')}
                value={schedule.season || ""}
                onChange={(e) => update(idx, { season: e.target.value })}
              />
              <Input
                  placeholder={t('plantAdmin.watering.quantityPlaceholder', 'Quantity')}
                type="number"
                value={schedule.quantity ?? ""}
                onChange={(e) => {
                  const nextVal = e.target.value === "" ? undefined : parseInt(e.target.value, 10)
                  update(idx, { quantity: Number.isFinite(nextVal as number) ? nextVal : undefined })
                }}
              />
              <select
                className="h-9 rounded-md border px-2 text-sm"
                value={schedule.timePeriod || ""}
                onChange={(e) => update(idx, { timePeriod: e.target.value ? (e.target.value as any) : undefined })}
              >
                  <option value="">{t('plantAdmin.watering.timePeriodPlaceholder', 'Time period')}</option>
                  {(['week', 'month', 'year'] as const).map((opt) => (
                    <option key={opt} value={opt}>
                      {t(`plantAdmin.optionLabels.${opt}`, opt)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" type="button" onClick={() => remove(idx)} className="text-red-600">
                  {t('plantAdmin.actions.remove', 'Remove')}
              </Button>
            </div>
          </div>
        ))}
        <div className="grid gap-2 rounded border border-dashed p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input
                placeholder={t('plantAdmin.watering.seasonPlaceholder', 'Season (optional)')}
              value={draft.season}
              onChange={(e) => setDraft((d) => ({ ...d, season: e.target.value }))}
            />
            <Input
                placeholder={t('plantAdmin.watering.quantityPlaceholder', 'Quantity')}
              type="number"
              value={draft.quantity ?? ""}
              onChange={(e) => {
                const nextVal = e.target.value === "" ? undefined : parseInt(e.target.value, 10)
                setDraft((d) => ({ ...d, quantity: Number.isFinite(nextVal as number) ? nextVal : undefined }))
                }}
              />
            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={draft.timePeriod || ""}
              onChange={(e) => setDraft((d) => ({ ...d, timePeriod: e.target.value ? (e.target.value as any) : undefined }))}
            >
                <option value="">{t('plantAdmin.watering.timePeriodPlaceholder', 'Time period')}</option>
                {(['week', 'month', 'year'] as const).map((opt) => (
                  <option key={opt} value={opt}>
                    {t(`plantAdmin.optionLabels.${opt}`, opt)}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
              <span>{t('plantAdmin.watering.helper', 'Season is optional. Add as many watering schedules as needed.')}</span>
            <Button
              type="button"
              onClick={addDraft}
              disabled={!(draft.season?.trim() || draft.quantity !== undefined || draft.timePeriod)}
            >
                {t('plantAdmin.watering.addSchedule', 'Add schedule')}
            </Button>
          </div>
        </div>
      </div>
    )
}

const KeyValueList: React.FC<{ value: Record<string, string>; onChange: (v: Record<string, string>) => void; keyLabel?: string; valueLabel?: string }> = ({ value, onChange, keyLabel, valueLabel }) => {
  const [k, setK] = React.useState("")
  const [v, setV] = React.useState("")
  const commit = () => {
    if (!k.trim() || !v.trim()) return
    onChange({ ...value, [k.trim()]: v.trim() })
    setK("")
    setV("")
  }
  return (
    <div className="grid gap-2">
      <div className="flex flex-col md:flex-row gap-2">
        <Input value={k} onChange={(e) => setK(e.target.value)} placeholder={keyLabel || "Name"} />
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={valueLabel || "Details"} />
        <Button type="button" onClick={commit}>Add</Button>
      </div>
      <div className="space-y-1">
        {Object.entries(value).map(([key, val]) => (
          <div key={key} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
            <div className="font-medium">{key}</div>
            <div className="text-muted-foreground">{val}</div>
            <button type="button" className="text-red-600" onClick={() => {
              const copy = { ...value }
              delete copy[key]
              onChange(copy)
            }}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  )
}

const SourcesEditor: React.FC<{ value: PlantSource[] | undefined; onChange: (v: PlantSource[]) => void }> = ({ value, onChange }) => {
  const sources = Array.isArray(value) ? value : []
  const [draft, setDraft] = React.useState<PlantSource>({ name: "", url: "" })
  const addSource = () => {
    if (!draft.name?.trim()) return
    onChange([...sources, { name: draft.name.trim(), url: draft.url?.trim() || undefined }])
    setDraft({ name: "", url: "" })
  }
  const remove = (idx: number) => onChange(sources.filter((_, i) => i !== idx))
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 rounded border border-dashed p-3 bg-white/60 dark:bg-black/10">
        <Input
          placeholder="Source name"
          value={draft.name || ""}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        <Input
          placeholder="https://example.com"
          value={draft.url || ""}
          onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Add multiple references as needed.</span>
          <Button type="button" onClick={addSource} disabled={!draft.name?.trim()}>
            Add source
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {sources.map((src, idx) => (
          <div key={`${src.name}-${idx}`} className="flex items-center justify-between rounded border px-3 py-2 bg-white/70 dark:bg-[#161d16]">
            <div className="flex flex-col">
              <span className="font-medium">{src.name}</span>
              {src.url && (
                <a href={src.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline break-all">
                  {src.url}
                </a>
              )}
            </div>
            <button type="button" className="text-red-600" onClick={() => remove(idx)} aria-label="Remove source">
              ×
            </button>
          </div>
        ))}
        {!sources.length && <p className="text-xs text-muted-foreground">No sources added yet.</p>}
      </div>
    </div>
  )
}

function getValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj)
}

function setValue(obj: any, path: string, val: any): any {
  const parts = path.split('.')
  const next = Array.isArray(obj) ? [...obj] : { ...obj }
  let cur: any = next
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    cur[p] = cur[p] ? { ...cur[p] } : {}
    cur = cur[p]
  }
  cur[parts[parts.length - 1]] = val
  return next
}

const identityFields: FieldConfig[] = [
  { key: "identity.givenNames", label: "Given Names", description: "Common names given to the plant", type: "tags" },
  { key: "identity.scientificName", label: "Scientific Name", description: "Scientific name", type: "text" },
  { key: "identity.family", label: "Family", description: "Botanical family", type: "text" },
  { key: "identity.overview", label: "Overview", description: "Long presentation of the plant", type: "textarea" },
  { key: "identity.promotionMonth", label: "Promotion Month", description: "Month the plant should be promoted", type: "select", options: monthOptions },
  { key: "identity.lifeCycle", label: "Life Cycle", description: "Lifecycle classification", type: "select", options: ["Annual","Biennials","Perenials","Ephemerals","Monocarpic","Polycarpic"] },
  { key: "identity.season", label: "Season", description: "Seasons where the plant is active", type: "multiselect", options: ["Spring","Summer","Autumn","Winter"] },
  { key: "identity.foliagePersistance", label: "Foliage Persistance", description: "Leaf persistence type", type: "select", options: ["Deciduous","Evergreen","Semi-Evergreen","Marcescent"] },
  { key: "identity.spiked", label: "Spiked", description: "Does the plant have spikes?", type: "boolean" },
  { key: "identity.toxicityHuman", label: "Toxicity (Human)", description: "Human toxicity level", type: "select", options: ["Non-Toxic","Midly Irritating","Highly Toxic","Lethally Toxic"] },
  { key: "identity.toxicityPets", label: "Toxicity (Pets)", description: "Pet toxicity level", type: "select", options: ["Non-Toxic","Midly Irritating","Highly Toxic","Lethally Toxic"] },
  { key: "identity.allergens", label: "Allergens", description: "List of possible allergens", type: "tags" },
  { key: "identity.scent", label: "Scent", description: "Does the plant have a scent", type: "boolean" },
  { key: "identity.symbolism", label: "Symbolism", description: "Symbolism and cultural meaning", type: "tags" },
  { key: "identity.livingSpace", label: "Living Space", description: "Indoor/Outdoor/Both", type: "select", options: ["Indoor","Outdoor","Both"] },
  { key: "identity.composition", label: "Composition", description: "Where to plant (flowerbed, pot, etc.)", type: "multiselect", options: ["Flowerbed","Path","Hedge","Ground Cover","Pot"] },
  { key: "identity.maintenanceLevel", label: "Maintenance Level", description: "Care effort", type: "select", options: ["None","Low","Moderate","Heavy"] },
]

const careFields: FieldConfig[] = [
  { key: "plantCare.origin", label: "Origin", description: "Where the plant originates from", type: "tags" },
  { key: "plantCare.habitat", label: "Habitat", description: "Habitat types", type: "multiselect", options: ["Aquatic","Semi-Aquatic","Wetland","Tropical","Temperate","Arid","Mediterranean","Mountain","Grassland","Forest","Coastal","Urban"] },
  { key: "plantCare.temperature", label: "Temperature", description: "Temperature range (°C)", type: "temperature" },
  { key: "plantCare.levelSun", label: "Level Sun", description: "Sun exposure level", type: "select", options: ["Low Light","Shade","Partial Sun","Full Sun"] },
  { key: "plantCare.hygrometry", label: "Hygrometry", description: "Ideal humidity percentage", type: "number" },
  { key: "plantCare.watering.schedules", label: "Watering Schedule", description: "Seasonal watering (season + quantity + period)", type: "watering" },
  { key: "plantCare.wateringType", label: "Watering Type", description: "Watering methods", type: "multiselect", options: ["surface","buried","hose","drop","drench"] },
  { key: "plantCare.division", label: "Division", description: "Propagation techniques", type: "multiselect", options: ["Seed","Cutting","Division","Layering","Grafting","Tissue Separation","Bulb separation"] },
  { key: "plantCare.soil", label: "Soil", description: "Soil options", type: "multiselect", options: ["Vermiculite","Perlite","Sphagnum moss","rock wool","Sand","Gravel","Potting Soil","Peat","Clay pebbles","coconut fiber","Bark","Wood Chips"] },
  { key: "plantCare.adviceSoil", label: "Advice Soil", description: "Advice about soil", type: "textarea" },
  { key: "plantCare.mulching", label: "Mulching", description: "Mulching materials", type: "multiselect", options: ["Wood Chips","Bark","Green Manure","Cocoa Bean Hulls","Buckwheat Hulls","Cereal Straw","Hemp Straw","Woven Fabric","Pozzolana","Crushed Slate","Clay Pellets"] },
  { key: "plantCare.adviceMulching", label: "Advice Mulching", description: "Mulching notes", type: "textarea" },
  { key: "plantCare.nutritionNeed", label: "Nutrition Need", description: "Nutrient needs", type: "multiselect", options: ["Nitrogen","Phosphorus","Potassium","Calcium","Magnesium","Sulfur","Iron","Boron","Manganese","Molybene","Chlorine","Copper","Zinc","Nitrate","Phosphate"] },
  { key: "plantCare.fertilizer", label: "Fertilizer", description: "Fertilizer choices", type: "multiselect", options: ["Granular fertilizer","Liquid Fertilizer","Meat Flour","Fish flour","Crushed bones","Crushed Horns","Slurry","Manure","Animal excrement","Sea Fertilizer","Yurals","Wine","guano","Coffee Grounds","Banana peel","Eggshell","Vegetable cooking water","Urine","Grass Clippings","Vegetable Waste","Natural Mulch"] },
  { key: "plantCare.adviceFertilizer", label: "Advice Fertilizer", description: "Fertilizer advice", type: "textarea" },
]

const growthFields: FieldConfig[] = [
  { key: "growth.sowingMonth", label: "Sowing Month", description: "Months to sow", type: "multiselect", options: monthOptions },
  { key: "growth.floweringMonth", label: "Flowering Month", description: "Months of flowering", type: "multiselect", options: monthOptions },
  { key: "growth.fruitingMonth", label: "Fruiting Month", description: "Months of fruiting", type: "multiselect", options: monthOptions },
  { key: "growth.height", label: "Height (cm)", description: "Average height", type: "number" },
  { key: "growth.wingspan", label: "Wingspan (cm)", description: "Average wingspan", type: "number" },
  { key: "growth.tutoring", label: "Tutoring", description: "Needs support", type: "boolean" },
  { key: "growth.adviceTutoring", label: "Advice Tutoring", description: "Support details", type: "textarea" },
  { key: "growth.sowType", label: "Sow Type", description: "Planting method", type: "multiselect", options: ["Direct","Indoor","Row","Hill","Broadcast","Seed Tray","Cell","Pot"] },
  { key: "growth.separation", label: "Separation (cm)", description: "Spacing of sowing", type: "number" },
  { key: "growth.transplanting", label: "Transplanting", description: "Needs transplanting", type: "boolean" },
  { key: "growth.adviceSowing", label: "Advice Sowing", description: "Sowing notes", type: "textarea" },
  { key: "growth.cut", label: "Cut", description: "Type of cut", type: "text" },
]

const usageFields: FieldConfig[] = [
  { key: "usage.adviceMedicinal", label: "Advice Medicinal", description: "Medicinal usage details", type: "textarea" },
  { key: "usage.nutritionalIntake", label: "Nutritional Intake", description: "Nutritional tags", type: "tags" },
  { key: "usage.infusion", label: "Infusion", description: "Can be used for infusion", type: "boolean" },
  { key: "usage.adviceInfusion", label: "Advice Infusion", description: "Infusion notes", type: "textarea" },
  { key: "usage.infusionMix", label: "Infusion Mix", description: "Mix name to benefit", type: "dict" },
  { key: "usage.recipesIdeas", label: "Recipes Ideas", description: "Recipe names", type: "tags" },
  { key: "usage.aromatherapy", label: "Aromatherapy", description: "Usable for essential oils", type: "boolean" },
  { key: "usage.spiceMixes", label: "Spice Mixes", description: "Spice mix names", type: "tags" },
]

const ecologyFields: FieldConfig[] = [
  { key: "ecology.melliferous", label: "Melliferous", description: "Good for pollinators", type: "boolean" },
  { key: "ecology.polenizer", label: "Polenizer", description: "Pollinator species", type: "multiselect", options: ["Bee","Wasp","Ant","Butterfly","Bird","Mosquito","Fly","Beetle","ladybug","Stagbeetle","Cockchafer","dungbeetle","weevil"] },
  { key: "ecology.beFertilizer", label: "Be Fertilizer", description: "Acts as fertilizer for others", type: "boolean" },
  { key: "ecology.groundEffect", label: "Ground Effect", description: "Effect on soil", type: "textarea" },
  { key: "ecology.conservationStatus", label: "Conservation Status", description: "Status in the wild", type: "select", options: ["Safe","At Risk","Vulnerable","Endangered","Critically Endangered","Extinct"] },
]

const dangerFields: FieldConfig[] = [
  { key: "danger.pests", label: "Pests", description: "Pest list", type: "tags" },
  { key: "danger.diseases", label: "Diseases", description: "Disease list", type: "tags" },
]

const miscFields: FieldConfig[] = [
  { key: "miscellaneous.companions", label: "Companions", description: "Companion plants", type: "companions" },
  { key: "miscellaneous.tags", label: "Tags", description: "Search tags", type: "tags" },
  { key: "miscellaneous.sources", label: "Sources", description: "Reference links", type: "sources" },
]

const metaFields: FieldConfig[] = [
  { key: "meta.status", label: "Status", description: "Editorial status", type: "select", options: ["In Progres","Rework","Review","Approved"] },
  { key: "meta.adminCommentary", label: "Admin Commentary", description: "Moderator feedback", type: "textarea" },
]

const utilityOptions = ["comestible","ornemental","produce_fruit","aromatic","medicinal","odorous","climbing","cereal","spice"] as const
const comestibleOptions = ["flower","fruit","seed","leaf","stem","root","bulb","bark","wood"] as const
const fruitOptions = ["nut","seed","stone"] as const
const plantTypeOptions = ["plant","flower","bamboo","shrub","tree","cactus","succulent"] as const

function renderField(plant: Plant, onChange: (path: string, value: any) => void, field: FieldConfig, t: TFunction<'common'>) {
    const value = getValue(plant, field.key)
    const id = field.key.replace(/\./g, "-")
  const translationBase = `plantAdmin.fields.${field.key}`
  const label = t(`${translationBase}.label`, { defaultValue: field.label })
  const description = t(`${translationBase}.description`, { defaultValue: field.description })
  const selectPlaceholder = t('plantAdmin.selectOption', 'Select option')
  const selectStatusPlaceholder = t('plantAdmin.selectStatus', 'Select status')
  const optionalLabel = t('plantAdmin.optionalLabel', 'optional')
  const isAdvice = field.key.toLowerCase().includes("advice")
    const isMonthMultiField = field.key.startsWith("growth.") && field.key.toLowerCase().includes("month")
    const isPromotionMonthField = field.key === "identity.promotionMonth"
  const translateOption = (optionKey: string, fallback: string) => {
    const fieldScoped = t(`${translationBase}.options.${optionKey}`, { defaultValue: '' })
    if (fieldScoped) return fieldScoped
    const globalScoped = t(`plantAdmin.optionLabels.${optionKey}`, { defaultValue: '' })
    if (globalScoped) return globalScoped
    return fallback
  }

  const normalizedOptions = (field.options || []).map((opt) => {
    const isString = typeof opt === "string"
    const optionValue = isString ? opt : opt.value
    const defaultLabel = isString ? opt : (opt.label ?? String(opt.value))
    const optionKeySource =
      isString
        ? opt
        : (typeof opt.label === "string" && opt.label.trim().length ? opt.label : String(opt.value))
    const optionKey = sanitizeOptionKey(optionKeySource)
    return {
      label: translateOption(optionKey, defaultLabel),
      value: optionValue,
      key: typeof optionValue === "string" ? optionValue : String(optionValue),
    }
  })

  const body = (() => {
    if (field.key === "meta.status") {
      const statusColors: Record<string, string> = FORM_STATUS_COLORS
      const statusOptions = (field.options || []).map((opt) => (typeof opt === "string" ? opt : String(opt.value)))
      return (
          <div className="grid gap-2">
            <Label>{label}</Label>
            <select
              className="h-9 rounded-md border px-3 text-sm"
              value={value || ""}
              onChange={(e) => onChange(field.key, e.target.value)}
            >
              <option value="">{selectStatusPlaceholder}</option>
              {statusOptions.map((opt) => (
                <option key={opt} value={opt} style={{ color: statusColors[opt] || "inherit" }}>
                  ● {translateOption(sanitizeOptionKey(opt), opt)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        )
    }

    switch (field.type) {
      case "text":
        return (
        <div className="grid gap-2">
          <Label htmlFor={id}>{label}</Label>
          <Input id={id} value={value ?? ""} onChange={(e) => onChange(field.key, e.target.value)} placeholder={description} />
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        )
        case "textarea":
          return (
            <div className="grid gap-2">
              <Label htmlFor={id}>{label}</Label>
              <Textarea id={id} value={value ?? ""} onChange={(e) => onChange(field.key, e.target.value)} placeholder={description} />
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          )
        case "number":
          return (
            <div className="grid gap-2">
              <Label htmlFor={id}>{label}</Label>
              <Input
                id={id}
                type="number"
                value={value ?? ""}
                onChange={(e) => onChange(field.key, e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder={description}
              />
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          )
        case "boolean":
          return (
            <div className="grid gap-2">
              <Label className="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border"
                  checked={Boolean(value)}
                  onChange={(e) => onChange(field.key, e.target.checked)}
                />
                {label}
              </Label>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          )
        case "select": {
          const selectValue = isPromotionMonthField ? normalizeMonthValue(value) ?? value : value
          const valueKey =
            normalizedOptions.find((opt) => Object.is(opt.value, selectValue))?.key ??
            (selectValue === null || selectValue === undefined ? "" : String(selectValue))
          return (
            <div className="grid gap-2">
              <Label>{label}</Label>
              <select
                className="h-9 rounded-md border px-2 text-sm"
                value={valueKey}
                onChange={(e) => {
                  if (!e.target.value) {
                    onChange(field.key, undefined)
                    return
                  }
                  const selectedOption = normalizedOptions.find((opt) => opt.key === e.target.value)
                  onChange(field.key, selectedOption ? selectedOption.value : undefined)
                }}
              >
                <option value="">{selectPlaceholder}</option>
                {normalizedOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          )
        }
        case "multiselect": {
          const currentValues = isMonthMultiField ? normalizeMonthArray(value) : (Array.isArray(value) ? [...value] : [])
          const includesValue = (candidate: unknown) =>
            currentValues.some((entry) => Object.is(entry, candidate) || (typeof entry === "string" && typeof candidate === "string" && entry === candidate))
          return (
            <div className="grid gap-2">
              <Label>{label}</Label>
              <div className="flex flex-wrap gap-2">
                {normalizedOptions.map((opt) => {
                  const selected = includesValue(opt.value)
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        const nextValues = selected
                          ? currentValues.filter((entry) => !(Object.is(entry, opt.value) || (typeof entry === "string" && typeof opt.value === "string" && entry === opt.value)))
                          : [...currentValues, opt.value]
                        onChange(field.key, nextValues)
                      }}
                      className={`px-3 py-1 rounded-full border text-sm transition ${selected ? "bg-black text-white dark:bg-white dark:text-black" : "bg-white dark:bg-[#2d2d30]"}`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          )
        }
      case "tags":
        return (
          <div className="grid gap-2">
              <Label>{label}</Label>
            <TagInput value={Array.isArray(value) ? value : []} onChange={(v) => onChange(field.key, v)} />
              <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        )
      case "dict":
        return (
          <div className="grid gap-2">
              <Label>{label}</Label>
            <KeyValueList value={(value as Record<string, string>) || {}} onChange={(v) => onChange(field.key, v)} />
              <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        )
      case "watering":
        return (
          <div className="grid gap-2">
              <Label>{label}</Label>
            <WateringScheduleEditor value={value as any} onChange={(v) => onChange(field.key, v)} />
              <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        )
      case "companions":
        return (
          <div className="grid gap-2">
              <Label>{label}</Label>
            <CompanionSelector value={Array.isArray(value) ? value : []} onChange={(v) => onChange(field.key, v)} />
              <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        )
      case "sources":
        return (
          <div className="grid gap-2">
              <Label>{label}</Label>
            <SourcesEditor value={Array.isArray(value) ? value : []} onChange={(v) => onChange(field.key, v)} />
              <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        )
      case "readonly":
        return (
          <div className="grid gap-2">
              <Label>{label}</Label>
            <Input value={(value as string) || ""} readOnly />
              <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        )
        case "temperature":
          return (
            <div className="grid gap-2">
              <Label>{label}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="grid gap-1">
                  <Label htmlFor={`${id}-min`} className="text-xs text-muted-foreground">
                    {t('plantAdmin.temperature.min', 'Min (°C)')}
                  </Label>
                  <Input
                    id={`${id}-min`}
                    type="number"
                    value={getValue(plant, "plantCare.temperatureMin") ?? ""}
                    onChange={(e) => onChange("plantCare.temperatureMin", e.target.value === "" ? undefined : Number(e.target.value))}
                    placeholder={t('plantAdmin.temperature.minShort', 'Min')}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`${id}-ideal`} className="text-xs text-muted-foreground">
                    {t('plantAdmin.temperature.ideal', 'Ideal (°C)')}
                  </Label>
                  <Input
                    id={`${id}-ideal`}
                    type="number"
                    value={getValue(plant, "plantCare.temperatureIdeal") ?? ""}
                    onChange={(e) => onChange("plantCare.temperatureIdeal", e.target.value === "" ? undefined : Number(e.target.value))}
                    placeholder={t('plantAdmin.temperature.idealShort', 'Ideal')}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`${id}-max`} className="text-xs text-muted-foreground">
                    {t('plantAdmin.temperature.max', 'Max (°C)')}
                  </Label>
                  <Input
                    id={`${id}-max`}
                    type="number"
                    value={getValue(plant, "plantCare.temperatureMax") ?? ""}
                    onChange={(e) => onChange("plantCare.temperatureMax", e.target.value === "" ? undefined : Number(e.target.value))}
                    placeholder={t('plantAdmin.temperature.maxShort', 'Max')}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          )
      default:
        return null
    }
  })()

    const adviceHasValue = (() => {
      if (!isAdvice) return false
      if (typeof value === "string") return value.trim().length > 0
      if (Array.isArray(value)) return value.some((entry) => (typeof entry === "string" ? entry.trim().length > 0 : entry !== null && entry !== undefined))
      if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).some((entry) => {
        if (typeof entry === "string") return entry.trim().length > 0
        return entry !== null && entry !== undefined
      })
      return false
    })()

    if (isAdvice) {
      if (adviceHasValue) {
        return (
          <div key={field.key} className="rounded border border-emerald-200/60 dark:border-emerald-900/40 bg-white/80 dark:bg-[#101610] p-3">
            {body}
          </div>
        )
      }
    return (
      <details key={field.key} className="rounded border bg-muted/20 p-3" open={false}>
        <summary className="cursor-pointer text-sm font-semibold">
          {label} ({optionalLabel})
        </summary>
        <div className="mt-3">{body}</div>
      </details>
    )
    }

  return <div key={field.key}>{body}</div>
}

function ImageEditor({ images, onChange }: { images: PlantImage[]; onChange: (v: PlantImage[]) => void }) {
  const list = Array.isArray(images) ? images : []
  const [previewErrors, setPreviewErrors] = React.useState<Record<string, boolean>>({})
  const [isCollapsed, setIsCollapsed] = React.useState<boolean>(true)

  // Count images by type
  const primaryCount = list.filter((img) => img.use === "primary").length
  const discoveryCount = list.filter((img) => img.use === "discovery").length
  const otherCount = list.filter((img) => img.use === "other" || !img.use).length

  const getPreviewKey = (img: PlantImage, idx: number) => img.id || img.link || `idx-${idx}`

  const updateImage = (idx: number, patch: Partial<PlantImage>) => {
    const next = list.map((img, i) => (i === idx ? { ...img, ...patch } : img))
    onChange(next)
    if (Object.prototype.hasOwnProperty.call(patch, 'link')) {
      const key = getPreviewKey(list[idx], idx)
      setPreviewErrors((prev) => {
        if (!prev[key]) return prev
        const clone = { ...prev }
        delete clone[key]
        return clone
      })
    }
  }

  const setUse = (idx: number, use: "primary" | "discovery" | "other") => {
    onChange(
      list.map((img, i) => {
        if (i === idx) return { ...img, use }
        // Enforce only 1 Primary and 1 Discovery - convert existing to "other"
        if (use === "primary" && img.use === "primary") return { ...img, use: "other" }
        if (use === "discovery" && img.use === "discovery") return { ...img, use: "other" }
        return img
      }),
    )
  }

  const addImage = () => {
    const hasPrimary = list.some((img) => img.use === "primary")
    onChange([...list, { link: "", use: hasPrimary ? "other" : "primary" }])
    // Auto-expand when adding an image
    setIsCollapsed(false)
  }

  const removeImage = (idx: number) => {
    const next = list.filter((_, i) => i !== idx)
    onChange(next)
  }

  const moveImage = (idx: number, direction: -1 | 1) => {
    const target = idx + direction
    if (target < 0 || target >= list.length) return
    const next = [...list]
    const [item] = next.splice(idx, 1)
    next.splice(target, 0, item)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 text-sm font-semibold hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            <Label className="font-semibold cursor-pointer">Images</Label>
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          {list.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({list.length} total: {primaryCount > 0 ? `${primaryCount} Primary` : ''}{primaryCount > 0 && discoveryCount > 0 ? ', ' : ''}{discoveryCount > 0 ? `${discoveryCount} Discovery` : ''}{(primaryCount > 0 || discoveryCount > 0) && otherCount > 0 ? ', ' : ''}{otherCount > 0 ? `${otherCount} Other` : ''})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <Button type="button" variant="outline" onClick={addImage}>
              Add image
            </Button>
          )}
        </div>
      </div>
      
      {isCollapsed ? (
        // Collapsed view: Show small thumbnails
        <div>
          {list.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No images yet. Click to expand and add images.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {list.map((img, idx) => {
                const previewKey = getPreviewKey(img, idx)
                const hasError = previewErrors[previewKey]
                const useLabel = img.use === 'primary' ? 'P' : img.use === 'discovery' ? 'D' : 'O'
                return (
                  <div
                    key={previewKey}
                    className="relative group rounded-lg border overflow-hidden bg-muted/30"
                    style={{ width: '80px', height: '80px' }}
                  >
                    {img.link && !hasError ? (
                      <img
                        src={img.link}
                        alt={`Plant image ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={() => setPreviewErrors((prev) => ({ ...prev, [previewKey]: true }))}
                        onLoad={() =>
                          setPreviewErrors((prev) => {
                            if (!prev[previewKey]) return prev
                            const clone = { ...prev }
                            delete clone[previewKey]
                            return clone
                          })
                        }
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">No image</span>
                      </div>
                    )}
                    <div className="absolute top-1 right-1 bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                      {useLabel}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">Click to expand and edit images. Only 1 Primary (detail pages) and 1 Discovery (list cards) allowed. Add unlimited Other images for the gallery.</p>
        </div>
      ) : (
        // Expanded view: Show full editor
        <>
          {!list.length && (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No images yet. Click "Add image" to start.
            </div>
          )}
          <div className="space-y-3">
            {list.map((img, idx) => {
              const previewKey = getPreviewKey(img, idx)
              const hasError = previewErrors[previewKey]
              return (
                <div key={previewKey} className="rounded-xl border p-3 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="sm:w-48">
                      <div className="relative h-32 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden">
                        {img.link && !hasError ? (
                          <img
                            src={img.link}
                            alt={`Plant image ${idx + 1}`}
                            className="h-full w-full object-cover"
                            onError={() => setPreviewErrors((prev) => ({ ...prev, [previewKey]: true }))}
                            onLoad={() =>
                              setPreviewErrors((prev) => {
                                if (!prev[previewKey]) return prev
                                const clone = { ...prev }
                                delete clone[previewKey]
                                return clone
                              })
                            }
                          />
                        ) : (
                          <span className="px-4 text-center text-xs text-muted-foreground">
                            {img.link && hasError ? 'Preview failed - double-check the URL.' : 'Preview appears after entering a valid URL.'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      <Input
                        value={img.link || ""}
                        onChange={(e) => updateImage(idx, { link: e.target.value })}
                        placeholder="https://example.com/photo.jpg"
                      />
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Usage</span>
                        {(["primary","discovery","other"] as const).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setUse(idx, opt)}
                            className={`px-3 py-1 rounded-full border text-xs uppercase tracking-wide ${
                              (img.use || 'other') === opt ? "bg-black text-white dark:bg-white dark:text-black" : "bg-white dark:bg-[#2d2d30]"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {img.use === 'primary'
                          ? 'Hero/detail image (only 1 allowed).'
                          : img.use === 'discovery'
                            ? 'Discovery cards/lists (only 1 allowed).'
                            : 'Gallery image (unlimited).'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" onClick={() => moveImage(idx, -1)} disabled={idx === 0}>
                        Move up
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => moveImage(idx, 1)} disabled={idx === list.length - 1}>
                        Move down
                      </Button>
                    </div>
                    <Button type="button" variant="ghost" className="text-red-600" onClick={() => removeImage(idx)}>
                      Remove
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

interface ColorWithMeta extends PlantColor {
  isPrimary?: boolean
}

// Helper functions for color manipulation
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) {
    const shortResult = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex)
    if (shortResult) {
      return {
        r: parseInt(shortResult[1] + shortResult[1], 16),
        g: parseInt(shortResult[2] + shortResult[2], 16),
        b: parseInt(shortResult[3] + shortResult[3], 16),
      }
    }
    return null
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

function getHue(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 999
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min
  let hue = 0
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6
    else if (max === g) hue = (b - r) / delta + 2
    else hue = (r - g) / delta + 4
    hue = Math.round(hue * 60)
    if (hue < 0) hue += 360
  }
  return hue
}

function colorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1), rgb2 = hexToRgb(hex2)
  if (!rgb1 || !rgb2) return Infinity
  const dr = rgb1.r - rgb2.r, dg = rgb1.g - rgb2.g, db = rgb1.b - rgb2.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function isValidHex(hex: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)
}

function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#000000'
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

function ColorPicker({ colors, onChange }: { colors: PlantColor[]; onChange: (v: PlantColor[]) => void }) {
  const { t } = useTranslation('common')
  const [open, setOpen] = React.useState(false)
  const [allColors, setAllColors] = React.useState<ColorWithMeta[]>([])
  const [primaryColors, setPrimaryColors] = React.useState<ColorWithMeta[]>([])
  const [loading, setLoading] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [mode, setMode] = React.useState<'pick' | 'create'>('pick')
  
  // Create mode state
  const [insertName, setInsertName] = React.useState("")
  const [insertHex, setInsertHex] = React.useState("#")
  const [insertIsPrimary, setInsertIsPrimary] = React.useState(false)
  const [insertParentIds, setInsertParentIds] = React.useState<string[]>([])
  const [inserting, setInserting] = React.useState(false)

  // Load all colors once when dialog opens
  const loadColors = React.useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('colors').select('id,name,hex_code,is_primary')
    const mapped = (data || []).map((row) => ({ 
      id: row.id as string, 
      name: row.name as string, 
      hexCode: (row as any).hex_code as string | undefined,
      isPrimary: row.is_primary as boolean
    }))
    setAllColors(mapped)
    setPrimaryColors(mapped.filter(c => c.isPrimary))
    setLoading(false)
  }, [])

  React.useEffect(() => {
    if (open) loadColors()
  }, [open, loadColors])

  // Filter and sort colors based on search
  const filteredColors = React.useMemo(() => {
    let result = allColors
    const query = search.trim().toLowerCase()
    
    if (query) {
      // Check if search looks like a hex code
      const isHexSearch = query.startsWith('#') || /^[a-f0-9]{3,6}$/i.test(query)
      
      if (isHexSearch) {
        const searchHex = normalizeHex(query)
        if (isValidHex(searchHex)) {
          // Sort by color distance for approximate hex match
          result = [...allColors]
            .map(c => ({ color: c, distance: c.hexCode ? colorDistance(searchHex, c.hexCode) : Infinity }))
            .sort((a, b) => a.distance - b.distance)
            .map(item => item.color)
        }
      } else {
        // Name search
        result = allColors.filter(c => c.name.toLowerCase().includes(query))
      }
    }
    
    // Sort by hue if not searching by hex
    if (!query || !query.startsWith('#')) {
      result = [...result].sort((a, b) => {
        const hueA = a.hexCode ? getHue(a.hexCode) : 999
        const hueB = b.hexCode ? getHue(b.hexCode) : 999
        return hueA - hueB
      })
    }
    
    return result
  }, [allColors, search])

  // Similar colors for create mode
  const similarColors = React.useMemo(() => {
    const hex = normalizeHex(insertHex)
    if (!isValidHex(hex)) return []
    return allColors
      .filter(c => c.hexCode && isValidHex(c.hexCode))
      .map(c => ({ color: c, distance: colorDistance(hex, c.hexCode!) }))
      .filter(item => item.distance < 80 && item.distance > 0)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 6)
      .map(item => item.color)
  }, [allColors, insertHex])

  const alreadyAdded = (candidate: PlantColor) => 
    (colors || []).some((c) => (c.id && candidate.id && c.id === candidate.id) || c.name.toLowerCase() === candidate.name.toLowerCase())

  const addColor = (c: PlantColor) => {
    if (alreadyAdded(c)) return
    onChange([...(colors || []), { id: c.id, name: c.name, hexCode: c.hexCode }])
    setOpen(false)
    setSearch("")
  }

  const toggleParent = (parentId: string) => {
    setInsertParentIds(prev => 
      prev.includes(parentId) ? prev.filter(id => id !== parentId) : [...prev, parentId]
    )
  }

  const autoTranslateColor = async (colorId: string, colorName: string) => {
    try {
      const { translateText } = await import('@/lib/deepl')
      const { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } = await import('@/lib/i18n')
      const translations: { color_id: string; language: string; name: string }[] = []
      for (const lang of SUPPORTED_LANGUAGES) {
        if (lang === DEFAULT_LANGUAGE) continue
        try {
          const translated = await translateText(colorName, lang, DEFAULT_LANGUAGE)
          if (translated && translated !== colorName) {
            translations.push({ color_id: colorId, language: lang, name: translated })
          }
        } catch (e) { console.error(`Failed to translate to ${lang}:`, e) }
      }
      if (translations.length > 0) {
        await supabase.from('color_translations').upsert(translations, { onConflict: 'color_id,language' })
      }
    } catch (e) { console.error('Auto-translate failed:', e) }
  }

  const handleInsert = async () => {
    if (!insertName.trim()) return
    if (!insertIsPrimary && insertParentIds.length === 0) return
    
    setInserting(true)
    const payload = { 
      name: insertName.trim(), 
      hex_code: normalizeHex(insertHex) || null,
      is_primary: insertIsPrimary,
      parent_ids: insertIsPrimary ? [] : insertParentIds
    }
    const { data, error } = await supabase.from('colors').insert(payload).select('id,name,hex_code').maybeSingle()
    
    if (!error && data) {
      const newColor: PlantColor = { id: data.id, name: data.name, hexCode: (data as any).hex_code || normalizeHex(insertHex) }
      autoTranslateColor(data.id, insertName.trim())
      setAllColors(prev => [...prev, { ...newColor, isPrimary: insertIsPrimary }])
      if (!alreadyAdded(newColor)) onChange([...(colors || []), newColor])
      setInsertName("")
      setInsertHex("#")
      setInsertIsPrimary(false)
      setInsertParentIds([])
      setMode('pick')
      setOpen(false)
    }
    setInserting(false)
  }

  const resetAndClose = () => {
    setOpen(false)
    setSearch("")
    setMode('pick')
    setInsertName("")
    setInsertHex("#")
    setInsertIsPrimary(false)
    setInsertParentIds([])
  }

  return (
    <div className="grid gap-3">
      {/* Selected colors display */}
      <div className="flex flex-wrap gap-2">
        {(colors || []).map((c, idx) => (
          <span 
            key={`${c.name}-${idx}`} 
            className="group px-2.5 py-1.5 rounded-lg text-sm flex items-center gap-2 border transition-all hover:shadow-sm"
            style={{ 
              backgroundColor: c.hexCode ? `${c.hexCode}20` : undefined,
              borderColor: c.hexCode || '#e5e7eb'
            }}
          >
            <span 
              className="w-4 h-4 rounded-full border shadow-sm" 
              style={{ backgroundColor: c.hexCode || "transparent" }} 
            />
            <span className="font-medium">{c.name}</span>
            <button 
              type="button" 
              className="opacity-50 hover:opacity-100 hover:text-red-600 transition-opacity" 
              onClick={() => onChange(colors.filter((_, i) => i !== idx))}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : resetAndClose()}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="w-full">
            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-red-400 via-green-400 to-blue-400 mr-2" />
            {t('plantAdmin.colors.addColorButton', 'Add color')}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="p-4 pb-3 border-b">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {mode === 'pick' 
                  ? t('plantAdmin.colors.dialogTitle', 'Select a color') 
                  : t('plantAdmin.colors.createTitle', 'Create new color')}
              </DialogTitle>
            </DialogHeader>
            
            {/* Mode toggle */}
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => setMode('pick')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  mode === 'pick' 
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' 
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                Pick existing
              </button>
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  mode === 'create' 
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' 
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                Create new
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {mode === 'pick' ? (
              <div className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <SearchInput 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                    placeholder={t('plantAdmin.colors.searchPlaceholder', 'Search by name or hex code (e.g., #ff0000)')}
                    className="w-full"
                  />
                  {search && (
                    <button 
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Color grid */}
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('plantAdmin.colors.loading', 'Loading colors...')}
                  </div>
                ) : filteredColors.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('plantAdmin.colors.empty', 'No colors found.')}
                    <button 
                      type="button"
                      onClick={() => setMode('create')}
                      className="block mx-auto mt-2 text-emerald-600 hover:underline"
                    >
                      Create a new color
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                    {filteredColors.map((c) => {
                      const isAdded = alreadyAdded(c)
                      return (
                        <button
                          key={c.id || c.name}
                          type="button"
                          onClick={() => !isAdded && addColor(c)}
                          disabled={isAdded}
                          className={`group relative aspect-square rounded-xl overflow-hidden transition-all ${
                            isAdded 
                              ? 'opacity-50 cursor-not-allowed ring-2 ring-emerald-500' 
                              : 'hover:scale-105 hover:shadow-lg hover:z-10'
                          }`}
                          title={`${c.name}${c.hexCode ? ` (${c.hexCode})` : ''}`}
                        >
                          {/* Color fill */}
                          <div 
                            className="absolute inset-0"
                            style={{ backgroundColor: c.hexCode || '#e5e7eb' }}
                          />
                          
                          {/* Hover overlay with name */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-center p-1">
                            <span 
                              className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity text-center leading-tight truncate w-full px-1"
                              style={{ color: c.hexCode ? getContrastColor(c.hexCode) : '#000' }}
                            >
                              {c.name}
                            </span>
                          </div>
                          
                          {/* Primary indicator */}
                          {c.isPrimary && (
                            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-1 ring-white" />
                          )}
                          
                          {/* Added checkmark */}
                          {isAdded && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <span className="text-white text-lg">✓</span>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Create mode */
              <div className="space-y-4">
                {/* Name and Hex inputs */}
                <div className="grid gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Color Name *</label>
                    <Input 
                      value={insertName} 
                      onChange={(e) => setInsertName(e.target.value)} 
                      placeholder="e.g., Emerald Green"
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Hex Code</label>
                    <div className="flex gap-2">
                      <Input 
                        value={insertHex} 
                        onChange={(e) => setInsertHex(e.target.value)} 
                        placeholder="#00ff00"
                        className="flex-1 font-mono"
                      />
                      <div 
                        className="w-12 h-10 rounded-lg border-2 shadow-inner flex-shrink-0 transition-colors"
                        style={{ 
                          backgroundColor: isValidHex(normalizeHex(insertHex)) ? normalizeHex(insertHex) : '#f5f5f5',
                          borderColor: isValidHex(normalizeHex(insertHex)) ? normalizeHex(insertHex) : '#e5e7eb'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Similar colors warning */}
                {similarColors.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">
                      Similar colors already exist:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {similarColors.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            addColor(c)
                            setMode('pick')
                          }}
                          className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white dark:bg-stone-800 border hover:border-emerald-500 transition-colors"
                        >
                          <span 
                            className="w-5 h-5 rounded-full border shadow-sm" 
                            style={{ backgroundColor: c.hexCode || 'transparent' }}
                          />
                          <span className="text-sm">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Primary toggle */}
                <label className="flex items-center gap-3 p-3 rounded-lg bg-stone-50 dark:bg-stone-800/50 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={insertIsPrimary}
                      onChange={(e) => {
                        setInsertIsPrimary(e.target.checked)
                        if (e.target.checked) setInsertParentIds([])
                      }}
                      className="sr-only peer"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors ${insertIsPrimary ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-600'}`} />
                    <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${insertIsPrimary ? 'translate-x-4' : ''}`} />
                  </div>
                  <div>
                    <span className="text-sm font-medium">Primary Color</span>
                    <p className="text-xs text-muted-foreground">Basic colors like Red, Blue, Green</p>
                  </div>
                </label>

                {/* Parent selection */}
                {!insertIsPrimary && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Parent Colors * <span className="text-muted-foreground font-normal">(required)</span>
                    </label>
                    <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-stone-50 dark:bg-stone-800/50">
                      {primaryColors.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No primary colors available</span>
                      ) : (
                        primaryColors.map((parent) => (
                          <button
                            key={parent.id}
                            type="button"
                            onClick={() => toggleParent(parent.id!)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                              insertParentIds.includes(parent.id!)
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                                : 'bg-white dark:bg-stone-700 hover:bg-stone-100 dark:hover:bg-stone-600 border'
                            }`}
                          >
                            <span 
                              className="w-4 h-4 rounded-full border shadow-sm" 
                              style={{ backgroundColor: parent.hexCode || 'transparent' }} 
                            />
                            {parent.name}
                            {insertParentIds.includes(parent.id!) && <span>✓</span>}
                          </button>
                        ))
                      )}
                    </div>
                    {!insertIsPrimary && insertParentIds.length === 0 && insertName.trim() && (
                      <p className="text-xs text-amber-600 mt-1">Select at least one parent color</p>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Color will be auto-translated to all supported languages
                </p>
              </div>
            )}
          </div>

          {/* Footer for create mode */}
          {mode === 'create' && (
            <div className="p-4 border-t bg-stone-50 dark:bg-stone-900">
              <Button 
                type="button" 
                onClick={handleInsert} 
                disabled={inserting || !insertName.trim() || (!insertIsPrimary && insertParentIds.length === 0)}
                className="w-full"
              >
                {inserting ? 'Creating...' : 'Create Color'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function PlantProfileForm({ value, onChange, colorSuggestions, categoryProgress }: PlantProfileFormProps) {
  const { t } = useTranslation('common')
  const sectionRefs = React.useRef<Record<PlantFormCategory, HTMLDivElement | null>>({
    basics: null,
    identity: null,
    plantCare: null,
    growth: null,
    usage: null,
    ecology: null,
    danger: null,
    miscellaneous: null,
    meta: null,
  })
  const [selectedCategory, setSelectedCategory] = React.useState<PlantFormCategory>('identity')
  const [showColorRecommendations, setShowColorRecommendations] = React.useState(false)
  const categoryLabels: Record<PlantFormCategory, string> = {
    basics: t('plantAdmin.categories.basics', 'Basics'),
    identity: t('plantAdmin.categories.identity', 'Identity'),
    plantCare: t('plantAdmin.categories.plantCare', 'Plant Care'),
    growth: t('plantAdmin.categories.growth', 'Growth'),
    usage: t('plantAdmin.categories.usage', 'Usage'),
    ecology: t('plantAdmin.categories.ecology', 'Ecology'),
    danger: t('plantAdmin.categories.danger', 'Danger'),
    miscellaneous: t('plantAdmin.categories.miscellaneous', 'Miscellaneous'),
    meta: t('plantAdmin.categories.meta', 'Meta'),
  }
  const scrollToCategory = (category: PlantFormCategory) => {
    setSelectedCategory(category)
  }
  React.useEffect(() => {
    if (colorSuggestions?.length) {
      setShowColorRecommendations(true)
    } else {
      setShowColorRecommendations(false)
    }
  }, [colorSuggestions?.length])
  const addSuggestedColor = React.useCallback(
    (suggestion: PlantColor | { name?: string; hexCode?: string; hex?: string; label?: string }) => {
      const current = value.identity?.colors || []
      const name = suggestion.name || (suggestion as any)?.label || suggestion.hexCode || (suggestion as any)?.hex || t('plantAdmin.colorFallback', 'Color')
      const hex = normalizeHex(suggestion.hexCode || (suggestion as any)?.hex || '')
      const alreadyAdded = current.some((color) => {
        const colorName = color.name?.toLowerCase()
        const colorHex = normalizeHex(color.hexCode || '')
        return (
          (name && colorName === name.toLowerCase()) ||
          (hex && colorHex && colorHex === hex)
        )
      })
      if (alreadyAdded) return
      const next: PlantColor = hex ? { name, hexCode: hex } : { name }
      onChange(setValue(value, 'identity.colors', [...current, next]))
    },
    [onChange, t, value],
  )
  const categoriesWithoutBasics = plantFormCategoryOrder.filter((cat) => cat !== 'basics')
  const setPath = (path: string, val: any) => onChange(setValue(value, path, val))
  return (
    <div className="space-y-6">
      <div ref={(node) => { sectionRefs.current.basics = node }} className="flex-1">
        <Card className={neuCardClass}>
          <CardHeader>
            <CardTitle>{categoryLabels.basics}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>{t('plantAdmin.basics.name.label', 'Name')}</Label>
                <Input
                  value={value.name}
                  required
                  onChange={(e) => onChange({ ...value, name: e.target.value })}
                  placeholder={t('plantAdmin.basics.name.placeholder', 'Unique plant name')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('plantAdmin.basics.name.description', 'Name of the plant (unique and mandatory).')}
                </p>
              </div>
              <div className="grid gap-2">
                <Label>{t('plantAdmin.basics.plantType.label', 'Plant Type')}</Label>
              <select
                className="h-9 rounded-md border px-2 text-sm"
                value={value.plantType || ""}
                onChange={(e) => onChange({ ...value, plantType: (e.target.value || undefined) as PlantType | undefined })}
              >
                  <option value="">{t('plantAdmin.basics.plantType.placeholder', 'Select type')}</option>
                {plantTypeOptions.map((opt) => (
                    <option key={opt} value={opt}>{t(`plantAdmin.options.plantType.${opt}`, opt)}</option>
                ))}
              </select>
                <p className="text-xs text-muted-foreground">
                  {t('plantAdmin.basics.plantType.description', 'Primary plant type')}
                </p>
            </div>
            <div className="grid gap-2">
                <Label>{t('plantAdmin.basics.utility.label', 'Utility')}</Label>
              <div className="flex flex-wrap gap-2">
                {utilityOptions.map((opt) => {
                  const selected = value.utility?.includes(opt)
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        const current = value.utility || []
                        const next = selected ? current.filter((v) => v !== opt) : [...current, opt]
                        onChange({ ...value, utility: next })
                      }}
                      className={`px-3 py-1 rounded-full border text-sm transition ${selected ? "bg-black text-white dark:bg-white dark:text-black" : "bg-white dark:bg-[#2d2d30]"}`}
                    >
                        {t(`plantAdmin.options.utility.${opt}`, opt)}
                    </button>
                  )
                })}
              </div>
                <p className="text-xs text-muted-foreground">
                  {t('plantAdmin.basics.utility.description', 'Select every utility that applies')}
                </p>
            </div>
            {value.utility?.includes("comestible") && (
              <div className="grid gap-2">
                  <Label>{t('plantAdmin.basics.comestiblePart.label', 'Comestible Part')}</Label>
                <div className="flex flex-wrap gap-2">
                  {comestibleOptions.map((opt) => {
                    const selected = value.comestiblePart?.includes(opt)
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const current = value.comestiblePart || []
                          const next = selected ? current.filter((v) => v !== opt) : [...current, opt]
                          onChange({ ...value, comestiblePart: next })
                        }}
                        className={`px-3 py-1 rounded-full border text-sm transition ${selected ? "bg-black text-white dark:bg-white dark:text-black" : "bg-white dark:bg-[#2d2d30]"}`}
                      >
                          {t(`plantAdmin.options.comestible.${opt}`, opt)}
                      </button>
                    )
                  })}
                </div>
                  <p className="text-xs text-muted-foreground">
                    {t('plantAdmin.basics.comestiblePart.description', 'Edible parts (only if utility includes edible).')}
                  </p>
              </div>
            )}
            {value.utility?.includes("produce_fruit") && (
              <div className="grid gap-2">
                  <Label>{t('plantAdmin.basics.fruitType.label', 'Fruit Type')}</Label>
                <div className="flex flex-wrap gap-2">
                  {fruitOptions.map((opt) => {
                    const selected = value.fruitType?.includes(opt)
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const current = value.fruitType || []
                          const next = selected ? current.filter((v) => v !== opt) : [...current, opt]
                          onChange({ ...value, fruitType: next })
                        }}
                        className={`px-3 py-1 rounded-full border text-sm transition ${selected ? "bg-black text-white dark:bg-white dark:text-black" : "bg-white dark:bg-[#2d2d30]"}`}
                      >
                          {t(`plantAdmin.options.fruit.${opt}`, opt)}
                      </button>
                    )
                  })}
                </div>
                  <p className="text-xs text-muted-foreground">
                    {t('plantAdmin.basics.fruitType.description', 'Fruit classification (if the plant produces fruit).')}
                  </p>
              </div>
            )}
            <ImageEditor images={value.images || []} onChange={(imgs) => onChange({ ...value, images: imgs })} />
          </CardContent>
        </Card>
      </div>

        <div className={`${neuCardClass} rounded-2xl p-4`}>
          <div className="text-sm font-medium mb-2">{t('plantAdmin.categoryMenuTitle', 'Quick category menu')}</div>
          <div className="flex flex-wrap gap-3">
            {categoriesWithoutBasics.map((key) => {
              const info = categoryProgress?.[key]
              return (
                <div key={key} className="relative">
                  <Button
                    size="lg"
                    className="min-w-[110px] px-4 py-2 text-sm sm:text-base shadow-sm"
                    variant={selectedCategory === key ? 'default' : 'outline'}
                    onClick={() => scrollToCategory(key)}
                  >
                    {categoryLabels[key]}
                  </Button>
                  {info?.total ? (
                    <span
                      className={`absolute -top-2 -right-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white ${
                        info.status === 'done' ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                    >
                      {info.status === 'done' ? t('plantAdmin.sectionFilled', 'Filled') : `${info.completed}/${info.total}`}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-6">
          {(['identity','plantCare','growth','usage','ecology','danger','miscellaneous','meta'] as PlantFormCategory[]).map((cat) => {
            if (selectedCategory !== cat) return null
            const refSetter = (node: HTMLDivElement | null) => { sectionRefs.current[cat] = node }
            const fieldGroups: Record<PlantFormCategory, FieldConfig[]> = {
              basics: [],
              identity: identityFields,
              plantCare: careFields,
              growth: growthFields,
              usage: usageFields,
              ecology: ecologyFields,
              danger: dangerFields,
              miscellaneous: miscFields,
              meta: metaFields,
            }
            const progressInfo = categoryProgress?.[cat]
            return (
              <div key={cat} ref={refSetter}>
                <Card className={neuCardClass}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-4">
                      <span>{categoryLabels[cat]}</span>
                      {progressInfo?.total ? (
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            progressInfo.status === 'done'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                          }`}
                        >
                          {progressInfo.status === 'done'
                            ? t('plantAdmin.sectionFilled', 'Filled')
                            : `${progressInfo.completed}/${progressInfo.total}`}
                        </span>
                      ) : null}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                      {fieldGroups[cat].map((f) => renderField(value, setPath, f, t))}
                    {cat === 'identity' && (
                      <div className="md:col-span-2">
                        {colorSuggestions?.length ? (
                          <div className="mb-3">
                            <button
                              type="button"
                              className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                              onClick={() => setShowColorRecommendations((prev) => !prev)}
                            >
                              <Sparkles className="h-4 w-4" />
                              {showColorRecommendations
                                ? t('plantAdmin.hideColorSuggestions', 'Hide AI color suggestions')
                                : t('plantAdmin.showColorSuggestions', 'Show AI color suggestions')}
                            </button>
                            {showColorRecommendations && (
                              <div className="mt-2 rounded-xl border border-emerald-100/70 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/70 via-white/80 to-emerald-100/70 dark:from-[#0f1a12] dark:via-[#0c140f] dark:to-[#0a120d] px-4 py-3 shadow-inner space-y-3">
                                <div className="text-xs text-muted-foreground">
                                  {t('plantAdmin.colorSuggestionsReview', 'Review and add the colors you like to your palette.')}
                                </div>
                                <div className="flex flex-wrap gap-3">
                                  {colorSuggestions.map((c, idx) => {
                                    const name = c.name || (c as any)?.label || c.hexCode || (c as any)?.hex || t('plantAdmin.colorFallback', 'Color')
                                    const hex = normalizeHex(c.hexCode || (c as any)?.hex || '')
                                    const alreadyAdded = (value.identity?.colors || []).some((color) => {
                                      const colorName = color.name?.toLowerCase()
                                      const colorHex = normalizeHex(color.hexCode || '')
                                      return (
                                        (name && colorName === name.toLowerCase()) ||
                                        (hex && colorHex && colorHex === hex)
                                      )
                                    })
                                    return (
                                      <div
                                        key={`${name}-${hex || idx}`}
                                        className="flex items-center gap-3 rounded-lg bg-white/80 dark:bg-[#111611] px-3 py-2 shadow-sm border border-emerald-100/60 dark:border-emerald-900/40"
                                      >
                                        <span
                                          className="h-5 w-5 rounded-full border border-stone-200 dark:border-stone-700"
                                          style={{ backgroundColor: hex || undefined }}
                                        />
                                        <div className="flex flex-col leading-tight min-w-[90px]">
                                          <span className="text-sm font-medium text-emerald-900 dark:text-emerald-200">{name}</span>
                                          {hex && <span className="text-xs text-muted-foreground">{hex}</span>}
                                        </div>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant={alreadyAdded ? 'secondary' : 'default'}
                                          disabled={alreadyAdded}
                                          onClick={() => addSuggestedColor(c)}
                                        >
                                          {alreadyAdded ? t('plantAdmin.colorAdded', 'Added') : t('plantAdmin.addColor', 'Add')}
                                        </Button>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null}
                          <Label>{t('plantAdmin.colorsLabel', 'Colors')}</Label>
                        {!colorSuggestions?.length && (
                          <p className="text-xs text-muted-foreground mb-2">
                            {t('plantAdmin.colorSuggestionPlaceholder', 'AI recommendations will show up here when available.')}
                          </p>
                        )}
                        <ColorPicker colors={value.identity?.colors || []} onChange={(colors) => onChange(setValue(value, "identity.colors", colors))} />
                        <div className="mt-3 flex flex-wrap gap-4 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!value.identity?.multicolor}
                              onChange={(e) => onChange(setValue(value, "identity.multicolor", e.target.checked))}
                            />
                              {t('plantAdmin.colors.multicolor', 'Multicolor')}
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!value.identity?.bicolor}
                              onChange={(e) => onChange(setValue(value, "identity.bicolor", e.target.checked))}
                            />
                              {t('plantAdmin.colors.bicolor', 'Bicolor')}
                          </label>
                        </div>
                          <p className="text-xs text-muted-foreground">{t('plantAdmin.colors.paletteHelp', 'Link existing palette colors or insert new ones for this plant.')}</p>
                      </div>
                    )}
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>
    </div>
  )
}
