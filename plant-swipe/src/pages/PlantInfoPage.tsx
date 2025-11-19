import React from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { PlantDetails } from '@/components/plant/PlantDetails'
import type { Plant } from '@/types/plant'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { useTranslation } from 'react-i18next'
import { useLanguage, useLanguageNavigate } from '@/lib/i18nRouting'
import { usePageMetadata } from '@/hooks/usePageMetadata'

async function fetchPlantWithRelations(id: string): Promise<Plant | null> {
  const { data, error } = await supabase
    .from('plants')
    .select('id,name,plant_type,utility,comestible_part,fruit_type,identity,plant_care,growth,usage,ecology,danger,miscellaneous,meta,colors,seasons,description')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const { data: images } = await supabase.from('plant_images').select('id,link,use').eq('plant_id', id)
  const { data: colorLinks } = await supabase.from('plant_colors').select('color_id, colors:color_id (id,name,hex_code)').eq('plant_id', id)
  const plant: Plant = {
    id: data.id,
    name: data.name,
    plantType: data.plant_type || undefined,
    utility: data.utility || [],
    comestiblePart: data.comestible_part || [],
    fruitType: data.fruit_type || [],
    identity: data.identity || {},
    plantCare: data.plant_care || {},
    growth: data.growth || {},
    usage: data.usage || {},
    ecology: data.ecology || {},
    danger: data.danger || {},
    miscellaneous: data.miscellaneous || {},
    meta: data.meta || {},
    colors: data.colors || [],
    seasons: data.seasons || [],
    description: data.description || undefined,
    images: images || [],
  }
  if ((colorLinks || []).length) {
    plant.identity = {
      ...(plant.identity || {}),
      colors: colorLinks?.map((c: any) => ({ id: c.colors?.id, name: c.colors?.name, hexCode: c.colors?.hex_code })) || [],
    }
  }
  return plant
}

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
  const state = location.state as { backgroundLocation?: any } | null
  const isOverlayMode = !!state?.backgroundLocation

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

  const handleClose = () => {
    if (isOverlayMode) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  if (loading) return <div className="max-w-4xl mx-auto mt-8 px-4">{t('common.loading')}</div>
  if (error) return <div className="max-w-4xl mx-auto mt-8 px-4 text-red-600 text-sm">{error}</div>
  if (!plant) return <div className="max-w-4xl mx-auto mt-8 px-4">{t('plantInfo.plantNotFound')}</div>

  return (
    <div className="max-w-6xl mx-auto mt-6 px-4 lg:px-6 pb-14">
      <PlantDetails
        plant={plant}
        onClose={handleClose}
        liked={likedIds.includes(plant.id)}
        onToggleLike={toggleLiked}
        isOverlayMode={isOverlayMode}
        onRequestPlant={user ? () => {} : undefined}
      />
    </div>
  )
}

export default PlantInfoPage
