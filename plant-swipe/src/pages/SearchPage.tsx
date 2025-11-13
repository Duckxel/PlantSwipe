import React from "react"
import type { Plant, PlantSeason } from "@/types/plant"
import { rarityTone, seasonBadge } from "@/constants/badges"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ListFilter } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SearchLayout } from "@/components/search/SearchLayout"

interface SearchPageProps { plants: Plant[]; openInfo: (p: Plant) => void; likedIds?: string[] }

export const SearchPage: React.FC<SearchPageProps> = ({ plants, openInfo, likedIds = [] }) => {
  const { t } = useTranslation('common')
  return (
    <SearchLayout
      badge={t('search.hero.badge')}
      title={t('search.hero.title')}
      subtitle={t('search.hero.subtitle')}
      leftActions={
        <div className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
          <ListFilter className="h-4 w-4" />
          <span>{t('plant.refineFilters')}</span>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plants.map((p) => (
          <Card
            key={p.id}
            className="relative rounded-[24px] overflow-hidden cursor-pointer h-44 border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#252526]/80 backdrop-blur transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
            onClick={() => openInfo(p)}
            role="button"
            tabIndex={0}
            onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.key === 'Enter') openInfo(p)
            }}
          >
            <div className="grid grid-cols-[160px_1fr] items-stretch h-full">
              <div className="relative w-40 h-full flex-shrink-0 rounded-l-[24px] overflow-hidden bg-stone-100 dark:bg-[#2d2d30]">
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.name}
                    loading="lazy"
                    draggable={false}
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover object-center select-none"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-stone-400 dark:text-stone-500">
                    {t('plant.noImage', { defaultValue: 'No image' })}
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge className={`${rarityTone[p.rarity ?? 'Common']} rounded-xl`}>{p.rarity}</Badge>
                    {p.seasons.map((s: PlantSeason) => {
                      const badgeClass =
                        seasonBadge[s] ?? 'bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100'
                      return (
                        <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}>
                          {s}
                        </span>
                      )
                    })}
                    {likedIds.includes(p.id) && (
                      <Badge className="rounded-xl bg-rose-600 dark:bg-rose-500 text-white">{t('plant.liked')}</Badge>
                    )}
                  </div>
                  <div className="font-medium truncate text-base">{p.name}</div>
                  <div className="text-xs italic text-stone-500 dark:text-stone-400 truncate">{p.scientificName}</div>
                  <p className="text-sm mt-2 line-clamp-2 text-stone-600 dark:text-stone-300">{p.description}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.colors.map((c) => (
                    <Badge key={c} variant="secondary" className="rounded-xl text-[11px]">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {plants.length === 0 && (
        <div className="mt-8 rounded-[24px] border border-dashed border-stone-300/60 dark:border-[#3e3e42]/60 bg-white/60 dark:bg-[#1f1f1f]/60 backdrop-blur-sm p-10 text-center space-y-3">
          <div className="text-lg font-medium text-stone-700 dark:text-stone-200">
            {t('search.empty.title')}
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {t('search.empty.description')}
          </p>
        </div>
      )}
    </SearchLayout>
  )
}
