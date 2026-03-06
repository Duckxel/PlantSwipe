import React from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useLanguage, useLanguageNavigate } from '@/lib/i18nRouting'
import { Tooltip } from '@/components/ui/tooltip'

interface SiblingPlant {
  id: string
  name: string
  variety: string | null
  imageUrl: string | null
}

interface PlantVarietyCirclesProps {
  plantId: string
  plantName: string
}

export const PlantVarietyCircles: React.FC<PlantVarietyCirclesProps> = ({ plantId, plantName }) => {
  const [siblings, setSiblings] = React.useState<SiblingPlant[]>([])
  const currentLang = useLanguage()
  const navigate = useLanguageNavigate()

  React.useEffect(() => {
    let ignore = false

    const load = async () => {
      // 1. Find all plants with the same base name
      const { data: plants } = await supabase
        .from('plants')
        .select('id, name')
        .eq('name', plantName)

      if (ignore || !plants || plants.length < 2) {
        setSiblings([])
        return
      }

      const ids = plants.map((p) => p.id)

      // 2. Fetch translations and primary images in parallel
      const [{ data: translations }, { data: images }] = await Promise.all([
        supabase
          .from('plant_translations')
          .select('plant_id, name, variety')
          .in('plant_id', ids)
          .eq('language', currentLang),
        supabase
          .from('plant_images')
          .select('plant_id, link')
          .in('plant_id', ids)
          .eq('use', 'primary'),
      ])

      if (ignore) return

      const translationMap = new Map(
        (translations || []).map((t) => [t.plant_id, t])
      )
      const imageMap = new Map(
        (images || []).map((img) => [img.plant_id, img.link])
      )

      const result: SiblingPlant[] = plants.map((p) => {
        const tr = translationMap.get(p.id)
        return {
          id: p.id,
          name: tr?.name || p.name,
          variety: tr?.variety || null,
          imageUrl: imageMap.get(p.id) || null,
        }
      })

      // Sort: no-variety first, then alphabetically by variety
      result.sort((a, b) => {
        if (!a.variety && b.variety) return -1
        if (a.variety && !b.variety) return 1
        return (a.variety || '').localeCompare(b.variety || '')
      })

      if (!ignore) setSiblings(result)
    }

    load()
    return () => { ignore = true }
  }, [plantId, plantName, currentLang])

  if (siblings.length < 2) return null

  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6 py-3">
      {siblings.map((sibling) => {
        const isCurrent = sibling.id === plantId
        const isBase = !sibling.variety
        const tooltipLabel = sibling.variety || sibling.name
        const sizeClass = isBase
          ? 'w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20'
          : 'w-14 h-14 sm:w-16 sm:h-16'

        return (
          <Tooltip key={sibling.id} content={tooltipLabel} side="top">
            <button
              type="button"
              onClick={() => {
                if (!isCurrent) navigate(`/plants/${sibling.id}`)
              }}
              className="flex flex-col items-center gap-2 group"
              aria-label={tooltipLabel}
            >
              <div
                className={`${sizeClass} rounded-full overflow-hidden transition-all ${
                  isCurrent
                    ? 'ring-[3px] ring-emerald-500 dark:ring-emerald-400 ring-offset-2 ring-offset-white dark:ring-offset-[#1a1a1a]'
                    : 'ring-2 ring-stone-200 dark:ring-stone-600 group-hover:ring-emerald-400 dark:group-hover:ring-emerald-500'
                }`}
              >
                {sibling.imageUrl ? (
                  <img
                    src={sibling.imageUrl}
                    alt={tooltipLabel}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-stone-200 dark:bg-stone-700" />
                )}
              </div>
              {/* Indicator dot below current plant */}
              <div
                className={`w-1.5 h-1.5 rounded-full transition-opacity ${
                  isCurrent
                    ? 'bg-emerald-500 dark:bg-emerald-400 opacity-100'
                    : 'opacity-0'
                }`}
              />
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}
