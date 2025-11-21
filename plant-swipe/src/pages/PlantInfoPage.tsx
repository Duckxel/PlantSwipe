import React from 'react'
import { useParams } from 'react-router-dom'
import { PlantDetails } from '@/components/plant/PlantDetails'
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
import * as THREE from 'three'
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

type MoodboardColor = { label: string; tone: string; category: string }
const DEFAULT_MOODBOARD: MoodboardColor[] = [
  { label: 'Forest Canopy', tone: '#0f172a', category: 'Foliage' },
  { label: 'Morning Dew', tone: '#1d4ed8', category: 'Highlights' },
  { label: 'Soft Petal', tone: '#fb7185', category: 'Accent' },
  { label: 'Moss Floor', tone: '#166534', category: 'Ground' },
  { label: 'Amber Bloom', tone: '#ea580c', category: 'Flower' },
  { label: 'Cloud Haze', tone: '#94a3b8', category: 'Mist' },
]

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

const isPlantColor = (color: PlantColor | MoodboardColor): color is PlantColor => (color as PlantColor).name !== undefined

const normalizeSchedules = (rows?: any[]): WaterSchedules => {
  if (!rows?.length) return []
  return rows.map((row) => ({
    season: row.season || undefined,
    quantity: row.quantity !== null && row.quantity !== undefined ? Number(row.quantity) : undefined,
    timePeriod: row.time_period || undefined,
  }))
}

