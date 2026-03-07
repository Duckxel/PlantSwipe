import {
  BookOpen,
  ArrowRight,
  MessageSquarePlus,
  Plus,
  Sprout,
} from "lucide-react"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/ui/search-input"
import { useLanguageNavigate, useLanguage } from "@/lib/i18nRouting"
import { usePageMetadata } from "@/hooks/usePageMetadata"
import { useAuth } from "@/context/AuthContext"
import { checkEditorAccess } from "@/constants/userRoles"
import { RequestPlantDialog } from "@/components/plant/RequestPlantDialog"
import { supabase } from "@/lib/supabaseClient"
interface Category {
  key: string
  params: string
  defaultName: string
  defaultDesc: string
}

const categories: Category[] = [
  { key: "tree", params: "?type=Tree", defaultName: "Tree", defaultDesc: "Large woody plants with a single trunk" },
  { key: "shrub", params: "?type=Shrub", defaultName: "Shrub", defaultDesc: "Multi-stemmed woody plants" },
  { key: "fruitTree", params: "?type=Tree&usage=Edible", defaultName: "Fruit Tree", defaultDesc: "Trees that bear edible fruits" },
  { key: "bamboo", params: "?q=bamboo", defaultName: "Bamboo", defaultDesc: "Fast-growing grass family members" },
  { key: "cactusSucculent", params: "?type=Succulent", defaultName: "Cactus & Succulent", defaultDesc: "Drought-tolerant water-storing plants" },
  { key: "herbaceous", params: "?type=Herb,Grass", defaultName: "Herbaceous", defaultDesc: "Non-woody flowering plants" },
  { key: "fruitPlant", params: "?plantPart=fruits&usage=Edible", defaultName: "Fruit Plant", defaultDesc: "Plants grown for edible fruits" },
  { key: "aromatic", params: "?usage=Aromatic", defaultName: "Aromatic Plant", defaultDesc: "Fragrant herbs and spice plants" },
  { key: "medicinal", params: "?usage=Medicinal", defaultName: "Medicinal Plant", defaultDesc: "Plants with therapeutic properties" },
  { key: "climbing", params: "?type=Climber", defaultName: "Climbing Plant", defaultDesc: "Vines and climbers for vertical spaces" },
  { key: "perennial", params: "?lifeCycle=perennial,succulent_perennial", defaultName: "Perennial Plant", defaultDesc: "Plants that return year after year" },
  { key: "bulb", params: "?plantPart=bulbs", defaultName: "Bulb Plant", defaultDesc: "Plants that grow from bulbs or tubers" },
  { key: "indoor", params: "?livingSpace=indoor", defaultName: "Indoor Plant", defaultDesc: "Plants suited for indoor living spaces" },
  { key: "fern", params: "?type=Fern", defaultName: "Fern", defaultDesc: "Shade-loving non-flowering plants" },
  { key: "aquatic", params: "?habitat=aquatic", defaultName: "Aquatic & Semi-Aquatic", defaultDesc: "Plants that thrive in or near water" },
]

interface CategoryPlantPreview {
  id: string
  name: string
  imageUrl: string
}

type PlantRow = {
  id: string
  name: string
  plant_type: string | null
  plant_part: string[] | null
  habitat: string[] | null
  utility: string[] | null
  plant_habit: string[] | null
  life_cycle: string[] | null
  edible_part: string[] | null
  living_space: string[] | null
  scientific_name_species: string | null
  plant_images: { link: string }[]
}

