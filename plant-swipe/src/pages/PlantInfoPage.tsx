import React from 'react'
import { useParams } from 'react-router-dom'
import { PlantDetails } from '@/components/plant/PlantDetails'
import { DimensionCube } from '@/components/plant/DimensionCube'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { Plant, PlantImage, PlantWateringSchedule, PlantColor, PlantSource } from '@/types/plant'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { useTranslation } from 'react-i18next'
import { useLanguage, useLanguageNavigate } from '@/lib/i18nRouting'
import { usePageMetadata } from '@/hooks/usePageMetadata'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft,
  Pencil,
  MapPin,
  Compass,
  Droplets,
  Sun,
  Leaf,
  Flame,
  Sprout,
  Thermometer,
  Wind,
  Palette,
  Info,
} from 'lucide-react'
import { motion } from 'framer-motion'
import type { TooltipProps } from 'recharts'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts'
import { monthSlugToNumber, monthSlugsToNumbers } from '@/lib/months'
import {
  expandCompositionFromDb,
  expandFoliagePersistanceFromDb,
  plantTypeEnum,
  utilityEnum,
  comestiblePartEnum,
  fruitTypeEnum,
  seasonEnum,
  lifeCycleEnum,
  livingSpaceEnum,
  maintenanceLevelEnum,
  toxicityEnum,
  habitatEnum,
  levelSunEnum,
  wateringTypeEnum,
  divisionEnum,
  soilEnum,
  mulchingEnum,
  nutritionNeedEnum,
  fertilizerEnum,
  sowTypeEnum,
  polenizerEnum,
  conservationStatusEnum,
} from '@/lib/composition'
import worldMapLight from '@/assets/world-map-light.svg'
import worldMapDark from '@/assets/world-map-dark.svg'

type IdentityComposition = NonNullable<Plant["identity"]>["composition"]
type PlantCareData = NonNullable<Plant["plantCare"]>
type PlantGrowthData = NonNullable<Plant["growth"]>
type PlantEcologyData = NonNullable<Plant["ecology"]>

type WaterSchedules = PlantWateringSchedule[]

const TIMELINE_COLORS = {
  flowering: '#f97316',
  fruiting: '#22c55e',
  sowing: '#6366f1',
} as const

const MAP_PIN_POSITIONS = [
  { top: '16%', left: '22%' },
  { top: '32%', left: '48%' },
  { top: '58%', left: '30%' },
  { top: '46%', left: '70%' },
  { top: '68%', left: '55%' },
  { top: '26%', left: '72%' },
] as const

const SECTION_ANIMATION = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.1 },
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const buildTimelineData = (plant: Plant) => {
  const flowering = plant.growth?.floweringMonth || []
  const fruiting = plant.growth?.fruitingMonth || []
  const sowing = plant.growth?.sowingMonth || []
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months.map((label, idx) => ({
    month: label,
    flowering: flowering.includes(idx + 1) ? 1 : 0,
    fruiting: fruiting.includes(idx + 1) ? 1 : 0,
    sowing: sowing.includes(idx + 1) ? 1 : 0,
  }))
}

const normalizeSchedules = (rows?: any[]): WaterSchedules => {
  if (!rows?.length) return []
  return rows.map((row) => ({
    season: row.season || undefined,
    quantity: row.quantity !== null && row.quantity !== undefined ? Number(row.quantity) : undefined,
    timePeriod: row.time_period || undefined,
  }))
}

