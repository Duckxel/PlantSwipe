import React from "react";
import { useLanguageNavigate, useLanguage } from "@/lib/i18nRouting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  SunMedium, Droplets, Leaf, Heart, Share2, Maximize2, ChevronLeft, X,
  Info, Flower2, Ruler, Calendar, MapPin, Thermometer, Wind, Sprout,
  Scissors, Droplet, Package, Bug, AlertTriangle, Tag, BookOpen,
  Globe, Shield, AlertCircle, Users, Sparkles, FileText, Home,
  BarChart3, Palette, Compass, Map as MapIcon
} from "lucide-react";
import type { Plant } from "@/types/plant";
import { rarityTone, seasonBadge } from "@/constants/badges";
import { cn, deriveWaterLevelFromFrequency } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  YAxis,
  Cell
} from "recharts";
import type { NameType, ValueType, TooltipProps } from "recharts";

const SECTION_KEY_MAP: Record<string, string> = {
  'Identifiers': 'identifiers',
  'Traits': 'traits',
  'Dimensions': 'dimensions',
  'Phenology': 'phenology',
  'Environment': 'environment',
  'Care Details': 'care',
  'Propagation': 'propagation',
  'Usage': 'usage',
  'Ecology': 'ecology',
  'Problems': 'problems',
  'Planting': 'planting',
  'Additional Information': 'additional',
}

const LABEL_KEY_MAP: Record<string, string> = {
  'Scientific Name': 'scientificName',
  'Canonical Name': 'canonicalName',
  'Family': 'family',
  'Genus': 'genus',
  'Taxon Rank': 'taxonRank',
  'Cultivar': 'cultivar',
  'Common Names': 'commonNames',
  'Synonyms': 'synonyms',
  'Wikipedia': 'wikipedia',
  'GBIF ID': 'gbifId',
  'POWO ID': 'powoId',
  'Life Cycle': 'lifeCycle',
  'Habit': 'habit',
  'Foliage': 'foliage',
  'Growth Rate': 'growthRate',
  'Thorns/Spines': 'thornsSpines',
  'Fragrance': 'fragrance',
  'Toxicity to Humans': 'toxicityHumans',
  'Toxicity to Pets': 'toxicityPets',
  'Allergenicity': 'allergenicity',
  'Invasiveness': 'invasiveness',
  'Height': 'height',
  'Spread': 'spread',
  'Spacing': 'spacing',
  'Container Friendly': 'containerFriendly',
  'Flower Colors': 'flowerColors',
  'Leaf Colors': 'leafColors',
  'Flowering Months': 'floweringMonths',
  'Fruiting Months': 'fruitingMonths',
  'Scent Notes': 'scentNotes',
  'Sun Exposure': 'sunExposure',
  'Light Intensity': 'lightIntensity',
  'USDA Zones': 'usdaZones',
  'RHS Hardiness': 'rhsHardiness',
  'Climate Preference': 'climatePreference',
  'Temperature Range': 'temperatureRange',
  'Humidity Preference': 'humidityPreference',
  'Wind Tolerance': 'windTolerance',
  'Soil Texture': 'soilTexture',
  'Soil Drainage': 'soilDrainage',
  'Soil Fertility': 'soilFertility',
  'Soil pH': 'soilPh',
  'Maintenance Level': 'maintenanceLevel',
  'Watering Method': 'wateringMethod',
  'Watering Depth': 'wateringDepth',
  'Winter Watering': 'winterWatering',
  'Spring Watering': 'springWatering',
  'Summer Watering': 'summerWatering',
  'Autumn Watering': 'autumnWatering',
  'Fertilizer Type': 'fertilizerType',
  'Fertilizing Schedule': 'fertilizingSchedule',
  'Best Pruning Months': 'pruningBestMonths',
  'Pruning Method': 'pruningMethod',
  'Mulching Recommended': 'mulchingRecommended',
  'Mulching Material': 'mulchingMaterial',
  'Staking Support': 'stakingSupport',
  'Repotting Interval': 'repottingInterval',
  'Methods': 'methods',
  'Seed Stratification': 'seedStratification',
  'Germination Days': 'germinationDays',
  'Garden Uses': 'gardenUses',
  'Location': 'location',
  'Edible Parts': 'edibleParts',
  'Culinary Uses': 'culinaryUses',
  'Medicinal Uses': 'medicinalUses',
  'Native Range': 'nativeRange',
  'Pollinators': 'pollinators',
  'Wildlife Value': 'wildlifeValue',
  'Conservation Status': 'conservationStatus',
  'Pests': 'pests',
  'Diseases': 'diseases',
  'Hazards': 'hazards',
  'Hemisphere': 'hemisphere',
  'Sowing Months': 'sowingMonths',
  'Planting Out Months': 'plantingOutMonths',
  'Promotion Month': 'promotionMonth',
  'Site Preparation': 'sitePreparation',
  'Companion Plants': 'companionPlants',
  'Avoid Planting Near': 'avoidNear',
  'Tags': 'tags',
  'Fun Fact': 'funFact',
  'Source References': 'sourceReferences',
  'Author Notes': 'authorNotes',
}

const FACT_ACCENTS = [
  'from-emerald-200/80 via-emerald-100/70 to-sky-200/70 dark:from-emerald-950/60 dark:via-emerald-900/50 dark:to-slate-900/70',
  'from-lime-200/80 via-emerald-100/70 to-amber-200/70 dark:from-lime-900/60 dark:via-emerald-900/50 dark:to-amber-900/60',
  'from-teal-200/80 via-sky-100/60 to-purple-200/60 dark:from-teal-900/60 dark:via-sky-900/50 dark:to-purple-900/60',
  'from-rose-200/70 via-amber-100/60 to-emerald-100/70 dark:from-rose-900/60 dark:via-amber-900/50 dark:to-emerald-900/60'
]

const CARE_BAR_COLORS = ['#16a34a', '#0ea5e9', '#f97316', '#8b5cf6', '#facc15']

const DESCRIPTOR_SCALE: Record<string, number> = {
  'very low': 1,
  'low': 2,
  'shade': 2,
  'partial shade': 3,
  'medium': 3,
  'moderate': 3,
  'average': 3,
  'partial sun': 4,
  'high': 4,
  'bright indirect': 4,
  'full sun': 5,
  'very high': 5,
  'heavy': 5,
  'easy': 2,
  'beginner': 2,
  'intermediate': 3,
  'moderate difficulty': 3,
  'medium difficulty': 3,
  'moderate care': 3,
  'advanced': 4,
  'difficult': 4,
  'hard': 4,
  'expert': 5,
  'high maintenance': 4,
  'low maintenance': 2,
  'medium maintenance': 3,
  'high maintenance level': 4,
  'low maintenance level': 2,
  'humid': 4,
  'dry': 2
}

const MAP_PIN_POSITIONS = [
  { top: '16%', left: '22%' },
  { top: '32%', left: '48%' },
  { top: '58%', left: '30%' },
  { top: '46%', left: '70%' },
  { top: '68%', left: '55%' },
  { top: '26%', left: '72%' }
]

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const NAMED_COLOR_MAP: Record<string, string> = {
  red: '#f87171',
  orange: '#fb923c',
  yellow: '#facc15',
  green: '#34d399',
  blue: '#60a5fa',
  purple: '#c084fc',
  pink: '#f472b6',
  white: '#e5e7eb',
  black: '#1f2937',
  brown: '#b45309',
  bronze: '#b45309',
  gold: '#fbbf24',
  silver: '#a1a1aa',
  teal: '#14b8a6',
  indigo: '#6366f1',
  cyan: '#22d3ee',
  magenta: '#d946ef'
}

const TIMELINE_COLORS: Record<string, string> = {
  flowering: '#f97316',
  fruiting: '#22c55e',
  sowing: '#6366f1'
}

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const descriptorScore = (value?: string | null): number => {
  if (!value) return 0
  const normalized = value.toString().trim().toLowerCase()
  if (!normalized) return 0
  if (DESCRIPTOR_SCALE[normalized] !== undefined) return DESCRIPTOR_SCALE[normalized]
  if (normalized.includes('very high')) return 5
  if (normalized.includes('very low')) return 1
  if (normalized.includes('high')) return 4
  if (normalized.includes('medium') || normalized.includes('moderate')) return 3
  if (normalized.includes('low')) return 2
  if (normalized.includes('full sun')) return 5
  if (normalized.includes('sun')) return 4
  if (normalized.includes('shade')) return 2
  if (normalized.includes('easy')) return 2
  if (normalized.includes('difficult') || normalized.includes('hard')) return 4
  return 3
}

const resolveColorValue = (value?: string | null): string => {
  if (!value) return '#34d399'
  const trimmed = value.trim()
  if (!trimmed) return '#34d399'
  if (HEX_COLOR_REGEX.test(trimmed)) return trimmed
  const normalized = trimmed.toLowerCase()
  if (NAMED_COLOR_MAP[normalized]) return NAMED_COLOR_MAP[normalized]
  const firstWord = normalized.split(/[\s/-]+/)[0]
  if (NAMED_COLOR_MAP[firstWord]) return NAMED_COLOR_MAP[firstWord]
  return trimmed
}

