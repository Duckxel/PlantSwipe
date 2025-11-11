import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabaseClient"
import type { Plant } from "@/types/plant"
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from "@/lib/i18n"
import { translatePlantToAllLanguages } from "@/lib/deepl"
import { savePlantTranslations } from "@/lib/plantTranslations"
import { Languages } from "lucide-react"
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
  
  // New JSONB structure state
  const [identifiers, setIdentifiers] = React.useState<Partial<Plant['identifiers']>>({})
  const [traits, setTraits] = React.useState<Partial<Plant['traits']>>({})
  const [dimensions, setDimensions] = React.useState<Partial<Plant['dimensions']>>({})
  const [phenology, setPhenology] = React.useState<Partial<Plant['phenology']>>({})
  const [environment, setEnvironment] = React.useState<Partial<Plant['environment']>>({})
  const [care, setCare] = React.useState<Partial<Plant['care']>>({})
  const [propagation, setPropagation] = React.useState<Partial<Plant['propagation']>>({})
  const [usage, setUsage] = React.useState<Partial<Plant['usage']>>({})
  const [ecology, setEcology] = React.useState<Partial<Plant['ecology']>>({})
  const [commerce, setCommerce] = React.useState<Partial<Plant['commerce']>>({})
  const [problems, setProblems] = React.useState<Partial<Plant['problems']>>({})
  const [planting, setPlanting] = React.useState<Partial<Plant['planting']>>({})
  const [meta, setMeta] = React.useState<Partial<Plant['meta']>>({})
  
  // Legacy fields for backward compatibility (simplified mode)
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

  const toggleSeason = (s: Plant["seasons"][number]) => {
    setSeasons((cur: string[]) => (cur.includes(s) ? cur.filter((x: string) => x !== s) : [...cur, s]))
  }

  // Update name when initialName changes
  React.useEffect(() => {
    if (initialName) {
      setName(initialName)
    }
  }, [initialName])

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

      // Provide safe defaults so simplified flow never violates NOT NULL constraints
      const defaultPeriod: 'week' | 'month' | 'year' = 'week'
      const defaultAmount: number = 1

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
      const translation = {
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
      
      const translationsToSave = [translation]
      
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
              <Label htmlFor="plant-name">{t('createPlant.name')}</Label>
              <Input id="plant-name" autoComplete="off" placeholder={t('createPlant.namePlaceholder')} value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
              <div className="text-xs opacity-60">{t('createPlant.nameRequired')}</div>
            </div>
            {advanced && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="plant-scientific">{t('createPlant.scientificName')}</Label>
                  <Input id="plant-scientific" autoComplete="off" value={scientificName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScientificName(e.target.value)} />
                </div>
              </>
            )}
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
            {advanced && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="plant-image-advanced">Image URL</Label>
                  <Input id="plant-image-advanced" autoComplete="off" value={imageUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
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
            
            {/* Translation Option - Only shown in Advanced mode, at the bottom before save */}
            {advanced && (
              <div className="flex items-start gap-2 p-4 rounded-xl border bg-stone-50 dark:bg-[#252526] dark:border-[#3e3e42]">
                <input 
                  id="translate-to-all" 
                  type="checkbox" 
                  checked={translateToAll} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTranslateToAll(e.target.checked)}
                  disabled={translating}
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
              <Button type="button" variant="secondary" className="rounded-2xl" onClick={onCancel} disabled={saving || translating}>{t('common.cancel')}</Button>
              <Button type="button" className="rounded-2xl" onClick={save} disabled={saving || translating}>
                {saving ? t('editPlant.saving') : translating ? t('createPlant.translating') : t('common.save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

