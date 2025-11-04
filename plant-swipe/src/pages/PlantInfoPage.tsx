import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PlantDetails } from '@/components/plant/PlantDetails'
import type { Plant } from '@/types/plant'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { useTranslation } from 'react-i18next'

export const PlantInfoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const { t } = useTranslation('common')
  const [plant, setPlant] = React.useState<Plant | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [likedIds, setLikedIds] = React.useState<string[]>([])

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
        const { data, error } = await supabase
          .from('plants')
          .select('id, name, scientific_name, colors, seasons, rarity, meaning, description, image_url, care_sunlight, care_water, care_soil, care_difficulty, seeds_available, water_freq_unit, water_freq_value, water_freq_period, water_freq_amount')
          .eq('id', id)
          .maybeSingle()
        if (error) throw new Error(error.message)
        if (!data) {
          setPlant(null)
        } else {
          const p: Plant = {
            id: String(data.id),
            name: data.name,
            scientificName: data.scientific_name || '',
            colors: Array.isArray(data.colors) ? data.colors.map(String) : [],
            seasons: Array.isArray(data.seasons) ? (data.seasons as unknown[]).map((s) => String(s)) as Plant['seasons'] : [],
            rarity: data.rarity,
            meaning: data.meaning || '',
            description: data.description || '',
            image: data.image_url || '',
            care: {
              sunlight: (data.care_sunlight || 'Low') as Plant['care']['sunlight'],
              water: (data.care_water || 'Low') as Plant['care']['water'],
              soil: String(data.care_soil || ''),
              difficulty: (data.care_difficulty || 'Easy') as Plant['care']['difficulty'],
            },
            seedsAvailable: Boolean(data.seeds_available ?? false),
            waterFreqUnit: data.water_freq_unit || undefined,
            waterFreqValue: data.water_freq_value ?? null,
            waterFreqPeriod: data.water_freq_period || undefined,
            waterFreqAmount: data.water_freq_amount ?? null,
          }
          if (!ignore) setPlant(p)
        }
      } catch (e: any) {
        if (!ignore) setError(e?.message || t('plantInfo.failedToLoad'))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [id])

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

  if (loading) return <div className="max-w-4xl mx-auto mt-8 px-4">{t('common.loading')}</div>
  if (error) return <div className="max-w-4xl mx-auto mt-8 px-4 text-red-600 text-sm">{error}</div>
  if (!plant) return <div className="max-w-4xl mx-auto mt-8 px-4">{t('plantInfo.plantNotFound')}</div>

  return (
    <div className="max-w-4xl mx-auto mt-6 px-4 md:px-0">
      <PlantDetails
        plant={plant}
        onClose={() => navigate(-1)}
        liked={likedIds.includes(plant.id)}
        onToggleLike={toggleLiked}
      />
    </div>
  )
}

export default PlantInfoPage
