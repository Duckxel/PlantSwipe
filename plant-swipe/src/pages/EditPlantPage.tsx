import React from "react"
import { useParams } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { supabase } from "@/lib/supabaseClient"
import { fetchAiPlantFill, fetchAiPlantFillField, verifyPlantNameIsPlant } from "@/lib/aiPlantFill"
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
  PlantPhoto,
} from "@/types/plant"
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from "@/lib/i18n"
import { translatePlantToAllLanguages } from "@/lib/deepl"
import { savePlantTranslations, getPlantTranslation } from "@/lib/plantTranslations"
import { Languages, Sparkles, Loader2, CheckCircle2, AlertCircle, Circle } from "lucide-react"
import { CompleteAdvancedForm } from "@/components/plant/CompleteAdvancedForm"
import { PlantPhotoListEditor } from "@/components/plant/PlantPhotoListEditor"
import { useAuth } from "@/context/AuthContext"
import { useTranslation } from "react-i18next"
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
  getRequiredIdsBySchemaKey,
  getRequiredFieldLabel,
  type AiFieldStatus,
  type RequiredFieldId,
  type AiFieldStateSnapshot,
} from "@/lib/aiFieldProgress"
import { hasClassificationData } from "@/constants/classification"
import {
  createEmptyPhoto,
  ensureAtLeastOnePhoto,
  getPrimaryPhotoUrl,
  normalizePlantPhotos,
  sanitizePlantPhotos,
  upsertPrimaryPhoto,
} from "@/lib/photos"

const AI_STATUS_STYLES: Record<AiFieldStatus, { text: string }> = {
  pending: { text: "text-muted-foreground" },
  working: { text: "text-purple-600 dark:text-purple-300" },
  filled: { text: "text-green-600 dark:text-green-400" },
  missing: { text: "text-red-600 dark:text-red-400" },
}

const MAX_AI_RETRY_ROUNDS = 2
const MAX_AI_ATTEMPTS_PER_FIELD = 3

interface EditPlantPageProps {
  onCancel: () => void
  onSaved?: (plantId: string) => void
}

