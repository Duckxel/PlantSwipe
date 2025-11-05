import React from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { PlantDetails } from '@/components/plant/PlantDetails'
import type { Plant } from '@/types/plant'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { useTranslation } from 'react-i18next'
import { useLanguage, useLanguageNavigate } from '@/lib/i18nRouting'
import { mergePlantWithTranslation } from '@/lib/plantTranslationLoader'

export const PlantInfoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useLanguageNavigate()
  const location = useLocation()
  const { user, profile, refreshProfile } = useAuth()
  const { t } = useTranslation('common')
  const currentLang = useLanguage()
  const [plant, setPlant] = React.useState<Plant | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [likedIds, setLikedIds] = React.useState<string[]>([])
  
  // Check if we're in overlay mode (has backgroundLocation) or full page mode
  const state = location.state as { backgroundLocation?: any } | null
  const isOverlayMode = !!state?.backgroundLocation

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
        // Load base plant data
        const { data, error } = await supabase
          .from('plants')
          .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, care_sunlight, care_water, care_soil, care_difficulty, seeds_available, water_freq_unit, water_freq_value, water_freq_period, water_freq_amount')
          .eq('id', id)
          .maybeSingle()
        if (error) throw new Error(error.message)
        if (!data) {
          setPlant(null)
        } else {
          // Load translation if language is not default
          let translation = null
          if (currentLang !== 'en') {
            const { data: transData } = await supabase
              .from('plant_translations')
              .select('*')
              .eq('plant_id', id)
              .eq('language', currentLang)
              .maybeSingle()
            translation = transData
          }
          
          // Merge translation with base plant data
          const mergedPlant = mergePlantWithTranslation(data, translation)
          if (!ignore) setPlant(mergedPlant)
        }
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
          const { error } = await supabase
            .from('profiles')
            .update({ liked_plant_ids: next })
            .eq('id', user.id)
          if (error) setLikedIds(prev)
          else refreshProfile().catch(() => {})
        } catch {
          setLikedIds(prev)
        }
      })()
      return next
    })
  }

  const handleClose = () => {
    if (isOverlayMode) {
      // In overlay mode, go back to previous page
      navigate(-1)
    } else {
      // In full page mode (shared link), navigate to home
      navigate('/')
    }
  }

  if (loading) return <div className="max-w-4xl mx-auto mt-8 px-4">{t('common.loading')}</div>
  if (error) return <div className="max-w-4xl mx-auto mt-8 px-4 text-red-600 text-sm">{error}</div>
  if (!plant) return <div className="max-w-4xl mx-auto mt-8 px-4">{t('plantInfo.plantNotFound')}</div>

  return (
    <div className="max-w-4xl mx-auto mt-6 px-4 md:px-0">
      <PlantDetails
        plant={plant}
        onClose={handleClose}
        liked={likedIds.includes(plant.id)}
        onToggleLike={toggleLiked}
      />
    </div>
  )
}

export default PlantInfoPage
