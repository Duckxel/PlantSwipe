import {
  TreeDeciduous,
  Shrub,
  Apple,
  Sprout,
  Cactus,
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
}

const categories: Category[] = [
  { key: "tree", icon: TreeDeciduous, params: "?type=Tree" },
  { key: "shrub", icon: Shrub, params: "?type=Shrub" },
  { key: "fruitTree", icon: Apple, params: "?type=Tree&usage=Comestible" },
  { key: "bamboo", icon: Sprout, params: "?type=Bambu" },
  { key: "cactusSucculent", icon: Cactus, params: "?type=Cactus,Succulent" },
  { key: "herbaceous", icon: Flower2, params: "?q=herbaceous" },
  { key: "fruitPlant", icon: Cherry, params: "?usage=Comestible" },
  { key: "aromatic", icon: Wind, params: "?usage=Aromatic" },
  { key: "medicinal", icon: Cross, params: "?usage=Medicinal" },
  { key: "climbing", icon: ArrowUpRight, params: "?usage=Climbing" },
  { key: "perennial", icon: Repeat, params: "?q=perennial" },
  { key: "bulb", icon: CircleDot, params: "?q=bulb" },
  { key: "indoor", icon: Home, params: "?livingSpace=indoor" },
  { key: "fern", icon: Leaf, params: "?q=fern" },
  { key: "aquatic", icon: Droplets, params: "?q=aquatic" },
]

export default function CategoriesPage() {
  const { t } = useTranslation("common")
  const navigate = useLanguageNavigate()

  usePageMetadata({
    title: t("categories.title"),
    description: t("categories.subtitle"),
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("categories.title")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("categories.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {categories.map(({ key, icon: Icon, params }) => (
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
              {t(`categories.${key}`)}
            </span>
            <span className="text-xs text-muted-foreground text-center leading-tight">
              {t(`categories.${key}Desc`)}
            </span>
          </Card>
        ))}
      </div>
    </div>
  )
}
