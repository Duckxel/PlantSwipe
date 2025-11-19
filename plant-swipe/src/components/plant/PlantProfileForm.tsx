import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import type { Plant, PlantColor, PlantImage } from "@/types/plant"

export type PlantProfileFormProps = {
  value: Plant
  onChange: (plant: Plant) => void
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

interface FieldConfig {
  key: string
  label: string
  description: string
  type: FieldType
  options?: string[]
}

const monthOptions = [
  "January","February","March","April","May","June","July","August","September","October","November","December"
]

const TogglePill: React.FC<{ selected: boolean; onClick: () => void; children: React.ReactNode }> = ({ selected, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1 rounded-full border text-sm transition ${selected ? "bg-black text-white dark:bg-white dark:text-black" : "bg-white dark:bg-[#2d2d30]"}`}
  >
    {children}
  </button>
)

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
  { key: "plantCare.temperatureMax", label: "Temperature Max", description: "Maximum temperature (°C)", type: "number" },
  { key: "plantCare.temperatureMin", label: "Temperature Min", description: "Minimum temperature (°C)", type: "number" },
  { key: "plantCare.temperatureIdeal", label: "Temperature Ideal", description: "Ideal temperature (°C)", type: "number" },
  { key: "plantCare.levelSun", label: "Level Sun", description: "Sun exposure level", type: "select", options: ["Low Light","Shade","Partial Sun","Full Sun"] },
  { key: "plantCare.hygrometry", label: "Hygrometry", description: "Ideal humidity percentage", type: "number" },
  { key: "plantCare.watering.season", label: "Watering Season", description: "Season for watering guidance", type: "text" },
  { key: "plantCare.watering.quantity", label: "Watering Quantity", description: "Quantity to water", type: "text" },
  { key: "plantCare.watering.timePeriod", label: "Watering Time Period", description: "Time period (week/month/year)", type: "select", options: ["week","month","year"] },
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
  { key: "miscellaneous.companions", label: "Companions", description: "Companion plant IDs", type: "tags" },
  { key: "miscellaneous.tags", label: "Tags", description: "Search tags", type: "tags" },
]

const metaFields: FieldConfig[] = [
  { key: "meta.status", label: "Status", description: "Editorial status", type: "select", options: ["In Progres","Rework","Review","Approved"] },
  { key: "meta.adminCommentary", label: "Admin Commentary", description: "Moderator feedback", type: "textarea" },
  { key: "meta.createdBy", label: "Created By", description: "Author name", type: "text" },
  { key: "meta.createdTime", label: "Created Time", description: "Creation time", type: "text" },
  { key: "meta.updatedBy", label: "Updated By", description: "Last editor", type: "text" },
  { key: "meta.updatedTime", label: "Updated Time", description: "Last update time", type: "text" },
]

const utilityOptions = ["comestible","ornemental","produce_fruit","aromatic","medicinal","odorous","climbing","cereal","spice"]
const comestibleOptions = ["flower","fruit","seed","leaf","stem","root","bulb","bark","wood"]
const fruitOptions = ["nut","seed","stone"]
const plantTypeOptions = ["plant","flower","bamboo","shrub","tree"]

function renderField(plant: Plant, onChange: (path: string, value: any) => void, field: FieldConfig) {
  const value = getValue(plant, field.key)
  const id = field.key.replace(/\./g, "-")
  switch (field.type) {
    case "text":
      return (
        <div className="grid gap-2" key={field.key}>
          <Label htmlFor={id}>{field.label}</Label>
          <Input id={id} value={value ?? ""} onChange={(e) => onChange(field.key, e.target.value)} placeholder={field.description} />
          <p className="text-xs text-muted-foreground">{field.description}</p>
        </div>
      )
    case "textarea":
      return (
        <div className="grid gap-2" key={field.key}>
          <Label htmlFor={id}>{field.label}</Label>
          <Textarea id={id} value={value ?? ""} onChange={(e) => onChange(field.key, e.target.value)} placeholder={field.description} />
          <p className="text-xs text-muted-foreground">{field.description}</p>
        </div>
      )
    case "number":
      return (
        <div className="grid gap-2" key={field.key}>
          <Label htmlFor={id}>{field.label}</Label>
          <Input id={id} type="number" value={value ?? ""} onChange={(e) => onChange(field.key, e.target.value === "" ? undefined : Number(e.target.value))} placeholder={field.description} />
          <p className="text-xs text-muted-foreground">{field.description}</p>
        </div>
      )
    case "boolean":
      return (
        <div className="grid gap-2" key={field.key}>
          <Label>{field.label}</Label>
          <div className="flex gap-2">
            <TogglePill selected={value === true} onClick={() => onChange(field.key, true)}>Yes</TogglePill>
            <TogglePill selected={value === false} onClick={() => onChange(field.key, false)}>No</TogglePill>
          </div>
          <p className="text-xs text-muted-foreground">{field.description}</p>
        </div>
      )
    case "select":
      return (
        <div className="grid gap-2" key={field.key}>
          <Label>{field.label}</Label>
          <div className="flex flex-wrap gap-2">
            {(field.options || []).map((opt) => (
              <TogglePill key={opt} selected={value === opt} onClick={() => onChange(field.key, opt)}>{opt}</TogglePill>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{field.description}</p>
        </div>
      )
    case "multiselect":
      return (
        <div className="grid gap-2" key={field.key}>
          <Label>{field.label}</Label>
          <div className="flex flex-wrap gap-2">
            {(field.options || []).map((opt) => {
              const selected = Array.isArray(value) ? value.includes(opt) : false
              return <TogglePill key={opt} selected={selected} onClick={() => {
                const current: string[] = Array.isArray(value) ? value : []
                onChange(field.key, selected ? current.filter((v) => v !== opt) : [...current, opt])
              }}>{opt}</TogglePill>
            })}
          </div>
          <p className="text-xs text-muted-foreground">{field.description}</p>
        </div>
      )
    case "tags":
      return (
        <div className="grid gap-2" key={field.key}>
          <Label>{field.label}</Label>
          <TagInput value={Array.isArray(value) ? value : []} onChange={(v) => onChange(field.key, v)} />
          <p className="text-xs text-muted-foreground">{field.description}</p>
        </div>
      )
    case "dict":
      return (
        <div className="grid gap-2" key={field.key}>
          <Label>{field.label}</Label>
          <KeyValueList value={(value as Record<string, string>) || {}} onChange={(v) => onChange(field.key, v)} />
          <p className="text-xs text-muted-foreground">{field.description}</p>
        </div>
      )
    default:
      return null
  }
}

function ImageEditor({ images, onChange }: { images: PlantImage[]; onChange: (v: PlantImage[]) => void }) {
  const updateImage = (idx: number, patch: Partial<PlantImage>) => {
    const next = images.map((img, i) => i === idx ? { ...img, ...patch } : img)
    onChange(next)
  }
  const addImage = () => onChange([...images, { link: "", use: "other" }])
  const removeImage = (idx: number) => onChange(images.filter((_, i) => i !== idx))
  return (
    <div className="grid gap-3">
      {images.map((img, idx) => (
        <div key={idx} className="rounded border p-3 space-y-2">
          <Input value={img.link} onChange={(e) => updateImage(idx, { link: e.target.value })} placeholder="Image link" />
          <div className="flex gap-2 items-center">
            <Label className="text-sm">Use</Label>
            {(["primary","discovery","other"] as const).map((opt) => (
              <TogglePill key={opt} selected={img.use === opt} onClick={() => updateImage(idx, { use: opt })}>{opt}</TogglePill>
            ))}
          </div>
          <Button variant="ghost" type="button" onClick={() => removeImage(idx)} className="text-red-600">Remove image</Button>
        </div>
      ))}
      <Button type="button" onClick={addImage}>Add image</Button>
    </div>
  )
}

function ColorPicker({ colors, onChange }: { colors: PlantColor[]; onChange: (v: PlantColor[]) => void }) {
  const [name, setName] = React.useState("")
  const [hex, setHex] = React.useState("")
  const add = () => {
    if (!name.trim()) return
    onChange([...(colors || []), { name: name.trim(), hexCode: hex.trim() || undefined }])
    setName("")
    setHex("")
  }
  return (
    <div className="grid gap-2">
      <div className="flex flex-col md:flex-row gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Color name" />
        <Input value={hex} onChange={(e) => setHex(e.target.value)} placeholder="#hexcode" />
        <Button type="button" onClick={add}>Add color</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(colors || []).map((c, idx) => (
          <span key={`${c.name}-${idx}`} className="px-2 py-1 rounded bg-stone-100 dark:bg-[#2d2d30] text-sm flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: c.hexCode || "transparent" }} />
            {c.name}
            <button type="button" className="text-red-600" onClick={() => onChange(colors.filter((_, i) => i !== idx))}>×</button>
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Colors are stored in the color table; add name and hex to create new ones.</p>
    </div>
  )
}

export function PlantProfileForm({ value, onChange }: PlantProfileFormProps) {
  const setPath = (path: string, val: any) => onChange(setValue(value, path, val))
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identity & Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="Unique plant name" />
            <p className="text-xs text-muted-foreground">Name of the Plant (unique and mandatory)</p>
          </div>
          <div className="grid gap-2">
            <Label>Plant Type</Label>
            <div className="flex flex-wrap gap-2">
              {plantTypeOptions.map((opt) => (
                <TogglePill key={opt} selected={value.plantType === opt} onClick={() => onChange({ ...value, plantType: opt })}>{opt}</TogglePill>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Primary plant type</p>
          </div>
          <div className="grid gap-2">
            <Label>Utility</Label>
            <div className="flex flex-wrap gap-2">
              {utilityOptions.map((opt) => {
                const selected = value.utility?.includes(opt)
                return <TogglePill key={opt} selected={!!selected} onClick={() => {
                  const current = value.utility || []
                  const next = selected ? current.filter((v) => v !== opt) : [...current, opt]
                  onChange({ ...value, utility: next })
                }}>{opt}</TogglePill>
              })}
            </div>
            <p className="text-xs text-muted-foreground">Select all utilities that apply</p>
          </div>
          {value.utility?.includes("comestible") && (
            <div className="grid gap-2">
              <Label>Comestible Part</Label>
              <div className="flex flex-wrap gap-2">
                {comestibleOptions.map((opt) => {
                  const selected = value.comestiblePart?.includes(opt)
                  return <TogglePill key={opt} selected={!!selected} onClick={() => {
                    const current = value.comestiblePart || []
                    const next = selected ? current.filter((v) => v !== opt) : [...current, opt]
                    onChange({ ...value, comestiblePart: next })
                  }}>{opt}</TogglePill>
                })}
              </div>
              <p className="text-xs text-muted-foreground">Edible parts (only if comestible)</p>
            </div>
          )}
          {value.utility?.includes("produce_fruit") && (
            <div className="grid gap-2">
              <Label>Fruit Type</Label>
              <div className="flex flex-wrap gap-2">
                {fruitOptions.map((opt) => {
                  const selected = value.fruitType?.includes(opt)
                  return <TogglePill key={opt} selected={!!selected} onClick={() => {
                    const current = value.fruitType || []
                    const next = selected ? current.filter((v) => v !== opt) : [...current, opt]
                    onChange({ ...value, fruitType: next })
                  }}>{opt}</TogglePill>
                })}
              </div>
              <p className="text-xs text-muted-foreground">Fruit classification (if produce fruit)</p>
            </div>
          )}
          <ImageEditor images={value.images || []} onChange={(imgs) => onChange({ ...value, images: imgs })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Identity</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {identityFields.map((f) => renderField(value, setPath, f))}
          <div className="md:col-span-2">
            <Label>Colors</Label>
            <ColorPicker colors={value.identity?.colors || []} onChange={(colors) => onChange(setValue(value, "identity.colors", colors))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Plant Care</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {careFields.map((f) => renderField(value, setPath, f))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Growth</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {growthFields.map((f) => renderField(value, setPath, f))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Usage</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {usageFields.map((f) => renderField(value, setPath, f))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ecology</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {ecologyFields.map((f) => renderField(value, setPath, f))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Danger</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {dangerFields.map((f) => renderField(value, setPath, f))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Miscellaneous</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {miscFields.map((f) => renderField(value, setPath, f))}
          <div className="md:col-span-2">
            <Label>Source</Label>
            <KeyValueList value={(value.miscellaneous?.source as Record<string, string>) || {}} onChange={(v) => onChange(setValue(value, "miscellaneous.source", v))} keyLabel="Name" valueLabel="URL" />
            <p className="text-xs text-muted-foreground">Source {"{name // url}"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Meta</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {metaFields.map((f) => renderField(value, setPath, f))}
        </CardContent>
      </Card>
    </div>
  )
}
