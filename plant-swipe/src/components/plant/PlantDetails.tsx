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
  Globe, Shield, AlertCircle, Users, Sparkles, FileText
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
          <Fact
            icon={<SunMedium className="h-4 w-4" />}
            label={t('plantInfo.sunlight')}
            value={care?.sunlight || t('common.unknown')}
            sub={care?.soil ? String(care.soil) : undefined}
          />
          <Fact
            icon={<Droplets className="h-4 w-4" />}
            label={t('plantInfo.water')}
            value={derivedWater}
            sub={freqLabel || undefined}
          />
          <Fact
            icon={<Leaf className="h-4 w-4" />}
            label={t('plantInfo.difficulty')}
            value={care?.difficulty || t('common.unknown')}
          />
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">{t('plantInfo.overview')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[15px] md:text-base leading-relaxed">
          <p>{plant.description}</p>
          <div className="flex flex-wrap gap-2">
              <Badge className={`${rarityTone[plant.rarity || 'Common'] ?? ''} rounded-xl`}>{plant.rarity || t('common.unknown')}</Badge>
              {seasons.map((s) => (
                <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full ${seasonBadge[s] ?? 'bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100'}`}>{s}</span>
            ))}
              {colors.map((c) => (
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
                      <InfoItem icon={<Globe className="h-4 w-4" />} label="Wikipedia" value={<a href={identifiers.externalIds.wiki} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">View</a>} />
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
                <InfoItem icon={<Ruler className="h-4 w-4" />} label="Spacing" value={`Row: ${dimensions.spacing.rowCm || 'N/A'} cm, Plant: ${dimensions.spacing.plantCm || 'N/A'} cm`} />
              )}
              {dimensions?.containerFriendly !== undefined && (
                <InfoItem icon={<Package className="h-4 w-4" />} label="Container Friendly" value={dimensions.containerFriendly ? 'Yes' : 'No'} />
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
                <InfoItem icon={<Flower2 className="h-4 w-4" />} label="Flowering Months" value={formatMonths(phenology.floweringMonths ?? [])} />
              )}
              {phenology.fruitingMonths?.length && (
                <InfoItem icon={<Package className="h-4 w-4" />} label="Fruiting Months" value={formatMonths(phenology.fruitingMonths ?? [])} />
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
                <InfoItem icon={<Thermometer className="h-4 w-4" />} label="Temperature Range" value={`${environment.temperature.minC || ''}${environment.temperature.minC && environment.temperature.maxC ? '-' : ''}${environment.temperature.maxC || ''}°C`} />
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
                    <InfoItem icon={<Scissors className="h-4 w-4" />} label="Best Pruning Months" value={formatMonths(care.pruning.bestMonths ?? [])} />
                  )}
                  {care.pruning.method && (
                    <InfoItem icon={<Scissors className="h-4 w-4" />} label="Pruning Method" value={care.pruning.method} />
                  )}
                </div>
              )}
              {care.mulching && (
                <div className="space-y-2">
                  {care.mulching.recommended !== undefined && (
                    <InfoItem icon={<Leaf className="h-4 w-4" />} label="Mulching Recommended" value={care.mulching.recommended ? 'Yes' : 'No'} />
                  )}
                  {care.mulching.material && (
                    <InfoItem icon={<Leaf className="h-4 w-4" />} label="Mulching Material" value={care.mulching.material} />
                  )}
                </div>
              )}
              {care.stakingSupport !== undefined && (
                <InfoItem icon={<Sprout className="h-4 w-4" />} label="Staking Support" value={care.stakingSupport ? 'Required' : 'Not Required'} />
              )}
              {care.repottingIntervalYears && (
                <InfoItem icon={<Package className="h-4 w-4" />} label="Repotting Interval" value={`Every ${care.repottingIntervalYears} year${(care.repottingIntervalYears ?? 0) > 1 ? 's' : ''}`} />
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
                    <InfoItem icon={<Calendar className="h-4 w-4" />} label="Germination Days" value={`${propagation.seed.germinationDays.min || ''}${propagation.seed.germinationDays.min && propagation.seed.germinationDays.max ? '-' : ''}${propagation.seed.germinationDays.max || ''}`} />
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
                    <InfoItem icon={<Calendar className="h-4 w-4" />} label="Sowing Months" value={formatMonths(planting.calendar.sowingMonths ?? [])} />
                  )}
                  {planting.calendar.plantingOutMonths?.length && (
                    <InfoItem icon={<Calendar className="h-4 w-4" />} label="Planting Out Months" value={formatMonths(planting.calendar.plantingOutMonths ?? [])} />
                  )}
                  {planting.calendar.promotionMonth && (
                    <InfoItem icon={<Sparkles className="h-4 w-4" />} label="Promotion Month" value={formatMonths([planting.calendar.promotionMonth])} />
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
