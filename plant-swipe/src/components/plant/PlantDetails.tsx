import React from "react";
import { useLanguageNavigate, useLanguage } from "@/lib/i18nRouting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SunMedium, Droplets, Leaf, Heart, Box, ArrowUpRight, Maximize2, ChevronLeft } from "lucide-react";
import type { Plant } from "@/types/plant";
import { rarityTone, seasonBadge } from "@/constants/badges";
import { deriveWaterLevelFromFrequency } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";

export const PlantDetails: React.FC<{ plant: Plant; onClose: () => void; liked?: boolean; onToggleLike?: () => void; isOverlayMode?: boolean }> = ({ plant, onClose, liked = false, onToggleLike, isOverlayMode = false }) => {
  const navigate = useLanguageNavigate()
  const currentLang = useLanguage()
  const { user } = useAuth()
  const { t } = useTranslation('common')
  const [shareSuccess, setShareSuccess] = React.useState(false)
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
    e.nativeEvent.stopImmediatePropagation()
    
    const baseUrl = window.location.origin
    const pathWithoutLang = `/plants/${plant.id}`
    const pathWithLang = currentLang === 'en' ? pathWithoutLang : `/${currentLang}${pathWithoutLang}`
    const shareUrl = `${baseUrl}${pathWithLang}`
    
    console.log('Attempting to copy:', shareUrl, 'isOverlayMode:', isOverlayMode)
    
    // Try modern Clipboard API first - this should work even in overlays
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        // Clipboard API requires user gesture, which we have here
        // Use a small delay to ensure the click event has fully propagated
        await new Promise(resolve => setTimeout(resolve, 0))
        await navigator.clipboard.writeText(shareUrl)
        console.log('Successfully copied to clipboard via Clipboard API')
        setShareSuccess(true)
        setTimeout(() => setShareSuccess(false), 3000)
        return
      } catch (clipboardErr: any) {
        console.warn('Clipboard API failed:', clipboardErr?.message || clipboardErr)
        // Continue to fallback
      }
    }
    
    // Fallback method using execCommand
    // This must work even when inside a Sheet/Dialog overlay
    try {
      // Create a temporary textarea element that will be appended to body
      // (outside any Sheet/Dialog overlay)
      const textArea = document.createElement('textarea')
      textArea.value = shareUrl
      
      // Style it to be invisible but still selectable
      // Use high z-index to ensure it's accessible even if Sheet has high z-index
      textArea.style.position = 'fixed'
      textArea.style.top = '0'
      textArea.style.left = '0'
      textArea.style.width = '2px'
      textArea.style.height = '2px'
      textArea.style.padding = '0'
      textArea.style.border = 'none'
      textArea.style.outline = 'none'
      textArea.style.boxShadow = 'none'
      textArea.style.background = 'transparent'
      textArea.style.opacity = '0'
      textArea.style.pointerEvents = 'none'
      textArea.style.zIndex = '99999' // Ensure it's above Sheet overlay
      
      // Make it readonly to prevent keyboard from appearing on mobile
      textArea.setAttribute('readonly', '')
      textArea.setAttribute('aria-hidden', 'true')
      
      // Append to body (not inside Sheet/Dialog)
      document.body.appendChild(textArea)
      
      // Use setTimeout to ensure DOM is ready and focus works properly
      await new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          try {
            // Focus and select - must be done after appending to DOM
            textArea.focus()
            textArea.select()
            textArea.setSelectionRange(0, shareUrl.length)
            
            // Execute copy command
            const successful = document.execCommand('copy')
            
            // Clean up immediately
            if (textArea.parentNode) {
              document.body.removeChild(textArea)
            }
            
            if (successful) {
              console.log('Successfully copied using execCommand fallback')
              setShareSuccess(true)
              setTimeout(() => setShareSuccess(false), 3000)
              resolve()
            } else {
              reject(new Error('execCommand returned false'))
            }
          } catch (err) {
            // Clean up on error
            if (textArea.parentNode) {
              document.body.removeChild(textArea)
            }
            reject(err)
          }
        }, 50) // Increased delay for overlay context
      })
    } catch (err) {
      console.error('All copy methods failed:', err)
      // Show user-friendly error
      const errorMsg = err instanceof Error ? err.message : String(err)
      alert(`${t('plantInfo.shareFailed')}\n\nURL: ${shareUrl}\n\nError: ${errorMsg}`)
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

  return (
    <div className="space-y-4 select-none">
      {/* Expand button for overlay mode - at the top */}
      {isOverlayMode && (
        <div className="flex justify-end mb-2">
          <button
            onClick={handleExpand}
            type="button"
            aria-label="Expand to full page"
            className="h-8 w-8 rounded-full flex items-center justify-center border bg-white/90 text-black hover:bg-white transition shadow-sm"
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
            className="h-8 w-8 rounded-full flex items-center justify-center border bg-white/90 text-black hover:bg-white transition shadow-sm"
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
          <div className="h-44 md:h-60 bg-cover bg-center select-none rounded-2xl" style={{ backgroundImage: `url(${plant.image})`, userSelect: 'none' as any }} />
          <div className="absolute bottom-3 right-3 flex gap-2">
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleShare(e)
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              type="button"
              aria-label={t('plantInfo.share')}
              className={`h-8 w-8 rounded-full flex items-center justify-center border transition shadow-[0_4px_12px_rgba(0,0,0,0.28)] ${shareSuccess ? 'bg-green-600 text-white' : 'bg-white/90 text-black hover:bg-white'}`}
              title={shareSuccess ? t('plantInfo.shareCopied') : t('plantInfo.share')}
            >
              <span className="relative inline-flex items-center justify-center">
                <Box className="h-3 w-3 stroke-[1.5]" />
                <ArrowUpRight className="h-2 w-2 absolute -top-0.5 -right-0.5 stroke-[2]" />
              </span>
            </button>
            <button
              onClick={() => onToggleLike && onToggleLike()}
              aria-pressed={liked}
              aria-label={liked ? t('plantInfo.unlike') : t('plantInfo.like')}
              className={`h-8 w-8 rounded-full flex items-center justify-center border transition shadow-[0_4px_12px_rgba(0,0,0,0.28)] ${liked ? 'bg-rose-600 text-white' : 'bg-white/90 text-black hover:bg-white'}`}
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
          <CardTitle className="text-lg md:text-xl">{t('plantInfo.careGuide')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-[15px] md:text-base leading-relaxed">
          <div><span className="font-medium">{t('plantInfo.sunlightLabel')}</span> {plant.care.sunlight}</div>
            <div><span className="font-medium">{t('plantInfo.waterLabel')}</span> {derivedWater}</div>
            {freqLabel && (
              <div>
                <span className="font-medium">{t('plantInfo.waterFrequency')}</span>
                <span className="ml-1 inline-flex items-center gap-1">💧 {freqLabel}</span>
              </div>
            )}
            <div><span className="font-medium">{t('plantInfo.soilLabel')}</span> {plant.care.soil}</div>
            <div><span className="font-medium">{t('plantInfo.difficultyLabel')}</span> {plant.care.difficulty}</div>
            <div><span className="font-medium">{t('plantInfo.seedsAvailable')}</span> {plant.seedsAvailable ? t('plantInfo.yes') : t('plantInfo.no')}</div>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        {user && (
          <Button variant="destructive" className="rounded-2xl" onClick={async () => {
            const yes = window.confirm(t('plantInfo.deleteConfirm'))
            if (!yes) return
            const { error } = await supabase.from('plants').delete().eq('id', plant.id)
            if (error) { alert(error.message); return }
            onClose()
            try { window.dispatchEvent(new CustomEvent('plants:refresh')) } catch {}
          }}>{t('common.delete')}</Button>
        )}
        <div className="flex gap-2 ml-auto">
          {user && (
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
    </div>
  );
};

const Fact = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode }) => (
  <div className="flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm">
    <div className="h-9 w-9 rounded-xl bg-stone-100 flex items-center justify-center">{icon}</div>
    <div>
      <div className="text-xs opacity-60">{label}</div>
      <div className="text-sm font-medium">{value}</div>
      {sub ? <div className="text-xs opacity-70 mt-0.5">{sub}</div> : null}
    </div>
  </div>
);
