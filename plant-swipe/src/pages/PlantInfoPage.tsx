import React from 'react'
import { useParams } from 'react-router-dom'
import { PlantDetails } from '@/components/plant/PlantDetails'
import type { Plant, PlantImage, PlantWateringSchedule } from '@/types/plant'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { useTranslation } from 'react-i18next'
import { useLanguage, useLanguageNavigate } from '@/lib/i18nRouting'
import { usePageMetadata } from '@/hooks/usePageMetadata'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Pencil } from 'lucide-react'
import { expandCompositionFromDb } from '@/lib/composition'

type WaterSchedules = PlantWateringSchedule[]

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
    plantType: data.plant_type || undefined,
    utility: data.utility || [],
    comestiblePart: data.comestible_part || [],
    fruitType: data.fruit_type || [],
    identity: {
      givenNames: data.given_names || [],
      scientificName: data.scientific_name || undefined,
      family: data.family || undefined,
      overview: data.overview || undefined,
      promotionMonth: data.promotion_month || undefined,
      lifeCycle: data.life_cycle || undefined,
      season: (data.season || []).map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)) as Plant['seasons'],
      foliagePersistance: data.foliage_persistance || undefined,
      spiked: data.spiked || false,
      toxicityHuman: data.toxicity_human || undefined,
      toxicityPets: data.toxicity_pets || undefined,
      allergens: data.allergens || [],
      scent: data.scent || false,
      symbolism: data.symbolism || [],
        livingSpace: data.living_space || undefined,
        composition: expandCompositionFromDb(data.composition),
      maintenanceLevel: data.maintenance_level || undefined,
      multicolor: data.multicolor || false,
      bicolor: data.bicolor || false,
      colors,
    },
    plantCare: {
      origin: data.origin || [],
      habitat: data.habitat || [],
      temperatureMax: data.temperature_max || undefined,
      temperatureMin: data.temperature_min || undefined,
      temperatureIdeal: data.temperature_ideal || undefined,
      levelSun: data.level_sun || undefined,
      hygrometry: data.hygrometry || undefined,
      wateringType: data.watering_type || [],
      division: data.division || [],
      soil: data.soil || [],
      adviceSoil: data.advice_soil || undefined,
      mulching: data.mulching || [],
      adviceMulching: data.advice_mulching || undefined,
      nutritionNeed: data.nutrition_need || [],
      fertilizer: data.fertilizer || [],
      adviceFertilizer: data.advice_fertilizer || undefined,
      watering: {
        schedules: normalizeSchedules(schedules || []),
      },
    },
      growth: {
        sowingMonth: data.sowing_month || [],
        floweringMonth: data.flowering_month || [],
        fruitingMonth: data.fruiting_month || [],
        height: data.height_cm || undefined,
        wingspan: data.wingspan_cm || undefined,
        tutoring: data.tutoring || false,
        adviceTutoring: data.advice_tutoring || undefined,
        sowType: data.sow_type || [],
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
      polenizer: data.polenizer || [],
      beFertilizer: data.be_fertilizer || false,
      groundEffect: data.ground_effect || undefined,
      conservationStatus: data.conservation_status || undefined,
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
    seasons: (data.season || []).map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)) as Plant['seasons'],
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
      <div className="relative max-w-6xl mx-auto mt-6 px-4 lg:px-6 pb-16 space-y-6">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <Button
              type="button"
            variant="ghost"
            className="flex items-center gap-2 rounded-2xl border border-white/40 bg-white/70 px-4 py-2 text-sm shadow-sm dark:border-transparent dark:bg-white/10"
            onClick={handleGoBack}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('common.back', { defaultValue: 'Back' })}
          </Button>
            {profile?.is_admin && plant && (
              <Button
                type="button"
                variant="outline"
                className="flex items-center gap-2 rounded-2xl border-emerald-200/60 bg-white/80 px-4 py-2 shadow-sm dark:border-emerald-500/30 dark:bg-[#0d0f15]"
                onClick={handleEdit}
              >
                <Pencil className="h-4 w-4" />
                {t('common.edit', { defaultValue: 'Edit' })}
              </Button>
            )}
        </div>
        <PlantDetails
          plant={plant}
          liked={likedIds.includes(plant.id)}
          onToggleLike={toggleLiked}
        />
      </div>
    </div>
  )
}

export default PlantInfoPage
