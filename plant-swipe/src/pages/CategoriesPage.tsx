import {
  BookOpen,
  ArrowRight,
  MessageSquarePlus,
  Plus,
  Leaf,
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
  { key: "fruitTree", params: "?type=Tree&usage=Comestible", defaultName: "Fruit Tree", defaultDesc: "Trees that bear edible fruits" },
  { key: "bamboo", params: "?type=Bambu", defaultName: "Bamboo", defaultDesc: "Fast-growing grass family members" },
  { key: "cactusSucculent", params: "?type=Cactus,Succulent", defaultName: "Cactus & Succulent", defaultDesc: "Drought-tolerant water-storing plants" },
  { key: "herbaceous", params: "?plantHabit=shrubby,bushy,erect,upright", defaultName: "Herbaceous", defaultDesc: "Non-woody flowering plants" },
  { key: "fruitPlant", params: "?usage=Comestible", defaultName: "Fruit Plant", defaultDesc: "Plants grown for edible produce" },
  { key: "aromatic", params: "?usage=Aromatic", defaultName: "Aromatic Plant", defaultDesc: "Fragrant herbs and spice plants" },
  { key: "medicinal", params: "?usage=Medicinal", defaultName: "Medicinal Plant", defaultDesc: "Plants with therapeutic properties" },
  { key: "climbing", params: "?plantHabit=climbing,liana,trailing", defaultName: "Climbing Plant", defaultDesc: "Vines and climbers for vertical spaces" },
  { key: "perennial", params: "?lifeCycle=perennial,succulent_perennial", defaultName: "Perennial Plant", defaultDesc: "Plants that return year after year" },
  { key: "bulb", params: "?ediblePart=bulb", defaultName: "Bulb Plant", defaultDesc: "Plants that grow from bulbs or tubers" },
  { key: "indoor", params: "?livingSpace=indoor", defaultName: "Indoor Plant", defaultDesc: "Plants suited for indoor living spaces" },
  { key: "fern", params: "?q=fern", defaultName: "Fern", defaultDesc: "Shade-loving non-flowering plants" },
  { key: "aquatic", params: "?q=aquatic", defaultName: "Aquatic & Semi-Aquatic", defaultDesc: "Plants that thrive in or near water" },
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

  const livingSpace = sp.get("livingSpace")
  if (livingSpace) {
    const spaces = livingSpace.split(",").map((s) => s.trim().toLowerCase())
    const plantSpaces = (plant.living_space || []).map((s) => s.toLowerCase())
    if (!spaces.some((s) => plantSpaces.includes(s))) return false
  }

  const q = sp.get("q")
  if (q) {
    const query = q.toLowerCase()
    const name = (plant.name || "").toLowerCase()
    const scientific = (plant.scientific_name_species || "").toLowerCase()
    if (!name.includes(query) && !scientific.includes(query)) return false
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
          "id, name, plant_type, utility, plant_habit, life_cycle, edible_part, living_space, scientific_name_species, plant_images!inner(link)",
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {categories.map(({ key, params, defaultName, defaultDesc }) => {
          const previews = categoryPreviews[key] || []
          const heroPlant = previews[0]
          const remainingPlants = previews.slice(1)

          return (
            <Card
              key={key}
              role="button"
              tabIndex={0}
              className="flex cursor-pointer flex-col overflow-hidden transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => navigate(`/search${params}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  navigate(`/search${params}`)
                }
              }}
            >
              {/* Hero image header */}
              <div className="relative h-28 w-full bg-muted">
                {heroPlant ? (
                  <img
                    src={heroPlant.imageUrl}
                    alt={heroPlant.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Leaf className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              {/* Text + remaining previews */}
              <div className="flex flex-col items-center gap-1.5 p-4">
                <span className="text-sm font-medium text-center leading-tight">
                  {t(`categories.${key}`, { defaultValue: defaultName })}
                </span>
                <span className="text-xs text-muted-foreground text-center leading-tight">
                  {t(`categories.${key}Desc`, { defaultValue: defaultDesc })}
                </span>
                {remainingPlants.length > 0 && (
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    {remainingPlants.map((plant) => (
                      <button
                        key={plant.id}
                        type="button"
                        title={plant.name}
                        className="h-7 w-7 rounded-full overflow-hidden ring-1 ring-border/50 hover:ring-2 hover:ring-primary hover:scale-110 transition-all flex-shrink-0"
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
