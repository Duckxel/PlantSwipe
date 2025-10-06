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
import { deriveWaterLevelFromFrequency } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

export const PlantDetails: React.FC<{ plant: Plant; onClose: () => void; liked?: boolean; onToggleLike?: () => void }> = ({ plant, onClose, liked = false, onToggleLike }) => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const y = useMotionValue(0)
  const threshold = 120
  const onDragEnd = (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
    const dy = info.offset.y + info.velocity.y * 0.2
    if (dy > threshold) onClose()
  }
  const freqAmountRaw = plant.waterFreqAmount ?? plant.waterFreqValue
  const freqAmount = typeof freqAmountRaw === 'number' ? freqAmountRaw : Number(freqAmountRaw || 0)
  const freqPeriod = (plant.waterFreqPeriod || plant.waterFreqUnit) as 'day' | 'week' | 'month' | 'year' | undefined
  const derivedWater = deriveWaterLevelFromFrequency(freqPeriod, freqAmount) || (plant.care.water as any) || 'Low'
  const freqLabel = freqPeriod
    ? `${freqAmount > 0 ? `${freqAmount} ${freqAmount === 1 ? 'time' : 'times'} ` : ''}per ${freqPeriod}`
    : null
  return (
    <motion.div className="space-y-4 select-none" drag="y" style={{ y }} dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={onDragEnd}>
      <div className="grid md:grid-cols-2 gap-4 items-center">
        <SheetHeader className="text-left">
          <SheetTitle className="text-3xl md:text-4xl font-bold leading-tight">{plant.name}</SheetTitle>
          <SheetDescription className="italic text-base md:text-lg opacity-80">{plant.scientificName}</SheetDescription>
        </SheetHeader>
        <div className="rounded-2xl overflow-hidden shadow relative">
          <div className="h-44 md:h-60 bg-cover bg-center select-none rounded-2xl" style={{ backgroundImage: `url(${plant.image})`, userSelect: 'none' as any }} />
          <div className="absolute bottom-3 right-3">
            <button
              onClick={() => onToggleLike && onToggleLike()}
              aria-pressed={liked}
              aria-label={liked ? 'Unlike' : 'Like'}
              className={`h-8 w-8 rounded-full flex items-center justify-center border transition shadow-[0_4px_12px_rgba(0,0,0,0.28)] ${liked ? 'bg-rose-600 text-white' : 'bg-white/90 text-black hover:bg-white'}`}
            >
              <Heart className={liked ? 'fill-current' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Fact icon={<SunMedium className="h-4 w-4" />} label="Sunlight" value={plant.care.sunlight} sub={plant.care.soil ? String(plant.care.soil) : undefined} />
        <Fact icon={<Droplets className="h-4 w-4" />} label="Water" value={derivedWater} sub={freqLabel || undefined} />
        <Fact icon={<Leaf className="h-4 w-4" />} label="Difficulty" value={plant.care.difficulty} />
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[15px] md:text-base leading-relaxed">
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
          <CardTitle className="text-lg md:text-xl">Meaning</CardTitle>
        </CardHeader>
        <CardContent className="text-[15px] md:text-base leading-relaxed">{plant.meaning}</CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Care Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-[15px] md:text-base leading-relaxed">
          <div><span className="font-medium">Sunlight:</span> {plant.care.sunlight}</div>
            <div><span className="font-medium">Water:</span> {derivedWater}</div>
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

      <div className="flex justify-between gap-2">
        {user && (
          <Button variant="destructive" className="rounded-2xl" onClick={async () => {
            const yes = window.confirm('Delete this plant? This will fail if it is used in any garden.')
            if (!yes) return
            const { error } = await supabase.from('plants').delete().eq('id', plant.id)
            if (error) { alert(error.message); return }
            onClose()
            window.location.reload()
          }}>Delete</Button>
        )}
        <div className="flex gap-2 ml-auto">
          {user && (
            <Button variant="secondary" className="rounded-2xl" onClick={() => { navigate(`/plants/${plant.id}/edit`); onClose() }}>Edit</Button>
          )}
          <Button className="rounded-2xl" onClick={onClose}>Close</Button>
        </div>
      </div>
    </motion.div>
  );
};

const Fact = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode }) => (
  <div className="flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm">
    <div className="h-9 w-9 rounded-xl bg-stone-100 flex items-center justify-center">{icon}</div>
    <div>
      <div className="text-xs opacity-60">{label}</div>
      <div className="text-sm font-medium">{value}</div>
      {sub ? <div className="text-xs opacity-70 mt-0.5">{sub}</div> : null}
    </div>
  </div>
);
