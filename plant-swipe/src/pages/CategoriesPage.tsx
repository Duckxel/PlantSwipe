import {
  TreeDeciduous,
  Shrub,
  Apple,
  Sprout,
  Flower,
  Flower2,
  Cherry,
  Wind,
  Cross,
  ArrowUpRight,
  Repeat,
  CircleDot,
  Home,
  Leaf,
  Droplets,
  Search,
  MessageSquarePlus,
  Plus,
} from "lucide-react"
import React from "react"
import { useTranslation } from "react-i18next"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/ui/search-input"
import { useLanguageNavigate } from "@/lib/i18nRouting"
import { usePageMetadata } from "@/hooks/usePageMetadata"
import { useAuth } from "@/context/AuthContext"
import { checkEditorAccess } from "@/constants/userRoles"
import { RequestPlantDialog } from "@/components/plant/RequestPlantDialog"
import type { LucideIcon } from "lucide-react"

interface Category {
  key: string
  icon: LucideIcon
  params: string
  defaultName: string
  defaultDesc: string
}

const categories: Category[] = [
  { key: "tree", icon: TreeDeciduous, params: "?type=Tree", defaultName: "Tree", defaultDesc: "Large woody plants with a single trunk" },
  { key: "shrub", icon: Shrub, params: "?type=Shrub", defaultName: "Shrub", defaultDesc: "Multi-stemmed woody plants" },
  { key: "fruitTree", icon: Apple, params: "?type=Tree&usage=Comestible", defaultName: "Fruit Tree", defaultDesc: "Trees that bear edible fruits" },
  { key: "bamboo", icon: Sprout, params: "?type=Bambu", defaultName: "Bamboo", defaultDesc: "Fast-growing grass family members" },
  { key: "cactusSucculent", icon: Flower, params: "?type=Cactus,Succulent", defaultName: "Cactus & Succulent", defaultDesc: "Drought-tolerant water-storing plants" },
  { key: "herbaceous", icon: Flower2, params: "?plantHabit=shrubby,bushy,erect,upright", defaultName: "Herbaceous", defaultDesc: "Non-woody flowering plants" },
  { key: "fruitPlant", icon: Cherry, params: "?usage=Comestible", defaultName: "Fruit Plant", defaultDesc: "Plants grown for edible produce" },
  { key: "aromatic", icon: Wind, params: "?usage=Aromatic", defaultName: "Aromatic Plant", defaultDesc: "Fragrant herbs and spice plants" },
  { key: "medicinal", icon: Cross, params: "?usage=Medicinal", defaultName: "Medicinal Plant", defaultDesc: "Plants with therapeutic properties" },
  { key: "climbing", icon: ArrowUpRight, params: "?plantHabit=climbing,liana,trailing", defaultName: "Climbing Plant", defaultDesc: "Vines and climbers for vertical spaces" },
  { key: "perennial", icon: Repeat, params: "?lifeCycle=perennial,succulent_perennial", defaultName: "Perennial Plant", defaultDesc: "Plants that return year after year" },
  { key: "bulb", icon: CircleDot, params: "?ediblePart=bulb", defaultName: "Bulb Plant", defaultDesc: "Plants that grow from bulbs or tubers" },
  { key: "indoor", icon: Home, params: "?livingSpace=indoor", defaultName: "Indoor Plant", defaultDesc: "Plants suited for indoor living spaces" },
  { key: "fern", icon: Leaf, params: "?q=fern", defaultName: "Fern", defaultDesc: "Shade-loving non-flowering plants" },
  { key: "aquatic", icon: Droplets, params: "?q=aquatic", defaultName: "Aquatic & Semi-Aquatic", defaultDesc: "Plants that thrive in or near water" },
]

export default function CategoriesPage() {
  const { t } = useTranslation("common")
  const navigate = useLanguageNavigate()
  const { user, profile } = useAuth()
  const [searchValue, setSearchValue] = React.useState("")
  const [requestDialogOpen, setRequestDialogOpen] = React.useState(false)

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
        <p className="mt-2 text-muted-foreground">
          {t("categories.subtitle", { defaultValue: "Browse plants by category" })}
        </p>
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
                <Search className="h-5 w-5" />
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
        {categories.map(({ key, icon: Icon, params, defaultName, defaultDesc }) => (
          <Card
            key={key}
            role="button"
            tabIndex={0}
            className="flex cursor-pointer flex-col items-center gap-2 p-5 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => navigate(`/search${params}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                navigate(`/search${params}`)
              }
            }}
          >
            <Icon className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium text-center leading-tight">
              {t(`categories.${key}`, { defaultValue: defaultName })}
            </span>
            <span className="text-xs text-muted-foreground text-center leading-tight">
              {t(`categories.${key}Desc`, { defaultValue: defaultDesc })}
            </span>
          </Card>
        ))}
      </div>

      <RequestPlantDialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen} />
    </div>
  )
}
