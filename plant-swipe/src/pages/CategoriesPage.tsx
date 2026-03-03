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
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Card } from "@/components/ui/card"
import { useLanguageNavigate } from "@/lib/i18nRouting"
import { usePageMetadata } from "@/hooks/usePageMetadata"
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
  { key: "herbaceous", icon: Flower2, params: "?q=herbaceous", defaultName: "Herbaceous", defaultDesc: "Non-woody flowering plants" },
  { key: "fruitPlant", icon: Cherry, params: "?usage=Comestible", defaultName: "Fruit Plant", defaultDesc: "Plants grown for edible produce" },
  { key: "aromatic", icon: Wind, params: "?usage=Aromatic", defaultName: "Aromatic Plant", defaultDesc: "Fragrant herbs and spice plants" },
  { key: "medicinal", icon: Cross, params: "?usage=Medicinal", defaultName: "Medicinal Plant", defaultDesc: "Plants with therapeutic properties" },
  { key: "climbing", icon: ArrowUpRight, params: "?usage=Climbing", defaultName: "Climbing Plant", defaultDesc: "Vines and climbers for vertical spaces" },
  { key: "perennial", icon: Repeat, params: "?q=perennial", defaultName: "Perennial Plant", defaultDesc: "Plants that return year after year" },
  { key: "bulb", icon: CircleDot, params: "?q=bulb", defaultName: "Bulb Plant", defaultDesc: "Plants that grow from bulbs or tubers" },
  { key: "indoor", icon: Home, params: "?livingSpace=indoor", defaultName: "Indoor Plant", defaultDesc: "Plants suited for indoor living spaces" },
  { key: "fern", icon: Leaf, params: "?q=fern", defaultName: "Fern", defaultDesc: "Shade-loving non-flowering plants" },
  { key: "aquatic", icon: Droplets, params: "?q=aquatic", defaultName: "Aquatic & Semi-Aquatic", defaultDesc: "Plants that thrive in or near water" },
]

export default function CategoriesPage() {
  const { t } = useTranslation("common")
  const navigate = useLanguageNavigate()

  usePageMetadata({
    title: t("categories.title", { defaultValue: "Categories" }),
    description: t("categories.subtitle", { defaultValue: "Browse plants by category" }),
  })

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
    </div>
  )
}
