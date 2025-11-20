import React, { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Plant } from "@/types/plant"
import { Flame, Sparkles, SunMedium, Droplets, Thermometer, Heart, Leaf } from "lucide-react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  PieChart,
  Pie,
} from "recharts"

interface PlantDetailsProps {
  plant: Plant
  onClose?: () => void
  liked?: boolean
  onToggleLike?: () => void
  isOverlayMode?: boolean
  onRequestPlant?: () => void
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Card className="overflow-hidden border border-muted/40 shadow-sm">
    <CardHeader className="bg-gradient-to-r from-emerald-100/60 via-white to-amber-50 dark:from-emerald-900/30 dark:via-gray-900 dark:to-amber-900/20">
      <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-500" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="p-4 sm:p-6">{children}</CardContent>
  </Card>
)

const InfoPill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-emerald-100/80 dark:bg-emerald-900/50 px-3 py-1 text-xs font-medium text-emerald-900 dark:text-emerald-50">
    {children}
  </span>
)

const FieldRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => {
  if (value === undefined || value === null || value === "") return null
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-muted/50 bg-muted/30 p-3 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-foreground leading-relaxed">{value}</div>
    </div>
  )
}

const colorPalette = ["#34d399", "#22d3ee", "#fbbf24", "#fb7185", "#c084fc", "#38bdf8"]

const safeJoin = (value?: string[]) => (Array.isArray(value) && value.length ? value.join(", ") : undefined)

const monthLookup = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const monthsToBadges = (months?: number[]) =>
  Array.isArray(months) && months.length
    ? (
        <div className="flex flex-wrap gap-2">
          {months.map((m) => (
            <InfoPill key={m}>{monthLookup[m - 1] || m}</InfoPill>
          ))}
        </div>
      )
    : undefined

const booleanText = (value?: boolean) => (value === undefined ? undefined : value ? "Yes" : "No")

const DictionaryList: React.FC<{ value?: Record<string, string> }>
  = ({ value }) => {
    if (!value || !Object.keys(value).length) return null
    return (
      <div className="flex flex-wrap gap-2">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="rounded-md bg-white/60 dark:bg-slate-800/50 px-3 py-2 shadow-sm ring-1 ring-muted/60">
            <div className="text-[11px] uppercase text-muted-foreground">{k}</div>
            <div className="text-sm text-foreground">{v}</div>
          </div>
        ))}
      </div>
    )
  }

const listOrTags = (values?: string[]) =>
  Array.isArray(values) && values.length ? (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => (
        <InfoPill key={v}>{v}</InfoPill>
      ))}
    </div>
  ) : undefined

