import React from "react"
import { useParams } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabaseClient"
import type { Plant } from "@/types/plant"
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from "@/lib/i18n"
import { translatePlantToAllLanguages } from "@/lib/deepl"
import { savePlantTranslations, getPlantTranslation } from "@/lib/plantTranslations"
import { Languages } from "lucide-react"

interface EditPlantPageProps {
  onCancel: () => void
  onSaved?: (plantId: string) => void
}

export const EditPlantPage: React.FC<EditPlantPageProps> = ({ onCancel, onSaved }) => {
  const { id } = useParams<{ id: string }>()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [ok, setOk] = React.useState<string | null>(null)

  const [name, setName] = React.useState("")
  const [scientificName, setScientificName] = React.useState("")
  const [colors, setColors] = React.useState<string>("")
  const [seasons, setSeasons] = React.useState<string[]>([])
  const [rarity, setRarity] = React.useState<Plant["rarity"]>("Common")
  const [meaning, setMeaning] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [imageUrl, setImageUrl] = React.useState("")
  const [careSunlight, setCareSunlight] = React.useState<Plant["care"]["sunlight"]>("Low")
  const [careSoil, setCareSoil] = React.useState("")
  const [careDifficulty, setCareDifficulty] = React.useState<Plant["care"]["difficulty"]>("Easy")
  const [seedsAvailable, setSeedsAvailable] = React.useState(false)
  const [waterFreqPeriod, setWaterFreqPeriod] = React.useState<'week' | 'month' | 'year'>('week')
  const [waterFreqAmount, setWaterFreqAmount] = React.useState<number>(1)
  const [saving, setSaving] = React.useState(false)
  
  // Language selection for editing
  const [editLanguage, setEditLanguage] = React.useState<SupportedLanguage>(DEFAULT_LANGUAGE)
  const [translating, setTranslating] = React.useState(false)
  // New comprehensive plant fields
  const [wikipediaLink, setWikipediaLink] = React.useState("")
  const [plantFamily, setPlantFamily] = React.useState("")
  const [plantType, setPlantType] = React.useState<string[]>([])
  const [plantationType, setPlantationType] = React.useState<string[]>([])
  const [origins, setOrigins] = React.useState("")
  const [whereFound, setWhereFound] = React.useState("")
  const [size, setSize] = React.useState("")
  const [floweringPeriod, setFloweringPeriod] = React.useState("")
  const [plantMonth, setPlantMonth] = React.useState<number[]>([])
  const [lightAmount, setLightAmount] = React.useState("")
  const [climate, setClimate] = React.useState("")
  const [idealTemperature, setIdealTemperature] = React.useState("")
  const [regionOfWorld, setRegionOfWorld] = React.useState("")
  const [soilType, setSoilType] = React.useState("")
  const [meaningAndSignifications, setMeaningAndSignifications] = React.useState("")
  const [ecology, setEcology] = React.useState("")
  const [pharmaceutical, setPharmaceutical] = React.useState("")
  const [alimentaire, setAlimentaire] = React.useState("")
  const [caringTips, setCaringTips] = React.useState("")
  const [authorNotes, setAuthorNotes] = React.useState("")
  const [propagation, setPropagation] = React.useState("")
  const [division, setDivision] = React.useState("")
  const [commonDiseases, setCommonDiseases] = React.useState("")

  const toggleSeason = (s: Plant["seasons"][number]) => {
    setSeasons((cur: string[]) => (cur.includes(s) ? cur.filter((x: string) => x !== s) : [...cur, s]))
  }

  const togglePlantType = (type: string) => {
    setPlantType((cur: string[]) => (cur.includes(type) ? cur.filter((x: string) => x !== type) : [...cur, type]))
  }

  const togglePlantationType = (type: string) => {
    setPlantationType((cur: string[]) => (cur.includes(type) ? cur.filter((x: string) => x !== type) : [...cur, type]))
  }

  const togglePlantMonth = (month: number) => {
    setPlantMonth((cur: number[]) => (cur.includes(month) ? cur.filter((x: number) => x !== month) : [...cur, month]))
  }

  React.useEffect(() => {
    let ignore = false
    ;(async () => {
      if (!id) { setError('Missing plant id'); setLoading(false); return }
      setLoading(true)
      setError(null)
      try {
        // Load base plant data
        const { data, error: qerr } = await supabase
          .from('plants')
          .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, care_sunlight, care_soil, care_difficulty, seeds_available, water_freq_period, water_freq_amount, water_freq_unit, water_freq_value, wikipedia_link, plant_family, plant_type, plantation_type, origins, where_found, size, flowering_period, plant_month, light_amount, climate, ideal_temperature, region_of_world, soil_type, meaning_and_significations, ecology, pharmaceutical, alimentaire, caring_tips, author_notes, propagation, division, common_diseases')
          .eq('id', id)
          .maybeSingle()
        if (qerr) throw new Error(qerr.message)
        if (!data) throw new Error('Plant not found')
        if (ignore) return
        
        // Load translation for selected language
        const { data: translation } = await getPlantTranslation(id, editLanguage)
        
        // Use translation data if available, otherwise use base data
        setName(String(translation?.name || data.name || ''))
        setScientificName(String(translation?.scientific_name || data.scientific_name || ''))
        setMeaning(String(translation?.meaning || data.meaning || ''))
        setDescription(String(translation?.description || data.description || ''))
        setCareSoil(String(translation?.care_soil || data.care_soil || ''))
        setMeaningAndSignifications(String(translation?.meaning_and_significations || data.meaning_and_significations || ''))
        setEcology(String(translation?.ecology || data.ecology || ''))
        setPharmaceutical(String(translation?.pharmaceutical || data.pharmaceutical || ''))
        setAlimentaire(String(translation?.alimentaire || data.alimentaire || ''))
        setCaringTips(String(translation?.caring_tips || data.caring_tips || ''))
        setAuthorNotes(String(translation?.author_notes || data.author_notes || ''))
        setPropagation(String(translation?.propagation || data.propagation || ''))
        setDivision(String(translation?.division || data.division || ''))
        setCommonDiseases(String(translation?.common_diseases || data.common_diseases || ''))
        
        // These fields are not translated (shared across languages)
        setColors(Array.isArray(data.colors) ? (data.colors as string[]).join(', ') : '')
        setSeasons(Array.isArray(data.seasons) ? (data.seasons as string[]) : [])
        setRarity((data.rarity || 'Common') as Plant['rarity'])
        setImageUrl(String(data.image_url || ''))
        setCareSunlight((data.care_sunlight || 'Low') as Plant['care']['sunlight'])
        setCareDifficulty((data.care_difficulty || 'Easy') as Plant['care']['difficulty'])
        setSeedsAvailable(Boolean(data.seeds_available ?? false))
        const period = (data.water_freq_period || data.water_freq_unit || 'week') as 'week' | 'month' | 'year'
        const amount = Number(data.water_freq_amount ?? data.water_freq_value ?? 1) || 1
        setWaterFreqPeriod(period)
        setWaterFreqAmount(amount)
        setWikipediaLink(String(data.wikipedia_link || ''))
        setPlantFamily(String(data.plant_family || ''))
        setPlantType(Array.isArray(data.plant_type) ? (data.plant_type as string[]) : [])
        setPlantationType(Array.isArray(data.plantation_type) ? (data.plantation_type as string[]) : [])
        setOrigins(String(data.origins || ''))
        setWhereFound(String(data.where_found || ''))
        setSize(String(data.size || ''))
        setFloweringPeriod(String(data.flowering_period || ''))
        setPlantMonth(Array.isArray(data.plant_month) ? (data.plant_month as number[]) : [])
        setLightAmount(String(data.light_amount || ''))
        setClimate(String(data.climate || ''))
        setIdealTemperature(String(data.ideal_temperature || ''))
        setRegionOfWorld(String(data.region_of_world || ''))
        setSoilType(String(data.soil_type || ''))
      } catch (e: any) {
        setError(e?.message || 'Failed to load plant')
      } finally {
        setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [id, editLanguage])

  const handleTranslate = async () => {
    if (!id) return
    setTranslating(true)
    setError(null)
    setOk(null)
    
    try {
      // Get current fields
      const fields = {
        name: name.trim() || undefined,
        scientificName: scientificName.trim() || undefined,
        meaning: meaning.trim() || undefined,
        description: description.trim() || undefined,
        careSoil: careSoil.trim() || undefined,
        meaningAndSignifications: meaningAndSignifications.trim() || undefined,
        ecology: ecology.trim() || undefined,
        pharmaceutical: pharmaceutical.trim() || undefined,
        alimentaire: alimentaire.trim() || undefined,
        caringTips: caringTips.trim() || undefined,
        authorNotes: authorNotes.trim() || undefined,
        propagation: propagation.trim() || undefined,
        division: division.trim() || undefined,
        commonDiseases: commonDiseases.trim() || undefined,
      }
      
      // Translate to all languages
      const allTranslations = await translatePlantToAllLanguages(fields, editLanguage)
      
      // Save all translations
      const translationsToSave = Object.entries(allTranslations).map(([lang, translated]) => ({
        plant_id: id,
        language: lang as SupportedLanguage,
        name: translated.name || name.trim(),
        scientific_name: translated.scientificName || scientificName.trim() || null,
        meaning: translated.meaning || null,
        description: translated.description || null,
        care_soil: translated.careSoil || null,
        meaning_and_significations: translated.meaningAndSignifications || null,
        ecology: translated.ecology || null,
        pharmaceutical: translated.pharmaceutical || null,
        alimentaire: translated.alimentaire || null,
        caring_tips: translated.caringTips || null,
        author_notes: translated.authorNotes || null,
        propagation: translated.propagation || null,
        division: translated.division || null,
        common_diseases: translated.commonDiseases || null,
      }))
      
      const { error: transErr } = await savePlantTranslations(translationsToSave)
      if (transErr) {
        throw transErr
      }
      
      setOk('All fields translated and saved successfully!')
    } catch (e: any) {
      setError(e?.message || 'Translation failed')
    } finally {
      setTranslating(false)
    }
  }

  const save = async () => {
    if (!id) return
    setError(null)
    setOk(null)
    if (!name.trim()) { setError("Name is required"); return }
    // Validate frequency constraints
    const periodMax: Record<'week'|'month'|'year', number> = { week: 7, month: 4, year: 12 }
    const maxAllowed = periodMax[waterFreqPeriod]
    const normalizedAmount = Math.max(1, Math.min(Number(waterFreqAmount || 1), maxAllowed))
    setSaving(true)
    try {
      const colorArray = colors.split(",").map((c) => c.trim()).filter(Boolean)
      const { error: uerr } = await supabase
        .from('plants')
        .update({
          name: name.trim(),
          scientific_name: scientificName.trim() || null,
          colors: colorArray,
          seasons,
          rarity,
          meaning: meaning || null,
          description: description || null,
          image_url: imageUrl || null,
          care_sunlight: careSunlight,
          care_soil: careSoil.trim() || null,
          care_difficulty: careDifficulty,
          seeds_available: seedsAvailable,
          water_freq_period: waterFreqPeriod,
          water_freq_amount: normalizedAmount,
          water_freq_unit: waterFreqPeriod,
          water_freq_value: normalizedAmount,
          // New comprehensive plant fields
          wikipedia_link: wikipediaLink.trim() || null,
          plant_family: plantFamily.trim() || null,
          plant_type: plantType,
          plantation_type: plantationType,
          origins: origins.trim() || null,
          where_found: whereFound.trim() || null,
          size: size.trim() || null,
          flowering_period: floweringPeriod.trim() || null,
          plant_month: plantMonth,
          light_amount: lightAmount.trim() || null,
          climate: climate.trim() || null,
          ideal_temperature: idealTemperature.trim() || null,
          region_of_world: regionOfWorld.trim() || null,
          soil_type: soilType.trim() || null,
          meaning_and_significations: meaningAndSignifications.trim() || null,
          ecology: ecology.trim() || null,
          pharmaceutical: pharmaceutical.trim() || null,
          alimentaire: alimentaire.trim() || null,
          caring_tips: caringTips.trim() || null,
          author_notes: authorNotes.trim() || null,
          propagation: propagation.trim() || null,
          division: division.trim() || null,
          common_diseases: commonDiseases.trim() || null,
        })
        .eq('id', id)
      if (uerr) { setError(uerr.message); return }
      
      // Save translation for the current edit language
      const translation = {
        plant_id: id,
        language: editLanguage,
        name: name.trim(),
        scientific_name: scientificName.trim() || null,
        meaning: meaning || null,
        description: description || null,
        care_soil: careSoil.trim() || null,
        meaning_and_significations: meaningAndSignifications.trim() || null,
        ecology: ecology.trim() || null,
        pharmaceutical: pharmaceutical.trim() || null,
        alimentaire: alimentaire.trim() || null,
        caring_tips: caringTips.trim() || null,
        author_notes: authorNotes.trim() || null,
        propagation: propagation.trim() || null,
        division: division.trim() || null,
        common_diseases: commonDiseases.trim() || null,
      }
      
      const { error: transErr } = await savePlantTranslations([translation])
      if (transErr) {
        console.error('Failed to save translation:', transErr)
        // Don't fail the whole save if translation save fails
      }
      
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
          <form autoComplete="off" className="space-y-4">
            {loading && <div className="text-sm opacity-60">Loading…</div>}
            {error && <div className="text-sm text-red-600">{error}</div>}
            {!loading && !error && (
              <>
              {/* Language Selection */}
              <div className="grid gap-2 p-4 rounded-xl border bg-stone-50">
                <Label htmlFor="edit-language" className="flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  Edit Language
                </Label>
                <div className="flex items-center gap-2">
                  <select 
                    id="edit-language" 
                    className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" 
                    value={editLanguage} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditLanguage(e.target.value as SupportedLanguage)}
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang === 'en' ? 'English' : 'Français'}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleTranslate}
                    disabled={translating || saving}
                    className="rounded-2xl"
                  >
                    {translating ? 'Translating...' : 'Translate to All'}
                  </Button>
                </div>
                <div className="text-xs opacity-60">
                  Select the language you want to edit. Click "Translate to All" to translate current fields to all languages using DeepL.
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="plant-name">Name</Label>
                <Input id="plant-name" autoComplete="off" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plant-scientific">Scientific name</Label>
                <Input id="plant-scientific" autoComplete="off" value={scientificName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScientificName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plant-colors">Colors (comma separated)</Label>
                <Input id="plant-colors" autoComplete="off" placeholder="Red, Yellow" value={colors} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColors(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Seasons</Label>
                <div className="flex flex-wrap gap-2">
                  {(["Spring", "Summer", "Autumn", "Winter"] as const).map((s) => (
                    <button type="button" key={s} onClick={() => toggleSeason(s)} className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition ${seasons.includes(s) ? "bg-black text-white" : "bg-white hover:bg-stone-50"}`} aria-pressed={seasons.includes(s)}>
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
                <Input id="plant-meaning" autoComplete="off" value={meaning} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMeaning(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plant-description">Description</Label>
                <Input id="plant-description" autoComplete="off" value={description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plant-image">Image URL</Label>
                <Input id="plant-image" autoComplete="off" value={imageUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageUrl(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plant-sunlight">Care: Sunlight</Label>
                <select id="plant-sunlight" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" value={careSunlight} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCareSunlight(e.target.value as Plant["care"]["sunlight"])}>
                  {(["Low", "Medium", "High"] as const).map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              {/* Water care is derived from frequency; no manual input */}
              <div className="grid gap-2">
                <Label htmlFor="plant-soil">Care: Soil</Label>
                <Input id="plant-soil" autoComplete="off" value={careSoil} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCareSoil(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plant-difficulty">Care: Difficulty</Label>
                <select id="plant-difficulty" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" value={careDifficulty} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCareDifficulty(e.target.value as Plant["care"]["difficulty"]) }>
                  {(["Easy", "Moderate", "Hard"] as const).map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Default watering frequency</Label>
                <div className="grid grid-cols-2 gap-2">
                  <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" value={waterFreqPeriod} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setWaterFreqPeriod(e.target.value as any)}>
                    {["week","month","year"].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <Input type="number" autoComplete="off" min={1} max={waterFreqPeriod === 'week' ? 7 : waterFreqPeriod === 'month' ? 4 : 12} value={String(waterFreqAmount)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWaterFreqAmount(Math.max(1, Number(e.target.value || '1')))} />
                </div>
                <div className="text-xs opacity-60">
                  {waterFreqPeriod === 'week' && 'Max 7 per week.'}
                  {waterFreqPeriod === 'month' && 'Max 4 per month (otherwise use week).'}
                  {waterFreqPeriod === 'year' && 'Max 12 per year (otherwise use month).'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input id="plant-seeds" type="checkbox" checked={seedsAvailable} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSeedsAvailable(e.target.checked)} />
                <Label htmlFor="plant-seeds">Seeds available</Label>
              </div>
              {/* New comprehensive plant fields */}
              <div className="border-t pt-4 mt-4 space-y-4">
                <h3 className="text-base font-semibold">Plant Information</h3>
                <div className="grid gap-2">
                  <Label htmlFor="plant-wikipedia">Wikipedia Link</Label>
                  <Input id="plant-wikipedia" autoComplete="off" placeholder="https://en.wikipedia.org/wiki/..." value={wikipediaLink} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWikipediaLink(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-family">Plant Family</Label>
                  <Input id="plant-family" autoComplete="off" placeholder="e.g., Rosaceae" value={plantFamily} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlantFamily(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Plant Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["Flower", "Fruit", "Comestible", "Ornemental", "Vegetable", "Herb", "Tree", "Shrub", "Grass", "Fern", "Moss", "Succulent"] as const).map((type) => (
                      <button type="button" key={type} onClick={() => togglePlantType(type)} className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition ${plantType.includes(type) ? "bg-black text-white" : "bg-white hover:bg-stone-50"}`} aria-pressed={plantType.includes(type)}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Plantation Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["Massif", "Pots", "Exterior", "Interior", "Greenhouse", "Balcony", "Terrace", "Garden"] as const).map((type) => (
                      <button type="button" key={type} onClick={() => togglePlantationType(type)} className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition ${plantationType.includes(type) ? "bg-black text-white" : "bg-white hover:bg-stone-50"}`} aria-pressed={plantationType.includes(type)}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-origins">Origins</Label>
                  <Input id="plant-origins" autoComplete="off" placeholder="e.g., Mediterranean region" value={origins} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrigins(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-where-found">Where the plant can be found</Label>
                  <Input id="plant-where-found" autoComplete="off" placeholder="e.g., Forests, gardens, parks" value={whereFound} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWhereFound(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-size">Size</Label>
                  <Input id="plant-size" autoComplete="off" placeholder="e.g., 30-50 cm height" value={size} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSize(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-flowering-period">Flowering Period</Label>
                  <Input id="plant-flowering-period" autoComplete="off" placeholder="e.g., Spring to Summer" value={floweringPeriod} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFloweringPeriod(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Plant Month (when to promote)</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { num: 1, name: "Jan" }, { num: 2, name: "Feb" }, { num: 3, name: "Mar" },
                      { num: 4, name: "Apr" }, { num: 5, name: "May" }, { num: 6, name: "Jun" },
                      { num: 7, name: "Jul" }, { num: 8, name: "Aug" }, { num: 9, name: "Sep" },
                      { num: 10, name: "Oct" }, { num: 11, name: "Nov" }, { num: 12, name: "Dec" }
                    ].map((m) => (
                      <button type="button" key={m.num} onClick={() => togglePlantMonth(m.num)} className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition ${plantMonth.includes(m.num) ? "bg-black text-white" : "bg-white hover:bg-stone-50"}`} aria-pressed={plantMonth.includes(m.num)}>
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-light">Amount of Light Necessary</Label>
                  <select id="plant-light" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" value={lightAmount} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLightAmount(e.target.value)}>
                    <option value="">Select...</option>
                    {(["Low", "Dim", "Medium", "Bright", "Very Sunny", "Full Sun"] as const).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-climate">Climate</Label>
                  <Input id="plant-climate" autoComplete="off" placeholder="e.g., Temperate, Tropical" value={climate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClimate(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-temperature">Ideal Temperature</Label>
                  <Input id="plant-temperature" autoComplete="off" placeholder="e.g., 15-25°C" value={idealTemperature} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIdealTemperature(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-region">Region of the World</Label>
                  <Input id="plant-region" autoComplete="off" placeholder="e.g., Europe, Asia, Americas" value={regionOfWorld} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegionOfWorld(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-soil-type">Soil Type</Label>
                  <Input id="plant-soil-type" autoComplete="off" placeholder="e.g., Well-drained, sandy, loamy" value={soilType} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSoilType(e.target.value)} />
                </div>
              </div>
              {/* Longer text fields */}
              <div className="border-t pt-4 mt-4 space-y-4">
                <h3 className="text-base font-semibold">Detailed Information</h3>
                <div className="grid gap-2">
                  <Label htmlFor="plant-meaning-significations">Meaning and Significations</Label>
                  <Textarea id="plant-meaning-significations" autoComplete="off" placeholder="Cultural and symbolic meanings" value={meaningAndSignifications} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMeaningAndSignifications(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-ecology">Ecology</Label>
                  <Textarea id="plant-ecology" autoComplete="off" placeholder="Ecological role and relationships" value={ecology} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEcology(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-pharmaceutical">Pharmaceutical Uses</Label>
                  <Textarea id="plant-pharmaceutical" autoComplete="off" placeholder="Medicinal properties and uses" value={pharmaceutical} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPharmaceutical(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-alimentaire">Alimentaire (Food Uses)</Label>
                  <Textarea id="plant-alimentaire" autoComplete="off" placeholder="Culinary uses and nutritional value" value={alimentaire} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAlimentaire(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-caring-tips">Good Caring Tips</Label>
                  <Textarea id="plant-caring-tips" autoComplete="off" placeholder="Best practices for plant care" value={caringTips} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCaringTips(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-author-notes">Notes from Author</Label>
                  <Textarea id="plant-author-notes" autoComplete="off" placeholder="Personal notes and observations" value={authorNotes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAuthorNotes(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-propagation">Propagation</Label>
                  <Textarea id="plant-propagation" autoComplete="off" placeholder="How to propagate this plant" value={propagation} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPropagation(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-division">Division</Label>
                  <Textarea id="plant-division" autoComplete="off" placeholder="Division techniques" value={division} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDivision(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-diseases">Common Diseases/Parasites</Label>
                  <Textarea id="plant-diseases" autoComplete="off" placeholder="Common issues and how to prevent/treat them" value={commonDiseases} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCommonDiseases(e.target.value)} />
                </div>
              </div>
              {ok && <div className="text-sm text-green-600">{ok}</div>}
              {translating && <div className="text-sm text-blue-600">Translating all fields to all languages...</div>}
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" className="rounded-2xl" onClick={onCancel} disabled={saving || translating}>Cancel</Button>
                <Button className="rounded-2xl" onClick={save} disabled={saving || translating}>
                  {saving ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

