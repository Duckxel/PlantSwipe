import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import { type CategoryProgress, type PlantFormCategory, BOOLEAN_GATE_DEPS } from "@/lib/plantFormCategories"
import type { Plant, PlantColor, PlantImage, PlantRecipe, PlantSource, PlantWateringSchedule, RecipeCategory, RecipeTime, WateringMode } from "@/types/plant"
import { supabase } from "@/lib/supabaseClient"
import { Sparkles, ChevronDown, ChevronUp, Leaf, Loader2, ExternalLink, X } from "lucide-react"
import { SearchInput } from "@/components/ui/search-input"
import { SearchItem, type SearchItemOption } from "@/components/ui/search-item"
import { FORM_STATUS_COLORS } from "@/constants/plantStatus"
import { PillTabs, type PillTab } from "@/components/ui/pill-tabs"
/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic plant form data handling */

export interface PlantReport {
  id: string
  note: string
  imageUrl: string | null
  createdAt: string
  userName: string
}

export interface PlantVariety {
  id: string
  name: string
  variety: string | null
  imageUrl: string | null
}

export type PlantProfileFormProps = {
  value: Plant
  onChange: (plant: Plant) => void
  colorSuggestions?: PlantColor[]
  companionSuggestions?: string[]
  categoryProgress?: CategoryProgress
  /** Current language for companion search (e.g., 'en', 'fr'). Defaults to 'en'. */
  language?: string
  /** Called when an image is removed. Use to delete from storage if needed. */
  onImageRemove?: (imageUrl: string) => void
  /** Plant reports submitted by users (displayed read-only in the Meta section) */
  plantReports?: PlantReport[]
  /** Auto-detected varieties (same species, different variety) */
  plantVarieties?: PlantVariety[]
}

const glassCardClass =
  "rounded-[24px] border border-stone-200/70 dark:border-[#3e3e42]/70 " +
  "bg-white/90 dark:bg-[#17171a]/90 backdrop-blur " +
  "shadow-[0_25px_70px_-45px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_70px_-45px_rgba(0,0,0,0.65)]"

const sectionTitleClass =
  "flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400 mb-4"

const sectionTitleTextClass =
  "text-xs uppercase tracking-wider font-semibold"

const fieldRowClass = "grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4"


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
  tagConfig?: {
    unique?: boolean
    caseInsensitive?: boolean
    placeholder?: string
  }
  /** If set, this field is only shown when the gate field is true */
  gatedBy?: string
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