export const PlantDetails: React.FC<PlantDetailsProps> = ({ plant, onClose, liked, onToggleLike, onRequestPlant }) => {
  const primaryImage = plant.images?.find((img) => img.use === "primary") || plant.images?.[0]

  const temperatureData = useMemo(() => {
    const rows = [
      { label: "Min", value: plant.plantCare?.temperatureMin },
      { label: "Ideal", value: plant.plantCare?.temperatureIdeal },
      { label: "Max", value: plant.plantCare?.temperatureMax },
    ].filter((r) => typeof r.value === "number") as { label: string; value: number }[]
    return rows
  }, [plant.plantCare?.temperatureIdeal, plant.plantCare?.temperatureMax, plant.plantCare?.temperatureMin])

  const wateringPieData = useMemo(() => {
    if (!plant.plantCare?.wateringType?.length) return []
    return plant.plantCare.wateringType.map((type, idx) => ({ name: type, value: 1, fill: colorPalette[idx % colorPalette.length] }))
  }, [plant.plantCare?.wateringType])

  const heroColors = useMemo(() => plant.identity?.colors?.filter((c) => c.hexCode) || [], [plant.identity?.colors])

  const utilityBadges = plant.utility?.length ? plant.utility : []

  const seasons = plant.identity?.season || plant.seasons || []

  return (
    <div className="space-y-6 pb-16">
      <div className="relative overflow-hidden rounded-3xl border border-muted/50 bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:from-slate-900 dark:via-slate-950 dark:to-emerald-950 shadow-lg">
        <div className="absolute inset-0 opacity-40 blur-3xl" style={{ background: "radial-gradient(circle at 20% 20%, #34d39933, transparent 40%), radial-gradient(circle at 80% 10%, #fb718533, transparent 35%), radial-gradient(circle at 60% 80%, #22d3ee33, transparent 45%)" }} />
        <div className="relative flex flex-col lg:flex-row gap-4 p-4 sm:p-6 lg:p-8">
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="uppercase tracking-wide">{plant.plantType || "Plant"}</Badge>
              {utilityBadges.map((u) => (
                <Badge key={u} variant="outline" className="bg-white/70 dark:bg-slate-900/70">
                  {u}
                </Badge>
              ))}
              {seasons.length > 0 && <Badge variant="outline" className="bg-amber-100/60 text-amber-900 dark:bg-amber-900/30 dark:text-amber-50">{seasons.join(" • ")}</Badge>}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground">{plant.name}</h1>
                {plant.identity?.scientificName && (
                  <p className="text-lg text-muted-foreground italic">{plant.identity.scientificName}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {onToggleLike && (
                  <Button size="sm" variant={liked ? "default" : "secondary"} className="rounded-full" onClick={onToggleLike}>
                    <Heart className="h-4 w-4 mr-2" fill={liked ? "currentColor" : "none"} />
                    {liked ? "Saved" : "Save"}
                  </Button>
                )}
                {onRequestPlant && (
                  <Button size="sm" variant="outline" className="rounded-full" onClick={onRequestPlant}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Request update
                  </Button>
                )}
                {onClose && (
                  <Button size="sm" variant="ghost" className="rounded-full" onClick={onClose}>
                    Close
                  </Button>
                )}
              </div>
            </div>
            {plant.identity?.overview && <p className="text-muted-foreground leading-relaxed text-base">{plant.identity.overview}</p>}

            {heroColors.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Palette</span>
                {heroColors.map((c) => (
                  <div key={c.id || c.hexCode} className="flex items-center gap-2 rounded-full border border-muted/50 bg-white/70 px-3 py-1 shadow-sm dark:bg-slate-900/50">
                    <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: c.hexCode }} />
                    <span className="text-xs font-medium">{c.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {primaryImage && (
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-muted/60 bg-white/60 shadow-inner sm:w-80">
              <img src={primaryImage.link} alt={plant.name} className="h-full w-full object-cover" loading="lazy" />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {plant.growth?.height !== undefined && (
          <Card className="bg-gradient-to-br from-emerald-500/90 to-emerald-700 text-white shadow-lg">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase text-white/80">Height</p>
                <p className="text-3xl font-bold">{plant.growth.height} cm</p>
              </div>
              <Flame className="h-10 w-10 text-white/80" />
            </CardContent>
          </Card>
        )}
        {plant.growth?.wingspan !== undefined && (
          <Card className="bg-gradient-to-br from-sky-400/90 to-blue-600 text-white shadow-lg">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase text-white/80">Wingspan</p>
                <p className="text-3xl font-bold">{plant.growth.wingspan} cm</p>
              </div>
              <Leaf className="h-10 w-10 text-white/80" />
            </CardContent>
          </Card>
        )}
        {plant.plantCare?.hygrometry !== undefined && (
          <Card className="bg-gradient-to-br from-cyan-400/90 to-teal-600 text-white shadow-lg">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase text-white/80">Humidity sweet spot</p>
                <p className="text-3xl font-bold">{plant.plantCare.hygrometry}%</p>
              </div>
              <Droplets className="h-10 w-10 text-white/80" />
            </CardContent>
          </Card>
        )}
        {plant.plantCare?.levelSun && (
          <Card className="bg-gradient-to-br from-amber-400/90 to-orange-600 text-white shadow-lg">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase text-white/80">Sun craving</p>
                <p className="text-2xl font-bold leading-tight">{plant.plantCare.levelSun}</p>
              </div>
              <SunMedium className="h-10 w-10 text-white/80" />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {(plant.identity && Object.values(plant.identity).some((v) => v !== undefined && v !== null && v !== "" && (Array.isArray(v) ? v.length : true))) && (
          <Section title="Identity">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Given Names" value={safeJoin(plant.identity?.givenNames)} />
              <FieldRow label="Family" value={plant.identity?.family} />
              <FieldRow label="Promotion Month" value={plant.identity?.promotionMonth ? monthLookup[plant.identity.promotionMonth - 1] || plant.identity.promotionMonth : undefined} />
              <FieldRow label="Life Cycle" value={plant.identity?.lifeCycle} />
              <FieldRow label="Seasons" value={seasons.length ? seasons.join(" • ") : undefined} />
              <FieldRow label="Foliage Persistance" value={plant.identity?.foliagePersistance} />
              <FieldRow label="Spiked" value={booleanText(plant.identity?.spiked)} />
              <FieldRow label="Toxicity (Human)" value={plant.identity?.toxicityHuman} />
              <FieldRow label="Toxicity (Pets)" value={plant.identity?.toxicityPets} />
              <FieldRow label="Allergens" value={listOrTags(plant.identity?.allergens)} />
              <FieldRow label="Scent" value={booleanText(plant.identity?.scent)} />
              <FieldRow label="Symbolism" value={listOrTags(plant.identity?.symbolism)} />
              <FieldRow label="Living Space" value={plant.identity?.livingSpace} />
              <FieldRow label="Composition" value={listOrTags(plant.identity?.composition as string[])} />
              <FieldRow label="Maintenance Level" value={plant.identity?.maintenanceLevel} />
            </div>
          </Section>
        )}

        {(plant.plantCare && Object.values(plant.plantCare).some((v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length : true))) && (
          <Section title="Plant Care">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Origin" value={listOrTags(plant.plantCare?.origin)} />
              <FieldRow label="Habitat" value={listOrTags(plant.plantCare?.habitat as string[])} />
              <FieldRow
                label="Watering"
                value={(() => {
                  const schedules = plant.plantCare?.watering && Array.isArray(plant.plantCare.watering.schedules)
                    ? plant.plantCare.watering.schedules
                    : []
                  if (schedules.length) {
                    return schedules
                      .filter((s) => s.season)
                      .map((s) => `${s.season}${s.quantity ? ` • ${s.quantity}` : ""}${s.timePeriod ? ` / ${s.timePeriod}` : ""}`)
                      .join(" | ")
                  }
                  if (plant.plantCare?.watering) {
                    return `${[plant.plantCare.watering.season, plant.plantCare.watering.quantity].filter(Boolean).join(" • ")} ${plant.plantCare.watering.timePeriod ? `/ ${plant.plantCare.watering.timePeriod}` : ""}`.trim()
                  }
                  return undefined
                })()}
              />
              <FieldRow label="Watering Type" value={listOrTags(plant.plantCare?.wateringType as string[])} />
              <FieldRow label="Division" value={listOrTags(plant.plantCare?.division as string[])} />
              <FieldRow label="Soil" value={listOrTags(plant.plantCare?.soil as string[])} />
              <FieldRow label="Mulching" value={listOrTags(plant.plantCare?.mulching as string[])} />
              <FieldRow label="Nutrition Need" value={listOrTags(plant.plantCare?.nutritionNeed as string[])} />
              <FieldRow label="Fertilizer" value={listOrTags(plant.plantCare?.fertilizer as string[])} />
              <FieldRow label="Advice Soil" value={plant.plantCare?.adviceSoil} />
              <FieldRow label="Advice Mulching" value={plant.plantCare?.adviceMulching} />
              <FieldRow label="Advice Fertilizer" value={plant.plantCare?.adviceFertilizer} />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {temperatureData.length > 0 && (
                <Card className="border border-muted/60 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <Thermometer className="h-4 w-4 text-amber-500" />
                      Temperature window (°C)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={temperatureData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <XAxis dataKey="label" tickLine={false} axisLine={false} />
                        <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                        <Tooltip cursor={{ fill: "hsl(var(--muted))" }} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {temperatureData.map((_, idx) => (
                            <Cell key={idx} fill={colorPalette[idx % colorPalette.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {wateringPieData.length > 0 && (
                <Card className="border border-muted/60 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <Droplets className="h-4 w-4 text-sky-500" />
                      Watering style mix
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={wateringPieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                          {wateringPieData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          </Section>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {(plant.growth && Object.values(plant.growth).some((v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length : true))) && (
          <Section title="Growth">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Sowing Month" value={monthsToBadges(plant.growth?.sowingMonth)} />
              <FieldRow label="Flowering Month" value={monthsToBadges(plant.growth?.floweringMonth)} />
              <FieldRow label="Fruiting Month" value={monthsToBadges(plant.growth?.fruitingMonth)} />
              <FieldRow label="Tutoring" value={booleanText(plant.growth?.tutoring)} />
              <FieldRow label="Advice Tutoring" value={plant.growth?.adviceTutoring} />
              <FieldRow label="Sow Type" value={listOrTags(plant.growth?.sowType as string[])} />
              <FieldRow label="Separation" value={plant.growth?.separation ? `${plant.growth.separation} cm` : undefined} />
              <FieldRow label="Transplanting" value={booleanText(plant.growth?.transplanting)} />
              <FieldRow label="Advice Sowing" value={plant.growth?.adviceSowing} />
              <FieldRow label="Cut" value={plant.growth?.cut} />
            </div>
          </Section>
        )}

        {(plant.usage && Object.values(plant.usage).some((v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length : true))) && (
          <Section title="Usage">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Advice Medicinal" value={plant.usage?.adviceMedicinal} />
              <FieldRow label="Nutritional Intake" value={listOrTags(plant.usage?.nutritionalIntake)} />
              <FieldRow label="Infusion" value={booleanText(plant.usage?.infusion)} />
              <FieldRow label="Advice Infusion" value={plant.usage?.adviceInfusion} />
              <FieldRow label="Infusion Mix" value={plant.usage?.infusionMix ? <DictionaryList value={plant.usage.infusionMix} /> : undefined} />
              <FieldRow label="Recipes Ideas" value={listOrTags(plant.usage?.recipesIdeas)} />
              <FieldRow label="Aromatherapy" value={booleanText(plant.usage?.aromatherapy)} />
              <FieldRow label="Spice Mixes" value={listOrTags(plant.usage?.spiceMixes)} />
            </div>
          </Section>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {(plant.ecology && Object.values(plant.ecology).some((v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length : true))) && (
          <Section title="Ecology">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Melliferous" value={booleanText(plant.ecology?.melliferous)} />
              <FieldRow label="Polenizer" value={listOrTags(plant.ecology?.polenizer as string[])} />
              <FieldRow label="Be Fertilizer" value={booleanText(plant.ecology?.beFertilizer)} />
              <FieldRow label="Ground Effect" value={plant.ecology?.groundEffect} />
              <FieldRow label="Conservation Status" value={plant.ecology?.conservationStatus} />
            </div>
          </Section>
        )}

        {(plant.danger && Object.values(plant.danger).some((v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length : true))) && (
          <Section title="Danger">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Pests" value={listOrTags(plant.danger?.pests)} />
              <FieldRow label="Diseases" value={listOrTags(plant.danger?.diseases)} />
            </div>
          </Section>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {(plant.miscellaneous && Object.values(plant.miscellaneous).some((v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length : true))) && (
          <Section title="Companions & Tags">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Companions" value={listOrTags(plant.miscellaneous?.companions)} />
              <FieldRow label="Tags" value={listOrTags(plant.miscellaneous?.tags)} />
              <FieldRow label="Source" value={plant.miscellaneous?.source ? <DictionaryList value={plant.miscellaneous.source} /> : undefined} />
            </div>
          </Section>
        )}

        {(plant.meta && Object.values(plant.meta).some((v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length : true))) && (
          <Section title="Meta">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Status" value={plant.meta?.status} />
              <FieldRow label="Admin Commentary" value={plant.meta?.adminCommentary} />
              <FieldRow label="Created By" value={plant.meta?.createdBy} />
              <FieldRow label="Created Time" value={plant.meta?.createdTime} />
              <FieldRow label="Updated By" value={plant.meta?.updatedBy} />
              <FieldRow label="Updated Time" value={plant.meta?.updatedTime} />
            </div>
          </Section>
        )}
      </div>

      {plant.images?.length ? (
        <Section title="Gallery">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {plant.images.map((img) => (
              <div key={img.id || img.link} className="relative overflow-hidden rounded-xl border border-muted/60 bg-white/80 shadow-sm">
                <img src={img.link} alt={plant.name} className="h-32 w-full object-cover sm:h-40" loading="lazy" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 text-[11px] uppercase tracking-wide text-white">
                  {img.use}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  )
}

export default PlantDetails
