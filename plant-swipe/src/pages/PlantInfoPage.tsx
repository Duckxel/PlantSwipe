import React from 'react'
import { useParams } from 'react-router-dom'
import { PlantDetails } from '@/components/plant/PlantDetails'
import { DimensionCube } from '@/components/plant/DimensionCube'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PlantInfoPageSkeleton } from '@/components/garden/GardenSkeletons'
import { ProAdviceSection } from '@/components/plant/ProAdviceSection'
import { RecipeBox } from '@/components/plant/RecipeBox'
import type { Plant, PlantImage, PlantRecipe, PlantWateringSchedule, PlantColor, PlantSource } from '@/types/plant'
import { useAuth } from '@/context/AuthContext'
import { useAuthActions } from '@/context/AuthActionsContext'
import { checkEditorAccess, hasAnyRole, USER_ROLES } from '@/constants/userRoles'
import { AddToBookmarkDialog } from '@/components/plant/AddToBookmarkDialog'
import { AddToGardenDialog } from '@/components/plant/AddToGardenDialog'
import { supabase } from '@/lib/supabaseClient'
import { trackImpression, fetchImpression, formatCount } from '@/lib/impressions'
import { getUserBookmarks } from '@/lib/bookmarks'
import { useTranslation } from 'react-i18next'
import { useLanguage, useLanguageNavigate } from '@/lib/i18nRouting'
import { usePageMetadata } from '@/hooks/usePageMetadata'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  Image as ImageIcon,
  RefreshCw,
  Utensils,
  Plus,
  Heart,
  Share2,
  Bookmark,
  AlertTriangle,
  Skull,
  ShieldCheck,
  User,
  PawPrint,
  FlaskConical,
  Clock,
  CalendarDays,
  FileText,
  Wrench,
  ChartNoAxesColumn,
  Flower,
  Flower2,
  Cherry,
  House,
  TreeDeciduous,
} from 'lucide-react'
import { monthSlugToNumber, monthSlugsToNumbers } from '@/lib/months'
import { useImageViewer, ImageViewer } from '@/components/ui/image-viewer'
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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const buildTimelineData = (plant: Plant, monthLabels: string[]) => {
  const flowering = plant.growth?.floweringMonth || []
  const fruiting = plant.growth?.fruitingMonth || []
  const sowing = plant.growth?.sowingMonth || []
  return monthLabels.map((label, idx) => ({
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

// Fast query to check plant status and get basic info for construction banner
// This allows non-privileged users to see the "in construction" message immediately
// without waiting for all the heavy relation queries
async function fetchPlantStatusAndBasicInfo(id: string, language?: string): Promise<{
  exists: boolean
  status?: string
  name?: string
  scientificName?: string
  family?: string
  plantType?: string
  levelSun?: string
  livingSpace?: string
  lifeCycle?: string
  season?: string[]
  maintenanceLevel?: string
  overview?: string
  primaryImage?: string
} | null> {
  const targetLanguage = language || 'en'
  
  // Run all queries in parallel for speed
  const [plantResult, translationResult, imageResult] = await Promise.all([
    supabase
      .from('plants')
      .select('id, name, scientific_name, status, family, plant_type, level_sun, living_space, life_cycle, season, maintenance_level')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('plant_translations')
      .select('name, overview')
      .eq('plant_id', id)
      .eq('language', targetLanguage)
      .maybeSingle(),
    supabase
      .from('plant_images')
      .select('link')
      .eq('plant_id', id)
      .eq('use', 'primary')
      .maybeSingle()
  ])
  
  if (plantResult.error || !plantResult.data) return null
  
  const data = plantResult.data
  
  return {
    exists: true,
    status: data.status || undefined,
    name: translationResult.data?.name || data.name,
    scientificName: data.scientific_name || undefined,
    family: data.family || undefined,
    plantType: plantTypeEnum.toUi(data.plant_type) || undefined,
    levelSun: levelSunEnum.toUi(data.level_sun) || undefined,
    livingSpace: livingSpaceEnum.toUi(data.living_space) || undefined,
    lifeCycle: lifeCycleEnum.toUi(data.life_cycle) || undefined,
    season: seasonEnum.toUiArray(data.season) || undefined,
    maintenanceLevel: maintenanceLevelEnum.toUi(data.maintenance_level) || undefined,
    overview: translationResult.data?.overview || undefined,
    primaryImage: imageResult.data?.link || undefined,
  }
}

async function fetchPlantWithRelations(id: string, language?: string): Promise<Plant | null> {
  const { data, error } = await supabase.from('plants').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  
  // All translatable fields are stored in plant_translations for ALL languages (including English)
  // Load translation for the requested language
  const targetLanguage = language || 'en'
  
  // Run all independent queries in parallel for faster loading
  const [
    translationResult,
    colorLinksResult,
    imagesResult,
    schedulesResult,
    sourcesResult,
    infusionMixResult,
    contributorsResult,
    recipesResult,
  ] = await Promise.all([
    supabase
      .from('plant_translations')
      .select('*')
      .eq('plant_id', id)
      .eq('language', targetLanguage)
      .maybeSingle(),
    supabase.from('plant_colors').select('color_id, colors:color_id (id,name,hex_code)').eq('plant_id', id),
    supabase.from('plant_images').select('id,link,use').eq('plant_id', id),
    supabase.from('plant_watering_schedules').select('season,quantity,time_period').eq('plant_id', id),
    supabase.from('plant_sources').select('id,name,url').eq('plant_id', id),
    supabase.from('plant_infusion_mixes').select('mix_name,benefit').eq('plant_id', id),
    supabase.from('plant_contributors').select('contributor_name').eq('plant_id', id),
    supabase.from('plant_recipes').select('id,name,name_fr,category,time,link').eq('plant_id', id),
  ])
  
  const translation = translationResult.data || null
  const colorLinks = colorLinksResult.data
  const images = imagesResult.data
  const schedules = schedulesResult.data
  const sources = sourcesResult.data
  const infusionMixRows = infusionMixResult.data
  const contributorRows = contributorsResult.data
  const recipeRows = recipesResult?.data
  
  // Fetch color translations for the target language (depends on colorLinks result)
  const colorIds = (colorLinks || []).map((c: any) => c.colors?.id).filter(Boolean)
  let colorTranslationsMap: Record<string, string> = {}
  if (colorIds.length > 0) {
    const { data: colorTranslations } = await supabase
      .from('color_translations')
      .select('color_id, name')
      .eq('language', targetLanguage)
      .in('color_id', colorIds)
    if (colorTranslations) {
      colorTranslationsMap = colorTranslations.reduce((acc: Record<string, string>, t: { color_id: string; name: string }) => {
        acc[t.color_id] = t.name
        return acc
      }, {})
    }
  }
  
  const colors = (colorLinks || []).map((c: any) => ({
    id: c.colors?.id,
    name: colorTranslationsMap[c.colors?.id] || c.colors?.name,
    hexCode: c.colors?.hex_code
  }))
  const infusionMix = (infusionMixRows || []).reduce((acc: Record<string, string>, row: any) => {
    if (row?.mix_name) acc[row.mix_name] = row?.benefit || ''
    return acc
  }, {})
  const sourceList = (sources || []).map((s) => ({ id: s.id, name: s.name, url: s.url }))
  if (!sourceList.length && (translation?.source_name || translation?.source_url)) {
    sourceList.push({ 
      id: `${data.id}-legacy-source`, 
      name: translation?.source_name || 'Source', 
      url: translation?.source_url || undefined 
    })
  }
  // All translatable fields come from plant_translations ONLY (plants table no longer has them)
  return {
    id: data.id,
    name: translation?.name || data.name,
    // Non-translatable fields from plants table
    plantType: (plantTypeEnum.toUi(data.plant_type) as Plant["plantType"]) || undefined,
    utility: utilityEnum.toUiArray(data.utility) as Plant["utility"],
    comestiblePart: comestiblePartEnum.toUiArray(data.comestible_part) as Plant["comestiblePart"],
    fruitType: fruitTypeEnum.toUiArray(data.fruit_type) as Plant["fruitType"],
    identity: {
      // Translatable fields from plant_translations only
      givenNames: translation?.given_names || [],
      // Non-translatable fields from plants table
      scientificName: data.scientific_name || undefined,
      family: data.family || undefined,
      // Translatable field from plant_translations
      overview: translation?.overview || undefined,
      // Non-translatable fields from plants table (enums)
      promotionMonth: monthSlugToNumber(data.promotion_month) ?? undefined,
      lifeCycle: (lifeCycleEnum.toUi(data.life_cycle) as NonNullable<Plant["identity"]>["lifeCycle"]) || undefined,
      season: seasonEnum.toUiArray(data.season) as NonNullable<Plant["identity"]>["season"],
      foliagePersistance: expandFoliagePersistanceFromDb(data.foliage_persistance),
      spiked: data.spiked || false,
      toxicityHuman: (toxicityEnum.toUi(data.toxicity_human) as NonNullable<Plant["identity"]>["toxicityHuman"]) || undefined,
      toxicityPets: (toxicityEnum.toUi(data.toxicity_pets) as NonNullable<Plant["identity"]>["toxicityPets"]) || undefined,
      // Translatable fields from plant_translations only
      allergens: translation?.allergens || [],
      // Non-translatable fields from plants table
      scent: data.scent || false,
      // Translatable fields from plant_translations only
      symbolism: translation?.symbolism || [],
      // Non-translatable fields from plants table (enums)
      livingSpace: (livingSpaceEnum.toUi(data.living_space) as NonNullable<Plant["identity"]>["livingSpace"]) || undefined,
      composition: expandCompositionFromDb(data.composition) as IdentityComposition,
      maintenanceLevel: (maintenanceLevelEnum.toUi(data.maintenance_level) as NonNullable<Plant["identity"]>["maintenanceLevel"]) || undefined,
      multicolor: data.multicolor || false,
      bicolor: data.bicolor || false,
      colors,
    },
    plantCare: {
      // Translatable fields from plant_translations only
      origin: translation?.origin || [],
      // Non-translatable fields from plants table
      habitat: habitatEnum.toUiArray(data.habitat) as PlantCareData["habitat"],
      temperatureMax: data.temperature_max || undefined,
      temperatureMin: data.temperature_min || undefined,
      temperatureIdeal: data.temperature_ideal || undefined,
      // Non-translatable field from plants table
      levelSun: (levelSunEnum.toUi(data.level_sun) as PlantCareData["levelSun"]) || undefined,
      hygrometry: data.hygrometry || undefined,
      wateringType: wateringTypeEnum.toUiArray(data.watering_type) as PlantCareData["wateringType"],
      division: divisionEnum.toUiArray(data.division) as PlantCareData["division"],
      soil: soilEnum.toUiArray(data.soil) as PlantCareData["soil"],
      // Translatable fields from plant_translations only
      adviceSoil: translation?.advice_soil || undefined,
      // Non-translatable fields from plants table
      mulching: mulchingEnum.toUiArray(data.mulching) as unknown as PlantCareData["mulching"],
      // Translatable fields from plant_translations only
      adviceMulching: translation?.advice_mulching || undefined,
      // Non-translatable fields from plants table
      nutritionNeed: nutritionNeedEnum.toUiArray(data.nutrition_need) as PlantCareData["nutritionNeed"],
      fertilizer: fertilizerEnum.toUiArray(data.fertilizer) as PlantCareData["fertilizer"],
      // Translatable fields from plant_translations only
      adviceFertilizer: translation?.advice_fertilizer || undefined,
      watering: {
        schedules: normalizeSchedules(schedules || []),
      },
    },
    growth: {
      // Non-translatable fields from plants table
      sowingMonth: monthSlugsToNumbers(data.sowing_month),
      floweringMonth: monthSlugsToNumbers(data.flowering_month),
      fruitingMonth: monthSlugsToNumbers(data.fruiting_month),
      height: data.height_cm || undefined,
      wingspan: data.wingspan_cm || undefined,
      tutoring: data.tutoring || false,
      // Translatable fields from plant_translations only
      adviceTutoring: translation?.advice_tutoring || undefined,
      // Non-translatable fields from plants table
      sowType: sowTypeEnum.toUiArray(data.sow_type) as PlantGrowthData["sowType"],
      separation: data.separation_cm || undefined,
      transplanting: data.transplanting || undefined,
      // Translatable fields from plant_translations only
      adviceSowing: translation?.advice_sowing || undefined,
      cut: translation?.cut || undefined,
    },
    usage: {
      // Translatable fields from plant_translations only
      adviceMedicinal: translation?.advice_medicinal || undefined,
      nutritionalIntake: translation?.nutritional_intake || [],
      // Non-translatable fields from plants table
      infusion: data.infusion || false,
      // Translatable fields from plant_translations only
      adviceInfusion: translation?.advice_infusion || undefined,
      infusionMix,
      recipesIdeas: translation?.recipes_ideas || [],
      // Structured recipes from plant_recipes table
      recipes: (recipeRows || []).map((r: any) => {
        const localizedName = targetLanguage !== 'en' && r[`name_${targetLanguage}`]
          ? r[`name_${targetLanguage}`]
          : r.name
        return {
          id: r.id,
          name: localizedName || r.name || '',
          name_fr: r.name_fr || undefined,
          category: r.category || 'other',
          time: r.time || 'undefined',
          link: r.link || undefined,
        }
      }),
      // Non-translatable fields from plants table
      aromatherapy: data.aromatherapy || false,
      spiceMixes: data.spice_mixes || [],
    },
    ecology: {
      // Non-translatable fields from plants table
      melliferous: data.melliferous || false,
      polenizer: polenizerEnum.toUiArray(data.polenizer) as PlantEcologyData["polenizer"],
      beFertilizer: data.be_fertilizer || false,
      // Translatable fields from plant_translations only
      groundEffect: translation?.ground_effect || undefined,
      // Non-translatable fields from plants table
      conservationStatus: (conservationStatusEnum.toUi(data.conservation_status) as PlantEcologyData["conservationStatus"]) || undefined,
    },
    danger: { pests: data.pests || [], diseases: data.diseases || [] },
    miscellaneous: {
      companions: data.companions || [],
      // Translatable fields from plant_translations only
      tags: translation?.tags || [],
      sources: sourceList,
    },
    meta: {
      status: data.status || undefined,
      adminCommentary: data.admin_commentary || undefined,
      contributors: (contributorRows || [])
        .map((row: any) => row?.contributor_name)
        .filter((name: any) => typeof name === 'string' && name.trim()),
      createdBy: data.created_by || undefined,
      createdTime: data.created_time || undefined,
      updatedBy: data.updated_by || undefined,
      updatedTime: data.updated_time || undefined,
    },
    // Non-translatable fields from plants table
    multicolor: data.multicolor || false,
    bicolor: data.bicolor || false,
    // Non-translatable field from plants table
    seasons: seasonEnum.toUiArray(data.season) as Plant['seasons'],
    description: translation?.overview || undefined,
    images: (images as PlantImage[]) || [],
  }
}

const PlantInfoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useLanguageNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const { openLogin } = useAuthActions()
  const { t } = useTranslation('common')
  const currentLang = useLanguage()
  const [plant, setPlant] = React.useState<Plant | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [likedIds, setLikedIds] = React.useState<string[]>([])
  const [bookmarkOpen, setBookmarkOpen] = React.useState(false)
  const [isBookmarked, setIsBookmarked] = React.useState(false)
  const [gardenOpen, setGardenOpen] = React.useState(false)
  const [shareStatus, setShareStatus] = React.useState<'idle' | 'copied' | 'shared' | 'error'>('idle')
  // For fast-path: show construction banner immediately for non-privileged users
  const [limitedPlantInfo, setLimitedPlantInfo] = React.useState<{
    name: string
    scientificName?: string
    status: string
    family?: string
    plantType?: string
    levelSun?: string
    livingSpace?: string
    lifeCycle?: string
    season?: string[]
    maintenanceLevel?: string
    overview?: string
    primaryImage?: string
  } | null>(null)
  const shareTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current)
    }
  }, [])

  const handleShare = React.useCallback(async () => {
    if (typeof window === 'undefined' || !plant) return
    const shareUrl = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({
          title: plant.name,
          text: plant.identity?.overview || undefined,
          url: shareUrl,
        })
        setShareStatus('shared')
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        setShareStatus('copied')
      } else {
        setShareStatus('error')
      }
    } catch {
      setShareStatus('error')
    }
    if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current)
    shareTimeoutRef.current = setTimeout(() => setShareStatus('idle'), 2500)
  }, [plant])

  const checkIfBookmarked = React.useCallback(async () => {
    if (!user?.id || !plant?.id) {
      setIsBookmarked(false)
      return
    }
    try {
      const bookmarks = await getUserBookmarks(user.id)
      const isInAnyBookmark = bookmarks.some(b => 
        b.items?.some(item => item.plant_id === plant.id)
      )
      setIsBookmarked(isInAnyBookmark)
    } catch (e) {
      console.error('Failed to check bookmarks:', e)
      setIsBookmarked(false)
    }
  }, [user?.id, plant?.id])

  React.useEffect(() => {
    checkIfBookmarked()
  }, [checkIfBookmarked])

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
  
  // Get the primary image for SEO/link previews
  const primaryImage = React.useMemo(() => {
    if (!plant?.images?.length) return undefined
    const primary = plant.images.find((img) => img.use === 'primary')
    const discovery = plant.images.find((img) => img.use === 'discovery')
    return primary?.link || discovery?.link || plant.images[0]?.link
  }, [plant?.images])
  
  usePageMetadata({ 
    title: resolvedTitle, 
    description: resolvedDescription,
    image: primaryImage,
    url: id ? `/plants/${id}` : undefined,
  })

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
      setLimitedPlantInfo(null)
      
      try {
        // Fast-path: First check plant status with minimal query
        const basicInfo = await fetchPlantStatusAndBasicInfo(id, currentLang)
        
        if (ignore) return
        
        if (!basicInfo) {
          setPlant(null)
          setLoading(false)
          return
        }
        
        // Check if plant is "in construction"
        const statusLower = basicInfo.status?.toLowerCase()
        const isInConstruction = statusLower === 'in progres' || statusLower === 'in progress'
        
        // Check if user has privileged access
        const hasPrivilegedAccess = profile?.is_admin === true || 
          hasAnyRole(profile?.roles, [USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.PRO])
        
        // For non-privileged users viewing "in construction" plants,
        // show the construction banner immediately without loading full data
        if (isInConstruction && !hasPrivilegedAccess) {
          setLimitedPlantInfo({
            name: basicInfo.name || 'Unknown Plant',
            scientificName: basicInfo.scientificName,
            status: basicInfo.status || 'in progress',
            family: basicInfo.family,
            plantType: basicInfo.plantType,
            levelSun: basicInfo.levelSun,
            livingSpace: basicInfo.livingSpace,
            lifeCycle: basicInfo.lifeCycle,
            season: basicInfo.season,
            maintenanceLevel: basicInfo.maintenanceLevel,
            overview: basicInfo.overview,
            primaryImage: basicInfo.primaryImage,
          })
          setPlant(null)
          setLoading(false)
          return
        }
        
        // User has access or plant is published - load full data
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
  }, [id, currentLang, profile?.is_admin, profile?.roles])

  // --- Impression tracking (page views) ---
  const [impressionCount, setImpressionCount] = React.useState<number | null>(null)
  const [likesCount, setLikesCount] = React.useState<number | null>(null)

  // Track impression on every page load/reload (fire-and-forget).
  // Fires immediately based on URL param — no auth or data load required.
  React.useEffect(() => {
    if (!id) return
    trackImpression('plant', id)
  }, [id])

  // Fetch impression count + likes count for admins
  React.useEffect(() => {
    if (!id || !profile?.is_admin) {
      setImpressionCount(null)
      setLikesCount(null)
      return
    }
    let ignore = false
    fetchImpression('plant', id).then((data) => {
      if (!ignore && data) setImpressionCount(data.count)
    })
    // Fetch total likes for this plant (admin only)
    supabase.auth.getSession().then(({ data: sessionData }) => {
      const token = sessionData.session?.access_token
      if (!token || ignore) return
      fetch(`/api/plants/${encodeURIComponent(id)}/likes-count`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'same-origin',
      })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (!ignore && data) setLikesCount(data.likes ?? 0) })
        .catch(() => {})
    })
    return () => { ignore = true }
  }, [id, profile?.is_admin])

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

  const handleBookmark = () => {
    if (!user) {
      openLogin()
      return
    }
    setBookmarkOpen(true)
  }

  const handleAddToGarden = () => {
    if (!user) {
      openLogin()
      return
    }
    setGardenOpen(true)
  }

  const handleGardenAdded = (_gardenId: string) => {
    // Optionally navigate to the garden or show a success message
    // For now, just close the dialog
  }

  if (loading) {
    return <PlantInfoPageSkeleton label={t('common.loading', { defaultValue: 'Loading plant data' })} />
  }
  if (error) return <div className="max-w-4xl mx-auto mt-8 px-4 text-red-600 text-sm">{error}</div>
  
  // Fast-path: Show construction banner immediately for non-privileged users
  // This avoids loading full plant data when user won't see it anyway
  if (limitedPlantInfo) {
    // Helper to translate enum values for the limited info display
    const translateLimitedEnum = (value: string | undefined): string => {
      if (!value) return ''
      const key = value.toLowerCase().replace(/[_\s-]/g, '')
      const translationKeys = [
        `plantDetails.plantType.${key}`,
        `plantDetails.sunLevels.${key}`,
        `plantDetails.maintenanceLevels.${key}`,
        `plantDetails.seasons.${key}`,
        `moreInfo.lifeCycle.${key}`,
        `moreInfo.livingSpace.${key}`,
      ]
      for (const k of translationKeys) {
        const translated = t(k, { defaultValue: '' })
        if (translated) return translated
      }
      return value.replace(/[_-]/g, ' ')
    }
    
    const hasBasicInfo = limitedPlantInfo.family || limitedPlantInfo.plantType || limitedPlantInfo.lifeCycle
    const hasCareInfo = limitedPlantInfo.levelSun || limitedPlantInfo.maintenanceLevel || limitedPlantInfo.livingSpace
    const hasSeasons = limitedPlantInfo.season && limitedPlantInfo.season.length > 0
    
    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pt-4 sm:pt-5 pb-12 sm:pb-14 space-y-4 sm:space-y-5">
        <div className="flex items-center gap-2 justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full border border-stone-200 bg-white h-10 w-10 shadow-sm dark:border-[#1d1d1f] dark:bg-[#141417]"
            onClick={handleGoBack}
            aria-label={t('common.back', { defaultValue: 'Back' })}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="rounded-3xl border border-amber-200 dark:border-amber-500/30 bg-gradient-to-br from-amber-50 via-white to-amber-100 dark:from-amber-900/20 dark:via-[#1e1e1e] dark:to-amber-900/10 overflow-hidden">
          {/* Hero section with image */}
          <div className="relative">
            {limitedPlantInfo.primaryImage ? (
              <div className="relative h-48 sm:h-64 md:h-72 overflow-hidden">
                <img 
                  src={limitedPlantInfo.primaryImage} 
                  alt={limitedPlantInfo.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white drop-shadow-lg">{limitedPlantInfo.name}</h1>
                  {limitedPlantInfo.scientificName && (
                    <p className="text-base sm:text-lg italic text-white/80 mt-1">{limitedPlantInfo.scientificName}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 sm:p-8 text-center border-b border-amber-200/50 dark:border-amber-500/20">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 dark:text-white">{limitedPlantInfo.name}</h1>
                {limitedPlantInfo.scientificName && (
                  <p className="text-base sm:text-lg italic text-stone-600 dark:text-stone-400 mt-1">{limitedPlantInfo.scientificName}</p>
                )}
              </div>
            )}
          </div>
          
          {/* Construction notice */}
          <div className="p-6 sm:p-8 text-center border-b border-amber-200/50 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-900/10">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/40">
                <FlaskConical className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-amber-900 dark:text-amber-100 mb-2">
              {t('plantInfo.inConstruction.title', { defaultValue: 'Plant in Construction' })}
            </h2>
            <p className="text-amber-700 dark:text-amber-300 max-w-lg mx-auto text-sm sm:text-base">
              {t('plantInfo.inConstruction.description', { 
                defaultValue: 'We are currently verifying and completing the information for this plant. Check back soon for the full details!' 
              })}
            </p>
          </div>
          
          {/* Available plant info */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Overview if available */}
            {limitedPlantInfo.overview && (
              <div className="text-stone-700 dark:text-stone-300 text-sm sm:text-base leading-relaxed">
                {limitedPlantInfo.overview}
              </div>
            )}
            
            {/* Basic Info Grid */}
            {(hasBasicInfo || hasCareInfo || hasSeasons) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {limitedPlantInfo.plantType && (
                  <div className="p-3 sm:p-4 rounded-2xl bg-white/60 dark:bg-[#1f1f1f]/60 border border-stone-200/50 dark:border-stone-700/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Leaf className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-[10px] sm:text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
                        {t('plantDetails.stats.type', { defaultValue: 'Type' })}
                      </span>
                    </div>
                    <p className="font-medium text-sm sm:text-base text-stone-900 dark:text-white">
                      {translateLimitedEnum(limitedPlantInfo.plantType)}
                    </p>
                  </div>
                )}
                
                {limitedPlantInfo.family && (
                  <div className="p-3 sm:p-4 rounded-2xl bg-white/60 dark:bg-[#1f1f1f]/60 border border-stone-200/50 dark:border-stone-700/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Sprout className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-[10px] sm:text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
                        {t('moreInfo.labels.family', { defaultValue: 'Family' })}
                      </span>
                    </div>
                    <p className="font-medium text-sm sm:text-base text-stone-900 dark:text-white">
                      {limitedPlantInfo.family}
                    </p>
                  </div>
                )}
                
                {limitedPlantInfo.lifeCycle && (
                  <div className="p-3 sm:p-4 rounded-2xl bg-white/60 dark:bg-[#1f1f1f]/60 border border-stone-200/50 dark:border-stone-700/50">
                    <div className="flex items-center gap-2 mb-1">
                      <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-[10px] sm:text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
                        {t('moreInfo.labels.lifeCycle', { defaultValue: 'Life Cycle' })}
                      </span>
                    </div>
                    <p className="font-medium text-sm sm:text-base text-stone-900 dark:text-white">
                      {translateLimitedEnum(limitedPlantInfo.lifeCycle)}
                    </p>
                  </div>
                )}
                
                {limitedPlantInfo.levelSun && (
                  <div className="p-3 sm:p-4 rounded-2xl bg-white/60 dark:bg-[#1f1f1f]/60 border border-stone-200/50 dark:border-stone-700/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                      <span className="text-[10px] sm:text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
                        {t('plantDetails.stats.sunLevel', { defaultValue: 'Sun' })}
                      </span>
                    </div>
                    <p className="font-medium text-sm sm:text-base text-stone-900 dark:text-white">
                      {translateLimitedEnum(limitedPlantInfo.levelSun)}
                    </p>
                  </div>
                )}
                
                {limitedPlantInfo.maintenanceLevel && (
                  <div className="p-3 sm:p-4 rounded-2xl bg-white/60 dark:bg-[#1f1f1f]/60 border border-stone-200/50 dark:border-stone-700/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Wrench className="h-4 w-4 text-stone-600 dark:text-stone-400" />
                      <span className="text-[10px] sm:text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
                        {t('plantDetails.stats.maintenance', { defaultValue: 'Maintenance' })}
                      </span>
                    </div>
                    <p className="font-medium text-sm sm:text-base text-stone-900 dark:text-white">
                      {translateLimitedEnum(limitedPlantInfo.maintenanceLevel)}
                    </p>
                  </div>
                )}
                
                {limitedPlantInfo.livingSpace && (
                  <div className="p-3 sm:p-4 rounded-2xl bg-white/60 dark:bg-[#1f1f1f]/60 border border-stone-200/50 dark:border-stone-700/50">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                      <span className="text-[10px] sm:text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
                        {t('moreInfo.labels.livingSpace', { defaultValue: 'Living Space' })}
                      </span>
                    </div>
                    <p className="font-medium text-sm sm:text-base text-stone-900 dark:text-white">
                      {translateLimitedEnum(limitedPlantInfo.livingSpace)}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Seasons */}
            {hasSeasons && (
              <div className="flex flex-wrap gap-2 justify-center">
                {limitedPlantInfo.season!.map((s) => (
                  <Badge key={s} variant="outline" className="bg-amber-100/60 text-amber-900 dark:bg-amber-900/30 dark:text-amber-50 px-3 py-1">
                    {translateLimitedEnum(s)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
  
  if (!plant) return <div className="max-w-4xl mx-auto mt-8 px-4">{t('plantInfo.plantNotFound')}</div>

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pt-4 sm:pt-5 pb-12 sm:pb-14 space-y-4 sm:space-y-5">
      <div className="flex items-center gap-2 justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full border border-stone-200 bg-white h-10 w-10 shadow-sm dark:border-[#1d1d1f] dark:bg-[#141417]"
          onClick={handleGoBack}
          aria-label={t('common.back', { defaultValue: 'Back' })}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Admin stats badge — next to Share */}
          {profile?.is_admin && (impressionCount !== null || likesCount !== null) && (
            <Badge
              variant="secondary"
              className="rounded-full px-3 py-1.5 text-xs font-medium bg-stone-100 text-stone-600 dark:bg-[#2a2a2e] dark:text-stone-300 border border-stone-200 dark:border-[#3e3e42] flex items-center gap-3"
            >
              {impressionCount !== null && (
                <span className="flex items-center gap-1">
                  <ChartNoAxesColumn className="h-3.5 w-3.5" />
                  {formatCount(impressionCount)}
                </span>
              )}
              {likesCount !== null && (
                <span className="flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5" />
                  {formatCount(likesCount)}
                </span>
              )}
            </Badge>
          )}
          {/* Share Button */}
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full border-stone-200 bg-white h-10 w-10 shadow-sm dark:border-[#3e3e42] dark:bg-[#1f1f1f]"
              onClick={handleShare}
              aria-label={t('common.share', { defaultValue: 'Share' })}
            >
              <Share2 className="h-5 w-5" />
            </Button>
            {shareStatus !== 'idle' && (
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                {shareStatus === 'copied' ? 'Copied!' : shareStatus === 'shared' ? 'Shared!' : 'Error'}
              </span>
            )}
          </div>
          {/* Like Button */}
          <Button
            type="button"
            variant={likedIds.includes(plant?.id || '') ? 'default' : 'outline'}
            size="icon"
            className={`rounded-full h-10 w-10 shadow-sm ${
              likedIds.includes(plant?.id || '')
                ? 'bg-rose-500 hover:bg-rose-600 border-rose-500 text-white dark:bg-rose-500 dark:hover:bg-rose-600'
                : 'border-stone-200 bg-white dark:border-[#3e3e42] dark:bg-[#1f1f1f]'
            }`}
            onClick={toggleLiked}
            aria-label={likedIds.includes(plant?.id || '') ? t('common.unlike', { defaultValue: 'Unlike' }) : t('common.like', { defaultValue: 'Like' })}
          >
            <Heart className="h-5 w-5" fill={likedIds.includes(plant?.id || '') ? 'currentColor' : 'none'} />
          </Button>
          {/* Save/Bookmark Button */}
          <Button
            type="button"
            variant={isBookmarked ? 'default' : 'outline'}
            size="icon"
            className={`rounded-full h-10 w-10 shadow-sm ${
              isBookmarked
                ? 'bg-amber-500 hover:bg-amber-600 border-amber-500 text-white dark:bg-amber-500 dark:hover:bg-amber-600'
                : 'border-stone-200 bg-white dark:border-[#3e3e42] dark:bg-[#1f1f1f]'
            }`}
            onClick={handleBookmark}
            aria-label={isBookmarked ? t('common.unsave', { defaultValue: 'Remove from bookmarks' }) : t('common.save', { defaultValue: 'Save' })}
          >
            <Bookmark className="h-5 w-5" fill={isBookmarked ? 'currentColor' : 'none'} />
          </Button>
          {/* Add to Garden Button */}
          <Button
            type="button"
            variant="default"
            className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-3 sm:px-4 shadow-sm dark:bg-emerald-600 dark:hover:bg-emerald-700"
            onClick={handleAddToGarden}
            aria-label={t('garden.add', { defaultValue: 'Add to garden' })}
          >
            <Plus className="h-5 w-5" />
            <span className="hidden sm:inline ml-1.5">{t('garden.addToGarden', { defaultValue: 'Add to Garden' })}</span>
          </Button>
          {/* Edit Button (Admin/Editor) */}
          {checkEditorAccess(profile) && plant && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full border-emerald-200 bg-white h-10 w-10 shadow-sm dark:border-emerald-500/60 dark:bg-transparent"
              onClick={handleEdit}
              aria-label={t('common.edit', { defaultValue: 'Edit' })}
            >
              <Pencil className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
      {/* Check if plant is "In Progress" - show construction message for regular users, full page with disclaimer for privileged users */}
      {(() => {
        const isInConstruction = plant.meta?.status?.toLowerCase() === 'in progres' || plant.meta?.status?.toLowerCase() === 'in progress'
        // Check if user has privileged access: Admin, Editor, or Pro
        const hasPrivilegedAccess = profile?.is_admin === true || hasAnyRole(profile?.roles, [USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.PRO])
        
        // Regular users see simplified construction message
        if (isInConstruction && !hasPrivilegedAccess) {
          return (
            <div className="rounded-3xl border border-amber-200 dark:border-amber-500/30 bg-gradient-to-br from-amber-50 via-white to-amber-100 dark:from-amber-900/20 dark:via-[#1e1e1e] dark:to-amber-900/10 p-8 sm:p-12 text-center space-y-6">
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/40">
                  <FlaskConical className="h-12 w-12 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl sm:text-3xl font-bold text-amber-900 dark:text-amber-100">
                  {t('plantInfo.inConstruction.title', { defaultValue: 'Plant in Construction' })}
                </h2>
                <p className="text-amber-700 dark:text-amber-300 max-w-lg mx-auto">
                  {t('plantInfo.inConstruction.description', { 
                    defaultValue: 'We are currently verifying and completing the information for this plant. Check back soon for the full details!' 
                  })}
                </p>
              </div>
              {/* Show basic info that we have */}
              <div className="pt-4 space-y-4 max-w-md mx-auto">
                <div className="text-left p-4 rounded-2xl bg-white/60 dark:bg-[#1f1f1f]/60 border border-amber-200/50 dark:border-amber-500/20">
                  <h3 className="font-semibold text-lg text-stone-900 dark:text-white">{plant.name}</h3>
                  {plant.identity?.scientificName && (
                    <p className="text-sm italic text-stone-600 dark:text-stone-400">{plant.identity.scientificName}</p>
                  )}
                </div>
              </div>
            </div>
          )
        }
        
        // Privileged users (Admin/Editor/Pro) see full page with disclaimer banner if plant is in construction
        return (
          <>
            {isInConstruction && hasPrivilegedAccess && (
              <div className="rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 p-4 sm:p-5 flex items-center gap-4">
                <div className="shrink-0 p-2.5 rounded-full bg-amber-200 dark:bg-amber-800/50">
                  <FlaskConical className="h-6 w-6 text-amber-700 dark:text-amber-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                    {t('plantInfo.inConstruction.adminTitle', { defaultValue: 'Plant in Construction' })}
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                    {t('plantInfo.inConstruction.adminDescription', { 
                      defaultValue: 'This plant is still being verified. Regular users cannot see this page yet.' 
                    })}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 border-amber-400 text-amber-700 dark:border-amber-500 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40">
                  {t('plantInfo.inConstruction.privilegedBadge', { defaultValue: 'Early Access' })}
                </Badge>
              </div>
            )}
            <PlantDetails 
              plant={plant} 
              liked={likedIds.includes(plant.id)} 
              onToggleLike={toggleLiked} 
              onBookmark={handleBookmark}
              isBookmarked={isBookmarked}
            />
            <MoreInformationSection plant={plant} />
          </>
        )
      })()}
      
      {user?.id && plant && (
        <AddToBookmarkDialog 
          open={bookmarkOpen} 
          onOpenChange={setBookmarkOpen} 
          plantId={plant.id} 
          userId={user.id}
          onAdded={checkIfBookmarked}
        />
      )}

      {user?.id && plant && (
        <AddToGardenDialog
          open={gardenOpen}
          onOpenChange={setGardenOpen}
          plantId={plant.id}
          plantName={plant.name}
          userId={user.id}
          onAdded={handleGardenAdded}
        />
      )}
    </div>
  )
}

const MoreInformationSection: React.FC<{ plant: Plant }> = ({ plant }) => {
  const { t } = useTranslation('common')
  const currentLang = useLanguage()
  const navigate = useLanguageNavigate()
  
  // Companion plants state and fetching
  const [companionPlants, setCompanionPlants] = React.useState<Array<{ id: string; name: string; imageUrl?: string }>>([])
  const [companionsLoading, setCompanionsLoading] = React.useState(false)
  
  React.useEffect(() => {
    let ignore = false
    const loadCompanions = async () => {
      const companionIds = plant?.miscellaneous?.companions
      if (!companionIds || companionIds.length === 0) {
        setCompanionPlants([])
        return
      }
      
      setCompanionsLoading(true)
      try {
        // Run all queries in parallel for faster loading
        // Note: Promise.resolve() wraps PromiseLike into a proper Promise for TypeScript
        const queries: Promise<any>[] = [
          Promise.resolve(
            supabase
              .from('plants')
              .select('id, name')
              .in('id', companionIds)
          ),
          Promise.resolve(
            supabase
              .from('plant_images')
              .select('plant_id, link')
              .in('plant_id', companionIds)
              .eq('use', 'primary')
          )
        ]
        
        // Add translation query if not English
        if (currentLang !== 'en') {
          queries.push(
            Promise.resolve(
              supabase
                .from('plant_translations')
                .select('plant_id, name')
                .in('plant_id', companionIds)
                .eq('language', currentLang)
            )
          )
        }
        
        const [plantsRes, imagesRes, translationsRes] = await Promise.all(queries)
        
        if (ignore) return
        
        const plantsData = plantsRes?.data
        const imagesData = imagesRes?.data
        const translationsData = translationsRes?.data
        
        if (!plantsData?.length) {
          setCompanionPlants([])
          setCompanionsLoading(false)
          return
        }
        
        const imageMap = new Map<string, string>()
        if (imagesData) {
          imagesData.forEach((img: { plant_id: string; link: string }) => {
            if (img.plant_id && img.link) {
              imageMap.set(img.plant_id, img.link)
            }
          })
        }
        
        const nameTranslations: Record<string, string> = {}
        if (translationsData) {
          (translationsData as Array<{ plant_id: string; name: string }>).forEach((trans) => {
            if (trans.plant_id && trans.name) {
              nameTranslations[trans.plant_id] = trans.name
            }
          })
        }
        
        const companions = plantsData.map((p: { id: string; name: string }) => ({
          id: p.id,
          name: nameTranslations[p.id] || p.name,
          imageUrl: imageMap.get(p.id),
        }))
        
        setCompanionPlants(companions)
      } catch (e) {
        console.error('Failed to load companion plants:', e)
        setCompanionPlants([])
      } finally {
        if (!ignore) setCompanionsLoading(false)
      }
    }
    loadCompanions()
    return () => { ignore = true }
  }, [plant?.miscellaneous?.companions, currentLang])
  
  // Comprehensive enum value translator
  const translateEnum = React.useCallback((value: string | null | undefined): string => {
    if (!value) return ''
    const key = value.toLowerCase().replace(/[_\s-]/g, '')
    
    // Try specific translation keys in order of priority
    const translationKeys = [
      `plantDetails.utility.${key}`,
      `plantDetails.seasons.${key}`,
      `plantDetails.sunLevels.${key}`,
      `plantDetails.maintenanceLevels.${key}`,
      `plantDetails.plantType.${key}`,
      `plantDetails.timePeriods.${key}`,
      `moreInfo.enums.habitat.${key}`,
      `moreInfo.enums.livingSpace.${key}`,
      `moreInfo.enums.division.${key}`,
      `moreInfo.enums.soil.${key}`,
      `moreInfo.enums.mulching.${key}`,
      `moreInfo.enums.fertilizer.${key}`,
      `moreInfo.enums.wateringType.${key}`,
      `moreInfo.enums.sowType.${key}`,
      `moreInfo.enums.polenizer.${key}`,
      `moreInfo.enums.conservationStatus.${key}`,
      `moreInfo.enums.toxicity.${key}`,
      `moreInfo.enums.lifeCycle.${key}`,
      `moreInfo.enums.foliage.${key}`,
      `moreInfo.enums.comestiblePart.${key}`,
      `moreInfo.enums.fruitType.${key}`,
      `moreInfo.enums.nutritionNeed.${key}`,
    ]
    
    for (const translationKey of translationKeys) {
      const translated = t(translationKey, { defaultValue: '' })
      if (translated && translated !== '') return translated
    }
    
    // Fallback: format the value nicely
    return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }, [t])
  
  // Translate arrays of enum values
  const translateEnumArray = React.useCallback((values: (string | null | undefined)[] | undefined): string[] => {
    if (!values) return []
    return values
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map(v => translateEnum(v))
  }, [translateEnum])
  
  const monthLabels = React.useMemo(() => [
    t('moreInfo.timeline.months.jan'),
    t('moreInfo.timeline.months.feb'),
    t('moreInfo.timeline.months.mar'),
    t('moreInfo.timeline.months.apr'),
    t('moreInfo.timeline.months.may'),
    t('moreInfo.timeline.months.jun'),
    t('moreInfo.timeline.months.jul'),
    t('moreInfo.timeline.months.aug'),
    t('moreInfo.timeline.months.sep'),
    t('moreInfo.timeline.months.oct'),
    t('moreInfo.timeline.months.nov'),
    t('moreInfo.timeline.months.dec'),
  ], [t])
  
  const timelineData = React.useMemo(() => buildTimelineData(plant, monthLabels), [plant, monthLabels])
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
      { label: t('moreInfo.dimensions.height'), value: height ? `${height} cm` : '—', subLabel: t('moreInfo.dimensions.heightSub') },
      { label: t('moreInfo.dimensions.spread'), value: wingspan ? `${wingspan} cm` : '—', subLabel: t('moreInfo.dimensions.spreadSub') },
      { label: t('moreInfo.dimensions.spacing'), value: spacing ? `${spacing} cm` : '—', subLabel: t('moreInfo.dimensions.spacingSub') },
    ]
    const habitats = plant.plantCare?.habitat || []
  const activePins = habitats.slice(0, MAP_PIN_POSITIONS.length).map((label, idx) => ({
    ...MAP_PIN_POSITIONS[idx],
    label: translateEnum(label),
  }))
    const palette = plant.identity?.colors?.length ? plant.identity.colors : []
    const showPalette = palette.length > 0
    const showRightColumn = showPalette || !!plant.identity?.livingSpace || !!plant.identity?.composition?.includes('Pot')
    const gridClass = showRightColumn
      ? 'grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)] items-start'
      : ''
    const formatWaterPlans = (schedules: PlantWateringSchedule[] = []) => {
      if (!schedules.length) return t('moreInfo.values.flexible')
      return schedules
        .map((schedule) => {
          const season = schedule.season ? `${translateEnum(schedule.season)}: ` : ''
          const quantity = schedule.quantity ? `${schedule.quantity}` : ''
          const period = schedule.timePeriod ? ` / ${translateEnum(schedule.timePeriod)}` : ''
          return `${season}${quantity}${period}`.trim() || t('moreInfo.values.scheduled')
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
      const soilList = translateEnumArray(plantCare.soil as string[] | undefined)
      const originList = compactStrings(plantCare.origin) // Origins are place names, not enums
      const wateringTypeList = translateEnumArray(plantCare.wateringType as string[] | undefined)
      const divisionList = translateEnumArray(plantCare.division as string[] | undefined)
      const nutritionNeeds = translateEnumArray(plantCare.nutritionNeed as string[] | undefined)
      const fertilizerList = translateEnumArray(plantCare.fertilizer as string[] | undefined)
      const mulchingMaterial = plantCare.mulching ? translateEnum(
        typeof plantCare.mulching === 'string' ? plantCare.mulching : plantCare.mulching?.material,
      ) : null
      const comestiblePartList = translateEnumArray(plant.comestiblePart as string[] | undefined)
      const fruitTypeList = translateEnumArray(plant.fruitType as string[] | undefined)
      const utilityList = translateEnumArray(plant.utility as string[] | undefined)
      const sowTypeList = translateEnumArray(growth.sowType as string[] | undefined)
      const pollenizerList = translateEnumArray(ecology.polenizer as string[] | undefined)
      const companionNames = companionPlants.length > 0
        ? companionPlants.map(c => c.name)
        : compactStrings(misc.companions)
      const tagList = compactStrings(misc.tags)
      const pestList = compactStrings(danger.pests)
      const diseaseList = compactStrings(danger.diseases)
      const symbolismList = compactStrings(identity.symbolism) // Symbolism is free text, not enums
      const allergenList = compactStrings(identity.allergens) // Allergens are free text
      const compositionList = translateEnumArray(identity.composition as string[] | undefined)
      const colorTraitList = [
        (identity.multicolor ?? plant.multicolor) ? t('moreInfo.values.multicolor') : null,
        (identity.bicolor ?? plant.bicolor) ? t('moreInfo.values.bicolor') : null,
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
      // adminCommentary hidden from public view
      const createdTimestamp = formatTimestampDetailed(meta.createdAt ?? meta.createdTime)
      const updatedTimestamp = formatTimestampDetailed(meta.updatedAt ?? meta.updatedTime)
      const createdByLabel = formatTextValue(meta.createdBy)
      const updatedByLabel = formatTextValue(meta.updatedBy)
      const contributorsList = Array.from(
        new Map(
          compactStrings(meta.contributors).map((name) => [name.toLowerCase(), name]),
        ).values(),
      )
      const aromaDescriptor = formatBooleanDescriptor(usage.aromatherapy, t('moreInfo.values.essentialOils'), t('moreInfo.values.notForOils'))
      const infusionDescriptor = formatBooleanDescriptor(usage.infusion, t('moreInfo.values.infusionReady'), t('moreInfo.values.notForInfusions'))
      const melliferousDescriptor = formatBooleanDescriptor(
        ecology.melliferous,
        t('moreInfo.values.pollinatorMagnet'),
        t('moreInfo.values.notMelliferous'),
      )
      const manureDescriptor = formatBooleanDescriptor(
        ecology.beFertilizer,
        t('moreInfo.values.feedsNeighbors'),
        t('moreInfo.values.neutralGroundEffect'),
      )
      const supportDescriptor = formatBooleanDescriptor(growth.tutoring, t('moreInfo.values.needsSupport'), t('moreInfo.values.selfSupporting'), true)
      const transplantDescriptor = formatBooleanDescriptor(growth.transplanting, t('moreInfo.values.transplantRecommended'), t('moreInfo.values.noTransplantNeeded'), true)
      const fragranceDescriptor = formatBooleanDescriptor(identity.scent, t('moreInfo.values.fragrant'), t('moreInfo.values.neutralScent'))
      const spikedDescriptor = formatBooleanDescriptor(identity.spiked, t('moreInfo.values.hasThorns'), t('moreInfo.values.smoothStems'))
      const recipesIdeasList = compactStrings(usage.recipesIdeas)
      const structuredRecipes: PlantRecipe[] = Array.isArray(usage.recipes) ? usage.recipes.filter((r: any) => r?.name) : []
      const hasStructuredRecipes = structuredRecipes.length > 0
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
      const companionsLabel = companionNames.length ? companionNames.join(' • ') : null
      const tagLabel = tagList.length ? tagList.join(' • ') : null
      const pestLabel = pestList.length ? pestList.join(' • ') : null
      const diseaseLabel = diseaseList.length ? diseaseList.join(' • ') : null
      const symbolismLabel = symbolismList.length ? symbolismList.join(' • ') : null
      const allergenLabel = allergenList.length ? allergenList.join(' • ') : null
      const compositionLabel = compositionList.length ? compositionList.join(' • ') : null
      const colorTraitLabel = colorTraitList.length ? colorTraitList.join(' • ') : null
      const comestiblePartsLabel = comestiblePartList.length ? comestiblePartList.join(' • ') : null
      const fruitTypeLabel = fruitTypeList.length ? fruitTypeList.join(' • ') : null
      const livingSpaceLabel = identity.livingSpace ? translateEnum(identity.livingSpace) : null
      const maintenanceLabel = identity.maintenanceLevel || plantCare.maintenanceLevel || plant.identity?.maintenanceLevel
        ? translateEnum(identity.maintenanceLevel || plantCare.maintenanceLevel || plant.identity?.maintenanceLevel)
        : null
      const seasonLabel =
        (identity.season && identity.season.length ? identity.season : plant.seasons)?.map(s => translateEnum(s)).join(' • ') || null
      const conservationLabel = plant.ecology?.conservationStatus ? translateEnum(plant.ecology.conservationStatus) : null
      const identityFamily = formatTextValue(identity.family)
      const lifeCycleLabel = identity.lifeCycle ? translateEnum(identity.lifeCycle) : null
      const foliageLabel = identity.foliagePersistance ? translateEnum(identity.foliagePersistance) : null
      const growthCut = formatTextValue(growth.cut)
      const growthSupportNotes = formatTextValue(growth.adviceTutoring)
      const growthSowingNotes = formatTextValue(growth.adviceSowing)
      const groundEffectLabel = formatTextValue(ecology.groundEffect)

      const careHighlights = filterInfoItems([
        {
          label: t('moreInfo.labels.water'),
          value: formatWaterPlans(plant.plantCare?.watering?.schedules || []),
          icon: <Droplets className="h-3.5 w-3.5" />,
        },
        {
          label: t('moreInfo.labels.sunlight'),
          value: plantCare.levelSun ? translateEnum(plantCare.levelSun) : t('moreInfo.values.adaptive'),
          icon: <Sun className="h-3.5 w-3.5" />,
        },
        {
          label: t('moreInfo.labels.soilMix'),
          value: soilLabel || t('moreInfo.values.loamyBlend'),
          icon: <Leaf className="h-3.5 w-3.5" />,
        },
        {
          label: t('moreInfo.labels.maintenance'),
          value: maintenanceLabel,
          icon: <Sprout className="h-3.5 w-3.5" />,
        },
        {
          label: t('moreInfo.labels.temperature'),
          value: temperatureWindow,
          icon: <Thermometer className="h-3.5 w-3.5" />,
        },
        {
          label: t('moreInfo.labels.humidity'),
          value: humidityValue,
          icon: <Droplets className="h-3.5 w-3.5" />,
        },
      ])
      const careDetails = filterInfoItems([
        { label: t('moreInfo.labels.origin'), value: originLabel },
        { label: t('moreInfo.labels.wateringType'), value: wateringTypeLabel },
        { label: t('moreInfo.labels.division'), value: divisionLabel },
        { label: t('moreInfo.labels.mulching'), value: mulchingMaterial },
        { label: t('moreInfo.labels.nutritionNeed'), value: nutrientLabel },
        { label: t('moreInfo.labels.fertilizer'), value: fertilizerLabel },
        { label: t('moreInfo.labels.soilAdvice'), value: soilAdvice, variant: 'note' },
        { label: t('moreInfo.labels.mulchingAdvice'), value: mulchingAdvice, variant: 'note' },
        { label: t('moreInfo.labels.fertilizerAdvice'), value: fertilizerAdvice, variant: 'note' },
      ])
      const usageFlavor = filterInfoItems([
        {
          label: t('moreInfo.labels.utility'),
          value: utilityLabel,
          icon: <Palette className="h-3.5 w-3.5" />,
        },
        { label: t('moreInfo.labels.comestibleParts'), value: comestiblePartsLabel, icon: <Leaf className="h-3.5 w-3.5" /> },
        { label: t('moreInfo.labels.fruitType'), value: fruitTypeLabel },
        { label: t('moreInfo.labels.medicinalNotes'), value: medicinalNotes, variant: 'note' },
        { label: t('moreInfo.labels.nutritionalIntake'), value: nutritionalLabel },
        { label: t('moreInfo.labels.infusionFriendly'), value: infusionDescriptor },
        { label: t('moreInfo.labels.infusionNotes'), value: infusionNotes, variant: 'note' },
        { label: t('moreInfo.labels.infusionMix'), value: infusionMixSummary, variant: 'note' },
        { label: t('moreInfo.labels.aromatherapy'), value: aromaDescriptor },
        { label: t('moreInfo.labels.spiceMixes'), value: spiceMixesLabel },
      ])
      const ecologyItems = filterInfoItems([
        { label: t('moreInfo.labels.habitat'), value: habitatLabel, icon: <MapPin className="h-3.5 w-3.5" /> },
        { label: t('moreInfo.labels.pollinators'), value: pollenizerLabel, icon: <Wind className="h-3.5 w-3.5" /> },
        { label: t('moreInfo.labels.groundEffect'), value: groundEffectLabel, icon: <Sprout className="h-3.5 w-3.5" /> },
        { label: t('moreInfo.labels.melliferous'), value: melliferousDescriptor },
        { label: t('moreInfo.labels.greenManure'), value: manureDescriptor },
        { label: t('moreInfo.labels.companions'), value: companionsLabel },
        { label: t('moreInfo.labels.tags'), value: tagLabel },
      ])
      const identityItems = filterInfoItems([
        { label: t('moreInfo.labels.family'), value: identityFamily },
        { label: t('moreInfo.labels.lifeCycle'), value: lifeCycleLabel },
        { label: t('moreInfo.labels.foliage'), value: foliageLabel },
        { label: t('moreInfo.labels.livingSpace'), value: livingSpaceLabel },
        { label: t('moreInfo.labels.seasons'), value: seasonLabel },
        { label: t('moreInfo.labels.symbolism'), value: symbolismLabel },
        { label: t('moreInfo.labels.allergens'), value: allergenLabel },
        { label: t('moreInfo.labels.compositionUses'), value: compositionLabel },
        { label: t('moreInfo.labels.colorTraits'), value: colorTraitLabel },
        { label: t('moreInfo.labels.fragrance'), value: fragranceDescriptor },
        { label: t('moreInfo.labels.spiked'), value: spikedDescriptor },
      ])
      const growthItems = filterInfoItems([
        { label: t('moreInfo.labels.sowType'), value: sowTypeLabel },
        { label: t('moreInfo.labels.needsSupport'), value: supportDescriptor },
        { label: t('moreInfo.labels.supportNotes'), value: growthSupportNotes, variant: 'note' },
        { label: t('moreInfo.labels.transplanting'), value: transplantDescriptor },
        { label: t('moreInfo.labels.sowingNotes'), value: growthSowingNotes, variant: 'note' },
        { label: t('moreInfo.labels.cutType'), value: growthCut },
      ])
      const riskItems = filterInfoItems([
        {
          label: t('moreInfo.labels.toxicityHuman'),
          value: plant.identity?.toxicityHuman ? translateEnum(plant.identity.toxicityHuman) : undefined,
          icon: <Flame className="h-3.5 w-3.5" />,
        },
        {
          label: t('moreInfo.labels.toxicityPets'),
          value: plant.identity?.toxicityPets ? translateEnum(plant.identity.toxicityPets) : undefined,
          icon: <Leaf className="h-3.5 w-3.5" />,
        },
        {
          label: t('moreInfo.labels.conservation'),
          value: conservationLabel,
          icon: <Compass className="h-3.5 w-3.5" />,
        },
        { label: t('moreInfo.labels.pests'), value: pestLabel },
        { label: t('moreInfo.labels.diseases'), value: diseaseLabel },
      ])
      const recordItems: ReturnType<typeof filterInfoItems> = [] // Admin commentary hidden from public view
      const sourcesValue = formatSourcesList(misc.sources)
      const infoSections = [
        { title: t('moreInfo.sections.careHighlights'), icon: <Droplets className="h-4 w-4" />, items: careHighlights },
        { title: t('moreInfo.sections.careDetails'), icon: <Thermometer className="h-4 w-4" />, items: careDetails },
        { title: t('moreInfo.sections.usageFlavor'), icon: <Leaf className="h-4 w-4" />, items: usageFlavor },
        { title: t('moreInfo.sections.ecology'), icon: <Sprout className="h-4 w-4" />, items: ecologyItems },
        { title: t('moreInfo.sections.identityTraits'), icon: <Palette className="h-4 w-4" />, items: identityItems },
        { title: t('moreInfo.sections.growthStructure'), icon: <Wind className="h-4 w-4" />, items: growthItems },
        { title: t('moreInfo.sections.riskStatus'), icon: <Flame className="h-4 w-4" />, items: riskItems },
        { title: t('moreInfo.sections.recordsSources'), icon: <Compass className="h-4 w-4" />, items: recordItems },
      ].filter((section) => section.items.length > 0)

  return (
    <section
      className="space-y-4 sm:space-y-6"
    >
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <p className="text-[11px] uppercase tracking-[0.45em] text-emerald-500/80">{t('moreInfo.header.eyebrow')}</p>
          <h2 className="text-xl sm:text-2xl font-semibold text-stone-900 dark:text-stone-100">{t('moreInfo.header.title')}</h2>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
            {t('moreInfo.header.subtitle')}
          </p>
        </div>
      
        {/* Seasonal Timeline — full width Gantt-style, first element */}
        <section
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-4 sm:p-6"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,_185,129,_0.12),_transparent_55%)]" />
          <div className="relative space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300">
              <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-[10px] sm:text-xs uppercase tracking-widest">{t('moreInfo.timeline.title')}</span>
            </div>
            <GanttTimeline timelineData={timelineData} monthLabels={monthLabels} t={t} />
          </div>
        </section>

        {/* Dimensions + Color Moodboard & Living Space grid */}
        <div className={gridClass}>
          {(height !== null || wingspan !== null || spacing !== null) && (
            <section
              className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-50/70 via-white/60 to-white/10 p-3 sm:p-5 dark:border-emerald-500/30 dark:from-emerald-500/10 dark:via-transparent dark:to-transparent"
            >
              <div className="mb-3">
                <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-emerald-700/70 dark:text-emerald-300/70">
                  {t('moreInfo.cube.eyebrow')}
                </p>
                <p className="text-base sm:text-lg font-semibold text-stone-900 dark:text-white">{t('moreInfo.cube.title')}</p>
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
            </section>
          )}

          {/* Right column: Color Moodboard + Living Space stacked */}
          {showRightColumn && (
            <div className="flex flex-col gap-3 sm:gap-4">
              {showPalette && (
                <section
                  className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-3 sm:p-4"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,_185,129,_0.12),_transparent_55%)]" />
                  <div className="relative space-y-2 sm:space-y-3">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                      <Palette className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-[10px] sm:text-xs uppercase tracking-widest">{t('moreInfo.palette.title')}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 sm:gap-2">
                      {palette.map((color, idx) => {
                        const colorLabel = color.name || `Color ${idx + 1}`
                        return <ColorSwatchCard key={`${colorLabel}-${idx}`} color={color} />
                      })}
                    </div>
                  </div>
                </section>
              )}

              {(plant.identity?.livingSpace || plant.identity?.composition?.includes('Pot')) && (
                <LivingSpaceVisualizer
                  livingSpace={plant.identity?.livingSpace}
                  isPottable={plant.identity?.composition?.includes('Pot') ?? false}
                  t={t}
                />
              )}
            </div>
          )}
        </div>

        {/* Habitat Map */}
        {habitats.length > 0 && (
          <section
            className="rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-gradient-to-br from-sky-100/80 via-white/80 to-emerald-100/80 p-4 sm:p-6 dark:bg-gradient-to-br dark:from-[#03191b]/90 dark:via-[#04263d]/85 dark:to-[#071321]/90"
          >
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-[10px] sm:text-xs uppercase tracking-widest">{t('moreInfo.habitatMap.title')}</span>
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
            </div>
          </section>
        )}

      {/* Recipes Section - Structured with categories and times */}
        {hasStructuredRecipes ? (
          <RecipeBox
            recipes={structuredRecipes}
            title={t('moreInfo.recipes.title')}
            subtitle={t('moreInfo.recipes.subtitle')}
            categoryLabels={{
              breakfast_brunch: t('moreInfo.recipes.categories.breakfast_brunch', 'Breakfast & Brunch'),
              starters_appetizers: t('moreInfo.recipes.categories.starters_appetizers', 'Starters & Appetizers'),
              soups_salads: t('moreInfo.recipes.categories.soups_salads', 'Soups & Salads'),
              main_courses: t('moreInfo.recipes.categories.main_courses', 'Main Courses'),
              side_dishes: t('moreInfo.recipes.categories.side_dishes', 'Side Dishes'),
              desserts: t('moreInfo.recipes.categories.desserts', 'Desserts'),
              drinks: t('moreInfo.recipes.categories.drinks', 'Drinks'),
              other: t('moreInfo.recipes.categories.other', 'Other'),
            }}
            timeLabels={{
              quick: t('moreInfo.recipes.times.quick', 'Quick'),
              '30_plus': t('moreInfo.recipes.times.30_plus', '30+ min'),
              slow_cooking: t('moreInfo.recipes.times.slow_cooking', 'Slow'),
            }}
          />
        ) : recipesIdeasList.length > 0 ? (
          <section
            className="rounded-2xl sm:rounded-3xl border-2 border-emerald-400/50 bg-gradient-to-br from-emerald-50/90 via-orange-50/60 to-amber-50/80 p-5 sm:p-6 dark:border-emerald-500/60 dark:from-emerald-500/15 dark:via-orange-500/10 dark:to-amber-500/10 shadow-lg"
          >
            <div className="space-y-4 sm:space-y-5">
              <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
                <div className="rounded-xl bg-emerald-500/20 p-2 dark:bg-emerald-500/30">
                  <Utensils className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">{t('moreInfo.recipes.title')}</h3>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">{t('moreInfo.recipes.subtitle')}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                {recipesIdeasList.map((recipe, idx) => (
                  <Badge
                    key={`recipe-${idx}`}
                    className="rounded-xl sm:rounded-2xl border-2 border-emerald-300/70 bg-white px-4 py-2.5 text-sm sm:text-base font-semibold text-emerald-800 shadow-md transition-all hover:scale-105 hover:shadow-lg dark:border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-100 hover:border-emerald-400 dark:hover:border-emerald-400"
                  >
                    <Utensils className="mr-2 h-4 w-4 inline-block" />
                    {recipe}
                  </Badge>
                ))}
              </div>
            </div>
          </section>
        ) : null}

      <ProAdviceSection plantId={plant.id} plantName={plant.name} />

      {/* Prominent Toxicity Warning Banner - Placed before detailed info cards */}
        <ToxicityWarningBanner
          toxicityHuman={plant.identity?.toxicityHuman}
          toxicityPets={plant.identity?.toxicityPets}
          t={t}
        />

      {/* Info Cards Section - Dynamic grid based on content */}
        {infoSections.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          <div className={`${
            infoSections.length === 1 
              ? 'max-w-xl mx-auto' 
              : infoSections.length === 2 
                ? 'columns-1 sm:columns-2 max-w-3xl mx-auto gap-3 sm:gap-4' 
                : 'columns-1 sm:columns-2 gap-3 sm:gap-4'
          }`} style={{ columnFill: 'balance' }}>
            {infoSections.map((section) => (
              <div key={section.title} className="break-inside-avoid mb-3 sm:mb-4">
                <InfoCard title={section.title} icon={section.icon}>
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
              </div>
            ))}
          </div>
          
          {/* Image Gallery */}
          {plant.images && plant.images.length > 0 && (
            <section
              className="rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-4 sm:p-6"
            >
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300">
                  <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest">{t('moreInfo.gallery.title')}</span>
                </div>
                <div className="max-h-[400px]">
                  <ImageGalleryCarousel images={plant.images} plantName={plant.name} />
                </div>
              </div>
            </section>
          )}
          
          {/* Companion & Related Plants Carousel */}
          {(companionPlants.length > 0 || companionsLoading) && (
            <section
              className="rounded-2xl sm:rounded-3xl border border-emerald-200/70 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/80 via-white/60 to-emerald-100/40 dark:from-emerald-950/30 dark:via-[#1f1f1f] dark:to-emerald-900/20 p-4 sm:p-6"
            >
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <Sprout className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest">{t('moreInfo.companions.title', 'Companion & Related Plants')}</span>
                </div>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
                  {t('moreInfo.companions.subtitle', 'Plants that grow well together or are related varieties. Click to explore.')}
                </p>
                <CompanionPlantsCarousel 
                  companions={companionPlants} 
                  onPlantClick={(plantId) => navigate(`/plants/${plantId}`)}
                  loading={companionsLoading}
                />
              </div>
            </section>
          )}

          {contributorsList.length > 0 && (
            <details className="rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-4 sm:p-6">
              <summary className="cursor-pointer text-xs sm:text-sm font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-300">
                {t('moreInfo.contributors.title', 'Contributors')}
              </summary>
              <div className="mt-3 space-y-2 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
                <p>{t('moreInfo.contributors.thanks', 'Thank you to all plant lovers that participated:')}</p>
                <div className="flex flex-wrap gap-2">
                  {contributorsList.map((name) => (
                    <Badge key={name} className="rounded-xl sm:rounded-2xl border-none bg-emerald-100/70 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100 text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-0.5 sm:py-1">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            </details>
          )}

          {(createdTimestamp || updatedTimestamp || sourcesValue) && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] sm:text-xs text-stone-400 dark:text-stone-500 py-3">
              {(createdTimestamp || createdByLabel) && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3" />
                  <span>{t('moreInfo.meta.created')}</span>
                  <span className="text-stone-500 dark:text-stone-400">{createdTimestamp || '—'}</span>
                  {createdByLabel && <span>· {createdByLabel}</span>}
                </span>
              )}
              {(updatedTimestamp || updatedByLabel) && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  <span>{t('moreInfo.meta.updated')}</span>
                  <span className="text-stone-500 dark:text-stone-400">{updatedTimestamp || '—'}</span>
                  {updatedByLabel && <span>· {updatedByLabel}</span>}
                </span>
              )}
              {sourcesValue && (
                <span className="flex items-center gap-1.5 basis-full justify-center mt-1">
                  <FileText className="h-3 w-3" />
                  <span>{t('moreInfo.meta.sources')}:</span>
                  <span className="text-stone-500 dark:text-stone-400">{sourcesValue}</span>
                </span>
              )}
            </div>
          )}
        </div>
        )}
    </section>
  )
}

// Gantt-style seasonal timeline with rows per activity and month columns
type GanttTimelineProps = {
  timelineData: Array<{ month: string; flowering: number; fruiting: number; sowing: number }>
  monthLabels: string[]
  t: (key: string, options?: Record<string, string>) => string
}

const GanttTimeline: React.FC<GanttTimelineProps> = ({ timelineData, monthLabels, t }) => {
  const rows: Array<{
    key: 'flowering' | 'fruiting' | 'sowing'
    label: string
    color: string
    bgClass: string
    icon: React.ReactNode
  }> = [
    {
      key: 'flowering',
      label: t('moreInfo.timeline.legend.flowering'),
      color: TIMELINE_COLORS.flowering,
      bgClass: 'bg-orange-400',
      icon: <Flower2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: TIMELINE_COLORS.flowering }} />,
    },
    {
      key: 'fruiting',
      label: t('moreInfo.timeline.legend.fruiting'),
      color: TIMELINE_COLORS.fruiting,
      bgClass: 'bg-green-500',
      icon: <Cherry className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: TIMELINE_COLORS.fruiting }} />,
    },
    {
      key: 'sowing',
      label: t('moreInfo.timeline.legend.sowing'),
      color: TIMELINE_COLORS.sowing,
      bgClass: 'bg-indigo-500',
      icon: <Sprout className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: TIMELINE_COLORS.sowing }} />,
    },
  ]

  // Only show rows that have at least one active month
  const activeRows = rows.filter((row) =>
    timelineData.some((d) => d[row.key] > 0),
  )

  if (activeRows.length === 0) return null

  // Build contiguous bar segments for a row (consecutive active months get merged into one bar)
  const buildSegments = (key: 'flowering' | 'fruiting' | 'sowing') => {
    const segments: Array<{ start: number; end: number }> = []
    let segStart: number | null = null
    for (let i = 0; i < 12; i++) {
      const active = timelineData[i]?.[key] > 0
      if (active && segStart === null) segStart = i
      if (!active && segStart !== null) {
        segments.push({ start: segStart, end: i - 1 })
        segStart = null
      }
    }
    if (segStart !== null) segments.push({ start: segStart, end: 11 })
    return segments
  }

  return (
    <div className="space-y-2">
      {/* Month labels row */}
      <div className="grid gap-1 sm:gap-1.5" style={{ gridTemplateColumns: 'minmax(90px, auto) repeat(12, minmax(0, 1fr))' }}>
        <div />
        {monthLabels.map((label, idx) => (
          <div key={idx} className="flex items-center justify-center">
            <span className="text-[8px] sm:text-[9px] font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
              {label.slice(0, 3)}
            </span>
          </div>
        ))}
      </div>

      {/* Activity rows */}
      {activeRows.map((row) => {
        const segments = buildSegments(row.key)
        return (
          <div
            key={row.key}
            className="grid gap-1 sm:gap-1.5 items-center"
            style={{ gridTemplateColumns: 'minmax(90px, auto) repeat(12, minmax(0, 1fr))' }}
          >
            {/* Row label */}
            <div className="flex items-center gap-1.5 sm:gap-2 pr-2">
              {row.icon}
              <span className="text-[10px] sm:text-xs font-semibold text-stone-600 dark:text-stone-300 truncate">
                {row.label}
              </span>
            </div>
            {/* Month cells with bars */}
            <div className="col-span-12 relative grid grid-cols-12 gap-1 sm:gap-1.5">
              {/* Background cells */}
              {Array.from({ length: 12 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-7 sm:h-9 rounded-md sm:rounded-lg bg-stone-100/60 dark:bg-stone-800/30 border border-stone-200/40 dark:border-stone-700/25"
                />
              ))}
              {/* Colored bar segments overlaid */}
              {segments.map((seg, sIdx) => {
                const span = seg.end - seg.start + 1
                // Calculate position with gap offsets
                return (
                  <div
                    key={sIdx}
                    className="absolute inset-y-0 flex items-center"
                    style={{
                      left: `calc(${(seg.start / 12) * 100}% + 2px)`,
                      width: `calc(${(span / 12) * 100}% - 4px)`,
                    }}
                  >
                    <div
                      className="w-full h-5 sm:h-7 rounded-md sm:rounded-lg shadow-sm"
                      style={{ backgroundColor: row.color, opacity: 0.85 }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Indoor / Outdoor / Pot visual indicator
type LivingSpaceVisualizerProps = {
  livingSpace: string | undefined
  isPottable: boolean
  t: (key: string, options?: Record<string, string>) => string
}

const LivingSpacePanel: React.FC<{
  active: boolean
  icon: React.ReactNode
  label: string
}> = ({ active, icon, label }) => (
  <div className={`flex flex-col items-center gap-1.5 sm:gap-2 rounded-2xl border p-3 sm:p-4 transition-all flex-1 min-w-0 ${
    active
      ? 'border-emerald-400/60 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/10 shadow-sm'
      : 'border-stone-200/50 bg-stone-50/40 dark:border-stone-700/40 dark:bg-stone-800/30 opacity-30'
  }`}>
    {icon}
    <span className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-center leading-tight ${
      active
        ? 'text-emerald-700 dark:text-emerald-300'
        : 'text-stone-400 dark:text-stone-600'
    }`}>
      {label}
    </span>
  </div>
)

const LivingSpaceVisualizer: React.FC<LivingSpaceVisualizerProps> = ({ livingSpace, isPottable, t }) => {
  if (!livingSpace && !isPottable) return null

  const normalized = (livingSpace || '').toLowerCase().replace(/[_\s&-]+/g, '')

  const isIndoor = normalized === 'indoor'
  const isOutdoor = normalized === 'outdoor'
  const isBoth = normalized === 'both' || normalized === 'indooroutdoor'

  const activeClass = 'text-emerald-600 dark:text-emerald-400'
  const inactiveClass = 'text-stone-400 dark:text-stone-600'

  return (
    <section className="rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,_185,129,_0.12),_transparent_55%)]" />
      <div className="relative space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
          <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="text-[10px] sm:text-xs uppercase tracking-widest">{t('moreInfo.livingSpaceVisualizer.title', { defaultValue: 'Living Space' })}</span>
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <LivingSpacePanel
            active={isIndoor || isBoth}
            icon={<House className={`h-8 w-8 sm:h-10 sm:w-10 ${isIndoor || isBoth ? activeClass : inactiveClass}`} strokeWidth={1.5} />}
            label={t('moreInfo.enums.livingSpace.indoor', { defaultValue: 'Indoor' })}
          />
          <LivingSpacePanel
            active={isOutdoor || isBoth}
            icon={<TreeDeciduous className={`h-8 w-8 sm:h-10 sm:w-10 ${isOutdoor || isBoth ? activeClass : inactiveClass}`} strokeWidth={1.5} />}
            label={t('moreInfo.enums.livingSpace.outdoor', { defaultValue: 'Outdoor' })}
          />
          <LivingSpacePanel
            active={isPottable}
            icon={<Flower className={`h-8 w-8 sm:h-10 sm:w-10 ${isPottable ? activeClass : inactiveClass}`} strokeWidth={1.5} />}
            label={t('moreInfo.livingSpaceVisualizer.pot', { defaultValue: 'Pot' })}
          />
        </div>
      </div>
    </section>
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

const InfoCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultExpanded?: boolean }> = ({ title, icon, children, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded)
  
  return (
    <Card className="rounded-2xl sm:rounded-3xl border-stone-200/70 dark:border-[#3e3e42]/70">
      <CardHeader 
        className="p-4 sm:p-6 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <div className="h-3.5 w-3.5 sm:h-4 sm:w-4">{icon}</div>
            <span className="text-[10px] sm:text-xs uppercase tracking-wide">{title}</span>
          </div>
          <ChevronDown 
            className={`h-4 w-4 sm:h-5 sm:w-5 text-stone-400 dark:text-stone-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </CardHeader>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <CardContent className="space-y-1.5 sm:space-y-2 p-4 sm:p-6 pt-0">{children}</CardContent>
      </div>
    </Card>
  )
}

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

type ToxicityLevel = 'Non-Toxic' | 'Midly Irritating' | 'Highly Toxic' | 'Lethally Toxic' | undefined

const getToxicityConfig = (level: ToxicityLevel) => {
  const normalized = level?.toLowerCase().replace(/[_\s-]/g, '') || ''
  switch (normalized) {
    case 'nontoxic':
      return {
        severity: 'safe' as const,
        color: 'emerald',
        bgGradient: 'from-emerald-50/60 to-green-50/40 dark:from-emerald-950/30 dark:to-green-950/20',
        borderColor: 'border-emerald-200/80 dark:border-emerald-700/50',
        iconBg: 'bg-emerald-400/80 dark:bg-emerald-600/70',
        textColor: 'text-emerald-700 dark:text-emerald-300',
        labelColor: 'text-emerald-600 dark:text-emerald-400',
        Icon: ShieldCheck,
        key: 'nontoxic',
        animate: false,
        iconSize: 'sm' as const,
      }
    case 'midlyirritating':
      return {
        severity: 'mild' as const,
        color: 'stone',
        // Subtle, muted styling - barely noticeable
        bgGradient: 'from-stone-50/50 to-stone-100/30 dark:from-stone-900/30 dark:to-stone-800/20',
        borderColor: 'border-stone-200/60 dark:border-stone-700/40',
        iconBg: 'bg-stone-400/60 dark:bg-stone-500/50',
        textColor: 'text-stone-600 dark:text-stone-400',
        labelColor: 'text-stone-500 dark:text-stone-500',
        Icon: Info,
        key: 'midlyirritating',
        animate: false,
        iconSize: 'sm' as const,
      }
    case 'highlytoxic':
      return {
        severity: 'high' as const,
        color: 'amber',
        // Moderate warning - noticeable but not alarming
        bgGradient: 'from-amber-50/70 to-orange-50/50 dark:from-amber-950/40 dark:to-orange-950/30',
        borderColor: 'border-amber-300/80 dark:border-amber-600/60',
        iconBg: 'bg-amber-500 dark:bg-amber-600',
        textColor: 'text-amber-800 dark:text-amber-200',
        labelColor: 'text-amber-700 dark:text-amber-300',
        Icon: AlertTriangle,
        key: 'highlytoxic',
        animate: false,
        iconSize: 'md' as const,
      }
    case 'lethallytoxic':
      return {
        severity: 'lethal' as const,
        color: 'red',
        // Most dramatic - clear danger signal
        bgGradient: 'from-red-50 via-rose-50 to-red-100 dark:from-red-950/50 dark:via-rose-950/40 dark:to-red-900/30',
        borderColor: 'border-red-400 dark:border-red-600',
        iconBg: 'bg-red-600 dark:bg-red-600',
        textColor: 'text-red-800 dark:text-red-200',
        labelColor: 'text-red-700 dark:text-red-300',
        Icon: Skull,
        key: 'lethallytoxic',
        animate: true,
        iconSize: 'lg' as const,
      }
    default:
      return null
  }
}

const ToxicityWarningBanner: React.FC<{
  toxicityHuman: ToxicityLevel
  toxicityPets: ToxicityLevel
  t: (key: string) => string
}> = ({ toxicityHuman, toxicityPets, t }) => {
  const humanConfig = getToxicityConfig(toxicityHuman)
  const petsConfig = getToxicityConfig(toxicityPets)
  
  // Determine overall severity for the banner
  const severityOrder = { safe: 0, mild: 1, high: 2, lethal: 3 }
  const humanSeverity = humanConfig?.severity || 'safe'
  const petsSeverity = petsConfig?.severity || 'safe'
  const maxSeverity = severityOrder[humanSeverity] >= severityOrder[petsSeverity] ? humanSeverity : petsSeverity
  
  // If both are safe or unknown, show a simpler safe banner
  const bothSafe = humanConfig?.severity === 'safe' && petsConfig?.severity === 'safe'
  const neitherKnown = !humanConfig && !petsConfig
  
  if (neitherKnown) {
    return (
      <div className="rounded-2xl sm:rounded-3xl border-2 border-dashed border-stone-300 dark:border-stone-600 bg-stone-50/80 dark:bg-stone-900/50 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-stone-200 dark:bg-stone-700 flex items-center justify-center">
            <Info className="h-6 w-6 sm:h-7 sm:w-7 text-stone-500 dark:text-stone-400" />
          </div>
          <div>
            <p className="text-sm sm:text-base font-medium text-stone-600 dark:text-stone-400">
              {t('moreInfo.toxicityBanner.unknownToxicity')}
            </p>
          </div>
        </div>
      </div>
    )
  }
  
  if (bothSafe) {
    return (
      <div className="rounded-xl sm:rounded-2xl border border-emerald-200/70 dark:border-emerald-800/40 bg-gradient-to-r from-emerald-50/50 to-green-50/30 dark:from-emerald-950/20 dark:to-green-950/10 p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-emerald-400/70 dark:bg-emerald-600/60 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-semibold text-emerald-700 dark:text-emerald-300">
              {t('moreInfo.toxicityBanner.safeForAll')}
            </h3>
            <div className="flex flex-wrap gap-3 mt-1">
              <div className="flex items-center gap-1.5 text-emerald-600/80 dark:text-emerald-400/80">
                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm">{t('moreInfo.toxicityBanner.humans')}: {t('moreInfo.toxicityBanner.levels.nontoxic')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600/80 dark:text-emerald-400/80">
                <PawPrint className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm">{t('moreInfo.toxicityBanner.pets')}: {t('moreInfo.toxicityBanner.levels.nontoxic')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  // Determine banner styling based on max severity - scaling from subtle to dramatic
  const bannerConfig = {
    mild: {
      // Very subtle - almost neutral, just informative
      bg: 'from-stone-50/40 to-stone-100/30 dark:from-stone-900/20 dark:to-stone-800/10',
      border: 'border-stone-200/50 dark:border-stone-700/30',
      shadow: '',
      titleColor: 'text-stone-600 dark:text-stone-400',
      rounded: 'rounded-xl sm:rounded-2xl',
      padding: 'p-3 sm:p-4',
    },
    high: {
      // Moderate warning - noticeable but restrained
      bg: 'from-amber-50/60 to-orange-50/40 dark:from-amber-950/30 dark:to-orange-950/20',
      border: 'border-amber-300/70 dark:border-amber-700/50',
      shadow: 'shadow-sm shadow-amber-100/30 dark:shadow-amber-900/10',
      titleColor: 'text-amber-800 dark:text-amber-200',
      rounded: 'rounded-xl sm:rounded-2xl',
      padding: 'p-3 sm:p-5',
    },
    lethal: {
      // Most dramatic - clear danger
      bg: 'from-red-50 via-rose-50 to-red-100 dark:from-red-950/50 dark:via-rose-950/40 dark:to-red-900/30',
      border: 'border-red-400 dark:border-red-600',
      shadow: 'shadow-md shadow-red-100/40 dark:shadow-red-900/20',
      titleColor: 'text-red-800 dark:text-red-100',
      rounded: 'rounded-2xl sm:rounded-3xl',
      padding: 'p-4 sm:p-6',
    },
    safe: {
      // Calm and subtle
      bg: 'from-emerald-50/50 to-green-50/30 dark:from-emerald-950/20 dark:to-green-950/10',
      border: 'border-emerald-200/60 dark:border-emerald-800/40',
      shadow: '',
      titleColor: 'text-emerald-700 dark:text-emerald-300',
      rounded: 'rounded-xl sm:rounded-2xl',
      padding: 'p-3 sm:p-4',
    },
  }
  
  const bannerStyle = bannerConfig[maxSeverity]
  const showAnimation = maxSeverity === 'lethal'
  
  const renderToxicityCard = (
    config: ReturnType<typeof getToxicityConfig>,
    type: 'human' | 'pets',
    label: string
  ) => {
    if (!config) {
      return (
        <div className="flex-1 rounded-lg sm:rounded-xl border border-dashed border-stone-200/60 dark:border-stone-700/40 bg-stone-50/40 dark:bg-stone-800/30 p-2.5 sm:p-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-stone-200/60 dark:bg-stone-700/50 flex items-center justify-center flex-shrink-0">
              {type === 'human' ? (
                <User className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-stone-400 dark:text-stone-500" />
              ) : (
                <PawPrint className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-stone-400 dark:text-stone-500" />
              )}
            </div>
            <div>
              <p className="text-[10px] sm:text-xs uppercase tracking-wider font-medium text-stone-400 dark:text-stone-500">{label}</p>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-500">{t('moreInfo.toxicityBanner.unknownToxicity')}</p>
            </div>
          </div>
        </div>
      )
    }
    
    const IconComponent = config.Icon
    const isLethal = config.severity === 'lethal'
    const isHigh = config.severity === 'high'
    const isMild = config.severity === 'mild'
    
    // Scale styling based on severity
    const cardRounded = isLethal ? 'rounded-xl sm:rounded-2xl' : 'rounded-lg sm:rounded-xl'
    const cardBorder = isLethal ? 'border-2' : isMild ? 'border' : 'border'
    const cardShadow = isLethal ? 'shadow-md' : isHigh ? 'shadow-sm' : ''
    const iconSize = isLethal ? 'h-11 w-11 sm:h-13 sm:w-13' : isHigh ? 'h-9 w-9 sm:h-11 sm:w-11' : 'h-8 w-8 sm:h-9 sm:w-9'
    const iconInnerSize = isLethal ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-4 w-4 sm:h-5 sm:w-5'
    const textSize = isLethal ? 'text-base sm:text-lg font-bold' : isHigh ? 'text-sm sm:text-base font-semibold' : 'text-sm font-medium'
    const padding = isLethal ? 'p-3 sm:p-4' : 'p-2.5 sm:p-3'
    
    return (
      <div className={`flex-1 ${cardRounded} ${cardBorder} ${config.borderColor} bg-gradient-to-br ${config.bgGradient} ${padding} ${cardShadow}`}>
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className={`${iconSize} rounded-lg ${config.iconBg} flex items-center justify-center flex-shrink-0 ${isLethal ? 'shadow-md' : ''}`}>
            {type === 'human' ? (
              <User className={`${iconInnerSize} text-white`} />
            ) : (
              <PawPrint className={`${iconInnerSize} text-white`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] sm:text-xs uppercase tracking-wider ${isMild ? 'font-medium' : 'font-semibold'} ${config.labelColor}`}>{label}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <IconComponent className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${config.textColor} flex-shrink-0`} />
              <p className={`${textSize} ${config.textColor}`}>
                {t(`moreInfo.toxicityBanner.levels.${config.key}`)}
              </p>
            </div>
            {(isHigh || isLethal) && (
              <p className={`text-[10px] sm:text-xs ${config.labelColor} mt-0.5`}>
                {t(`moreInfo.toxicityBanner.descriptions.${config.key}`)}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }
  
  // For mild toxicity, show a simpler inline layout without the dramatic header
  if (maxSeverity === 'mild') {
    return (
      <div className={`${bannerStyle.rounded} border ${bannerStyle.border} bg-gradient-to-r ${bannerStyle.bg} ${bannerStyle.padding}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
          {renderToxicityCard(humanConfig, 'human', t('moreInfo.toxicityBanner.humans'))}
          {renderToxicityCard(petsConfig, 'pets', t('moreInfo.toxicityBanner.pets'))}
        </div>
      </div>
    )
  }
  
  // Scale header icon and styling based on severity
  const headerIconSize = maxSeverity === 'lethal' ? 'h-11 w-11 sm:h-13 sm:w-13' : 'h-9 w-9 sm:h-10 sm:w-10'
  const headerIconInner = maxSeverity === 'lethal' ? 'h-6 w-6 sm:h-7 sm:w-7' : 'h-4 w-4 sm:h-5 sm:w-5'
  const titleSize = maxSeverity === 'lethal' ? 'text-lg sm:text-xl font-bold' : 'text-base sm:text-lg font-semibold'
  
  return (
    <div className={`${bannerStyle.rounded} border ${maxSeverity === 'lethal' ? 'border-2' : ''} ${bannerStyle.border} bg-gradient-to-r ${bannerStyle.bg} ${bannerStyle.padding} ${bannerStyle.shadow}`}>
      <div className={maxSeverity === 'lethal' ? 'space-y-4' : 'space-y-3'}>
        {/* Header with warning icon - scaled based on severity */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className={`${headerIconSize} rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${
            maxSeverity === 'lethal' ? 'bg-red-600 dark:bg-red-600 shadow-md' :
            maxSeverity === 'high' ? 'bg-amber-500/90 dark:bg-amber-600/80' :
            'bg-stone-400/60 dark:bg-stone-600/50'
          } ${showAnimation ? 'animate-pulse' : ''}`}>
            {maxSeverity === 'lethal' ? (
              <Skull className={`${headerIconInner} text-white`} />
            ) : maxSeverity === 'high' ? (
              <AlertTriangle className={`${headerIconInner} text-white`} />
            ) : (
              <Info className={`${headerIconInner} text-white`} />
            )}
          </div>
          <div>
            <h3 className={`${titleSize} ${bannerStyle.titleColor}`}>
              {t('moreInfo.toxicityBanner.title')}
            </h3>
            {maxSeverity === 'lethal' && (
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
                {t('moreInfo.toxicityBanner.subtitle')}
              </p>
            )}
          </div>
        </div>
        
        {/* Two-column toxicity cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
          {renderToxicityCard(humanConfig, 'human', t('moreInfo.toxicityBanner.humans'))}
          {renderToxicityCard(petsConfig, 'pets', t('moreInfo.toxicityBanner.pets'))}
        </div>
      </div>
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

const formatBooleanDescriptor = (value: boolean | null | undefined, positive: string, negative: string, showNegative = false) => {
  if (value === undefined || value === null) return null
  if (value) return positive
  return showNegative ? negative : null
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

type CompanionPlantCardProps = {
  name: string
  imageUrl?: string
  onClick: () => void
}

const CompanionPlantCard: React.FC<CompanionPlantCardProps> = ({ name, imageUrl, onClick }) => {
  const { t } = useTranslation('common')
  
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-shrink-0 snap-start group relative overflow-hidden rounded-xl sm:rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
      style={{ width: 'min(180px, 45vw)' }}
    >
      {/* Image container with aspect ratio */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-stone-100 dark:bg-[#2d2d30]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-stone-400 dark:text-stone-600">
            <Leaf className="h-12 w-12" />
          </div>
        )}
      </div>
      <div className="p-3 text-left">
        <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 line-clamp-2 leading-tight">
          {name}
        </h4>
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 uppercase tracking-wide">
          {t('plantInfo.viewPlant')}
        </p>
      </div>
    </button>
  )
}

type CompanionPlantsCarouselProps = {
  companions: Array<{ id: string; name: string; imageUrl?: string }>
  onPlantClick: (id: string) => void
  loading?: boolean
}

const CompanionPlantsCarousel: React.FC<CompanionPlantsCarouselProps> = ({ companions, onPlantClick, loading }) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(false)
  const [needsScrolling, setNeedsScrolling] = React.useState(true)

  const checkScrollability = React.useCallback(() => {
    if (!scrollContainerRef.current) return
    const container = scrollContainerRef.current
    const canScroll = container.scrollWidth > container.clientWidth
    setNeedsScrolling(canScroll)
    setCanScrollLeft(container.scrollLeft > 0)
    setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1)
  }, [])

  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkScrollability()
    }, 100)
    
    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('scroll', checkScrollability)
      window.addEventListener('resize', checkScrollability)
      return () => {
        clearTimeout(timeoutId)
        container.removeEventListener('scroll', checkScrollability)
        window.removeEventListener('resize', checkScrollability)
      }
    }
    return () => clearTimeout(timeoutId)
  }, [checkScrollability, companions.length])

  const scroll = React.useCallback((direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return
    const container = scrollContainerRef.current
    const scrollAmount = container.clientWidth * 0.8
    const targetScroll = direction === 'left' 
      ? container.scrollLeft - scrollAmount 
      : container.scrollLeft + scrollAmount
    container.scrollTo({ left: targetScroll, behavior: 'smooth' })
  }, [])

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-shrink-0 animate-pulse rounded-xl bg-stone-200 dark:bg-[#2d2d30]"
            style={{ width: 'min(180px, 45vw)', height: '220px' }}
          />
        ))}
      </div>
    )
  }

  if (companions.length === 0) return null

  return (
    <div className="relative">
      {needsScrolling && canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm transition hover:bg-black/80 dark:bg-white/20 dark:text-white"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div
        ref={scrollContainerRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-2"
        style={{
          justifyContent: needsScrolling ? 'flex-start' : 'center',
        }}
      >
        {companions.map((companion) => (
          <CompanionPlantCard
            key={companion.id}
            name={companion.name}
            imageUrl={companion.imageUrl}
            onClick={() => onPlantClick(companion.id)}
          />
        ))}
      </div>
      {needsScrolling && canScrollRight && (
        <button
          type="button"
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm transition hover:bg-black/80 dark:bg-white/20 dark:text-white"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}

const ImageGalleryCarousel: React.FC<{ images: PlantImage[]; plantName: string }> = ({ images, plantName }) => {
  const validImages = images.filter((img): img is NonNullable<typeof img> & { link: string } => Boolean(img?.link))
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(false)
  const [needsScrolling, setNeedsScrolling] = React.useState(true)
  const imageViewer = useImageViewer()

  const viewerImages = React.useMemo(
    () => validImages.map((img, idx) => ({ src: img.link, alt: `${plantName} - Image ${idx + 1}` })),
    [validImages, plantName],
  )

  const checkScrollability = React.useCallback(() => {
    if (!scrollContainerRef.current) return
    const container = scrollContainerRef.current
    const canScroll = container.scrollWidth > container.clientWidth
    setNeedsScrolling(canScroll)
    setCanScrollLeft(container.scrollLeft > 0)
    setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1)
  }, [])

  React.useEffect(() => {
    // Use a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      checkScrollability()
    }, 100)
    
    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('scroll', checkScrollability)
      window.addEventListener('resize', checkScrollability)
      return () => {
        clearTimeout(timeoutId)
        container.removeEventListener('scroll', checkScrollability)
        window.removeEventListener('resize', checkScrollability)
      }
    }
    return () => clearTimeout(timeoutId)
  }, [checkScrollability, validImages.length])

  const scroll = React.useCallback((direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return
    const container = scrollContainerRef.current
    const scrollAmount = container.clientWidth * 0.8
    const targetScroll = direction === 'left' 
      ? container.scrollLeft - scrollAmount 
      : container.scrollLeft + scrollAmount
    container.scrollTo({ left: targetScroll, behavior: 'smooth' })
  }, [])

  if (validImages.length === 0) return null

  return (
    <>
      <div className="relative">
        {needsScrolling && canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll('left')}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm transition hover:bg-black/80 dark:bg-white/20 dark:text-white"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div
          ref={scrollContainerRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] max-h-[400px]"
          style={{
            justifyContent: needsScrolling ? 'flex-start' : 'center',
          }}
        >
          {validImages.map((img, idx) => (
            <div
              key={img.id || `img-${idx}`}
              className="flex-shrink-0 snap-start h-full flex items-center"
              style={{ minWidth: 'min(280px, 80vw)', maxHeight: '400px' }}
            >
              <div className="relative w-full h-full max-h-[400px] overflow-hidden rounded-xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-stone-100 dark:bg-[#2d2d30] cursor-pointer">
                <img
                  src={img.link}
                  alt={`${plantName} - Image ${idx + 1}`}
                  className="h-full w-full object-contain transition-transform duration-300 hover:scale-105"
                  loading="lazy"
                  draggable={false}
                  onClick={() => imageViewer.openGallery(viewerImages, idx)}
                  style={{ maxHeight: '400px' }}
                />
              </div>
            </div>
          ))}
        </div>
        {needsScrolling && canScrollRight && (
          <button
            type="button"
            onClick={() => scroll('right')}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm transition hover:bg-black/80 dark:bg-white/20 dark:text-white"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      <ImageViewer {...imageViewer.props} enableZoom />
    </>
  )
}

export default PlantInfoPage