function matchesCategoryFilter(plant: PlantRow, params: string): boolean {
  const sp = new URLSearchParams(params.replace("?", ""))

  const q = sp.get("q")
  if (q) {
    const query = q.toLowerCase()
    const searchStr = `${plant.name || ""} ${plant.scientific_name_species || ""}`.toLowerCase()
    if (!searchStr.includes(query)) return false
  }

  const type = sp.get("type")
  if (type) {
    const types = type.split(",").map((t) => t.trim().toLowerCase())
    if (!types.includes((plant.plant_type || "").toLowerCase())) return false
  }

  const usage = sp.get("usage")
  if (usage) {
    const usages = usage.split(",").map((u) => u.trim().toLowerCase())
    const plantUtility = (plant.utility || []).map((u) => u.toLowerCase())
    if (!usages.some((u) => plantUtility.includes(u))) return false
  }

  const plantHabit = sp.get("plantHabit")
  if (plantHabit) {
    const habits = plantHabit.split(",").map((h) => h.trim().toLowerCase())
    const plantHabits = (plant.plant_habit || []).map((h) => h.toLowerCase())
    if (!habits.some((h) => plantHabits.includes(h))) return false
  }

  const lifeCycle = sp.get("lifeCycle")
  if (lifeCycle) {
    const cycles = lifeCycle.split(",").map((l) => l.trim().toLowerCase())
    const plantCycles = (plant.life_cycle || []).map((l) => l.toLowerCase())
    if (!cycles.some((c) => plantCycles.includes(c))) return false
  }

  const ediblePart = sp.get("ediblePart")
  if (ediblePart) {
    const parts = ediblePart.split(",").map((e) => e.trim().toLowerCase())
    const plantParts = (plant.edible_part || []).map((e) => e.toLowerCase())
    if (!parts.some((p) => plantParts.includes(p))) return false
  }

  const plantPart = sp.get("plantPart")
  if (plantPart) {
    const parts = plantPart.split(",").map((e) => e.trim().toLowerCase())
    const plantParts = (plant.plant_part || []).map((e) => e.toLowerCase())
    if (!parts.some((p) => plantParts.includes(p))) return false
  }

  const habitat = sp.get("habitat")
  if (habitat) {
    const habitats = habitat.split(",").map((h) => h.trim().toLowerCase())
    const plantHabitats = (plant.habitat || []).map((h) => h.toLowerCase())
    if (!habitats.some((h) => plantHabitats.includes(h))) return false
  }

  const livingSpace = sp.get("livingSpace")
  if (livingSpace) {
    const spaces = livingSpace.split(",").map((s) => s.trim().toLowerCase())
    const plantSpaces = (plant.living_space || []).map((s) => s.toLowerCase())
    if (!spaces.some((s) => plantSpaces.includes(s))) return false
  }

  return true
}

