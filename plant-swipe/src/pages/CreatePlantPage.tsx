import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabaseClient"
import { fetchAiPlantFill, fetchAiPlantFillField } from "@/lib/aiPlantFill"
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
  PlantClassification,
} from "@/types/plant"
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from "@/lib/i18n"
import { translatePlantToAllLanguages } from "@/lib/deepl"
import { savePlantTranslations, type PlantTranslation } from "@/lib/plantTranslations"
import { Languages, Sparkles, Loader2, CheckCircle2, AlertCircle, Circle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { CompleteAdvancedForm } from "@/components/plant/CompleteAdvancedForm"
import { useAuth } from "@/context/AuthContext"
import {
  REQUIRED_FIELD_CONFIG,
  REQUIRED_FIELD_TO_SCHEMA_KEY,
  AI_FIELD_STATUS_TEXT,
  createInitialStatuses,
  normalizeColorList,
  normalizeSeasonList,
  isFieldFilledFromData,
  isFieldFilledFromState,
  isDescriptionValid,
  isFunFactValid,
  countWords,
  countSentences,
  type AiFieldStatus,
  type RequiredFieldId,
  type AiFieldStateSnapshot,
} from "@/lib/aiFieldProgress"
import { hasClassificationData } from "@/constants/classification"

const AI_STATUS_STYLES: Record<AiFieldStatus, { text: string }> = {
  pending: { text: "text-muted-foreground" },
  working: { text: "text-purple-600 dark:text-purple-300" },
  filled: { text: "text-green-600 dark:text-green-400" },
  missing: { text: "text-red-600 dark:text-red-400" },
}

const MAX_AI_RETRY_ROUNDS = 2

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
  const { user, profile } = useAuth()
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
  const [aiFillProgress, setAiFillProgress] = React.useState<{ completed: number; total: number; field?: string }>({ completed: 0, total: 0, field: undefined })
  const [aiFieldStatuses, setAiFieldStatuses] = React.useState<Record<RequiredFieldId, AiFieldStatus>>(() => createInitialStatuses())
  const [aiMissingFields, setAiMissingFields] = React.useState<RequiredFieldId[]>([])
  const [aiStatusVisible, setAiStatusVisible] = React.useState(false)
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const resetAiTracking = () => {
    setAiFieldStatuses(createInitialStatuses())
    setAiMissingFields([])
  }
  const markFieldWorking = (fieldKey: string) => {
    if (!fieldKey || fieldKey === 'init' || fieldKey === 'complete') return
    setAiFieldStatuses((prev) => {
      let updated: Record<RequiredFieldId, AiFieldStatus> | null = null
      for (const config of REQUIRED_FIELD_CONFIG) {
        if (config.sourceKeys.includes(fieldKey) && prev[config.id] !== 'filled') {
          if (!updated) updated = { ...prev }
          updated[config.id] = 'working'
        }
      }
      return updated ?? prev
    })
  }
  const markFieldResult = (fieldKey: string, fieldData: unknown) => {
    if (!fieldKey || fieldKey === 'init' || fieldKey === 'complete') return
    setAiFieldStatuses((prev) => {
      let updated: Record<RequiredFieldId, AiFieldStatus> | null = null
      for (const config of REQUIRED_FIELD_CONFIG) {
        if (!config.sourceKeys.includes(fieldKey)) continue
        let filled = isFieldFilledFromData(config.id, fieldKey, fieldData)
        if (config.id === 'description' && typeof fieldData === 'string') {
          filled = isDescriptionValid(fieldData)
        }
        if (config.id === 'funFact') {
          const funFactValue =
            typeof fieldData === 'string'
              ? fieldData
              : (fieldData && typeof fieldData === 'object' ? (fieldData as any).funFact : '')
          filled = isFunFactValid(typeof funFactValue === 'string' ? funFactValue : '')
        }
        if (filled && prev[config.id] !== 'filled') {
          if (!updated) updated = { ...prev }
          updated[config.id] = 'filled'
        } else if (!filled && prev[config.id] !== 'filled') {
          if (!updated) updated = { ...prev }
          updated[config.id] = 'missing'
        }
      }
      return updated ?? prev
    })
  }
  const finalizeAiStatuses = (snapshot: AiFieldStateSnapshot) => {
    const next = createInitialStatuses()
    const missing: RequiredFieldId[] = []
    for (const config of REQUIRED_FIELD_CONFIG) {
      const filled = isFieldFilledFromState(config.id, snapshot)
      next[config.id] = filled ? 'filled' : 'missing'
      if (!filled) missing.push(config.id)
    }
    setAiFieldStatuses(next)
    setAiMissingFields(missing)
    return missing
  }
  const renderStatusIcon = (status: AiFieldStatus) => {
    switch (status) {
      case 'filled':
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
      case 'missing':
        return <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
      case 'working':
        return <Loader2 className="h-4 w-4 text-purple-600 dark:text-purple-300 animate-spin" />
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />
    }
  }
    // New JSONB structure state
    const [classification, setClassification] = React.useState<Partial<PlantClassification>>({})
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

  const funFact = React.useMemo(() => (meta?.funFact ?? meaning ?? '').trim(), [meta?.funFact, meaning])

  React.useEffect(() => {
    if (aiFilling) return
    const hasStarted = Object.values(aiFieldStatuses).some((status) => status !== 'pending')
    if (!hasStarted) return
    const snapshot: AiFieldStateSnapshot = {
      scientificName,
      colors,
      seasons,
      description,
      funFact,
    }
    const nextStatuses: Record<RequiredFieldId, AiFieldStatus> = { ...aiFieldStatuses }
    let statusChanged = false
    const missing: RequiredFieldId[] = []
    for (const config of REQUIRED_FIELD_CONFIG) {
      const filled = isFieldFilledFromState(config.id, snapshot)
      const desired: AiFieldStatus = filled ? 'filled' : 'missing'
      if (nextStatuses[config.id] !== desired) {
        nextStatuses[config.id] = desired
        statusChanged = true
      }
      if (!filled) missing.push(config.id)
    }
    if (statusChanged) {
      setAiFieldStatuses(nextStatuses)
    }
    setAiMissingFields((current) => {
      if (current.length === missing.length && current.every((id) => missing.includes(id))) {
        return current
      }
      return missing
    })
  }, [aiFilling, aiFieldStatuses, scientificName, colors, seasons, description, funFact])

  const toggleSeason = (s: Plant["seasons"][number]) => {
    setSeasons((cur: string[]) => (cur.includes(s) ? cur.filter((x: string) => x !== s) : [...cur, s]))
  }

  // Update name when initialName changes
  React.useEffect(() => {
    if (initialName) {
      setName(initialName)
    }
  }, [initialName])

    React.useEffect(() => {
      return () => {
        abortControllerRef.current?.abort()
        abortControllerRef.current = null
      }
    }, [])

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

    setAiStatusVisible(true)
    resetAiTracking()
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
        setError("Failed to load schema")
        return
      }

      const schemaWithMandatory: Record<string, unknown> = { ...(schema as Record<string, unknown>) }
      if (!('colors' in schemaWithMandatory)) {
        schemaWithMandatory.colors = {
          type: 'array',
          items: 'string',
          description: 'List of primary flower or foliage colors (simple color names).',
        }
      }
      if (!('seasons' in schemaWithMandatory)) {
        schemaWithMandatory.seasons = {
          type: 'array',
          items: 'string',
          description: 'Seasons when the plant is most active or in bloom (Spring, Summer, Autumn, Winter).',
        }
      }
      if (!('description' in schemaWithMandatory)) {
        schemaWithMandatory.description = {
          type: 'string',
          description: 'A concise botanical overview covering appearance, notable traits, and growth habits.',
        }
      }

        let latestClassification: Partial<PlantClassification> = { ...(classification ?? {}) }
        let latestIdentifiers: Partial<PlantIdentifiers> = { ...(identifiers ?? {}) }
      let latestScientificName = scientificName
      let latestColors = colors
      let latestSeasons = [...seasons]
      let latestDescription = description
      let latestMeaning = meaning
      let latestMeta: Partial<PlantMeta> = { ...(meta ?? {}) }
      let latestFunFact = (latestMeta?.funFact ?? latestMeaning ?? '').trim()

      const updateFunFactSnapshot = () => {
        latestFunFact = (latestMeta?.funFact ?? latestMeaning ?? '').trim()
      }

        const applyAiResult = (aiData: any) => {
        if (!aiData || typeof aiData !== 'object') return

          if (aiData.classification && typeof aiData.classification === 'object') {
            latestClassification = {
              ...(latestClassification ?? {}),
              ...aiData.classification,
            }
            setClassification(latestClassification)
          }

        if (aiData.identifiers) {
          const { externalIds: _ignoredExternalIds, ...restIdentifiers } = aiData.identifiers
          const previousExternalIds = (latestIdentifiers as any)?.externalIds
          const mergedIdentifiers: Partial<PlantIdentifiers> = {
            ...(latestIdentifiers ?? {}),
            ...restIdentifiers,
            ...(previousExternalIds ? { externalIds: previousExternalIds } : {}),
          }
          latestIdentifiers = mergedIdentifiers
          setIdentifiers(mergedIdentifiers)
          const aiScientificName = typeof restIdentifiers.scientificName === 'string'
            ? restIdentifiers.scientificName.trim()
            : ''
          if (aiScientificName) {
            latestScientificName = aiScientificName
            setScientificName(aiScientificName)
          }
        }

        if (aiData.traits) setTraits(aiData.traits)
        if (aiData.dimensions) setDimensions(aiData.dimensions)

        const directColors = normalizeColorList((aiData as any).colors)
        if (directColors.length > 0) {
          latestColors = directColors.join(', ')
          setColors(latestColors)
        }

        const directSeasons = normalizeSeasonList((aiData as any).seasons)
        if (directSeasons.length > 0) {
          latestSeasons = [...directSeasons]
          setSeasons(directSeasons)
        }

        if (typeof (aiData as any).description === 'string' && (aiData as any).description.trim()) {
          latestDescription = (aiData as any).description.trim()
          setDescription(latestDescription)
        }

        if (aiData.phenology) {
          setPhenology(aiData.phenology)
          if (normalizeColorList(latestColors).length === 0) {
            const phenologyColors = normalizeColorList(aiData.phenology.flowerColors)
            if (phenologyColors.length > 0) {
              latestColors = phenologyColors.join(', ')
              setColors(latestColors)
            }
          }
          if (latestSeasons.length === 0 && Array.isArray(aiData.phenology.floweringMonths)) {
            const derivedSeasons = normalizeSeasonList(aiData.phenology.floweringMonths)
            if (derivedSeasons.length > 0) {
              latestSeasons = [...derivedSeasons]
              setSeasons(derivedSeasons)
            }
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
          const mergedMeta: Partial<PlantMeta> = { ...(latestMeta ?? {}) }
          for (const [key, value] of Object.entries(aiData.meta)) {
            (mergedMeta as any)[key] = value
          }
          if (typeof mergedMeta.funFact === 'string') {
            mergedMeta.funFact = mergedMeta.funFact.trim()
          }
          latestMeta = mergedMeta
          setMeta(mergedMeta)

          const aiFunFact = typeof mergedMeta.funFact === 'string' ? mergedMeta.funFact.trim() : ''
          if (aiFunFact) {
            if (!latestMeaning.trim()) {
              latestMeaning = aiFunFact
              setMeaning(aiFunFact)
            }
          }
          if (mergedMeta.rarity) {
            const rarityMap: Record<string, Plant['rarity']> = {
              'common': 'Common',
              'uncommon': 'Uncommon',
              'rare': 'Rare',
              'very rare': 'Legendary',
            }
            setRarity(rarityMap[mergedMeta.rarity] || 'Common')
          }
          const metaDescription = typeof (mergedMeta as any).description === 'string' ? (mergedMeta as any).description.trim() : ''
          if (metaDescription && !latestDescription.trim()) {
            latestDescription = metaDescription
            setDescription(metaDescription)
          }
        }

        if (aiData.image && !imageUrl) {
          setImageUrl(aiData.image)
        }

        updateFunFactSnapshot()
      }

      const buildExistingData = () => {
          const normalizedColors = normalizeColorList(latestColors)
          return {
          identifiers: {
            ...(latestIdentifiers ?? {}),
            ...(latestScientificName.trim() ? { scientificName: latestScientificName.trim() } : {}),
          },
            classification: hasClassificationData(latestClassification) ? latestClassification : undefined,
          traits: { ...(traits ?? {}) },
          dimensions: { ...(dimensions ?? {}) },
          phenology: { ...(phenology ?? {}) },
          environment: { ...(environment ?? {}) },
          care: { ...(care ?? {}) },
          propagation: { ...(propagation ?? {}) },
          usage: { ...(usage ?? {}) },
          ecology: { ...(ecology ?? {}) },
          commerce: { ...(commerce ?? {}) },
          problems: { ...(problems ?? {}) },
          planting: { ...(planting ?? {}) },
          meta: {
            ...(latestMeta ?? {}),
            ...(latestMeaning.trim() ? { funFact: latestMeaning.trim() } : {}),
          },
          colors: normalizedColors.length > 0 ? normalizedColors : undefined,
          seasons: latestSeasons.length > 0 ? latestSeasons : undefined,
          description: latestDescription.trim() || undefined,
        }
      }

      const finalizeSnapshot = (): AiFieldStateSnapshot => ({
        scientificName: latestScientificName,
        colors: latestColors,
        seasons: latestSeasons,
        description: latestDescription,
        funFact: latestFunFact,
      })

      const runFullFill = async () => {
        const aiData = await fetchAiPlantFill({
          plantName: name.trim(),
          schema: schemaWithMandatory,
          existingData: buildExistingData(),
          signal: controller.signal,
          onProgress: ({ completed, total, field }) => {
            setAiFillProgress({ completed, total, field })
            if (field) markFieldWorking(field)
          },
          onFieldComplete: ({ field, data }) => {
            markFieldResult(field, data)
          },
        })
        applyAiResult(aiData)
        return finalizeAiStatuses(finalizeSnapshot())
      }

      const retryMissingFields = async (missingFields: RequiredFieldId[]) => {
        let currentMissing = missingFields
        let round = 0
        while (currentMissing.length > 0 && round < MAX_AI_RETRY_ROUNDS && !controller.signal.aborted) {
          round += 1
          for (const requiredId of currentMissing) {
            const fieldKey = REQUIRED_FIELD_TO_SCHEMA_KEY[requiredId]
            if (!fieldKey) continue
            if (controller.signal.aborted) throw new Error('AI fill was cancelled')
            markFieldWorking(fieldKey)
            setAiFillProgress((prev) => ({ completed: prev.completed, total: prev.total, field: fieldKey }))
            try {
              const existingFieldData = buildExistingData()[fieldKey as keyof ReturnType<typeof buildExistingData>]
              const data = await fetchAiPlantFillField({
                plantName: name.trim(),
                schema: schemaWithMandatory,
                fieldKey,
                existingField: existingFieldData,
                signal: controller.signal,
                onFieldComplete: ({ field, data }) => {
                  markFieldResult(field, data)
                },
              })
              if (data !== undefined && data !== null) {
                applyAiResult({ [fieldKey]: data })
              }
            } catch (err) {
              console.error(`AI retry failed for ${fieldKey}:`, err)
            }
          }
          currentMissing = finalizeAiStatuses(finalizeSnapshot())
        }
        return currentMissing
      }

      let missing = await runFullFill()
      if (missing.length > 0) {
        missing = await retryMissingFields(missing)
      }

      if (missing.length === 0) {
        setOk("AI data loaded successfully! Please review and edit before saving.")
      } else {
        const missingLabels = REQUIRED_FIELD_CONFIG
          .filter(({ id }) => missing.includes(id))
          .map(({ label }) => label)
        let message = `AI could not fill the following required fields after retrying: ${missingLabels.join(', ')}. Please complete them manually.`
        if (missing.includes('description')) {
          const wordCount = countWords(latestDescription)
          message += ` The overview must be between 100 and 400 words (currently ${wordCount}).`
        }
        if (missing.includes('funFact')) {
          const sentenceCount = countSentences(latestFunFact)
          message += ` The fun fact must contain between 1 and 3 sentences (currently ${sentenceCount}).`
        }
        setError(message)
      }
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

  const save = async () => {
    setError(null)
    setOk(null)
    if (!name.trim()) { setError("Name is required"); return }
    const trimmedScientificName = scientificName.trim()
    if (!trimmedScientificName) { setError("Scientific name is required"); return }
    const normalizedColors = normalizeColorList(colors)
    if (normalizedColors.length === 0) { setError("At least one color is required"); return }
    if (seasons.length === 0) { setError("Select at least one season"); return }
    if (!description.trim()) { setError("Overview is required"); return }
    const descriptionWordCount = countWords(description)
    if (descriptionWordCount < 100 || descriptionWordCount > 400) {
      setError(`Overview must be between 100 and 400 words (currently ${descriptionWordCount}).`)
      return
    }
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
      const careSunlightValue = environment?.sunExposure
        ? (() => {
            const exposure = String(environment.sunExposure).toLowerCase()
            if (exposure.includes('full')) return 'High'
            if (exposure.includes('partial sun')) return 'Medium'
            return 'Low'
          })()
        : 'Low'

      const id = generateUUIDv4()
      const nameNorm = name.trim()
    const sciNorm = trimmedScientificName
    const actorLabel = profile?.display_name?.trim() || user?.email?.trim() || user?.id || 'Unknown admin'
    const nowIso = new Date().toISOString()
    const metaBase = meta ?? {}
    const baseFunFact = typeof metaBase.funFact === 'string' ? metaBase.funFact.trim() : ''
    const funFactText = baseFunFact || meaning.trim()
    if (!isFunFactValid(funFactText)) {
      const sentenceCount = countSentences(funFactText)
      setError(`Fun fact must contain between 1 and 3 sentences (currently ${sentenceCount}).`)
      return
    }
    const createdAtValue = typeof metaBase.createdAt === 'string' && metaBase.createdAt.trim().length > 0
      ? metaBase.createdAt.trim()
      : nowIso
    const createdByValue = typeof metaBase.createdBy === 'string' && metaBase.createdBy.trim().length > 0
      ? metaBase.createdBy.trim()
      : actorLabel
      const metaForInsert: Partial<PlantMeta> = {
      ...metaBase,
      funFact: funFactText || undefined,
      createdAt: createdAtValue,
      updatedAt: nowIso,
      createdBy: createdByValue,
      updatedBy: actorLabel,
    }
    setMeta(metaForInsert)
    const shouldPersistMeta = Object.values(metaForInsert).some((value) => {
      if (value === undefined || value === null) return false
      if (typeof value === 'string') return value.trim().length > 0
      if (Array.isArray(value)) return value.length > 0
      return true
    })
      const shouldPersistClassification = hasClassificationData(classification)
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
          classification: includeAdvanced && shouldPersistClassification ? classification : null,
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
          meta: shouldPersistMeta ? metaForInsert : null,
        // Legacy fields for backward compatibility
        scientific_name: sciNorm || identifiers?.scientificName || null,
          colors: normalizedColors,
        seasons,
          rarity: metaForInsert?.rarity === 'common' ? 'Common' : metaForInsert?.rarity === 'uncommon' ? 'Uncommon' : metaForInsert?.rarity === 'rare' ? 'Rare' : metaForInsert?.rarity === 'very rare' ? 'Legendary' : rarity,
          meaning: metaForInsert?.funFact || meaning || null,
        image_url: imageUrl || null,
        care_sunlight: careSunlightValue,
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
      
        // Prepare partial sections for translation persistence
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
          meta: includeAdvanced && metaForInsert ? {
            funFact: metaForInsert.funFact,
            authorNotes: metaForInsert.authorNotes,
            sourceReferences: metaForInsert.sourceReferences,
        } : undefined,
          phenology: includeAdvanced ? translationPhenology : undefined,
          care: includeAdvanced ? translationCarePayload : undefined,
          planting: includeAdvanced ? translationPlanting : undefined,
          problems: includeAdvanced ? translationProblems : undefined,
        // Legacy fields for backward compatibility
        scientific_name: sciNorm || identifiers?.scientificName || null,
          meaning: metaForInsert?.funFact || meaning || null,
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
              meaning: metaForInsert?.funFact || meaning || undefined,
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
              meta: includeAdvanced && metaForInsert ? {
                funFact: metaForInsert.funFact,
                authorNotes: metaForInsert.authorNotes,
                sourceReferences: metaForInsert.sourceReferences,
            } : undefined,
              phenology: includeAdvanced ? translationPhenology : undefined,
              care: includeAdvanced ? translationCarePayload : undefined,
              planting: includeAdvanced ? translationPlanting : undefined,
              problems: includeAdvanced ? translationProblems : undefined,
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
                  phenology: translated.phenology || undefined,
                  care: translated.care || undefined,
                  planting: translated.planting || undefined,
                  problems: translated.problems || undefined,
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
                {aiStatusVisible && (
                  <div className="mb-4 rounded-xl border border-purple-100 bg-purple-50/70 p-4 dark:border-purple-900/40 dark:bg-purple-950/20">
                    <div className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                      Required by AI
                    </div>
                    <div className="mt-2 space-y-2">
                      {REQUIRED_FIELD_CONFIG.map(({ id, label }) => {
                        const status = aiFieldStatuses[id]
                        return (
                          <div key={id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              {renderStatusIcon(status)}
                              <span className="text-muted-foreground dark:text-stone-300">{label}</span>
                            </div>
                            <span className={`font-medium ${AI_STATUS_STYLES[status].text}`}>
                              {AI_FIELD_STATUS_TEXT[status]}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    {aiMissingFields.length > 0 && (
                      <div className="mt-3 text-xs text-red-600 dark:text-red-400">
                        Missing:{" "}
                        {REQUIRED_FIELD_CONFIG.filter(({ id }) => aiMissingFields.includes(id))
                          .map(({ label }) => label)
                          .join(", ")}
                      </div>
                    )}
                  </div>
                )}
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
                    classification={classification}
                    setClassification={setClassification}
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
                    resetAiTracking()
                  }}
                >
                  Stop AI fill
                </Button>
              </div>
            )}
            
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

