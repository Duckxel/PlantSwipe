import React from "react";
import { useLanguageNavigate, useLanguage } from "@/lib/i18nRouting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { 
  SunMedium, Droplets, Leaf, Heart, Share2, Maximize2, ChevronLeft, X,
  Info, Flower2, Ruler, Calendar, MapPin, Thermometer, Wind, Sprout,
  Scissors, Droplet, Package, Bug, AlertTriangle, Seedling, Tag, BookOpen,
  Globe, Bee, Shield, ShoppingCart, AlertCircle, Users, Sparkles, FileText
} from "lucide-react";
import type { Plant } from "@/types/plant";
import { rarityTone, seasonBadge } from "@/constants/badges";
import { deriveWaterLevelFromFrequency } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";

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
  const derivedWater = deriveWaterLevelFromFrequency(freqPeriod, freqAmount) || (plant.care.water as any) || 'Low'
  const freqLabel = freqPeriod
    ? `${freqAmount > 0 ? `${freqAmount} ${freqAmount === 1 ? t('plantInfo.time') : t('plantInfo.times')} ` : ''}${t('plantInfo.per')} ${t(`plantInfo.${freqPeriod}`)}`
    : null

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

  return (
    <div className="space-y-4 select-none">
      {/* Expand button for overlay mode - at the top */}
      {isOverlayMode && (
        <div className="flex justify-end mb-2">
          <button
            onClick={handleExpand}
            type="button"
            aria-label="Expand to full page"
            className="h-8 w-8 rounded-full flex items-center justify-center border bg-white/90 dark:bg-[#2d2d30] dark:border-[#3e3e42] text-black dark:text-white hover:bg-white dark:hover:bg-[#3e3e42] transition shadow-sm"
            title="Expand to full page"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      )}
      
      {/* Back arrow for full page mode - at the top left */}
      {!isOverlayMode && (
        <div className="flex justify-start mb-2">
          <button
            onClick={handleBackToSearch}
            type="button"
            aria-label="Back to search"
            className="h-8 w-8 rounded-full flex items-center justify-center border bg-white/90 dark:bg-[#2d2d30] dark:border-[#3e3e42] text-black dark:text-white hover:bg-white dark:hover:bg-[#3e3e42] transition shadow-sm"
            title="Back to search"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}
      
      <div className="grid md:grid-cols-2 gap-4 items-center">
        <div className="flex flex-col space-y-2 text-left">
          <h2 className="text-3xl md:text-4xl font-bold leading-tight">{plant.name}</h2>
          <p className="italic text-base md:text-lg opacity-80">{plant.scientificName}</p>
        </div>
        <div className="rounded-2xl overflow-hidden shadow relative">
          <div 
            className={`h-44 md:h-60 bg-cover bg-center select-none rounded-2xl ${!isOverlayMode ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
            style={{ backgroundImage: `url(${plant.image})`, userSelect: 'none' as any }}
            onClick={() => !isOverlayMode && setIsImageFullScreen(true)}
            role={!isOverlayMode ? 'button' : undefined}
            tabIndex={!isOverlayMode ? 0 : undefined}
            onKeyDown={(e) => {
              if (!isOverlayMode && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                setIsImageFullScreen(true)
              }
            }}
            aria-label={!isOverlayMode ? t('plantInfo.viewFullScreen') : undefined}
          />
          <div className="absolute bottom-3 right-3 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                console.log('Share button clicked!')
                handleShare(e)
              }}
              type="button"
              aria-label={t('plantInfo.share')}
              className={`h-8 w-8 rounded-full flex items-center justify-center border transition shadow-[0_4px_12px_rgba(0,0,0,0.28)] ${shareSuccess ? 'bg-green-600 text-white' : 'bg-white/90 dark:bg-[#2d2d30] dark:border-[#3e3e42] text-black dark:text-white hover:bg-white dark:hover:bg-[#3e3e42]'}`}
              title={shareSuccess ? t('plantInfo.shareCopied') : t('plantInfo.share')}
            >
              <span className="relative inline-flex items-center justify-center">
                <Share2 className="h-4 w-4 stroke-[1.5]" />
              </span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleLike && onToggleLike()
              }}
              aria-pressed={liked}
              aria-label={liked ? t('plantInfo.unlike') : t('plantInfo.like')}
              className={`h-8 w-8 rounded-full flex items-center justify-center border transition shadow-[0_4px_12px_rgba(0,0,0,0.28)] ${liked ? 'bg-rose-600 text-white' : 'bg-white/90 dark:bg-[#2d2d30] dark:border-[#3e3e42] text-black dark:text-white hover:bg-white dark:hover:bg-[#3e3e42]'}`}
            >
              <Heart className={liked ? 'fill-current' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Fact icon={<SunMedium className="h-4 w-4" />} label={t('plantInfo.sunlight')} value={plant.care.sunlight} sub={plant.care.soil ? String(plant.care.soil) : undefined} />
        <Fact icon={<Droplets className="h-4 w-4" />} label={t('plantInfo.water')} value={derivedWater} sub={freqLabel || undefined} />
        <Fact icon={<Leaf className="h-4 w-4" />} label={t('plantInfo.difficulty')} value={plant.care.difficulty} />
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">{t('plantInfo.overview')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[15px] md:text-base leading-relaxed">
          <p>{plant.description}</p>
          <div className="flex flex-wrap gap-2">
            <Badge className={`${rarityTone[plant.rarity]} rounded-xl`}>{plant.rarity}</Badge>
            {plant.seasons.map((s: string) => (
              <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full ${seasonBadge[s]}`}>{s}</span>
            ))}
            {plant.colors.map((c: string) => (
              <Badge key={c} variant="secondary" className="rounded-xl">{c}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">{t('plantInfo.meaning')}</CardTitle>
        </CardHeader>
        <CardContent className="text-[15px] md:text-base leading-relaxed">{plant.meaning}</CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <Info className="h-5 w-5" />
            {t('plantInfo.moreInformation')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Identifiers Section */}
          {(plant.identifiers?.scientificName || plant.identifiers?.family || plant.identifiers?.genus || plant.identifiers?.commonNames?.length || plant.identifiers?.synonyms?.length || plant.identifiers?.externalIds) && (
            <InfoSection title="Identifiers" icon={<Flower2 className="h-5 w-5" />}>
              {plant.identifiers?.scientificName && (
                <InfoItem icon={<Info className="h-4 w-4" />} label="Scientific Name" value={plant.identifiers.scientificName} />
              )}
              {plant.identifiers?.canonicalName && (
                <InfoItem icon={<FileText className="h-4 w-4" />} label="Canonical Name" value={plant.identifiers.canonicalName} />
              )}
              {plant.identifiers?.family && (
                <InfoItem icon={<Users className="h-4 w-4" />} label="Family" value={plant.identifiers.family} />
              )}
              {plant.identifiers?.genus && (
                <InfoItem icon={<Tag className="h-4 w-4" />} label="Genus" value={plant.identifiers.genus} />
              )}
              {plant.identifiers?.taxonRank && (
                <InfoItem icon={<Tag className="h-4 w-4" />} label="Taxon Rank" value={plant.identifiers.taxonRank} />
              )}
              {plant.identifiers?.cultivar && (
                <InfoItem icon={<Seedling className="h-4 w-4" />} label="Cultivar" value={plant.identifiers.cultivar} />
              )}
              {plant.identifiers?.commonNames?.length > 0 && (
                <InfoItem icon={<Globe className="h-4 w-4" />} label="Common Names" value={plant.identifiers.commonNames.join(', ')} />
              )}
              {plant.identifiers?.synonyms?.length > 0 && (
                <InfoItem icon={<FileText className="h-4 w-4" />} label="Synonyms" value={plant.identifiers.synonyms.join(', ')} />
              )}
              {plant.identifiers?.externalIds && (
                <div className="space-y-2">
                  {plant.identifiers.externalIds.wiki && (
                    <InfoItem icon={<Globe className="h-4 w-4" />} label="Wikipedia" value={<a href={plant.identifiers.externalIds.wiki} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">View</a>} />
                  )}
                  {plant.identifiers.externalIds.gbif && (
                    <InfoItem icon={<Info className="h-4 w-4" />} label="GBIF ID" value={plant.identifiers.externalIds.gbif} />
                  )}
                  {plant.identifiers.externalIds.powo && (
                    <InfoItem icon={<Info className="h-4 w-4" />} label="POWO ID" value={plant.identifiers.externalIds.powo} />
                  )}
                </div>
              )}
            </InfoSection>
          )}

          {/* Traits Section */}
          {(plant.traits?.lifeCycle || plant.traits?.habit?.length || plant.traits?.growthRate || plant.traits?.toxicity || plant.traits?.fragrance || plant.traits?.allergenicity) && (
            <InfoSection title="Traits" icon={<Leaf className="h-5 w-5" />}>
              {plant.traits?.lifeCycle && (
                <InfoItem icon={<Calendar className="h-4 w-4" />} label="Life Cycle" value={plant.traits.lifeCycle} />
              )}
              {plant.traits?.habit?.length > 0 && (
                <InfoItem icon={<Sprout className="h-4 w-4" />} label="Habit" value={plant.traits.habit.join(', ')} />
              )}
              {plant.traits?.deciduousEvergreen && (
                <InfoItem icon={<Leaf className="h-4 w-4" />} label="Foliage" value={plant.traits.deciduousEvergreen} />
              )}
              {plant.traits?.growthRate && (
                <InfoItem icon={<Sparkles className="h-4 w-4" />} label="Growth Rate" value={plant.traits.growthRate} />
              )}
              {plant.traits?.thornsSpines && (
                <InfoItem icon={<AlertTriangle className="h-4 w-4" />} label="Thorns/Spines" value="Yes" />
              )}
              {plant.traits?.fragrance && plant.traits.fragrance !== 'none' && (
                <InfoItem icon={<Flower2 className="h-4 w-4" />} label="Fragrance" value={plant.traits.fragrance} />
              )}
              {plant.traits?.toxicity && (
                <div className="space-y-2">
                  {plant.traits.toxicity.toHumans && plant.traits.toxicity.toHumans !== 'non-toxic' && (
                    <InfoItem icon={<AlertCircle className="h-4 w-4" />} label="Toxicity to Humans" value={plant.traits.toxicity.toHumans} />
                  )}
                  {plant.traits.toxicity.toPets && plant.traits.toxicity.toPets !== 'non-toxic' && (
                    <InfoItem icon={<AlertCircle className="h-4 w-4" />} label="Toxicity to Pets" value={plant.traits.toxicity.toPets} />
                  )}
                </div>
              )}
              {plant.traits?.allergenicity && (
                <InfoItem icon={<AlertCircle className="h-4 w-4" />} label="Allergenicity" value={plant.traits.allergenicity} />
              )}
              {plant.traits?.invasiveness?.status && plant.traits.invasiveness.status !== 'not invasive' && (
                <InfoItem icon={<AlertTriangle className="h-4 w-4" />} label="Invasiveness" value={`${plant.traits.invasiveness.status}${plant.traits.invasiveness.regions?.length ? ` (${plant.traits.invasiveness.regions.join(', ')})` : ''}`} />
              )}
            </InfoSection>
          )}

          {/* Dimensions Section */}
          {(plant.dimensions?.height || plant.dimensions?.spread || plant.dimensions?.spacing || plant.dimensions?.containerFriendly !== undefined) && (
            <InfoSection title="Dimensions" icon={<Ruler className="h-5 w-5" />}>
              {plant.dimensions?.height && (
                <InfoItem icon={<Ruler className="h-4 w-4" />} label="Height" value={`${plant.dimensions.height.minCm || ''}${plant.dimensions.height.minCm && plant.dimensions.height.maxCm ? '-' : ''}${plant.dimensions.height.maxCm || ''} cm`} />
              )}
              {plant.dimensions?.spread && (
                <InfoItem icon={<Ruler className="h-4 w-4" />} label="Spread" value={`${plant.dimensions.spread.minCm || ''}${plant.dimensions.spread.minCm && plant.dimensions.spread.maxCm ? '-' : ''}${plant.dimensions.spread.maxCm || ''} cm`} />
              )}
              {plant.dimensions?.spacing && (
                <InfoItem icon={<Ruler className="h-4 w-4" />} label="Spacing" value={`Row: ${plant.dimensions.spacing.rowCm || 'N/A'} cm, Plant: ${plant.dimensions.spacing.plantCm || 'N/A'} cm`} />
              )}
              {plant.dimensions?.containerFriendly !== undefined && (
                <InfoItem icon={<Package className="h-4 w-4" />} label="Container Friendly" value={plant.dimensions.containerFriendly ? 'Yes' : 'No'} />
              )}
            </InfoSection>
          )}

          {/* Phenology Section */}
          {(plant.phenology?.flowerColors?.length || plant.phenology?.leafColors?.length || plant.phenology?.floweringMonths?.length || plant.phenology?.fruitingMonths?.length || plant.phenology?.scentNotes?.length) && (
            <InfoSection title="Phenology" icon={<Calendar className="h-5 w-5" />}>
              {plant.phenology?.flowerColors?.length > 0 && (
                <InfoItem icon={<Flower2 className="h-4 w-4" />} label="Flower Colors" value={
                  <div className="flex flex-wrap gap-2">
                    {plant.phenology.flowerColors.map((color, idx) => (
                      <span key={idx} className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-[#2d2d30] text-sm flex items-center gap-1">
                        {color.hex && <span className="w-3 h-3 rounded-full border border-stone-300" style={{ backgroundColor: color.hex }} />}
                        {color.name}
                      </span>
                    ))}
                  </div>
                } />
              )}
              {plant.phenology?.leafColors?.length > 0 && (
                <InfoItem icon={<Leaf className="h-4 w-4" />} label="Leaf Colors" value={
                  <div className="flex flex-wrap gap-2">
                    {plant.phenology.leafColors.map((color, idx) => (
                      <span key={idx} className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-[#2d2d30] text-sm flex items-center gap-1">
                        {color.hex && <span className="w-3 h-3 rounded-full border border-stone-300" style={{ backgroundColor: color.hex }} />}
                        {color.name}
                      </span>
                    ))}
                  </div>
                } />
              )}
              {plant.phenology?.floweringMonths?.length > 0 && (
                <InfoItem icon={<Flower2 className="h-4 w-4" />} label="Flowering Months" value={formatMonths(plant.phenology.floweringMonths)} />
              )}
              {plant.phenology?.fruitingMonths?.length > 0 && (
                <InfoItem icon={<Package className="h-4 w-4" />} label="Fruiting Months" value={formatMonths(plant.phenology.fruitingMonths)} />
              )}
              {plant.phenology?.scentNotes?.length > 0 && (
                <InfoItem icon={<Flower2 className="h-4 w-4" />} label="Scent Notes" value={plant.phenology.scentNotes.join(', ')} />
              )}
            </InfoSection>
          )}

          {/* Environment Section */}
          {(plant.environment?.sunExposure || plant.environment?.hardiness || plant.environment?.climatePref?.length || plant.environment?.temperature || plant.environment?.soil) && (
            <InfoSection title="Environment" icon={<MapPin className="h-5 w-5" />}>
              {plant.environment?.sunExposure && (
                <InfoItem icon={<SunMedium className="h-4 w-4" />} label="Sun Exposure" value={plant.environment.sunExposure} />
              )}
              {plant.environment?.lightIntensity && (
                <InfoItem icon={<SunMedium className="h-4 w-4" />} label="Light Intensity" value={plant.environment.lightIntensity} />
              )}
              {plant.environment?.hardiness && (
                <div className="space-y-2">
                  {plant.environment.hardiness.usdaZones?.length > 0 && (
                    <InfoItem icon={<Shield className="h-4 w-4" />} label="USDA Zones" value={plant.environment.hardiness.usdaZones.join(', ')} />
                  )}
                  {plant.environment.hardiness.rhsH && (
                    <InfoItem icon={<Shield className="h-4 w-4" />} label="RHS Hardiness" value={plant.environment.hardiness.rhsH} />
                  )}
                </div>
              )}
              {plant.environment?.climatePref?.length > 0 && (
                <InfoItem icon={<Globe className="h-4 w-4" />} label="Climate Preference" value={plant.environment.climatePref.join(', ')} />
              )}
              {plant.environment?.temperature && (
                <InfoItem icon={<Thermometer className="h-4 w-4" />} label="Temperature Range" value={`${plant.environment.temperature.minC || ''}${plant.environment.temperature.minC && plant.environment.temperature.maxC ? '-' : ''}${plant.environment.temperature.maxC || ''}°C`} />
              )}
              {plant.environment?.humidityPref && (
                <InfoItem icon={<Droplets className="h-4 w-4" />} label="Humidity Preference" value={plant.environment.humidityPref} />
              )}
              {plant.environment?.windTolerance && (
                <InfoItem icon={<Wind className="h-4 w-4" />} label="Wind Tolerance" value={plant.environment.windTolerance} />
              )}
              {plant.environment?.soil && (
                <div className="space-y-2">
                  {plant.environment.soil.texture?.length > 0 && (
                    <InfoItem icon={<Leaf className="h-4 w-4" />} label="Soil Texture" value={plant.environment.soil.texture.join(', ')} />
                  )}
                  {plant.environment.soil.drainage && (
                    <InfoItem icon={<Droplets className="h-4 w-4" />} label="Soil Drainage" value={plant.environment.soil.drainage} />
                  )}
                  {plant.environment.soil.fertility && (
                    <InfoItem icon={<Sprout className="h-4 w-4" />} label="Soil Fertility" value={plant.environment.soil.fertility} />
                  )}
                  {plant.environment.soil.pH && (
                    <InfoItem icon={<Info className="h-4 w-4" />} label="Soil pH" value={`${plant.environment.soil.pH.min || ''}${plant.environment.soil.pH.min && plant.environment.soil.pH.max ? '-' : ''}${plant.environment.soil.pH.max || ''}`} />
                  )}
                </div>
              )}
            </InfoSection>
          )}

          {/* Care Section - Extended */}
          {(plant.care?.maintenanceLevel || plant.care?.watering?.method || plant.care?.fertilizing || plant.care?.pruning || plant.care?.mulching || plant.care?.stakingSupport !== undefined || plant.care?.repottingIntervalYears) && (
            <InfoSection title="Care Details" icon={<Sprout className="h-5 w-5" />}>
              {plant.care?.maintenanceLevel && (
                <InfoItem icon={<Info className="h-4 w-4" />} label="Maintenance Level" value={plant.care.maintenanceLevel} />
              )}
              {plant.care?.watering?.method && (
                <InfoItem icon={<Droplet className="h-4 w-4" />} label="Watering Method" value={plant.care.watering.method} />
              )}
              {plant.care?.watering?.depthCm && (
                <InfoItem icon={<Droplet className="h-4 w-4" />} label="Watering Depth" value={`${plant.care.watering.depthCm} cm`} />
              )}
              {plant.care?.watering?.frequency && (
                <div className="space-y-2">
                  {plant.care.watering.frequency.winter && (
                    <InfoItem icon={<Droplet className="h-4 w-4" />} label="Winter Watering" value={plant.care.watering.frequency.winter} />
                  )}
                  {plant.care.watering.frequency.spring && (
                    <InfoItem icon={<Droplet className="h-4 w-4" />} label="Spring Watering" value={plant.care.watering.frequency.spring} />
                  )}
                  {plant.care.watering.frequency.summer && (
                    <InfoItem icon={<Droplet className="h-4 w-4" />} label="Summer Watering" value={plant.care.watering.frequency.summer} />
                  )}
                  {plant.care.watering.frequency.autumn && (
                    <InfoItem icon={<Droplet className="h-4 w-4" />} label="Autumn Watering" value={plant.care.watering.frequency.autumn} />
                  )}
                </div>
              )}
              {plant.care?.fertilizing && (
                <div className="space-y-2">
                  {plant.care.fertilizing.type && (
                    <InfoItem icon={<Sprout className="h-4 w-4" />} label="Fertilizer Type" value={plant.care.fertilizing.type} />
                  )}
                  {plant.care.fertilizing.schedule && (
                    <InfoItem icon={<Calendar className="h-4 w-4" />} label="Fertilizing Schedule" value={plant.care.fertilizing.schedule} />
                  )}
                </div>
              )}
              {plant.care?.pruning && (
                <div className="space-y-2">
                  {plant.care.pruning.bestMonths?.length > 0 && (
                    <InfoItem icon={<Scissors className="h-4 w-4" />} label="Best Pruning Months" value={formatMonths(plant.care.pruning.bestMonths)} />
                  )}
                  {plant.care.pruning.method && (
                    <InfoItem icon={<Scissors className="h-4 w-4" />} label="Pruning Method" value={plant.care.pruning.method} />
                  )}
                </div>
              )}
              {plant.care?.mulching && (
                <div className="space-y-2">
                  {plant.care.mulching.recommended !== undefined && (
                    <InfoItem icon={<Leaf className="h-4 w-4" />} label="Mulching Recommended" value={plant.care.mulching.recommended ? 'Yes' : 'No'} />
                  )}
                  {plant.care.mulching.material && (
                    <InfoItem icon={<Leaf className="h-4 w-4" />} label="Mulching Material" value={plant.care.mulching.material} />
                  )}
                </div>
              )}
              {plant.care?.stakingSupport !== undefined && (
                <InfoItem icon={<Sprout className="h-4 w-4" />} label="Staking Support" value={plant.care.stakingSupport ? 'Required' : 'Not Required'} />
              )}
              {plant.care?.repottingIntervalYears && (
                <InfoItem icon={<Package className="h-4 w-4" />} label="Repotting Interval" value={`Every ${plant.care.repottingIntervalYears} year${plant.care.repottingIntervalYears > 1 ? 's' : ''}`} />
              )}
            </InfoSection>
          )}

          {/* Propagation Section */}
          {(plant.propagation?.methods?.length || plant.propagation?.seed) && (
            <InfoSection title="Propagation" icon={<Seedling className="h-5 w-5" />}>
              {plant.propagation?.methods?.length > 0 && (
                <InfoItem icon={<Sprout className="h-4 w-4" />} label="Methods" value={plant.propagation.methods.join(', ')} />
              )}
              {plant.propagation?.seed && (
                <div className="space-y-2">
                  {plant.propagation.seed.stratification && (
                    <InfoItem icon={<Seedling className="h-4 w-4" />} label="Seed Stratification" value={plant.propagation.seed.stratification} />
                  )}
                  {plant.propagation.seed.germinationDays && (
                    <InfoItem icon={<Calendar className="h-4 w-4" />} label="Germination Days" value={`${plant.propagation.seed.germinationDays.min || ''}${plant.propagation.seed.germinationDays.min && plant.propagation.seed.germinationDays.max ? '-' : ''}${plant.propagation.seed.germinationDays.max || ''}`} />
                  )}
                </div>
              )}
            </InfoSection>
          )}

          {/* Usage Section */}
          {(plant.usage?.gardenUses?.length || plant.usage?.indoorOutdoor || plant.usage?.edibleParts?.length || plant.usage?.culinaryUses?.length || plant.usage?.medicinalUses?.length) && (
            <InfoSection title="Usage" icon={<Flower2 className="h-5 w-5" />}>
              {plant.usage?.gardenUses?.length > 0 && (
                <InfoItem icon={<Sprout className="h-4 w-4" />} label="Garden Uses" value={plant.usage.gardenUses.join(', ')} />
              )}
              {plant.usage?.indoorOutdoor && (
                <InfoItem icon={<MapPin className="h-4 w-4" />} label="Location" value={plant.usage.indoorOutdoor} />
              )}
              {plant.usage?.edibleParts?.length > 0 && (
                <InfoItem icon={<Package className="h-4 w-4" />} label="Edible Parts" value={plant.usage.edibleParts.join(', ')} />
              )}
              {plant.usage?.culinaryUses?.length > 0 && (
                <InfoItem icon={<Package className="h-4 w-4" />} label="Culinary Uses" value={plant.usage.culinaryUses.join(', ')} />
              )}
              {plant.usage?.medicinalUses?.length > 0 && (
                <InfoItem icon={<Heart className="h-4 w-4" />} label="Medicinal Uses" value={plant.usage.medicinalUses.join(', ')} />
              )}
            </InfoSection>
          )}

          {/* Ecology Section */}
          {(plant.ecology?.nativeRange?.length || plant.ecology?.pollinators?.length || plant.ecology?.wildlifeValue?.length || plant.ecology?.conservationStatus) && (
            <InfoSection title="Ecology" icon={<Globe className="h-5 w-5" />}>
              {plant.ecology?.nativeRange?.length > 0 && (
                <InfoItem icon={<MapPin className="h-4 w-4" />} label="Native Range" value={plant.ecology.nativeRange.join(', ')} />
              )}
              {plant.ecology?.pollinators?.length > 0 && (
                <InfoItem icon={<Bee className="h-4 w-4" />} label="Pollinators" value={plant.ecology.pollinators.join(', ')} />
              )}
              {plant.ecology?.wildlifeValue?.length > 0 && (
                <InfoItem icon={<Heart className="h-4 w-4" />} label="Wildlife Value" value={plant.ecology.wildlifeValue.join(', ')} />
              )}
              {plant.ecology?.conservationStatus && (
                <InfoItem icon={<Shield className="h-4 w-4" />} label="Conservation Status" value={plant.ecology.conservationStatus} />
              )}
            </InfoSection>
          )}

          {/* Problems Section */}
          {(plant.problems?.pests?.length || plant.problems?.diseases?.length || plant.problems?.hazards?.length) && (
            <InfoSection title="Problems" icon={<AlertTriangle className="h-5 w-5" />}>
              {plant.problems?.pests?.length > 0 && (
                <InfoItem icon={<Bug className="h-4 w-4" />} label="Pests" value={plant.problems.pests.join(', ')} />
              )}
              {plant.problems?.diseases?.length > 0 && (
                <InfoItem icon={<AlertCircle className="h-4 w-4" />} label="Diseases" value={plant.problems.diseases.join(', ')} />
              )}
              {plant.problems?.hazards?.length > 0 && (
                <InfoItem icon={<AlertTriangle className="h-4 w-4" />} label="Hazards" value={plant.problems.hazards.join(', ')} />
              )}
            </InfoSection>
          )}

          {/* Planting Section */}
          {(plant.planting?.calendar || plant.planting?.sitePrep?.length || plant.planting?.companionPlants?.length || plant.planting?.avoidNear?.length) && (
            <InfoSection title="Planting" icon={<Seedling className="h-5 w-5" />}>
              {plant.planting?.calendar && (
                <div className="space-y-2">
                  {plant.planting.calendar.hemisphere && (
                    <InfoItem icon={<Globe className="h-4 w-4" />} label="Hemisphere" value={plant.planting.calendar.hemisphere} />
                  )}
                  {plant.planting.calendar.sowingMonths?.length > 0 && (
                    <InfoItem icon={<Calendar className="h-4 w-4" />} label="Sowing Months" value={formatMonths(plant.planting.calendar.sowingMonths)} />
                  )}
                  {plant.planting.calendar.plantingOutMonths?.length > 0 && (
                    <InfoItem icon={<Calendar className="h-4 w-4" />} label="Planting Out Months" value={formatMonths(plant.planting.calendar.plantingOutMonths)} />
                  )}
                  {plant.planting.calendar.promotionMonth && (
                    <InfoItem icon={<Sparkles className="h-4 w-4" />} label="Promotion Month" value={formatMonths([plant.planting.calendar.promotionMonth])} />
                  )}
                </div>
              )}
              {plant.planting?.sitePrep?.length > 0 && (
                <InfoItem icon={<Sprout className="h-4 w-4" />} label="Site Preparation" value={plant.planting.sitePrep.join(', ')} />
              )}
              {plant.planting?.companionPlants?.length > 0 && (
                <InfoItem icon={<Users className="h-4 w-4" />} label="Companion Plants" value={plant.planting.companionPlants.join(', ')} />
              )}
              {plant.planting?.avoidNear?.length > 0 && (
                <InfoItem icon={<AlertTriangle className="h-4 w-4" />} label="Avoid Planting Near" value={plant.planting.avoidNear.join(', ')} />
              )}
            </InfoSection>
          )}

          {/* Meta Section */}
          {(plant.meta?.tags?.length || plant.meta?.funFact || plant.meta?.sourceReferences?.length || plant.meta?.authorNotes) && (
            <InfoSection title="Additional Information" icon={<BookOpen className="h-5 w-5" />}>
              {plant.meta?.tags?.length > 0 && (
                <InfoItem icon={<Tag className="h-4 w-4" />} label="Tags" value={
                  <div className="flex flex-wrap gap-2">
                    {plant.meta.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="rounded-xl">{tag}</Badge>
                    ))}
                  </div>
                } />
              )}
              {plant.meta?.funFact && (
                <InfoItem icon={<Sparkles className="h-4 w-4" />} label="Fun Fact" value={plant.meta.funFact} />
              )}
              {plant.meta?.sourceReferences?.length > 0 && (
                <InfoItem icon={<BookOpen className="h-4 w-4" />} label="Source References" value={
                  <ul className="list-disc list-inside space-y-1">
                    {plant.meta.sourceReferences.map((ref, idx) => (
                      <li key={idx} className="text-sm">{ref}</li>
                    ))}
                  </ul>
                } />
              )}
              {plant.meta?.authorNotes && (
                <InfoItem icon={<FileText className="h-4 w-4" />} label="Author Notes" value={plant.meta.authorNotes} />
              )}
            </InfoSection>
          )}
        </CardContent>
      </Card>

        <div className="flex flex-wrap justify-between gap-2">
        {user && profile?.is_admin && (
          <Button variant="destructive" className="rounded-2xl" onClick={async () => {
            const yes = window.confirm(t('plantInfo.deleteConfirm'))
            if (!yes) return
            const { error } = await supabase.from('plants').delete().eq('id', plant.id)
            if (error) { alert(error.message); return }
            onClose()
            try { window.dispatchEvent(new CustomEvent('plants:refresh')) } catch {}
          }}>{t('common.delete')}</Button>
        )}
          <div className="flex flex-wrap gap-2 ml-auto">
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
                // Navigate to the dedicated edit page; do not call onClose here
                // so we don't immediately pop back to the overlay route.
                navigate(`/plants/${plant.id}/edit`)
              }}
            >
              {t('common.edit')}
            </Button>
          )}
          <Button className="rounded-2xl" onClick={onClose}>{t('common.close')}</Button>
        </div>
      </div>

      {/* Full-screen image viewer - only show when not in overlay mode */}
      {!isOverlayMode && (
        <Dialog open={isImageFullScreen} onOpenChange={setIsImageFullScreen}>
          <DialogContent 
            className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 !bg-transparent border-none rounded-none !translate-x-0 !translate-y-0 !left-0 !top-0"
          >
            {/* Override overlay and hide default close button */}
            <style dangerouslySetInnerHTML={{
              __html: `
                [data-radix-dialog-content] > button[data-radix-dialog-close] {
                  display: none !important;
                }
                [data-radix-dialog-overlay] {
                  background-color: rgba(0, 0, 0, 0.6) !important;
                  cursor: pointer;
                }
              `
            }} />
            
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
                // Close when clicking outside the image container
                if (imageContainerRef.current) {
                  const rect = imageContainerRef.current.getBoundingClientRect()
                  const clickX = e.clientX
                  const clickY = e.clientY
                  
                  // Check if click is outside the image container bounds
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
                className="flex items-center justify-center touch-none pointer-events-auto"
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
                  className={`max-w-full max-h-full object-contain select-none ${
                    zoom > 1 ? 'cursor-move' : 'cursor-zoom-in'
                  }`}
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

const Fact = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode }) => (
  <div className="flex items-center gap-3 rounded-2xl border bg-white dark:bg-[#252526] dark:border-[#3e3e42] p-3 shadow-sm">
    <div className="h-9 w-9 rounded-xl bg-stone-100 dark:bg-[#2d2d30] flex items-center justify-center">{icon}</div>
    <div>
      <div className="text-xs opacity-60 dark:opacity-70">{label}</div>
      <div className="text-sm font-medium">{value}</div>
      {sub ? <div className="text-xs opacity-70 dark:opacity-80 mt-0.5">{sub}</div> : null}
    </div>
  </div>
);

const InfoSection = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="space-y-3 pb-4 border-b border-stone-200 dark:border-[#3e3e42] last:border-0 last:pb-0">
    <div className="flex items-center gap-2 text-base font-semibold text-stone-800 dark:text-stone-200">
      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700 flex items-center justify-center text-white">
        {icon}
      </div>
      {title}
    </div>
    <div className="space-y-2 pl-10">
      {children}
    </div>
  </div>
);

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
  <div className="flex items-start gap-3 py-1.5">
    <div className="h-5 w-5 rounded-md bg-stone-100 dark:bg-[#2d2d30] flex items-center justify-center flex-shrink-0 mt-0.5 text-stone-600 dark:text-stone-400">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium text-stone-600 dark:text-stone-400 mb-0.5">{label}</div>
      <div className="text-sm text-stone-900 dark:text-stone-100">{value}</div>
    </div>
  </div>
);

const formatMonths = (months: number[]): string => {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map(m => monthNames[m - 1]).join(', ');
};