export default function CategoriesPage() {
  const { t } = useTranslation("common")
  const navigate = useLanguageNavigate()
  const language = useLanguage()
  const { user, profile } = useAuth()
  const [searchValue, setSearchValue] = React.useState("")
  const [requestDialogOpen, setRequestDialogOpen] = React.useState(false)
  const [categoryPreviews, setCategoryPreviews] = useState<Record<string, CategoryPlantPreview[]>>({})

  useEffect(() => {
    let cancelled = false

    async function fetchPreviews() {
      const { data: plants } = await supabase
        .from("plants")
        .select(
          "id, name, plant_type, plant_part, habitat, utility, plant_habit, life_cycle, edible_part, living_space, scientific_name_species, plant_images!inner(link)",
        )
        .eq("plant_images.use", "primary")

      if (cancelled || !plants) return

      const typedPlants = plants as unknown as PlantRow[]

      // Fetch translations for non-English languages
      let translationMap = new Map<string, string>()
      if (language !== "en") {
        const { data: translations } = await supabase
          .from("plant_translations")
          .select("plant_id, name")
          .eq("language", language)

        if (translations) {
          for (const t of translations) {
            if (t.name) translationMap.set(t.plant_id as string, t.name as string)
          }
        }
      }

      if (cancelled) return

      const previews: Record<string, CategoryPlantPreview[]> = {}
      for (const cat of categories) {
        const matching = typedPlants.filter((p) => matchesCategoryFilter(p, cat.params))
        // Fisher-Yates shuffle
        for (let i = matching.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[matching[i], matching[j]] = [matching[j], matching[i]]
        }
        previews[cat.key] = matching.slice(0, 5).map((p) => ({
          id: p.id,
          name: translationMap.get(p.id) || p.name,
          imageUrl: p.plant_images?.[0]?.link || "",
        }))
      }

      setCategoryPreviews(previews)
    }

    fetchPreviews()
    return () => {
      cancelled = true
    }
  }, [language])

  usePageMetadata({
    title: t("categories.title", { defaultValue: "Categories" }),
    description: t("categories.subtitle", { defaultValue: "Browse plants by category" }),
  })

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchValue.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("categories.title", { defaultValue: "Categories" })}
        </h1>
        <button
          type="button"
          onClick={() => navigate("/search")}
          className="mt-2 inline-flex items-center gap-1.5 text-primary hover:text-primary/80 underline underline-offset-4 decoration-primary/40 hover:decoration-primary transition-colors"
        >
          {t("categories.browseAll", { defaultValue: "Access our full encyclopedia" })}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Search bar — matches Search page backdrop style */}
      <div className="sticky top-0 z-30 -mx-4 px-4 py-3 mb-6 bg-stone-100/95 dark:bg-[#1e1e1e]/95 backdrop-blur-sm shadow-sm lg:-mx-0 lg:px-0 lg:rounded-2xl lg:px-4">
        <form onSubmit={handleSearchSubmit}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/search")}
                className="shrink-0 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title={t("categories.viewAll", { defaultValue: "View All Plants" })}
              >
                <BookOpen className="h-5 w-5" />
              </button>
              <div className="flex-1">
                <SearchInput
                  variant="lg"
                  className="rounded-2xl"
                  placeholder={t("plant.searchPlaceholder", { defaultValue: "Search plants..." })}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onClear={() => setSearchValue("")}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-row lg:items-end lg:gap-2 w-full lg:w-auto">
              {user && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-2xl w-full lg:w-auto"
                    onClick={() => setRequestDialogOpen(true)}
                  >
                    <MessageSquarePlus className="h-4 w-4 mr-2" />
                    {t("requestPlant.button", { defaultValue: "Request Plant" })}
                  </Button>
                  {checkEditorAccess(profile) && (
                    <Button
                      type="button"
                      variant="default"
                      className="rounded-2xl w-full lg:w-auto"
                      onClick={() => navigate("/create")}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t("common.addPlant")}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {categories.map(({ key, params, defaultName, defaultDesc }) => {
          const previews = categoryPreviews[key] || []
          const heroPlant = previews[0]
          const remainingPlants = previews.slice(1)

          return (
            <Card
              key={key}
              role="button"
              tabIndex={0}
              className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_35px_95px_-45px_rgba(16,185,129,0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              onClick={() => navigate(`/search${params}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  navigate(`/search${params}`)
                }
              }}
            >
              {/* Hero image */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-stone-100 via-white to-stone-200 dark:from-[#2d2d30] dark:via-[#2a2a2e] dark:to-[#1f1f1f]">
                {heroPlant ? (
                  <img
                    src={heroPlant.imageUrl}
                    alt={heroPlant.name}
                    className="absolute inset-0 h-full w-full object-cover object-center select-none transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    draggable={false}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sprout className="h-10 w-10 text-emerald-400/50 dark:text-emerald-500/40" />
                  </div>
                )}
                {/* Bottom gradient overlay for text readability */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" />
                {/* Category name over the image */}
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <span className="text-sm font-semibold text-white drop-shadow-md leading-tight">
                    {t(`categories.${key}`, { defaultValue: defaultName })}
                  </span>
                </div>
              </div>
              {/* Description + plant preview circles */}
              <div className="flex flex-col items-start gap-2 p-3">
                <span className="text-[11px] leading-snug text-muted-foreground line-clamp-2">
                  {t(`categories.${key}Desc`, { defaultValue: defaultDesc })}
                </span>
                {remainingPlants.length > 0 && (
                  <div className="flex items-center -space-x-1.5">
                    {remainingPlants.map((plant) => (
                      <button
                        key={plant.id}
                        type="button"
                        title={plant.name}
                        className="relative h-7 w-7 rounded-full overflow-hidden border-2 border-white dark:border-[#1f1f1f] hover:z-10 hover:scale-125 hover:border-emerald-400 transition-all duration-200 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/plants/${plant.id}`)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation()
                            e.preventDefault()
                            navigate(`/plants/${plant.id}`)
                          }
                        }}
                      >
                        <img
                          src={plant.imageUrl}
                          alt={plant.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <RequestPlantDialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen} />
    </div>
  )
}
