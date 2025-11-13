import React from "react"
import type { Plant, PlantSeason } from "@/types/plant"
import { rarityTone, seasonBadge } from "@/constants/badges"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ListFilter } from "lucide-react"
import { useTranslation } from "react-i18next"

interface SearchPageProps { plants: Plant[]; openInfo: (p: Plant) => void; likedIds?: string[] }

export const SearchPage: React.FC<SearchPageProps> = ({ plants, openInfo, likedIds = [] }) => {
  const { t } = useTranslation('common')
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-0 pb-16 space-y-8">
      <div className="pt-10 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
              {t('plant.searchEyebrow')}
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-stone-900 dark:text-white">
              {t('plant.searchTitle')}
            </h1>
            <p className="text-sm md:text-base text-stone-600 dark:text-stone-300 max-w-2xl">
              {t('plant.searchSubtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
            <ListFilter className="h-4 w-4" />
            <span>{t('plant.refineFilters')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plants.map((p) => (
          <Card
            key={p.id}
            className="relative rounded-[22px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/85 dark:bg-[#1d1d1f]/85 backdrop-blur-sm cursor-pointer transition-shadow hover:shadow-[0_20px_45px_-30px_rgba(16,185,129,0.55)]"
            onClick={() => openInfo(p)}
            role="button"
            tabIndex={0}
            onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter') openInfo(p) }}
          >
            <div className="grid grid-cols-[148px_1fr] items-stretch">
              <div className="relative h-full rounded-l-[22px] overflow-hidden bg-stone-100 dark:bg-[#252526]">
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
                  <span className="absolute inset-0 flex items-center justify-center text-3xl">🌱</span>
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`${rarityTone[p.rarity ?? 'Common']} rounded-xl px-2.5 py-0.5`}>
                    {p.rarity}
                  </Badge>
                  {p.seasons.map((s: PlantSeason) => {
                    const badgeClass = seasonBadge[s] ?? 'bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100'
                    return (
                      <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}>{s}</span>
                    )
                  })}
                  {likedIds.includes(p.id) && (
                    <Badge className="rounded-xl bg-rose-600 dark:bg-rose-500 text-white px-2 py-0.5">
                      {t('plant.liked')}
                    </Badge>
                  )}
                </div>
                <div>
                  <div className="font-medium text-stone-900 dark:text-white truncate">{p.name}</div>
                  <div className="text-xs italic text-stone-500 dark:text-stone-400 truncate">{p.scientificName}</div>
                </div>
                <p className="text-sm text-stone-600 dark:text-stone-300 line-clamp-2">{p.description}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {p.colors.map((c) => (
                    <Badge key={c} variant="secondary" className="rounded-xl text-[11px] px-2 py-0.5">
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
        <div className="text-center py-12 text-sm text-stone-500 dark:text-stone-300">
          {t('plant.noResults')}
        </div>
      )}
    </div>
  )
}