const TagInput: React.FC<{
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  unique?: boolean
  caseInsensitive?: boolean
}> = ({ value, onChange, placeholder, unique, caseInsensitive }) => {
  const [input, setInput] = React.useState("")
  const commit = () => {
    const v = input.trim()
    if (!v) return
    if (unique) {
      const normalizedValue = caseInsensitive ? v.toLowerCase() : v
      const exists = value.some((entry) => {
        const normalizedEntry = caseInsensitive ? entry.toLowerCase() : entry
        return normalizedEntry === normalizedValue
      })
      if (exists) {
        setInput("")
        return
      }
    }
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
            <button
              type="button"
              className="text-red-600 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-full w-4 h-4 flex items-center justify-center"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}

const CompanionSelector: React.FC<{
  value: string[];
  onChange: (ids: string[]) => void;
  suggestions?: string[];
  showSuggestions?: boolean;
  onToggleSuggestions?: () => void;
  currentPlantId?: string;
  /** Language for searching (e.g., 'en', 'fr'). When not 'en', searches plant_translations. */
  language?: string;
}> = ({ value, onChange, suggestions, showSuggestions, onToggleSuggestions, currentPlantId, language = 'en' }) => {
  const { t } = useTranslation('common')
  const [companions, setCompanions] = React.useState<{ id: string; name: string; imageUrl?: string }[]>([])
  const [suggestionSearching, setSuggestionSearching] = React.useState<string | null>(null)

  // Track disabled IDs (current plant + already selected)
  const disabledIds = React.useMemo(() => {
    const ids = new Set(value)
    if (currentPlantId) ids.add(currentPlantId)
    return ids
  }, [value, currentPlantId])

  React.useEffect(() => {
    setCompanions((prev) => prev.filter((c) => value.includes(c.id)))
  }, [value])

  // Fetch plant names (and images) for companion IDs - use translations for non-English
  React.useEffect(() => {
    const missing = value.filter((id) => !companions.find((c) => c.id === id))
    if (!missing.length) return
    const loadMissing = async () => {
      let plantNames: { id: string; name: string }[] = []

      if (language !== 'en') {
        const { data: translationData } = await supabase
          .from('plant_translations')
          .select('plant_id, name')
          .in('plant_id', missing)
          .eq('language', language)

        if (translationData && translationData.length > 0) {
          plantNames = translationData.map((t) => ({
            id: t.plant_id as string,
            name: t.name as string
          }))
        }

        const foundIds = new Set(plantNames.map(p => p.id))
        const missingTranslations = missing.filter(id => !foundIds.has(id))
        if (missingTranslations.length > 0) {
          const { data: fallbackData } = await supabase
            .from('plants')
            .select('id,name')
            .in('id', missingTranslations)
          if (fallbackData) {
            plantNames = [...plantNames, ...fallbackData.map((p) => ({
              id: p.id as string,
              name: (p as any).name as string
            }))]
          }
        }
      } else {
        const { data: plantsData } = await supabase.from('plants').select('id,name').in('id', missing)
        if (plantsData) {
          plantNames = plantsData.map((p) => ({
            id: p.id as string,
            name: (p as any).name as string
          }))
        }
      }

      if (plantNames.length > 0) {
        const { data: imagesData } = await supabase
          .from('plant_images')
          .select('plant_id, link')
          .in('plant_id', plantNames.map(p => p.id))
          .eq('use', 'primary')

        const imageMap = new Map<string, string>()
        if (imagesData) {
          imagesData.forEach((img) => {
            if (img.plant_id && img.link) imageMap.set(img.plant_id, img.link)
          })
        }

        setCompanions((prev) => {
          const existingIds = new Set(prev.map(c => c.id))
          const newCompanions = plantNames
            .filter(p => !existingIds.has(p.id))
            .map((p) => ({
              id: p.id,
              name: p.name,
              imageUrl: imageMap.get(p.id)
            }))
          return [...prev, ...newCompanions]
        })
      }
    }
    loadMissing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, language])

  // Async search for SearchItem: returns SearchItemOption[] with plant images as icons
  const searchPlantsAsync = React.useCallback(async (query: string): Promise<SearchItemOption[]> => {
    let plantResults: { id: string; name: string }[] = []

    if (language !== 'en') {
      let q = supabase
        .from('plant_translations')
        .select('plant_id, name')
        .eq('language', language)
        .order('name')
        .limit(30)
      if (query.trim()) q = q.ilike('name', `%${query.trim()}%`)
      const { data } = await q
      if (data) plantResults = data.map((t) => ({ id: t.plant_id as string, name: t.name as string }))
    } else {
      let q = supabase.from('plants').select('id,name').order('name').limit(30)
      if (query.trim()) q = q.ilike('name', `%${query.trim()}%`)
      const { data } = await q
      if (data) plantResults = data.map((p) => ({ id: p.id as string, name: (p as any).name as string }))
    }

    // Fetch images for results
    const imageMap = new Map<string, string>()
    if (plantResults.length > 0) {
      const { data: imagesData } = await supabase
        .from('plant_images')
        .select('plant_id, link')
        .in('plant_id', plantResults.map(p => p.id))
        .eq('use', 'primary')
      if (imagesData) imagesData.forEach((img) => {
        if (img.plant_id && img.link) imageMap.set(img.plant_id, img.link)
      })
    }

    return plantResults.map((p) => ({
      id: p.id,
      label: p.name,
      description: imageMap.get(p.id) || null,
    }))
  }, [language])

  const handleMultiSelect = (selected: SearchItemOption[]) => {
    const newIds = selected.map(o => o.id).filter(id => !value.includes(id) && id !== currentPlantId)
    if (!newIds.length) return
    onChange([...value, ...newIds])
    // Add to companions cache for immediate display
    setCompanions(prev => {
      const existingIds = new Set(prev.map(c => c.id))
      const added = selected
        .filter(o => newIds.includes(o.id) && !existingIds.has(o.id))
        .map(o => ({ id: o.id, name: o.label, imageUrl: undefined as string | undefined }))
      return [...prev, ...added]
    })
  }

  const removeCompanion = (id: string) => {
    onChange(value.filter((c) => c !== id))
    setCompanions((prev) => prev.filter((c) => c.id !== id))
  }

  // Search for a suggested companion by name and add it
  const addSuggestedCompanion = async (suggestedName: string) => {
    setSuggestionSearching(suggestedName)
    try {
      let foundPlant: { id: string; name: string } | null = null

      if (language !== 'en') {
        let { data: translationData } = await supabase
          .from('plant_translations')
          .select('plant_id, name')
          .eq('language', language)
          .ilike('name', suggestedName)
          .limit(1)

        if (!translationData?.length) {
          const { data } = await supabase
            .from('plant_translations')
            .select('plant_id, name')
            .eq('language', language)
            .ilike('name', `%${suggestedName}%`)
            .limit(1)
          translationData = data
        }

        if (translationData?.length) {
          foundPlant = { id: translationData[0].plant_id as string, name: translationData[0].name as string }
        }
      }

      if (!foundPlant) {
        let { data } = await supabase.from('plants').select('id,name').ilike('name', suggestedName).limit(1)
        if (!data?.length) {
          const result = await supabase.from('plants').select('id,name').ilike('name', `%${suggestedName}%`).limit(1)
          data = result.data
        }
        if (data?.length) {
          if (language !== 'en') {
            const { data: translatedName } = await supabase
              .from('plant_translations').select('name').eq('plant_id', data[0].id).eq('language', language).limit(1)
            foundPlant = { id: data[0].id as string, name: translatedName?.[0]?.name || (data[0] as any).name as string }
          } else {
            foundPlant = { id: data[0].id as string, name: (data[0] as any).name as string }
          }
        }
      }

      if (foundPlant) {
        if (foundPlant.id === currentPlantId) return
        if (!value.includes(foundPlant.id)) {
          const { data: imgData } = await supabase
            .from('plant_images').select('link').eq('plant_id', foundPlant.id).eq('use', 'primary').limit(1)
          const plant = { id: foundPlant.id, name: foundPlant.name, imageUrl: imgData?.[0]?.link }
          onChange([...value, plant.id])
          setCompanions((prev) => [...prev, plant])
        }
      }
    } finally {
      setSuggestionSearching(null)
    }
  }

  const isSuggestionAdded = (suggestedName: string) => {
    return companions.some(c => c.name.toLowerCase() === suggestedName.toLowerCase())
  }

  return (
    <div className="grid gap-3">
      {/* AI Suggestions Section */}
      {suggestions && suggestions.length > 0 && (
        <div className="mb-2">
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"
            onClick={onToggleSuggestions}
          >
            <Sparkles className="h-4 w-4" />
            {showSuggestions
              ? t('plantAdmin.hideCompanionSuggestions', 'Hide AI suggestions')
              : t('plantAdmin.showCompanionSuggestions', 'Show AI suggestions')}
          </button>
          {showSuggestions && (
            <div className="mt-2 rounded-xl border border-emerald-100/70 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/70 via-white/80 to-emerald-100/70 dark:from-[#0f1a12] dark:via-[#0c140f] dark:to-[#0a120d] px-4 py-3 shadow-inner space-y-3">
              <div className="text-xs text-muted-foreground">
                {t('plantAdmin.companionSuggestionsReview', 'Click Add to link suggested plants. Not all may exist in the database.')}
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestedName, idx) => {
                  const alreadyAdded = isSuggestionAdded(suggestedName)
                  const isSearching = suggestionSearching === suggestedName
                  return (
                    <button
                      key={`${suggestedName}-${idx}`}
                      type="button"
                      disabled={alreadyAdded || isSearching}
                      onClick={() => addSuggestedCompanion(suggestedName)}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                        alreadyAdded
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 cursor-default'
                          : 'bg-white dark:bg-[#1a1a1a] border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200'
                      }`}
                    >
                      {isSearching ? (
                        <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
                      ) : alreadyAdded ? (
                        <span className="text-emerald-600">✓</span>
                      ) : (
                        <span className="text-emerald-500">+</span>
                      )}
                      {suggestedName}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current Companions - Enhanced Grid */}
      {value.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {companions.map((c) => (
            <div
              key={c.id}
              className="relative group rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1a1a] overflow-hidden"
            >
              <div className="aspect-[4/3] bg-stone-100 dark:bg-stone-800">
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-400">
                    <Leaf className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="text-sm font-medium truncate text-stone-900 dark:text-stone-100">{c.name}</p>
              </div>
              <button
                type="button"
                onClick={() => removeCompanion(c.id)}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex items-center justify-center shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={`Remove ${c.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-stone-300 dark:border-stone-700 rounded-xl">
          {t('plantAdmin.noCompanions', 'No companion or related plants added yet.')}
        </div>
      )}

      {/* Add Button — uses SearchItem in multi-select mode */}
      <SearchItem
        multiSelect
        value={null}
        values={value}
        onSelect={() => {}}
        onMultiSelect={handleMultiSelect}
        onSearch={searchPlantsAsync}
        disabledIds={disabledIds}
        placeholder={t('plantAdmin.addCompanionBtn', 'Add Plants')}
        title={t('plantAdmin.selectCompanionTitle', 'Select Plants')}
        description={t('plantAdmin.selectCompanionDesc', 'Select multiple plants to add.')}
        searchPlaceholder={t('plantAdmin.searchPlantsPlaceholder', 'Search plants by name...')}
        emptyMessage={t('plantAdmin.noPlantsFound', 'No plants found. Try a different search term.')}
        confirmLabel={t('plantAdmin.addSelectedBtn', 'Add Selected')}
        renderItem={(option) => (
          <div className="flex flex-col w-full h-full">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-t-xl sm:rounded-t-2xl bg-stone-100 dark:bg-stone-800">
              {option.description ? (
                <img src={option.description} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-400">
                  <Leaf className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="flex-1 flex items-center px-3 py-2">
              <p className="text-sm font-medium truncate text-stone-900 dark:text-white">{option.label}</p>
            </div>
          </div>
        )}
      />
    </div>
  )
}

/** Derive watering mode from existing schedule data */
function deriveWateringMode(schedules?: PlantWateringSchedule[], explicitMode?: WateringMode): WateringMode {
  if (explicitMode) return explicitMode
  if (!schedules?.length) return 'always'
  const hasHotCold = schedules.some((s) => s.season === 'hot' || s.season === 'cold')
  return hasHotCold ? 'seasonal' : 'always'
}

/** Build schedules array from the structured form state */
function buildSchedulesFromMode(
  mode: WateringMode,
  always: { quantity?: number; timePeriod?: PlantWateringSchedule['timePeriod'] },
  hot: { quantity?: number; timePeriod?: PlantWateringSchedule['timePeriod'] },
  cold: { quantity?: number; timePeriod?: PlantWateringSchedule['timePeriod'] },
): PlantWateringSchedule[] {
  if (mode === 'seasonal') {
    return [
      { season: 'hot', quantity: hot.quantity, timePeriod: hot.timePeriod },
      { season: 'cold', quantity: cold.quantity, timePeriod: cold.timePeriod },
    ]
  }
  return [{ quantity: always.quantity, timePeriod: always.timePeriod }]
}

const TimePeriodSelect: React.FC<{
  value: PlantWateringSchedule['timePeriod'] | undefined
  onChange: (v: PlantWateringSchedule['timePeriod'] | undefined) => void
  t: TFunction
}> = ({ value, onChange, t }) => (
  <select
    className="h-9 rounded-md border px-2 text-sm"
    value={value || ""}
    onChange={(e) => onChange(e.target.value ? (e.target.value as PlantWateringSchedule['timePeriod']) : undefined)}
  >
    <option value="">{t('plantAdmin.watering.timePeriodPlaceholder', 'Time period')}</option>
    {(['week', 'month', 'year'] as const).map((opt) => (
      <option key={opt} value={opt}>
        {t(`plantAdmin.optionLabels.${opt}`, opt)}
      </option>
    ))}
  </select>
)

const WateringScheduleEditor: React.FC<{
  value: PlantWateringSchedule[] | undefined
  onChange: (schedules: PlantWateringSchedule[]) => void
  wateringMode?: WateringMode
  onWateringModeChange?: (mode: WateringMode) => void
}> = ({ value, onChange, wateringMode, onWateringModeChange }) => {
  const { t } = useTranslation('common')
  const schedules = Array.isArray(value) ? value : []
  const mode = deriveWateringMode(schedules, wateringMode)

  // Extract current values from schedules
  const alwaysEntry = schedules.find((s) => !s.season) || schedules[0] || {}
  const hotEntry = schedules.find((s) => s.season === 'hot') || {}
  const coldEntry = schedules.find((s) => s.season === 'cold') || {}

  const setMode = (newMode: WateringMode) => {
    onWateringModeChange?.(newMode)
    if (newMode === 'always') {
      // Convert to single schedule — take hot entry as default or keep existing
      const src = hotEntry.quantity != null ? hotEntry : alwaysEntry
      onChange(buildSchedulesFromMode('always', src, hotEntry, coldEntry))
    } else {
      // Convert to seasonal — use current always values as hot default
      const src = alwaysEntry.quantity != null ? alwaysEntry : hotEntry
      onChange(buildSchedulesFromMode('seasonal', alwaysEntry,
        { quantity: src.quantity, timePeriod: src.timePeriod },
        { quantity: coldEntry.quantity ?? src.quantity, timePeriod: coldEntry.timePeriod ?? src.timePeriod }
      ))
    }
  }

  const updateAlways = (patch: { quantity?: number; timePeriod?: PlantWateringSchedule['timePeriod'] }) => {
    const updated = { ...alwaysEntry, ...patch }
    onChange(buildSchedulesFromMode('always', updated, hotEntry, coldEntry))
  }

  const updateHot = (patch: { quantity?: number; timePeriod?: PlantWateringSchedule['timePeriod'] }) => {
    const updated = { ...hotEntry, ...patch }
    onChange(buildSchedulesFromMode('seasonal', alwaysEntry, updated, coldEntry))
  }

  const updateCold = (patch: { quantity?: number; timePeriod?: PlantWateringSchedule['timePeriod'] }) => {
    const updated = { ...coldEntry, ...patch }
    onChange(buildSchedulesFromMode('seasonal', alwaysEntry, hotEntry, updated))
  }

  const parseNumber = (val: string): number | undefined => {
    if (val === '') return undefined
    const n = parseInt(val, 10)
    return Number.isFinite(n) ? n : undefined
  }

  return (
    <div className="grid gap-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'always' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('always')}
        >
          {t('plantAdmin.watering.modeAlways', 'Always (same year-round)')}
        </Button>
        <Button
          type="button"
          variant={mode === 'seasonal' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('seasonal')}
        >
          {t('plantAdmin.watering.modeSeasonal', 'Seasonal (Hot / Cold)')}
        </Button>
      </div>

      {mode === 'always' ? (
        /* Always mode — single quantity + time period */
        <div className="rounded border p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              placeholder={t('plantAdmin.watering.quantityPlaceholder', 'Quantity')}
              type="number"
              min={0}
              value={alwaysEntry.quantity ?? ""}
              onChange={(e) => updateAlways({ quantity: parseNumber(e.target.value) })}
            />
            <TimePeriodSelect
              value={alwaysEntry.timePeriod}
              onChange={(tp) => updateAlways({ timePeriod: tp })}
              t={t}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('plantAdmin.watering.alwaysHelper', 'Same watering schedule all year round.')}
          </p>
        </div>
      ) : (
        /* Seasonal mode — hot and cold */
        <div className="grid gap-3">
          {/* Hot environment */}
          <div className="rounded border p-3">
            <Label className="mb-2 font-medium text-orange-600">
              {t('plantAdmin.watering.hotLabel', 'Hot environment')}
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              <Input
                placeholder={t('plantAdmin.watering.quantityPlaceholder', 'Quantity')}
                type="number"
                min={0}
                value={hotEntry.quantity ?? ""}
                onChange={(e) => updateHot({ quantity: parseNumber(e.target.value) })}
              />
              <TimePeriodSelect
                value={hotEntry.timePeriod}
                onChange={(tp) => updateHot({ timePeriod: tp })}
                t={t}
              />
            </div>
          </div>

          {/* Cold environment */}
          <div className="rounded border p-3">
            <Label className="mb-2 font-medium text-blue-600">
              {t('plantAdmin.watering.coldLabel', 'Cold environment')}
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              <Input
                placeholder={t('plantAdmin.watering.quantityPlaceholder', 'Quantity')}
                type="number"
                min={0}
                value={coldEntry.quantity ?? ""}
                onChange={(e) => updateCold({ quantity: parseNumber(e.target.value) })}
              />
              <TimePeriodSelect
                value={coldEntry.timePeriod}
                onChange={(tp) => updateCold({ timePeriod: tp })}
                t={t}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {t('plantAdmin.watering.seasonalHelper', 'Set different watering needs for hot and cold environments so users can adjust based on temperature.')}
          </p>
        </div>
      )}
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
            <button type="button" className="text-red-600 hover:text-red-800" onClick={() => remove(idx)} aria-label="Remove source">
              <X className="h-4 w-4" />
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

// ============================================================================
// Section 1: Base
// ============================================================================
const baseFields: FieldConfig[] = [
  { key: "commonNames", label: "Common Names", description: "Alternative common names for this plant", type: "tags" },
  { key: "scientificNameSpecies", label: "Scientific Name (Species)", description: "Latin binomial (e.g. Monstera deliciosa)", type: "text" },
  { key: "scientificNameVariety", label: "Scientific Name (Variety)", description: "Variety or cultivar name", type: "text" },
  { key: "family", label: "Family", description: "Botanical family (e.g. Araceae)", type: "text" },
  { key: "plantType", label: "Plant Type", description: "Primary botanical type of the plant", type: "select", options: [
    { label: "Plant", value: "plant" },
    { label: "Flower", value: "flower" },
    { label: "Bamboo", value: "bamboo" },
    { label: "Shrub", value: "shrub" },
    { label: "Tree", value: "tree" },
    { label: "Cactus", value: "cactus" },
    { label: "Succulent", value: "succulent" },
  ] },
  { key: "presentation", label: "Presentation", description: "Encyclopedia-style description (150-300 words)", type: "textarea" },
  { key: "featuredMonth", label: "Featured Month(s)", description: "Months when this plant should be highlighted", type: "multiselect", options: monthOptions },
]

// ============================================================================
// Section 2: Identity (15 items)
// ============================================================================
const identityFields: FieldConfig[] = [
  { key: "origin", label: "Country of Origin", description: "Countries or regions of origin", type: "tags" },
  { key: "climate", label: "Climate", description: "Climate types where the plant naturally grows", type: "multiselect", options: ["Polar","Montane","Oceanic","Degraded Oceanic","Temperate Continental","Mediterranean","Tropical Dry","Tropical Humid","Tropical Volcanic","Tropical Cyclonic","Humid Insular","Subtropical Humid","Equatorial","Windswept Coastal"] },
  { key: "season", label: "Season", description: "Active/peak seasons", type: "multiselect", options: ["Spring","Summer","Autumn","Winter"] },
  { key: "utility", label: "Utility / Use", description: "Practical or ornamental roles", type: "multiselect", options: ["Edible","Ornamental","Aromatic","Medicinal","Fragrant","Cereal","Spice","Infusion"] },
  { key: "ediblePart", label: "Edible Part(s)", description: "Which parts are edible (if applicable)", type: "multiselect", options: ["Flower","Fruit","Seed","Leaf","Stem","Bulb","Rhizome","Bark","Wood"], gatedBy: "utility:edible" },
  { key: "thorny", label: "Thorny?", description: "Does the plant have thorns or spines?", type: "boolean" },
  { key: "lifeCycle", label: "Life Cycle", description: "Plant life cycle type(s)", type: "multiselect", options: ["Annual","Biennial","Perennial","Succulent Perennial","Monocarpic","Short Cycle","Ephemeral"] },
  { key: "averageLifespan", label: "Average Lifespan", description: "Expected lifespan range", type: "multiselect", options: ["Less than 1 year","2 years","3–10 years","10–50 years","50+ years"] },
  { key: "foliagePersistence", label: "Foliage Persistence", description: "How leaves behave across seasons", type: "multiselect", options: ["Deciduous","Evergreen","Semi-Evergreen","Marcescent","Winter Dormant","Dry Season Deciduous"] },
  { key: "livingSpace", label: "Living Space", description: "Where the plant can be grown", type: "multiselect", options: ["Indoor","Outdoor","Terrarium","Greenhouse"] },
  { key: "landscaping", label: "Landscaping / Placement", description: "Garden placement options", type: "multiselect", options: ["Pot","Planter","Hanging","Window Box","Green Wall","Flowerbed","Border","Edging","Path","Tree Base","Vegetable Garden","Orchard","Hedge","Free Growing","Trimmed Hedge","Windbreak","Pond Edge","Waterside","Ground Cover","Grove","Background","Foreground"] },
  { key: "plantHabit", label: "Plant Habit / Shape", description: "Growth habit and form", type: "multiselect", options: ["Upright","Arborescent","Shrubby","Bushy","Clumping","Erect","Creeping","Carpeting","Ground Cover","Prostrate","Spreading","Climbing","Twining","Scrambling","Liana","Trailing","Columnar","Conical","Fastigiate","Globular","Spreading Flat","Rosette","Cushion","Ball Shaped","Succulent","Palmate","Rhizomatous","Suckering"] },
]

// ============================================================================
// Section 2b: Safety & Toxicity (5 items)
// ============================================================================
const safetyFields: FieldConfig[] = [
  { key: "toxicityHuman", label: "Toxicity (Human)", description: "Toxicity level for humans", type: "select", options: ["Non-Toxic","Slightly Toxic","Very Toxic","Deadly","Undetermined"] },
  { key: "toxicityPets", label: "Toxicity (Pets)", description: "Toxicity level for pets/animals", type: "select", options: ["Non-Toxic","Slightly Toxic","Very Toxic","Deadly","Undetermined"] },
  { key: "poisoningMethod", label: "Poisoning Method(s)", description: "How poisoning can occur", type: "multiselect", options: ["Touch","Ingestion","Eye Contact","Inhalation","Sap Contact"] },
  { key: "poisoningSymptoms", label: "Poisoning Symptoms", description: "Symptoms description for prevention", type: "textarea" },
  { key: "allergens", label: "Allergens", description: "Known allergens", type: "tags" },
]

// ============================================================================
// Section 3: Care (10 items)
// ============================================================================
const careFields: FieldConfig[] = [
  { key: "careLevel", label: "Care Level", description: "How difficult to care for", type: "select", options: ["Easy","Moderate","Complex"] },
  { key: "sunlight", label: "Sunlight / Exposure", description: "Light requirements", type: "multiselect", options: ["Full Sun","Partial Sun","Partial Shade","Light Shade","Deep Shade","Direct Light","Bright Indirect Light","Medium Light","Low Light"] },
  { key: "temperatureMax", label: "Temperature Max (°C)", description: "Maximum tolerable temperature", type: "number" },
  { key: "temperatureMin", label: "Temperature Min (°C)", description: "Minimum tolerable temperature", type: "number" },
  { key: "temperatureIdeal", label: "Temperature Ideal (°C)", description: "Ideal growing temperature", type: "number" },
  { key: "wateringSchedules", label: "Watering Schedule", description: "Set a global or seasonal (hot/cold) watering schedule", type: "watering" },
  { key: "wateringType", label: "Watering Type", description: "Preferred watering methods", type: "multiselect", options: ["Hose","Surface","Drip","Soaking","Wick"] },
  { key: "hygrometry", label: "Humidity (%)", description: "Preferred humidity level (0-100)", type: "number" },
  { key: "mistingFrequency", label: "Misting (per week)", description: "Times per week for misting", type: "number" },
  { key: "specialNeeds", label: "Special Needs", description: "Special care requirements", type: "tags" },
]

// ============================================================================
// Section 3b: Care Details — Substrate, Mulch, Nutrition (8 items)
// ============================================================================
const careDetailsFields: FieldConfig[] = [
  { key: "substrate", label: "Substrate", description: "Suitable substrates/soil types", type: "tags" },
  { key: "substrateMix", label: "Substrate Mix", description: "Special substrate mix names", type: "tags" },
  { key: "soilAdvice", label: "Soil Guidance", description: "Substrate/soil advice text", type: "textarea" },
  { key: "mulchingNeeded", label: "Mulching Needed?", description: "Is mulching recommended?", type: "boolean" },
  { key: "mulchType", label: "Mulch Type", description: "Recommended mulch types", type: "tags", gatedBy: "mulchingNeeded" },
  { key: "mulchAdvice", label: "Mulch Advice", description: "Mulching guidance", type: "textarea", gatedBy: "mulchingNeeded" },
  { key: "nutritionNeed", label: "Nutrient Needs", description: "Key nutritional requirements", type: "tags" },
  { key: "fertilizer", label: "Fertilizer", description: "Recommended fertilizer types", type: "tags" },
  { key: "fertilizerAdvice", label: "Fertilizer Advice", description: "Fertilizing schedule and advice", type: "textarea" },
]

// ============================================================================
// Section 4: Growth
// ============================================================================
const growthFields: FieldConfig[] = [
  { key: "sowingMonth", label: "Sowing Month(s)", description: "Best months for sowing", type: "multiselect", options: monthOptions },
  { key: "floweringMonth", label: "Flowering Month(s)", description: "Months when plant flowers", type: "multiselect", options: monthOptions },
  { key: "fruitingMonth", label: "Fruiting Month(s)", description: "Months when plant fruits", type: "multiselect", options: monthOptions },
  { key: "heightCm", label: "Height (cm)", description: "Mature height in centimeters", type: "number" },
  { key: "wingspanCm", label: "Spread / Width (cm)", description: "Mature spread in centimeters", type: "number" },
  { key: "separationCm", label: "Spacing (cm)", description: "Recommended distance between two plants", type: "number" },
  { key: "staking", label: "Staking Needed?", description: "Does the plant need staking/support?", type: "boolean" },
  { key: "stakingAdvice", label: "Staking Advice", description: "What type of support and how to stake", type: "textarea", gatedBy: "staking" },
  { key: "division", label: "Division / Propagation", description: "How to propagate", type: "multiselect", options: ["Seed","Clump Division","Bulb Division","Rhizome Division","Cutting","Layering","Stolon","Sucker","Grafting","Spore"] },
  { key: "cultivationMode", label: "Cultivation Mode", description: "Type of growing setup", type: "multiselect", options: ["Open Ground","Flowerbed","Vegetable Garden","Raised Bed","Orchard","Rockery","Slope","Mound","Pot","Planter","Hanging","Greenhouse","Indoor","Pond","Waterlogged Soil","Hydroponic","Aquaponic","Mineral Substrate","Permaculture","Agroforestry"] },
  { key: "sowingMethod", label: "Sowing Method", description: "How to sow seeds", type: "multiselect", options: ["Open Ground","Pot","Tray","Greenhouse","Mini Greenhouse","Broadcast","Row"] },
  { key: "transplanting", label: "Transplanting?", description: "Does the plant need transplanting?", type: "boolean" },
  { key: "transplantingTime", label: "Transplanting Time", description: "When to transplant (e.g. after 4 true leaves)", type: "text", gatedBy: "transplanting" },
  { key: "outdoorPlantingTime", label: "Outdoor Planting Time", description: "When to plant outdoors", type: "text", gatedBy: "transplanting" },
  { key: "sowingAdvice", label: "Sowing Advice", description: "Sowing and planting instructions", type: "textarea" },
  { key: "pruning", label: "Pruning Needed?", description: "Does the plant need pruning?", type: "boolean" },
  { key: "pruningMonth", label: "Pruning Month(s)", description: "Best months for pruning", type: "multiselect", options: monthOptions, gatedBy: "pruning" },
  { key: "pruningAdvice", label: "Pruning Advice", description: "Pruning technique and tips", type: "textarea", gatedBy: "pruning" },
]

// ============================================================================
// Section 5: Danger
// ============================================================================
const dangerFields: FieldConfig[] = [
  { key: "pests", label: "Pests", description: "Common pest threats", type: "tags" },
  { key: "diseases", label: "Diseases", description: "Common diseases", type: "tags" },
]

// ============================================================================
// Section 6: Ecology & Biodiversity
// ============================================================================
const ecologyFields: FieldConfig[] = [
  { key: "conservationStatus", label: "Conservation Status (IUCN)", description: "IUCN conservation status", type: "multiselect", options: ["Least Concern","Near Threatened","Vulnerable","Endangered","Critically Endangered","Extinct in Wild","Extinct","Data Deficient","Not Evaluated"] },
  { key: "ecologicalStatus", label: "Ecological Status", description: "Ecological classification tags", type: "tags" },
  { key: "biotopes", label: "Biotopes", description: "Natural biotope environments", type: "tags" },
  { key: "urbanBiotopes", label: "Urban Biotopes", description: "Anthropized/urban environments", type: "multiselect", options: ["Urban Garden","Periurban Garden","Park","Urban Wasteland","Green Wall","Green Roof","Balcony","Agricultural Hedge","Cultivated Orchard","Vegetable Garden","Roadside"] },
  { key: "ecologicalTolerance", label: "Ecological Tolerance", description: "Environmental tolerances", type: "multiselect", options: ["Drought","Scorching Sun","Permanent Shade","Excess Water","Frost","Heatwave","Wind"] },
  { key: "biodiversityRole", label: "Biodiversity Role", description: "Role in garden biodiversity", type: "tags" },
  { key: "beneficialRoles", label: "Beneficial Role(s)", description: "Positive ecological contributions", type: "tags" },
  { key: "harmfulRoles", label: "Harmful Role(s)", description: "Negative ecological effects", type: "tags" },
  { key: "pollinatorsAttracted", label: "Pollinators Attracted", description: "Which pollinators visit this plant", type: "tags" },
  { key: "birdsAttracted", label: "Birds Attracted", description: "Birds drawn to this plant", type: "tags" },
  { key: "mammalsAttracted", label: "Mammals Attracted", description: "Mammals drawn to this plant", type: "tags" },
  { key: "symbiosis", label: "Symbiosis", description: "Symbiotic relationships (plants, insects, fungi)", type: "tags" },
  { key: "symbiosisNotes", label: "Symbiosis Notes", description: "Detailed symbiosis description", type: "textarea" },
  { key: "ecologicalManagement", label: "Ecological Management", description: "Eco-friendly management tips", type: "tags" },
  { key: "ecologicalImpact", label: "Ecological Impact", description: "Overall ecological impact", type: "multiselect", options: ["Neutral","Favorable","Potentially Invasive","Locally Invasive"] },
]

// ============================================================================
// Section 7: Consumption / Usage
// ============================================================================
const consumptionFields: FieldConfig[] = [
  { key: "nutritionalValue", label: "Nutritional Value", description: "Nutritional information for edible plants", type: "textarea" },
  { key: "infusionParts", label: "Infusion Part(s)", description: "Which parts can be used for infusion", type: "tags", gatedBy: "utility:infusion" },
  { key: "infusionBenefits", label: "Infusion Benefits", description: "Health benefits of infusion/tea", type: "textarea", gatedBy: "utility:infusion" },
  { key: "infusionRecipeIdeas", label: "Infusion Recipe Ideas", description: "Tea/infusion recipe suggestions", type: "textarea", gatedBy: "utility:infusion" },
  { key: "medicinalBenefits", label: "Medicinal Benefits", description: "Health benefits", type: "textarea", gatedBy: "utility:medicinal" },
  { key: "medicinalUsage", label: "Medical Usage", description: "How to use medicinally", type: "textarea", gatedBy: "utility:medicinal" },
  { key: "medicinalWarning", label: "Warning / Safety Note", description: "Safety: recommended today or historical only?", type: "textarea", gatedBy: "utility:medicinal" },
  { key: "medicinalHistory", label: "Medicinal History", description: "Historical use (e.g. used in China since X century)", type: "textarea", gatedBy: "utility:medicinal" },
  { key: "aromatherapyBenefits", label: "Aromatherapy Benefits", description: "Benefits for aromatherapy", type: "textarea", gatedBy: "utility:aromatic" },
  { key: "essentialOilBlends", label: "Essential Oil Blends", description: "Essential oil blend ideas", type: "textarea", gatedBy: "utility:aromatic" },
  { key: "edibleOil", label: "Edible Oil?", description: "Does the plant produce an edible oil?", type: "select", options: ["Yes","No","Unknown"] },
  { key: "spiceMixes", label: "Spice Mixes", description: "Spice blend uses", type: "tags" },
  { key: "infusionMixes", label: "Infusion Mixes", description: "Infusion mix name → benefit", type: "dict", gatedBy: "utility:infusion" },
]

// ============================================================================
// Section 8: Misc
// ============================================================================
const miscFields: FieldConfig[] = [
  { key: "companionPlants", label: "Companion Plants", description: "Good garden companions", type: "companions" },
  { key: "biotopePlants", label: "Biotope Plants", description: "Plants from the same biotope", type: "companions" },
  { key: "beneficialPlants", label: "Beneficial Plants", description: "Plants that benefit this one", type: "companions" },
  { key: "harmfulPlants", label: "Harmful Plants", description: "Plants to avoid nearby", type: "companions" },
  { key: "plantTags", label: "Plant Tags", description: "Searchable tags and keywords", type: "tags" },
  { key: "biodiversityTags", label: "Biodiversity Tags", description: "Biodiversity-specific tags", type: "tags" },
  { key: "sources", label: "Sources", description: "Reference links and citations", type: "sources" },
]

// ============================================================================
// Section 9: Meta
// ============================================================================
const metaFields: FieldConfig[] = [
  { key: "status", label: "Status", description: "Editorial status", type: "select", options: ["approved","rework","review","in_progress"] },
  { key: "adminCommentary", label: "Admin Notes", description: "Internal notes for editors", type: "textarea" },
  { key: "contributors", label: "Contributors", description: "People who contributed to this plant entry", type: "tags", tagConfig: { unique: true, caseInsensitive: true } },
]

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
    const isMonthMultiField = field.type === "multiselect" && field.options === monthOptions
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
          // Normalize for comparison: handles "cactus_succulent" vs "Cactus & Succulent"
          const canon = (v: unknown) => typeof v === 'string' ? v.replace(/[_\s&/–-]+/g, '').toLowerCase() : v
          const includesValue = (candidate: unknown) =>
            currentValues.some((entry) => Object.is(entry, candidate) || canon(entry) === canon(candidate))
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
                          ? currentValues.filter((entry) => !(Object.is(entry, opt.value) || canon(entry) === canon(opt.value)))
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
            {(() => {
              const tagPlaceholder = field.tagConfig
                ? t(`${translationBase}.placeholder`, { defaultValue: field.tagConfig.placeholder || "" })
                : ""
              return (
            <TagInput
              value={Array.isArray(value) ? value : []}
              onChange={(v) => onChange(field.key, v)}
              placeholder={tagPlaceholder || undefined}
              unique={field.tagConfig?.unique}
              caseInsensitive={field.tagConfig?.caseInsensitive}
            />
              )
            })()}
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
            <WateringScheduleEditor
              value={value as any}
              onChange={(v) => onChange(field.key, v)}
              wateringMode={plant.wateringMode}
              onWateringModeChange={(m) => onChange('wateringMode', m)}
            />
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

function ImageEditor({ images, onChange, onRemove }: { images: PlantImage[]; onChange: (v: PlantImage[]) => void; onRemove?: (imageUrl: string) => void }) {
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
    const removed = list[idx]
    const next = list.filter((_, i) => i !== idx)
    onChange(next)
    // Notify parent to delete from storage if it's a managed image
    if (removed?.link && onRemove) {
      onRemove(removed.link)
    }
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

const RECIPE_CATEGORIES: { value: RecipeCategory; label: string }[] = [
  { value: 'Breakfast & Brunch', label: 'Breakfast & Brunch' },
  { value: 'Starters & Appetizers', label: 'Starters & Appetizers' },
  { value: 'Soups & Salads', label: 'Soups & Salads' },
  { value: 'Main Courses', label: 'Main Courses' },
  { value: 'Side Dishes', label: 'Side Dishes' },
  { value: 'Desserts', label: 'Desserts' },
  { value: 'Drinks', label: 'Drinks' },
  { value: 'Other', label: 'Other' },
]

const RECIPE_TIMES: { value: RecipeTime; label: string }[] = [
  { value: 'Quick and Effortless', label: 'Quick and Effortless' },
  { value: '30+ minutes Meals', label: '30+ minutes Meals' },
  { value: 'Slow Cooking', label: 'Slow Cooking' },
  { value: 'Undefined', label: 'Undefined' },
]

const CATEGORY_COLORS: Record<RecipeCategory, string> = {
  'Breakfast & Brunch': 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700',
  'Starters & Appetizers': 'bg-lime-100 text-lime-800 border-lime-300 dark:bg-lime-900/30 dark:text-lime-200 dark:border-lime-700',
  'Soups & Salads': 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700',
  'Main Courses': 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-700',
  'Side Dishes': 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-200 dark:border-teal-700',
  'Desserts': 'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700',
  'Drinks': 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-700',
  'Other': 'bg-stone-100 text-stone-800 border-stone-300 dark:bg-stone-900/30 dark:text-stone-200 dark:border-stone-700',
}

const TIME_ICONS: Record<RecipeTime, string> = {
  'Quick and Effortless': '⚡',
  '30+ minutes Meals': '⏱️',
  'Slow Cooking': '🍲',
  'Undefined': '❓',
}

function RecipeEditor({ recipes, onChange }: { recipes: PlantRecipe[]; onChange: (v: PlantRecipe[]) => void }) {
  const [isCollapsed, setIsCollapsed] = React.useState(recipes.length > 3)
  const [newName, setNewName] = React.useState('')
  const [newCategory, setNewCategory] = React.useState<RecipeCategory>('Other')
  const [newTime, setNewTime] = React.useState<RecipeTime>('Undefined')
  const [newLink, setNewLink] = React.useState('')

  const addRecipe = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    const trimmedLink = newLink.trim() || undefined
    onChange([...recipes, { name: trimmed, category: newCategory, time: newTime, link: trimmedLink }])
    setNewName('')
    setNewCategory('Other')
    setNewTime('Undefined')
    setNewLink('')
  }

  const removeRecipe = (idx: number) => {
    onChange(recipes.filter((_, i) => i !== idx))
  }

  const updateRecipe = (idx: number, patch: Partial<PlantRecipe>) => {
    onChange(recipes.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const categoryCounts = React.useMemo(() => {
    const counts: Partial<Record<RecipeCategory, number>> = {}
    recipes.forEach(r => { counts[r.category] = (counts[r.category] || 0) + 1 })
    return counts
  }, [recipes])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 text-sm font-semibold hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            <Label className="font-semibold cursor-pointer">Recipe Ideas</Label>
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          {recipes.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({recipes.length} recipe{recipes.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
      </div>

      {/* Summary badges when collapsed */}
      {isCollapsed && recipes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {recipes.map((r, idx) => (
            <span
              key={`${r.name}-${idx}`}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${CATEGORY_COLORS[r.category]}`}
            >
              <span>{TIME_ICONS[r.time]}</span>
              <span>{r.name}</span>
              {r.link && <ExternalLink className="h-3 w-3 opacity-50" />}
            </span>
          ))}
        </div>
      )}

      {!isCollapsed && (
        <>
          {/* Category filter summary */}
          {recipes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              {Object.entries(categoryCounts).map(([cat, count]) => (
                <span key={cat} className={`px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[cat as RecipeCategory]}`}>
                  {cat}: {count}
                </span>
              ))}
            </div>
          )}

          {/* Existing recipes list */}
          {recipes.length > 0 && (
            <div className="space-y-2">
              {recipes.map((recipe, idx) => (
                <div key={`recipe-${idx}`} className="rounded-lg border bg-white/60 dark:bg-[#111611] p-2.5 space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <div className="flex-1 min-w-0">
                      <Input
                        value={recipe.name}
                        onChange={(e) => updateRecipe(idx, { name: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Recipe name"
                      />
                    </div>
                    <select
                      className="h-8 rounded-md border px-2 text-xs min-w-[150px]"
                      value={recipe.category}
                      onChange={(e) => updateRecipe(idx, { category: e.target.value as RecipeCategory })}
                    >
                      {RECIPE_CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <select
                      className="h-8 rounded-md border px-2 text-xs min-w-[150px]"
                      value={recipe.time}
                      onChange={(e) => updateRecipe(idx, { time: e.target.value as RecipeTime })}
                    >
                      {RECIPE_TIMES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeRecipe(idx)}
                      className="text-red-500 hover:text-red-700 p-1 shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      title="Remove recipe"
                      aria-label={`Remove recipe: ${recipe.name || 'Untitled'}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Input
                      value={recipe.link || ''}
                      onChange={(e) => updateRecipe(idx, { link: e.target.value || undefined })}
                      className="h-7 text-xs"
                      placeholder="Recipe URL (optional, e.g., https://example.com/recipe)"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new recipe form */}
          <div className="rounded-lg border-2 border-dashed border-emerald-200 dark:border-emerald-800 p-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Add new recipe</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Recipe name (e.g., Basil Pesto)"
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addRecipe()
                    }
                  }}
                />
              </div>
              <select
                className="h-8 rounded-md border px-2 text-xs min-w-[150px]"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as RecipeCategory)}
              >
                {RECIPE_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <select
                className="h-8 rounded-md border px-2 text-xs min-w-[150px]"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value as RecipeTime)}
              >
                {RECIPE_TIMES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                onClick={addRecipe}
                disabled={!newName.trim()}
                className="shrink-0 h-8"
              >
                Add
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                placeholder="Recipe URL (optional)"
                className="h-7 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addRecipe()
                  }
                }}
              />
            </div>
          </div>

          {recipes.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No recipes yet. Add recipe ideas above.</p>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Structured recipe ideas with meal category, preparation time, and optional external link.
      </p>
    </div>
  )
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
              className="opacity-50 hover:opacity-100 hover:text-red-600 focus:opacity-100 focus:text-red-600 transition-opacity rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 flex items-center justify-center w-5 h-5"
              onClick={() => onChange(colors.filter((_, i) => i !== idx))}
              aria-label={`Remove color: ${c.name}`}
            >
              <X className="h-3 w-3" />
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
                    onClear={() => setSearch("")}
                    placeholder={t('plantAdmin.colors.searchPlaceholder', 'Search by name or hex code (e.g., #ff0000)')}
                    className="w-full"
                  />
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

export function PlantProfileForm({ value, onChange, colorSuggestions, companionSuggestions, categoryProgress, language = 'en', onImageRemove, plantReports, plantVarieties }: PlantProfileFormProps) {
  const { t } = useTranslation('common')
  const [selectedCategory, setSelectedCategory] = React.useState<string>('base')
  const [showColorRecommendations, setShowColorRecommendations] = React.useState(false)
  const [showCompanionRecommendations, setShowCompanionRecommendations] = React.useState(false)

  const categoryLabels: Record<string, string> = {
    base: t('plantAdmin.categories.base', 'Base'),
    identity: t('plantAdmin.categories.identity', 'Identity'),
    care: t('plantAdmin.categories.care', 'Care'),
    growth: t('plantAdmin.categories.growth', 'Growth'),
    danger: t('plantAdmin.categories.danger', 'Danger'),
    ecology: t('plantAdmin.categories.ecology', 'Ecology'),
    consumption: t('plantAdmin.categories.consumption', 'Usage'),
    misc: t('plantAdmin.categories.misc', 'Misc'),
    meta: t('plantAdmin.categories.meta', 'Meta'),
  }

  const formTabOrder = ['base','identity','care','growth','danger','ecology','consumption','misc','meta'] as const

  const pillTabs: PillTab<string>[] = React.useMemo(() =>
    formTabOrder.map((key) => {
      const info = categoryProgress?.[key as PlantFormCategory]
      const badge = info?.total
        ? info.status === 'done'
          ? ' \u2713'
          : ` ${info.completed}/${info.total}`
        : ''
      return { key, label: `${categoryLabels[key]}${badge}` }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryProgress, t],
  )

  React.useEffect(() => {
    if (colorSuggestions?.length) setShowColorRecommendations(true)
    else setShowColorRecommendations(false)
  }, [colorSuggestions?.length])

  React.useEffect(() => {
    if (companionSuggestions?.length) setShowCompanionRecommendations(true)
    else setShowCompanionRecommendations(false)
  }, [companionSuggestions?.length])

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

  const setPath = (path: string, val: any) => {
    let next = setValue(value, path, val)
    if (val === false && BOOLEAN_GATE_DEPS[path]) {
      for (const dep of BOOLEAN_GATE_DEPS[path]) {
        next = setValue(next, dep, undefined)
      }
    }
    onChange(next)
  }

  /** Check if a gated field should be shown */
  const shouldShowField = (f: FieldConfig) => {
    if (!f.gatedBy) return true
    if (f.gatedBy.startsWith('utility:')) {
      const utilVal = f.gatedBy.slice(8)
      const utility = getValue(value, 'utility')
      const arr = Array.isArray(utility) ? utility as string[] : []
      const needle = utilVal.toLowerCase().replace(/[_\s-]/g, '')
      return arr.some(u => typeof u === 'string' && u.toLowerCase().replace(/[_\s-]/g, '') === needle)
    }
    return getValue(value, f.gatedBy) === true
  }

  /** Render a group of fields inside a subsection */
  const renderFieldGroup = (fields: FieldConfig[], opts?: { skipKeys?: Set<string> }) => (
    fields.filter(f => !(opts?.skipKeys?.has(f.key)) && shouldShowField(f)).map(f => renderField(value, setPath, f, t))
  )

  /** Render a titled divider */
  const SectionDivider = ({ title, icon }: { title: string; icon?: React.ReactNode }) => (
    <div className={sectionTitleClass}>
      {icon || <div className="h-1 w-1 rounded-full bg-emerald-500" />}
      <span className={sectionTitleTextClass}>{title}</span>
      <div className="flex-1 h-px bg-stone-200/70 dark:bg-[#3e3e42]/70" />
    </div>
  )

  // ── Section renderers ────────────────────────────────────────────────

  const renderBase = () => (
    <div className="space-y-5">
      <div className={fieldRowClass}>
        <div className="grid gap-2">
          <Label>{t('plantAdmin.basics.name.label', 'Name')}</Label>
          <Input
            value={value.name}
            required
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder={t('plantAdmin.basics.name.placeholder', 'Unique plant name (English)')}
          />
          <p className="text-xs text-muted-foreground">
            {t('plantAdmin.basics.name.description', 'Canonical English name (unique, mandatory).')}
          </p>
        </div>
        {renderField(value, setPath, baseFields.find(f => f.key === 'plantType')!, t)}
      </div>

      <SectionDivider title={t('plantAdmin.sections.taxonomy', 'Taxonomy')} />
      <div className={fieldRowClass}>
        {renderField(value, setPath, baseFields.find(f => f.key === 'scientificNameSpecies')!, t)}
        {renderField(value, setPath, baseFields.find(f => f.key === 'scientificNameVariety')!, t)}
      </div>
      <div className={fieldRowClass}>
        {renderField(value, setPath, baseFields.find(f => f.key === 'family')!, t)}
        {renderField(value, setPath, baseFields.find(f => f.key === 'commonNames')!, t)}
      </div>

      <SectionDivider title={t('plantAdmin.sections.presentation', 'Presentation')} />
      {renderField(value, setPath, baseFields.find(f => f.key === 'presentation')!, t)}
      {renderField(value, setPath, baseFields.find(f => f.key === 'featuredMonth')!, t)}

      <SectionDivider title={t('plantAdmin.sections.images', 'Images')} />
      <ImageEditor images={value.images || []} onChange={(imgs) => onChange({ ...value, images: imgs })} onRemove={onImageRemove} />
    </div>
  )

  const renderIdentity = () => (
    <div className="space-y-5">
      <SectionDivider title={t('plantAdmin.sections.originClimate', 'Origin & Climate')} />
      <div className={fieldRowClass}>
        {renderField(value, setPath, identityFields.find(f => f.key === 'origin')!, t)}
        {renderField(value, setPath, identityFields.find(f => f.key === 'climate')!, t)}
      </div>
      <div className={fieldRowClass}>
        {renderField(value, setPath, identityFields.find(f => f.key === 'season')!, t)}
        {renderField(value, setPath, identityFields.find(f => f.key === 'livingSpace')!, t)}
      </div>

      <SectionDivider title={t('plantAdmin.sections.utilityUse', 'Utility & Use')} />
      {renderField(value, setPath, identityFields.find(f => f.key === 'utility')!, t)}
      {shouldShowField(identityFields.find(f => f.key === 'ediblePart')!) && renderField(value, setPath, identityFields.find(f => f.key === 'ediblePart')!, t)}

      <SectionDivider title={t('plantAdmin.sections.lifecycle', 'Life Cycle & Foliage')} />
      <div className={fieldRowClass}>
        {renderField(value, setPath, identityFields.find(f => f.key === 'lifeCycle')!, t)}
        {renderField(value, setPath, identityFields.find(f => f.key === 'averageLifespan')!, t)}
      </div>
      {renderField(value, setPath, identityFields.find(f => f.key === 'foliagePersistence')!, t)}

      <SectionDivider title={t('plantAdmin.sections.habitForm', 'Habit & Form')} />
      <div className={fieldRowClass}>
        {renderField(value, setPath, identityFields.find(f => f.key === 'thorny')!, t)}
      </div>
      {renderField(value, setPath, identityFields.find(f => f.key === 'landscaping')!, t)}
      {renderField(value, setPath, identityFields.find(f => f.key === 'plantHabit')!, t)}

      <SectionDivider title={t('plantAdmin.sections.colors', 'Colors')} />
      {colorSuggestions?.length ? (
        <div className="mb-3">
          <button type="button" className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300" onClick={() => setShowColorRecommendations(prev => !prev)}>
            <Sparkles className="h-4 w-4" />
            {showColorRecommendations ? t('plantAdmin.hideColorSuggestions', 'Hide AI color suggestions') : t('plantAdmin.showColorSuggestions', 'Show AI color suggestions')}
          </button>
          {showColorRecommendations && (
            <div className="mt-2 rounded-xl border border-emerald-200/50 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 px-4 py-3 space-y-3">
              <div className="text-xs text-muted-foreground">{t('plantAdmin.colorSuggestionsReview', 'Review and add the colors you like to your palette.')}</div>
              <div className="flex flex-wrap gap-3">
                {colorSuggestions.map((c, idx) => {
                  const name = c.name || (c as any)?.label || c.hexCode || (c as any)?.hex || t('plantAdmin.colorFallback', 'Color')
                  const hex = normalizeHex(c.hexCode || (c as any)?.hex || '')
                  const alreadyAdded = (value.identity?.colors || []).some((color) => {
                    const colorName = color.name?.toLowerCase()
                    const colorHex = normalizeHex(color.hexCode || '')
                    return (name && colorName === name.toLowerCase()) || (hex && colorHex && colorHex === hex)
                  })
                  return (
                    <div key={`${name}-${hex || idx}`} className="flex items-center gap-3 rounded-lg bg-white/80 dark:bg-[#111611] px-3 py-2 shadow-sm border border-stone-200/60 dark:border-[#3e3e42]/60">
                      <span className="h-5 w-5 rounded-full border border-stone-200 dark:border-stone-700" style={{ backgroundColor: hex || undefined }} />
                      <div className="flex flex-col leading-tight min-w-[90px]">
                        <span className="text-sm font-medium">{name}</span>
                        {hex && <span className="text-xs text-muted-foreground">{hex}</span>}
                      </div>
                      <Button type="button" size="sm" variant={alreadyAdded ? 'secondary' : 'default'} disabled={alreadyAdded} onClick={() => addSuggestedColor(c)}>
                        {alreadyAdded ? t('plantAdmin.colorAdded', 'Added') : t('plantAdmin.addColor', 'Add')}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mb-2">{t('plantAdmin.colorSuggestionPlaceholder', 'AI recommendations will show up here when available.')}</p>
      )}
      <ColorPicker colors={value.identity?.colors || []} onChange={(colors) => onChange(setValue(value, "identity.colors", colors))} />
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!value.identity?.multicolor} onChange={(e) => onChange(setValue(value, "identity.multicolor", e.target.checked))} className="h-4 w-4 rounded border-stone-300 accent-emerald-600" />
          {t('plantAdmin.colors.multicolor', 'Multicolor')}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!value.identity?.bicolor} onChange={(e) => onChange(setValue(value, "identity.bicolor", e.target.checked))} className="h-4 w-4 rounded border-stone-300 accent-emerald-600" />
          {t('plantAdmin.colors.bicolor', 'Bicolor')}
        </label>
      </div>

      <SectionDivider title={t('plantAdmin.sections.safety', 'Safety & Toxicity')} />
      <div className={fieldRowClass}>
        {renderField(value, setPath, safetyFields.find(f => f.key === 'toxicityHuman')!, t)}
        {renderField(value, setPath, safetyFields.find(f => f.key === 'toxicityPets')!, t)}
      </div>
      {renderField(value, setPath, safetyFields.find(f => f.key === 'poisoningMethod')!, t)}
      {renderField(value, setPath, safetyFields.find(f => f.key === 'poisoningSymptoms')!, t)}
      {renderField(value, setPath, safetyFields.find(f => f.key === 'allergens')!, t)}
    </div>
  )

  const renderCare = () => (
    <div className="space-y-5">
      <SectionDivider title={t('plantAdmin.sections.conditions', 'Conditions')} />
      <div className={fieldRowClass}>
        {renderField(value, setPath, careFields.find(f => f.key === 'careLevel')!, t)}
        {renderField(value, setPath, careFields.find(f => f.key === 'sunlight')!, t)}
      </div>

      <SectionDivider title={t('plantAdmin.sections.temperature', 'Temperature')} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {renderField(value, setPath, careFields.find(f => f.key === 'temperatureMin')!, t)}
        {renderField(value, setPath, careFields.find(f => f.key === 'temperatureIdeal')!, t)}
        {renderField(value, setPath, careFields.find(f => f.key === 'temperatureMax')!, t)}
      </div>

      <SectionDivider title={t('plantAdmin.sections.watering', 'Watering & Humidity')} />
      {renderField(value, setPath, careFields.find(f => f.key === 'wateringSchedules')!, t)}
      {renderField(value, setPath, careFields.find(f => f.key === 'wateringType')!, t)}
      <div className={fieldRowClass}>
        {renderField(value, setPath, careFields.find(f => f.key === 'hygrometry')!, t)}
        {renderField(value, setPath, careFields.find(f => f.key === 'mistingFrequency')!, t)}
      </div>
      {renderField(value, setPath, careFields.find(f => f.key === 'specialNeeds')!, t)}

      <SectionDivider title={t('plantAdmin.sections.substrate', 'Substrate & Soil')} />
      <div className={fieldRowClass}>
        {renderField(value, setPath, careDetailsFields.find(f => f.key === 'substrate')!, t)}
        {renderField(value, setPath, careDetailsFields.find(f => f.key === 'substrateMix')!, t)}
      </div>
      {renderField(value, setPath, careDetailsFields.find(f => f.key === 'soilAdvice')!, t)}

      <SectionDivider title={t('plantAdmin.sections.mulch', 'Mulch')} />
      {renderField(value, setPath, careDetailsFields.find(f => f.key === 'mulchingNeeded')!, t)}
      {shouldShowField(careDetailsFields.find(f => f.key === 'mulchType')!) && renderField(value, setPath, careDetailsFields.find(f => f.key === 'mulchType')!, t)}
      {shouldShowField(careDetailsFields.find(f => f.key === 'mulchAdvice')!) && renderField(value, setPath, careDetailsFields.find(f => f.key === 'mulchAdvice')!, t)}

      <SectionDivider title={t('plantAdmin.sections.nutrition', 'Nutrition')} />
      <div className={fieldRowClass}>
        {renderField(value, setPath, careDetailsFields.find(f => f.key === 'nutritionNeed')!, t)}
        {renderField(value, setPath, careDetailsFields.find(f => f.key === 'fertilizer')!, t)}
      </div>
      {renderField(value, setPath, careDetailsFields.find(f => f.key === 'fertilizerAdvice')!, t)}
    </div>
  )

  const renderGrowth = () => (
    <div className="space-y-5">
      <SectionDivider title={t('plantAdmin.sections.calendar', 'Calendar')} />
      <div className="space-y-4">
        {renderField(value, setPath, growthFields.find(f => f.key === 'sowingMonth')!, t)}
        {renderField(value, setPath, growthFields.find(f => f.key === 'floweringMonth')!, t)}
        {renderField(value, setPath, growthFields.find(f => f.key === 'fruitingMonth')!, t)}
      </div>

      <SectionDivider title={t('plantAdmin.sections.dimensions', 'Dimensions & Support')} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {renderField(value, setPath, growthFields.find(f => f.key === 'heightCm')!, t)}
        {renderField(value, setPath, growthFields.find(f => f.key === 'wingspanCm')!, t)}
        {renderField(value, setPath, growthFields.find(f => f.key === 'separationCm')!, t)}
      </div>
      {renderField(value, setPath, growthFields.find(f => f.key === 'staking')!, t)}
      {shouldShowField(growthFields.find(f => f.key === 'stakingAdvice')!) && renderField(value, setPath, growthFields.find(f => f.key === 'stakingAdvice')!, t)}

      <SectionDivider title={t('plantAdmin.sections.propagation', 'Propagation & Cultivation')} />
      <div className={fieldRowClass}>
        {renderField(value, setPath, growthFields.find(f => f.key === 'division')!, t)}
        {renderField(value, setPath, growthFields.find(f => f.key === 'cultivationMode')!, t)}
      </div>
      {renderField(value, setPath, growthFields.find(f => f.key === 'sowingMethod')!, t)}
      {renderField(value, setPath, growthFields.find(f => f.key === 'sowingAdvice')!, t)}
      {renderField(value, setPath, growthFields.find(f => f.key === 'transplanting')!, t)}
      {shouldShowField(growthFields.find(f => f.key === 'transplantingTime')!) && (
        <div className={fieldRowClass}>
          {renderField(value, setPath, growthFields.find(f => f.key === 'transplantingTime')!, t)}
          {renderField(value, setPath, growthFields.find(f => f.key === 'outdoorPlantingTime')!, t)}
        </div>
      )}

      <SectionDivider title={t('plantAdmin.sections.pruning', 'Pruning')} />
      {renderField(value, setPath, growthFields.find(f => f.key === 'pruning')!, t)}
      {shouldShowField(growthFields.find(f => f.key === 'pruningMonth')!) && renderField(value, setPath, growthFields.find(f => f.key === 'pruningMonth')!, t)}
      {shouldShowField(growthFields.find(f => f.key === 'pruningAdvice')!) && renderField(value, setPath, growthFields.find(f => f.key === 'pruningAdvice')!, t)}
    </div>
  )

  const renderDanger = () => (
    <div className="space-y-5">
      <div className={fieldRowClass}>
        {renderField(value, setPath, dangerFields.find(f => f.key === 'pests')!, t)}
        {renderField(value, setPath, dangerFields.find(f => f.key === 'diseases')!, t)}
      </div>
    </div>
  )

  const renderEcology = () => (
    <div className="space-y-5">
      <SectionDivider title={t('plantAdmin.sections.conservation', 'Conservation')} />
      <div className={fieldRowClass}>
        {renderField(value, setPath, ecologyFields.find(f => f.key === 'conservationStatus')!, t)}
        {renderField(value, setPath, ecologyFields.find(f => f.key === 'ecologicalStatus')!, t)}
      </div>

      <SectionDivider title={t('plantAdmin.sections.habitats', 'Habitats')} />
      <div className={fieldRowClass}>
        {renderField(value, setPath, ecologyFields.find(f => f.key === 'biotopes')!, t)}
        {renderField(value, setPath, ecologyFields.find(f => f.key === 'urbanBiotopes')!, t)}
      </div>

      <SectionDivider title={t('plantAdmin.sections.toleranceRoles', 'Tolerance & Roles')} />
      {renderField(value, setPath, ecologyFields.find(f => f.key === 'ecologicalTolerance')!, t)}
      <div className={fieldRowClass}>
        {renderField(value, setPath, ecologyFields.find(f => f.key === 'biodiversityRole')!, t)}
        {renderField(value, setPath, ecologyFields.find(f => f.key === 'ecologicalImpact')!, t)}
      </div>
      <div className={fieldRowClass}>
        {renderField(value, setPath, ecologyFields.find(f => f.key === 'beneficialRoles')!, t)}
        {renderField(value, setPath, ecologyFields.find(f => f.key === 'harmfulRoles')!, t)}
      </div>

      <SectionDivider title={t('plantAdmin.sections.wildlife', 'Wildlife')} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {renderField(value, setPath, ecologyFields.find(f => f.key === 'pollinatorsAttracted')!, t)}
        {renderField(value, setPath, ecologyFields.find(f => f.key === 'birdsAttracted')!, t)}
        {renderField(value, setPath, ecologyFields.find(f => f.key === 'mammalsAttracted')!, t)}
      </div>

      <SectionDivider title={t('plantAdmin.sections.symbiosis', 'Symbiosis & Management')} />
      {renderField(value, setPath, ecologyFields.find(f => f.key === 'symbiosis')!, t)}
      {renderField(value, setPath, ecologyFields.find(f => f.key === 'symbiosisNotes')!, t)}
      {renderField(value, setPath, ecologyFields.find(f => f.key === 'ecologicalManagement')!, t)}
    </div>
  )

  const renderConsumption = () => (
    <div className="space-y-5">
      {renderFieldGroup(consumptionFields)}
      <SectionDivider title={t('plantAdmin.sections.recipes', 'Recipes')} />
      <RecipeEditor recipes={Array.isArray(value.recipes) ? value.recipes : []} onChange={(v) => setPath('recipes', v)} />
    </div>
  )

  const renderMisc = () => (
    <div className="space-y-5">
      <SectionDivider title={t('plantAdmin.sections.companionPlants', 'Companion & Related Plants')} />
      <CompanionSelector
        value={Array.isArray(value.companionPlants) ? value.companionPlants : []}
        onChange={(v) => setPath('companionPlants', v)}
        suggestions={companionSuggestions}
        showSuggestions={showCompanionRecommendations}
        onToggleSuggestions={() => setShowCompanionRecommendations(prev => !prev)}
        currentPlantId={value.id}
        language={language}
      />

      <SectionDivider title={t('plantAdmin.sections.biotopePlants', 'Biotope Plants')} />
      <CompanionSelector
        value={Array.isArray(value.biotopePlants) ? value.biotopePlants : []}
        onChange={(v) => setPath('biotopePlants', v)}
        currentPlantId={value.id}
        language={language}
      />

      <div className={fieldRowClass}>
        <div>
          <SectionDivider title={t('plantAdmin.sections.beneficialPlants', 'Beneficial Plants')} />
          <CompanionSelector
            value={Array.isArray(value.beneficialPlants) ? value.beneficialPlants : []}
            onChange={(v) => setPath('beneficialPlants', v)}
            currentPlantId={value.id}
            language={language}
          />
        </div>
        <div>
          <SectionDivider title={t('plantAdmin.sections.harmfulPlants', 'Harmful Plants')} />
          <CompanionSelector
            value={Array.isArray(value.harmfulPlants) ? value.harmfulPlants : []}
            onChange={(v) => setPath('harmfulPlants', v)}
            currentPlantId={value.id}
            language={language}
          />
        </div>
      </div>

      {plantVarieties && plantVarieties.length > 0 && (
        <>
          <SectionDivider title={`${t('plantAdmin.varieties', 'Varieties')} (${plantVarieties.length})`} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {plantVarieties.map((v) => (
              <a
                key={v.id}
                href={`/create-plant?id=${v.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-stone-200/70 dark:border-[#3e3e42]/60 bg-white/60 dark:bg-[#1f1f1f]/60 p-2 hover:bg-stone-50 dark:hover:bg-[#252526] transition-colors"
              >
                {v.imageUrl ? (
                  <img src={v.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-stone-100 dark:bg-stone-800 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{v.name}</p>
                  {v.variety && <p className="text-xs text-muted-foreground truncate italic">{v.variety}</p>}
                </div>
              </a>
            ))}
          </div>
        </>
      )}

      <SectionDivider title={t('plantAdmin.sections.tags', 'Tags')} />
      {renderFieldGroup(miscFields, { skipKeys: new Set(['companionPlants', 'biotopePlants', 'beneficialPlants', 'harmfulPlants']) })}
    </div>
  )

  const renderMeta = () => (
    <div className="space-y-5">
      {renderFieldGroup(metaFields)}
      {plantReports && plantReports.length > 0 && (
        <>
          <SectionDivider title={`${t('plantAdmin.userReports', 'User Reports')} (${plantReports.length})`} />
          <div className="space-y-3">
            {plantReports.map((report) => (
              <div
                key={report.id}
                className="rounded-xl border border-amber-200/70 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-300">{report.userName}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(report.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{report.note}</p>
                {report.imageUrl && (
                  <img src={report.imageUrl} alt="Report attachment" className="mt-2 rounded-lg max-h-48 object-contain border border-amber-200/50 dark:border-amber-800/30" />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )

  const sectionRenderers: Record<string, () => React.ReactNode> = {
    base: renderBase,
    identity: renderIdentity,
    care: renderCare,
    growth: renderGrowth,
    danger: renderDanger,
    ecology: renderEcology,
    consumption: renderConsumption,
    misc: renderMisc,
    meta: renderMeta,
  }

  return (
    <div className="space-y-5">
      {/* ── Pill Tab Navigation ── */}
      <div className="sticky top-0 z-20 py-3 -mx-1 px-1">
        <PillTabs
          tabs={pillTabs}
          activeKey={selectedCategory}
          onTabChange={setSelectedCategory}
          className="overflow-x-auto"
        />
      </div>

      {/* ── Active section card ── */}
      <div className={glassCardClass}>
        <div className="p-5 sm:p-7">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-foreground">{categoryLabels[selectedCategory]}</h2>
            {(() => {
              const info = categoryProgress?.[selectedCategory as PlantFormCategory]
              if (!info?.total) return null
              return (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  info.status === 'done'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                }`}>
                  {info.status === 'done' ? t('plantAdmin.sectionFilled', 'Filled') : `${info.completed}/${info.total}`}
                </span>
              )
            })()}
          </div>
          {sectionRenderers[selectedCategory]?.()}
        </div>
      </div>
    </div>
  )
}
