import React from "react"
import type { Plant } from "@/types/plant"
import { rarityTone, seasonBadge } from "@/constants/badges"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface GalleryPageProps { plants: Plant[]; onOpen: (p: Plant) => void }

export const GalleryPage: React.FC<GalleryPageProps> = ({ plants, onOpen }) => (
  <div className="max-w-6xl mx-auto mt-8 px-4 md:px-0">
    <div className="text-sm opacity-60 mb-3">{plants.length} result{plants.length !== 1 ? 's' : ''}</div>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {plants.map((p) => (
        <button key={p.id} onClick={() => onOpen(p)} className="text-left">
          <Card className="rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
            <div className="h-36 bg-cover bg-center rounded-t-2xl" style={{ backgroundImage: `url(${p.image})` }} />
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={`${rarityTone[p.rarity]} rounded-xl`}>{p.rarity}</Badge>
                {p.seasons.slice(0, 1).map((s) => (
                  <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full ${seasonBadge[s]}`}>{s}</span>
                ))}
              </div>
              <div className="font-medium text-sm leading-tight">{p.name}</div>
              <div className="text-xs opacity-60 italic leading-tight">{p.scientificName}</div>
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
    {plants.length === 0 && <div className="text-center py-10 opacity-60 text-sm">No results</div>}
  </div>
)