export const EditPlantPage: React.FC<EditPlantPageProps> = ({ onCancel, onSaved }) => {
  const { id } = useParams<{ id: string }>()
  const { user, profile } = useAuth()
  const { t } = useTranslation('common')

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
  const [photos, setPhotos] = React.useState<PlantPhoto[]>([createEmptyPhoto(true)])
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
  const [aiFieldStatuses, setAiFieldStatuses] = React.useState<Record<RequiredFieldId, AiFieldStatus>>(() => createInitialStatuses())
  const [aiMissingFields, setAiMissingFields] = React.useState<RequiredFieldId[]>([])
  const [aiStatusVisible, setAiStatusVisible] = React.useState(false)
  const abortControllerRef = React.useRef<AbortController | null>(null)
    const [aiPanelMessage, setAiPanelMessage] = React.useState<string | null>(null)
    const [aiPanelNotices, setAiPanelNotices] = React.useState<string[]>([])
    const aiFieldAttemptCountsRef = React.useRef<Record<string, number>>({})
    const aiFieldNoticeRef = React.useRef<Record<string, boolean>>({})
  const resetAiTracking = () => {
    setAiFieldStatuses(createInitialStatuses())
    setAiMissingFields([])
  }
    const resetAiPanelState = () => {
      setAiPanelMessage(null)
      setAiPanelNotices([])
      aiFieldAttemptCountsRef.current = {}
      aiFieldNoticeRef.current = {}
    }
    const addAiNotice = (notice: string) => {
      setAiPanelNotices((prev) => (prev.includes(notice) ? prev : [...prev, notice]))
    }
    const formatRequiredLabels = (ids: RequiredFieldId[]) => {
      return ids
        .map((id) => getRequiredFieldLabel(id))
        .filter((label) => typeof label === 'string' && label.trim().length > 0)
        .join(', ')
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
    const [classificationTabSignal, setClassificationTabSignal] = React.useState(0)
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
  const initialCreatedAtRef = React.useRef<string | null>(null)
  const initialCreatedByRef = React.useRef<string | null>(null)

  const funFact = React.useMemo(() => (meta?.funFact ?? '').trim(), [meta?.funFact])
  const handlePhotosChange = React.useCallback((next: PlantPhoto[]) => {
    setPhotos(ensureAtLeastOnePhoto(next))
  }, [])

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
      classificationType: classification?.type ?? '',
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
    }, [aiFilling, aiFieldStatuses, scientificName, colors, seasons, description, funFact, classification?.type])

  const toggleSeason = (s: Plant["seasons"][number]) => {
    setSeasons((cur: string[]) => (cur.includes(s) ? cur.filter((x: string) => x !== s) : [...cur, s]))
  }

    React.useEffect(() => {
      return () => {
        abortControllerRef.current?.abort()
        abortControllerRef.current = null
      }
    }, [])

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
        setAiStatusVisible(true)
        resetAiPanelState()
        addAiNotice('AI fill currently supports English entries only.')
        setAiPanelMessage('Switch the edit language to EN to use the AI assistant.')
        setOk(null)
        setError('AI fill is only available when editing the English content.')
        return
      }

      const trimmedName = name.trim()
      if (!trimmedName) {
        setOk(null)
        setError('Please enter a plant name first')
        return
      }

      setAiStatusVisible(true)
      resetAiTracking()
      resetAiPanelState()
      setAiFilling(true)
      setAiPanelMessage('Checking plant name...')
      setAiFillProgress({ completed: 0, total: 0, field: undefined })
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller
      setError(null)
      setOk(null)

    try {
        const schema = await loadSchema()
        if (!schema) {
          setAiPanelMessage('Failed to load AI schema. Please try again later.')
          setError('Failed to load schema')
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
        if (!('classification' in schemaWithMandatory)) {
          const classificationSchema = (schema as any)?.classification ?? {
            type: 'object',
            description: 'Structured plant classification. Provide at least the primary type such as plant, shrub, tree, etc.',
            properties: {
              type: {
                type: 'string',
                description: 'Primary plant type, e.g., plant, shrub, tree, bambu, other',
              },
              subclass: {
                type: 'string',
                description: 'Optional subclass when type is plant (flower, vegetable, cereal, spice)',
              },
              subSubclass: {
                type: 'string',
                description: 'Optional extra subclass for vegetables (fruit, seed, root, leaf, flower)',
              },
              activities: {
                type: 'array',
                items: 'string',
                description: 'Optional list of activities/uses such as ornemental, comestible, aromatic, medicinal.',
              },
            },
          }
          schemaWithMandatory.classification = classificationSchema
        }

        try {
          const verification = await verifyPlantNameIsPlant(trimmedName, controller.signal)
          if (!verification.isPlant) {
            const reason = verification.reason?.trim() || ''
            setAiPanelMessage(
              reason
                ? `AI could not confirm "${trimmedName}" is a plant: ${reason}`
                : `AI could not confirm "${trimmedName}" is a plant.`,
            )
            addAiNotice('AI fill skipped. Double-check the plant name or provide a scientific name before retrying.')
            return
          }
        } catch (verifyErr: any) {
          console.error('AI plant name verification failed:', verifyErr)
          setAiPanelMessage('Could not verify plant name. Please try again.')
          addAiNotice('Plant name verification failed, so AI fill was not started.')
          setError(verifyErr?.message || 'Could not verify plant name.')
          return
        }

        setAiPanelMessage(null)

        let latestClassification: Partial<PlantClassification> = { ...(classification ?? {}) }
        let latestIdentifiers: Partial<PlantIdentifiers> = { ...(identifiers ?? {}) }
      let latestScientificName = scientificName
      let latestColors = colors
      let latestSeasons = [...seasons]
        let latestDescription = description
        let latestMeaning = meaning
        let latestMeta: Partial<PlantMeta> = { ...(meta ?? {}) }
        let latestFunFact = (latestMeta?.funFact ?? '').trim()
        let latestPhotos: PlantPhoto[] = [...photos]

      let latestTraits: Partial<PlantTraits> = { ...(traits ?? {}) }
      let latestDimensions: Partial<PlantDimensions> = { ...(dimensions ?? {}) }
      let latestPhenology: Partial<PlantPhenology> = { ...(phenology ?? {}) }
      let latestEnvironment: Partial<PlantEnvironment> = { ...(environment ?? {}) }
      let latestCare: Partial<PlantCare> = { ...(care ?? {}) }
      let latestPropagation: Partial<PlantPropagation> = { ...(propagation ?? {}) }
      let latestUsage: Partial<PlantUsage> = { ...(usage ?? {}) }
      let latestEcology: Partial<PlantEcology> = { ...(ecology ?? {}) }
      let latestCommerce: Partial<PlantCommerce> = { ...(commerce ?? {}) }
      let latestProblems: Partial<PlantProblems> = { ...(problems ?? {}) }
      let latestPlanting: Partial<PlantPlanting> = { ...(planting ?? {}) }

      let latestCareSunlight = careSunlight
      let latestCareSoil = careSoil
      let latestCareDifficulty = careDifficulty
      let latestSeedsAvailable = seedsAvailable
      let latestWaterFreqPeriod = waterFreqPeriod
      let latestWaterFreqAmount = waterFreqAmount

        const updateFunFactSnapshot = () => {
          latestFunFact = (latestMeta?.funFact ?? '').trim()
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

        if (aiData.traits) {
          latestTraits = aiData.traits
          setTraits(aiData.traits)
        }
        if (aiData.dimensions) {
          latestDimensions = aiData.dimensions
          setDimensions(aiData.dimensions)
        }

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

        if (typeof (aiData as any).meaning === 'string' && (aiData as any).meaning.trim()) {
          latestMeaning = (aiData as any).meaning.trim()
          setMeaning(latestMeaning)
        }

        if (aiData.phenology) {
          latestPhenology = aiData.phenology
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

        if (aiData.environment) {
          latestEnvironment = aiData.environment
          setEnvironment(aiData.environment)
          if (aiData.environment.soil?.texture?.length) {
            const soilValue = aiData.environment.soil.texture.join(', ')
            if (!latestCareSoil.trim()) {
              latestCareSoil = soilValue
              setCareSoil(soilValue)
            }
          }
          if (aiData.environment.sunExposure) {
            const sunExposure = String(aiData.environment.sunExposure).toLowerCase()
            let derivedSunlight: NonNullable<Plant['care']>['sunlight'] = latestCareSunlight
            if (sunExposure.includes('full')) {
              derivedSunlight = 'High'
            } else if (sunExposure.includes('partial sun')) {
              derivedSunlight = 'Medium'
            } else if (sunExposure.includes('partial shade') || sunExposure.includes('shade')) {
              derivedSunlight = 'Low'
            }
            if (derivedSunlight) {
              latestCareSunlight = derivedSunlight
              setCareSunlight(derivedSunlight)
            }
          }
        }

        if (aiData.care) {
          latestCare = aiData.care
          setCare(aiData.care)
          if (aiData.care.difficulty) {
            const difficulty = String(aiData.care.difficulty).toLowerCase()
            let mappedDifficulty: NonNullable<Plant['care']>['difficulty'] = latestCareDifficulty
            if (difficulty === 'easy') mappedDifficulty = 'Easy'
            else if (difficulty === 'moderate') mappedDifficulty = 'Moderate'
            else if (difficulty === 'advanced') mappedDifficulty = 'Hard'
            if (mappedDifficulty) {
              latestCareDifficulty = mappedDifficulty
              setCareDifficulty(mappedDifficulty)
            }
          }
          if (aiData.care.watering?.interval?.value && aiData.care.watering?.interval?.unit) {
            const unit = String(aiData.care.watering.interval.unit).toLowerCase()
            if (unit === 'week' || unit === 'month' || unit === 'year') {
              latestWaterFreqPeriod = unit as 'week' | 'month' | 'year'
              latestWaterFreqAmount = Math.max(1, Number(aiData.care.watering.interval.value) || 1)
              setWaterFreqPeriod(latestWaterFreqPeriod)
              setWaterFreqAmount(latestWaterFreqAmount)
            }
          }
        }

        if (aiData.propagation) {
          latestPropagation = aiData.propagation
          setPropagation(aiData.propagation)
        }
        if (aiData.usage) {
          latestUsage = aiData.usage
          setUsage(aiData.usage)
        }
        if (aiData.ecology) {
          latestEcology = aiData.ecology
          setEcology(aiData.ecology)
        }
        if (aiData.commerce) {
          latestCommerce = aiData.commerce
          setCommerce(aiData.commerce)
          if (typeof aiData.commerce.seedsAvailable === 'boolean') {
            latestSeedsAvailable = Boolean(aiData.commerce.seedsAvailable)
            setSeedsAvailable(latestSeedsAvailable)
          }
        }
        if (aiData.problems) {
          latestProblems = aiData.problems
          setProblems(aiData.problems)
        }
        if (aiData.planting) {
          latestPlanting = aiData.planting
          setPlanting(aiData.planting)
        }

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
          if (mergedMeta.rarity) {
            const rarityMap: Record<string, Plant['rarity']> = {
              'common': 'Common',
              'uncommon': 'Uncommon',
              'rare': 'Rare',
              'very rare': 'Legendary',
              'legendary': 'Legendary',
            }
            const mappedRarity = rarityMap[String(mergedMeta.rarity).toLowerCase()]
            if (mappedRarity) {
              setRarity(mappedRarity)
            }
          }
          const metaDescription = typeof (mergedMeta as any).description === 'string' ? (mergedMeta as any).description.trim() : ''
          if (metaDescription && !latestDescription.trim()) {
            latestDescription = metaDescription
            setDescription(metaDescription)
          }
        }

        if (Array.isArray(aiData.photos)) {
          latestPhotos = ensureAtLeastOnePhoto(
            normalizePlantPhotos(aiData.photos, getPrimaryPhotoUrl(latestPhotos)),
          )
          setPhotos(latestPhotos)
        } else if (typeof aiData.image === 'string' && aiData.image.trim()) {
          latestPhotos = ensureAtLeastOnePhoto(upsertPrimaryPhoto(latestPhotos, aiData.image))
          setPhotos(latestPhotos)
        }

        updateFunFactSnapshot()
      }

      const buildExistingData = () => {
        const normalizedColors = normalizeColorList(latestColors)
        const sanitizedPhotos = sanitizePlantPhotos(latestPhotos)
        const carePayload: any = {
          ...(latestCare ?? {}),
        }
        if (latestCareSunlight) {
          carePayload.sunlight = latestCareSunlight
        }
        if (latestCareDifficulty) {
          carePayload.difficulty = latestCareDifficulty
        }
        if (latestWaterFreqAmount) {
          carePayload.watering = {
            ...(carePayload.watering ?? {}),
            interval: {
              ...((carePayload.watering ?? {}).interval ?? {}),
              value: latestWaterFreqAmount,
              unit: latestWaterFreqPeriod,
            },
          }
        }

        return {
          identifiers: {
            ...(latestIdentifiers ?? {}),
            ...(latestScientificName.trim() ? { scientificName: latestScientificName.trim() } : {}),
          },
          classification: hasClassificationData(latestClassification) ? latestClassification : undefined,
          traits: { ...(latestTraits ?? {}) },
          dimensions: { ...(latestDimensions ?? {}) },
          phenology: { ...(latestPhenology ?? {}) },
          environment: { ...(latestEnvironment ?? {}) },
          care: carePayload,
          propagation: { ...(latestPropagation ?? {}) },
          usage: { ...(latestUsage ?? {}) },
          ecology: { ...(latestEcology ?? {}) },
          commerce: {
            ...(latestCommerce ?? {}),
            ...(typeof latestSeedsAvailable === 'boolean' ? { seedsAvailable: latestSeedsAvailable } : {}),
          },
          problems: { ...(latestProblems ?? {}) },
          planting: { ...(latestPlanting ?? {}) },
          meta: {
            ...(latestMeta ?? {}),
            ...(latestFunFact ? { funFact: latestFunFact } : {}),
          },
          photos: sanitizedPhotos.length > 0 ? sanitizedPhotos : undefined,
          colors: normalizedColors.length > 0 ? normalizedColors : undefined,
          seasons: latestSeasons.length > 0 ? latestSeasons : undefined,
          description: latestDescription.trim() || undefined,
          meaning: latestMeaning.trim() || undefined,
        }
      }

        const finalizeSnapshot = (): AiFieldStateSnapshot => ({
          scientificName: latestScientificName,
          colors: latestColors,
          seasons: latestSeasons,
          description: latestDescription,
          funFact: latestFunFact,
          classificationType: latestClassification?.type ?? '',
        })

        const registerFieldFailure = (fieldKey: string, stillMissingIds: RequiredFieldId[], reason?: string) => {
          if (stillMissingIds.length === 0) {
            delete aiFieldAttemptCountsRef.current[fieldKey]
            delete aiFieldNoticeRef.current[fieldKey]
            return
          }
          const nextAttempt = (aiFieldAttemptCountsRef.current[fieldKey] ?? 0) + 1
          aiFieldAttemptCountsRef.current[fieldKey] = nextAttempt
          if (nextAttempt < MAX_AI_ATTEMPTS_PER_FIELD) {
            return
          }
          if (aiFieldNoticeRef.current[fieldKey]) {
            return
          }
          aiFieldNoticeRef.current[fieldKey] = true
          const labelText = formatRequiredLabels(stillMissingIds) || fieldKey
          const cleanedReason = reason ? reason.replace(/\s+/g, ' ').trim().replace(/\.+$/, '') : `AI couldn't complete ${labelText}`
          addAiNotice(`${cleanedReason}. ${labelText} still incomplete after ${nextAttempt} attempts, please finish manually.`)
        }

        const processFieldResult = (fieldKey: string, fieldData: unknown) => {
          if (!fieldKey || fieldKey === 'init' || fieldKey === 'complete') return
          markFieldResult(fieldKey, fieldData)
          if (fieldData !== undefined && fieldData !== null) {
            applyAiResult({ [fieldKey]: fieldData })
          }
          const relatedIds = getRequiredIdsBySchemaKey(fieldKey)
          if (relatedIds.length === 0) return
          const snapshot = finalizeSnapshot()
          const stillMissing = relatedIds.filter((id) => !isFieldFilledFromState(id, snapshot))
          if (stillMissing.length > 0) {
            registerFieldFailure(fieldKey, stillMissing)
          } else {
            delete aiFieldAttemptCountsRef.current[fieldKey]
            delete aiFieldNoticeRef.current[fieldKey]
          }
        }

        const runFullFill = async () => {
        const aiData = await fetchAiPlantFill({
            plantName: trimmedName,
          schema: schemaWithMandatory,
          existingData: buildExistingData(),
          signal: controller.signal,
            continueOnFieldError: true,
          onProgress: ({ completed, total, field }) => {
            setAiFillProgress({ completed, total, field })
            if (field) markFieldWorking(field)
          },
          onFieldComplete: ({ field, data }) => {
              processFieldResult(field, data)
          },
            onFieldError: ({ field, error }) => {
              setAiPanelMessage((prev) => prev ?? 'AI encountered some issues, keeping completed sections while retrying missing ones.')
              const relatedIds = getRequiredIdsBySchemaKey(field)
              if (relatedIds.length === 0) return
              const snapshot = finalizeSnapshot()
              const stillMissing = relatedIds.filter((id) => !isFieldFilledFromState(id, snapshot))
              registerFieldFailure(field, stillMissing, error)
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
                await fetchAiPlantFillField({
                  plantName: trimmedName,
                schema: schemaWithMandatory,
                fieldKey,
                existingField: existingFieldData,
                signal: controller.signal,
                onFieldComplete: ({ field, data }) => {
                    processFieldResult(field, data)
                },
              })
              } catch (err: any) {
                console.error(`AI retry failed for ${fieldKey}:`, err)
                const relatedIds = getRequiredIdsBySchemaKey(fieldKey)
                const snapshot = finalizeSnapshot()
                const stillMissing = relatedIds.filter((id) => !isFieldFilledFromState(id, snapshot))
                registerFieldFailure(fieldKey, stillMissing, err?.message || String(err))
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
          setOk('AI data loaded successfully! Please review and edit before saving.')
          setAiPanelMessage(null)
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
          setAiPanelMessage('AI fill finished with some missing fields.')
          addAiNotice(message)
          setError(message)
        }
        } catch (err: any) {
          console.error('AI fill error:', err)
          setAiPanelMessage((prev) => prev ?? 'AI fill stopped. Any completed fields were kept.')
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
          .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, photos, care_sunlight, care_soil, care_difficulty, seeds_available, water_freq_period, water_freq_amount, water_freq_unit, water_freq_value, classification, identifiers, traits, dimensions, phenology, environment, care, propagation, usage, ecology, commerce, problems, planting, meta, created_at')
          .eq('id', id)
          .maybeSingle()
        if (qerr) throw new Error(qerr.message)
        if (!data) throw new Error('Plant not found')
        if (ignore) return
        
        // Load translation for selected language
        const { data: translation } = await getPlantTranslation(id, editLanguage)
        
        // Parse JSONB fields
        const parsedClassification = typeof data.classification === 'string' ? JSON.parse(data.classification) : data.classification
        const resolvedClassificationType =
          parsedClassification && typeof (parsedClassification as any).type === 'string'
            ? (parsedClassification as any).type
            : ''
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
        if (!initialCreatedAtRef.current) {
          const trimmedMetaCreatedAt = typeof parsedMeta?.createdAt === 'string' ? parsedMeta.createdAt.trim() : ''
          if (trimmedMetaCreatedAt) {
            initialCreatedAtRef.current = trimmedMetaCreatedAt
          } else if (typeof data.created_at === 'string') {
            initialCreatedAtRef.current = data.created_at
          }
        }
        if (!initialCreatedByRef.current) {
          const trimmedMetaCreatedBy = typeof parsedMeta?.createdBy === 'string' ? parsedMeta.createdBy.trim() : ''
          if (trimmedMetaCreatedBy) {
            initialCreatedByRef.current = trimmedMetaCreatedBy
          }
        }
        
        // Parse translation JSONB fields
        const translationIdentifiers = translation?.identifiers ? (typeof translation.identifiers === 'string' ? JSON.parse(translation.identifiers) : translation.identifiers) : null
        const translationEcology = translation?.ecology ? (typeof translation.ecology === 'string' ? JSON.parse(translation.ecology) : translation.ecology) : null
        const translationUsage = translation?.usage ? (typeof translation.usage === 'string' ? JSON.parse(translation.usage) : translation.usage) : null
        const translationMeta = translation?.meta ? (typeof translation.meta === 'string' ? JSON.parse(translation.meta) : translation.meta) : null
        
        // Use translation data if available, otherwise use base data
          const resolvedName = String(translation?.name || data.name || '')
          const resolvedScientificName = String(translation?.scientific_name || data.scientific_name || parsedIdentifiers?.scientificName || '')
          const resolvedMeaning = String(translation?.meaning || data.meaning || '')
        const resolvedDescription = String(translation?.description || data.description || '')
        const resolvedFunFact = String(translationMeta?.funFact || parsedMeta?.funFact || '')
          const englishScientificName = String(data.scientific_name || parsedIdentifiers?.scientificName || '')
          const englishDescription = String(data.description || '')
          const resolvedColorsArray = Array.isArray(data.colors) ? (data.colors as string[]) : []
          const resolvedColorsString = resolvedColorsArray.join(', ')
          const resolvedSeasons = Array.isArray(data.seasons) ? (data.seasons as string[]) : []

          setName(resolvedName)
          setScientificName(resolvedScientificName)
          setMeaning(resolvedMeaning)
          setDescription(resolvedDescription)
          setCareSoil(String(translation?.care_soil || data.care_soil || ''))
        
        // Set JSONB structures - merge translations with base data
          setClassification(parsedClassification || {})
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
          funFact: translationMeta?.funFact || parsedMeta?.funFact || undefined,
          authorNotes: translationMeta?.authorNotes || parsedMeta?.authorNotes || undefined,
          sourceReferences: translationMeta?.sourceReferences || parsedMeta?.sourceReferences || undefined,
        })
        
        // These fields are not translated (shared across languages)
          setColors(resolvedColorsString)
          setSeasons(resolvedSeasons)
        setRarity((data.rarity || 'Common') as Plant['rarity'])
        const normalizedPhotos = normalizePlantPhotos(data.photos, data.image_url)
        setPhotos(ensureAtLeastOnePhoto(normalizedPhotos.length > 0 ? normalizedPhotos : [createEmptyPhoto(true)]))
        setCareSunlight((data.care_sunlight || 'Low') as NonNullable<Plant['care']>['sunlight'])
        setCareDifficulty((data.care_difficulty || 'Easy') as NonNullable<Plant['care']>['difficulty'])
        setSeedsAvailable(Boolean(data.seeds_available ?? parsedCommerce?.seedsAvailable ?? false))
        const period = (data.water_freq_period || data.water_freq_unit || 'week') as 'week' | 'month' | 'year'
        const amount = Number(data.water_freq_amount ?? data.water_freq_value ?? 1) || 1
        setWaterFreqPeriod(period)
          setWaterFreqAmount(amount)

        finalizeAiStatuses({
            scientificName: englishScientificName || resolvedScientificName,
            colors: resolvedColorsString,
            seasons: resolvedSeasons,
            description: englishDescription || resolvedDescription,
            funFact: resolvedFunFact,
            classificationType: resolvedClassificationType,
          })
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
        
      const funFactForTranslation = (meta?.funFact ?? '').trim()
      const meaningForTranslation = meaning.trim()
      const authorNotesRaw = meta?.authorNotes
      const authorNotesForTranslation =
        typeof authorNotesRaw === 'string' ? authorNotesRaw.trim() : undefined
      const sourceReferencesRaw = meta?.sourceReferences
      const sourceReferencesForTranslation = Array.isArray(sourceReferencesRaw)
        ? sourceReferencesRaw
        : undefined
      const metaPayloadForTranslation = (() => {
        if (
          !funFactForTranslation &&
          !authorNotesForTranslation &&
          !sourceReferencesForTranslation
        ) {
          return undefined
        }
        return {
          funFact: funFactForTranslation || undefined,
          authorNotes: authorNotesForTranslation || undefined,
          sourceReferences: sourceReferencesForTranslation || undefined,
        }
      })()
        
      // Get current fields
        const fields = {
        name: name.trim() || undefined,
        scientificName: scientificName.trim() || identifiers?.scientificName || undefined,
          meaning: meaningForTranslation || undefined,
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
          meta: metaPayloadForTranslation,
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
          meaning: translated.meaning || null,
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

    const focusClassificationTab = React.useCallback(() => {
      setClassificationTabSignal((prev) => prev + 1)
    }, [])

    const ensureClassificationValid = () => {
      if (!classification?.type) {
        setError('Please choose a plant type inside the Classification tab.')
        focusClassificationTab()
        return false
      }
      if (classification.type === 'plant' && !classification.subclass) {
        setError('Please select a subclass for plant types.')
        focusClassificationTab()
        return false
      }
      if (classification.subclass === 'vegetable' && !classification.subSubclass) {
        setError('Please select a sub-subclass when subclass is Vegetable.')
        focusClassificationTab()
        return false
      }
      return true
    }

    const save = async () => {
    if (!id) return
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
    if (descriptionWordCount < 10 || descriptionWordCount > 400) {
      setError(`Overview must be between 10 and 400 words (currently ${descriptionWordCount}).`)
      return
    }
    const sanitizedPhotos = sanitizePlantPhotos(photos)
    if (sanitizedPhotos.length === 0) {
      setError("Please add at least one photo URL.")
      return
    }
    const primaryImageUrl = getPrimaryPhotoUrl(sanitizedPhotos)
    setPhotos(ensureAtLeastOnePhoto(sanitizedPhotos))
      if (!ensureClassificationValid()) return
    // Validate frequency constraints
    const periodMax: Record<'week'|'month'|'year', number> = { week: 7, month: 4, year: 12 }
    const maxAllowed = periodMax[waterFreqPeriod]
    const normalizedAmount = Math.max(1, Math.min(Number(waterFreqAmount || 1), maxAllowed))
    setSaving(true)
    try {
      const actorLabel = profile?.display_name?.trim() || user?.email?.trim() || user?.id || 'Unknown admin'
      const nowIso = new Date().toISOString()
        const metaBase = meta ?? {}
        const meaningValue = meaning.trim()
        const baseFunFact = typeof metaBase.funFact === 'string' ? metaBase.funFact.trim() : ''
        const funFactText = baseFunFact
        if (funFactText && !isFunFactValid(funFactText)) {
        const sentenceCount = countSentences(funFactText)
        setError(`Fun fact must contain between 1 and 3 sentences (currently ${sentenceCount}).`)
        return
      }
      const metaCreatedAt = typeof metaBase.createdAt === 'string' ? metaBase.createdAt.trim() : ''
      const createdAtValue = metaCreatedAt || initialCreatedAtRef.current || nowIso
      if (!initialCreatedAtRef.current) {
        initialCreatedAtRef.current = createdAtValue
      }
      const metaCreatedBy = typeof metaBase.createdBy === 'string' ? metaBase.createdBy.trim() : ''
      const createdByValue = metaCreatedBy || initialCreatedByRef.current || actorLabel
      if (!initialCreatedByRef.current) {
        initialCreatedByRef.current = createdByValue
      }
      const metaForUpdate: Partial<PlantMeta> = {
        ...metaBase,
        funFact: funFactText || undefined,
        createdAt: createdAtValue,
        updatedAt: nowIso,
        createdBy: createdByValue,
        updatedBy: actorLabel,
      }
      setMeta(metaForUpdate)
        const shouldPersistMeta = Object.values(metaForUpdate).some((value) => {
        if (value === undefined || value === null) return false
        if (typeof value === 'string') return value.trim().length > 0
        if (Array.isArray(value)) return value.length > 0
        return true
      })
        const shouldPersistClassification = hasClassificationData(classification)
      const { error: uerr } = await supabase
        .from('plants')
        .update({
          name: name.trim(),
          // New JSONB structure
            classification: shouldPersistClassification ? classification : null,
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
          meta: shouldPersistMeta ? metaForUpdate : null,
            photos: sanitizedPhotos,
          // Legacy fields for backward compatibility
          scientific_name: trimmedScientificName || identifiers?.scientificName || null,
          colors: normalizedColors,
          seasons,
          rarity: metaForUpdate?.rarity === 'common' ? 'Common' : metaForUpdate?.rarity === 'uncommon' ? 'Uncommon' : metaForUpdate?.rarity === 'rare' ? 'Rare' : metaForUpdate?.rarity === 'very rare' ? 'Legendary' : rarity,
            meaning: meaningValue || null,
          description: description || null,
            image_url: primaryImageUrl || null,
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
        scientificName: identifiers.scientificName || trimmedScientificName || undefined,
          commonNames: identifiers.commonNames || undefined,
        } : undefined,
        ecology: ecology ? {
          wildlifeValue: ecology.wildlifeValue,
        } : undefined,
        usage: usage ? {
          culinaryUses: usage.culinaryUses,
          medicinalUses: usage.medicinalUses,
        } : undefined,
        meta: metaForUpdate ? {
          funFact: metaForUpdate.funFact,
          authorNotes: metaForUpdate.authorNotes,
          sourceReferences: metaForUpdate.sourceReferences,
        } : undefined,
          phenology: translationPhenology,
          care: translationCarePayload,
          planting: translationPlanting,
          problems: translationProblems,
        // Legacy fields for backward compatibility
          scientific_name: trimmedScientificName || identifiers?.scientificName || null,
          meaning: meaningValue || null,
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
                      <Select
                        id="edit-language"
                        className="h-9 flex-1 rounded-md px-3 py-1 text-base md:text-sm"
                        value={editLanguage}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditLanguage(e.target.value as SupportedLanguage)}
                      >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <option key={lang} value={lang}>
                          {lang === 'en' ? 'English' : 'Français'}
                        </option>
                      ))}
                      </Select>
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
                <PlantPhotoListEditor
                  photos={photos}
                  onChange={handlePhotosChange}
                  label={
                    <>
                      {t('createPlant.imageUrl')} <span className="text-red-500">*</span>
                    </>
                  }
                  helperText={t(
                    'createPlant.photosHelper',
                    'Add at least one image URL. Mark one as primary for cards and flag vertical-friendly shots for portrait layouts.'
                  )}
                />
                  {editLanguage === 'en' ? (
                    <>
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
                    </>
                  ) : (
                    <div className="mb-4 rounded-xl border border-dashed border-purple-200 bg-purple-50/50 p-4 text-sm text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-200">
                      Switch the edit language to <span className="font-semibold">English</span> to enable the AI assistant.
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
                    <button type="button" key={s} onClick={() => toggleSeason(s)} className={`px-3 py-1 rounded-2xl text-sm shadow-sm border border-stone-300 dark:border-[#3e3e42] transition ${seasons.includes(s) ? "bg-black dark:bg-white text-white dark:text-black" : "bg-white dark:bg-[#2d2d30] text-black dark:text-white hover:bg-stone-50 dark:hover:bg-[#3e3e42]"}`} aria-pressed={seasons.includes(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-rarity">Rarity</Label>
                  <Select
                    id="plant-rarity"
                    className="h-9 w-full rounded-md px-3 py-1 text-base md:text-sm"
                    value={rarity}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRarity(e.target.value as Plant["rarity"])}
                  >
                    {(["Common", "Uncommon", "Rare", "Legendary"] as const).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plant-meaning">{t('createPlant.meaning')}</Label>
                  <Textarea
                    id="plant-meaning"
                    autoComplete="off"
                    value={meaning}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMeaning(e.target.value)}
                    placeholder={t('createPlant.meaningPlaceholder', 'Describe what this plant represents in rituals, folklore, or symbolism.')}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('createPlant.meaningHelper', 'Highlight cultural symbolism across regions or traditions.')}
                  </p>
                </div>
              <div className="grid gap-2">
                <Label htmlFor="plant-description">Overview</Label>
                <Input id="plant-description" autoComplete="off" value={description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} />
              </div>
                <CompleteAdvancedForm
                  classification={classification}
                  setClassification={setClassification}
                  focusClassificationTabSignal={classificationTabSignal}
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
                    {(aiFilling || aiPanelMessage || aiPanelNotices.length > 0) && (
                      <div className="flex flex-col gap-2 text-sm text-purple-600 dark:text-purple-400">
                        <div className="flex items-center gap-2">
                          {aiFilling ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                          <span>
                            {aiPanelMessage ||
                              (aiFilling
                                ? 'AI is filling in the plant data...'
                                : 'AI fill status updates')}
                          </span>
                        </div>
                        {aiFilling && aiFillProgress.field && !['init', 'complete'].includes(aiFillProgress.field) && (
                          <div className="text-xs font-medium">
                            Working on: <span className="font-semibold">{aiFillProgress.field}</span>
                          </div>
                        )}
                        {aiFilling && (
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
                        )}
                        {aiPanelNotices.length > 0 && (
                          <div className="space-y-1 text-xs">
                            {aiPanelNotices.map((notice) => (
                              <div key={notice}>{notice}</div>
                            ))}
                          </div>
                        )}
                        {aiFilling && (
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
                              setAiPanelMessage('AI fill cancelled.')
                              resetAiTracking()
                            }}
                          >
                            Stop AI fill
                          </Button>
                        )}
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