async function fetchPlantWithRelations(id: string, language?: string): Promise<Plant | null> {
  const { data, error } = await supabase.from('plants').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  
  // Load translation if language is provided
  let translation: any = null
  if (language) {
    const { data: translationData } = await supabase
      .from('plant_translations')
      .select('*')
      .eq('plant_id', id)
      .eq('language', language)
      .maybeSingle()
    translation = translationData || null
  }
  
  const { data: colorLinks } = await supabase.from('plant_colors').select('color_id, colors:color_id (id,name,hex_code)').eq('plant_id', id)
  const { data: images } = await supabase.from('plant_images').select('id,link,use').eq('plant_id', id)
  const { data: schedules } = await supabase.from('plant_watering_schedules').select('season,quantity,time_period').eq('plant_id', id)
  const { data: sources } = await supabase.from('plant_sources').select('id,name,url').eq('plant_id', id)
  const { data: infusionMixRows } = await supabase.from('plant_infusion_mixes').select('mix_name,benefit').eq('plant_id', id)
  const colors = (colorLinks || []).map((c: any) => ({ id: c.colors?.id, name: c.colors?.name, hexCode: c.colors?.hex_code }))
  const infusionMix = (infusionMixRows || []).reduce((acc: Record<string, string>, row: any) => {
    if (row?.mix_name) acc[row.mix_name] = row?.benefit || ''
    return acc
  }, {})
  const sourceList = (sources || []).map((s) => ({ id: s.id, name: s.name, url: s.url }))
  if (!sourceList.length && ((translation?.source_name || data.source_name) || (translation?.source_url || data.source_url))) {
    sourceList.push({ 
      id: `${data.id}-legacy-source`, 
      name: translation?.source_name || data.source_name || 'Source', 
      url: translation?.source_url || data.source_url || undefined 
    })
  }
    return {
      id: data.id,
      name: translation?.name || data.name,
      plantType: (plantTypeEnum.toUi(data.plant_type) as Plant["plantType"]) || undefined,
      utility: utilityEnum.toUiArray(data.utility) as Plant["utility"],
      comestiblePart: comestiblePartEnum.toUiArray(data.comestible_part) as Plant["comestiblePart"],
      fruitType: fruitTypeEnum.toUiArray(data.fruit_type) as Plant["fruitType"],
    identity: {
      givenNames: translation?.given_names || data.given_names || [],
      scientificName: translation?.scientific_name || data.scientific_name || undefined,
      family: translation?.family || data.family || undefined,
        overview: translation?.overview || data.overview || undefined,
        promotionMonth: monthSlugToNumber(translation?.promotion_month || data.promotion_month) ?? undefined,
        lifeCycle: (lifeCycleEnum.toUi(translation?.life_cycle || data.life_cycle) as NonNullable<Plant["identity"]>["lifeCycle"]) || undefined,
        season: seasonEnum.toUiArray(translation?.season || data.season) as NonNullable<Plant["identity"]>["season"],
        foliagePersistance: expandFoliagePersistanceFromDb(translation?.foliage_persistance || data.foliage_persistance),
      spiked: data.spiked || false,
        toxicityHuman: (toxicityEnum.toUi(translation?.toxicity_human || data.toxicity_human) as NonNullable<Plant["identity"]>["toxicityHuman"]) || undefined,
        toxicityPets: (toxicityEnum.toUi(translation?.toxicity_pets || data.toxicity_pets) as NonNullable<Plant["identity"]>["toxicityPets"]) || undefined,
      allergens: translation?.allergens || data.allergens || [],
      scent: data.scent || false,
        symbolism: translation?.symbolism || data.symbolism || [],
        livingSpace: (livingSpaceEnum.toUi(translation?.living_space || data.living_space) as NonNullable<Plant["identity"]>["livingSpace"]) || undefined,
        composition: expandCompositionFromDb(translation?.composition || data.composition) as IdentityComposition,
        maintenanceLevel: (maintenanceLevelEnum.toUi(translation?.maintenance_level || data.maintenance_level) as NonNullable<Plant["identity"]>["maintenanceLevel"]) || undefined,
      multicolor: data.multicolor || false,
      bicolor: data.bicolor || false,
      colors,
    },
      plantCare: {
        origin: translation?.origin || data.origin || [],
        habitat: habitatEnum.toUiArray(translation?.habitat || data.habitat) as PlantCareData["habitat"],
        temperatureMax: data.temperature_max || undefined,
        temperatureMin: data.temperature_min || undefined,
        temperatureIdeal: data.temperature_ideal || undefined,
        levelSun: (levelSunEnum.toUi(translation?.level_sun || data.level_sun) as PlantCareData["levelSun"]) || undefined,
        hygrometry: data.hygrometry || undefined,
        wateringType: wateringTypeEnum.toUiArray(data.watering_type) as PlantCareData["wateringType"],
        division: divisionEnum.toUiArray(data.division) as PlantCareData["division"],
        soil: soilEnum.toUiArray(data.soil) as PlantCareData["soil"],
        adviceSoil: translation?.advice_soil || data.advice_soil || undefined,
        mulching: mulchingEnum.toUiArray(data.mulching) as PlantCareData["mulching"],
        adviceMulching: translation?.advice_mulching || data.advice_mulching || undefined,
        nutritionNeed: nutritionNeedEnum.toUiArray(data.nutrition_need) as PlantCareData["nutritionNeed"],
        fertilizer: fertilizerEnum.toUiArray(data.fertilizer) as PlantCareData["fertilizer"],
        adviceFertilizer: translation?.advice_fertilizer || data.advice_fertilizer || undefined,
      watering: {
        schedules: normalizeSchedules(schedules || []),
      },
    },
      growth: {
        sowingMonth: monthSlugsToNumbers(data.sowing_month),
        floweringMonth: monthSlugsToNumbers(data.flowering_month),
        fruitingMonth: monthSlugsToNumbers(data.fruiting_month),
        height: data.height_cm || undefined,
        wingspan: data.wingspan_cm || undefined,
        tutoring: data.tutoring || false,
        adviceTutoring: translation?.advice_tutoring || data.advice_tutoring || undefined,
        sowType: sowTypeEnum.toUiArray(data.sow_type) as PlantGrowthData["sowType"],
        separation: data.separation_cm || undefined,
        transplanting: data.transplanting || undefined,
        adviceSowing: translation?.advice_sowing || data.advice_sowing || undefined,
        cut: translation?.cut || data.cut || undefined,
      },
    usage: {
      adviceMedicinal: translation?.advice_medicinal || data.advice_medicinal || undefined,
      nutritionalIntake: translation?.nutritional_intake || data.nutritional_intake || [],
      infusion: data.infusion || false,
      adviceInfusion: translation?.advice_infusion || data.advice_infusion || undefined,
      infusionMix,
      recipesIdeas: translation?.recipes_ideas || data.recipes_ideas || [],
      aromatherapy: data.aromatherapy || false,
      spiceMixes: data.spice_mixes || [],
    },
      ecology: {
        melliferous: data.melliferous || false,
        polenizer: polenizerEnum.toUiArray(data.polenizer) as PlantEcologyData["polenizer"],
        beFertilizer: data.be_fertilizer || false,
        groundEffect: translation?.ground_effect || data.ground_effect || undefined,
        conservationStatus: (conservationStatusEnum.toUi(data.conservation_status) as PlantEcologyData["conservationStatus"]) || undefined,
      },
    danger: { pests: data.pests || [], diseases: data.diseases || [] },
    miscellaneous: {
      companions: data.companions || [],
      tags: translation?.tags || data.tags || [],
      sources: sourceList,
    },
    meta: {
      status: data.status || undefined,
      adminCommentary: translation?.admin_commentary || data.admin_commentary || undefined,
      createdBy: data.created_by || undefined,
      createdTime: data.created_time || undefined,
      updatedBy: data.updated_by || undefined,
      updatedTime: data.updated_time || undefined,
    },
      multicolor: data.multicolor || false,
      bicolor: data.bicolor || false,
      seasons: seasonEnum.toUiArray(translation?.season || data.season) as Plant['seasons'],
    description: translation?.overview || data.overview || undefined,
    images: (images as PlantImage[]) || [],
  }
}

const PlantInfoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useLanguageNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const { t } = useTranslation('common')
  const currentLang = useLanguage()
  const [plant, setPlant] = React.useState<Plant | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [likedIds, setLikedIds] = React.useState<string[]>([])

  const fallbackTitle = t('seo.plant.fallbackTitle', { defaultValue: 'Plant encyclopedia entry' })
  const fallbackDescription = t('seo.plant.fallbackDescription', {
    defaultValue: 'Explore care notes, traits, and lore for every species in Aphylia.',
  })
  const resolvedTitle = plant?.name
    ? t('seo.plant.title', { name: plant.name, defaultValue: `${plant.name} plant profile` })
    : fallbackTitle
  const plantDescription = plant?.description || plant?.identity?.overview
  const resolvedDescription =
    plantDescription ||
    (plant?.name
      ? t('seo.plant.missingDescription', {
          name: plant.name,
          defaultValue: `${plant.name} care tips, meaning, and highlights.`,
        })
      : fallbackDescription)
  usePageMetadata({ title: resolvedTitle, description: resolvedDescription })

  React.useEffect(() => {
    const arr = Array.isArray((profile as any)?.liked_plant_ids)
      ? ((profile as any).liked_plant_ids as any[]).map(String)
      : []
    setLikedIds(arr)
  }, [profile?.liked_plant_ids])

  React.useEffect(() => {
    let ignore = false
    const load = async () => {
      if (!id) { setLoading(false); return }
      setLoading(true)
      setError(null)
      try {
        const record = await fetchPlantWithRelations(id, currentLang)
        if (!ignore) setPlant(record)
      } catch (e: any) {
        if (!ignore) setError(e?.message || t('plantInfo.failedToLoad'))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [id, currentLang])

  const toggleLiked = async () => {
    if (!user?.id || !id) return
    setLikedIds((prev) => {
      const has = prev.includes(id)
      const next = has ? prev.filter((x) => x !== id) : [...prev, id]
      ;(async () => {
        try {
          const { error } = await supabase.from('profiles').update({ liked_plant_ids: next }).eq('id', user.id)
          if (error) setLikedIds(prev)
          else refreshProfile().catch(() => {})
        } catch {
          setLikedIds(prev)
        }
      })()
      return next
    })
  }

  const handleGoBack = React.useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 2) {
      navigate(-1)
    } else {
      navigate('/search')
    }
  }, [navigate])

  const handleEdit = () => {
    if (!plant) return
    navigate(`/plants/${plant.id}/edit`)
  }

  if (loading) return <div className="max-w-4xl mx-auto mt-8 px-4">{t('common.loading')}</div>
  if (error) return <div className="max-w-4xl mx-auto mt-8 px-4 text-red-600 text-sm">{error}</div>
  if (!plant) return <div className="max-w-4xl mx-auto mt-8 px-4">{t('plantInfo.plantNotFound')}</div>

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pt-4 sm:pt-5 pb-12 sm:pb-14 space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-between">
        <Button
          type="button"
          variant="ghost"
          className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm shadow-sm dark:border-[#1d1d1f] dark:bg-[#141417]"
          onClick={handleGoBack}
        >
          <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          {t('common.back', { defaultValue: 'Back' })}
        </Button>
        {profile?.is_admin && plant && (
          <Button
            type="button"
            variant="outline"
            className="flex items-center gap-2 rounded-2xl border-emerald-200 bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm shadow-sm dark:border-emerald-500/60 dark:bg-transparent"
            onClick={handleEdit}
          >
            <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {t('common.edit', { defaultValue: 'Edit' })}
          </Button>
        )}
      </div>
      <PlantDetails plant={plant} liked={likedIds.includes(plant.id)} onToggleLike={toggleLiked} />
      <MoreInformationSection plant={plant} />
    </div>
  )
}

