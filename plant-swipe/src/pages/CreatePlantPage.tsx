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
  const { t } = useTranslation('common')
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
  const [error, setError] = React.useState<string | null>(null)
  const [ok, setOk] = React.useState<string | null>(null)
  const [advanced, setAdvanced] = React.useState(false)
  const [everAdvanced, setEverAdvanced] = React.useState(false)
  // Language selection (only in Advanced mode, defaults to English)
  const [inputLanguage, setInputLanguage] = React.useState<SupportedLanguage>(DEFAULT_LANGUAGE)
  const [translateToAll, setTranslateToAll] = React.useState(false)
  const [translating, setTranslating] = React.useState(false)

  const toggleSeason = (s: Plant["seasons"][number]) => {
    setSeasons((cur: string[]) => (cur.includes(s) ? cur.filter((x: string) => x !== s) : [...cur, s]))
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

      // Provide safe defaults so simplified flow never violates NOT NULL constraints
      const defaultPeriod: 'week' | 'month' | 'year' = 'week'
      const defaultAmount: number = 1

      const { error: insErr } = await supabase.from('plants').insert({
        id,
        name: nameNorm,
        scientific_name: sciNorm || null,
        colors: colorArray,
        seasons,
        rarity,
        meaning: meaning || null,
        description: description || null,
        image_url: imageUrl || null,
        care_sunlight: careSunlight,
        // Ensure DB gets a value even when omitted in simplified flow
        care_water: 'Low',
        care_soil: includeAdvanced ? (careSoil || null) : null,
        care_difficulty: careDifficulty,
        seeds_available: seedsAvailable,
        // Default watering frequency fields (optional in Advanced; always persisted safely)
        water_freq_period: includeAdvanced ? waterFreqPeriod : defaultPeriod,
        water_freq_amount: includeAdvanced ? normalizedAmount : defaultAmount,
        // Legacy/alternative field names for compatibility
        water_freq_unit: includeAdvanced ? waterFreqPeriod : defaultPeriod,
        water_freq_value: includeAdvanced ? normalizedAmount : defaultAmount,
      })
      if (insErr) { setError(insErr.message); return }
      
      // Always save translation for the input language (defaults to English in simplified mode)
      const translation = {
        plant_id: id,
        language: inputLanguage,
        name: nameNorm,
        scientific_name: sciNorm || null,
        meaning: meaning || null,
        description: description || null,
        care_soil: includeAdvanced ? (careSoil || null) : null,
      }
      
      const translationsToSave = [translation]
      
      // If translate to all languages is enabled, translate and save
      // Use inputLanguage for DeepL source language (works in both Simplified and Advanced mode)
      if (translateToAll && advanced) {
        setTranslating(true)
        try {
          const allTranslations = await translatePlantToAllLanguages({
            name: nameNorm,
            scientificName: sciNorm || undefined,
            meaning: meaning || undefined,
            description: description || undefined,
            careSoil: includeAdvanced ? (careSoil || undefined) : undefined,
          }, inputLanguage)
          
          // Convert translations to the format needed for saving
          for (const [lang, translated] of Object.entries(allTranslations)) {
            if (lang !== inputLanguage) {
              translationsToSave.push({
                plant_id: id,
                language: lang as SupportedLanguage,
                name: translated.name || nameNorm,
                scientific_name: translated.scientificName || sciNorm || null,
                meaning: translated.meaning || null,
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
                    className="flex h-7 px-2 rounded-lg border border-input bg-transparent text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" 
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
                  className={`px-3 py-1.5 rounded-2xl text-sm border shadow-sm transition flex items-center gap-2 ${advanced ? 'bg-black text-white' : 'bg-white hover:bg-stone-50'}`}
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
                {/* Translation Option */}
                <div className="flex items-start gap-2 p-4 rounded-xl border bg-stone-50">
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
                  <button type="button" key={s} onClick={() => toggleSeason(s)} className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition ${seasons.includes(s) ? "bg-black text-white" : "bg-white hover:bg-stone-50"}`} aria-pressed={seasons.includes(s)}>
                    {t(`plant.${s.toLowerCase()}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plant-description">{t('createPlant.description')}</Label>
              <Textarea id="plant-description" autoComplete="off" placeholder={t('createPlant.descriptionPlaceholder')} value={description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plant-image">{t('createPlant.imageUrl')}</Label>
              <Input id="plant-image" autoComplete="off" value={imageUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageUrl(e.target.value)} />
            </div>
            {advanced && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="plant-rarity">{t('createPlant.rarity')}</Label>
                  <select id="plant-rarity" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" value={rarity} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRarity(e.target.value as Plant["rarity"])}>
                    {(["Common", "Uncommon", "Rare", "Legendary"] as const).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-meaning">{t('createPlant.meaning')}</Label>
                  <Input id="plant-meaning" autoComplete="off" value={meaning} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMeaning(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-sunlight">{t('createPlant.careSunlight')}</Label>
                  <select id="plant-sunlight" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" value={careSunlight} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCareSunlight(e.target.value as Plant["care"]["sunlight"])}>
                    {(["Low", "Medium", "High"] as const).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                {/* Water care is derived from frequency; no manual input */}
                <div className="grid gap-2">
                  <Label htmlFor="plant-soil">{t('createPlant.careSoil')}</Label>
                  <Input id="plant-soil" autoComplete="off" value={careSoil} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCareSoil(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-difficulty">{t('createPlant.careDifficulty')}</Label>
                  <select id="plant-difficulty" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" value={careDifficulty} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCareDifficulty(e.target.value as Plant["care"]["difficulty"]) }>
                    {(["Easy", "Moderate", "Hard"] as const).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input id="plant-seeds" type="checkbox" checked={seedsAvailable} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSeedsAvailable(e.target.checked)} />
                  <Label htmlFor="plant-seeds">{t('createPlant.seedsAvailable')}</Label>
                </div>
                {/* Default watering frequency (shown in Advanced) */}
                <div className="grid gap-2">
                  <Label>{t('createPlant.wateringFrequency')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" value={waterFreqPeriod} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setWaterFreqPeriod(e.target.value as any)}>
                      {(["week","month","year"] as const).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <Input type="number" autoComplete="off" min={1} max={waterFreqPeriod === 'week' ? 7 : waterFreqPeriod === 'month' ? 4 : 12} value={String(waterFreqAmount)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWaterFreqAmount(Math.max(1, Number(e.target.value || '1')))} />
                  </div>
                  <div className="text-xs opacity-60">
                    {waterFreqPeriod === 'week' && t('createPlant.maxPerWeek')}
                    {waterFreqPeriod === 'month' && t('createPlant.maxPerMonth')}
                    {waterFreqPeriod === 'year' && t('createPlant.maxPerYear')}
                  </div>
                </div>
              </>
            )}
            
            {error && <div className="text-sm text-red-600">{error}</div>}
            {ok && <div className="text-sm text-green-600">{ok}</div>}
            {translating && <div className="text-sm text-blue-600">{t('createPlant.translatingToAll')}</div>}
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

