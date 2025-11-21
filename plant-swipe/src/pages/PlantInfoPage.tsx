import React from 'react'
import { useParams } from 'react-router-dom'
import { PlantDetails } from '@/components/plant/PlantDetails'
import { DimensionCube } from '@/components/plant/DimensionCube'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { Plant, PlantImage, PlantWateringSchedule, PlantColor } from '@/types/plant'
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
  Cell,
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

const CARE_BAR_COLORS = ['#16a34a', '#0ea5e9', '#f97316', '#8b5cf6', '#facc15'] as const
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

const mapSunLevel = (value?: string | null) => {
  switch (value?.toLowerCase()) {
    case 'full sun':
      return 5
    case 'partial sun':
      return 4
    case 'shade':
      return 2
    case 'low light':
      return 1.5
    default:
      return 3
  }
}

const mapWaterScore = (schedules: PlantWateringSchedule[]) => {
  if (!schedules.length) return 2.5
  const avg = schedules.reduce((sum, entry) => sum + (entry.quantity ?? 1), 0) / schedules.length
  return clamp(avg + 1.5, 1, 5)
}

const buildCareChartData = (plant: Plant) => {
  const levelSun = plant.plantCare?.levelSun || ''
  const wateringSchedules = plant.plantCare?.watering?.schedules || []
  const soilTypes = plant.plantCare?.soil?.length || 0
  const nutritionNeeds = plant.plantCare?.nutritionNeed?.length || 0
  const careTraits = [
    { key: 'sunlight', label: 'Sunlight', value: mapSunLevel(levelSun) },
    { key: 'water', label: 'Watering', value: mapWaterScore(wateringSchedules) },
    { key: 'soil', label: 'Soil', value: clamp(soilTypes ? 2 + soilTypes * 0.5 : 2, 1, 5) },
    { key: 'nutrition', label: 'Nutrition', value: clamp(2 + nutritionNeeds * 0.3, 1.5, 5) },
    { key: 'climate', label: 'Climate', value: plant.identity?.livingSpace === 'Outdoor' ? 4.5 : 3 },
  ]
  return careTraits.map((item, index) => ({
    ...item,
    color: CARE_BAR_COLORS[index % CARE_BAR_COLORS.length],
  }))
}

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

export const PlantInfoPage: React.FC = () => {
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
    <>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pt-4 sm:pt-6 space-y-4 sm:space-y-5">
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
      </div>

      <div className="max-w-6xl mx-auto mt-4 sm:mt-6 px-3 sm:px-4 lg:px-6 pb-12 sm:pb-16">
        <MoreInformationSection plant={plant} />
      </div>
    </>
  )
}

export default PlantInfoPage

