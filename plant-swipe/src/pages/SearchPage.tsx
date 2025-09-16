import React from "react"
import type { Plant } from "@/types/plant"
import { rarityTone, seasonBadge } from "@/constants/badges"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Heart, ListFilter } from "lucide-react"

interface SearchPageProps { plants: Plant[]; openInfo: (p: Plant) => void; likedIds?: string[]; onToggleLike?: (id: string) => void }

export const SearchPage: React.FC<SearchPageProps> = ({ plants, openInfo, likedIds = [], onToggleLike }) => (
  <div className="max-w-6xl mx-auto mt-8 px-4 md:px-0">
    <div className="flex items-center gap-2 text-sm mb-3">
      <ListFilter className="h-4 w-4" />
      <span className="opacity-60">Refine with filters above. Click a card for full details.</span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {plants.map((p) => (
        <Card
          key={p.id}
          className="rounded-2xl overflow-hidden cursor-pointer"
          onClick={() => openInfo(p)}
          role="button"
          tabIndex={0}
          onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter') openInfo(p) }}
        >
          <div className="grid grid-cols-3 gap-0">
            <div className="col-span-1 h-36 bg-cover bg-center relative" style={{ backgroundImage: `url(${p.image})` }}>
              <div className="absolute top-2 right-2">
                <button
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); onToggleLike && onToggleLike(p.id) }}
                  aria-pressed={likedIds.includes(p.id)}
                  aria-label={likedIds.includes(p.id) ? 'Unlike' : 'Like'}
                  className={`h-8 w-8 rounded-full flex items-center justify-center shadow border transition ${likedIds.includes(p.id) ? 'bg-rose-600 text-white' : 'bg-white/90 text-black hover:bg-white'}`}
                >
                  <Heart className={likedIds.includes(p.id) ? 'fill-current' : ''} />
                </button>
              </div>
            </div>
            <div className="col-span-2 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={`${rarityTone[p.rarity]} rounded-xl`}>{p.rarity}</Badge>
                {p.seasons.map((s) => (
                  <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full ${seasonBadge[s]}`}>{s}</span>
                ))}
              </div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs italic opacity-60">{p.scientificName}</div>
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
    {plants.length === 0 && <div className="text-center py-10 opacity-60 text-sm">No results</div>}
  </div>
)