const MoreInformationSection: React.FC<{ plant: Plant }> = ({ plant }) => {
  const timelineData = React.useMemo(() => buildTimelineData(plant), [plant])
  const height = plant.growth?.height ?? null
  const wingspan = plant.growth?.wingspan ?? null
  const spacing = plant.growth?.separation ?? null
  const primaryDimension = Math.max(height ?? 0, wingspan ?? 0, spacing ?? 0, 30)
  const cubeScale = React.useMemo(() => {
    const maxReference = Math.max(primaryDimension, 120)
    const baseScale = 0.45 + (primaryDimension / maxReference) * 0.55
    return clamp(baseScale, 0.35, 1.08) * 1.45
  }, [primaryDimension])
    const dimensionLegend = [
      { label: 'Height', value: height ? `${height} cm` : '—', subLabel: 'Vertical growth' },
      { label: 'Spread', value: wingspan ? `${wingspan} cm` : '—', subLabel: 'Canopy reach' },
      { label: 'Spacing', value: spacing ? `${spacing} cm` : '—', subLabel: 'Garden spacing' },
    ]
    const habitats = plant.plantCare?.habitat || []
  const activePins = habitats.slice(0, MAP_PIN_POSITIONS.length).map((label, idx) => ({
    ...MAP_PIN_POSITIONS[idx],
    label,
  }))
  const climateBadges = [
    plant.identity?.livingSpace,
    plant.plantCare?.levelSun,
    plant.ecology?.conservationStatus,
  ].filter(Boolean) as string[]
  const highlightBadges = [
    plant.identity?.livingSpace,
    plant.plantCare?.levelSun,
    plant.utility?.[0],
    plant.identity?.season?.slice(0, 2).join(' • '),
  ].filter(Boolean) as string[]
    const palette = plant.identity?.colors?.length ? plant.identity.colors : []
    const showPalette = palette.length > 0
    const dimensionColClass = showPalette ? 'col-span-1' : 'col-span-2'
    const timelineColClass = showPalette ? 'col-span-2 lg:col-span-1' : 'col-span-2 lg:col-span-2'
    const formatWaterPlans = (schedules: PlantWateringSchedule[] = []) => {
      if (!schedules.length) return 'Flexible'
      return schedules
        .map((schedule) => {
          const season = schedule.season ? `${schedule.season}: ` : ''
          const quantity = schedule.quantity ? `${schedule.quantity}` : ''
          const period = schedule.timePeriod ? ` / ${schedule.timePeriod}` : ''
          return `${season}${quantity}${period}`.trim() || 'Scheduled'
        })
        .join(' • ')
    }
      const identity = plant.identity ?? {}
      const plantCare = plant.plantCare ?? {}
      const growth = plant.growth ?? {}
      const usage = plant.usage ?? {}
      const ecology = plant.ecology ?? {}
      const danger = plant.danger ?? {}
      const misc = plant.miscellaneous ?? {}
      const meta = plant.meta ?? {}
      const soilList = compactStrings(plantCare.soil as string[] | undefined)
      const originList = compactStrings(plantCare.origin)
      const wateringTypeList = compactStrings(plantCare.wateringType as string[] | undefined)
      const divisionList = compactStrings(plantCare.division as string[] | undefined)
      const nutritionNeeds = compactStrings(plantCare.nutritionNeed as string[] | undefined)
      const fertilizerList = compactStrings(plantCare.fertilizer as string[] | undefined)
      const mulchingMaterial = formatTextValue(
        typeof plantCare.mulching === 'string' ? plantCare.mulching : plantCare.mulching?.material,
      )
      const comestiblePartList = compactStrings(plant.comestiblePart as string[] | undefined)
      const fruitTypeList = compactStrings(plant.fruitType as string[] | undefined)
      const utilityList = compactStrings(plant.utility as string[] | undefined)
      const sowTypeList = compactStrings(growth.sowType as string[] | undefined)
      const pollenizerList = compactStrings(ecology.polenizer as string[] | undefined)
      const companions = compactStrings(misc.companions)
      const tagList = compactStrings(misc.tags)
      const pestList = compactStrings(danger.pests)
      const diseaseList = compactStrings(danger.diseases)
      const symbolismList = compactStrings(identity.symbolism)
      const allergenList = compactStrings(identity.allergens)
      const compositionList = compactStrings(identity.composition as string[] | undefined)
      const colorTraitList = [
        (identity.multicolor ?? plant.multicolor) ? 'Multicolor' : null,
        (identity.bicolor ?? plant.bicolor) ? 'Bicolor' : null,
      ].filter(Boolean) as string[]
      const nutritionalList = compactStrings(usage.nutritionalIntake)
      const nutritionalLabel = nutritionalList.length ? nutritionalList.join(' • ') : null
      const spiceMixesList = compactStrings(usage.spiceMixes)
      const spiceMixesLabel = spiceMixesList.length ? spiceMixesList.join(' • ') : null
      const infusionMixSummary = formatInfusionMixSummary(usage.infusionMix)
      const temperatureWindow = formatTemperatureRange(
        plantCare.temperatureMin,
        plantCare.temperatureIdeal,
        plantCare.temperatureMax,
      )
      const humidityValue =
        plantCare.hygrometry !== undefined && plantCare.hygrometry !== null ? `${plantCare.hygrometry}%` : null
      const soilAdvice = formatTextValue(plantCare.adviceSoil)
      const mulchingAdvice = formatTextValue(plantCare.adviceMulching)
      const fertilizerAdvice = formatTextValue(plantCare.adviceFertilizer)
      const medicinalNotes = formatTextValue(usage.adviceMedicinal)
      const infusionNotes = formatTextValue(usage.adviceInfusion)
      const adminCommentary = formatTextValue(meta.adminCommentary)
      const createdTimestamp = formatTimestampDetailed(meta.createdAt ?? meta.createdTime)
      const updatedTimestamp = formatTimestampDetailed(meta.updatedAt ?? meta.updatedTime)
      const createdByLabel = formatTextValue(meta.createdBy)
      const updatedByLabel = formatTextValue(meta.updatedBy)
      const aromaDescriptor = formatBooleanDescriptor(usage.aromatherapy, 'Essential oils', 'Not for oils')
      const infusionDescriptor = formatBooleanDescriptor(usage.infusion, 'Infusion ready', 'Not for infusions')
      const melliferousDescriptor = formatBooleanDescriptor(
        ecology.melliferous,
        'Pollinator magnet',
        'Not melliferous',
      )
      const manureDescriptor = formatBooleanDescriptor(
        ecology.beFertilizer,
        'Feeds neighbors',
        'Neutral ground effect',
      )
      const supportDescriptor = formatBooleanDescriptor(growth.tutoring, 'Needs support', 'Self-supporting')
      const transplantDescriptor = formatBooleanDescriptor(growth.transplanting, 'Transplant recommended', 'No transplant needed')
      const fragranceDescriptor = formatBooleanDescriptor(identity.scent, 'Fragrant', 'Neutral scent')
      const spikedDescriptor = formatBooleanDescriptor(identity.spiked, 'Has thorns', 'Smooth stems')
      const infusionRecipes = formatTextValue(usage.recipesIdeas?.slice(0, 3).join(' • '))
      const habitatLabel = habitats.length ? habitats.join(' • ') : null
      const pollenizerLabel = pollenizerList.length ? pollenizerList.join(' • ') : null
      const nutrientLabel = nutritionNeeds.length ? nutritionNeeds.join(' • ') : null
      const fertilizerLabel = fertilizerList.length ? fertilizerList.join(' • ') : null
      const soilLabel = soilList.length ? soilList.join(', ') : null
      const wateringTypeLabel = wateringTypeList.length ? wateringTypeList.join(' • ') : null
      const divisionLabel = divisionList.length ? divisionList.join(' • ') : null
      const originLabel = originList.length ? originList.join(' • ') : null
      const utilityLabel = utilityList.length ? utilityList.join(' • ') : null
      const sowTypeLabel = sowTypeList.length ? sowTypeList.join(' • ') : null
      const companionsLabel = companions.length ? companions.join(' • ') : null
      const tagLabel = tagList.length ? tagList.join(' • ') : null
      const pestLabel = pestList.length ? pestList.join(' • ') : null
      const diseaseLabel = diseaseList.length ? diseaseList.join(' • ') : null
      const symbolismLabel = symbolismList.length ? symbolismList.join(' • ') : null
      const allergenLabel = allergenList.length ? allergenList.join(' • ') : null
      const compositionLabel = compositionList.length ? compositionList.join(' • ') : null
      const colorTraitLabel = colorTraitList.length ? colorTraitList.join(' • ') : null
      const comestiblePartsLabel = comestiblePartList.length ? comestiblePartList.join(' • ') : null
      const fruitTypeLabel = fruitTypeList.length ? fruitTypeList.join(' • ') : null
      const livingSpaceLabel = identity.livingSpace || null
      const maintenanceLabel =
        identity.maintenanceLevel || plantCare.maintenanceLevel || plant.identity?.maintenanceLevel || null
      const seasonLabel =
        (identity.season && identity.season.length ? identity.season : plant.seasons)?.join(' • ') || null
      const conservationLabel = plant.ecology?.conservationStatus || null
      const identityFamily = formatTextValue(identity.family)
      const lifeCycleLabel = formatTextValue(identity.lifeCycle)
      const foliageLabel = formatTextValue(identity.foliagePersistance)
      const growthCut = formatTextValue(growth.cut)
      const growthSupportNotes = formatTextValue(growth.adviceTutoring)
      const growthSowingNotes = formatTextValue(growth.adviceSowing)
      const groundEffectLabel = formatTextValue(ecology.groundEffect)
    const [hoveredMonth, setHoveredMonth] = React.useState<string | null>(null)

    const handleTimelineHover = React.useCallback((state: { activeLabel?: string | number } | undefined) => {
      if (state?.activeLabel && typeof state.activeLabel === 'string') {
        setHoveredMonth(state.activeLabel)
      } else {
        setHoveredMonth(null)
      }
    }, [])

    const clearTimelineHover = React.useCallback(() => {
      setHoveredMonth(null)
    }, [])

      const careHighlights = filterInfoItems([
        {
          label: 'Water',
          value: formatWaterPlans(plant.plantCare?.watering?.schedules || []),
          icon: <Droplets className="h-3.5 w-3.5" />,
        },
        {
          label: 'Sunlight',
          value: plantCare.levelSun || 'Adaptive',
          icon: <Sun className="h-3.5 w-3.5" />,
        },
        {
          label: 'Soil Mix',
          value: soilLabel || 'Loamy blend',
          icon: <Leaf className="h-3.5 w-3.5" />,
        },
        {
          label: 'Maintenance',
          value: maintenanceLabel,
          icon: <Sprout className="h-3.5 w-3.5" />,
        },
        {
          label: 'Temperature',
          value: temperatureWindow,
          icon: <Thermometer className="h-3.5 w-3.5" />,
        },
        {
          label: 'Humidity',
          value: humidityValue,
          icon: <Droplets className="h-3.5 w-3.5" />,
        },
      ])
      const careDetails = filterInfoItems([
        { label: 'Origin', value: originLabel },
        { label: 'Watering Type', value: wateringTypeLabel },
        { label: 'Division', value: divisionLabel },
        { label: 'Mulching', value: mulchingMaterial },
        { label: 'Nutrition Need', value: nutrientLabel },
        { label: 'Fertilizer', value: fertilizerLabel },
        { label: 'Soil Advice', value: soilAdvice, variant: 'note' },
        { label: 'Mulching Advice', value: mulchingAdvice, variant: 'note' },
        { label: 'Fertilizer Advice', value: fertilizerAdvice, variant: 'note' },
      ])
      const usageFlavor = filterInfoItems([
        {
          label: 'Utility',
          value: utilityLabel || 'Ornamental',
          icon: <Palette className="h-3.5 w-3.5" />,
        },
        { label: 'Comestible Parts', value: comestiblePartsLabel, icon: <Leaf className="h-3.5 w-3.5" /> },
        { label: 'Fruit Type', value: fruitTypeLabel },
        { label: 'Medicinal Notes', value: medicinalNotes, variant: 'note' },
        { label: 'Nutritional Intake', value: nutritionalLabel },
        { label: 'Infusion Friendly', value: infusionDescriptor },
        { label: 'Infusion Notes', value: infusionNotes, variant: 'note' },
        { label: 'Infusion Mix', value: infusionMixSummary, variant: 'note' },
        { label: 'Aromatherapy', value: aromaDescriptor },
        { label: 'Spice Mixes', value: spiceMixesLabel },
        { label: 'Recipes', value: infusionRecipes },
      ])
      const ecologyItems = filterInfoItems([
        { label: 'Habitat', value: habitatLabel || 'Garden adaptable', icon: <MapPin className="h-3.5 w-3.5" /> },
        { label: 'Pollinators', value: pollenizerLabel || 'Bee friendly', icon: <Wind className="h-3.5 w-3.5" /> },
        { label: 'Ground Effect', value: groundEffectLabel, icon: <Sprout className="h-3.5 w-3.5" /> },
        { label: 'Melliferous', value: melliferousDescriptor },
        { label: 'Green Manure', value: manureDescriptor },
        { label: 'Companions', value: companionsLabel },
        { label: 'Tags', value: tagLabel },
      ])
      const identityItems = filterInfoItems([
        { label: 'Family', value: identityFamily },
        { label: 'Life Cycle', value: lifeCycleLabel },
        { label: 'Foliage', value: foliageLabel },
        { label: 'Living Space', value: livingSpaceLabel },
        { label: 'Seasons', value: seasonLabel },
        { label: 'Symbolism', value: symbolismLabel },
        { label: 'Allergens', value: allergenLabel },
        { label: 'Composition Uses', value: compositionLabel },
        { label: 'Color Traits', value: colorTraitLabel },
        { label: 'Fragrance', value: fragranceDescriptor },
        { label: 'Spiked', value: spikedDescriptor },
      ])
      const growthItems = filterInfoItems([
        { label: 'Sow Type', value: sowTypeLabel },
        { label: 'Needs Support', value: supportDescriptor },
        { label: 'Support Notes', value: growthSupportNotes, variant: 'note' },
        { label: 'Transplanting', value: transplantDescriptor },
        { label: 'Sowing Notes', value: growthSowingNotes, variant: 'note' },
        { label: 'Cut Type', value: growthCut },
      ])
      const riskItems = filterInfoItems([
        {
          label: 'Toxicity (Human)',
          value: plant.identity?.toxicityHuman || 'Low',
          icon: <Flame className="h-3.5 w-3.5" />,
        },
        {
          label: 'Toxicity (Pets)',
          value: plant.identity?.toxicityPets || 'Low',
          icon: <Leaf className="h-3.5 w-3.5" />,
        },
        {
          label: 'Conservation',
          value: conservationLabel || 'Stable',
          icon: <Compass className="h-3.5 w-3.5" />,
        },
        { label: 'Pests', value: pestLabel },
        { label: 'Diseases', value: diseaseLabel },
      ])
      const recordItems = filterInfoItems([
        { label: 'Admin Commentary', value: adminCommentary, variant: 'note' },
        { label: 'Created On', value: createdTimestamp },
        { label: 'Created By', value: createdByLabel || 'Not recorded' },
        { label: 'Last Updated On', value: updatedTimestamp },
        { label: 'Last Updated By', value: updatedByLabel || 'Not recorded' },
        { label: 'Sources', value: formatSourcesList(misc.sources) },
      ])
      const infoSections = [
        { title: 'Care Highlights', icon: <Droplets className="h-4 w-4" />, items: careHighlights },
        { title: 'Care Details', icon: <Thermometer className="h-4 w-4" />, items: careDetails },
        { title: 'Usage & Flavor', icon: <Leaf className="h-4 w-4" />, items: usageFlavor },
        { title: 'Ecology', icon: <Sprout className="h-4 w-4" />, items: ecologyItems },
        { title: 'Identity & Traits', icon: <Palette className="h-4 w-4" />, items: identityItems },
        { title: 'Growth & Structure', icon: <Wind className="h-4 w-4" />, items: growthItems },
        { title: 'Risk & Status', icon: <Flame className="h-4 w-4" />, items: riskItems },
        { title: 'Records & Sources', icon: <Compass className="h-4 w-4" />, items: recordItems },
      ].filter((section) => section.items.length > 0)

  return (
    <motion.section
      {...SECTION_ANIMATION}
      transition={{ duration: 0.4 }}
      className="space-y-4 sm:space-y-6"
    >
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <p className="text-[11px] uppercase tracking-[0.45em] text-emerald-500/80">Immersive overview</p>
          <h2 className="text-xl sm:text-2xl font-semibold text-stone-900 dark:text-stone-100">Feel the plant before the paragraphs</h2>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
            Play with the holographic cube, skim the seasonal timeline, and glance at ecology badges—then dive deeper if you want.
          </p>
        </div>
      
        {/* Dynamic Grid Layout */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {(height !== null || wingspan !== null || spacing !== null) && (
            <motion.section
              {...SECTION_ANIMATION}
              transition={{ duration: 0.4, delay: 0.02 }}
              className={`${dimensionColClass} lg:col-span-1 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-50/70 via-white/60 to-white/10 p-3 sm:p-5 dark:border-emerald-500/30 dark:from-emerald-500/10 dark:via-transparent dark:to-transparent`}
            >
              <div className="mb-3 space-y-2">
                <div>
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-emerald-700/70 dark:text-emerald-300/70">
                    3D View
                  </p>
                  <p className="text-base sm:text-lg font-semibold text-stone-900 dark:text-white">Dimensions</p>
                </div>
                {highlightBadges.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {highlightBadges.slice(0, 4).map((badge) => (
                      <Badge
                        key={badge}
                        className="rounded-2xl border border-emerald-300/70 bg-white px-3 py-1 text-xs sm:text-sm font-semibold tracking-wide text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-100 uppercase shadow-sm"
                      >
                        {badge}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-3 sm:gap-4 items-stretch">
                <div className="relative rounded-2xl border border-emerald-100/70 bg-white/80 p-2 sm:p-3 dark:border-emerald-500/30 dark:bg-[#0f1f1f]/60 min-h-[260px]">
                  <DimensionCube scale={cubeScale} className="h-full w-full" />
                </div>
                <div className="flex flex-col gap-2 md:min-h-[260px]">
                  {dimensionLegend.map((item) => (
                    <div key={item.label} className="md:flex-1">
                      <DimensionLegendCard {...item} className="h-full" />
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {palette.length > 0 && (
            <motion.section
              {...SECTION_ANIMATION}
              transition={{ duration: 0.4, delay: 0.08 }}
              className="col-span-1 lg:col-span-1 relative overflow-hidden rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-3 sm:p-4"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,_185,129,_0.12),_transparent_55%)]" />
              <div className="relative space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <Palette className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest">Color Moodboard</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:gap-2">
                  {palette.map((color, idx) => {
                    const colorLabel = color.name || `Color ${idx + 1}`
                    return <ColorSwatchCard key={`${colorLabel}-${idx}`} color={color} />
                  })}
                </div>
              </div>
            </motion.section>
          )}

          <motion.section
            {...SECTION_ANIMATION}
            transition={{ duration: 0.4, delay: 0.1 }}
            className={`${timelineColClass} relative overflow-hidden rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-4 sm:p-6`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,_185,129,_0.12),_transparent_55%)]" />
            <div className="relative space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300">
                  <Wind className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest">Seasonal Timeline</span>
                </div>
                {hoveredMonth ? (
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-200">{hoveredMonth}</span>
                ) : (
                  <span className="text-[10px] uppercase tracking-wide text-stone-400 dark:text-stone-500">Hover a month</span>
                )}
              </div>
              <div className="h-52 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timelineData} stackOffset="expand" onMouseMove={handleTimelineHover} onMouseLeave={clearTimelineHover}>
                    <CartesianGrid stroke="rgba(120,113,108,0.16)" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                    <YAxis hide domain={[0, 3]} />
                    <RechartsTooltip content={<TimelineTooltip />} cursor={{ fill: 'rgba(15,118,110,0.08)' }} />
                    <Bar dataKey="sowing" stackId="timeline" fill={TIMELINE_COLORS.sowing} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="fruiting" stackId="timeline" fill={TIMELINE_COLORS.fruiting} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="flowering" stackId="timeline" fill={TIMELINE_COLORS.flowering} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 sm:gap-4 text-[10px] sm:text-xs text-stone-600 dark:text-stone-400">
                {Object.entries(TIMELINE_COLORS).map(([label, color]) => (
                  <span key={label} className="flex items-center gap-1.5 sm:gap-2">
                    <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                  </span>
                ))}
              </div>
            </div>
          </motion.section>
        </div>

        {/* Habitat Map */}
        {habitats.length > 0 && (
          <motion.section
            {...SECTION_ANIMATION}
            transition={{ duration: 0.4, delay: 0.13 }}
            className="rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-gradient-to-br from-sky-100/80 via-white/80 to-emerald-100/80 p-4 sm:p-6 dark:bg-gradient-to-br dark:from-[#03191b]/90 dark:via-[#04263d]/85 dark:to-[#071321]/90"
          >
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-[10px] sm:text-xs uppercase tracking-widest">Habitat Map</span>
              </div>
              <div className="relative mb-3 sm:mb-4 h-48 sm:h-64 overflow-hidden rounded-2xl sm:rounded-3xl border border-white/60 bg-gradient-to-br from-emerald-200/60 via-sky-100/60 to-emerald-100/60 shadow-inner dark:border-emerald-800/40 dark:bg-gradient-to-br dark:from-[#052c2b]/80 dark:via-[#072c40]/78 dark:to-[#111b2d]/82">
                <img src={worldMapLight} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90 dark:hidden" />
                <img src={worldMapDark} alt="" className="absolute inset-0 hidden h-full w-full object-cover opacity-75 dark:block" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.55),transparent_60%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.45),transparent_65%)] dark:bg-[radial-gradient(circle_at_30%_40%,rgba(16,185,129,0.25),transparent_60%),radial-gradient(circle_at_70%_60%,rgba(14,165,233,0.25),transparent_65%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:32px_32px] sm:bg-[size:48px_48px] dark:bg-[linear-gradient(90deg,rgba(3,37,65,0.5)_1px,transparent_1px),linear-gradient(0deg,rgba(3,37,65,0.5)_1px,transparent_1px)]" />
                {activePins.map((pin) => (
                  <div
                    key={`${pin.label}-${pin.left}-${pin.top}`}
                    className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl bg-white/90 px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium text-stone-800 shadow-md backdrop-blur-md dark:bg-[#2d2d30]/90 dark:text-stone-100"
                    style={{ top: pin.top, left: pin.left }}
                  >
                    <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-500 flex-shrink-0" />
                    <span className="whitespace-nowrap">{pin.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {climateBadges.length ? (
                  climateBadges.map((badge) => (
                    <Badge key={badge} className="rounded-xl sm:rounded-2xl border-none bg-stone-100 dark:bg-[#2d2d30] text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-0.5 sm:py-1">
                      <Compass className="mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      {badge}
                    </Badge>
                  ))
                ) : (
                  <Badge className="rounded-xl sm:rounded-2xl border-none bg-stone-100 dark:bg-[#2d2d30] text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-0.5 sm:py-1">
                    <Compass className="mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    Temperate
                  </Badge>
                )}
              </div>
            </div>
          </motion.section>
        )}

      {/* Info Cards Section - Full width for better mobile experience */}
      <div className="space-y-3 sm:space-y-4">
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          {infoSections.map((section) => (
            <InfoCard key={section.title} title={section.title} icon={section.icon}>
              {section.items.map((item) => (
              <InfoItem
                key={`${section.title}-${item.label}`}
                label={item.label}
                value={item.value || '—'}
                icon={item.icon}
                variant={item.variant}
              />
              ))}
            </InfoCard>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

const TimelineTooltip = (
  props: TooltipProps<number, string> & { payload?: Array<{ payload?: { flowering: number; fruiting: number; sowing: number; month?: string } }> },
) => {
  const { active, payload: tooltipPayload } = props
  const data = tooltipPayload && tooltipPayload.length > 0 ? tooltipPayload[0].payload : null
  if (!active || !data) return null
  const displayLabel = typeof data?.month === 'string' ? data.month : ''
  return (
    <div className="rounded-xl border border-sky-400/30 bg-white/95 px-3 py-2 text-xs text-stone-700 shadow-lg dark:border-sky-500/40 dark:bg-slate-900/95 dark:text-stone-100">
      <p className="text-[11px] uppercase tracking-widest text-emerald-600/75">{displayLabel || '—'}</p>
      <div className="space-y-1 mt-1">
        {Object.entries(data).map(([key, value]) =>
          value ? (
            <div key={key} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TIMELINE_COLORS[key as keyof typeof TIMELINE_COLORS] }} />
              <span className="capitalize">{key}</span>
            </div>
          ) : null,
        )}
      </div>
    </div>
  )
}

const DimensionLegendCard: React.FC<{ label: string; value: string; subLabel: string; className?: string }> = ({
  label,
  value,
  subLabel,
  className,
}) => (
  <div
    className={`rounded-xl border border-emerald-500/30 bg-white/95 px-3.5 sm:px-4 py-2.5 sm:py-3 text-stone-700 shadow-sm backdrop-blur-sm dark:border-emerald-500/40 dark:bg-[#102020]/80 dark:text-emerald-50 ${
      className || ''
    }`}
  >
    <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-200">
      {label}
    </div>
    <div className="text-[11px] sm:text-xs text-emerald-600/80 dark:text-emerald-200/80 mb-1">{subLabel}</div>
    <div className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">{value}</div>
  </div>
)

const InfoCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <Card className="rounded-2xl sm:rounded-3xl h-full border-stone-200/70 dark:border-[#3e3e42]/70">
    <CardHeader className="space-y-2 sm:space-y-3 p-4 sm:p-6">
      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
        <div className="h-3.5 w-3.5 sm:h-4 sm:w-4">{icon}</div>
        <span className="text-[10px] sm:text-xs uppercase tracking-wide">{title}</span>
      </div>
    </CardHeader>
    <CardContent className="space-y-1.5 sm:space-y-2 p-4 sm:p-6 pt-0">{children}</CardContent>
  </Card>
)

const InfoItem: React.FC<{ label: string; value?: React.ReactNode; icon?: React.ReactNode; variant?: 'note' }> = ({
  label,
  value,
  icon,
  variant,
}) => {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' && !value.trim()) return null
    if (variant === 'note') {
      return (
        <div className="py-1 sm:py-1.5">
          <div className="rounded-2xl border border-sky-200/70 bg-sky-50/90 px-3 py-2.5 text-sky-900 shadow-sm dark:border-sky-500/40 dark:bg-[#0f1f28]/70 dark:text-sky-100">
            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-sky-800 dark:text-sky-200">
              <Info className="h-3.5 w-3.5" />
              <span className="tracking-[0.25em]">{label}</span>
            </div>
            <div className="mt-1 text-xs sm:text-sm leading-relaxed text-sky-900 dark:text-sky-100">{value}</div>
          </div>
        </div>
      )
    }
  return (
    <div className="flex items-start gap-2 sm:gap-3 py-1 sm:py-1.5">
      <div className="h-4 w-4 sm:h-5 sm:w-5 rounded-md border border-stone-200 bg-stone-100 flex items-center justify-center flex-shrink-0 mt-0.5 text-stone-600 dark:border-emerald-900/40 dark:bg-[#0f1f28] dark:text-emerald-200">
        {icon || <Thermometer className="h-3 w-3 sm:h-3.5 sm:w-3.5 opacity-70" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] sm:text-xs font-medium text-stone-600 dark:text-stone-400 mb-0.5">{label}</div>
        <div className="text-xs sm:text-sm text-stone-900 dark:text-stone-100 break-words leading-relaxed">{value}</div>
      </div>
    </div>
  )
}

const ColorSwatchCard: React.FC<{ color: PlantColor }> = ({ color }) => {
  const label = color.name || 'Palette'
  const tone = color.hexCode || '#16a34a'
  const category = 'Palette'
  const gradient = `linear-gradient(135deg, ${tone}, ${tone})`
  return (
    <div className="group relative overflow-hidden rounded-md sm:rounded-lg border border-stone-200/60 dark:border-[#3e3e42]/70 bg-white dark:bg-[#2d2d30] p-1 sm:p-1.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-1 sm:mb-1.5 h-8 sm:h-10 w-full rounded-md shadow-inner" style={{ backgroundImage: gradient }} />
      <div className="text-[7px] sm:text-[9px] uppercase tracking-[0.3em] text-stone-500 dark:text-stone-400">{category}</div>
      <div className="text-[10px] sm:text-[11px] font-semibold text-stone-900 dark:text-stone-100 truncate">{label}</div>
    </div>
  )
}

interface InfoItemConfig {
  label: string
  value?: React.ReactNode
  icon?: React.ReactNode
  variant?: 'note'
}

const filterInfoItems = (items: InfoItemConfig[]) =>
  items.filter((item) => {
    if (item.value === undefined || item.value === null) return false
    return typeof item.value === 'string' ? Boolean(item.value.trim()) : true
  })

const NON_VALUE_TOKENS = new Set([
  'none',
  'no',
  'n/a',
  'na',
  'not applicable',
  'not specified',
  'unknown',
  'unspecified',
  'not provided',
  'not available',
  'aucun',
  'aucune',
  'sin datos',
  'none noted',
])

const isMeaningfulString = (value?: string | null) => {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  return !NON_VALUE_TOKENS.has(trimmed.toLowerCase())
}

const formatTextValue = (value?: string | null) => (isMeaningfulString(value) ? value!.trim() : null)

const compactStrings = (values?: (string | null | undefined)[]) => {
  if (!values) return []
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => Boolean(value) && isMeaningfulString(value))
}

const formatBooleanDescriptor = (value: boolean | null | undefined, positive: string, negative: string) => {
  if (value === undefined || value === null) return null
  return value ? positive : negative
}

const formatTemperatureRange = (min?: number | null, ideal?: number | null, max?: number | null) => {
  const parts: string[] = []
  if (typeof min === 'number') parts.push(`${min}°C`)
  if (typeof max === 'number') parts.push(`${max}°C`)
  const range =
    parts.length === 2 ? `${parts[0]} to ${parts[1]}` : parts.length === 1 ? `From ${parts[0]}` : null
  if (typeof ideal === 'number') {
    return range ? `${range} (ideal ${ideal}°C)` : `Ideal ${ideal}°C`
  }
  return range
}

const formatInfusionMixSummary = (mix?: Record<string, string> | null) => {
  if (!mix) return null
  const entries = Object.entries(mix)
    .map(([name, benefit]) => {
      const safeName = formatTextValue(name)
      const safeBenefit = formatTextValue(benefit)
      if (safeName && safeBenefit) return `${safeName}: ${safeBenefit}`
      return safeName || safeBenefit || ''
    })
    .filter(Boolean)
  return entries.length ? entries.join(' • ') : null
}

const formatSourcesList = (sources?: PlantSource[] | null) => {
  const list = (sources ?? []).filter((source): source is PlantSource => Boolean(source?.name))
  if (!list.length) return null
  return (
    <ul className="space-y-1">
      {list.map((source, idx) => (
        <li key={source.id ?? `${source.name}-${idx}`}>
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-600 hover:underline dark:text-emerald-300"
            >
              {source.name}
            </a>
          ) : (
            <span>{source.name}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

const formatTimestampDetailed = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default PlantInfoPage