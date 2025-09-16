import React from "react";
import { useNavigate } from "react-router-dom";
import { motion, useMotionValue } from "framer-motion";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SunMedium, Droplets, Leaf, Heart } from "lucide-react";
import type { Plant } from "@/types/plant";
import { rarityTone, seasonBadge } from "@/constants/badges";

export const PlantDetails: React.FC<{ plant: Plant; onClose: () => void; liked?: boolean; onToggleLike?: () => void }> = ({ plant, onClose, liked = false, onToggleLike }) => {
  const navigate = useNavigate()
  const y = useMotionValue(0)
  const threshold = 120
  const onDragEnd = (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
    const dy = info.offset.y + info.velocity.y * 0.2
    if (dy > threshold) onClose()
  }
  const freqAmountRaw = plant.waterFreqAmount ?? plant.waterFreqValue
  const freqAmount = typeof freqAmountRaw === 'number' ? freqAmountRaw : Number(freqAmountRaw || 0)
  const freqPeriod = (plant.waterFreqPeriod || plant.waterFreqUnit) as 'day' | 'week' | 'month' | 'year' | undefined
  const freqLabel = freqPeriod
    ? `${freqAmount > 0 ? `${freqAmount} ${freqAmount === 1 ? 'time' : 'times'} ` : ''}per ${freqPeriod}`
    : null
  return (
    <motion.div className="space-y-4 select-none" drag="y" style={{ y }} dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={onDragEnd}>
      <SheetHeader>
        <SheetTitle className="text-xl">{plant.name}</SheetTitle>
        <SheetDescription className="italic">{plant.scientificName}</SheetDescription>
      </SheetHeader>

      <div className="rounded-2xl overflow-hidden shadow relative">
        <div className="h-56 bg-cover bg-center select-none" style={{ backgroundImage: `url(${plant.image})`, userSelect: 'none' as any }} />
        <div className="absolute top-3 right-3">
          <button
            onClick={() => onToggleLike && onToggleLike()}
            aria-pressed={liked}
            aria-label={liked ? 'Unlike' : 'Like'}
            className={`h-10 w-10 rounded-full flex items-center justify-center shadow border transition ${liked ? 'bg-rose-600 text-white' : 'bg-white/90 text-black hover:bg-white'}`}
          >
            <Heart className={liked ? 'fill-current' : ''} />
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Fact icon={<SunMedium className="h-4 w-4" />} label="Sunlight" value={plant.care.sunlight} />
        <Fact icon={<Droplets className="h-4 w-4" />} label="Water" value={plant.care.water} />
        <Fact icon={<Leaf className="h-4 w-4" />} label="Difficulty" value={plant.care.difficulty} />
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{plant.description}</p>
          <div className="flex flex-wrap gap-2">
            <Badge className={`${rarityTone[plant.rarity]} rounded-xl`}>{plant.rarity}</Badge>
            {plant.seasons.map((s: string) => (
              <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full ${seasonBadge[s]}`}>{s}</span>
            ))}
            {plant.colors.map((c: string) => (
              <Badge key={c} variant="secondary" className="rounded-xl">{c}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Meaning</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">{plant.meaning}</CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Care Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="font-medium">Sunlight:</span> {plant.care.sunlight}</div>
            <div><span className="font-medium">Water:</span> {plant.care.water}</div>
            {freqLabel && (
              <div>
                <span className="font-medium">Water frequency:</span>
                <span className="ml-1 inline-flex items-center gap-1">💧 {freqLabel}</span>
              </div>
            )}
            <div><span className="font-medium">Soil:</span> {plant.care.soil}</div>
            <div><span className="font-medium">Difficulty:</span> {plant.care.difficulty}</div>
            <div><span className="font-medium">Seeds available:</span> {plant.seedsAvailable ? "Yes" : "No"}</div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" className="rounded-2xl" onClick={() => { navigate(`/plants/${plant.id}/edit`); onClose() }}>Edit</Button>
        <Button className="rounded-2xl" onClick={onClose}>Close</Button>
      </div>
    </motion.div>
  );
};

const Fact = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
  <div className="flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm">
    <div className="h-9 w-9 rounded-xl bg-stone-100 flex items-center justify-center">{icon}</div>
    <div>
      <div className="text-xs opacity-60">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  </div>
);