async function fetchPlantWithRelations(id: string): Promise<Plant | null> {
  const { data, error } = await supabase.from('plants').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
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
  if (!sourceList.length && (data.source_name || data.source_url)) {
    sourceList.push({ id: `${data.id}-legacy-source`, name: data.source_name || 'Source', url: data.source_url || undefined })
  }
    return {
      id: data.id,
      name: data.name,
      plantType: (plantTypeEnum.toUi(data.plant_type) as Plant["plantType"]) || undefined,
      utility: utilityEnum.toUiArray(data.utility) as Plant["utility"],
      comestiblePart: comestiblePartEnum.toUiArray(data.comestible_part) as Plant["comestiblePart"],
      fruitType: fruitTypeEnum.toUiArray(data.fruit_type) as Plant["fruitType"],
    identity: {
      givenNames: data.given_names || [],
      scientificName: data.scientific_name || undefined,
      family: data.family || undefined,
        overview: data.overview || undefined,
        promotionMonth: monthSlugToNumber(data.promotion_month) ?? undefined,
        lifeCycle: (lifeCycleEnum.toUi(data.life_cycle) as NonNullable<Plant["identity"]>["lifeCycle"]) || undefined,
        season: seasonEnum.toUiArray(data.season) as NonNullable<Plant["identity"]>["season"],
        foliagePersistance: expandFoliagePersistanceFromDb(data.foliage_persistance),
      spiked: data.spiked || false,
        toxicityHuman: (toxicityEnum.toUi(data.toxicity_human) as NonNullable<Plant["identity"]>["toxicityHuman"]) || undefined,
        toxicityPets: (toxicityEnum.toUi(data.toxicity_pets) as NonNullable<Plant["identity"]>["toxicityPets"]) || undefined,
      allergens: data.allergens || [],
      scent: data.scent || false,
        symbolism: data.symbolism || [],
        livingSpace: (livingSpaceEnum.toUi(data.living_space) as NonNullable<Plant["identity"]>["livingSpace"]) || undefined,
        composition: expandCompositionFromDb(data.composition) as IdentityComposition,
        maintenanceLevel: (maintenanceLevelEnum.toUi(data.maintenance_level) as NonNullable<Plant["identity"]>["maintenanceLevel"]) || undefined,
      multicolor: data.multicolor || false,
      bicolor: data.bicolor || false,
      colors,
    },
      plantCare: {
        origin: data.origin || [],
        habitat: habitatEnum.toUiArray(data.habitat) as PlantCareData["habitat"],
        temperatureMax: data.temperature_max || undefined,
        temperatureMin: data.temperature_min || undefined,
        temperatureIdeal: data.temperature_ideal || undefined,
        levelSun: (levelSunEnum.toUi(data.level_sun) as PlantCareData["levelSun"]) || undefined,
        hygrometry: data.hygrometry || undefined,
        wateringType: wateringTypeEnum.toUiArray(data.watering_type) as PlantCareData["wateringType"],
        division: divisionEnum.toUiArray(data.division) as PlantCareData["division"],
        soil: soilEnum.toUiArray(data.soil) as PlantCareData["soil"],
        adviceSoil: data.advice_soil || undefined,
        mulching: mulchingEnum.toUiArray(data.mulching) as PlantCareData["mulching"],
        adviceMulching: data.advice_mulching || undefined,
        nutritionNeed: nutritionNeedEnum.toUiArray(data.nutrition_need) as PlantCareData["nutritionNeed"],
        fertilizer: fertilizerEnum.toUiArray(data.fertilizer) as PlantCareData["fertilizer"],
        adviceFertilizer: data.advice_fertilizer || undefined,
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
        adviceTutoring: data.advice_tutoring || undefined,
        sowType: sowTypeEnum.toUiArray(data.sow_type) as PlantGrowthData["sowType"],
        separation: data.separation_cm || undefined,
        transplanting: data.transplanting || undefined,
        adviceSowing: data.advice_sowing || undefined,
        cut: data.cut || undefined,
      },
    usage: {
      adviceMedicinal: data.advice_medicinal || undefined,
      nutritionalIntake: data.nutritional_intake || [],
      infusion: data.infusion || false,
      adviceInfusion: data.advice_infusion || undefined,
      infusionMix,
      recipesIdeas: data.recipes_ideas || [],
      aromatherapy: data.aromatherapy || false,
      spiceMixes: data.spice_mixes || [],
    },
      ecology: {
        melliferous: data.melliferous || false,
        polenizer: polenizerEnum.toUiArray(data.polenizer) as PlantEcologyData["polenizer"],
        beFertilizer: data.be_fertilizer || false,
        groundEffect: data.ground_effect || undefined,
        conservationStatus: (conservationStatusEnum.toUi(data.conservation_status) as PlantEcologyData["conservationStatus"]) || undefined,
      },
    danger: { pests: data.pests || [], diseases: data.diseases || [] },
    miscellaneous: {
      companions: data.companions || [],
      tags: data.tags || [],
      sources: sourceList,
    },
    meta: {
      status: data.status || undefined,
      adminCommentary: data.admin_commentary || undefined,
      createdBy: data.created_by || undefined,
      createdTime: data.created_time || undefined,
      updatedBy: data.updated_by || undefined,
      updatedTime: data.updated_time || undefined,
    },
      multicolor: data.multicolor || false,
      bicolor: data.bicolor || false,
      seasons: seasonEnum.toUiArray(data.season) as Plant['seasons'],
    description: data.overview || undefined,
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
        const record = await fetchPlantWithRelations(id)
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
    <div className="relative min-h-screen bg-gradient-to-b from-emerald-50/70 via-white to-emerald-100/60 dark:from-[#0b1115] dark:via-[#0f151a] dark:to-[#0f1819]">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl dark:bg-emerald-500/15" />
        <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-emerald-100/50 blur-3xl dark:bg-emerald-700/10" />
      </div>
      <div className="relative max-w-6xl mx-auto mt-4 sm:mt-6 px-3 sm:px-4 lg:px-6 pb-12 sm:pb-16 space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-between">
          <Button
              type="button"
            variant="ghost"
            className="flex items-center gap-2 rounded-2xl border border-white/40 bg-white/70 px-3 sm:px-4 py-2 text-xs sm:text-sm shadow-sm dark:border-transparent dark:bg-white/10"
            onClick={handleGoBack}
          >
            <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {t('common.back', { defaultValue: 'Back' })}
          </Button>
            {profile?.is_admin && plant && (
              <Button
                type="button"
                variant="outline"
                className="flex items-center gap-2 rounded-2xl border-emerald-200/60 bg-white/80 px-3 sm:px-4 py-2 text-xs sm:text-sm shadow-sm dark:border-emerald-500/30 dark:bg-[#0d0f15]"
                onClick={handleEdit}
              >
                <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {t('common.edit', { defaultValue: 'Edit' })}
              </Button>
            )}
        </div>
        <PlantDetails
          plant={plant}
          liked={likedIds.includes(plant.id)}
          onToggleLike={toggleLiked}
        />
          <MoreInformationSection plant={plant} />
      </div>
    </div>
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
  const palette = plant.identity?.colors?.length ? plant.identity.colors : DEFAULT_MOODBOARD
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
        { label: 'Companions', value: plant.miscellaneous?.companions?.join(', ') || 'Works well with herbs', icon: <Sprout className="h-3.5 w-3.5" /> },
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
        <h2 className="text-xl sm:text-2xl font-semibold text-stone-900 dark:text-stone-100">More Information</h2>
        <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
          Dive deeper into dimensions, care routines, seasonal rhythms, and ecological context.
        </p>
      </div>
      
      {/* Dimensions Section - Full width for mobile */}
      {(height !== null || wingspan !== null || spacing !== null) && (
        <div className="space-y-3 sm:space-y-4">
          <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-50/70 via-white/60 to-white/10 p-4 sm:p-5 dark:border-emerald-500/30 dark:from-emerald-500/10 dark:via-transparent dark:to-transparent">
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-4 sm:mb-5">
              <div>
                <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-emerald-700/70 dark:text-emerald-300/70">3D Dimensions</p>
                <p className="text-base sm:text-lg font-semibold text-stone-900 dark:text-white">{plant.name}</p>
              </div>
              <Badge className="rounded-full border-none bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100 backdrop-blur-sm text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1">
                <Palette className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5" /> Interactive
              </Badge>
            </div>
            <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1.2fr,0.8fr]">
              <div className="space-y-3 sm:space-y-4 order-2 lg:order-1">
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl sm:rounded-[32px] border border-emerald-500/25 bg-gradient-to-br from-emerald-50/80 via-white/60 to-transparent shadow-[0_18px_50px_rgba(16,185,129,0.2)] dark:border-emerald-500/30 dark:from-emerald-900/30 dark:via-[#0f1f1f]/80 dark:to-transparent">
                  <DimensionCube scale={cubeScale} />
                  <div className="pointer-events-none absolute inset-2 sm:inset-3 rounded-xl sm:rounded-[28px] border border-white/30 dark:border-emerald-500/30" />
                  <div className="pointer-events-none absolute inset-x-4 sm:inset-x-6 bottom-2 sm:bottom-3 h-10 sm:h-14 rounded-full bg-emerald-400/30 blur-3xl" />
                </div>
              </div>
              <div className="grid gap-2.5 sm:gap-3 order-1 lg:order-2">
                {dimensionLegend.map((item) => (
                  <DimensionLegendCard key={item.label} {...item} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">

        {/* Care Chart */}
        <motion.section {...SECTION_ANIMATION} transition={{ duration: 0.4, delay: 0.05 }} className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-4 sm:p-6">
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

        {/* Seasonal Timeline */}
        <motion.section {...SECTION_ANIMATION} transition={{ duration: 0.4, delay: 0.08 }} className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-4 sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,_185,129,_0.12),_transparent_55%)]" />
          <div className="relative space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300">
              <Wind className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-[10px] sm:text-xs uppercase tracking-widest">Seasonal Timeline</span>
            </div>
            <div className="h-48 sm:h-60">
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
          <motion.section {...SECTION_ANIMATION} transition={{ duration: 0.4, delay: 0.11 }} className="rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-gradient-to-br from-sky-100/80 via-white/80 to-emerald-100/80 p-4 sm:p-6 dark:bg-gradient-to-br dark:from-[#03191b]/90 dark:via-[#04263d]/85 dark:to-[#071321]/90">
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
                {climateBadges.length
                  ? climateBadges.map((badge) => (
                      <Badge key={badge} className="rounded-xl sm:rounded-2xl border-none bg-stone-100 dark:bg-[#2d2d30] text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-0.5 sm:py-1">
                        <Compass className="mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        {badge}
                      </Badge>
                    ))
                  : (
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
          <motion.section {...SECTION_ANIMATION} transition={{ duration: 0.4, delay: 0.14 }} className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-4 sm:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,_185,129,_0.12),_transparent_55%)]" />
            <div className="relative space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <Palette className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-[10px] sm:text-xs uppercase tracking-widest">Color Moodboard</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {palette.map((color, idx) => {
                  const colorLabel = isPlantColor(color) ? color.name : color.label
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

const ColorSwatchCard: React.FC<{ color: PlantColor | MoodboardColor }> = ({ color }) => {
  const isPlant = isPlantColor(color)
  const label = isPlant ? color.name || 'Palette' : color.label
  const tone = isPlant ? color.hexCode || '#16a34a' : color.tone
  const category = isPlant ? 'Palette' : color.category
  const gradient = `linear-gradient(135deg, ${tone}, ${tone})`
  return (
    <div className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#2d2d30] p-2.5 sm:p-3 shadow-sm transition hover:-translate-y-0.5 sm:hover:-translate-y-1 hover:shadow-md">
      <div className="mb-2 sm:mb-3 h-12 sm:h-16 w-full rounded-lg sm:rounded-xl shadow-inner" style={{ backgroundImage: gradient }} />
      <div className="text-[9px] sm:text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">{category}</div>
      <div className="text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">{label}</div>
    </div>
  )
}

const DimensionCube: React.FC<{ scale: number }> = ({ scale }) => {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const container = containerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.setSize(container.clientWidth, container.clientWidth)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(4.8, 1.8, 4.8)
    camera.lookAt(new THREE.Vector3(0, 0.6, 0))

    const ambientLight = new THREE.AmbientLight(0xbfffe0, 0.45)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.85)
    directionalLight.position.set(4, 6, 5)
    const pointLight = new THREE.PointLight(0x34d399, 0.8)
    pointLight.position.set(-3, -2, -6)
    scene.add(ambientLight, directionalLight, pointLight)

    const outerGeometry = new THREE.BoxGeometry(scale, scale, scale)
    const outerMaterial = new THREE.MeshStandardMaterial({
      color: 0x031512,
      transparent: true,
      opacity: 0.22,
      metalness: 0.35,
      roughness: 0.55,
      emissive: 0x0d9488,
      emissiveIntensity: 0.65,
    })
    const outerMesh = new THREE.Mesh(outerGeometry, outerMaterial)
    scene.add(outerMesh)

    const outerWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(outerGeometry),
      new THREE.LineBasicMaterial({ color: 0x34f5c6 }),
    )
    scene.add(outerWire)

    const innerWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(scale * 0.7, scale * 0.7, scale * 0.7)),
      new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.8 }),
    )
    scene.add(innerWire)

    const sphereGeometry = new THREE.SphereGeometry(0.05, 16, 16)
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0xa7f3d0,
      transparent: true,
      opacity: 0.9,
    })
    const offsets = [-scale / 2, scale / 2]
    offsets.forEach((x) =>
      offsets.forEach((y) =>
        offsets.forEach((z) => {
          const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
          sphere.position.set(x, y, z)
          scene.add(sphere)
        }),
      ),
    )

    const grid = new THREE.GridHelper(6, 18, 0x34f5c6, 0x0f766e)
    const gridMaterial = grid.material as THREE.Material
    gridMaterial.transparent = true
    gridMaterial.opacity = 0.25
    scene.add(grid)

    const handleResize = () => {
      if (!container) return
      renderer.setSize(container.clientWidth, container.clientWidth)
      camera.aspect = 1
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', handleResize)

    let frameId: number
    let angle = 0
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const animate = () => {
      angle += 0.0012
      camera.position.x = 4.8 * Math.cos(angle)
      camera.position.z = 4.8 * Math.sin(angle)
      camera.lookAt(new THREE.Vector3(0, 0.6, 0))
      outerMesh.rotation.y += 0.0012
      outerWire.rotation.y += 0.0012
      innerWire.rotation.y -= 0.001
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }

    if (prefersReducedMotion) {
      renderer.render(scene, camera)
    } else {
      animate()
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId)
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [scale])

  return <div ref={containerRef} className="relative aspect-square w-full" />
}

