import React from "react"
import type { Plant } from "@/types/plant"
import { rarityTone, seasonBadge } from "@/constants/badges"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ListFilter } from "lucide-react"
import { useTranslation } from "react-i18next"

interface SearchPageProps { plants: Plant[]; openInfo: (p: Plant) => void; likedIds?: string[] }

export const SearchPage: React.FC<SearchPageProps> = ({ plants, openInfo, likedIds = [] }) => {
  const { t } = useTranslation('common')
  return (
  <div className="max-w-6xl mx-auto mt-8 px-4 md:px-0">
    <div className="flex items-center gap-2 text-sm mb-3">
      <ListFilter className="h-4 w-4" />
      <span className="opacity-60">{t('plant.refineFilters')}</span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {plants.map((p) => (
        <Card
          key={p.id}
          className="relative rounded-2xl overflow-hidden cursor-pointer"
          onClick={() => openInfo(p)}
          role="button"
          tabIndex={0}
          onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter') openInfo(p) }}
        >
          <div className="grid grid-cols-3 items-stretch gap-0">
            <div className="col-span-1 relative rounded-l-2xl overflow-hidden bg-stone-100 flex">
              {p.image ? (
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  draggable={false}
                  decoding="async"
                  className="w-full h-full object-cover object-center select-none"
                  style={{ transform: 'scale(1.5)' }}
                />
              ) : null}
            </div>
            <div className="col-span-2 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={`${rarityTone[p.rarity]} rounded-xl`}>{p.rarity}</Badge>
                {p.seasons.map((s) => (
                  <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full ${seasonBadge[s]}`}>{s}</span>
                ))}
                {likedIds.includes(p.id) && (
                  <Badge className="rounded-xl bg-rose-600 text-white">{t('plant.liked')}</Badge>
                )}
              </div>
              <div className="font-medium truncate">{p.name}</div>
              <div className="text-xs italic opacity-60 truncate">{p.scientificName}</div>
              <p className="text-sm mt-1 line-clamp-2">{p.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {p.colors.map((c) => (
                  <Badge key={c} variant="secondary" className="rounded-xl text-[11px]">{c}</Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
    {plants.length === 0 && <div className="text-center py-10 opacity-60 text-sm">{t('plant.noResults')}</div>}
  </div>
  )
}
