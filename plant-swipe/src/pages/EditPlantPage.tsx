import React from "react"
import { useParams } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabaseClient"
import { fetchAiPlantFill } from "@/lib/aiPlantFill"
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
import { savePlantTranslations, getPlantTranslation } from "@/lib/plantTranslations"
import { Languages, Sparkles, Loader2 } from "lucide-react"
import { CompleteAdvancedForm } from "@/components/plant/CompleteAdvancedForm"

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
  const [careSunlight, setCareSunlight] = React.useState<NonNullable<Plant["care"]>["sunlight"]>("Low")
  const [careSoil, setCareSoil] = React.useState("")
  const [careDifficulty, setCareDifficulty] = React.useState<NonNullable<Plant["care"]>["difficulty"]>("Easy")
  const [seedsAvailable, setSeedsAvailable] = React.useState(false)
  const [waterFreqPeriod, setWaterFreqPeriod] = React.useState<'week' | 'month' | 'year'>('week')
  const [waterFreqAmount, setWaterFreqAmount] = React.useState<number>(1)
  const [saving, setSaving] = React.useState(false)
  
  // Language selection for editing
  const [editLanguage, setEditLanguage] = React.useState<SupportedLanguage>(DEFAULT_LANGUAGE)
  const [translating, setTranslating] = React.useState(false)
    const [aiFilling, setAiFilling] = React.useState(false)
    const [aiFillProgress, setAiFillProgress] = React.useState<{ completed: number; total: number; field?: string }>({ completed: 0, total: 0, field: undefined })
    const abortControllerRef = React.useRef<AbortController | null>(null)
  
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

  const toggleSeason = (s: Plant["seasons"][number]) => {
    setSeasons((cur: string[]) => (cur.includes(s) ? cur.filter((x: string) => x !== s) : [...cur, s]))
  }

  const loadSchema = async () => {
    try {
      const response = await fetch('/PLANT-INFO-SCHEMA.json')
      if (response.ok) {
        return await response.json()
      }
      const schemaModule = await import('../../PLANT-INFO-SCHEMA.json')
      return schemaModule.default || schemaModule
    } catch (error) {
      console.error('Failed to load schema:', error)
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

  const handleAiFill = async () => {
    if (editLanguage !== 'en') {
      setOk(null)
      setError('AI fill is only available when editing the English content.')
      return
    }

    if (!name.trim()) {
      setOk(null)
      setError('Please enter a plant name first')
      return
    }

      setAiFilling(true)
      setAiFillProgress({ completed: 0, total: 0, field: undefined })
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller
    setError(null)
    setOk(null)

    try {
      const schema = await loadSchema()
      if (!schema) {
        setError('Failed to load schema')
        return
      }

        const existingData = {
          identifiers: {
            ...(identifiers ?? {}),
            ...(scientificName.trim() ? { scientificName: scientificName.trim() } : {})
          },
          traits: { ...(traits ?? {}) },
          dimensions: { ...(dimensions ?? {}) },
          phenology: { ...(phenology ?? {}) },
          environment: { ...(environment ?? {}) },
          care: {
            ...(care ?? {}),
            ...(careSunlight ? { sunlight: careSunlight } : {}),
            ...(careDifficulty ? { difficulty: careDifficulty } : {}),
            ...(waterFreqAmount ? {
              watering: {
                ...(care?.watering ?? {}),
                interval: {
                  ...((care?.watering as any)?.interval ?? {}),
                  value: waterFreqAmount,
                  unit: waterFreqPeriod
                }
              }
            } : {})
          },
          propagation: { ...(propagation ?? {}) },
          usage: { ...(usage ?? {}) },
          ecology: { ...(ecology ?? {}) },
          commerce: {
            ...(commerce ?? {}),
            ...(typeof seedsAvailable === 'boolean' ? { seedsAvailable } : {})
          },
          problems: { ...(problems ?? {}) },
          planting: { ...(planting ?? {}) },
          meta: {
            ...(meta ?? {}),
            ...(meaning.trim() ? { funFact: meaning.trim() } : {})
          }
        }

        const aiData = await fetchAiPlantFill({
          plantName: name.trim(),
          schema,
          existingData,
          signal: controller.signal,
          onProgress: ({ completed, total, field }) => {
            setAiFillProgress({ completed, total, field })
          }
        })

      if (aiData.identifiers) {
        setIdentifiers(aiData.identifiers)
        if (aiData.identifiers.scientificName && !scientificName.trim()) {
          setScientificName(aiData.identifiers.scientificName)
        }
      }
      if (aiData.traits) setTraits(aiData.traits)
      if (aiData.dimensions) setDimensions(aiData.dimensions)
      if (aiData.phenology) {
        setPhenology(aiData.phenology)
        if (aiData.phenology.flowerColors?.length > 0 && !colors.trim()) {
          setColors(aiData.phenology.flowerColors.map((c: any) => c.name).join(', '))
        }
        if (aiData.phenology.floweringMonths?.length > 0 && seasons.length === 0) {
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
      if (aiData.environment) {
        setEnvironment(aiData.environment)
        if (aiData.environment.soil?.texture?.length && !careSoil.trim()) {
          setCareSoil(aiData.environment.soil.texture.join(', '))
        }
        if (aiData.environment.sunExposure) {
          const sunExposure = String(aiData.environment.sunExposure).toLowerCase()
          if (sunExposure.includes('full')) {
            setCareSunlight('High')
          } else if (sunExposure.includes('partial sun')) {
            setCareSunlight('Medium')
          } else if (sunExposure.includes('partial shade') || sunExposure.includes('shade')) {
            setCareSunlight('Low')
          }
        }
      }
      if (aiData.care) {
        setCare(aiData.care)
        if (aiData.care.difficulty) {
          const difficulty = String(aiData.care.difficulty).toLowerCase()
          if (difficulty === 'easy') setCareDifficulty('Easy')
          else if (difficulty === 'moderate') setCareDifficulty('Moderate')
          else if (difficulty === 'advanced') setCareDifficulty('Hard')
        }
        if (aiData.care.watering?.interval?.value && aiData.care.watering?.interval?.unit) {
          const unit = String(aiData.care.watering.interval.unit).toLowerCase()
          if (unit === 'week' || unit === 'month' || unit === 'year') {
            setWaterFreqPeriod(unit as 'week' | 'month' | 'year')
            setWaterFreqAmount(Math.max(1, Number(aiData.care.watering.interval.value) || 1))
          }
        }
      }
      if (aiData.propagation) setPropagation(aiData.propagation)
      if (aiData.usage) setUsage(aiData.usage)
      if (aiData.ecology) setEcology(aiData.ecology)
      if (aiData.commerce) {
        setCommerce(aiData.commerce)
        if (typeof aiData.commerce.seedsAvailable === 'boolean') {
          setSeedsAvailable(Boolean(aiData.commerce.seedsAvailable))
        }
      }
      if (aiData.problems) setProblems(aiData.problems)
      if (aiData.planting) setPlanting(aiData.planting)
      if (aiData.meta) {
        setMeta(aiData.meta)
        if (aiData.meta.funFact && !meaning.trim()) {
          setMeaning(aiData.meta.funFact)
        }
        if (aiData.meta.rarity) {
          const rarityMap: Record<string, Plant['rarity']> = {
            'common': 'Common',
            'uncommon': 'Uncommon',
            'rare': 'Rare',
            'very rare': 'Legendary',
            'legendary': 'Legendary'
          }
          const mappedRarity = rarityMap[String(aiData.meta.rarity).toLowerCase()]
          if (mappedRarity) {
            setRarity(mappedRarity)
          }
        }
      }
      if (aiData.image && !imageUrl.trim()) {
        setImageUrl(aiData.image)
      }

      setOk('AI data loaded successfully! Please review and edit before saving.')
      } catch (err: any) {
        console.error('AI fill error:', err)
        if (err?.message === 'AI fill was cancelled' || err?.message === 'AI fill cancelled.') {
          setError('AI fill cancelled.')
        } else {
          setError(err?.message || 'Failed to fill data with AI. Please try again.')
        }
      } finally {
        setAiFilling(false)
        setAiFillProgress({ completed: 0, total: 0, field: undefined })
        abortControllerRef.current = null
    }
  }

  React.useEffect(() => {
    let ignore = false
    ;(async () => {
      if (!id) { setError('Missing plant id'); setLoading(false); return }
      setLoading(true)
      setError(null)
      try {
        // Load base plant data with JSONB fields
        const { data, error: qerr } = await supabase
          .from('plants')
          .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, care_sunlight, care_soil, care_difficulty, seeds_available, water_freq_period, water_freq_amount, water_freq_unit, water_freq_value, identifiers, traits, dimensions, phenology, environment, care, propagation, usage, ecology, commerce, problems, planting, meta')
          .eq('id', id)
          .maybeSingle()
        if (qerr) throw new Error(qerr.message)
        if (!data) throw new Error('Plant not found')
        if (ignore) return
        
        // Load translation for selected language
        const { data: translation } = await getPlantTranslation(id, editLanguage)
        
        // Parse JSONB fields
        const parsedIdentifiers = typeof data.identifiers === 'string' ? JSON.parse(data.identifiers) : data.identifiers
        const parsedTraits = typeof data.traits === 'string' ? JSON.parse(data.traits) : data.traits
        const parsedDimensions = typeof data.dimensions === 'string' ? JSON.parse(data.dimensions) : data.dimensions
        const parsedPhenology = typeof data.phenology === 'string' ? JSON.parse(data.phenology) : data.phenology
        const parsedEnvironment = typeof data.environment === 'string' ? JSON.parse(data.environment) : data.environment
        const parsedCare = typeof data.care === 'string' ? JSON.parse(data.care) : data.care
        const parsedPropagation = typeof data.propagation === 'string' ? JSON.parse(data.propagation) : data.propagation
        const parsedUsage = typeof data.usage === 'string' ? JSON.parse(data.usage) : data.usage
        const parsedEcology = typeof data.ecology === 'string' ? JSON.parse(data.ecology) : data.ecology
        const parsedCommerce = typeof data.commerce === 'string' ? JSON.parse(data.commerce) : data.commerce
        const parsedProblems = typeof data.problems === 'string' ? JSON.parse(data.problems) : data.problems
        const parsedPlanting = typeof data.planting === 'string' ? JSON.parse(data.planting) : data.planting
        const parsedMeta = typeof data.meta === 'string' ? JSON.parse(data.meta) : data.meta
        
        // Parse translation JSONB fields
        const translationIdentifiers = translation?.identifiers ? (typeof translation.identifiers === 'string' ? JSON.parse(translation.identifiers) : translation.identifiers) : null
        const translationEcology = translation?.ecology ? (typeof translation.ecology === 'string' ? JSON.parse(translation.ecology) : translation.ecology) : null
        const translationUsage = translation?.usage ? (typeof translation.usage === 'string' ? JSON.parse(translation.usage) : translation.usage) : null
        const translationMeta = translation?.meta ? (typeof translation.meta === 'string' ? JSON.parse(translation.meta) : translation.meta) : null
        
        // Use translation data if available, otherwise use base data
        setName(String(translation?.name || data.name || ''))
        setScientificName(String(translation?.scientific_name || data.scientific_name || parsedIdentifiers?.scientificName || ''))
        setMeaning(String(translation?.meaning || data.meaning || translationMeta?.funFact || parsedMeta?.funFact || ''))
        setDescription(String(translation?.description || data.description || ''))
        setCareSoil(String(translation?.care_soil || data.care_soil || ''))
        
        // Set JSONB structures - merge translations with base data
        setIdentifiers({
          ...parsedIdentifiers,
          ...translationIdentifiers,
          scientificName: translationIdentifiers?.scientificName || parsedIdentifiers?.scientificName || data.scientific_name || undefined,
          commonNames: translationIdentifiers?.commonNames || parsedIdentifiers?.commonNames || undefined,
        })
        setTraits(parsedTraits || {})
        setDimensions(parsedDimensions || {})
        setPhenology(parsedPhenology || {})
        setEnvironment(parsedEnvironment || {})
        setCare(parsedCare || {})
        setPropagation(parsedPropagation || {})
        setUsage({
          ...parsedUsage,
          ...translationUsage,
          culinaryUses: translationUsage?.culinaryUses || parsedUsage?.culinaryUses || undefined,
          medicinalUses: translationUsage?.medicinalUses || parsedUsage?.medicinalUses || undefined,
        })
        setEcology({
          ...parsedEcology,
          ...translationEcology,
          wildlifeValue: translationEcology?.wildlifeValue || parsedEcology?.wildlifeValue || undefined,
        })
        setCommerce(parsedCommerce || {})
        setProblems(parsedProblems || {})
        setPlanting(parsedPlanting || {})
        setMeta({
          ...parsedMeta,
          ...translationMeta,
          funFact: translationMeta?.funFact || parsedMeta?.funFact || data.meaning || undefined,
          authorNotes: translationMeta?.authorNotes || parsedMeta?.authorNotes || undefined,
          sourceReferences: translationMeta?.sourceReferences || parsedMeta?.sourceReferences || undefined,
        })
        
        // These fields are not translated (shared across languages)
        setColors(Array.isArray(data.colors) ? (data.colors as string[]).join(', ') : '')
        setSeasons(Array.isArray(data.seasons) ? (data.seasons as string[]) : [])
        setRarity((data.rarity || 'Common') as Plant['rarity'])
        setImageUrl(String(data.image_url || ''))
        setCareSunlight((data.care_sunlight || 'Low') as NonNullable<Plant['care']>['sunlight'])
        setCareDifficulty((data.care_difficulty || 'Easy') as NonNullable<Plant['care']>['difficulty'])
        setSeedsAvailable(Boolean(data.seeds_available ?? parsedCommerce?.seedsAvailable ?? false))
        const period = (data.water_freq_period || data.water_freq_unit || 'week') as 'week' | 'month' | 'year'
        const amount = Number(data.water_freq_amount ?? data.water_freq_value ?? 1) || 1
        setWaterFreqPeriod(period)
        setWaterFreqAmount(amount)
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
        const translationPhenology = phenology?.scentNotes && phenology.scentNotes.length > 0
          ? { scentNotes: phenology.scentNotes }
          : undefined
        const translationCarePayload = (() => {
          const hasFrequency = !!care?.watering?.frequency && Object.values(care.watering.frequency!).some(Boolean)
          const hasSchedule = !!care?.fertilizing?.schedule
          const hasMulch = !!care?.mulching?.material
          if (!hasFrequency && !hasSchedule && !hasMulch) return undefined
          return {
            watering: hasFrequency ? { frequency: care?.watering?.frequency } : undefined,
            fertilizing: hasSchedule ? { schedule: care?.fertilizing?.schedule } : undefined,
            mulching: hasMulch ? { material: care?.mulching?.material } : undefined,
          }
        })()
        const translationPlanting = (() => {
          const sitePrep = planting?.sitePrep?.length ? planting.sitePrep : undefined
          const companionPlants = planting?.companionPlants?.length ? planting.companionPlants : undefined
          const avoidNear = planting?.avoidNear?.length ? planting.avoidNear : undefined
          if (!sitePrep && !companionPlants && !avoidNear) return undefined
          return { sitePrep, companionPlants, avoidNear }
        })()
        const translationProblems = (() => {
          const pests = problems?.pests?.length ? problems.pests : undefined
          const diseases = problems?.diseases?.length ? problems.diseases : undefined
          const hazards = problems?.hazards?.length ? problems.hazards : undefined
          if (!pests && !diseases && !hazards) return undefined
          return { pests, diseases, hazards }
        })()
        
      // Get current fields
      const fields = {
        name: name.trim() || undefined,
        scientificName: scientificName.trim() || identifiers?.scientificName || undefined,
        meaning: meta?.funFact || meaning.trim() || undefined,
        description: description.trim() || undefined,
        careSoil: environment?.soil?.texture?.join(', ') || careSoil.trim() || undefined,
        identifiers: identifiers ? {
          scientificName: identifiers.scientificName || scientificName.trim() || undefined,
          commonNames: identifiers.commonNames,
        } : undefined,
        ecology: ecology ? {
          wildlifeValue: ecology.wildlifeValue,
        } : undefined,
        usage: usage ? {
          culinaryUses: usage.culinaryUses,
          medicinalUses: usage.medicinalUses,
        } : undefined,
        meta: meta ? {
          funFact: meta.funFact,
          authorNotes: meta.authorNotes,
          sourceReferences: meta.sourceReferences,
          } : undefined,
          phenology: translationPhenology,
          care: translationCarePayload,
          planting: translationPlanting,
          problems: translationProblems,
      }
      
      // Translate to all languages
      const allTranslations = await translatePlantToAllLanguages(fields, editLanguage)
      
      // Save all translations
      const translationsToSave = Object.entries(allTranslations).map(([lang, translated]) => ({
        plant_id: id,
        language: lang as SupportedLanguage,
        name: translated.name || name.trim(),
        identifiers: translated.identifiers || undefined,
        ecology: translated.ecology || undefined,
        usage: translated.usage || undefined,
          meta: translated.meta || undefined,
          phenology: translated.phenology || undefined,
          care: translated.care || undefined,
          planting: translated.planting || undefined,
          problems: translated.problems || undefined,
        scientific_name: translated.scientificName || scientificName.trim() || identifiers?.scientificName || null,
        meaning: translated.meta?.funFact || translated.meaning || null,
        description: translated.description || null,
        care_soil: translated.careSoil || null,
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
          // New JSONB structure
          identifiers: Object.keys(identifiers).length > 0 ? identifiers : null,
          traits: Object.keys(traits).length > 0 ? traits : null,
          dimensions: Object.keys(dimensions).length > 0 ? dimensions : null,
          phenology: Object.keys(phenology).length > 0 ? phenology : null,
          environment: Object.keys(environment).length > 0 ? environment : null,
          care: Object.keys(care).length > 0 ? care : null,
          propagation: Object.keys(propagation).length > 0 ? propagation : null,
          usage: Object.keys(usage).length > 0 ? usage : null,
          ecology: Object.keys(ecology).length > 0 ? ecology : null,
          commerce: Object.keys(commerce).length > 0 ? commerce : null,
          problems: Object.keys(problems).length > 0 ? problems : null,
          planting: Object.keys(planting).length > 0 ? planting : null,
          meta: Object.keys(meta).length > 0 ? meta : null,
          // Legacy fields for backward compatibility
          scientific_name: scientificName.trim() || identifiers?.scientificName || null,
          colors: colorArray,
          seasons,
          rarity: meta?.rarity === 'common' ? 'Common' : meta?.rarity === 'uncommon' ? 'Uncommon' : meta?.rarity === 'rare' ? 'Rare' : meta?.rarity === 'very rare' ? 'Legendary' : rarity,
          meaning: meta?.funFact || meaning || null,
          description: description || null,
          image_url: imageUrl || null,
          care_sunlight: environment?.sunExposure === 'full sun' ? 'High' : environment?.sunExposure === 'partial sun' ? 'Medium' : environment?.sunExposure === 'partial shade' ? 'Low' : careSunlight,
          care_soil: environment?.soil?.texture?.join(', ') || careSoil.trim() || null,
          care_difficulty: care?.difficulty === 'easy' ? 'Easy' : care?.difficulty === 'moderate' ? 'Moderate' : care?.difficulty === 'advanced' ? 'Hard' : careDifficulty,
          seeds_available: commerce?.seedsAvailable ?? seedsAvailable,
          water_freq_period: waterFreqPeriod,
          water_freq_amount: normalizedAmount,
          water_freq_unit: waterFreqPeriod,
          water_freq_value: normalizedAmount,
        })
        .eq('id', id)
      if (uerr) { setError(uerr.message); return }
      
        const translationPhenology = phenology?.scentNotes && phenology.scentNotes.length > 0
          ? { scentNotes: phenology.scentNotes }
          : undefined
        const translationCarePayload = (() => {
          const hasFrequency = !!care?.watering?.frequency && Object.values(care.watering.frequency!).some(Boolean)
          const hasSchedule = !!care?.fertilizing?.schedule
          const hasMulch = !!care?.mulching?.material
          if (!hasFrequency && !hasSchedule && !hasMulch) return undefined
          return {
            watering: hasFrequency ? { frequency: care?.watering?.frequency } : undefined,
            fertilizing: hasSchedule ? { schedule: care?.fertilizing?.schedule } : undefined,
            mulching: hasMulch ? { material: care?.mulching?.material } : undefined,
          }
        })()
        const translationPlanting = (() => {
          const sitePrep = planting?.sitePrep?.length ? planting.sitePrep : undefined
          const companionPlants = planting?.companionPlants?.length ? planting.companionPlants : undefined
          const avoidNear = planting?.avoidNear?.length ? planting.avoidNear : undefined
          if (!sitePrep && !companionPlants && !avoidNear) return undefined
          return { sitePrep, companionPlants, avoidNear }
        })()
        const translationProblems = (() => {
          const pests = problems?.pests?.length ? problems.pests : undefined
          const diseases = problems?.diseases?.length ? problems.diseases : undefined
          const hazards = problems?.hazards?.length ? problems.hazards : undefined
          if (!pests && !diseases && !hazards) return undefined
          return { pests, diseases, hazards }
        })()
        
        // Save translation for the current edit language
        const translation = {
        plant_id: id,
        language: editLanguage,
        name: name.trim(),
        // Translatable JSONB fields
        identifiers: identifiers ? {
          ...identifiers,
          scientificName: identifiers.scientificName || scientificName.trim() || undefined,
          commonNames: identifiers.commonNames || undefined,
        } : undefined,
        ecology: ecology ? {
          wildlifeValue: ecology.wildlifeValue,
        } : undefined,
        usage: usage ? {
          culinaryUses: usage.culinaryUses,
          medicinalUses: usage.medicinalUses,
        } : undefined,
        meta: meta ? {
          funFact: meta.funFact,
          authorNotes: meta.authorNotes,
          sourceReferences: meta.sourceReferences,
        } : undefined,
          phenology: translationPhenology,
          care: translationCarePayload,
          planting: translationPlanting,
          problems: translationProblems,
        // Legacy fields for backward compatibility
        scientific_name: scientificName.trim() || identifiers?.scientificName || null,
        meaning: meta?.funFact || meaning || null,
        description: description || null,
        care_soil: environment?.soil?.texture?.join(', ') || careSoil.trim() || null,
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
              <div className="grid gap-2 p-4 rounded-xl border bg-stone-50 dark:bg-stone-900 dark:border-stone-700">
                <Label htmlFor="edit-language" className="flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  Edit Language
                </Label>
                  <div className="flex items-center gap-2">
                    <select
                      id="edit-language"
                      className="flex h-9 flex-1 rounded-md border border-input bg-white dark:bg-[#2d2d30] dark:text-white px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
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
                      disabled={translating || saving || aiFilling}
                      className="rounded-2xl"
                    >
                      {translating ? 'Translating...' : 'Translate to All'}
                    </Button>
                  </div>
                <div className="text-xs opacity-60 dark:opacity-70">
                  Select the language you want to edit. Click "Translate to All" to translate current fields to all languages using DeepL.
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="plant-name">Name <span className="text-red-500">*</span></Label>
                <Input id="plant-name" autoComplete="off" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plant-image">Image URL</Label>
                <Input id="plant-image" autoComplete="off" value={imageUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
              </div>
              {editLanguage === 'en' && (
                <div className="flex items-center justify-between mb-4 p-4 rounded-xl border bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 dark:border-purple-800/30">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-semibold text-purple-900 dark:text-purple-200 mb-1">
                      <Sparkles className="h-5 w-5" />
                      AI Assistant
                    </div>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Let AI fill in all the advanced fields based on the plant name.
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
                          Filling{aiFillProgress.total > 0 ? ` ${Math.round((Math.min(aiFillProgress.completed, aiFillProgress.total) / aiFillProgress.total) * 100)}%` : '...'}
                        </>
                      ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Fill with AI
                      </>
                    )}
                  </Button>
                </div>
              )}
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
                {ok && <div className="text-sm text-green-600">{ok}</div>}
                {translating && <div className="text-sm text-blue-600">Translating all fields to all languages...</div>}
                  {aiFilling && (
                    <div className="flex flex-col gap-2 text-sm text-purple-600 dark:text-purple-400">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        AI is filling in the plant data...
                      </div>
                      {aiFillProgress.field && !['init', 'complete'].includes(aiFillProgress.field) && (
                        <div className="text-xs font-medium">
                          Working on: <span className="font-semibold">{aiFillProgress.field}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-purple-200 dark:bg-purple-950">
                          <div
                            className="h-full rounded-full bg-purple-500 transition-all"
                            style={{
                              width: `${aiFillProgress.total > 0 ? Math.round((aiFillProgress.completed / aiFillProgress.total) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium min-w-[4rem] text-right">
                          {aiFillProgress.total > 0
                            ? `${Math.min(aiFillProgress.completed, aiFillProgress.total)} / ${aiFillProgress.total}`
                            : '...'}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="self-start rounded-2xl"
                        onClick={() => {
                          abortControllerRef.current?.abort()
                          abortControllerRef.current = null
                          setAiFilling(false)
                          setAiFillProgress({ completed: 0, total: 0, field: undefined })
                          setOk(null)
                          setError('AI fill cancelled.')
                        }}
                      >
                        Stop AI fill
                      </Button>
                    </div>
                  )}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="secondary"
                    className="rounded-2xl"
                    onClick={onCancel}
                    disabled={saving || translating || aiFilling}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="rounded-2xl"
                    onClick={save}
                    disabled={saving || translating || aiFilling}
                  >
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