export const PlantDetails: React.FC<{ plant: Plant; onClose: () => void; liked?: boolean; onToggleLike?: () => void; isOverlayMode?: boolean; onRequestPlant?: () => void }> = ({ plant, onClose, liked = false, onToggleLike, isOverlayMode = false, onRequestPlant }) => {
  const navigate = useLanguageNavigate()
  const currentLang = useLanguage()
  const { user, profile } = useAuth()
  const { t } = useTranslation('common')
  const [shareSuccess, setShareSuccess] = React.useState(false)
  const shareTimeoutRef = React.useRef<number | null>(null)
  const showShareSuccess = React.useCallback(() => {
    setShareSuccess(true)
    if (shareTimeoutRef.current !== null) {
      window.clearTimeout(shareTimeoutRef.current)
    }
    shareTimeoutRef.current = window.setTimeout(() => {
      setShareSuccess(false)
      shareTimeoutRef.current = null
    }, 3000)
  }, [])

  React.useEffect(() => {
    return () => {
      if (shareTimeoutRef.current !== null) {
        window.clearTimeout(shareTimeoutRef.current)
      }
    }
  }, [])
  const [isImageFullScreen, setIsImageFullScreen] = React.useState(false)
  const [zoom, setZoom] = React.useState(1)
  const [pan, setPan] = React.useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 })
  const imageRef = React.useRef<HTMLImageElement>(null)
  const imageContainerRef = React.useRef<HTMLDivElement>(null)
  const freqAmountRaw = plant.waterFreqAmount ?? plant.waterFreqValue
  const freqAmount = typeof freqAmountRaw === 'number' ? freqAmountRaw : Number(freqAmountRaw || 0)
  const freqPeriod = (plant.waterFreqPeriod || plant.waterFreqUnit) as 'day' | 'week' | 'month' | 'year' | undefined
  const care = plant.care ?? ({} as NonNullable<Plant['care']>)
  const derivedWater = deriveWaterLevelFromFrequency(freqPeriod, freqAmount) || care.water || 'Low'
  const freqLabel = freqPeriod
    ? `${freqAmount > 0 ? `${freqAmount} ${freqAmount === 1 ? t('plantInfo.time') : t('plantInfo.times')} ` : ''}${t('plantInfo.per')} ${t(`plantInfo.${freqPeriod}`)}`
    : null
  const phenology = plant.phenology ?? ({} as NonNullable<Plant['phenology']>)
  const environment = plant.environment ?? ({} as NonNullable<Plant['environment']>)
  const propagation = plant.propagation ?? ({} as NonNullable<Plant['propagation']>)
  const usage = plant.usage ?? ({} as NonNullable<Plant['usage']>)
  const ecology = plant.ecology ?? ({} as NonNullable<Plant['ecology']>)
  const problems = plant.problems ?? ({} as NonNullable<Plant['problems']>)
  const planting = plant.planting ?? ({} as NonNullable<Plant['planting']>)
  const meta = plant.meta ?? ({} as NonNullable<Plant['meta']>)
  const identifiers = plant.identifiers ?? ({} as NonNullable<Plant['identifiers']>)
  const traits = plant.traits ?? ({} as NonNullable<Plant['traits']>)
  const dimensions = plant.dimensions ?? ({} as NonNullable<Plant['dimensions']>)
  const seasons = Array.isArray(plant.seasons) ? plant.seasons : []
  const colors = Array.isArray(plant.colors) ? plant.colors : []
  const indoorOutdoorLabel = usage.indoorOutdoor
    ? t(`plantInfo.values.${usage.indoorOutdoor}`, { defaultValue: usage.indoorOutdoor })
    : null

  const notAvailableLabel = React.useMemo(
    () => t('plantInfo.values.notAvailable', { defaultValue: 'N/A' }),
    [t],
  )

  const humanize = React.useCallback((value: string) => {
    return value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }, [])

  const formatStatValue = React.useCallback((value?: string | null) => {
    if (!value) {
      return notAvailableLabel
    }
    const trimmed = value.trim()
    if (!trimmed) {
      return notAvailableLabel
    }
    const translated = t(`plantInfo.values.${trimmed}`, { defaultValue: '' })
    if (translated) {
      return translated
    }
    return humanize(trimmed)
  }, [humanize, notAvailableLabel, t])

  const formatFrequencyLabel = React.useCallback(
    (label?: string | null) => (label ? humanize(label) : undefined),
    [humanize],
  )

  const quickStats = [
    {
      key: 'sun',
      icon: <SunMedium className="h-4 w-4" />,
      label: t('plantInfo.sunlight'),
      value: formatStatValue(care?.sunlight),
    },
    {
      key: 'water',
      icon: <Droplets className="h-4 w-4" />,
      label: t('plantInfo.water'),
      value: formatStatValue(derivedWater),
      sub: formatFrequencyLabel(freqLabel),
    },
    {
      key: 'difficulty',
      icon: <Leaf className="h-4 w-4" />,
      label: t('plantInfo.difficulty'),
      value: formatStatValue(care?.difficulty),
    },
  ]

  if (indoorOutdoorLabel) {
    quickStats.push({
      key: 'indoorOutdoor',
      icon: <Home className="h-4 w-4" />,
      label: t('plantInfo.labels.location'),
      value: indoorOutdoorLabel,
    })
  }

  quickStats.push({
    key: 'seeds',
    icon: <Package className="h-4 w-4" />,
    label: t('plantInfo.seedsAvailable'),
    value: plant.seedsAvailable ? t('plantInfo.yes') : t('plantInfo.no'),
  })

  const heroImage = plant.image || (plant as any)?.image_url || ''
  const friendlyFrequency = React.useMemo(
    () => formatFrequencyLabel(freqLabel),
    [formatFrequencyLabel, freqLabel]
  )

  const careChartData = React.useMemo(() => {
    const data: Array<{ key: string; label: string; value: number; description: string }> = []
    const addEntry = (key: string, label: string, descriptor?: string | null, description?: string) => {
      if (!descriptor) return
      const score = descriptorScore(descriptor)
      if (score <= 0) return
      data.push({
        key,
        label,
        value: score,
        description: description ?? formatStatValue(descriptor),
      })
    }

    const sunlightDescriptor = care?.sunlight ?? environment.sunExposure
    if (sunlightDescriptor) {
      addEntry('sunlight', t('plantInfo.sunlight'), sunlightDescriptor, formatStatValue(sunlightDescriptor))
    }

    if (derivedWater) {
      const waterDescription = friendlyFrequency
        ? `${formatStatValue(derivedWater)} - ${friendlyFrequency}`
        : formatStatValue(derivedWater)
      addEntry('water', t('plantInfo.water'), derivedWater, waterDescription)
    }

    if (care?.difficulty) {
      addEntry('difficulty', t('plantInfo.difficulty'), care.difficulty, formatStatValue(care.difficulty))
    }

    if (care?.maintenanceLevel) {
      addEntry(
        'maintenance',
        t('plantInfo.labels.maintenanceLevel', { defaultValue: 'Maintenance' }),
        care.maintenanceLevel,
        formatStatValue(care.maintenanceLevel)
      )
    }

    if (environment?.humidityPref) {
      addEntry(
        'humidity',
        t('plantInfo.labels.humidityPreference', { defaultValue: 'Humidity' }),
        environment.humidityPref,
        formatStatValue(environment.humidityPref)
      )
    }

    return data
  }, [care?.sunlight, environment.sunExposure, derivedWater, friendlyFrequency, care?.difficulty, care?.maintenanceLevel, environment?.humidityPref, formatStatValue, t])

  const seasonTimelineData = React.useMemo(() => {
    return MONTH_KEYS.map((key, idx) => {
      const monthNumber = idx + 1
      return {
        key,
        month: t(`plantInfo.monthsShort.${key}`, { defaultValue: key.toUpperCase() }),
        flowering: phenology?.floweringMonths?.includes?.(monthNumber) ? 1 : 0,
        fruiting: phenology?.fruitingMonths?.includes?.(monthNumber) ? 1 : 0,
        sowing: planting?.calendar?.sowingMonths?.includes?.(monthNumber) ? 1 : 0,
      }
    })
  }, [phenology?.floweringMonths, phenology?.fruitingMonths, planting?.calendar?.sowingMonths, t])

  const hasSeasonTimeline = React.useMemo(
    () => seasonTimelineData.some((entry) => entry.flowering || entry.fruiting || entry.sowing),
    [seasonTimelineData]
  )

  const showColorMoodboard =
    colors.length > 0 ||
    (phenology?.flowerColors?.length ?? 0) > 0 ||
    (phenology?.leafColors?.length ?? 0) > 0

  const showIdentifiers = Boolean(
    identifiers?.scientificName ||
    identifiers?.canonicalName ||
    identifiers?.family ||
    identifiers?.genus ||
    identifiers?.taxonRank ||
    identifiers?.cultivar ||
    (identifiers?.commonNames?.length ?? 0) > 0 ||
    (identifiers?.synonyms?.length ?? 0) > 0 ||
    identifiers?.externalIds
  )

  const showTraits = Boolean(
    traits?.lifeCycle ||
    (traits?.habit?.length ?? 0) > 0 ||
    traits?.deciduousEvergreen ||
    traits?.growthRate ||
    traits?.thornsSpines ||
    (traits?.fragrance && traits.fragrance !== 'none') ||
    traits?.toxicity ||
    traits?.allergenicity ||
    (traits?.invasiveness?.status && traits.invasiveness.status !== 'not invasive')
  )

  const showDimensions = Boolean(
    dimensions?.height ||
    dimensions?.spread ||
    dimensions?.spacing ||
    dimensions?.containerFriendly !== undefined
  )

  const showPhenology = Boolean(
    (phenology?.flowerColors?.length ?? 0) > 0 ||
    (phenology?.leafColors?.length ?? 0) > 0 ||
    (phenology?.floweringMonths?.length ?? 0) > 0 ||
    (phenology?.fruitingMonths?.length ?? 0) > 0 ||
    (phenology?.scentNotes?.length ?? 0) > 0
  )

  const showEnvironment = Boolean(
    environment?.sunExposure ||
    environment?.lightIntensity ||
    environment?.hardiness ||
    (environment?.climatePref?.length ?? 0) > 0 ||
    environment?.temperature ||
    environment?.humidityPref ||
    environment?.windTolerance ||
    environment?.soil
  )

  const showCare = Boolean(
    care?.maintenanceLevel ||
    care?.watering?.method ||
    care?.watering?.depthCm ||
    care?.watering?.frequency ||
    care?.fertilizing ||
    care?.pruning ||
    care?.mulching ||
    care?.stakingSupport !== undefined ||
    care?.repottingIntervalYears
  )

  const showPropagation = Boolean(
    (propagation?.methods?.length ?? 0) > 0 ||
    propagation?.seed
  )

  const showUsage = Boolean(
    (usage?.gardenUses?.length ?? 0) > 0 ||
    usage?.indoorOutdoor ||
    (usage?.edibleParts?.length ?? 0) > 0 ||
    (usage?.culinaryUses?.length ?? 0) > 0 ||
    (usage?.medicinalUses?.length ?? 0) > 0
  )

  const showEcology = Boolean(
    (ecology?.nativeRange?.length ?? 0) > 0 ||
    (ecology?.pollinators?.length ?? 0) > 0 ||
    (ecology?.wildlifeValue?.length ?? 0) > 0 ||
    ecology?.conservationStatus
  )

  const showProblems = Boolean(
    (problems?.pests?.length ?? 0) > 0 ||
    (problems?.diseases?.length ?? 0) > 0 ||
    (problems?.hazards?.length ?? 0) > 0
  )

  const showPlanting = Boolean(
    planting?.calendar ||
    (planting?.sitePrep?.length ?? 0) > 0 ||
    (planting?.companionPlants?.length ?? 0) > 0 ||
    (planting?.avoidNear?.length ?? 0) > 0
  )

  const showMeta = Boolean(
    (meta?.tags?.length ?? 0) > 0 ||
    meta?.funFact ||
    (meta?.sourceReferences?.length ?? 0) > 0 ||
    meta?.authorNotes
  )

  const hasAnyStructuredData = showIdentifiers || showTraits || showDimensions || showPhenology || showEnvironment || showCare || showPropagation || showUsage || showEcology || showProblems || showPlanting || showMeta

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const baseUrl = window.location.origin
    const pathWithoutLang = `/plants/${plant.id}`
    const pathWithLang = currentLang === 'en' ? pathWithoutLang : `/${currentLang}${pathWithoutLang}`
    const shareUrl = `${baseUrl}${pathWithLang}`

    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl, title: plant.name, text: plant.description })
        showShareSuccess()
        return
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        if (typeof err === 'object' && err && 'name' in err && (err as { name?: string }).name === 'AbortError') {
          return
        }
        // fall through to clipboard copy
      }
    }

    if (navigator.clipboard?.writeText && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareUrl)
        showShareSuccess()
        return
      } catch (err) {
        console.warn('Clipboard API failed:', err)
      }
    }

    let execSuccess = false
    try {
      const textarea = document.createElement('textarea')
      textarea.value = shareUrl
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.top = '0'
      textarea.style.left = '0'
      textarea.style.width = '2px'
      textarea.style.height = '2px'
      textarea.style.opacity = '0'
      textarea.style.pointerEvents = 'none'

      const attachTarget = (e.currentTarget as HTMLElement)?.parentElement ?? document.body
      attachTarget.appendChild(textarea)

      try {
        textarea.focus({ preventScroll: true })
      } catch {
        textarea.focus()
      }
      textarea.select()
      textarea.setSelectionRange(0, shareUrl.length)

      execSuccess = document.execCommand('copy')
      if (textarea.parentNode) {
        textarea.parentNode.removeChild(textarea)
      }
    } catch (err) {
      console.warn('execCommand copy failed:', err)
    }

    if (execSuccess) {
      showShareSuccess()
      return
    }

    try {
      window.prompt(t('plantInfo.shareFailed'), shareUrl)
    } catch {
      // ignore if prompt not allowed
    }
  }

  const handleExpand = () => {
    const pathWithoutLang = `/plants/${plant.id}`
    const pathWithLang = currentLang === 'en' ? pathWithoutLang : `/${currentLang}${pathWithoutLang}`
    navigate(pathWithLang)
  }

  const handleBackToSearch = () => {
    navigate('/search')
  }

  const handleImageWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(1, Math.min(5, zoom * delta))
    
    // Zoom towards mouse position
    if (newZoom > 1 && zoom === 1) {
      const rect = imageRef.current?.getBoundingClientRect()
      if (rect) {
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const mouseX = e.clientX
        const mouseY = e.clientY
        
        setPan({
          x: (mouseX - centerX) * (1 - 1 / newZoom),
          y: (mouseY - centerY) * (1 - 1 / newZoom)
        })
      }
    }
    
    setZoom(newZoom)
    
    // Reset pan if zooming back to 1
    if (newZoom === 1) {
      setPan({ x: 0, y: 0 })
    }
  }

  const handleImageMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      e.preventDefault()
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleImageMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      e.preventDefault()
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleImageMouseUp = () => {
    setIsDragging(false)
  }

  const handleImageMouseLeave = () => {
    setIsDragging(false)
  }

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoom > 1 && e.touches.length === 1) {
      const touch = e.touches[0]
      setIsDragging(true)
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && zoom > 1 && e.touches.length === 1) {
      e.preventDefault()
      const touch = e.touches[0]
      setPan({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      })
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  React.useEffect(() => {
    if (!isImageFullScreen) {
      // Reset zoom and pan when closing
      setZoom(1)
      setPan({ x: 0, y: 0 })
      setIsDragging(false)
    }
  }, [isImageFullScreen])

  const renderQuickStats = (stats: typeof quickStats, columns = 'sm:grid-cols-2 xl:grid-cols-4') => (
    <div className={cn('grid gap-3', columns)}>
      {stats.map(({ key, icon, label, value, sub }, index) => (
        <Fact
          key={key}
          icon={icon}
          label={label}
          value={value}
          sub={sub}
          accentClass={FACT_ACCENTS[index % FACT_ACCENTS.length]}
        />
      ))}
    </div>
  )

  if (isOverlayMode) {
    const compactStats = quickStats.slice(0, 3)
    return (
      <div className="space-y-5 select-none">
        <div className="flex justify-end">
          <button
            onClick={handleExpand}
            type="button"
            aria-label="Expand to full page"
            className="h-9 w-9 rounded-full flex items-center justify-center border bg-white/90 dark:bg-[#2d2d30] dark:border-[#3e3e42] text-black dark:text-white hover:bg-white dark:hover:bg-[#3e3e42] transition shadow-sm"
            title="Expand to full page"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl overflow-hidden shadow relative">
            <div
              className="h-56 bg-cover bg-center select-none"
              style={{ backgroundImage: `url(${plant.image})`, userSelect: 'none' as any }}
              aria-label={plant.name}
            />
          </div>
          <div className="space-y-1 text-center">
            <h2 className="text-3xl font-bold leading-tight">{plant.name}</h2>
            <p className="italic text-base opacity-80">{plant.scientificName}</p>
          </div>
          {plant.meaning && (
            <Card className="rounded-3xl border border-stone-200 dark:border-[#3e3e42]">
              <CardHeader className="py-4">
                <CardTitle className="text-base font-semibold flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  {t('plantInfo.meaning')}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-center leading-relaxed">
                {plant.meaning}
              </CardContent>
            </Card>
          )}
          {renderQuickStats(compactStats, 'sm:grid-cols-3')}
          {(colors.length > 0 || seasons.length > 0) && (
            <div className="flex flex-wrap justify-center gap-2">
              {colors.map((c) => (
                <Badge key={c} variant="secondary" className="rounded-xl">{c}</Badge>
              ))}
              {seasons.map((s) => (
                <span key={s} className={`text-[11px] px-2 py-0.5 rounded-full ${seasonBadge[s] ?? 'bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100'}`}>{s}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" className="rounded-2xl px-6" onClick={handleExpand}>
            {t('plantInfo.viewFullDetails')}
          </Button>
          <Button className="rounded-2xl px-6" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    )
  }

    return (
      <div className="space-y-10 select-none">
        <section className="relative overflow-hidden rounded-[32px] border border-emerald-300/40 bg-gradient-to-br from-emerald-200/70 via-lime-100/60 to-sky-100/70 p-6 shadow-xl dark:border-emerald-700/30 dark:from-emerald-950/50 dark:via-emerald-900/40 dark:to-slate-950 md:p-10">
          <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-emerald-400/35 blur-3xl sm:h-72 sm:w-72" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-32 -right-16 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl md:h-96 md:w-[28rem]" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.45),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(14,165,233,0.25),transparent_60%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(20,83,45,0.45),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(2,132,199,0.25),transparent_60%)]" aria-hidden="true" />
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-emerald-800/80 dark:text-emerald-200/80">
                <button
                  onClick={handleBackToSearch}
                  type="button"
                  aria-label="Back to search"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/40 bg-white/80 text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-emerald-700/30 dark:bg-slate-900/70 dark:text-emerald-100"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                {plant.rarity && (
                  <Badge className={cn('rounded-xl border-none bg-emerald-500/10 px-3 py-1 text-emerald-700 dark:bg-emerald-700/40 dark:text-emerald-100', rarityTone[plant.rarity] ?? '')}>
                    {plant.rarity}
                  </Badge>
                )}
                {plant.seedsAvailable && (
                  <Badge className="rounded-xl border-none bg-emerald-500/10 px-3 py-1 text-emerald-700 dark:bg-emerald-700/40 dark:text-emerald-100">
                    {t('plantInfo.seedsAvailable')}
                  </Badge>
                )}
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold leading-tight tracking-tight text-emerald-900 sm:text-5xl dark:text-emerald-100">
                  {plant.name}
                </h1>
                {plant.scientificName && (
                  <p className="text-lg italic text-emerald-700/80 dark:text-emerald-200/80">
                    {plant.scientificName}
                  </p>
                )}
              </div>
              {plant.meaning && (
                <div className="flex items-start gap-3 rounded-2xl bg-white/65 px-4 py-3 text-sm leading-relaxed text-emerald-900 shadow-sm backdrop-blur-md dark:bg-slate-900/50 dark:text-emerald-100">
                  <span className="mt-0.5 rounded-full bg-emerald-500/20 p-2 text-emerald-600 dark:text-emerald-200">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <span>{plant.meaning}</span>
                </div>
              )}
              {plant.description && (
                <p className="max-w-2xl text-sm leading-relaxed text-emerald-900/90 md:text-base dark:text-emerald-100/80">
                  {plant.description}
                </p>
              )}
              {(seasons.length > 0 || colors.length > 0) && (
                <div className="flex flex-wrap gap-2">
                  {seasons.map((s) => (
                    <span
                      key={s}
                      className={cn(
                        'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide',
                        seasonBadge[s] ?? 'bg-emerald-200/70 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100'
                      )}
                    >
                      {s}
                    </span>
                  ))}
                  {colors.slice(0, 6).map((c) => (
                    <Badge
                      key={c}
                      variant="secondary"
                      className="rounded-xl border-none bg-white/80 text-emerald-900 shadow-sm dark:bg-slate-900/60 dark:text-emerald-100"
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={(e) => handleShare(e)}
                  variant="outline"
                  className={cn(
                    'rounded-2xl border-emerald-500/30 bg-white/80 px-5 text-sm font-semibold text-emerald-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md dark:border-emerald-700/40 dark:bg-slate-900/70 dark:text-emerald-100',
                    shareSuccess && 'border-emerald-500/70 bg-emerald-500/90 text-white hover:bg-emerald-500 dark:bg-emerald-500/70'
                  )}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  {shareSuccess ? t('plantInfo.shareCopied') : t('plantInfo.share')}
                </Button>
                <Button
                  type="button"
                  onClick={() => onToggleLike?.()}
                  className={cn(
                    'rounded-2xl border-rose-500/30 bg-rose-500/10 px-5 text-sm font-semibold text-rose-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-500/20 hover:shadow-md dark:border-rose-500/40 dark:bg-rose-500/20 dark:text-rose-100',
                    liked && 'border-rose-500 bg-rose-500 text-white hover:bg-rose-500'
                  )}
                >
                  <Heart className={cn('mr-2 h-4 w-4', liked && 'fill-current')} />
                  {liked ? t('plantInfo.unlike') : t('plantInfo.like')}
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute -top-8 -left-10 h-24 w-24 rounded-full bg-white/50 blur-2xl dark:bg-emerald-500/25" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-12 right-6 h-32 w-32 rounded-full bg-emerald-400/40 blur-3xl sm:h-44 sm:w-44 dark:bg-emerald-500/30" aria-hidden="true" />
              <div
                className={cn(
                  'group relative overflow-hidden rounded-[28px] border border-white/50 bg-white/80 shadow-[0_24px_60px_rgba(16,185,129,0.35)] transition hover:shadow-[0_28px_70px_rgba(16,185,129,0.45)] dark:border-white/10 dark:bg-slate-900/70',
                  heroImage ? 'cursor-zoom-in' : 'cursor-default'
                )}
                role={heroImage ? 'button' : undefined}
                tabIndex={heroImage ? 0 : undefined}
                onClick={() => heroImage && setIsImageFullScreen(true)}
                onKeyDown={(e) => {
                  if (heroImage && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    setIsImageFullScreen(true)
                  }
                }}
                aria-label={heroImage ? t('plantInfo.viewFullScreen') : undefined}
              >
                {heroImage ? (
                  <img
                    src={heroImage}
                    alt={plant.name}
                    className="max-h-[420px] w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="flex h-[320px] items-center justify-center text-emerald-700/80 dark:text-emerald-200/70">
                    <Leaf className="mr-2 h-6 w-6" />
                    {t('plantInfo.overview')}
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-900/40 via-transparent to-emerald-700/20 dark:from-emerald-900/60" />
              </div>
              <div className="absolute -bottom-8 left-1/2 z-10 flex w-[min(20rem,90%)] -translate-x-1/2 gap-3 rounded-2xl border border-emerald-500/20 bg-white/90 p-4 text-sm shadow-xl backdrop-blur-md dark:border-emerald-700/30 dark:bg-slate-900/80">
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-widest text-emerald-500/80 dark:text-emerald-300/70">
                    {t('plantInfo.water')}
                  </div>
                  <div className="font-semibold text-emerald-800 dark:text-emerald-100">{formatStatValue(derivedWater)}</div>
                  {friendlyFrequency && (
                    <div className="text-xs text-emerald-600/80 dark:text-emerald-200/70">{friendlyFrequency}</div>
                  )}
                </div>
                {care?.difficulty && (
                  <div className="flex-1">
                    <div className="text-[10px] uppercase tracking-widest text-emerald-500/80 dark:text-emerald-300/70">
                      {t('plantInfo.difficulty')}
                    </div>
                    <div className="font-semibold text-emerald-800 dark:text-emerald-100">{formatStatValue(care.difficulty)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
        <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-200">
          <Sparkles className="h-5 w-5" />
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
            {t('plantInfo.overview')} - {t('plantInfo.careGuide')}
          </h2>
        </div>
          {renderQuickStats(quickStats, 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5')}
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-emerald-200/40 bg-white/90 p-6 shadow-md backdrop-blur-md dark:border-emerald-700/30 dark:bg-slate-950/70">
              <header className="mb-4 flex items-center gap-3 text-emerald-800 dark:text-emerald-100">
                <Info className="h-5 w-5" />
                <h3 className="text-lg font-semibold tracking-tight">{t('plantInfo.overview')}</h3>
              </header>
              {plant.description && (
                <p className="text-sm leading-relaxed text-stone-700 md:text-base dark:text-stone-200">
                  {plant.description}
                </p>
              )}
              {plant.meaning && (
                <div className="mt-5 rounded-2xl bg-gradient-to-r from-emerald-200/70 via-white/80 to-emerald-100/60 p-4 text-sm text-emerald-900 shadow-sm dark:from-emerald-900/40 dark:via-slate-900/60 dark:to-emerald-800/30 dark:text-emerald-100">
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-300">
                    <Sparkles className="h-4 w-4" />
                    {t('plantInfo.meaning')}
                  </div>
                  <div className="text-base leading-relaxed">{plant.meaning}</div>
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge
                  className={cn(
                    'rounded-xl border-none bg-emerald-500/10 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100',
                    rarityTone[plant.rarity || 'Common'] ?? ''
                  )}
                >
                  {plant.rarity || t('common.unknown')}
                </Badge>
                {seasons.map((s) => (
                  <span
                    key={s}
                    className={cn(
                      'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide',
                      seasonBadge[s] ?? 'bg-emerald-200/70 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100'
                    )}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </section>

            {careChartData.length > 0 && <CareChartSection data={careChartData} />}

            {hasSeasonTimeline && <SeasonalTimeline data={seasonTimelineData} planting={planting?.calendar} />}
          </div>

          <div className="space-y-6">
            {showColorMoodboard && (
              <ColorMoodboard
                generalColors={colors}
                flowerColors={phenology?.flowerColors ?? []}
                leafColors={phenology?.leafColors ?? []}
              />
            )}
            <HabitatMap
              nativeRange={ecology?.nativeRange ?? []}
              climatePref={environment?.climatePref ?? []}
              zones={environment?.hardiness?.usdaZones ?? []}
              hemisphere={planting?.calendar?.hemisphere}
            />
          </div>
        </div>

        {hasAnyStructuredData && (
          <section className="rounded-[32px] border border-emerald-200/40 bg-white/90 p-6 shadow-lg backdrop-blur-md dark:border-emerald-700/30 dark:bg-slate-950/70">
            <header className="mb-6 flex items-center gap-3 text-emerald-800 dark:text-emerald-100">
              <BookOpen className="h-5 w-5" />
              <h3 className="text-xl font-semibold tracking-tight">{t('plantInfo.moreInformation')}</h3>
            </header>
            <div className="grid gap-6 xl:grid-cols-2">
          {/* Identifiers Section */}
            {(identifiers?.scientificName || identifiers?.family || identifiers?.genus || identifiers?.commonNames?.length || identifiers?.synonyms?.length || identifiers?.externalIds) && (
                <InfoSection title="Identifiers" icon={<Flower2 className="h-5 w-5" />}>
                  {identifiers?.scientificName && (
                    <InfoItem icon={<Info className="h-4 w-4" />} label="Scientific Name" value={identifiers.scientificName} />
                  )}
                {identifiers?.canonicalName && (
                    <InfoItem icon={<FileText className="h-4 w-4" />} label="Canonical Name" value={identifiers.canonicalName} />
              )}
                {identifiers?.family && (
                    <InfoItem icon={<Users className="h-4 w-4" />} label="Family" value={identifiers.family} />
              )}
                {identifiers?.genus && (
                    <InfoItem icon={<Tag className="h-4 w-4" />} label="Genus" value={identifiers.genus} />
              )}
                {identifiers?.taxonRank && (
                    <InfoItem icon={<Tag className="h-4 w-4" />} label="Taxon Rank" value={identifiers.taxonRank} />
              )}
                {identifiers?.cultivar && (
                    <InfoItem icon={<Sprout className="h-4 w-4" />} label="Cultivar" value={identifiers.cultivar} />
              )}
                {(identifiers.commonNames?.length ?? 0) > 0 && (
                    <InfoItem icon={<Globe className="h-4 w-4" />} label="Common Names" value={(identifiers.commonNames ?? []).join(', ')} />
                )}
                {(identifiers.synonyms?.length ?? 0) > 0 && (
                    <InfoItem icon={<FileText className="h-4 w-4" />} label="Synonyms" value={(identifiers.synonyms ?? []).join(', ')} />
                )}
                {identifiers?.externalIds && (
                <div className="space-y-2">
                    {identifiers.externalIds.wiki && (
                        <InfoItem icon={<Globe className="h-4 w-4" />} label="Wikipedia" value={<a href={identifiers.externalIds.wiki} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{t('plantInfo.values.viewLink', { defaultValue: 'View' })}</a>} />
                  )}
                    {identifiers.externalIds.gbif && (
                        <InfoItem icon={<Info className="h-4 w-4" />} label="GBIF ID" value={identifiers.externalIds.gbif} />
                  )}
                    {identifiers.externalIds.powo && (
                        <InfoItem icon={<Info className="h-4 w-4" />} label="POWO ID" value={identifiers.externalIds.powo} />
                  )}
                </div>
              )}
            </InfoSection>
          )}

          {/* Traits Section */}
          {(traits?.lifeCycle || traits?.habit?.length || traits?.growthRate || traits?.toxicity || traits?.fragrance || traits?.allergenicity) && (
              <InfoSection title="Traits" icon={<Leaf className="h-5 w-5" />}>
              {traits?.lifeCycle && (
                <InfoItem icon={<Calendar className="h-4 w-4" />} label="Life Cycle" value={traits.lifeCycle} />
              )}
              {traits?.habit?.length && (
                <InfoItem icon={<Sprout className="h-4 w-4" />} label="Habit" value={traits.habit?.join(', ') || ''} />
              )}
              {traits?.deciduousEvergreen && (
                <InfoItem icon={<Leaf className="h-4 w-4" />} label="Foliage" value={traits.deciduousEvergreen} />
              )}
              {traits?.growthRate && (
                <InfoItem icon={<Sparkles className="h-4 w-4" />} label="Growth Rate" value={traits.growthRate} />
              )}
              {traits?.thornsSpines && (
                <InfoItem icon={<AlertTriangle className="h-4 w-4" />} label="Thorns/Spines" value="Yes" />
              )}
              {traits?.fragrance && traits.fragrance !== 'none' && (
                <InfoItem icon={<Flower2 className="h-4 w-4" />} label="Fragrance" value={traits.fragrance} />
              )}
              {traits?.toxicity && (
                <div className="space-y-2">
                  {traits.toxicity.toHumans && traits.toxicity.toHumans !== 'non-toxic' && (
                    <InfoItem icon={<AlertCircle className="h-4 w-4" />} label="Toxicity to Humans" value={traits.toxicity.toHumans} />
                  )}
                  {traits.toxicity.toPets && traits.toxicity.toPets !== 'non-toxic' && (
                    <InfoItem icon={<AlertCircle className="h-4 w-4" />} label="Toxicity to Pets" value={traits.toxicity.toPets} />
                  )}
                </div>
              )}
              {traits?.allergenicity && (
                <InfoItem icon={<AlertCircle className="h-4 w-4" />} label="Allergenicity" value={traits.allergenicity} />
              )}
              {traits?.invasiveness?.status && traits.invasiveness.status !== 'not invasive' && (
                <InfoItem icon={<AlertTriangle className="h-4 w-4" />} label="Invasiveness" value={`${traits.invasiveness.status}${traits.invasiveness.regions?.length ? ` (${traits.invasiveness.regions.join(', ')})` : ''}`} />
              )}
            </InfoSection>
          )}

          {/* Dimensions Section */}
          {(dimensions?.height || dimensions?.spread || dimensions?.spacing || dimensions?.containerFriendly !== undefined) && (
              <InfoSection title="Dimensions" icon={<Ruler className="h-5 w-5" />}>
              {dimensions?.height && (
                <InfoItem icon={<Ruler className="h-4 w-4" />} label="Height" value={`${dimensions.height.minCm || ''}${dimensions.height.minCm && dimensions.height.maxCm ? '-' : ''}${dimensions.height.maxCm || ''} cm`} />
              )}
              {dimensions?.spread && (
                <InfoItem icon={<Ruler className="h-4 w-4" />} label="Spread" value={`${dimensions.spread.minCm || ''}${dimensions.spread.minCm && dimensions.spread.maxCm ? '-' : ''}${dimensions.spread.maxCm || ''} cm`} />
              )}
                {dimensions?.spacing && (
                  <InfoItem
                    icon={<Ruler className="h-4 w-4" />}
                    label="Spacing"
                    value={t('plantInfo.values.spacing', {
                      row: dimensions.spacing.rowCm ?? t('plantInfo.values.notAvailable', { defaultValue: 'N/A' }),
                      plant: dimensions.spacing.plantCm ?? t('plantInfo.values.notAvailable', { defaultValue: 'N/A' }),
                      defaultValue: 'Row: {{row}} cm, Plant: {{plant}} cm',
                    })}
                  />
              )}
                {dimensions?.containerFriendly !== undefined && (
                  <InfoItem icon={<Package className="h-4 w-4" />} label="Container Friendly" value={dimensions.containerFriendly ? t('plantInfo.yes') : t('plantInfo.no')} />
              )}
            </InfoSection>
          )}

          {/* Phenology Section */}
          {(phenology.flowerColors?.length || phenology.leafColors?.length || phenology.floweringMonths?.length || phenology.fruitingMonths?.length || phenology.scentNotes?.length) && (
              <InfoSection title="Phenology" icon={<Calendar className="h-5 w-5" />}>
              {phenology.flowerColors?.length && (
                <InfoItem icon={<Flower2 className="h-4 w-4" />} label="Flower Colors" value={
                  <div className="flex flex-wrap gap-2">
                    {(phenology.flowerColors ?? []).map((color, idx) => (
                      <span key={idx} className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-[#2d2d30] text-sm flex items-center gap-1">
                        {color.hex && <span className="w-3 h-3 rounded-full border border-stone-300" style={{ backgroundColor: color.hex }} />}
                        {color.name}
                      </span>
                    ))}
                  </div>
                } />
              )}
              {phenology.leafColors?.length && (
                <InfoItem icon={<Leaf className="h-4 w-4" />} label="Leaf Colors" value={
                  <div className="flex flex-wrap gap-2">
                    {(phenology.leafColors ?? []).map((color, idx) => (
                      <span key={idx} className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-[#2d2d30] text-sm flex items-center gap-1">
                        {color.hex && <span className="w-3 h-3 rounded-full border border-stone-300" style={{ backgroundColor: color.hex }} />}
                        {color.name}
                      </span>
                    ))}
                  </div>
                } />
              )}
                {phenology.floweringMonths?.length && (
                  <InfoItem icon={<Flower2 className="h-4 w-4" />} label="Flowering Months" value={formatMonths(phenology.floweringMonths ?? [], t)} />
              )}
              {phenology.fruitingMonths?.length && (
                  <InfoItem icon={<Package className="h-4 w-4" />} label="Fruiting Months" value={formatMonths(phenology.fruitingMonths ?? [], t)} />
              )}
              {phenology.scentNotes?.length && (
                <InfoItem icon={<Flower2 className="h-4 w-4" />} label="Scent Notes" value={(phenology.scentNotes ?? []).join(', ')} />
              )}
            </InfoSection>
          )}

          {/* Environment Section */}
          {(environment.sunExposure || environment.hardiness || environment.climatePref?.length || environment.temperature || environment.soil) && (
              <InfoSection title="Environment" icon={<MapPin className="h-5 w-5" />}>
              {environment.sunExposure && (
                <InfoItem icon={<SunMedium className="h-4 w-4" />} label="Sun Exposure" value={environment.sunExposure} />
              )}
              {environment.lightIntensity && (
                <InfoItem icon={<SunMedium className="h-4 w-4" />} label="Light Intensity" value={environment.lightIntensity} />
              )}
              {environment.hardiness && (
                <div className="space-y-2">
                  {environment.hardiness.usdaZones?.length && (
                    <InfoItem icon={<Shield className="h-4 w-4" />} label="USDA Zones" value={(environment.hardiness.usdaZones ?? []).join(', ')} />
                  )}
                  {environment.hardiness.rhsH && (
                    <InfoItem icon={<Shield className="h-4 w-4" />} label="RHS Hardiness" value={environment.hardiness.rhsH} />
                  )}
                </div>
              )}
              {environment.climatePref?.length && (
                <InfoItem icon={<Globe className="h-4 w-4" />} label="Climate Preference" value={environment.climatePref.join(', ')} />
              )}
                {environment.temperature && (
                  <InfoItem
                    icon={<Thermometer className="h-4 w-4" />}
                    label="Temperature Range"
                    value={t('plantInfo.values.temperatureRange', {
                      min: environment.temperature.minC ?? '',
                      max: environment.temperature.maxC ?? '',
                      defaultValue: '{{min}}{{dash}}{{max}}°C',
                      dash: environment.temperature.minC && environment.temperature.maxC ? '-' : '',
                    })}
                  />
              )}
              {environment.humidityPref && (
                <InfoItem icon={<Droplets className="h-4 w-4" />} label="Humidity Preference" value={environment.humidityPref} />
              )}
              {environment.windTolerance && (
                <InfoItem icon={<Wind className="h-4 w-4" />} label="Wind Tolerance" value={environment.windTolerance} />
              )}
              {environment.soil && (
                <div className="space-y-2">
                  {environment.soil.texture?.length && (
                    <InfoItem icon={<Leaf className="h-4 w-4" />} label="Soil Texture" value={environment.soil.texture.join(', ')} />
                  )}
                  {environment.soil.drainage && (
                    <InfoItem icon={<Droplets className="h-4 w-4" />} label="Soil Drainage" value={environment.soil.drainage} />
                  )}
                  {environment.soil.fertility && (
                    <InfoItem icon={<Sprout className="h-4 w-4" />} label="Soil Fertility" value={environment.soil.fertility} />
                  )}
                  {environment.soil.pH && (
                    <InfoItem icon={<Info className="h-4 w-4" />} label="Soil pH" value={`${environment.soil.pH.min || ''}${environment.soil.pH.min && environment.soil.pH.max ? '-' : ''}${environment.soil.pH.max || ''}`} />
                  )}
                </div>
              )}
            </InfoSection>
          )}

          {/* Care Section - Extended */}
          {(care.maintenanceLevel || care.watering?.method || care.fertilizing || care.pruning || care.mulching || care.stakingSupport !== undefined || care.repottingIntervalYears) && (
              <InfoSection title="Care Details" icon={<Sprout className="h-5 w-5" />}>
              {care.maintenanceLevel && (
                <InfoItem icon={<Info className="h-4 w-4" />} label="Maintenance Level" value={care.maintenanceLevel} />
              )}
              {care.watering?.method && (
                <InfoItem icon={<Droplet className="h-4 w-4" />} label="Watering Method" value={care.watering.method} />
              )}
              {care.watering?.depthCm && (
                <InfoItem icon={<Droplet className="h-4 w-4" />} label="Watering Depth" value={`${care.watering.depthCm} cm`} />
              )}
              {care.watering?.frequency && (
                <div className="space-y-2">
                  {care.watering.frequency.winter && (
                    <InfoItem icon={<Droplet className="h-4 w-4" />} label="Winter Watering" value={care.watering.frequency.winter} />
                  )}
                  {care.watering.frequency.spring && (
                    <InfoItem icon={<Droplet className="h-4 w-4" />} label="Spring Watering" value={care.watering.frequency.spring} />
                  )}
                  {care.watering.frequency.summer && (
                    <InfoItem icon={<Droplet className="h-4 w-4" />} label="Summer Watering" value={care.watering.frequency.summer} />
                  )}
                  {care.watering.frequency.autumn && (
                    <InfoItem icon={<Droplet className="h-4 w-4" />} label="Autumn Watering" value={care.watering.frequency.autumn} />
                  )}
                </div>
              )}
              {care.fertilizing && (
                <div className="space-y-2">
                  {care.fertilizing.type && (
                    <InfoItem icon={<Sprout className="h-4 w-4" />} label="Fertilizer Type" value={care.fertilizing.type} />
                  )}
                  {care.fertilizing.schedule && (
                    <InfoItem icon={<Calendar className="h-4 w-4" />} label="Fertilizing Schedule" value={care.fertilizing.schedule} />
                  )}
                </div>
              )}
              {care.pruning && (
                <div className="space-y-2">
                    {care.pruning.bestMonths?.length && (
                      <InfoItem icon={<Scissors className="h-4 w-4" />} label="Best Pruning Months" value={formatMonths(care.pruning.bestMonths ?? [], t)} />
                  )}
                  {care.pruning.method && (
                    <InfoItem icon={<Scissors className="h-4 w-4" />} label="Pruning Method" value={care.pruning.method} />
                  )}
                </div>
              )}
              {care.mulching && (
                <div className="space-y-2">
                    {care.mulching.recommended !== undefined && (
                      <InfoItem icon={<Leaf className="h-4 w-4" />} label="Mulching Recommended" value={care.mulching.recommended ? t('plantInfo.yes') : t('plantInfo.no')} />
                  )}
                  {care.mulching.material && (
                    <InfoItem icon={<Leaf className="h-4 w-4" />} label="Mulching Material" value={care.mulching.material} />
                  )}
                </div>
              )}
                {care.stakingSupport !== undefined && (
                  <InfoItem icon={<Sprout className="h-4 w-4" />} label="Staking Support" value={care.stakingSupport ? t('plantInfo.values.stakingRequired', { defaultValue: 'Required' }) : t('plantInfo.values.stakingNotRequired', { defaultValue: 'Not Required' })} />
              )}
                {care.repottingIntervalYears && (
                  <InfoItem icon={<Package className="h-4 w-4" />} label="Repotting Interval" value={t('plantInfo.values.repottingInterval', { count: care.repottingIntervalYears, defaultValue: 'Every {{count}} years' })} />
              )}
            </InfoSection>
          )}

          {/* Propagation Section */}
          {(propagation.methods?.length || propagation.seed) && (
              <InfoSection title="Propagation" icon={<Sprout className="h-5 w-5" />}>
              {propagation.methods?.length && (
                <InfoItem icon={<Sprout className="h-4 w-4" />} label="Methods" value={propagation.methods.join(', ')} />
              )}
              {propagation.seed && (
                <div className="space-y-2">
                  {propagation.seed.stratification && (
                    <InfoItem icon={<Sprout className="h-4 w-4" />} label="Seed Stratification" value={propagation.seed.stratification} />
                  )}
                    {propagation.seed.germinationDays && (
                      <InfoItem
                        icon={<Calendar className="h-4 w-4" />}
                        label="Germination Days"
                        value={t('plantInfo.values.germinationDays', {
                          min: propagation.seed.germinationDays.min ?? '',
                          max: propagation.seed.germinationDays.max ?? '',
                          defaultValue: '{{min}}{{dash}}{{max}}',
                          dash: propagation.seed.germinationDays.min && propagation.seed.germinationDays.max ? '-' : '',
                        })}
                      />
                  )}
                </div>
              )}
            </InfoSection>
          )}

          {/* Usage Section */}
          {(usage.gardenUses?.length || usage.indoorOutdoor || usage.edibleParts?.length || usage.culinaryUses?.length || usage.medicinalUses?.length) && (
              <InfoSection title="Usage" icon={<Flower2 className="h-5 w-5" />}>
              {usage.gardenUses?.length && (
                <InfoItem icon={<Sprout className="h-4 w-4" />} label="Garden Uses" value={usage.gardenUses.join(', ')} />
              )}
              {usage.indoorOutdoor && (
                <InfoItem icon={<MapPin className="h-4 w-4" />} label="Location" value={usage.indoorOutdoor} />
              )}
              {usage.edibleParts?.length && (
                <InfoItem icon={<Package className="h-4 w-4" />} label="Edible Parts" value={usage.edibleParts.join(', ')} />
              )}
              {usage.culinaryUses?.length && (
                <InfoItem icon={<Package className="h-4 w-4" />} label="Culinary Uses" value={usage.culinaryUses.join(', ')} />
              )}
              {usage.medicinalUses?.length && (
                <InfoItem icon={<Heart className="h-4 w-4" />} label="Medicinal Uses" value={usage.medicinalUses.join(', ')} />
              )}
            </InfoSection>
          )}

          {/* Ecology Section */}
          {(ecology.nativeRange?.length || ecology.pollinators?.length || ecology.wildlifeValue?.length || ecology.conservationStatus) && (
              <InfoSection title="Ecology" icon={<Globe className="h-5 w-5" />}>
              {ecology.nativeRange?.length && (
                <InfoItem icon={<MapPin className="h-4 w-4" />} label="Native Range" value={ecology.nativeRange.join(', ')} />
              )}
              {ecology.pollinators?.length && (
                <InfoItem icon={<Sparkles className="h-4 w-4" />} label="Pollinators" value={ecology.pollinators.join(', ')} />
              )}
              {ecology.wildlifeValue?.length && (
                <InfoItem icon={<Heart className="h-4 w-4" />} label="Wildlife Value" value={ecology.wildlifeValue.join(', ')} />
              )}
              {ecology.conservationStatus && (
                <InfoItem icon={<Shield className="h-4 w-4" />} label="Conservation Status" value={ecology.conservationStatus} />
              )}
            </InfoSection>
          )}

          {/* Problems Section */}
          {(problems.pests?.length || problems.diseases?.length || problems.hazards?.length) && (
              <InfoSection title="Problems" icon={<AlertTriangle className="h-5 w-5" />}>
              {problems.pests?.length && (
                <InfoItem icon={<Bug className="h-4 w-4" />} label="Pests" value={problems.pests.join(', ')} />
              )}
              {problems.diseases?.length && (
                <InfoItem icon={<AlertCircle className="h-4 w-4" />} label="Diseases" value={problems.diseases.join(', ')} />
              )}
              {problems.hazards?.length && (
                <InfoItem icon={<AlertTriangle className="h-4 w-4" />} label="Hazards" value={problems.hazards.join(', ')} />
              )}
            </InfoSection>
          )}

          {/* Planting Section */}
          {(planting.calendar || planting.sitePrep?.length || planting.companionPlants?.length || planting.avoidNear?.length) && (
              <InfoSection title="Planting" icon={<Sprout className="h-5 w-5" />}>
              {planting.calendar && (
                <div className="space-y-2">
                  {planting.calendar.hemisphere && (
                    <InfoItem icon={<Globe className="h-4 w-4" />} label="Hemisphere" value={planting.calendar.hemisphere} />
                  )}
                    {planting.calendar.sowingMonths?.length && (
                      <InfoItem icon={<Calendar className="h-4 w-4" />} label="Sowing Months" value={formatMonths(planting.calendar.sowingMonths ?? [], t)} />
                  )}
                  {planting.calendar.plantingOutMonths?.length && (
                      <InfoItem icon={<Calendar className="h-4 w-4" />} label="Planting Out Months" value={formatMonths(planting.calendar.plantingOutMonths ?? [], t)} />
                  )}
                  {planting.calendar.promotionMonth && (
                      <InfoItem icon={<Sparkles className="h-4 w-4" />} label="Promotion Month" value={formatMonths([planting.calendar.promotionMonth], t)} />
                  )}
                </div>
              )}
              {planting.sitePrep?.length && (
                <InfoItem icon={<Sprout className="h-4 w-4" />} label="Site Preparation" value={planting.sitePrep.join(', ')} />
              )}
              {planting.companionPlants?.length && (
                <InfoItem icon={<Users className="h-4 w-4" />} label="Companion Plants" value={planting.companionPlants.join(', ')} />
              )}
              {planting.avoidNear?.length && (
                <InfoItem icon={<AlertTriangle className="h-4 w-4" />} label="Avoid Planting Near" value={planting.avoidNear.join(', ')} />
              )}
            </InfoSection>
          )}

          {/* Meta Section */}
            {(meta.tags?.length || meta.funFact || meta.sourceReferences?.length || meta.authorNotes) && (
              <InfoSection title="Additional Information" icon={<BookOpen className="h-5 w-5" />}>
                {meta.tags?.length && (
                  <InfoItem icon={<Tag className="h-4 w-4" />} label="Tags" value={
                    <div className="flex flex-wrap gap-2">
                      {meta.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="rounded-xl">{tag}</Badge>
                      ))}
                    </div>
                  } />
                )}
                {meta.funFact && (
                  <InfoItem icon={<Sparkles className="h-4 w-4" />} label="Fun Fact" value={meta.funFact} />
                )}
                {meta.sourceReferences?.length && (
                  <InfoItem icon={<BookOpen className="h-4 w-4" />} label="Source References" value={
                    <ul className="list-disc list-inside space-y-1">
                      {meta.sourceReferences.map((ref, idx) => (
                        <li key={idx} className="text-sm">{ref}</li>
                      ))}
                    </ul>
                  } />
                )}
                {meta.authorNotes && (
                  <InfoItem icon={<FileText className="h-4 w-4" />} label="Author Notes" value={meta.authorNotes} />
                )}
              </InfoSection>
            )}
          </div>
        </section>
        )}

        <div className="flex flex-wrap items-center gap-3 rounded-[28px] border border-emerald-200/40 bg-white/90 p-4 shadow-sm backdrop-blur-md dark:border-emerald-700/30 dark:bg-slate-950/70">
          {user && profile?.is_admin && (
            <Button
              variant="destructive"
              className="rounded-2xl"
              onClick={async () => {
                const yes = window.confirm(t('plantInfo.deleteConfirm'))
                if (!yes) return
                const { error } = await supabase.from('plants').delete().eq('id', plant.id)
                if (error) { alert(error.message); return }
                onClose()
                try { window.dispatchEvent(new CustomEvent('plants:refresh')) } catch {}
              }}
            >
              {t('common.delete')}
            </Button>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            {onRequestPlant && (
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={onRequestPlant}
              >
                {t('requestPlant.button')}
              </Button>
            )}
            {user && profile?.is_admin && (
              <Button
                variant="secondary"
                className="rounded-2xl"
                onClick={() => {
                  navigate(`/plants/${plant.id}/edit`)
                }}
              >
                {t('common.edit')}
              </Button>
            )}
            <Button className="rounded-2xl" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </div>

        {/* Full-screen image viewer - only show when not in overlay mode */}
        {!isOverlayMode && (
          <Dialog open={isImageFullScreen} onOpenChange={setIsImageFullScreen}>
            <DialogContent
              className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 !bg-transparent border-none rounded-none !translate-x-0 !translate-y-0 !left-0 !top-0"
            >
              {/* Override overlay and hide default close button */}
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                    [data-radix-dialog-content] > button[data-radix-dialog-close] {
                      display: none !important;
                    }
                    [data-radix-dialog-overlay] {
                      background-color: rgba(0, 0, 0, 0.6) !important;
                      cursor: pointer;
                    }
                  `
                }}
              />

              {/* Close button - fixed position */}
              <button
                onClick={() => setIsImageFullScreen(false)}
                className="fixed top-4 right-4 z-[100] h-12 w-12 rounded-full bg-black/80 hover:bg-black flex items-center justify-center transition-all shadow-lg hover:scale-110"
                aria-label={t('common.close')}
              >
                <X className="h-6 w-6 text-white stroke-[2.5]" />
              </button>

              {/* Background area - clickable to close */}
              <div
                className="absolute inset-0 flex items-center justify-center overflow-hidden"
                onClick={(e) => {
                  if (imageContainerRef.current) {
                    const rect = imageContainerRef.current.getBoundingClientRect()
                    const clickX = e.clientX
                    const clickY = e.clientY
                    if (
                      clickX < rect.left ||
                      clickX > rect.right ||
                      clickY < rect.top ||
                      clickY > rect.bottom
                    ) {
                      setIsImageFullScreen(false)
                    }
                  }
                }}
              >
                {/* Image container with zoom and pan */}
                <div
                  ref={imageContainerRef}
                  data-image-container
                  className="pointer-events-auto flex items-center justify-center touch-none"
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                  onWheel={handleImageWheel}
                  onMouseMove={handleImageMouseMove}
                  onMouseUp={handleImageMouseUp}
                  onMouseLeave={handleImageMouseLeave}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    ref={imageRef}
                    src={plant.image}
                    alt={plant.name}
                    className={`max-w-full max-h-full select-none object-contain ${zoom > 1 ? 'cursor-move' : 'cursor-zoom-in'}`}
                    style={{
                      transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                      transformOrigin: 'center center',
                      transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                    }}
                    onMouseDown={handleImageMouseDown}
                    draggable={false}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  };

type CareChartDatum = {
  key: string
  label: string
  value: number
  description: string
}

const CareChartSection: React.FC<{ data: CareChartDatum[] }> = ({ data }) => {
  const { t } = useTranslation('common')
  if (!data.length) return null

  return (
    <section className="rounded-[28px] border border-emerald-200/40 bg-white/90 p-6 shadow-md backdrop-blur-md dark:border-emerald-700/30 dark:bg-slate-950/70">
      <header className="mb-5 flex items-center gap-3 text-emerald-800 dark:text-emerald-100">
        <BarChart3 className="h-5 w-5" />
        <h3 className="text-lg font-semibold tracking-tight">{t('plantInfo.careGuide', { defaultValue: 'Care Guide' })}</h3>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-emerald-700/80 dark:text-emerald-200/70">
            {t('plantInfo.labels.careSummary', { defaultValue: "Visualize the plant's energy needs - sunlight, water, and routine - before you get your hands muddy." })}
          </p>
          <ul className="space-y-3">
            {data.map((item, idx) => (
              <li key={item.key} className="flex items-start gap-3">
                <span
                  className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: CARE_BAR_COLORS[idx % CARE_BAR_COLORS.length] }}
                />
                <div>
                  <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{item.label}</div>
                  <div className="text-xs text-emerald-700/80 dark:text-emerald-200/70">{item.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="h-56 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,185,129,0.18)" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12 }} />
              <YAxis hide domain={[0, 5]} />
              <RechartsTooltip cursor={{ fill: 'rgba(16,185,129,0.08)' }} content={<CareChartTooltip />} />
              <Bar dataKey="value" radius={[18, 18, 18, 18]} barSize={32}>
                {data.map((entry, idx) => (
                  <Cell key={entry.key} fill={CARE_BAR_COLORS[idx % CARE_BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

const CareChartTooltip: React.FC<TooltipProps<ValueType, NameType>> = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const entry = payload[0]?.payload as CareChartDatum | undefined
  if (!entry) return null
  const percentage = Math.round((entry.value / 5) * 100)

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-white/95 px-4 py-3 text-xs shadow-lg dark:border-emerald-600/40 dark:bg-slate-900/95">
      <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-100">{entry.label}</div>
      <div className="mt-1 text-emerald-700/80 dark:text-emerald-200/70">{entry.description}</div>
      <div className="mt-2 text-[10px] uppercase tracking-widest text-emerald-500/80 dark:text-emerald-300/70">
        {percentage}% vibe score
      </div>
    </div>
  )
}

type SeasonalTimelineEntry = {
  key: string
  month: string
  flowering: number
  fruiting: number
  sowing: number
}

const SeasonalTimeline: React.FC<{ data: SeasonalTimelineEntry[]; planting?: NonNullable<NonNullable<Plant['planting']>['calendar']> }> = ({ data, planting }) => {
  const { t } = useTranslation('common')
  const seasonLabels = React.useMemo(
    () => ({
      flowering: t('plantInfo.labels.floweringMonths', { defaultValue: 'Flowering Months' }),
      fruiting: t('plantInfo.labels.fruitingMonths', { defaultValue: 'Fruiting Months' }),
      sowing: t('plantInfo.labels.sowingMonths', { defaultValue: 'Sowing Months' }),
    }),
    [t]
  )

  const hasData = data.some((entry) => entry.flowering || entry.fruiting || entry.sowing)
  if (!hasData) return null

  return (
    <section className="rounded-[28px] border border-emerald-200/40 bg-white/90 p-6 shadow-md backdrop-blur-md dark:border-emerald-700/30 dark:bg-slate-950/70">
      <header className="mb-4 flex items-center gap-3 text-emerald-800 dark:text-emerald-100">
        <Calendar className="h-5 w-5" />
        <h3 className="text-lg font-semibold tracking-tight">{t('plantInfo.sections.phenology', { defaultValue: 'Phenology' })}</h3>
      </header>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(96,165,250,0.16)" vertical={false} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12 }} />
            <YAxis hide domain={[0, 3]} />
            <RechartsTooltip cursor={{ fill: 'rgba(59,130,246,0.08)' }} content={<SeasonalTooltip labels={seasonLabels} />} />
            <Bar dataKey="flowering" stackId="timeline" fill={TIMELINE_COLORS.flowering} radius={[12, 12, 0, 0]} />
            <Bar dataKey="fruiting" stackId="timeline" fill={TIMELINE_COLORS.fruiting} radius={[12, 12, 0, 0]} />
            <Bar dataKey="sowing" stackId="timeline" fill={TIMELINE_COLORS.sowing} radius={[12, 12, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-xs text-emerald-700/80 dark:text-emerald-200/70">
        {Object.entries(TIMELINE_COLORS).map(([key, color]) => (
          <span key={key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            {seasonLabels[key]}
          </span>
        ))}
      </div>
      {planting?.hemisphere && (
        <div className="mt-3 text-xs text-emerald-600/80 dark:text-emerald-300/70">
          {t('plantInfo.labels.hemisphere', { defaultValue: 'Hemisphere' })}: {humanizeHemisphere(planting.hemisphere, t)}
        </div>
      )}
    </section>
  )
}

type SeasonalTooltipProps = TooltipProps<ValueType, NameType> & {
  labels: Record<string, string>
}

const SeasonalTooltip: React.FC<SeasonalTooltipProps> = ({ active, payload, label, labels }) => {
  if (!active || !payload?.length) return null
  const activeSeries = payload.filter((item) => item.value)
  if (!activeSeries.length) return null

  return (
    <div className="rounded-xl border border-sky-400/30 bg-white/95 px-4 py-3 text-xs shadow-lg dark:border-sky-500/40 dark:bg-slate-900/95">
      <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-100">{label}</div>
      <ul className="mt-2 space-y-1 text-emerald-700/80 dark:text-emerald-200/70">
        {activeSeries.map((series) => (
          <li key={series.dataKey as string} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color ?? '#34d399' }} />
            {labels[series.dataKey as string] ?? series.dataKey}
          </li>
        ))}
      </ul>
    </div>
  )
}

const ColorMoodboard: React.FC<{
  generalColors: string[]
  flowerColors: NonNullable<NonNullable<Plant['phenology']>['flowerColors']>
  leafColors: NonNullable<NonNullable<Plant['phenology']>['leafColors']>
}> = ({ generalColors, flowerColors, leafColors }) => {
  const { t } = useTranslation('common')
  const swatches = React.useMemo(() => {
    const result: Array<{ key: string; label: string; tone: string; category: string }> = []
    generalColors.forEach((color, idx) => {
      const tone = resolveColorValue(color)
      result.push({ key: `general-${idx}`, label: color, tone, category: t('plantInfo.labels.generalColor', { defaultValue: 'Palette' }) })
    })
    flowerColors?.forEach((color, idx) => {
      const tone = resolveColorValue(color?.hex ?? color?.name)
      result.push({ key: `flower-${idx}`, label: color?.name ?? t('plantInfo.labels.flowerColors', { defaultValue: 'Flower' }), tone, category: t('plantInfo.labels.flowerColors', { defaultValue: 'Flower' }) })
    })
    leafColors?.forEach((color, idx) => {
      const tone = resolveColorValue(color?.hex ?? color?.name)
      result.push({ key: `leaf-${idx}`, label: color?.name ?? t('plantInfo.labels.leafColors', { defaultValue: 'Leaf' }), tone, category: t('plantInfo.labels.leafColors', { defaultValue: 'Leaf' }) })
    })
    return result.slice(0, 9)
  }, [flowerColors, generalColors, leafColors, t])

  if (!swatches.length) return null

  return (
    <section className="rounded-[28px] border border-emerald-200/40 bg-white/90 p-6 shadow-md backdrop-blur-md dark:border-emerald-700/30 dark:bg-slate-950/70">
      <header className="mb-4 flex items-center gap-3 text-emerald-800 dark:text-emerald-100">
        <Palette className="h-5 w-5" />
        <h3 className="text-lg font-semibold tracking-tight">{t('plantInfo.labels.colorPalette', { defaultValue: 'Color Moodboard' })}</h3>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {swatches.map((swatch) => (
          <div
            key={swatch.key}
            className="group relative overflow-hidden rounded-2xl border border-white/50 bg-white/70 p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-emerald-800/40 dark:bg-slate-900/70"
          >
            <div
              className="mb-3 h-16 w-full rounded-xl shadow-inner"
              style={{
                backgroundImage: `linear-gradient(135deg, ${swatch.tone}, ${swatch.tone}aa)`
              }}
            />
            <div className="text-xs uppercase tracking-widest text-emerald-600/70 dark:text-emerald-300/70">{swatch.category}</div>
            <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{swatch.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

const HabitatMap: React.FC<{
  nativeRange: string[]
  climatePref: string[]
  zones: number[]
  hemisphere?: string
}> = ({ nativeRange, climatePref, zones, hemisphere }) => {
  const { t } = useTranslation('common')
  const climateChips = climatePref.slice(0, 6)
  const hasContent = nativeRange.length > 0 || climateChips.length > 0 || zones.length > 0 || hemisphere

  if (!hasContent) return null

  const pins = nativeRange.slice(0, MAP_PIN_POSITIONS.length)

  return (
    <section className="rounded-[28px] border border-emerald-200/40 bg-gradient-to-br from-sky-100/80 via-white/80 to-emerald-100/80 p-6 shadow-md backdrop-blur-md dark:border-emerald-700/30 dark:from-slate-950/70 dark:via-emerald-950/40 dark:to-slate-950/70">
      <header className="mb-4 flex items-center gap-3 text-emerald-800 dark:text-emerald-100">
        <MapIcon className="h-5 w-5" />
        <h3 className="text-lg font-semibold tracking-tight">{t('plantInfo.labels.habitatMap', { defaultValue: 'Habitat Map' })}</h3>
      </header>
      <div className="relative mb-4 h-64 overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-emerald-200/60 via-sky-100/60 to-emerald-100/60 shadow-inner dark:border-emerald-900/40 dark:from-emerald-950/50 dark:via-slate-900/40 dark:to-slate-950/60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.55),transparent_60%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.45),transparent_65%)] dark:bg-[radial-gradient(circle_at_30%_40%,rgba(15,118,110,0.55),transparent_60%),radial-gradient(circle_at_70%_60%,rgba(14,165,233,0.35),transparent_65%)]" />
        {pins.map((region, idx) => {
          const position = MAP_PIN_POSITIONS[idx]
          return (
            <div
              key={region}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 text-xs font-medium text-emerald-800 shadow-md backdrop-blur-md dark:bg-slate-900/80 dark:text-emerald-100"
              style={{ top: position.top, left: position.left }}
            >
              <MapPin className="h-3.5 w-3.5 text-emerald-500" />
              <span>{region}</span>
            </div>
          )
        })}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:48px_48px] dark:bg-[linear-gradient(90deg,rgba(8,47,73,0.25)_1px,transparent_1px),linear-gradient(0deg,rgba(8,47,73,0.25)_1px,transparent_1px)]" />
      </div>
      {climateChips.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {climateChips.map((climate) => (
            <Badge key={climate} className="rounded-xl border-none bg-emerald-500/10 text-xs font-medium text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100">
              <Compass className="mr-1 h-3 w-3" />
              {climate}
            </Badge>
          ))}
        </div>
      )}
      {zones.length > 0 && (
        <div className="text-xs text-emerald-700/80 dark:text-emerald-200/70">
          USDA: {zones.join(', ')}
        </div>
      )}
      {hemisphere && (
        <div className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-200/70">
          {t('plantInfo.labels.hemisphere', { defaultValue: 'Hemisphere' })}: {humanizeHemisphere(hemisphere, t)}
        </div>
      )}
    </section>
  )
}

const humanizeHemisphere = (value: string, t: (key: string, options?: Record<string, unknown>) => string): string => {
  const normalized = value.toLowerCase()
  if (normalized === 'north') return t('plantInfo.values.north', { defaultValue: 'Northern' })
  if (normalized === 'south') return t('plantInfo.values.south', { defaultValue: 'Southern' })
  if (normalized === 'equatorial') return t('plantInfo.values.equatorial', { defaultValue: 'Equatorial' })
  return value
}

const Fact = ({ icon, label, value, sub, accentClass }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode; accentClass?: string }) => (
  <div
    className={cn(
      'flex items-center gap-3 rounded-3xl border border-white/60 bg-white/90 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-emerald-900/40 dark:bg-slate-950/60',
      accentClass ? `bg-gradient-to-br ${accentClass}` : ''
    )}
  >
    <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-white/70 text-emerald-700 shadow-sm dark:bg-slate-900/70 dark:text-emerald-200">
      <div className="flex h-full w-full items-center justify-center">{icon}</div>
    </div>
    <div className="text-emerald-900 dark:text-emerald-100">
      <div className="text-xs uppercase tracking-widest text-emerald-600/80 dark:text-emerald-300/70">{label}</div>
      <div className="text-base font-semibold leading-tight">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-emerald-700/70 dark:text-emerald-200/70">{sub}</div> : null}
    </div>
  </div>
);

const InfoSection = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => {
  const { t } = useTranslation('common')
  const key = SECTION_KEY_MAP[title]
  const translatedTitle = key ? t(`plantInfo.sections.${key}`, { defaultValue: title }) : title
  return (
    <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-3 text-base font-semibold text-stone-800 dark:text-stone-200">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700 flex items-center justify-center text-white shadow">
          {icon}
        </div>
        <span>{translatedTitle}</span>
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  )
}

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => {
  const { t } = useTranslation('common')
  const key = LABEL_KEY_MAP[label]
  const translatedLabel = key ? t(`plantInfo.labels.${key}`, { defaultValue: label }) : label
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="h-5 w-5 rounded-md bg-stone-100 dark:bg-[#2d2d30] flex items-center justify-center flex-shrink-0 mt-0.5 text-stone-600 dark:text-stone-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-stone-600 dark:text-stone-400 mb-0.5">{translatedLabel}</div>
        <div className="text-sm text-stone-900 dark:text-stone-100">{value}</div>
      </div>
    </div>
  )
}

const formatMonths = (months: number[], t: (key: string, options?: Record<string, unknown>) => string): string => {
  return months
    .map(m => MONTH_KEYS[m - 1])
    .filter(Boolean)
    .map(key => t(`plantInfo.monthsShort.${key}`, { defaultValue: key?.toUpperCase?.() }))
    .join(', ')
}