const MoreInformationSection: React.FC<{ plant: Plant }> = ({ plant }) => {
  const careData = React.useMemo(() => buildCareChartData(plant), [plant])
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
  const infoSections = [
    {
      title: 'Care Highlights',
      icon: <Droplets className="h-4 w-4" />,
      items: [
        { label: 'Water', value: `${plant.plantCare?.watering?.schedules?.length || 1} plan(s)`, icon: <Droplets className="h-3.5 w-3.5" /> },
        { label: 'Sunlight', value: plant.plantCare?.levelSun || 'Adaptive', icon: <Sun className="h-3.5 w-3.5" /> },
        { label: 'Soil Mix', value: plant.plantCare?.soil?.join(', ') || 'Loamy blend', icon: <Leaf className="h-3.5 w-3.5" /> },
      ],
    },
    {
      title: 'Usage & Flavor',
      icon: <Leaf className="h-4 w-4" />,
      items: [
        { label: 'Utility', value: plant.utility?.join(', ') || 'Ornamental', icon: <Palette className="h-3.5 w-3.5" /> },
        { label: 'Comestible Parts', value: plant.comestiblePart?.join(', ') || 'Not specified', icon: <Leaf className="h-3.5 w-3.5" /> },
        { label: 'Recipes', value: plant.usage?.recipesIdeas?.slice(0, 2).join(', ') || 'Seasonal teas', icon: <Droplets className="h-3.5 w-3.5" /> },
      ],
    },
    {
      title: 'Ecology',
      icon: <Sprout className="h-4 w-4" />,
      items: [
        { label: 'Habitat', value: habitats.join(', ') || 'Garden adaptable', icon: <MapPin className="h-3.5 w-3.5" /> },
        { label: 'Pollinators', value: plant.ecology?.polenizer?.join(', ') || 'Bee friendly', icon: <Wind className="h-3.5 w-3.5" /> },
        { label: 'Ground Effect', value: plant.ecology?.groundEffect || 'Neutral', icon: <Sprout className="h-3.5 w-3.5" /> },
      ],
    },
    {
      title: 'Risk & Status',
      icon: <Flame className="h-4 w-4" />,
      items: [
        { label: 'Toxicity (Human)', value: plant.identity?.toxicityHuman || 'Low', icon: <Flame className="h-3.5 w-3.5" /> },
        { label: 'Toxicity (Pets)', value: plant.identity?.toxicityPets || 'Low', icon: <Leaf className="h-3.5 w-3.5" /> },
        { label: 'Conservation', value: plant.ecology?.conservationStatus || 'Stable', icon: <Compass className="h-3.5 w-3.5" /> },
      ],
    },
  ]

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
          Play with the holographic cube, skim the care pulse, and glance at ecology badges—then dive deeper if you want.
        </p>
      </div>
      
      {/* Dynamic Grid Layout - More interesting flow */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        
        {/* 3D Dimensions - Compact card in first column */}
        {(height !== null || wingspan !== null || spacing !== null) && (
          <motion.section {...SECTION_ANIMATION} transition={{ duration: 0.4, delay: 0.02 }} className="lg:col-span-1 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-50/70 via-white/60 to-white/10 p-3 sm:p-4 dark:border-emerald-500/30 dark:from-emerald-500/10 dark:via-transparent dark:to-transparent">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl overflow-hidden border border-emerald-500/25 bg-gradient-to-br from-emerald-50/80 via-white/60 to-transparent shadow-sm dark:border-emerald-500/30 dark:from-emerald-900/30 dark:via-[#0f1f1f]/80 dark:to-transparent">
                  <DimensionCube scale={cubeScale} />
                </div>
                <div>
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-emerald-700/70 dark:text-emerald-300/70">3D View</p>
                  <p className="text-[10px] sm:text-xs font-semibold text-stone-900 dark:text-white">Dimensions</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {dimensionLegend.map((item) => (
                <DimensionLegendCard key={item.label} {...item} />
              ))}
            </div>
              {highlightBadges.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {highlightBadges.slice(0, 3).map((badge) => (
                    <Badge key={badge} className="rounded-full border border-emerald-100/60 bg-white/80 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
                      {badge}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-emerald-700/80 dark:text-emerald-200/80">
                Hover, drag, or tap to orbit the cube and understand the plant’s footprint before diving into the details.
              </p>
          </motion.section>
        )}

        {/* Care Chart - Spans 2 columns if dimensions exist, otherwise 3 */}
        <motion.section {...SECTION_ANIMATION} transition={{ duration: 0.4, delay: 0.05 }} className={`${(height !== null || wingspan !== null || spacing !== null) ? 'lg:col-span-2' : 'lg:col-span-3'} relative overflow-hidden rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-4 sm:p-6`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,_185,129,_0.12),_transparent_55%)] dark:bg-[radial-gradient(circle_at_top,_rgba(16,_185,129,_0.18),_transparent_60%)]" />
          <div className="relative space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300">
              <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-[10px] sm:text-xs uppercase tracking-widest">Care Chart</span>
            </div>
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={careData} barCategoryGap="20%" barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,185,129,0.18)" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <YAxis hide domain={[0, 5]} />
                  <RechartsTooltip content={<CareChartTooltip />} cursor={{ fill: 'rgba(16,185,129,0.08)' }} />
                  <Bar dataKey="value" radius={[12, 12, 12, 12]}>
                    {careData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 sm:space-y-3">
              {careData.map((item) => (
                <div key={item.key} className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-stone-600 dark:text-stone-300">
                    <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <span className="font-semibold text-stone-900 dark:text-stone-100 ml-2 flex-shrink-0">{item.value.toFixed(1)} / 5</span>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      </div>

        {/* Second Row - Seasonal Timeline, Habitat Map, Color Moodboard */}
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
          {/* Seasonal Timeline */}
          <motion.section
            {...SECTION_ANIMATION}
            transition={{ duration: 0.4, delay: 0.08 }}
            className={`${palette.length > 0 || habitats.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'} relative overflow-hidden rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-4 sm:p-6`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,_185,129,_0.12),_transparent_55%)]" />
            <div className="relative space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300">
                <Wind className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-[10px] sm:text-xs uppercase tracking-widest">Seasonal Timeline</span>
              </div>
              <div className="h-52 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timelineData} stackOffset="expand">
                    <CartesianGrid stroke="rgba(120,113,108,0.16)" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                    <YAxis hide domain={[0, 3]} />
                    <RechartsTooltip content={<TimelineTooltip />} cursor={{ fill: 'rgba(15,118,110,0.08)' }} />
                    <Bar dataKey="flowering" stackId="timeline" fill={TIMELINE_COLORS.flowering} radius={[8, 8, 0, 0]} />
                    <Bar dataKey="fruiting" stackId="timeline" fill={TIMELINE_COLORS.fruiting} />
                    <Bar dataKey="sowing" stackId="timeline" fill={TIMELINE_COLORS.sowing} />
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

          {/* Habitat Map */}
          {habitats.length > 0 && (
            <motion.section
              {...SECTION_ANIMATION}
              transition={{ duration: 0.4, delay: 0.11 }}
              className="lg:col-span-1 rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-gradient-to-br from-sky-100/80 via-white/80 to-emerald-100/80 p-4 sm:p-6 dark:bg-gradient-to-br dark:from-[#03191b]/90 dark:via-[#04263d]/85 dark:to-[#071321]/90"
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

          {/* Color Moodboard */}
          {palette.length > 0 && (
            <motion.section
              {...SECTION_ANIMATION}
              transition={{ duration: 0.4, delay: 0.14 }}
              className={`${habitats.length > 0 ? 'lg:col-span-1' : 'lg:col-span-3'} relative overflow-hidden rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-3 sm:p-4`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,_185,129,_0.12),_transparent_55%)]" />
              <div className="relative space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <Palette className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest">Color Moodboard</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                  {palette.map((color, idx) => {
                    const colorLabel = color.name || `Color ${idx + 1}`
                    return <ColorSwatchCard key={`${colorLabel}-${idx}`} color={color} />
                  })}
                </div>
              </div>
            </motion.section>
          )}
        </div>

      {/* Info Cards Section - Full width for better mobile experience */}
      <div className="space-y-3 sm:space-y-4">
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          {infoSections.map((section) => (
            <InfoCard key={section.title} title={section.title} icon={section.icon}>
              {section.items.map((item) => (
                <InfoItem key={`${section.title}-${item.label}`} label={item.label} value={item.value || '—'} icon={item.icon} />
              ))}
            </InfoCard>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

const CareChartTooltip = ({ active, payload: tooltipPayload }: TooltipProps<number, string> & { payload?: Array<{ payload?: { label: string; value: number } }> }) => {
  const dataPoint = tooltipPayload && tooltipPayload.length > 0 ? tooltipPayload[0].payload : null
  if (!active || !dataPoint) return null
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-white/95 px-3 py-2 text-sm text-stone-700 shadow-lg dark:border-emerald-600/40 dark:bg-slate-900/95 dark:text-stone-100">
      <div className="text-xs uppercase tracking-widest text-emerald-600/80 dark:text-emerald-300/80">{dataPoint.label}</div>
      <div className="text-sm font-semibold">{dataPoint.value.toFixed(1)} / 5</div>
    </div>
  )
}

const TimelineTooltip = (
  props: TooltipProps<number, string> & { payload?: Array<{ payload?: { flowering: number; fruiting: number; sowing: number; label?: string } }> },
) => {
  const { active, payload: tooltipPayload } = props
  const data = tooltipPayload && tooltipPayload.length > 0 ? tooltipPayload[0].payload : null
  if (!active || !data) return null
  const displayLabel = typeof tooltipPayload?.[0]?.payload?.label === 'string' ? tooltipPayload[0].payload?.label! : ''
  return (
    <div className="rounded-xl border border-sky-400/30 bg-white/95 px-3 py-2 text-xs text-stone-700 shadow-lg dark:border-sky-500/40 dark:bg-slate-900/95 dark:text-stone-100">
      <p className="text-[11px] uppercase tracking-widest text-emerald-600/75">{displayLabel}</p>
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

const DimensionLegendCard: React.FC<{ label: string; value: string; subLabel: string }> = ({ label, value, subLabel }) => (
  <div className="rounded-xl border border-emerald-500/20 bg-white/85 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-stone-700 shadow-sm backdrop-blur-sm dark:border-emerald-500/30 dark:bg-[#0f1f1f]/70 dark:text-emerald-100">
    <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-emerald-600/75">{label}</div>
    <div className="text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100">{value}</div>
    <div className="text-[10px] sm:text-xs text-stone-500 dark:text-stone-400">{subLabel}</div>
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

const InfoItem: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({ label, value, icon }) => (
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

