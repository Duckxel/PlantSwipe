import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabaseClient"
import type {
  Plant,
  PlantIdentifiers,
  PlantTraits,
  PlantDimensions,
  PlantPhenology,
  PlantEnvironment,
  PlantCare,
  PlantPropagation,
  PlantUsage,
  PlantEcology,
  PlantCommerce,
  PlantProblems,
  PlantPlanting,
  PlantMeta,
} from "@/types/plant"
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from "@/lib/i18n"
import { translatePlantToAllLanguages } from "@/lib/deepl"
import { savePlantTranslations, type PlantTranslation } from "@/lib/plantTranslations"
import { Languages, Sparkles, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { CompleteAdvancedForm } from "@/components/plant/CompleteAdvancedForm"

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
  initialName?: string
}

export const CreatePlantPage: React.FC<CreatePlantPageProps> = ({ onCancel, onSaved, initialName }) => {
  const { t } = useTranslation('common')
  const [name, setName] = React.useState(initialName || "")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [ok, setOk] = React.useState<string | null>(null)
  const [advanced, setAdvanced] = React.useState(false)
  const [everAdvanced, setEverAdvanced] = React.useState(false)
  // Language selection (only in Advanced mode, defaults to English)
  const [inputLanguage, setInputLanguage] = React.useState<SupportedLanguage>(DEFAULT_LANGUAGE)
  const [translateToAll, setTranslateToAll] = React.useState(true) // Default to true in Advanced mode
  const [translating, setTranslating] = React.useState(false)
  const [aiFilling, setAiFilling] = React.useState(false)
  
  // New JSONB structure state
  const [identifiers, setIdentifiers] = React.useState<Partial<PlantIdentifiers>>({})
  const [traits, setTraits] = React.useState<Partial<PlantTraits>>({})
  const [dimensions, setDimensions] = React.useState<Partial<PlantDimensions>>({})
  const [phenology, setPhenology] = React.useState<Partial<PlantPhenology>>({})
  const [environment, setEnvironment] = React.useState<Partial<PlantEnvironment>>({})
  const [care, setCare] = React.useState<Partial<PlantCare>>({})
  const [propagation, setPropagation] = React.useState<Partial<PlantPropagation>>({})
  const [usage, setUsage] = React.useState<Partial<PlantUsage>>({})
  const [ecology, setEcology] = React.useState<Partial<PlantEcology>>({})
  const [commerce, setCommerce] = React.useState<Partial<PlantCommerce>>({})
  const [problems, setProblems] = React.useState<Partial<PlantProblems>>({})
  const [planting, setPlanting] = React.useState<Partial<PlantPlanting>>({})
  const [meta, setMeta] = React.useState<Partial<PlantMeta>>({})
  
  // Legacy fields for backward compatibility (simplified mode)
  const [scientificName, setScientificName] = React.useState("")
  const [colors, setColors] = React.useState<string>("")
  const [seasons, setSeasons] = React.useState<string[]>([])
  const [rarity, setRarity] = React.useState<Plant["rarity"]>("Common")
  const [meaning, setMeaning] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [imageUrl, setImageUrl] = React.useState("")
  const [careSoil] = React.useState("")
  const [careDifficulty] = React.useState<NonNullable<Plant["care"]>["difficulty"]>("Easy")
  const [seedsAvailable] = React.useState(false)
  const [waterFreqPeriod] = React.useState<'week' | 'month' | 'year'>('week')
  const [waterFreqAmount] = React.useState<number>(1)

  const toggleSeason = (s: Plant["seasons"][number]) => {
    setSeasons((cur: string[]) => (cur.includes(s) ? cur.filter((x: string) => x !== s) : [...cur, s]))
  }

  // Update name when initialName changes
  React.useEffect(() => {
    if (initialName) {
      setName(initialName)
    }
  }, [initialName])

  // Load schema for AI fill
  const loadSchema = async () => {
    try {
      // Try to load from public folder first
      const response = await fetch('/PLANT-INFO-SCHEMA.json')
      if (response.ok) {
        return await response.json()
      }
      // Fallback: import directly if fetch fails
      const schemaModule = await import('../../PLANT-INFO-SCHEMA.json')
      return schemaModule.default || schemaModule
    } catch (error) {
      console.error('Failed to load schema:', error)
      // Return a minimal schema structure as fallback
      return {
        identifiers: {},
        traits: {},
        dimensions: {},
        phenology: {},
        environment: {},
        care: {},
        propagation: {},
        usage: {},
        ecology: {},
        commerce: {},
        problems: {},
        planting: {},
        meta: {}
      }
    }
  }

  // AI Fill function
  const handleAiFill = async () => {
    if (!name.trim()) {
      setError("Please enter a plant name first")
      return
    }

    setAiFilling(true)
    setError(null)
    setOk(null)

    try {
      // Load the schema
      const schema = await loadSchema()
      if (!schema) {
        setError("Failed to load schema")
        return
      }

      // Call Supabase Edge Function
      const { data, error: funcError } = await supabase.functions.invoke('fill-plant-data', {
        body: {
          plantName: name.trim(),
          schema: schema
        }
      })

      if (funcError) {
        throw new Error(funcError.message || 'Failed to get AI response')
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to get AI response')
      }

      const aiData = data.data

      // Populate form fields with AI data
      if (aiData.identifiers) {
        setIdentifiers(aiData.identifiers)
        if (aiData.identifiers.scientificName && !scientificName) {
          setScientificName(aiData.identifiers.scientificName)
        }
      }
      if (aiData.traits) setTraits(aiData.traits)
      if (aiData.dimensions) setDimensions(aiData.dimensions)
      if (aiData.phenology) {
        setPhenology(aiData.phenology)
        // Also update legacy colors and seasons if available
        if (aiData.phenology.flowerColors?.length > 0 && !colors) {
          setColors(aiData.phenology.flowerColors.map((c: any) => c.name).join(', '))
        }
        if (aiData.phenology.floweringMonths?.length > 0 && seasons.length === 0) {
          // Convert months to seasons (rough approximation)
          const monthSeasons: Record<number, string> = {
            12: 'Winter', 1: 'Winter', 2: 'Winter',
            3: 'Spring', 4: 'Spring', 5: 'Spring',
            6: 'Summer', 7: 'Summer', 8: 'Summer',
            9: 'Autumn', 10: 'Autumn', 11: 'Autumn'
          }
          const newSeasons = [...new Set(aiData.phenology.floweringMonths.map((m: number) => monthSeasons[m]))].filter(Boolean) as string[]
          if (newSeasons.length > 0) setSeasons(newSeasons)
        }
      }
      if (aiData.environment) setEnvironment(aiData.environment)
      if (aiData.care) setCare(aiData.care)
      if (aiData.propagation) setPropagation(aiData.propagation)
      if (aiData.usage) setUsage(aiData.usage)
      if (aiData.ecology) setEcology(aiData.ecology)
      if (aiData.commerce) setCommerce(aiData.commerce)
      if (aiData.problems) setProblems(aiData.problems)
      if (aiData.planting) setPlanting(aiData.planting)
      if (aiData.meta) {
        setMeta(aiData.meta)
        if (aiData.meta.funFact && !meaning) {
          setMeaning(aiData.meta.funFact)
        }
        if (aiData.meta.rarity) {
          const rarityMap: Record<string, Plant['rarity']> = {
            'common': 'Common',
            'uncommon': 'Uncommon',
            'rare': 'Rare',
            'very rare': 'Legendary'
          }
          setRarity(rarityMap[aiData.meta.rarity] || 'Common')
        }
      }
      if (aiData.image && !imageUrl) {
        setImageUrl(aiData.image)
      }

      setOk("AI data loaded successfully! Please review and edit before saving.")
    } catch (err: any) {
      console.error('AI fill error:', err)
      setError(err?.message || 'Failed to fill data with AI. Please try again.')
    } finally {
      setAiFilling(false)
    }
  }

  const save = async () => {
    setError(null)
    setOk(null)
    if (!name.trim()) { setError("Name is required"); return }
    // Validate frequency constraints
    const periodMax: Record<'week'|'month'|'year', number> = { week: 7, month: 4, year: 12 }
    const maxAllowed = periodMax[waterFreqPeriod]
    let normalizedAmount = Math.max(1, Math.min(Number(waterFreqAmount || 1), maxAllowed))
    if (advanced && Number(waterFreqAmount || 1) > maxAllowed) {
      // Provide gentle guidance rather than blocking (only show in Advanced)
      setOk(`Capped to ${maxAllowed} per ${waterFreqPeriod}. For more, use a shorter period.`)
    }
    setSaving(true)
    try {
      const id = generateUUIDv4()
      const nameNorm = name.trim()
      const sciNorm = scientificName.trim()
      const colorArray = colors.split(",").map((c) => c.trim()).filter(Boolean)
      // If the user has ever switched to Advanced, keep those values even
      // when saving from Simplified so they persist across toggles.
      const includeAdvanced = advanced || everAdvanced

      // Duplicate check: name (case-insensitive)
      const byName = await supabase.from('plants').select('id').ilike('name', nameNorm).limit(1).maybeSingle()
      if (byName.error) { setError(byName.error.message); return }
      if (byName.data?.id) { setError('A plant with the same name already exists'); return }

      const { error: insErr } = await supabase.from('plants').insert({
        id,
        name: nameNorm,
        // New JSONB structure
        identifiers: includeAdvanced && Object.keys(identifiers).length > 0 ? identifiers : null,
        traits: includeAdvanced && Object.keys(traits).length > 0 ? traits : null,
        dimensions: includeAdvanced && Object.keys(dimensions).length > 0 ? dimensions : null,
        phenology: includeAdvanced && Object.keys(phenology).length > 0 ? phenology : null,
        environment: includeAdvanced && Object.keys(environment).length > 0 ? environment : null,
        care: includeAdvanced && Object.keys(care).length > 0 ? care : null,
        propagation: includeAdvanced && Object.keys(propagation).length > 0 ? propagation : null,
        usage: includeAdvanced && Object.keys(usage).length > 0 ? usage : null,
        ecology: includeAdvanced && Object.keys(ecology).length > 0 ? ecology : null,
        commerce: includeAdvanced && Object.keys(commerce).length > 0 ? commerce : null,
        problems: includeAdvanced && Object.keys(problems).length > 0 ? problems : null,
        planting: includeAdvanced && Object.keys(planting).length > 0 ? planting : null,
        meta: includeAdvanced && Object.keys(meta).length > 0 ? meta : null,
        // Legacy fields for backward compatibility
        scientific_name: sciNorm || identifiers?.scientificName || null,
        colors: colorArray,
        seasons,
        rarity: meta?.rarity === 'common' ? 'Common' : meta?.rarity === 'uncommon' ? 'Uncommon' : meta?.rarity === 'rare' ? 'Rare' : meta?.rarity === 'very rare' ? 'Legendary' : rarity,
        meaning: meta?.funFact || meaning || null,
        image_url: imageUrl || null,
        care_water: 'Low',
        care_soil: environment?.soil?.texture?.join(', ') || careSoil || null,
        care_difficulty: care?.difficulty === 'easy' ? 'Easy' : care?.difficulty === 'moderate' ? 'Moderate' : care?.difficulty === 'advanced' ? 'Hard' : careDifficulty,
        seeds_available: commerce?.seedsAvailable ?? seedsAvailable,
        water_freq_period: waterFreqPeriod,
        water_freq_amount: normalizedAmount,
        water_freq_unit: waterFreqPeriod,
        water_freq_value: normalizedAmount,
      })
      if (insErr) { setError(insErr.message); return }
      
      // Always save translation for the input language (defaults to English in simplified mode)
        const translation: PlantTranslation = {
        plant_id: id,
        language: inputLanguage,
        name: nameNorm,
        // Translatable JSONB fields
        identifiers: includeAdvanced && identifiers ? {
          ...identifiers,
          scientificName: identifiers.scientificName || sciNorm || undefined,
          commonNames: identifiers.commonNames || undefined,
        } : undefined,
        ecology: includeAdvanced && ecology ? ecology : undefined,
        usage: includeAdvanced && usage ? {
          culinaryUses: usage.culinaryUses,
          medicinalUses: usage.medicinalUses,
        } : undefined,
        meta: includeAdvanced && meta ? {
          funFact: meta.funFact,
          authorNotes: meta.authorNotes,
          sourceReferences: meta.sourceReferences,
        } : undefined,
        // Legacy fields for backward compatibility
        scientific_name: sciNorm || identifiers?.scientificName || null,
        meaning: meta?.funFact || meaning || null,
        description: description || null,
        care_soil: environment?.soil?.texture?.join(', ') || careSoil || null,
      }
      
        const translationsToSave: PlantTranslation[] = [translation]
      
      // In simplified mode, automatically translate to all languages
      // In advanced mode, only translate if checkbox is enabled
      const shouldTranslate = !advanced || translateToAll
      
      if (shouldTranslate) {
        setTranslating(true)
        try {
          const allTranslations = await translatePlantToAllLanguages({
            name: nameNorm,
            scientificName: sciNorm || identifiers?.scientificName || undefined,
            meaning: meta?.funFact || meaning || undefined,
            description: description || undefined,
            careSoil: environment?.soil?.texture?.join(', ') || careSoil || undefined,
            identifiers: includeAdvanced && identifiers ? {
              scientificName: identifiers.scientificName || sciNorm || undefined,
              commonNames: identifiers.commonNames,
            } : undefined,
            ecology: includeAdvanced && ecology ? {
              wildlifeValue: ecology.wildlifeValue,
            } : undefined,
            usage: includeAdvanced && usage ? {
              culinaryUses: usage.culinaryUses,
              medicinalUses: usage.medicinalUses,
            } : undefined,
            meta: includeAdvanced && meta ? {
              funFact: meta.funFact,
              authorNotes: meta.authorNotes,
              sourceReferences: meta.sourceReferences,
            } : undefined,
          }, inputLanguage)
          
          // Convert translations to the format needed for saving
          for (const [lang, translated] of Object.entries(allTranslations)) {
            if (lang !== inputLanguage) {
              translationsToSave.push({
                plant_id: id,
                language: lang as SupportedLanguage,
                name: translated.name || nameNorm,
                identifiers: translated.identifiers || undefined,
                ecology: translated.ecology || undefined,
                usage: translated.usage || undefined,
                meta: translated.meta || undefined,
                scientific_name: translated.scientificName || sciNorm || identifiers?.scientificName || null,
                meaning: translated.meta?.funFact || translated.meaning || null,
                description: translated.description || null,
                care_soil: translated.careSoil || null,
              })
            }
          }
        } catch (transErr: any) {
          console.error('Translation error:', transErr)
          setOk('Plant saved, but translation failed. You can translate later when editing.')
        } finally {
          setTranslating(false)
        }
      }
      
      // Save all translations
      if (translationsToSave.length > 0) {
        const { error: transErr } = await savePlantTranslations(translationsToSave)
        if (transErr) {
          console.error('Failed to save translations:', transErr)
          // Don't fail the whole save if translations fail
        }
      }
      
      setOk(t('createPlant.saved'))
      onSaved && onSaved(id)
      // Notify app to refresh plant lists without full reload
      try {
        if (typeof window !== 'undefined')
          window.dispatchEvent(new CustomEvent('plants:refresh'))
      } catch {}
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-8 px-4 md:px-0">
      <Card className="rounded-3xl">
        <CardContent className="p-6 md:p-8 space-y-4">
          <form autoComplete="off" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">{t('createPlant.title')}</div>
              <div className="flex items-center gap-2">
                {/* Language Selector */}
                <div className="flex items-center gap-1.5">
                  <Languages className="h-4 w-4 opacity-70" />
                  <select 
                    id="plant-language" 
                    className="flex h-7 px-2 rounded-lg border border-input dark:border-[#3e3e42] bg-transparent dark:bg-[#2d2d30] text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" 
                    value={inputLanguage} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInputLanguage(e.target.value as SupportedLanguage)}
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang === 'en' ? 'EN' : 'FR'}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setAdvanced((prev) => { const next = !prev; if (next) setEverAdvanced(true); return next })}
                  aria-pressed={advanced}
                  className={`px-3 py-1.5 rounded-2xl text-sm border shadow-sm transition flex items-center gap-2 ${advanced ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]'}`}
                >
                  {advanced ? t('createPlant.advanced') : t('createPlant.simplified')}
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plant-name">{t('createPlant.name')} <span className="text-red-500">*</span></Label>
              <Input id="plant-name" autoComplete="off" placeholder={t('createPlant.namePlaceholder')} value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} required />
              <div className="text-xs opacity-60">{t('createPlant.nameRequired')}</div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plant-image">{t('createPlant.imageUrl')}</Label>
              <Input id="plant-image" autoComplete="off" value={imageUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
            </div>
            {advanced && (
              <>
                <div className="flex items-center justify-between mb-4 p-4 rounded-xl border bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 dark:border-purple-800/30">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-semibold text-purple-900 dark:text-purple-200 mb-1">
                      <Sparkles className="h-5 w-5" />
                      AI Assistant
                    </div>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Let AI fill in all the advanced fields based on the plant name
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAiFill}
                    disabled={aiFilling || !name.trim() || saving || translating}
                    className="rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 shadow-lg"
                  >
                    {aiFilling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Filling...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Fill with AI
                      </>
                    )}
                  </Button>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-scientific">{t('createPlant.scientificName')}</Label>
                  <Input id="plant-scientific" autoComplete="off" value={scientificName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScientificName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-colors">{t('createPlant.colors')}</Label>
                  <Input id="plant-colors" autoComplete="off" placeholder={t('createPlant.colorsPlaceholder')} value={colors} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColors(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>{t('createPlant.seasons')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["Spring", "Summer", "Autumn", "Winter"] as const).map((s) => (
                      <button type="button" key={s} onClick={() => toggleSeason(s)} className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition ${seasons.includes(s) ? "bg-black dark:bg-white text-white dark:text-black" : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"}`} aria-pressed={seasons.includes(s)}>
                        {t(`plant.${s.toLowerCase()}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-description">{t('createPlant.description')}</Label>
                  <Textarea id="plant-description" autoComplete="off" placeholder={t('createPlant.descriptionPlaceholder')} value={description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)} />
                </div>
                <CompleteAdvancedForm
                  identifiers={identifiers}
                  setIdentifiers={setIdentifiers}
                  traits={traits}
                  setTraits={setTraits}
                  dimensions={dimensions}
                  setDimensions={setDimensions}
                  phenology={phenology}
                  setPhenology={setPhenology}
                  environment={environment}
                  setEnvironment={setEnvironment}
                  care={care}
                  setCare={setCare}
                  propagation={propagation}
                  setPropagation={setPropagation}
                  usage={usage}
                  setUsage={setUsage}
                  ecology={ecology}
                  setEcology={setEcology}
                  commerce={commerce}
                  setCommerce={setCommerce}
                  problems={problems}
                  setProblems={setProblems}
                  planting={planting}
                  setPlanting={setPlanting}
                  meta={meta}
                  setMeta={setMeta}
                />
              </>
            )}
            
            {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
            {ok && <div className="text-sm text-green-600 dark:text-green-400">{ok}</div>}
            {translating && <div className="text-sm text-blue-600 dark:text-blue-400">{t('createPlant.translatingToAll')}</div>}
            {aiFilling && <div className="text-sm text-purple-600 dark:text-purple-400 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI is filling in the plant data...
            </div>}
            
            {/* Translation Option - Only shown in Advanced mode, at the bottom before save */}
            {advanced && (
              <div className="flex items-start gap-2 p-4 rounded-xl border bg-stone-50 dark:bg-[#252526] dark:border-[#3e3e42]">
                <input 
                  id="translate-to-all" 
                  type="checkbox" 
                  checked={translateToAll} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTranslateToAll(e.target.checked)}
                  disabled={translating || aiFilling}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor="translate-to-all" className="font-medium cursor-pointer">
                    {t('createPlant.translateToAll')}
                  </Label>
                  <p className="text-xs opacity-70 mt-1">
                    {t('createPlant.translateToAllDescription')}
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="secondary" className="rounded-2xl" onClick={onCancel} disabled={saving || translating || aiFilling}>{t('common.cancel')}</Button>
              <Button type="button" className="rounded-2xl" onClick={save} disabled={saving || translating || aiFilling}>
                {saving ? t('editPlant.saving') : translating ? t('createPlant.translating') : aiFilling ? 'Please wait...' : t('common.save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

