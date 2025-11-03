import React from "react"
import { motion, AnimatePresence, type MotionValue } from "framer-motion"
import { ChevronLeft, ChevronRight, Heart, Info, Sparkles, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Plant } from "@/types/plant"
import { rarityTone, seasonBadge } from "@/constants/badges"

interface SwipePageProps {
  current: Plant | undefined
  index: number
  setIndex: (i: number) => void
  x: MotionValue<number>
  y: MotionValue<number>
  onDragEnd: (_: unknown, info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => void
  handleInfo: () => void
  handlePass: () => void
  liked?: boolean
  onToggleLike?: () => void
}

export const SwipePage: React.FC<SwipePageProps> = ({ current, index, setIndex, x, y, onDragEnd, handleInfo, handlePass, liked = false, onToggleLike }) => {
  return (
    <div className="max-w-3xl mx-auto mt-8 px-4 md:px-0">
      <div className="relative h-[520px]">
        <AnimatePresence initial={false}>
          {current ? (
            <motion.div
              key={current.id + index}
              drag
              style={{ x, y }}
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              onDragEnd={onDragEnd}
              initial={{ scale: 0.98, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute inset-0"
            >
              <Card className="h-full rounded-3xl overflow-hidden shadow-xl">
                <div className="h-2/3 relative">
                  <div className="absolute inset-0 bg-cover bg-center rounded-t-3xl" style={{ backgroundImage: `url(${current.image})` }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent rounded-t-3xl" />
                  <div className="absolute top-2 right-2 z-10">
                    <button
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); onToggleLike && onToggleLike() }}
                      aria-pressed={liked}
                      aria-label={liked ? 'Unlike' : 'Like'}
                      className={`h-8 w-8 rounded-full flex items-center justify-center shadow border transition ${liked ? 'bg-rose-600 text-white' : 'bg-white/90 text-black hover:bg-white'}`}
                    >
                      <Heart className={liked ? 'fill-current' : ''} />
                    </button>
                  </div>
                  <div className="absolute bottom-0 p-5 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={`${rarityTone[current.rarity]} backdrop-blur bg-opacity-80`}>{current.rarity}</Badge>
                      {current.seasons.map((s) => (
                        <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full ${seasonBadge[s]}`}>{s}</span>
                      ))}
                    </div>
                    <h2 className="text-2xl font-semibold drop-shadow-sm">{current.name}</h2>
                    <p className="opacity-90 text-sm italic">{current.scientificName}</p>
                  </div>
                </div>
                <CardContent className="h-1/3 p-4 flex flex-col gap-3">
                  <p className="text-sm line-clamp-3">{current.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {current.colors.slice(0, 6).map((c) => (
                      <Badge key={c} variant="secondary" className="rounded-xl">{c}</Badge>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <Button variant="secondary" className="rounded-2xl" onClick={handlePass}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Pass
                    </Button>
                    <Button className="rounded-2xl" onClick={handleInfo}>
                      More info <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <EmptyState onReset={() => setIndex(0)} />
          )}
        </AnimatePresence>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <ActionHint label="Pass" icon={<X className="h-5 w-5" />} />
        <ActionHint label="More info" icon={<Info className="h-5 w-5" />} />
      </div>
    </div>
  )
}

const ActionHint = ({ label, icon }: { label: string; icon: React.ReactNode }) => (
  <div className="flex items-center gap-2 rounded-2xl bg-white p-3 shadow border">
    <div className="h-8 w-8 rounded-xl bg-stone-100 flex items-center justify-center">{icon}</div>
    <div className="text-sm font-medium">{label}</div>
  </div>
)

const EmptyState = ({ onReset }: { onReset: () => void }) => (
  <Card className="rounded-3xl p-8 text-center">
    <CardHeader>
      <CardTitle className="flex items-center justify-center gap-2">
        <Sparkles className="h-5 w-5" /> No results
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm opacity-70 max-w-md mx-auto">Try another search or adjust your filters.</p>
      <div className="flex items-center justify-center gap-3">
        <Button variant="secondary" className="rounded-2xl" onClick={onReset}>Reset</Button>
      </div>
    </CardContent>
  </Card>
)
